/**
 * Cloudflare Pages Function
 * Path: /api/translate
 * Version: FINAL / PRODUCTION
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
      env.IFLOW_API_KEY;

    const API_URL =
      customConfig.apiUrl ||
      "https://apis.iflow.cn/v1/chat/completions";

    const MODEL = "deepseek-v3.2";

    // =========================
    // 2. 语言映射
    // =========================
    const langMap = {
      auto: "Auto Detect (do not guess if ambiguous)",
      zh: "Chinese",
      my: "Burmese",
      en: "English",
      th: "Thai",
      vi: "Vietnamese",
      jp: "Japanese",
      ko: "Korean"
    };

    const sName = langMap[sourceLang] || sourceLang;
    const tName = langMap[targetLang] || targetLang;

    // =========================
    // 3. SYSTEM PROMPT（核心）
    // =========================
    const SYSTEM_PROMPT = speedMode
      ? `
You are a HIGH-FIDELITY literal chat translator.

Translate from ${sName} to ${tName}.

GOAL:
Produce the closest possible translation to the original meaning.
Accuracy has absolute priority over fluency.

STRICT RULES:
- Output JSON ONLY.
- EXACTLY ONE translation result.
- Translation MUST be a natural literal translation.
- NO paraphrasing.
- NO interpretation.
- NO emotional rewriting.
- NO English as intermediate language.

BACK-TRANSLATION (MANDATORY):
- Back-translate the translation into ${sName}.
- Back-translation MUST preserve original structure and meaning.
- This is a semantic equivalence check, NOT intent explanation.

JSON FORMAT (must follow exactly):
{
  "mode": "speed",
  "result": {
    "label": "Literal | 直译",
    "translation": "",
    "back_translation": "",
    "recommended": true
  }
}
`
      : `
You are a PROFESSIONAL chat translation engine (Chinese ↔ Burmese).

Translate from ${sName} to ${tName} for real chat usage.

GLOBAL RULES:
- Output JSON ONLY.
- No added or omitted meaning.
- No emotional amplification.
- No English as intermediate language.

TRANSLATION LAYERS:
1. Literal (semantic ground truth)
2. Free (natural but same meaning)
3. Spoken (native chat style)

BACK-TRANSLATION RULE:
- ALL layers MUST include back_translation in ${sName}.
- Back-translation MUST be literal and semantic.
- NO intent explanation.

JSON FORMAT (must follow exactly):
{
  "mode": "normal",
  "results": [
    {
      "label": "Literal | 直译",
      "translation": "",
      "back_translation": "",
      "recommended": true
    },
    {
      "label": "Free | 意译",
      "translation": "",
      "back_translation": "",
      "recommended": false
    },
    {
      "label": "Spoken | 口语",
      "translation": "",
      "back_translation": "",
      "recommended": false
    }
  ]
}
`;

    // =========================
    // 4. 组装消息
    // =========================
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(Array.isArray(context) ? context.slice(-20) : []),
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
        temperature: speedMode ? 0.1 : 0.22,
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
    // 6. 解析 & 清洗
    // =========================
    const data = await upstream.json();
    let content = data?.choices?.[0]?.message?.content || "{}";

    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

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
