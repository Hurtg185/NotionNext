// pages/api/qiniu/upload-token.js (最终、最完整的版本)

import qiniu from 'qiniu';

export default function handler(req, res) {
  // 1. 从 Vercel 环境变量中安全地获取所有配置
  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = process.env.QINIU_BUCKET_NAME;
  // 【重要】确保 Vercel 中已设置 QINIU_PIPELINE_NAME，值为 my-pipeline
  const pipeline = process.env.QINIU_PIPELINE_NAME; 

  // 2. 健壮性检查：确保所有环境变量都已设置
  if (!accessKey || !secretKey || !bucket || !pipeline) {
    console.error('Qiniu environment variables are not fully configured!');
    return res.status(500).json({ error: '服务器环境变量未完整配置。' });
  }

  // 3. 从前端请求中获取文件类型
  const { fileType } = req.query; 
  
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  
  // 4. 定义基础上传策略
  const options = {
    scope: bucket,
    expires: 3600, // 凭证有效期1小时
    // 【重要】返回更多信息，以便前端使用
    returnBody: `{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","mimeType":"$(mimeType)","persistentId":"$(persistentId)"}`
  };

  // 5. 【核心逻辑】根据文件类型，决定是否附加数据处理工作流
  if (fileType === 'video') {
    // 只有当上传的是视频时，我们才使用之前创建的'my-pipeline'工作流
    options.persistentPipeline = pipeline;
  } else if (fileType === 'audio') {
    // 【新增】为音频文件也定义一个处理流程（如果需要的话）
    // 例如，将所有音频统一转为 mp3 格式
    const fops = `avthumb/mp3|saveas/${qiniu.util.urlsafeBase64Encode(`${bucket}:compressed_audio/$(key).mp3`)}`;
    options.persistentOps = fops;
    options.persistentPipeline = pipeline; // 同样使用这个队列
  }
  // 对于图片和其他文件类型，我们不进行任何持久化处理。
  // 图片的压缩将通过前端请求URL时附加样式参数来实现，这样更灵活。

  // 6. 生成最终的上传凭证
  const putPolicy = new qiniu.rs.PutPolicy(options);
  const uploadToken = putPolicy.uploadToken(mac);

  // 7. 将凭证返回给前端
  res.status(200).json({ token: uploadToken });
}
