// pages/api/chat.js
export const config = {
  runtime: 'edge', // 关键
};

export default async function handler(req) {
  // 处理预检请求 (CORS)
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
      return new Response(JSON.stringify({ error: 'API Key is missing' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const payload = {
      model: clientConfig?.modelId || 'meta/llama-3.1-70b-instruct',
      messages: messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true
    };

    const targetUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `Upstream Error: ${apiResponse.status}`, details: errorText }), { 
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 直接透传流
    return new Response(apiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
