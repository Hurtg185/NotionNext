/**
 * Cloudflare Pages Function
 * 处理路径: /api/translate
 */

export async function onRequestPost(context) {
  try {
    // 1. 解析请求体
    const { request, env } = context;
    const { 
      text, 
      targetLang = 'my', 
      context: chatContext = [],
      customConfig = {} 
    } = await request.json();

    // 2. 配置参数 (Key 优先级：前端自定义 > 环境变量 > 硬编码)
    // 建议在 Cloudflare 后台设置 IFLOW_API_KEY 环境变量
    const API_KEY = customConfig.apiKey || env.IFLOW_API_KEY || "sk-d2881db63d572542cd7127ec08ffde9a"; 
    const API_URL = customConfig.apiUrl || "https://apis.iflow.cn/v1/chat/completions";
    const MODEL = "deepseek-v3.2";

    // 3. 定义目标语言
    const langMap = {
      'my': 'Burmese (Myanmar)',
      'zh': 'Chinese (Simplified)',
      'en': 'English'
    };
    const tName = langMap[targetLang] || targetLang;

    // 4. 生产级 System Prompt (完全整合你的要求)
    const SYSTEM_PROMPT = `
You are a professional multilingual chat-translation engine.

TASK:
Translate user input into the ${tName} for real-time chat usage.

GLOBAL RULES (strict):
- No hallucination
- No added or omitted information
- Preserve intent, tone, politeness, and emotional strength
- This is CHAT translation, not writing or explanation
- Prefer accuracy and stability over elegance

OUTPUT REQUIREMENTS:
Generate AT LEAST 8 translation variants.

For EACH variant you MUST provide:
- translation (target language)
- back_translation (Chinese)
- similarity_score (0.00–1.00)
  → similarity is measured by semantic alignment between original and back_translation
- tone_match (true/false)
- risk_level ("low" | "medium" | "high")
- type (e.g., "literal", "natural", "social", "formal", "casual")

VARIANT TYPES (cover as many as possible):
1. Literal structural
2. Natural spoken chat
3. Smooth paraphrase
4. Emotion-preserving equivalent
5. Politeness-adjusted (neutral-safe)
6. Casual short chat
7. Slightly formal (but still spoken)
8. Culturally safest version

RECOMMENDATION LOGIC:
Select EXACTLY ONE recommended version based on:
- Highest similarity_score
- tone_match = true
- risk_level = low
If multiple qualify, choose the most commonly used spoken form.

CONTEXT HANDLING:
- Use previous messages ONLY to resolve ambiguity
- Do NOT rewrite history
- Max context length: last 30 messages

QUICK REPLIES (IMPORTANT):
If the input appears to be a RECEIVED message:
- Generate 5 quick replies
- Language = USER ORIGINAL LANGUAGE (NOT target language)
- Replies must be: very short, conversational, suitable for fast tap selection
- Do NOT translate quick replies unless user clicks them

OUTPUT FORMAT (JSON ONLY):
{
  "results": [
    {
      "id": 1,
      "type": "Label describing style",
      "translation": "Target language text",
      "back_translation": "Back translation to Chinese",
      "similarity_score": 0.95,
      "tone_match": true,
      "risk_level": "low",
      "recommended": true
    }
  ],
  "quick_replies": ["Reply1", "Reply2", "Reply3", "Reply4", "Reply5"]
}
`;

    // 5. 组装消息链
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chatContext.slice(-30), // 限制上下文长度
      { role: "user", content: text }
    ];

    // 6. 请求接口
    const upstreamResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.25, // 锁定最佳参数
        top_p: 0.9,
        stream: false,
        response_format: { type: "json_object" }
      })
    });

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      return new Response(JSON.stringify({ error: `API Error: ${upstreamResponse.status}`, details: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await upstreamResponse.json();
    let content = data.choices[0]?.message?.content || "{}";

    // 7. 清洗可能存在的 Markdown
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // 8. 返回结果
    return new Response(content, {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Function Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
