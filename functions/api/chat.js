// functions/api/chat.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { messages, config, email } = await request.json();
    const API_KEY = config?.apiKey;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: '请在设置中填写 API Key' }), { 
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: '用户身份未识别，请重新登录' }), { status: 401 });
    }

    // 1. 检查是否是 Premium 用户
    const user = await db.prepare('SELECT unlocked_levels FROM Users WHERE email = ?').bind(email).first();
    const isPremium = user?.unlocked_levels && user.unlocked_levels.trim().length > 0;

    // 2. 如果不是 Premium，执行严格次数检查和扣费
    if (!isPremium) {
      let usage = await db.prepare('SELECT used_count, total_free FROM AIUsage WHERE email = ?').bind(email).first();
      
      // 如果没记录，自动初始化送 3 次
      if (!usage) {
        const DEFAULT_FREE = 3;
        await db.prepare(`
          INSERT INTO AIUsage (email, used_count, total_free, created_at, updated_at)
          VALUES (?, 0, ?, ?, ?)
        `).bind(email, DEFAULT_FREE, Date.now(), Date.now()).run();
        usage = { used_count: 0, total_free: DEFAULT_FREE };
      }

      // 拦截：次数已用完
      if (usage.used_count >= usage.total_free) {
        return new Response(JSON.stringify({ 
          error: '免费额度已用完', 
          code: 'QUOTA_EXCEEDED' 
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // --- 核心修复：撕票（扣费） ---
      // 在确认有次数后，立刻把数据库里的已用次数 +1
      await db.prepare(`
        UPDATE AIUsage 
        SET used_count = used_count + 1, updated_at = ? 
        WHERE email = ?
      `).bind(Date.now(), email).run();
    }
    
    // --- 3. 开始请求 NVIDIA ---
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
      // 如果 AI 请求失败，这里可以选择是否退回次数，
      // 但为了防止恶意刷额度，通常“撕票”了就不退了。
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `API Error: ${response.status}`, details: errorText }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Server Error: ${err.message}` }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
