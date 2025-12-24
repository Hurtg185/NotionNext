// pages/api/chat.js

export const config = {
  runtime: 'edge', // 关键：将运行时切换到 Edge，它非常适合流式传输
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, config: clientConfig } = await req.json();
    const API_KEY = clientConfig?.apiKey;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 400 });
    }

    const modelId = clientConfig.modelId || 'meta/llama-3.1-70b-instruct';

    // 向 NVIDIA API 请求时，开启 stream: true
    const apiResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        temperature: 0.6,
        top_p: 0.7,
        max_tokens: 4096, // 可以适当调大
        stream: true // 关键：开启流式传输
      })
    });
    
    // 直接将 NVIDIA 返回的流转发给前端
    return new Response(apiResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('[API STREAM ERROR]', error);
    return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), { status: 500 });
  }
}
