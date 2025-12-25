// functions/api/ai/record-usage.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
    }

    const now = Date.now();

    // 1. 更新数据库：已用次数 +1
    await db.prepare(`
      UPDATE AIUsage 
      SET used_count = used_count + 1, updated_at = ? 
      WHERE email = ?
    `).bind(now, email).run();

    // 2. 查询更新后的最新剩余次数并返回
    const usage = await db.prepare('SELECT used_count, total_free FROM AIUsage WHERE email = ?')
                        .bind(email)
                        .first();

    const remaining = usage.total_free - usage.used_count;

    return new Response(JSON.stringify({
      success: true,
      remaining: Math.max(0, remaining)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
