// functions/api/chat.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  // 打印初始请求日志
  console.log("--- New Request Started ---");

  try {
    const body = await request.json();
    const { messages, config, email } = body;
    const API_KEY = config?.apiKey;

    console.log(`[Step 1] Request Body: Email=${email}, Model=${config?.modelId}`);

    if (!API_KEY) {
      console.error("[Error] Missing API Key");
      return new Response(JSON.stringify({ error: '请在设置中填写 API Key' }), { status: 400 });
    }

    if (!email) {
      console.error("[Error] Missing Email");
      return new Response(JSON.stringify({ error: '用户未登录' }), { status: 401 });
    }

    if (!db) {
      console.error("[Error] D1 Database (env.DB) is not bound!");
      return new Response(JSON.stringify({ error: '数据库未绑定' }), { status: 500 });
    }

    // 1. 查询用户是否激活课程
    console.log("[Step 2] Querying Users table...");
    const user = await db
      .prepare('SELECT unlocked_levels FROM Users WHERE email = ?')
      .bind(email)
      .first();

    const isActivated = user?.unlocked_levels && user.unlocked_levels.trim().length > 0;
    console.log(`[Step 2 Result] isActivated: ${isActivated}`);

    // 2. 未激活用户 → 扣次数
    if (!isActivated) {
      console.log("[Step 3] Checking AIUsage...");
      const usage = await db
        .prepare('SELECT used_count, total_free FROM AIUsage WHERE email = ?')
        .bind(email)
        .first();

      if (!usage) {
        console.error("[Error] AIUsage record not found for email");
        return new Response(JSON.stringify({ error: 'AIUsage 未初始化' }), { status: 500 });
      }

      console.log(`[Step 3 Info] Usage: ${usage.used_count}/${usage.total_free}`);

      if (usage.used_count >= usage.total_free) {
        console.warn("[Quota Exceeded] User has no free trials left");
        return new Response(JSON.stringify({ error: '免费次数已用完', code: 'QUOTA_EXCEEDED' }), { status: 403 });
      }

      // ===== 扣费 =====
      console.log("[Step 3 Action] Deducting 1 credit...");
      await db.prepare(`
        UPDATE AIUsage
        SET used_count = used_count + 1,
            updated_at = ?
        WHERE email = ?
      `).bind(Date.now(), email).run();
      console.log("[Step 3 Action] Deduction successful");
    }

    // 3. 请求第三方 AI 接口
    const API_URL = config?.endpoint || 'https://x666.me/v1/chat/completions';
    console.log(`[Step 4] Fetching AI API: ${API_URL}`);

    const payload = {
      model: config?.modelId || 'gemini-1.5-flash', // 纠正了 gemini-2.5-flash 的拼写错误
      messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true,
    };

    // 使用 AbortController 增加超时控制（防止 CF Worker 卡死报 503）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      const aiRes = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'User-Agent': 'Cloudflare-Worker'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);
      console.log(`[Step 4 Response] Status: ${aiRes.status}`);

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error(`[AI Error Detail] ${errText}`);
        return new Response(
          JSON.stringify({ error: 'AI 接口返回错误', detail: errText, status: aiRes.status }),
          { status: aiRes.status }
        );
      }

      console.log("[Step 5] Streaming response back to client...");
      return new Response(aiRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error(`[Fetch Fatal] ${fetchErr.name === 'AbortError' ? 'Timeout' : fetchErr.message}`);
      return new Response(JSON.stringify({ error: '请求 AI 接口超时或网络故障' }), { status: 504 });
    }

  } catch (err) {
    console.error(`[Global Error] ${err.stack}`);
    return new Response(
      JSON.stringify({ error: 'Server Error', message: err.message }),
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
