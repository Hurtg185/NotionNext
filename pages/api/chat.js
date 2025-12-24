// pages/api/chat.js

// 1. 强制使用 Edge Runtime (Vercel/Cloudflare 必需)
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 2. 处理 OPTIONS 请求 (解决 Cloudflare 某些情况下的跨域/405问题)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { messages, config: clientConfig } = await req.json();
    const API_KEY = clientConfig?.apiKey;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: '请在设置中填写 API Key' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. 构建请求，强制 stream: true
    const payload = {
      model: clientConfig?.modelId || 'meta/llama-3.1-70b-instruct',
      messages: messages,
      temperature: 0.7, // 稍微调高一点，让回复更自然
      top_p: 0.9,
      max_tokens: 4096, // 允许长回复
      stream: true      // 🔴 关键：必须流式
    };

    const targetUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

    console.log(`[Proxy] Requesting ${payload.model}...`);

    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`[Proxy Error] ${apiResponse.status}: ${errText}`);
      return new Response(JSON.stringify({ error: `上游 API 报错: ${apiResponse.status}`, details: errText }), { 
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. 直接透传流，不处理
    return new Response(apiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (e) {
    console.error('[Server Error]', e);
    return new Response(JSON.stringify({ error: `服务器内部错误: ${e.message}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
