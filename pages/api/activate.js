// /pages/api/activate.js - v53 (最终修复版 - 彻底修复重复试用漏洞 & 永久码换绑逻辑)
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
    const MAX_AUTO_TRIAL_PER_IP = 1; // 每个IP地址只允许进行一次【自动】试用

    // --- 自动试用逻辑 ---
    if (action === 'start_trial') {
      const ipTrialCount = await kv.get(`ip_trial_count:${ip}`) || 0;
      
      // 1. 检查IP地址是否已达到【自动】试用上限
      if (ipTrialCount >= MAX_AUTO_TRIAL_PER_IP) {
        return res.status(403).json({ success: false, message: '此网络（IP地址）已达到自动试用次数上限，请手动输入激活码。' });
      }
      
      // 2. 检查此设备指纹是否曾经获得过任何有效的激活码
      const existingKeyForDevice = await kv.get(`device:${deviceId}`);
      if (existingKeyForDevice) {
        const boundKeyData = await kv.get(`key:${existingKeyForDevice}`);
        if (boundKeyData) {
            if (boundKeyData.type === 'permanent') {
                return res.status(200).json({ success: true, message: '您已激活永久会员，无需试用。', key: existingKeyForDevice, keyType: 'permanent' });
            } else if (boundKeyData.type === 'trial') {
                const trialExpiryTime = boundKeyData.activatedAt + (boundKeyData.durationSeconds || AUTO_TRIAL_DURATION_SECONDS) * 1000;
                if (Date.now() < trialExpiryTime) {
                    return res.status(200).json({ success: true, message: '试用期仍在有效期内。', key: existingKeyForDevice, keyType: 'trial', activatedAt: boundKeyData.activatedAt, durationSeconds: boundKeyData.durationSeconds });
                } else {
                    // 试用期已过期，明确告知不能再次自动试用
                    return res.status(403).json({ success: false, message: '您的试用期已结束，每个设备只能试用一次。请手动输入激活码。' });
                }
            }
        }
      }

      // 3. 如果 IP 未超限，设备也从未绑定过有效的激活码，则生成新的【自动】试用码
      const trialKey = `AUTO-TRIAL-${uuidv4()}`; // 明确标记为自动试用码
      const now = Date.now();
      const trialData = { 
          type: 'trial',
          trialType: 'auto', // 标记为自动试用
          durationSeconds: AUTO_TRIAL_DURATION_SECONDS,
          deviceId: deviceId, ip: ip, activatedAt: now
      };

      const pipeline = kv.pipeline();
      pipeline.set(`key:${trialKey}`, trialData);
      pipeline.set(`device:${deviceId}`, trialKey); // 绑定设备到此试用码
      pipeline.set(`ip:${ip}`, trialKey); // 绑定IP到此试用码
      pipeline.incr(`ip_trial_count:${ip}`); // IP试用次数+1
      // 这里不需要 device_trial_history，因为 device:${deviceId} 已经能判断是否绑定过
      await pipeline.exec();

      return res.status(200).json({
        success: true, message: '试用激活成功！',
        key: trialKey, keyType: 'trial',
        activatedAt: now, durationSeconds: trialData.durationSeconds
      });
    }


    // --- 手动激活逻辑（主要用于永久码和人工发放的试用码） ---
    if (!key) { return res.status(400).json({ success: false, message: '激活码是必需的。' }); }

    const keyData = await kv.get(`key:${key}`);
    if (!keyData) { return res.status(404).json({ success: false, message: '激活码无效或不存在。' }); }

    const now = Date.now();
    let message = '激活成功！';
    let forceFrontendClear = false; // 指示前端是否需要清除旧key

    // 处理设备指纹和IP变化（换绑逻辑）
    if (keyData.deviceId && keyData.deviceId !== deviceId) {
        if (keyData.type === 'permanent') {
            const oldDeviceId = keyData.deviceId;
            const oldIp = keyData.ip;

            keyData.deviceId = deviceId; // 更新为新的设备ID
            keyData.ip = ip; // 更新为新的IP
            keyData.activatedAt = now; // 刷新激活时间（可选，但推荐）
            
            const pipeline = kv.pipeline();
            pipeline.set(`key:${key}`, keyData); // 更新主记录
            if(oldDeviceId) { pipeline.del(`device:${oldDeviceId}`); } // 删除旧的设备反向绑定
            if(oldIp) { pipeline.del(`ip:${oldIp}`); } // 删除旧的IP反向绑定
            pipeline.set(`device:${deviceId}`, key); // 创建新的设备反向绑定
            pipeline.set(`ip:${ip}`, key); // 创建新的IP反向绑定
            await pipeline.exec();
            
            message = '激活成功！设备已更新。';
            forceFrontendClear = true; // 告知前端，因为发生了换绑，旧设备需要清除本地存储
        } else {
            // 试用码严格执行一机一码，不允许换绑
            return res.status(403).json({ success: false, message: '此试用激活码已被其他设备使用，无法换绑。' });
        }
    } else if (keyData.ip && keyData.ip !== ip && keyData.type !== 'permanent') { // 试用码IP变动
        return res.status(403).json({ success: false, message: '此试用激活码已被其他网络IP绑定，无法换绑。' });
    }
    
    // 如果是首次激活此码
    if (!keyData.deviceId) {
      keyData.deviceId = deviceId;
      keyData.ip = ip;
      keyData.activatedAt = now;
      await kv.pipeline().set(`key:${key}`, keyData).set(`device:${deviceId}`, key).set(`ip:${ip}`, key).exec();
    }
    
    // 检查试用码是否过期
    if (keyData.type === 'trial' && keyData.activatedAt) {
        const trialDurationMillis = (keyData.durationSeconds || 0) * 1000;
        if (now > keyData.activatedAt + trialDurationMillis) {
            return res.status(403).json({ success: false, message: '您的试用期已结束。' });
        }
        // 如果是人工发放的试用码
        if (keyData.trialType === 'manual') {
            const expiryDate = new Date(keyData.activatedAt + trialDurationMillis);
            message = `人工试用激活成功！有效期至: ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString()}`;
        }
    }

    res.status(200).json({
        success: true,
        message: message,
        key: key, keyType: keyData.type,
        activatedAt: keyData.activatedAt, durationSeconds: keyData.durationSeconds,
        forceFrontendClear: forceFrontendClear // 【新增】指令，通知前端强制清除key
    });

  } catch (error) {
    console.error('Activation API error:', error);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后再试。' });
  }
}
