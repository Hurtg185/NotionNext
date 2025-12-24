// pages/api/chat.js

// 关键：延长 Serverless Function 的最大执行时间
// 将默认的 10-15 秒延长到 60 秒（免费版 Vercel/CF 的上限）
export const config = {
  maxDuration: 60,
};

// Pages Router 的标准写法
export default async function handler(req, res) {
  // 1. 严格检查请求方法，只允许 POST
  if (req.method !== 'POST') {
    // 设置响应头并返回 405 错误
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 2. 从请求体中获取数据
    const { messages, config: clientConfig } = req.body;
    
    // 3. 从前端传来的配置中获取 API Key
    const API_KEY = clientConfig?.apiKey;

    if (!API_KEY) {
      return res.status(400).json({ error: '后端未接收到 API Key' });
    }

    const modelId = clientConfig.modelId || 'meta/llama-3.1-70b-instruct';
    console.log(`[API PROXY] 正在请求 NVIDIA API，模型: ${modelId}`);

    // 4. 向 NVIDIA API 发起请求
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
        max_tokens: 1024,
        stream: false
      })
    });

    // 5. 如果 NVIDIA 返回了非 200 的状态码
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[API PROXY] NVIDIA API 返回错误 (${apiResponse.status}):`, errorText);
      
      // 将具体的错误信息以 JSON 格式返回给前端
      return res.status(apiResponse.status).json({
        error: `API 请求失败 (${apiResponse.status})`,
        details: errorText.substring(0, 500)
      });
    }

    // 6. 成功后，解析 JSON 并返回
    const data = await apiResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    // 捕获 fetch 本身的错误，例如网络不通等
    console.error('[API PROXY] 服务器内部错误:', error);
    return res.status(500).json({
      error: `服务器代理错误: ${error.message}`
    });
  }
}
