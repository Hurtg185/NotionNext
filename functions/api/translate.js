/**
 * Cloudflare Pages Function
 * 处理路径: /api/translate
 */

export async function onRequestPost(context) {
  try {
    // 1. 解析请求体
    const { request, env } = context;
    const { text, targetLang = 'my', context: chatContext = [] } = await request.json();

    // 2. 配置参数 (建议在 CF 后台设置环境变量 IFLOW_API_KEY，或者临时硬编码)
    // 注意：CF 环境变量通过 env.VARIABLE_NAME 获取
    const API_KEY = env.IFLOW_API_KEY || "sk-xxxxxxxx"; // ⚠️ 请确保这里填入了你的 Key
    const API_URL = "https://apis.iflow.cn/v1/chat/completions";
    const MODEL = "deepseek-v3.2";

    // 3. 定义语言名称和特定风格描述 (融合了你的要求)
    const langMap = {
      'my': '缅甸语',
      'zh': '中文',
      'en': '英语'
    };
    const tName = langMap[targetLang] || targetLang;
    
    // 针对缅甸语/中文的特定风格描述
    const spokenStyle = targetLang === 'my' ? '缅甸年轻人日常生活中' : (targetLang === 'zh' ? '中国年轻人日常生活中' : '当地人日常');
    const nativeStyle = targetLang === 'my' ? '缅甸人' : (targetLang === 'zh' ? '中国人' : '母语者');

    // 4. 构建融合版 System Prompt
    const SYSTEM_PROMPT = `
你是一个商业级多语言互译引擎。
任务：将用户输入的内容翻译成【${tName}】。

【核心指令】
请严格按照以下 JSON 格式输出翻译结果，不要包含任何 Markdown 代码块标记（如 \`\`\`json），直接输出 JSON 对象。

【必须包含的 3 个版本】

1. version: "A" (Label: "自然直译")
   - 要求：保留原文结构，符合${tName}语法，读起来不生硬。
   - 场景：正式、学习、准确理解原文结构。

2. version: "B" (Label: "地道口语")
   - 要求：采用${spokenStyle}常说的自然表达方式，语气轻松，可以使用俚语或习惯用语，但必须保持原意准确。
   - 场景：聊天、社交、生活对话。

3. version: "C" (Label: "深度意译")
   - 要求：遵循${nativeStyle}的思维方式，彻底脱离原文的字面束缚，怎么顺口怎么来，但绝不偏离核心语义。
   - 场景：文学、高情商回复、文化适应。

【输出数据结构】
{
  "results": [
    {
      "version": "A",
      "label": "自然直译",
      "translation": "此处填${tName}译文",
      "back_translation": "此处填精准的中文回译，用于验证语义",
      "recommended": true/false (根据哪个最符合原意且最自然来判断，只标记一个为 true)
    },
    { ... 版本 B ... },
    { ... 版本 C ... }
  ]
}

【安全规则】
若原文涉及法律、金钱交易或严肃承诺，请强制推荐 "自然直译" 版本。
`;

    // 5. 组装消息链
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chatContext, // 历史上下文
      { role: "user", content: `请翻译：${text}` }
    ];

    // 6. 请求阿里心流接口
    const upstreamResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.4, // 稍微提高一点以获得更地道的口语
        stream: false,
        response_format: { type: "json_object" }
      })
    });

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      return new Response(JSON.stringify({ error: `Upstream API Error: ${upstreamResponse.status}`, details: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await upstreamResponse.json();
    let content = data.choices[0]?.message?.content || "{}";

    // 7. 清洗数据 (防止模型偶尔加 Markdown)
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // 8. 返回给前端
    return new Response(content, {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // 允许跨域调用
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Function Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
