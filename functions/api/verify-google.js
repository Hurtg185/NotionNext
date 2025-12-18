// functions/api/verify-google.js
export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { token } = await request.json();
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const googleData = await googleRes.json();
        if (googleData.error || !googleData.email) return new Response('Unauthorized', { status: 401 });

        const db = env.DB;
        // 关键点：查询该用户的所有字段（包含 unlocked_levels）
        let user = await db.prepare('SELECT * FROM Users WHERE email = ?').bind(googleData.email).first();

        if (!user) {
            await db.prepare('INSERT INTO Users (email, name, avatar_url, unlocked_levels) VALUES (?, ?, ?, ?)')
                    .bind(googleData.email, googleData.name, googleData.picture, '').run();
            user = { email: googleData.email, name: googleData.name, avatar_url: googleData.picture, unlocked_levels: '' };
        }

        return new Response(JSON.stringify(user), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
