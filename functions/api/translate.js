// functions/api/translate.js

// 您的核心提示词，作为模板安全地存放在后端 (未做任何修改)
const TRANSLATION_PROMPT_TEMPLATE = `
你是【中缅双语高保真翻译引擎】。

【总原则】
- 忠实原文，不增不减
- 不解释、不推测、不扩写
- 回译必须严格翻回源语言

【语言要求】
- 缅甸语：现代日常口语
- 中文：自然口语
- 不使用俚语、流行语
- 不添加敬语

【翻译任务】
源语言：{SOURCE_LANG}
目标语言：{TARGET_LANG}

原文：
"{USER_TEXT}"

【输出格式】

【① 原结构直译】
翻译：
<<<T1>>>
回译：
<<<B1>>>

【② 自然直译（推荐）】
翻译：
<<<T2>>>
回译：
<<<B2>>>

【③ 顺语直译】
翻译：
<<<T3>>>
回译：
<<<B3>>>

【④ 口语版】
翻译：
<<<T4>>>
回译：
<<<B4>>>

【⑤ 自然意译】
翻译：
<<<T5>>>
回译：
<<<B5>>>
`;

/**
 * [新增] AI 结果解析器
 * 这个函数的作用是将 AI 返回的一整块文本，根据您在提示词中定义的 <<<TAG>>> 标记，
 * 转换成前端需要的小卡片JSON数据结构。
 * @param {string} text - AI返回的原始文本。
 * @returns {object}
 */
function parseAIOutput(text) {
  const extract = (tag) => {
    const regex = new RegExp(`<<<${tag}>>>(.*?)<<<`, 's');
    const match = text.match(regex);
    return match?.[1]?.trim() || '';
  };

  return {
    direct: { translation: extract('T2'), back: extract('B2') }, // 自然直译（推荐）作为 direct
    spoken: { translation: extract('T4'), back: extract('B4') }, // 口语版 作为 spoken
    free: { translation: extract('T5'), back: extract('B5') },   // 自然意译 作为 free
    social: { translation: extract('T3'), back: extract('B3') }  // 顺语直译 作为 social (可按需调整)
  };
}


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
    const aiGeneratedText = data.choices?.[0]?.message?.content || "";

    // 5. 【核心修改】格式化结果并返回给前端
    // 使用上面新增的 parseAIOutput 函数来处理 AI 返回的文本
    const parsedData = parseAIOutput(aiGeneratedText);
    
    // 构建前端期望的、能够渲染成小卡片的 JSON 结构
    const responsePayload = {
      raw: aiGeneratedText, // 保留原始回复，方便调试
      parsed: parsedData,
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
