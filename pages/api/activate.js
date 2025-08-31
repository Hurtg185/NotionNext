// /pages/api/activate.js
// 这个API负责处理用户输入的激活码或自动试用请求。
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一的试用码

export default async function handler(req, res) {
  // 只接受 POST 请求，提高安全性
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { key, deviceId, action } = req.body; // action 用于区分是“手动激活”还是“自动试用”

  // deviceId 是必需的，用于一机一码的绑定
  if (!deviceId) {
    return res.status(400).json({ success: false, message: '设备ID是必需的。' });
  }

  try {
    // --- 自动试用逻辑 ---
    if (action === 'start_trial') {
      const TRIAL_DURATION_SECONDS = 5 * 60; // 【这里修改为5分钟，方便测试】

      // 首先，检查此设备是否已经试用过
      const existingKeyForDevice = await kv.get(`device:${deviceId}`);
      if (existingKeyForDevice) {
        // 如果此设备已绑定过任何激活码（无论是试用还是永久），则不能再次自动试用
        const existingKeyData = await kv.get(`key:${existingKeyForDevice}`);
        if (existingKeyData && existingKeyData.type === 'trial' && Date.now() < (existingKeyData.activatedAt + existingKeyData.durationSeconds * 1000)) {
            // 如果此设备已有一个还在有效期内的试用码，则直接返回其信息
            return res.status(200).json({
                success: true,
                message: '试用期仍在有效期内。',
                key: existingKeyForDevice,
                keyType: 'trial',
                activatedAt: existingKeyData.activatedAt,
                durationSeconds: existingKeyData.durationSeconds
            });
        } else if (existingKeyData && existingKeyData.type === 'permanent') {
            // 如果此设备已经绑定了一个永久码，则返回永久信息
            return res.status(200).json({
                success: true,
                message: '已永久激活。',
                key: existingKeyForDevice,
                keyType: 'permanent',
            });
        }
        // 如果 existingKeyForDevice 存在但已过期或不是试用码，
        // 允许重新尝试自动试用或手动激活（下面的逻辑会处理）
      }
      
      // 为此设备生成一个唯一的、隐形的试用码
      const trialKey = `TRIAL-${uuidv4()}`; // UUID确保唯一性，TRIAL-前缀方便区分
      const now = Date.now();
      const trialData = {
        type: 'trial', // 标记为试用码
        durationSeconds: TRIAL_DURATION_SECONDS, // 试用时长（秒）
        deviceId: deviceId, // 绑定设备ID
        activatedAt: now, // 记录激活时间
      };

      // 将试用码数据和设备ID绑定关系存入数据库（使用pipeline提高效率）
      const pipeline = kv.pipeline();
      pipeline.set(`key:${trialKey}`, trialData);
      pipeline.set(`device:${deviceId}`, trialKey); // 设备反向绑定到激活码
      await pipeline.exec();

      return res.status(200).json({
        success: true,
        message: '试用激活成功！',
        key: trialKey,
        keyType: 'trial',
        activatedAt: now,
        durationSeconds: TRIAL_DURATION_SECONDS
      });
    }
    // --- 自动试用逻辑结束 ---


    // --- 手动激活逻辑（用于永久码或用户输入试用码） ---
    if (!key) {
        return res.status(400).json({ success: false, message: '激活码是必需的。' });
    }

    // 1. 从数据库中获取激活码数据
    const keyData = await kv.get(`key:${key}`);

    if (!keyData) {
      return res.status(404).json({ success: false, message: '激活码无效或不存在。' });
    }

    // 2. 检查激活码是否已被其他设备绑定
    // 如果 keyData.deviceId 存在，且不等于当前设备的 deviceId，说明被其他设备绑定了
    if (keyData.deviceId && keyData.deviceId !== deviceId) {
      return res.status(403).json({ success: false, message: '此激活码已被其他设备绑定。' });
    }
    
    // 3. 如果是当前设备首次激活，或者重复验证（DeviceId相同），则更新/确认状态
    const now = Date.now();
    let message = '激活成功！';

    if (!keyData.deviceId) { // 如果是首次激活
      keyData.deviceId = deviceId;
      keyData.activatedAt = now;
      const pipeline = kv.pipeline();
      pipeline.set(`key:${key}`, keyData); // 更新激活码信息
      pipeline.set(`device:${deviceId}`, key); // 记录设备绑定了哪个激活码
      await pipeline.exec();
    }
    
    // 4. 处理试用码过期逻辑
    if (keyData.type === 'trial' && keyData.activatedAt) {
        const trialDurationMillis = (keyData.durationSeconds || 7 * 24 * 60 * 60) * 1000; // 统一转换为毫秒
        if (now > keyData.activatedAt + trialDurationMillis) {
            // 如果已过期，返回过期信息
            return res.status(403).json({ success: false, message: '您的试用期已结束。' });
        }
        // 如果还在有效期内，计算剩余时间并返回
        const expiryDate = new Date(keyData.activatedAt + trialDurationMillis);
        message = `试用激活成功！有效期至: ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString()}`;
    }

    // 5. 返回成功信息
    res.status(200).json({ success: true, message: message, key: key, keyType: keyData.type, activatedAt: keyData.activatedAt, durationSeconds: keyData.durationSeconds });

  } catch (error) {
    console.error('Activation API error:', error);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后再试。' });
  }
}
