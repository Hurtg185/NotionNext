// /pages/api/admin/generate-keys.js
// 这个API只供您自己使用，用于批量生成激活码。
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid'; // 用于生成全局唯一的激活码

export default async function handler(req, res) {
    // ！！极其重要！！
    // 请务必将下面的密码 'YourSuperStrongPassword_ChangeMe_2025' 更换为您自己的复杂密码！
    // 这个密码将用于访问此API，确保只有您才能生成激活码。
    if (req.query.secret !== 'mei2818597') {
        return res.status(401).send('Unauthorized'); // 未授权访问
    }

    // 从请求参数中获取要生成的数量，默认为10个
    const count = parseInt(req.query.count, 10) || 10;
    // 获取激活码类型，默认为永久码 ('permanent')
    const type = req.query.type || 'permanent';

    try {
        const pipeline = kv.pipeline(); // 使用Redis Pipeline提高批量操作效率
        const generatedKeys = [];

        for (let i = 0; i < count; i++) {
            const key = uuidv4().toUpperCase(); // 生成大写 UUID 作为激活码，更易读
            const keyData = {
                type, // 'permanent' (永久) 或 'trial' (试用)
                deviceId: null, // 默认未绑定任何设备
                activatedAt: null, // 默认未激活
            };
            // 如果是试用码，则需要记录试用天数
            if (type === 'trial') {
                keyData.durationDays = parseInt(req.query.durationDays, 10) || 7; // 默认试用7天
            }

            // 将设置 key 的命令添加到管道中
            pipeline.set(`key:${key}`, keyData);
            generatedKeys.push(key);
        }

        // 一次性执行管道中的所有命令，极大提升性能
        await pipeline.exec();

        // 以纯文本形式返回所有生成的密钥，方便您直接复制
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(`成功生成 ${count} 个类型为 "${type}" 的激活码:\n\n${generatedKeys.join('\n')}`);

    } catch (error) {
        console.error("Key generation error:", error);
        res.status(500).send("生成激活码时发生服务器错误。");
    }
}
