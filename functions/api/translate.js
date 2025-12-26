/**
 * Cloudflare Pages Function - 终极稳定版
 * 处理路径: /api/translate
 */

export async function onRequestPost({ request, env }) {
  try {
    const { 
      text, 
      sourceLang = 'auto', 
      targetLang = 'my', 
      context = [], 
      speedMode = false,
      customConfig = {} 
    } = await request.json();

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "EMPTY_TEXT" }), { status: 400 });
    }

    // 1. 配置 Key (优先使用前端传入的)
    const API_KEY = customConfig.apiKey || env.IFLOW_API_KEY || "sk-d2881db63d572542cd7127ec08ffde9a";
    const API_URL = customConfig.apiUrl || "https://apis.iflow.cn/v1/chat/completions";

    // 2. 语言字典映射
    const langMap = {
      auto: "Auto Detect (Do not guess if ambiguous)", 
      zh: "Chinese", my: "Burmese", en: "English", 
      th: "Thai", vi: "Vietnamese", jp: "Japanese", ko: "Korean"
    };

    // 3. 构建 Prompt (严格控制逻辑)
    const SYSTEM_PROMPT = speedMode
      ? `You are a FAST chat translator. Translate from ${langMap[sourceLang]||sourceLang} to ${langMap[targetLang]||targetLang}. 
         Rules: 
         - Output JSON ONLY. 
         - Back-translation is REQUIRED. 
         - Exactly 3 variants. 
         - Exactly ONE "recommended": true.
         - Quick replies: 3 short responses in ${langMap[sourceLang]||'source language'}.
         JSON Template: { 
           "results": [
             {"label": "直译", "translation": "", "back_translation": "", "recommended": false},
             {"label": "口语", "translation": "", "back_translation": "", "recommended": true},
             {"label": "得体", "translation": "", "back_translation": "", "recommended": false}
           ], 
           "quick_replies": ["", "", ""] 
         }`
      : `You are an EXPERT translator. Translate from ${langMap[sourceLang]||sourceLang} to ${langMap[targetLang]||targetLang}.
         STRICT RULES:
         - Output JSON ONLY.
         - Accomplish Functional, Emotional, and Cultural equivalence.
         - Generate exactly 8 variants.
         - Exactly ONE "recommended": true (based on highest fidelity).
         - For each: { "label": "", "translation": "", "back_translation": "", "similarity_score": 0.95, "risk_level": "low" }.
         - quick_replies: 5 conversational responses in ${langMap[sourceLang]||'source language'}.`;

    // 4. 调用 AI (DeepSeek v3.2)
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-v3.2",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...context.slice(-20),
          { role: "user", content: text }
        ],
        temperature: speedMode ? 0.18 : 0.25, // 压低温度确保稳定性
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "API_ERROR", status: response.status }), { status: 500 });
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content || "{}";

    // 5. 强力清洗 Markdown
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(content, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
