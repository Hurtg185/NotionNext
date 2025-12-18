export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { email, code } = await request.json();
        const db = env.DB;

        // 1. 查激活码
        const codeRecord = await db.prepare('SELECT * FROM ActivationCodes WHERE code = ?').bind(code).first();
        if (!codeRecord) return new Response(JSON.stringify({ error: '激活码不存在' }), { status: 404 });
        if (codeRecord.is_used === 1) return new Response(JSON.stringify({ error: '已被使用' }), { status: 409 });

        // 2. 查用户
        const user = await db.prepare('SELECT unlocked_levels FROM Users WHERE email = ?').bind(email).first();
        const currentLevels = user.unlocked_levels ? user.unlocked_levels.split(',') : [];
        const newLevel = codeRecord.level;

        if (!currentLevels.includes(newLevel)) {
            currentLevels.push(newLevel);
            const newUnlockedStr = currentLevels.join(',');
            
            // 3. 写入
            await db.batch([
                db.prepare('UPDATE ActivationCodes SET is_used = 1, used_by = ?, used_at = ? WHERE code = ?')
                  .bind(email, Math.floor(Date.now() / 1000), code),
                db.prepare('UPDATE Users SET unlocked_levels = ? WHERE email = ?')
                  .bind(newUnlockedStr, email)
            ]);
            return new Response(JSON.stringify({ success: true, level: newLevel, new_unlocked_levels: newUnlockedStr }));
        }
        
        return new Response(JSON.stringify({ success: true, level: newLevel, new_unlocked_levels: user.unlocked_levels }));
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
