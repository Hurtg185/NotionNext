// /pages/api/activate.js - v56 (支持手动5天 & 自动5分钟试用)
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
    const MAX_AUTO_TRIAL_PER_IP = 1;

    if (action === 'start_trial') {
      const ipTrialCount = await kv.get(`ip_trial_count:${ip}`) || 0;
      if (ipTrialCount >= MAX_AUTO_TRIAL_PER_IP) {
        return res.status(403).json({ success: false, message: '此网络（IP地址）已达到自动试用次数上限。' });
      }
      
      const hasDeviceTrialed = await kv.get(`device_trial_history:${deviceId}`);
      if (hasDeviceTrialed) {
          return res.status(403).json({ success: false, message: '此设备已进行过自动试用，无法再次试用。' });
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

    if (!key) { return res.status(400).json({ success: false, message: '激活码是必需的。' }); }

    const keyData = await kv.get(`key:${key}`);
    if (!keyData) { return res.status(404).json({ success: false, message: '激活码无效或不存在。' }); }

    if (keyData.deviceId && keyData.deviceId !== deviceId) {
        if (keyData.type === 'permanent') {
            const oldDeviceId = keyData.deviceId;
            const oldIp = keyData.ip;
            keyData.deviceId = deviceId;
            keyData.ip = ip;
            keyData.activatedAt = Date.now();
            
            const pipeline = kv.pipeline();
            pipeline.set(`key:${key}`, keyData);
            if(oldDeviceId) { pipeline.del(`device:${oldDeviceId}`); }
            if(oldIp) { pipeline.del(`ip:${oldIp}`); }
            pipeline.set(`device:${deviceId}`, key);
            pipeline.set(`ip:${ip}`, key);
            await pipeline.exec();

            return res.status(200).json({ success: true, message: '激活成功！设备已更新。', key: key, keyType: keyData.type, activatedAt: keyData.activatedAt });
        } else {
            return res.status(403).json({ success: false, message: '此试用激活码已被其他设备使用。' });
        }
    }
    
    const now = Date.now();
    if (!keyData.deviceId) {
      keyData.deviceId = deviceId;
      keyData.ip = ip;
      keyData.activatedAt = now;
      await kv.pipeline().set(`key:${key}`, keyData).set(`device:${deviceId}`, key).set(`ip:${ip}`, key).exec();
    }
    
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
