// pages/api/translate.js

export const config = {
  runtime: 'edge', // 保持 Edge 运行时
};

const TRANSLATION_PROMPT_TEMPLATE = `
你是【中缅双语高保真翻译引擎】。
【总原则】
- 忠实原文，不增不减
- 回译必须严格翻回源语言
【语言要求】
- 缅甸语：现代日常口语
- 中文：自然口语
- 不使用俚语、流行语

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

// 解析 AI 输出
function parseAIOutput(text) {
  const extractBetweenTags = (tag) => {
    const regex = new RegExp(`<<<${tag}>>>([\\s\\S]*?)(?=<<<|【|$)`, 'g');
    const match = regex.exec(text);
    return match?.[1]?.trim() || '';
  };

  const translationTypes = [
    { id: 'raw-direct', label: '原结构直译', tTag: 'T1', bTag: 'B1' },
    { id: 'natural-direct', label: '自然直译', tTag: 'T2', bTag: 'B2', recommended: true },
    { id: 'smooth-direct', label: '顺语直译', tTag: 'T3', bTag: 'B3' },
    { id: 'colloquial', label: '口语版', tTag: 'T4', bTag: 'B4' },
    { id: 'natural-free', label: '自然意译', tTag: 'T5', bTag: 'B5' },
  ];

  return translationTypes.map(type => ({
    id: type.id,
    label: type.label,
    recommended: type.recommended || false,
    translation: extractBetweenTags(type.tTag),
    backTranslation: extractBetweenTags(type.bTag),
  })).filter(item => item.translation);
}

// 检测语言
function detectLanguage(text) {
  const myanmarRegex = /[\u1000-\u109F]/;
  return myanmarRegex.test(text) ? 'my' : 'zh';
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. 接收前端传来的 customConfig
    const { text, sourceLang, targetLang, stream = false, customConfig } = await req.json();

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: '请输入要翻译的文本' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 确定配置：优先用前端传来的，如果没有则回退到环境变量
    // 注意：去除 baseUrl 末尾可能多余的斜杠
    const apiKey = customConfig?.apiKey || process.env.OPENAI_API_KEY;
    let baseUrl = customConfig?.baseUrl || 'https://api.openai.com/v1';
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const model = customConfig?.model || 'gpt-4o-mini';

    // 3. 检查 API Key 是否存在
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: '未配置 API Key', 
        details: '请在前端设置中填写 API Key，或在服务器环境变量配置 OPENAI_API_KEY' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 自动检测语言
    const detectedSourceLang = sourceLang || detectLanguage(text);
    const detectedTargetLang = targetLang || (detectedSourceLang === 'zh' ? 'my' : 'zh');
    const langNames = { zh: '中文', my: '缅甸语' };
    
    const prompt = TRANSLATION_PROMPT_TEMPLATE
      .replace('{SOURCE_LANG}', langNames[detectedSourceLang])
      .replace('{TARGET_LANG}', langNames[detectedTargetLang])
      .replace('{USER_TEXT}', text.trim());

    // 4. 发起请求 (使用动态 URL 和 Key)
    // 必须加上 /chat/completions 后缀
    const apiUrl = `${baseUrl}/chat/completions`;

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是专业的中缅双语翻译专家。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        stream: stream,
      }),
    });

    // 5. 处理 API 错误
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      let errorMsg = `API 请求失败 (${aiResponse.status})`;
      try {
        // 尝试解析 OpenAI 的 JSON 错误信息
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          errorMsg = `API 错误: ${errorJson.error.message}`;
        }
      } catch (e) {
        // 如果不是 JSON，直接使用文本
        errorMsg += `: ${errorText}`;
      }
      
      throw new Error(errorMsg);
    }

    // 流式响应处理
    if (stream) {
      return new Response(aiResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 非流式响应处理
    const data = await aiResponse.json();
    const aiContent = data.choices?.[0]?.message?.content || '';
    const translations = parseAIOutput(aiContent);

    // 6. 返回最终结果
    return new Response(JSON.stringify({
      success: true,
      sourceText: text,
      sourceLang: detectedSourceLang,
      targetLang: detectedTargetLang,
      translations,
      rawOutput: aiContent,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Translation error:', error);
    // 7. 捕获所有错误并返回 JSON，防止前端报 "Unexpected end of JSON"
    return new Response(JSON.stringify({ 
      error: '翻译服务出错',
      details: error.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
