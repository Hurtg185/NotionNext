// 文件路径: components/QiniuUploader.js

import React, { useState, useRef } from 'react';
import axios from 'axios';

// 【重要】新加坡地区的上传地址
const QINIU_UPLOAD_URL = 'https://upload-ap-southeast-1.qiniup.com';

const QiniuUploader = ({ onUploadSuccess, onUploadStart, onUploadError, accept = "image/*, video/*, audio/*" }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null); // 用于触发文件选择

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    if (onUploadStart) onUploadStart(file.name); // 通知父组件上传开始

    try {
      // 1. 从我们的后端获取上传凭证
      const tokenResponse = await axios.get('/api/qiniu/upload-token');
      const token = tokenResponse.data.token;

      // 2. 准备上传数据
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);
      
      const fileExtension = file.name.split('.').pop();
      const key = `media/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
      formData.append('key', key);

      // 3. 上传到七牛云
      const uploadResponse = await axios.post(QINIU_UPLOAD_URL, formData);
      
      // 4. 构建最终 URL
      const domain = process.env.NEXT_PUBLIC_QINIU_DOMAIN; 
      const finalUrl = `${domain}/${uploadResponse.data.key}`;
      
      // 5. 调用成功回调
      if (onUploadSuccess) onUploadSuccess(finalUrl);

    } catch (err) {
      console.error('上传失败:', err);
      if (onUploadError) onUploadError('上传失败，请重试。');
    } finally {
      setIsUploading(false);
      // 清空 input 的值，以便可以再次选择同一个文件
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
        {isUploading ? '上传中...' : '添加图片/视频/音频'}
      </button>
      <input 
        ref={fileInputRef}
        type="file" 
        accept={accept}
        onChange={handleFileChange} 
        style={{ display: 'none' }}
      />
    </>
  );
};

export default QiniuUploader;
