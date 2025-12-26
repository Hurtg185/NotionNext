/**
 * Cloudflare Pages Function
 * Path: /api/translate
 * Version: FINAL / STABLE
 */

export async function onRequestPost({ request, env }) {
  try {
    // =========================
    // 0. 解析请求体
    // =========================
    const {
      text,
      sourceLang = "auto",
      targetLang = "my",
      context = [],
      speedMode = false,
      customConfig = {}
    } = await request.json();

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "EMPTY_TEXT" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // =========================
    // 1. API 配置
    // =========================
    const API_KEY =
      customConfig.apiKey ||
      env.IFLOW_API_KEY ||
      "sk-d2881db63d572542cd7127ec08ffde9a";

    const API_URL =
      customConfig.apiUrl ||
      "https://apis.iflow.cn/v1/chat/completions";

    const MODEL = "deepseek-v3.2";

    // =========================
    // 2. 语言映射
    // =========================
    const langMap = {
      auto: "Auto Detect (Do not guess if ambiguous)",
      zh: "Chinese (Simplified)",
      my: "Burmese (Myanmar)",
      en: "English",
      th: "Thai",
      vi: "Vietnamese",
      jp: "Japanese",
      ko: "Korean"
    };

    const sName = langMap[sourceLang] || sourceLang;
    const tName = langMap[targetLang] || targetLang;

    // =========================
    // 3. SYSTEM PROMPT（关键）
    // =========================
    const SYSTEM_PROMPT = speedMode
      ? `
You are a FAST and ACCURATE chat translator.

Translate from ${sName} to ${tName}.

STRICT RULES:
- Output JSON ONLY.
- EXACTLY 3 translation variants.
- EXACTLY ONE item must have "recommended": true.
- Back-translation is REQUIRED.
- No explanations. No markdown.

JSON TEMPLATE (must follow exactly):
{
  "results": [
    {
      "label": "Literal | 直译",
      "translation": "",
      "back_translation": "",
      "recommended": false
    },
    {
      "label": "Spoken | 口语",
      "translation": "",
      "back_translation": "",
      "recommended": true
    },
    {
      "label": "Polite | 得体",
      "translation": "",
      "back_translation": "",
      "recommended": false
    }
  ],
  "quick_replies": ["", "", ""]
}

IMPORTANT:
- quick_replies must be in ${sName}.
`
      : `
You are a PROFESSIONAL multilingual chat translation engine.

Translate from ${sName} to ${tName} for REAL chat usage.

GLOBAL RULES:
- Output JSON ONLY.
- No hallucination.
- No added or omitted meaning.
- Preserve intent, emotion, and politeness.
- If source language is Auto Detect, do NOT guess when ambiguous.

JSON TEMPLATE (must follow exactly):
{
  "results": [
    {
      "label": "Variant",
      "translation": "",
      "back_translation": "",
      "similarity_score": 0.95,
      "risk_level": "low",
      "recommended": false
    }
  ],
  "quick_replies": ["", "", "", "", ""]
}

MANDATORY REQUIREMENTS:
- results MUST contain EXACTLY 8 items.
- EXACTLY ONE item must have "recommended": true.
- similarity_score range: 0.00 – 1.00.
- risk_level: "low" | "medium" | "high".
- quick_replies must be natural, conversational, and in ${sName}.
- Do NOT add extra fields.
`;

    // =========================
    // 4. 组装消息
    // =========================
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...Array.isArray(context) ? context.slice(-20) : [],
      { role: "user", content: text }
    ];

    // =========================
    // 5. 调用 AI
    // =========================
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: speedMode ? 0.18 : 0.25,
        top_p: 0.9,
        stream: false,
        response_format: { type: "json_object" }
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({
          error: "UPSTREAM_API_ERROR",
          status: upstream.status,
          detail: errText
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // =========================
    // 6. 解析并清洗
    // =========================
    const data = await upstream.json();
    let content = data?.choices?.[0]?.message?.content || "{}";

    // DeepSeek 偶发 ```json
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();

    // =========================
    // 7. 返回
    // =========================
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "FUNCTION_ERROR",
        message: err.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
