// functions/api/translate.js

// ============================================================
// 核心翻译提示词模板
// ============================================================
const TRANSLATION_PROMPT_TEMPLATE = `你是【中缅双语高保真翻译引擎】。

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
<<<B5>>>`;

// ============================================================
// 常量定义
// ============================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const LANGUAGE_MAP = {
  'zh': '中文',
  'my': '缅甸语',
  'chinese': '中文',
  'burmese': '缅甸语',
};

// ============================================================
// 解析翻译结果
// ============================================================
function parseTranslationResponse(text) {
  const results = [];
  const labels = [
    { key: 'T1', name: '原结构直译' },
    { key: 'T2', name: '自然直译（推荐）', recommended: true },
    { key: 'T3', name: '顺语直译' },
    { key: 'T4', name: '口语版' },
    { key: 'T5', name: '自然意译' },
  ];

  for (const label of labels) {
    const tRegex = new RegExp(`<<<${label.key}>>>([\\s\\S]*?)(?=<<<|回译：|$)`);
    const bKey = label.key.replace('T', 'B');
    const bRegex = new RegExp(`<<<${bKey}>>>([\\s\\S]*?)(?=<<<|【|$)`);

    const tMatch = text.match(tRegex);
    const bMatch = text.match(bRegex);

    if (tMatch) {
      results.push({
        id: label.key,
        name: label.name,
        translation: tMatch[1].trim(),
        backTranslation: bMatch ? bMatch[1].trim() : '',
        recommended: label.recommended || false,
      });
    }
  }

  return results;
}

// ============================================================
// 主处理函数
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;

  // 处理 CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { text, sourceLang = 'zh', targetLang = 'my', stream = false } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const sourceLanguage = LANGUAGE_MAP[sourceLang] || sourceLang;
    const targetLanguage = LANGUAGE_MAP[targetLang] || targetLang;

    const prompt = TRANSLATION_PROMPT_TEMPLATE
      .replace('{SOURCE_LANG}', sourceLanguage)
      .replace('{TARGET_LANG}', targetLanguage)
      .replace('{USER_TEXT}', text.trim());

    // 调用 AI API (这里以 OpenAI 为例，可替换为其他)
    const apiKey = env.OPENAI_API_KEY || env.API_KEY;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是专业的中缅双语翻译专家。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        stream: stream,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI API Error:', error);
      return new Response(
        JSON.stringify({ error: 'Translation service error' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 流式响应
    if (stream) {
      return new Response(aiResponse.body, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 非流式响应
    const result = await aiResponse.json();
    const content = result.choices?.[0]?.message?.content || '';
    const translations = parseTranslationResponse(content);

    return new Response(
      JSON.stringify({
        success: true,
        originalText: text,
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        translations,
        raw: content,
      }),
      { 
        headers: { 
          ...CORS_HEADERS, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
