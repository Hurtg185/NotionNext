// functions/api/translate.js

// 您的核心提示词，作为模板安全地存放在后端
const TRANSLATION_PROMPT_TEMPLATE = `
你现在是【中缅双语专业翻译引擎】，专门处理【中文 ⇄ 缅甸语】。

━━━━━━━━━━━━━━━━━━
【绝对规则｜不可违反】
1️⃣ 忠实原文，不增、不减、不解释
2️⃣ 保持原句语气、礼貌程度、强弱
3️⃣ 缅甸语必须符合【日常口语使用习惯】，不使用书面腔
4️⃣ 回译 = 【逐字逐义翻回源语言】，不是解释、不是说明
5️⃣ 禁止任何多余说明、标注、点评
6️⃣ 严格按照指定格式输出

━━━━━━━━━━━━━━━━━━
【语言约束（非常重要）】

▶ 如果目标语言是【缅甸语】：
- 使用现代日常缅甸语
- 避免过度正式、书面、公文表达
- 不添加敬语，除非原文有

▶ 如果源语言是【缅甸语】：
- 回译必须是自然中文口语
- 不要翻成书面中文

━━━━━━━━━━━━━━━━━━
【翻译任务】
源语言：{SOURCE_LANG}
目标语言：{TARGET_LANG}

原文：
"{USER_TEXT}"

━━━━━━━━━━━━━━━━━━
【固定输出格式｜逐字遵守】

【1️⃣ 直接翻译版】
翻译：
<<<T1>>>
回译：
<<<B1>>>

【2️⃣ 地道口语版】
翻译：
<<<T2>>>
回译：
<<<B2>>>

【3️⃣ 自然意译版】
翻译：
<<<T3>>>
回译：
<<<B3>>>

【4️⃣ 社交使用版】
翻译：
<<<T4>>>
回译：
<<<B4>>>

━━━━━━━━━━━━━━━━━━
【最终自检】
- 回译语言是否等于源语言？
- 是否出现解释性内容？
如有，修正后再输出。
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
