// functions/api/translate.js

// 您的核心提示词，作为模板安全地存放在后端
const TRANSLATION_PROMPT_TEMPLATE = `
你是一名【中缅双语专业翻译引擎】。

━━━━━━━━━━━━━━━━━━
【总原则（最高优先级）】
1. 忠实原文，不增、不减、不解释
2. 不推测说话人身份、关系、情绪
3. 不添加原文不存在的信息
4. 回译 = 严格翻回源语言本身

━━━━━━━━━━━━━━━━━━
【语言要求】
- 缅甸语：现代日常口语，不用书面腔
- 中文：自然口语，不用书面表达
- 不使用网络流行语
- 不添加敬语，除非原文存在

━━━━━━━━━━━━━━━━━━
【翻译任务】
源语言：{SOURCE_LANG}
目标语言：{TARGET_LANG}

原文：
"{USER_TEXT}"

━━━━━━━━━━━━━━━━━━
【输出格式（严格遵守）】

【① 自然直译版】
要求：最大限度保留原句结构和含义，仅做必要的语序和虚词调整。
翻译：
<<<T1>>>
回译：
<<<B1>>>

【② 口语版】
要求：不改变含义，仅转为日常口头交流中自然会说的表达，不使用俚语或流行语。
翻译：
<<<T2>>>
回译：
<<<B2>>>

【③ 自然意译版】
要求：保持交际意图一致，可调整句式，但不得增加原文未表达的信息。
翻译：
<<<T3>>>
回译：
<<<B3>>>

【④ 通顺意译版】
要求：使用目标语言中最常见、最顺口、最不别扭的日常表达。
翻译：
<<<T4>>>
回译：
<<<B4>>>

【⑤ 文化版】
要求：在不增加信息的前提下，选择目标语言中最稳妥、最得体、不冒犯的表达。
翻译：
<<<T5>>>
回译：
<<<B5>>>

━━━━━━━━━━━━━━━━━━
【最终检查】
- 回译是否等于源语言？
- 是否有信息增加或删减？
如有，修正后再输出。
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
