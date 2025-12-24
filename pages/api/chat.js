// 关键：延长 Vercel Serverless Function 的最大执行时间
// 将默认的 10-15 秒延长到 60 秒（免费版 Vercel 的上限）
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // 1. 检查请求方法是否为 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 2. 从请求体中获取数据
    const { messages, config: clientConfig } = req.body;
    
    // 3. 从前端传来的配置中获取 API Key
    const API_KEY = clientConfig?.apiKey;

    if (!API_KEY) {
      // 如果没有 Key，返回 400 错误
      return res.status(400).json({ error: '后端未接收到 API Key' });
    }

    const modelId = clientConfig.modelId || 'meta/llama-3.1-70b-instruct'; // 提供一个备用模型
    console.log(`[API PROXY] 正在请求 NVIDIA API，模型: ${modelId}`);

    // 4. 向 NVIDIA API 发起请求
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
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
        stream: false // 必须为 false
      })
    });

    // 5. 健壮的错误处理：如果 NVIDIA 返回非 200 状态码
    if (!response.ok) {
      // 尝试读取返回的错误文本，无论它是什么格式
      const errorText = await response.text();
      console.error(`[API PROXY] NVIDIA API 返回错误 (${response.status}):`, errorText);
      
      // 将具体的错误信息返回给前端，而不是让前端去猜
      return res.status(response.status).json({
        error: `API 请求失败 (${response.status})`,
        details: errorText.substring(0, 500) // 只截取前500个字符，防止过长
      });
    }

    // 6. 只有在 response.ok 为 true 时，才尝试解析 JSON 并返回
    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    // 捕获 fetch 本身的错误，例如网络不通等
    console.error('[API PROXY] 服务器内部错误:', error);
    return res.status(500).json({
      error: `服务器代理错误: ${error.message}`
    });
  }
}
