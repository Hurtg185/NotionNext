// functions/api/verify-google.js

// ====== 全局配置（只改这里） ======
const INITIAL_FREE_AI_COUNT = 3; // 以后改 60、70 只改这一行
// =================================

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { token } = await request.json();

    // 1. 校验 Google Token
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );
    const googleData = await googleRes.json();

    if (googleData.error || !googleData.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const email = googleData.email;
    const now = Date.now();

    // 2. 查询用户
    let user = await db
      .prepare('SELECT * FROM Users WHERE email = ?')
      .bind(email)
      .first();

    if (!user) {
      // ===== 新用户 =====
      await db.batch([
        db.prepare(`
          INSERT INTO Users (email, name, avatar_url, unlocked_levels)
          VALUES (?, ?, ?, ?)
        `).bind(
          email,
          googleData.name || '',
          googleData.picture || '',
          ''
        ),

        db.prepare(`
          INSERT INTO AIUsage (email, used_count, total_free, created_at, updated_at)
          VALUES (?, 0, ?, ?, ?)
        `).bind(email, INITIAL_FREE_AI_COUNT, now, now),
      ]);

      user = {
        email,
        name: googleData.name || '',
        avatar_url: googleData.picture || '',
        unlocked_levels: '',
      };
    } else {
      // ===== 老用户补偿（你加 AIUsage 表之前的）=====
      const usage = await db
        .prepare('SELECT email FROM AIUsage WHERE email = ?')
        .bind(email)
        .first();

      if (!usage) {
        await db.prepare(`
          INSERT INTO AIUsage (email, used_count, total_free, created_at, updated_at)
          VALUES (?, 0, ?, ?, ?)
        `).bind(email, INITIAL_FREE_AI_COUNT, now, now).run();
      }
    }

    return new Response(JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Login failed' }),
      { status: 500 }
    );
  }
}
