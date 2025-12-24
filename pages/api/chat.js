// pages/api/chat.js

export const config = {
  runtime: 'edge', // 适配 Cloudflare Pages
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, config: clientConfig } = await req.json();
    
    // 从前端传来的配置中获取
    const API_KEY = clientConfig?.apiKey;
    const modelId = clientConfig?.modelId || 'meta/llama-3.1-70b-instruct';
    const baseUrl = clientConfig?.baseUrl || 'https://integrate.api.nvidia.com/v1';

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: '后端未接收到 API Key' }), { status: 400 });
    }

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[API PROXY] Error (${apiResponse.status}):`, errorText);
      return new Response(JSON.stringify({ 
        error: `API 请求失败 (${apiResponse.status})`, 
        details: errorText.substring(0, 500) 
      }), { status: apiResponse.status });
    }

    const data = await apiResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[API PROXY] Server Error:', error);
    return new Response(JSON.stringify({ error: `服务器错误: ${error.message}` }), { status: 500 });
  }
}
