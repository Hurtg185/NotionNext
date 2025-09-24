// 文件路径: pages/api/qiniu/upload-token.js

import qiniu from 'qiniu';

export default function handler(req, res) {
  // 从 Vercel 环境变量中安全地获取配置
  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = process.env.QINIU_BUCKET_NAME;

  if (!accessKey || !secretKey || !bucket) {
    return res.status(500).json({ error: '服务器环境变量未正确配置。' });
  }

  // 创建鉴权对象
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);

  // 定义上传策略
  const options = {
    scope: bucket, 
    expires: 3600, // 上传凭证1小时内有效
  };

  const putPolicy = new qiniu.rs.PutPolicy(options);
  
  // 生成上传凭证
  const uploadToken = putPolicy.uploadToken(mac);

  // 将凭证返回给前端
  res.status(200).json({ token: uploadToken });
}
