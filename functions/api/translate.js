/**
 * Cloudflare Pages Function
 * Path: /api/translate
 * Version: FINAL / FAST / STABLE
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
    // 3. SYSTEM PROMPT（极简 · 高保真）
    // =========================
    const SYSTEM_PROMPT = `
You are a multilingual CHAT TRANSLATION ENGINE.

Task:
Translate the user's message from ${sName} to ${tName}.

ABSOLUTE RULES:
- Do NOT add, remove, merge, or weaken any meaning.
- Preserve original structure and sentence mapping.
- Accuracy has priority over fluency.
- Do NOT use English as an intermediate language.
- Output JSON ONLY. No explanations.

Output EXACTLY the following structure:

{
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

Back-translation rules:
- back_translation MUST be in ${sName}.
- back_translation must reflect actual meaning, not explanation.
`;

    // =========================
    // 4. 组装消息
    // =========================
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(Array.isArray(context) ? context.slice(-10) : []),
      { role: "user", content: text }
    ];

    // =========================
    // 5. 调用 AI（提速关键）
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
        temperature: 0.15,   // 更低 = 更快更稳
        top_p: 0.85,
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
