// pages/api/chat.js

// 🔴 关键：使用 Edge Runtime，无超时限制，专为流式传输设计
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. 检查 POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, config: clientConfig } = await req.json();
    const API_KEY = clientConfig?.apiKey;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'API Key 缺失' }), { status: 400 });
    }

    // 2. 向 Nvidia 发起请求
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: clientConfig.modelId || 'deepseek-ai/deepseek-r1', // 支持 DeepSeek
        messages: messages,
        temperature: 0.6,
        top_p: 0.7,
        max_tokens: 4096, // 允许长回复
        stream: true // 🔴 必须开启流式，否则 DeepSeek 必超时
      })
    });

    // 3. 错误处理
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Upstream Error: ${response.status}`, details: errorText }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. 🔴 关键：直接透传流，不要使用 await response.json()
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
