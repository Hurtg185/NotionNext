// /pages/api/admin/generate-keys.js
// 这个API只供您自己使用，用于批量生成激活码。
// /pages/api/admin/generate-keys.js
import { kv } from '@vercel/kv';
const { v4: uuidv4 } = require('uuid'); // 使用更兼容的导入方式

export default async function handler(req, res) {
    // ！！极其重要！！
    // 请务必将下面的密码 'YourSuperStrongPassword_ChangeMe_2025' 更换为您自己的复杂密码！
    if (req.query.secret !== 'mei2818597') {
        return res.status(401).send('Unauthorized');
    }

    const count = parseInt(req.query.count, 10) || 10;
    const type = req.query.type || 'permanent';

    try {
        const pipeline = kv.pipeline();
        const generatedKeys = [];

        for (let i = 0; i < count; i++) {
            const key = uuidv4().toUpperCase();
            const keyData = {
                type,
                deviceId: null,
                activatedAt: null,
            };
            if (type === 'trial') {
                keyData.durationDays = parseInt(req.query.durationDays, 10) || 7;
            }
            pipeline.set(`key:${key}`, keyData);
            generatedKeys.push(key);
        }
        await pipeline.exec();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(`成功生成 ${count} 个类型为 "${type}" 的激活码:\n\n${generatedKeys.join('\n')}`);
    } catch (error) {
        console.error("Key generation error:", error);
        res.status(500).send("生成激活码时发生服务器错误。");
    }
}
