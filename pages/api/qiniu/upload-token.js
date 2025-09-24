// pages/api/qiniu/upload-token.js (增强版)

import qiniu from 'qiniu';

export default function handler(req, res) {
  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = process.env.QINIU_BUCKET_NAME;

  // 从前端获取文件类型，以决定使用哪个上传策略
const { fileType } = req.query; // e.g., 'video', 'image', 'audio'
  
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  
  let options = {
    scope: bucket,
    expires: 3600,
    // 返回更多信息，包括文件的 mimeType
    returnBody: `{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","mimeType":"$(mimeType)"}`
  };

  // 【核心修改】为视频和图片添加持久化数据处理
if (fileType === 'video') {
    // 1. 生成一个 mp4 格式的压缩视频
    // 2. 截取视频第1帧作为封面图
    const fops = [
      `avthumb/mp4/vcodec/libx264/acodec/libfaac|saveas/${qiniu.util.urlsafeBase64Encode(`${bucket}:compressed_$(key)`)}`,
      `vframe/jpg/offset/1|saveas/${qiniu.util.urlsafeBase64Encode(`${bucket}:thumbnail_$(key)`)}`
    ].join(';');
    
    options.persistentOps = fops;
    options.persistentPipeline = 'your_pipeline_name'; // 【重要】您需要在七牛云后台->数据处理->新建队列，获取一个队列名称填在这里
  } else if (fileType === 'image') {
    // 为图片生成一个缩略图
    const fops = `imageView2/2/w/400/h/400/q/85|saveas/${qiniu.util.urlsafeBase64Encode(`${bucket}:thumbnail_$(key)`)}`;
    options.persistentOps = fops;
    options.persistentPipeline = 'your_pipeline_name';
  }

  const putPolicy = new qiniu.rs.PutPolicy(options);
  const uploadToken = putPolicy.uploadToken(mac);

  res.status(200).json({ token: uploadToken });
}
