// /pages/api/activate.js
import { kv } from '@vercel/kv';
const { v4: uuidv4 } = require('uuid'); // 使用更兼容的导入方式

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { key, deviceId, action } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: '设备ID是必需的。' });
  }

  try {
    if (action === 'start_trial') {
      const existingKey = await kv.get(`device:${deviceId}`);
      if (existingKey) {
        return res.status(403).json({ success: false, message: '每个设备只能试用一次。' });
      }

      const trialKey = `TRIAL-${uuidv4()}`;
      const now = Date.now();
      const trialData = { type: 'trial', durationDays: 7, deviceId: deviceId, activatedAt: now };

      await kv.set(`key:${trialKey}`, trialData);
      await kv.set(`device:${deviceId}`, trialKey);

      return res.status(200).json({
        success: true,
        message: '试用激活成功！',
        key: trialKey,
        keyType: 'trial',
        activatedAt: now,
        durationDays: 7
      });
    }

    if (!key) { return res.status(400).json({ success: false, message: '激活码是必需的。' }); }

    const keyData = await kv.get(`key:${key}`);
    if (!keyData) { return res.status(404).json({ success: false, message: '激活码无效或不存在。' }); }

    if (keyData.deviceId && keyData.deviceId !== deviceId) {
      return res.status(403).json({ success: false, message: '此激活码已被其他设备使用。' });
    }

    const now = Date.now();
    let message = '激活成功！';

    if (!keyData.deviceId) {
      keyData.deviceId = deviceId;
      keyData.activatedAt = now;
      await kv.set(`key:${key}`, keyData);
      await kv.set(`device:${deviceId}`, key);
    }
    
    if (keyData.type === 'trial' && keyData.activatedAt) {
        const trialDuration = (keyData.durationDays || 7) * 24 * 60 * 60 * 1000;
        if (now > keyData.activatedAt + trialDuration) {
            return res.status(403).json({ success: false, message: '您的试用期已结束。' });
        }
        const expiryDate = new Date(keyData.activatedAt + trialDuration);
        message = `试用激活成功！有效期至: ${expiryDate.toLocaleDateString()}`;
    }

    res.status(200).json({ success: true, message: message, key: key, keyType: keyData.type, activatedAt: keyData.activatedAt, durationDays: keyData.durationDays });

  } catch (error) {
    console.error('Activation API error:', error);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后再试。' });
  }
}
