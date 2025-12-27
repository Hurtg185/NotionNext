// functions/api/chat.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { messages, config, email } = await request.json();
    const API_KEY = config?.apiKey;

    if (!API_KEY) {
      return new Response(
        JSON.stringify({ error: '请在设置中填写 API Key' }),
        { status: 400 }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: '用户未登录' }),
        { status: 401 }
      );
    }

    // 1. 查询用户是否激活课程
    const user = await db
      .prepare('SELECT unlocked_levels FROM Users WHERE email = ?')
      .bind(email)
      .first();

    const isActivated =
      user?.unlocked_levels && user.unlocked_levels.trim().length > 0;

    // 2. 未激活用户 → 扣次数（唯一扣费点）
    if (!isActivated) {
      const usage = await db
        .prepare('SELECT used_count, total_free FROM AIUsage WHERE email = ?')
        .bind(email)
        .first();

      // 理论上不会发生（verify-google 已保证）
      if (!usage) {
        return new Response(
          JSON.stringify({ error: 'AIUsage 未初始化' }),
          { status: 500 }
        );
      }

      if (usage.used_count >= usage.total_free) {
        return new Response(
          JSON.stringify({
            error: '免费次数已用完',
            code: 'QUOTA_EXCEEDED',
          }),
          { status: 403 }
        );
      }

      // ===== 撕票：立刻扣 1 次 =====
      await db.prepare(`
        UPDATE AIUsage
        SET used_count = used_count + 1,
            updated_at = ?
        WHERE email = ?
      `).bind(Date.now(), email).run();
    }

    // 3. 请求 NVIDIA AI
    const payload = {
      model: config?.modelId || 'gemini-2.5-flash',
      messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true,
    };

    const aiRes = await fetch(
      'https://x666.me/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(
        JSON.stringify({ error: 'AI 接口错误', detail: errText }),
        { status: aiRes.status }
      );
    }

    return new Response(aiRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Server Error' }),
      { status: 500 }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
