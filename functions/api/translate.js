// pages/api/translate.js

export const config = {
  runtime: 'edge',
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
  })).filter(item => item.translation); // 过滤空结果
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
    const { text, sourceLang, targetLang, stream = false } = await req.json();

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: '请输入要翻译的文本' }), {
        status: 400,
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

    // 调用 AI API (这里以 OpenAI 为例，可替换为其他服务)
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 或 gpt-4
        messages: [
          { role: 'system', content: '你是专业的中缅双语翻译专家。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        stream: stream,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      throw new Error(`AI API Error: ${error}`);
    }

    // 流式响应
    if (stream) {
      return new Response(aiResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 非流式响应
    const data = await aiResponse.json();
    const aiContent = data.choices?.[0]?.message?.content || '';
    const translations = parseAIOutput(aiContent);

    return new Response(JSON.stringify({
      success: true,
      sourceText: text,
      sourceLang: detectedSourceLang,
      targetLang: detectedTargetLang,
      translations,
      rawOutput: aiContent, // 调试用，生产环境可移除
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ 
      error: '翻译失败，请稍后重试',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
