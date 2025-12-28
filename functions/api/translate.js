// functions/api/translate.js

// 您的核心提示词，作为模板安全地存放在后端
const TRANSLATION_PROMPT_TEMPLATE = `
# 🎯 角色定义
你是一位顶级的语言学家和翻译大师，能够处理任何语言之间的转换。

# 🔒 核心翻译原则（不可违反）
> **忠实原文 ＞ 语义清晰 ＞ 语言自然**
自检机制（输出前内部执行）
□ 是否新增了原文不存在的信息？
□ 是否改变了语气强度？
□ 是否为了"好听"而改变意思？
→ 如有，必须修正后再输出

# 📤 输出模式
对于用户的每一次输入，你都需要提供以下三种不同风格的翻译结果。

📖 **1. 直接翻译版 **
-   **[目标语言翻译]**
-   **回译 **

💬 **2. 地道口语版 (就像当地人说话那样，没ai痕迹)**
-   **[目标语言翻译]**
-   **回译 (Meaning)**:

🌐 **3. 意译版 (自然意译)**
-   回译
4.符合社交版
---回译

# ✅ 翻译任务
现在，请将以下内容从 **{SOURCE_LANG}** 翻译成 **{TARGET_LANG}**:

"{USER_TEXT}"
`;

/**
 * Cloudflare Functions API handler
 * 当浏览器访问 /api/translate 时，这里的代码就会执行
 */
export async function onRequestPost(context) {
  try {
    // 1. 从前端请求中解析出 JSON 数据
    const { text, sourceLang, targetLang, customConfig } = await context.request.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text to translate is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 确定 API 配置 (优先级: 前端传入 > 服务器环境变量 > 默认值)
    // context.env.IFLOW_API_KEY 是在 Cloudflare Dashboard 设置的环境变量，最安全
    const apiKey = customConfig?.apiKey || context.env.IFLOW_API_KEY; 
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key is missing.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiUrl = customConfig?.apiUrl || 'https://apis.iflow.cn/v1';
    const model = customConfig?.model || 'deepseek-v3.2';

    // 3. 构造最终的 Prompt
    const finalPrompt = TRANSLATION_PROMPT_TEMPLATE
      .replace('{SOURCE_LANG}', sourceLang || 'auto')
      .replace('{TARGET_LANG}', targetLang || '中文')
      .replace('{USER_TEXT}', text);

    // 4. 发起对外部 AI 服务的请求
    const apiResponse = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'system', content: finalPrompt }],
        stream: false,
      }),
    });

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        console.error('External API Error:', errorData);
        return new Response(JSON.stringify({ error: 'External API failed', details: errorData }), {
            status: apiResponse.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const data = await apiResponse.json();
    const aiGeneratedText = data.choices?.[0]?.message?.content || "AI did not return a valid response.";

    // 5. 格式化结果并返回给前端
    const responsePayload = {
      results: [{
        label: "AI 多风格翻译",
        translation: aiGeneratedText,
        recommended: true,
      }],
      quick_replies: []
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Internal Server Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to connect to the translation service.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
