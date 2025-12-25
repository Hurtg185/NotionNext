// functions/api/verify-google.js

// --- 配置区：修改这里即可全局调整测试/正式次数 ---
const INITIAL_FREE_AI_COUNT = 3; 

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { token } = await request.json();
        
        // 1. 验证 Google Token 有效性
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const googleData = await googleRes.json();
        
        if (googleData.error || !googleData.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const db = env.DB;
        const now = Date.now();
        const email = googleData.email;

        // 2. 查询用户主表
        let user = await db.prepare('SELECT * FROM Users WHERE email = ?')
                         .bind(email)
                         .first();

        if (!user) {
            // --- 【场景 A：全新用户注册】 ---
            // 使用 batch 确保 Users 表和 AIUsage 表同时创建成功
            await db.batch([
                // 创建用户信息
                db.prepare(`
                    INSERT INTO Users (email, name, avatar_url, unlocked_levels) 
                    VALUES (?, ?, ?, ?)
                `).bind(email, googleData.name, googleData.picture, ''),

                // 初始化 AI 赠送次数
                db.prepare(`
                    INSERT INTO AIUsage (email, used_count, total_free, created_at, updated_at)
                    VALUES (?, 0, ?, ?, ?)
                `).bind(email, INITIAL_FREE_AI_COUNT, now, now)
            ]);

            // 构造返回给前端的初始对象
            user = { 
                email: email, 
                name: googleData.name, 
                avatar_url: googleData.picture, 
                unlocked_levels: '' 
            };
        } else {
            // --- 【场景 B：老用户登录】 ---
            // 补偿逻辑：如果 AIUsage 表里还没这个老用户（针对你加表之前的旧用户），自动补全记录
            const aiRecord = await db.prepare('SELECT email FROM AIUsage WHERE email = ?')
                                   .bind(email)
                                   .first();
            
            if (!aiRecord) {
                await db.prepare(`
                    INSERT INTO AIUsage (email, used_count, total_free, created_at, updated_at)
                    VALUES (?, 0, ?, ?, ?)
                `).bind(email, INITIAL_FREE_AI_COUNT, now, now).run();
            }
        }

        // 3. 成功返回用户信息
        return new Response(JSON.stringify(user), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (e) {
        // 生产环境建议将 e.message 换成通用错误提示
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
