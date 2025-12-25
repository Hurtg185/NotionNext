// functions/api/chat.js

export async function onRequestPost(context) {
  const { request, env } = context; // 注入 env 以使用 D1 数据库
  const db = env.DB;

  try {
    // 1. 解析前端数据 (新增获取 email)
    const { messages, config, email } = await request.json();
    const API_KEY = config?.apiKey;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: '请在设置中填写 API Key' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: '用户身份未识别，请重新登录' }), { status: 401 });
    }

    // --- 🛡️ 核心安全检查：次数拦截 ---
    
    // 检查用户是否已激活课程 (解锁了任何等级即视为 Premium)
    const user = await db.prepare('SELECT unlocked_levels FROM Users WHERE email = ?').bind(email).first();
    const isPremium = user?.unlocked_levels && user.unlocked_levels.trim().length > 0;

    if (!isPremium) {
      // 没买课的用户，检查 AIUsage 表
      const usage = await db.prepare('SELECT used_count, total_free FROM AIUsage WHERE email = ?').bind(email).first();
      
      // 如果没记录或次数已用完
      if (!usage || usage.used_count >= usage.total_free) {
        return new Response(JSON.stringify({ 
          error: '免费额度已用完', 
          code: 'QUOTA_EXCEEDED' 
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // --- ✅ 检查通过，开始请求 AI ---

    // 2. 准备请求 NVIDIA
    const payload = {
      model: config?.modelId || 'meta/llama-3.1-70b-instruct',
      messages: messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true
    };

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `API Error: ${response.status}`, details: errorText }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. 直接透传流式响应
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Server Error: ${err.message}` }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理 OPTIONS 请求 (解决跨域预检)
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
