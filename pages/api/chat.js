// 关键 1: 将运行时切换到 Edge，它非常适合流式传输，且超时更宽松
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, config: clientConfig } = await req.json();
    const API_KEY = clientConfig?.apiKey;

    if (!API_KEY) {
      return new Response('data: {"error": {"message": "API Key is missing"}}\n\n', { status: 400, headers: { 'Content-Type': 'text/event-stream' } });
    }

    const modelId = clientConfig.modelId || 'meta/llama-3.1-70b-instruct';
    const baseUrl = clientConfig.baseUrl || 'https://integrate.api.nvidia.com/v1';
    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    // 关键 2: 开启 stream: true
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
        max_tokens: 4096, // 可以设置一个较大的值
        stream: true 
      })
    });

    // 如果 API 本身返回错误（例如 Key 错误），也以流的形式返回错误信息
    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error(`[API PROXY] Upstream API Error (${apiResponse.status}):`, errorText);
        const errorStream = new ReadableStream({
            start(controller) {
                const errorPayload = `data: ${JSON.stringify({ error: { message: `API Error (${apiResponse.status}): ${errorText.substring(0, 100)}...` } })}\n\n`;
                controller.enqueue(new TextEncoder().encode(errorPayload));
                controller.close();
            }
        });
        return new Response(errorStream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }

    // 关键 3: 直接将 API 返回的流转发给前端
    return new Response(apiResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('[API PROXY] Server Error:', error);
    // 捕获服务器自身错误，也以流的形式返回
    const errorStream = new ReadableStream({
        start(controller) {
            const errorPayload = `data: ${JSON.stringify({ error: { message: `代理服务器错误: ${error.message}` } })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorPayload));
            controller.close();
        }
    });
    return new Response(errorStream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }
}
