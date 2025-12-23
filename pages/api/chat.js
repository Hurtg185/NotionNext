// pages/api/chat.js
export default async function handler(req, res) {
  // 1. 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { messages, config } = req.body;

    // 2. 获取前端传来的用户 Key
    // 注意：这里优先使用用户在设置里填的 Key (config.apiKey)
    const API_KEY = config?.apiKey; 

    if (!API_KEY) {
      return res.status(400).json({ error: '请在设置面板中填入 API Key' });
    }

    // 3. 替用户向 NVIDIA 发起请求
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}` // 使用用户的 Key
      },
      body: JSON.stringify({
        model: config.modelId || 'deepseek-ai/deepseek-r1',
        messages: messages,
        temperature: 0.6,
        top_p: 0.7,
        max_tokens: 1024,
        stream: false
      })
    });

    // 4. 处理 NVIDIA 的错误
    if (!response.ok) {
      const errorData = await response.text();
      console.error("NVIDIA API Error:", errorData);
      return res.status(response.status).json({ error: `NVIDIA 报错: ${response.statusText}`, details: errorData });
    }

    // 5. 将结果返回给前端
    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: '服务器连接超时，请检查网络' });
  }
}
