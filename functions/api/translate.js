// functions/api/translate.js

// 您的核心提示词，作为模板安全地存放在后端
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

【① 直接翻译】
翻译：
<<<T1>>>
回译：
<<<B1>>>

【② 地道口语】
翻译：
<<<T2>>>
回译：
<<<B2>>>

【③ 自然意译】
翻译：
<<<T3>>>
回译：
<<<B3>>>

【④ 社交语气】
翻译：
<<<T4>>>
回译：
<<<B4>>>
`; // 修正 1：在这里正确地闭合了反引号，并删除了无效的分隔符行

/**
 * 核心修正 2：新增一个解析函数，用于将 AI 返回的文本块转换为结构化 JSON。
 * @param {string} text - AI 返回的原始文本。
 * @returns {object} - 包含 direct, spoken, free, social 四个翻译版本的对象。
 */
function parseAIOutput(text) {
  // 辅助函数，用于安全地提取标记之间的内容
  const extract = (tag) => {
    const regex = new RegExp(`<<<${tag}>>>(.*?)<<<`, 's');
    const match = text.match(regex);
    return match?.?.trim() || '';
  };

  return {
    direct: {
      translation: extract('T1'),
      back: extract('B1'),
    },
    spoken: {
      translation: extract('T2'),
      back: extract('B2'),
    },
    free: {
      translation: extract('T3'),
      back: extract('B3'),
    },
    social: {
      translation: extract('T4'),
      back: extract('B4'),
    },
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

    // 2. 确定 API 配置
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
    const aiGeneratedText = data.choices?.?.message?.content || "";

    // 5. 核心修正 3：使用解析器处理 AI 文本，并构建前端需要的响应结构
    const parsedData = parseAIOutput(aiGeneratedText);
    
    // 你的前端代码现在可以正确接收这个结构了
    const responsePayload = {
      raw: aiGeneratedText, // 保留原始文本，方便调试
      parsed: parsedData,
      quick_replies: [] // 如果需要，也可以让 AI 生成快捷回复
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
