// functions/api/chat.js

export async function onRequestPost(context) {
  const { request } = context;

  try {
    // 1. 解析前端数据
    const { messages, config } = await request.json();
    const API_KEY = config?.apiKey;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: '请在设置中填写 API Key' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. 准备请求 NVIDIA
    const payload = {
      model: config?.modelId || 'meta/llama-3.1-70b-instruct',
      messages: messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true
    };

    // 3. 发起请求
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
