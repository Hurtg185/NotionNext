/**
 * Cloudflare Pages Function
 * Path: /api/translate
 * FAST MODE – LITERAL + BACK
 */

export async function onRequestPost({ request, env }) {
  try {
    const {
      text,
      sourceLang = "auto",
      targetLang = "my"
    } = await request.json();

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "EMPTY_TEXT" }),
        { status: 400 }
      );
    }

    const API_KEY = env.IFLOW_API_KEY;
    const API_URL = "https://apis.iflow.cn/v1/chat/completions";

    const langMap = {
      auto: "source language",
      zh: "Chinese",
      my: "Burmese",
      en: "English"
    };

    const sName = langMap[sourceLang] || sourceLang;
    const tName = langMap[targetLang] || targetLang;

    const SYSTEM_PROMPT = `
You are a chat translator.

Translate from ${sName} to ${tName}.

Rules:
- Do not add or remove meaning.
- Keep sentence structure.
- No English as intermediate language.

Output JSON ONLY:

{
  "translation": "",
  "back_translation": ""
}
`;

    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-v3.2",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        temperature: 0.1,
        top_p: 0.9,
        stream: false
      })
    });

    const data = await upstream.json();
    let content = data.choices?.[0]?.message?.content || "{}";

    content = content.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({
        results: [
          {
            label: "Literal | 直译",
            translation: parsed.translation,
            back_translation: parsed.back_translation,
            recommended: true
          }
        ]
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500 }
    );
  }
}
