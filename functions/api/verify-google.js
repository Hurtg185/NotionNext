export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { token } = await request.json();
        
        // 1. 验证谷歌 Token
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const googleData = await googleRes.json();

        if (googleData.error || !googleData.email) {
            return new Response(JSON.stringify({ error: '无效 Token' }), { status: 401 });
        }

        const { email, name, picture } = googleData;
        const db = env.DB; // 绑定 D1

        // 2. 查库或注册
        let user = await db.prepare('SELECT * FROM Users WHERE email = ?').bind(email).first();

        if (!user) {
            await db.prepare('INSERT INTO Users (email, name, avatar_url, unlocked_levels) VALUES (?, ?, ?, ?)')
                    .bind(email, name, picture, '').run();
            user = { email, name, avatar_url: picture, unlocked_levels: '' };
        }

        return new Response(JSON.stringify(user), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
