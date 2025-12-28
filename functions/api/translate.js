// pages/api/translate.js

export const config = {
  runtime: 'edge', // 使用 Edge Runtime 以支持流式传输 (类似 Cloudflare)
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

function parseAIOutput(text) {
  const extract = (tag) => {
    const regex = new RegExp(`<<<${tag}>>>(.*?)(?:<<<|$)`, 's');
    const match = text.match(regex);
    return match?.[1]?.trim() || '';
  };

  const types = [
    { id: 'raw-direct', label: '原结构直译', tTag: 'T1', bTag: 'B1' },
    { id: 'natural-direct', label: '自然直译', tTag: 'T2', bTag: 'B2', recommended: true },
    { id: 'fluent-direct', label: '顺语直译', tTag: 'T3', bTag: 'B3' },
    { id: 'spoken', label: '口语版', tTag: 'T4', bTag: 'B4' },
    { id: 'free', label: '自然意译', tTag: 'T5', bTag: 'B5' },
  ];

  return types.map(type => ({
    id: type.id,
    label: type.label,
    translation: extract(type.tTag),
    back: extract(type.bTag),
    recommended: type.recommended || false,
  })).filter(item => item.translation);
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { text, sourceLang, targetLang, customConfig } = await req.json();

    const apiKey = customConfig?.apiKey || process.env.OPENAI_API_KEY; 
    const apiUrl = customConfig?.apiUrl || 'https://apis.iflow.cn/v1'; // 注意这里
    // 强制修正模型名称，防止用户配置了旧模型
    let model = customConfig?.model || 'deepseek-chat';
    if (model === 'deepseek-v3.2') model = 'deepseek-chat'; // 自动修正

    const finalPrompt = TRANSLATION_PROMPT_TEMPLATE
      .replace('{SOURCE_LANG}', sourceLang || 'auto')
      .replace('{TARGET_LANG}', targetLang || '中文')
      .replace('{USER_TEXT}', text);

    const apiResponse = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'system', content: finalPrompt }],
        stream: true,
      }),
    });

    if (!apiResponse.ok) {
        return new Response(JSON.stringify({ error: 'Upstream API Error' }), { status: 502 });
    }

    // --- 核心流式处理逻辑 (保留您的算法) ---
    let fullResponseText = "";
    let sentLength = 0;
    const streamDelimiter = "\n|||FINAL_JSON|||\n";

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const chunkText = new TextDecoder().decode(chunk);
        const lines = chunkText.split('\n').filter(line => line.startsWith('data: '));
        
        for (const line of lines) {
          if (line.includes('[DONE]')) continue;
          try {
            const json = JSON.parse(line.substring(6));
            const content = json.choices?.[0]?.delta?.content || "";
            
            if (content) {
              fullResponseText += content;

              const t2StartTag = "<<<T2>>>";
              const t2EndTag = "<<<B2>>>";
              const startIndex = fullResponseText.indexOf(t2StartTag);
              
              if (startIndex !== -1) {
                  const contentStartIndex = startIndex + t2StartTag.length;
                  const endIndex = fullResponseText.indexOf(t2EndTag);
                  let currentValidText = endIndex !== -1 
                    ? fullResponseText.substring(contentStartIndex, endIndex)
                    : fullResponseText.substring(contentStartIndex);

                  if (currentValidText.length > sentLength) {
                      const newPart = currentValidText.substring(sentLength);
                      controller.enqueue(new TextEncoder().encode(newPart));
                      sentLength += newPart.length;
                  }
              }
            }
          } catch (e) { }
        }
      },
      flush(controller) {
        const parsedData = parseAIOutput(fullResponseText);
        const finalPayload = { parsed: parsedData, quick_replies: [] };
        controller.enqueue(new TextEncoder().encode(streamDelimiter));
        controller.enqueue(new TextEncoder().encode(JSON.stringify(finalPayload)));
      }
    });

    return new Response(apiResponse.body.pipeThrough(transformStream), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Internal Error' }), { status: 500 });
  }
}
