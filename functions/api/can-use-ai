// functions/api/ai/check-limit.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
    }

    // 从数据库查询该用户的已用次数和总次数
    const usage = await db.prepare('SELECT used_count, total_free FROM AIUsage WHERE email = ?')
                        .bind(email)
                        .first();

    // 如果用户还没登录过或者没记录，默认给 0 次（或者根据你的逻辑给初始值）
    if (!usage) {
      return new Response(JSON.stringify({ canUse: false, remaining: 0 }));
    }

    const remaining = usage.total_free - usage.used_count;
    
    return new Response(JSON.stringify({
      canUse: remaining > 0,
      remaining: Math.max(0, remaining) // 确保不会出现负数
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
