// /pages/api/admin/generate-keys.js - v56 (最终稳定版 - 默认生成永久码，支持生成粉丝试用码)
import { kv } from '@vercel/kv';
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
    // ！！极其重要！！
    // 请务必将下面的密码 'YourSuperStrongPassword_ChangeMe_2025' 更换为您自己的复杂密码！
    if (req.query.secret !== 'mei2818597') {
        return res.status(401).send('Unauthorized');
    }

    const count = parseInt(req.query.count, 10) || 1; // 默认生成1个
    const type = req.query.type || 'permanent'; // 'permanent' 或 'trial'
    const durationDays = parseInt(req.query.durationDays, 10) || 0; // 默认0天，只对试用码有效

    if (type === 'trial' && durationDays <= 0) {
        return res.status(400).send('试用码 (type=trial) 必须指定一个正整数的 durationDays (例如 &durationDays=7)。');
    }

    try {
        const pipeline = kv.pipeline();
        const generatedKeys = [];
        let trialTypeInfo = ''; // 用于显示在结果中的信息

        for (let i = 0; i < count; i++) {
            const key = uuidv4().toUpperCase();
            const keyData = {
                type,
                deviceId: null,
                ip: null,
                activatedAt: null,
            };
            if (type === 'trial') {
                keyData.durationSeconds = durationDays * 24 * 60 * 60; // 转换为秒
                keyData.trialType = 'manual'; // 所有手动生成的试用码都标记为 manual
                trialTypeInfo = ` (手动试用, 时长: ${durationDays}天)`;
            }

            pipeline.set(`key:${key}`, keyData);
            generatedKeys.push(key);
        }

        await pipeline.exec();

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(`成功生成 ${count} 个类型为 "${type}"${trialTypeInfo} 的激活码:\n\n${generatedKeys.join('\n')}`);

    } catch (error) {
        console.error("Key generation error:", error);
        res.status(500).send("生成激活码时发生服务器错误。");
    }
}
