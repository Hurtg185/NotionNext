// /pages/api/activate.js - v55 (终极修复版 - 永久码弹性绑定，彻底防止失效，堵塞多浏览器试用)
import { kv } from '@vercel/kv';
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { key, deviceId, action } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!deviceId || !ip) {
    return res.status(400).json({ success: false, message: '设备ID和IP地址是必需的。' });
  }

  try {
    const AUTO_TRIAL_DURATION_SECONDS = 5 * 60; // 自动试用期：5分钟
    const MAX_AUTO_TRIAL_PER_IP = 1; // 每个IP地址只允许自动试用1次

    // --- 自动试用逻辑 ---
    if (action === 'start_trial') {
      const ipTrialCount = await kv.get(`ip_trial_count:${ip}`) || 0;
      if (ipTrialCount >= MAX_AUTO_TRIAL_PER_IP) {
        return res.status(403).json({ success: false, message: '此网络（IP地址）已达到自动试用次数上限。' });
      }
      
      const hasDeviceTrialed = await kv.get(`device_trial_history:${deviceId}`);
      if (hasDeviceTrialed) {
          return res.status(403).json({ success: false, message: '此设备已进行过试用，无法再次试用。' });
      }

      const existingKeyForDevice = await kv.get(`device:${deviceId}`);
      if (existingKeyForDevice) {
        const boundKeyData = await kv.get(`key:${existingKeyForDevice}`);
        if (boundKeyData && boundKeyData.type === 'permanent') {
            return res.status(403).json({ success: false, message: '您已激活永久会员，无需试用。' });
        }
        return res.status(403).json({ success: false, message: '此设备已绑定激活信息，无法自动试用。' });
      }

      const trialKey = `AUTO-TRIAL-${uuidv4()}`;
      const now = Date.now();
      const trialData = { type: 'trial', trialType: 'auto', durationSeconds: AUTO_TRIAL_DURATION_SECONDS, deviceId: deviceId, ip: ip, activatedAt: now };

      const pipeline = kv.pipeline();
      pipeline.set(`key:${trialKey}`, trialData);
      pipeline.set(`device:${deviceId}`, trialKey);
      pipeline.set(`ip:${ip}`, trialKey);
      pipeline.incr(`ip_trial_count:${ip}`);
      pipeline.set(`device_trial_history:${deviceId}`, 'true', { ex: 365 * 24 * 60 * 60 });
      await pipeline.exec();

      return res.status(200).json({
        success: true, message: '试用激活成功！',
        key: trialKey, keyType: 'trial',
        activatedAt: now, durationSeconds: AUTO_TRIAL_DURATION_SECONDS
      });
    }

    // --- 手动激活逻辑 (主要用于永久码和人工发放的试用码) ---
    if (!key) { return res.status(400).json({ success: false, message: '激活码是必需的。' }); }

    const keyData = await kv.get(`key:${key}`);
    if (!keyData) { return res.status(404).json({ success: false, message: '激活码无效或不存在。' }); }

    // 1. 检查激活码类型
    if (keyData.type === 'permanent') {
        // --- 永久码的弹性绑定逻辑 ---
        let message = '永久会员激活成功！';
        let needsDbUpdate = false;
        let oldDeviceId = keyData.deviceId;
        let oldIp = keyData.ip;

        if (!keyData.deviceId || keyData.deviceId !== deviceId || !keyData.ip || keyData.ip !== ip) {
            // 如果首次激活，或设备/IP有变化，则需要更新数据库
            needsDbUpdate = true;
            keyData.deviceId = deviceId;
            keyData.ip = ip;
            keyData.activatedAt = Date.now(); // 刷新激活时间
            message = '永久会员激活成功！设备和网络信息已更新。';
        }

        if (needsDbUpdate) {
            const pipeline = kv.pipeline();
            pipeline.set(`key:${key}`, keyData); // 更新主记录
            if (oldDeviceId && oldDeviceId !== deviceId) { pipeline.del(`device:${oldDeviceId}`); } // 删除旧设备的反向绑定
            if (oldIp && oldIp !== ip) { pipeline.del(`ip:${oldIp}`); } // 删除旧IP的反向绑定
            pipeline.set(`device:${deviceId}`, key); // 创建新设备的反向绑定
            pipeline.set(`ip:${ip}`, key); // 创建新IP的反向绑定
            await pipeline.exec();
        }

        return res.status(200).json({ success: true, message: message, key: key, keyType: keyData.type, activatedAt: keyData.activatedAt, durationSeconds: keyData.durationSeconds });

    } else if (keyData.type === 'trial') {
        // --- 试用码的严格绑定逻辑 (与永久码不同) ---
        // 试用码一旦绑定，就不允许换绑，除非当前请求的deviceId和ip与数据库记录完全一致
        if (keyData.deviceId && keyData.deviceId !== deviceId) {
            return res.status(403).json({ success: false, message: '此试用激活码已被其他设备绑定。' });
        }
        if (keyData.ip && keyData.ip !== ip) {
            return res.status(403).json({ success: false, message: '此试用激活码已被其他网络IP绑定。' });
        }

        const now = Date.now();
        // 检查试用码是否过期
        const trialDurationMillis = (keyData.durationSeconds || 0) * 1000;
        if (now > keyData.activatedAt + trialDurationMillis) {
            return res.status(403).json({ success: false, message: '您的试用期已结束。' });
        }

        return res.status(200).json({ success: true, message: '试用激活成功！', key: key, keyType: keyData.type, activatedAt: keyData.activatedAt, durationSeconds: keyData.durationSeconds });
    }

  } catch (error) {
    console.error('Activation API error:', error);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后再试。' });
  }
}
