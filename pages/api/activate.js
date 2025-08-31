// /pages/api/activate.js - v50 (最终修复版 - 彻底修复重复试用漏洞 & 永久码换绑逻辑)
import { kv } from '@vercel/kv';
const { v4: uuidv4 } = require('uuid');
export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).json({ message: 'Method Not Allowed' });
}
const { key, deviceId, action } = req.body;
if (!deviceId) {
return res.status(400).json({ success: false, message: '设备ID是必需的。' });
}
try {
const TRIAL_DURATION_SECONDS = 5 * 60; // 5分钟试用期，方便测试
// --- 自动试用逻辑 ---
if (action === 'start_trial') {
const existingKeyForDevice = await kv.get(device:${deviceId});

// 核心修复点：只要此设备已绑定过任何激活码，就不能再自动试用
if (existingKeyForDevice) {
// 检查这个已绑定的激活码的详细信息
const boundKeyData = await kv.get(key:${existingKeyForDevice});
if (boundKeyData) {
if (boundKeyData.type === 'permanent') {
// 如果已绑定永久码，直接返回成功，不需试用
return res.status(200).json({ success: true, message: '已永久激活。', key: existingKeyForDevice, keyType: 'permanent' });
} else if (boundKeyData.type === 'trial') {
// 如果已绑定试用码，检查是否过期
const trialExpiryTime = boundKeyData.activatedAt + (boundKeyData.durationSeconds || 0) * 1000;
if (Date.now() < trialExpiryTime) {
// 试用期仍在有效期内，返回成功
return res.status(200).json({ success: true, message: '试用期仍在有效期内。', key: existingKeyForDevice, keyType: 'trial', activatedAt: boundKeyData.activatedAt, durationSeconds: boundKeyData.durationSeconds });
} else {
// 试用期已过期，明确告知不能再次试用
return res.status(403).json({ success: false, message: '您的试用期已结束，每个设备只能试用一次。请手动输入激活码。' });
}
}
}
// 默认情况下，如果设备已有记录，就拒绝新的试用
return res.status(403).json({ success: false, message: '每个设备只能试用一次。' });
}
// 如果设备从未绑定过激活码，则生成新的试用码
const trialKey = TRIAL-${uuidv4()};
const now = Date.now();
const trialData = { type: 'trial', durationSeconds: TRIAL_DURATION_SECONDS, deviceId: deviceId, activatedAt: now };
await kv.pipeline().set(key:${trialKey}, trialData).set(device:${deviceId}, trialKey).exec();
return res.status(200).json({
success: true, message: '试用激活成功！',
key: trialKey, keyType: 'trial',
activatedAt: now, durationSeconds: TRIAL_DURATION_SECONDS
});
}
// --- 自动试用逻辑结束 ---
// --- 手动激活逻辑（主要用于永久码） ---
if (!key) { return res.status(400).json({ success: false, message: '激活码是必需的。' }); }
const keyData = await kv.get(key:${key});
if (!keyData) { return res.status(404).json({ success: false, message: '激活码无效或不存在。' }); }
// 核心修复点：处理设备指纹变化
if (keyData.deviceId && keyData.deviceId !== deviceId) {
// 如果激活码已被绑定，且是【永久码】，则允许“换绑”
if (keyData.type === 'permanent') {
const oldDeviceId = keyData.deviceId;
keyData.deviceId = deviceId; // 更新为新的设备ID
keyData.activatedAt = Date.now(); // 刷新激活时间

const pipeline = kv.pipeline();
pipeline.set(key:${key}, keyData); // 更新激活码记录
if(oldDeviceId) { pipeline.del(device:${oldDeviceId}); } // 删除旧设备的绑定记录
pipeline.set(device:${deviceId}, key); // 创建新设备的绑定记录
await pipeline.exec();
return res.status(200).json({ success: true, message: '激活成功！设备已更新。', key: key, keyType: keyData.type, activatedAt: keyData.activatedAt });
} else {
// 如果是【试用码】，则严格执行一机一码，不允许换绑
return res.status(403).json({ success: false, message: '此试用激活码已被其他设备使用。' });
}
}

const now = Date.now();
// 如果是首次激活此码，则绑定设备
if (!keyData.deviceId) {
keyData.deviceId = deviceId;
keyData.activatedAt = now;
await kv.pipeline().set(key:${key}, keyData).set(device:${deviceId}, key).exec();
}

// 检查试用码是否过期
if (keyData.type === 'trial' && keyData.activatedAt) {
const trialDurationMillis = (keyData.durationSeconds || 0) * 1000;
if (now > keyData.activatedAt + trialDurationMillis) {
return res.status(403).json({ success: false, message: '您的试用期已结束。' });
}
}
res.status(200).json({ success: true, message: '激活成功！', key: key, keyType: keyData.type, activatedAt: keyData.activatedAt, durationSeconds: keyData.durationSeconds });
} catch (error) {
console.error('Activation API error:', error);
res.status(500).json({ success: false, message: '服务器内部错误，请稍后再试。' });
}
}
