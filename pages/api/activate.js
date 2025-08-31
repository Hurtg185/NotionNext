// /pages/api/activate.js - v47 (修复“每个设备只能试用一次”的逻辑漏洞)
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
      const existingKeyForDevice = await kv.get(`device:${deviceId}`);

      // 核心修复点：如果此设备已经绑定过任何激活码，就不能再自动试用
      if (existingKeyForDevice) {
        const boundKeyData = await kv.get(`key:${existingKeyForDevice}`);
        if (boundKeyData) {
            if (boundKeyData.type === 'permanent') {
                return res.status(200).json({ success: true, message: '已永久激活。', key: existingKeyForDevice, keyType: 'permanent' });
            } else if (boundKeyData.type === 'trial') {
                const trialExpiryTime = boundKeyData.activatedAt + (boundKeyData.durationSeconds || TRIAL_DURATION_SECONDS) * 1000;
                if (Date.now() < trialExpiryTime) {
                    return res.status(200).json({ success: true, message: '试用期仍在有效期内。', key: existingKeyForDevice, keyType: 'trial', activatedAt: boundKeyData.activatedAt, durationSeconds: boundKeyData.durationSeconds });
                } else {
                    return res.status(403).json({ success: false, message: '您的试用期已结束，每个设备只能试用一次。请手动输入激活码。' });
                }
            }
        }
        return res.status(403).json({ success: false, message: '设备状态异常，无法自动试用。' });
      }

      const trialKey = `TRIAL-${uuidv4()}`;
      const now = Date.now();
      const trialData = { type: 'trial', durationSeconds: TRIAL_DURATION_SECONDS, deviceId: deviceId, activatedAt: now };

      const pipeline = kv.pipeline();
      pipeline.set(`key:${trialKey}`, trialData);
      pipeline.set(`device:${deviceId}`, trialKey);
      await pipeline.exec();

      return res.status(200).json({
        success: true, message: '试用激活成功！',
        key: trialKey, keyType: 'trial',
        activatedAt: now, durationSeconds: TRIAL_DURATION_SECONDS
      });
    }

    if (!key) { return res.status(400).json({ success: false, message: '激活码是必需的。' }); }

    const keyData = await kv.get(`key:${key}`);
    if (!keyData) { return res.status(404).json({ success: false, message: '激活码无效或不存在。' }); }

    if (keyData.deviceId && keyData.deviceId !== deviceId) {
      return res.status(403).json({ success: false, message: '此激活码已被其他设备绑定。' });
    }
    
    const now = Date.now();
    let message = '激活成功！';

    if (!keyData.deviceId) {
      keyData.deviceId = deviceId;
      keyData.activatedAt = now;
      const pipeline = kv.pipeline();
      pipeline.set(`key:${key}`, keyData);
      pipeline.set(`device:${deviceId}`, key);
      await pipeline.exec();
    }
    
    if (keyData.type === 'trial' && keyData.activatedAt) {
        const trialDurationMillis = (keyData.durationSeconds || 7 * 24 * 60 * 60) * 1000;
        if (now > keyData.activatedAt + trialDurationMillis) {
            return res.status(403).json({ success: false, message: '您的试用期已结束。' });
        }
        const expiryDate = new Date(keyData.activatedAt + trialDurationMillis);
        message = `试用激活成功！有效期至: ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString()}`;
    }

    res.status(200).json({ success: true, message: message, key: key, keyType: keyData.type, activatedAt: keyData.activatedAt, durationSeconds: keyData.durationSeconds });

  } catch (error) {
    console.error('Activation API error:', error);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后再试。' });
  }
}
