// functions/api/translate.js

// 您的核心提示词，作为模板存放在后端
const TRANSLATION_PROMPT_TEMPLATE = `
# 🎯 角色定义
你是一位顶级的语言学家和翻译大师，能够处理任何语言之间的转换。你的核心任务是提供多种风格的高质量翻译，以满足用户在不同场景下的沟通需求。

# 🔒 核心翻译原则（不可违反）
## 优先级锁定（发生冲突时严格按此顺序）
> **忠实原文 ＞ 语义清晰 ＞ 语言自然**
## 强制规则
1.  **信息完整性**：不得新增、删减、合并或弱化原文的任何核心信息。
2.  **语气对等**：原文的语气（如正式、非正式、幽默、严肃、强硬等）必须在译文中得到同等体现，严禁擅自美化或扭曲。
3.  **逐句映射**：每个翻译版本都应保持与原文相似的句子结构和逻辑流，避免大规模重组。
4.  **基准确立**：“直接翻译版”是所有其他版本的基础，后续版本仅在表达方式上进行调整，不得偏离其核心语义。
## 格式规范
-   所有目标语言的翻译文本必须 **加粗** 显示。
-   **严禁** 使用罗马字母或其他非目标语言文字进行注音。
-   输出内容必须分段清晰，排版工整。

---

# 📤 输出模式
对于用户的每一次输入，你都需要提供以下三种不同风格的翻译结果。

📖 **1. 直接翻译版 (Direct & Faithful Translation)**
-   **[目标语言翻译]**
-   **回译 (Back-translation)**: [将你的翻译结果直译回源语言，用于检验准确性]

💬 **2. 地道口语版 (Idiomatic & Natural Version)**
-   **[目标语言翻译]**
-   **释义 (Meaning)**: [用源语言解释这个版本的意思，特别是它与直接翻译版的区别]

🌐 **3. 情景变体版 (Context-Aware Version)**
-   提供至少两种常见场景下的变体，例如：
    -   **正式/书面语 (Formal / Written):** **[目标语言翻译]**
    -   **非正式/口头语 (Informal / Spoken):** **[目标语言翻译]**
-   **说明 (Note)**: [简要说明两种变体的使用场景]

---

# ✅ 翻译任务
现在，请将以下内容从 **{SOURCE_LANG}** 翻译成 **{TARGET_LANG}**:

"{USER_TEXT}"
`;

// API 请求处理函数
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- 1. 从前端获取数据 ---
  const { text, sourceLang, targetLang, customConfig } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text to translate is required' });
  }

  // --- 2. 确定最终的 API 配置 (优先级：前端传入 > 环境变量 > 默认值) ---
  
  // API Key: 优先使用前端传入的 Key，否则使用服务器环境变量。这最安全。
  const apiKey = customConfig?.apiKey || process.env.IFLOW_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: 'API Key is missing. Please configure it in the settings or on the server.' });
  }

  // API URL: 优先使用前端传入的 URL，否则使用默认值
  const apiUrl = customConfig?.apiUrl || 'https://apis.iflow.cn/v1';

  // Model: 优先使用前端传入的模型，否则使用默认值
  const model = customConfig?.model || 'deepseek-v3.2'; // 默认模型

  // --- 3. 构造最终的 Prompt ---
  const finalPrompt = TRANSLATION_PROMPT_TEMPLATE
    .replace('{SOURCE_LANG}', sourceLang || 'auto')
    .replace('{TARGET_LANG}', targetLang || '中文')
    .replace('{USER_TEXT}', text);

  // --- 4. 发起对外部 AI 服务的请求 ---
  try {
    const apiResponse = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // 使用确定的 API Key
      },
      body: JSON.stringify({
        model: model, // 使用确定的模型
        messages: [
          // 我们将整个详细的 Prompt 作为 "system" 指令，这效果通常更好
          { role: 'system', content: finalPrompt },
          // 也可以把用户输入放在这里，但上面整合的方式更稳定
          // { role: 'user', content: text } 
        ],
        stream: false, // 我们需要一次性返回完整结果
        temperature: 0.7, // 可调整的参数
      }),
    });

    // 错误处理：如果 API 返回非 200 的状态码
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('External API Error:', errorData);
      return res.status(apiResponse.status).json({
        error: `External API failed with status ${apiResponse.status}`,
        details: errorData,
      });
    }

    const data = await apiResponse.json();

    // 从返回结果中提取核心内容
    const aiGeneratedText = data.choices?.[0]?.message?.content || "AI did not return a valid response.";
    
    // --- 5. 格式化结果并返回给前端 ---
    // AI 返回的是一个包含多种风格的 Markdown 文本，我们直接把它作为一个结果返回
    const parsedResults = [
        {
            label: "AI 多风格翻译",
            translation: aiGeneratedText, // 直接使用 AI 生成的完整文本
            recommended: true,
            back_translation: "AI generated multiple styles as requested.",
            similarity_score: null,
            risk_level: null
        }
    ];

    res.status(200).json({ results: parsedResults, quick_replies: [] });

  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'Failed to connect to the translation service.' });
  }
}
