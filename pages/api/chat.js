export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { messages, config } = req.body;
    const API_KEY = config?.apiKey;

    if (!API_KEY) {
      return res.status(400).json({ error: '后端未接收到 API Key' });
    }

    console.log("正在请求 NVIDIA API:", config.modelId);

    // 设置请求超时 (Next.js serverless 默认限制，防止无限挂起)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55秒超时

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: config.modelId || 'deepseek-ai/deepseek-r1',
          messages: messages,
          temperature: 0.6,
          top_p: 0.7,
          max_tokens: 1024,
          stream: false // 必须为 false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 如果 NVIDIA 返回错误状态码，尝试读取错误文本
      if (!response.ok) {
        const errorText = await response.text();
        console.error("NVIDIA API Error Status:", response.status, errorText);
        return res.status(response.status).json({ 
          error: `API 报错 (${response.status}): ${errorText.substring(0, 200)}` 
        });
      }

      const data = await response.json();
      res.status(200).json(data);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error("请求超时");
        return res.status(504).json({ error: "请求超时：AI 思考时间过长，请尝试更换模型" });
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('Server Internal Error:', error);
    // 确保无论发生什么错误，都返回 JSON
    res.status(500).json({ error: `服务器内部错误: ${error.message}` });
  }
}
