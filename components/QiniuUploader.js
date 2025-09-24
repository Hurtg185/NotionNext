// 文件路径: components/QiniuUploader.js (已修正上传地址)

import React, { useRef } from 'react';
import axios from 'axios';

// 【核心修正】使用不会被解析错误的备用上传域名
const QINIU_UPLOAD_URL = 'https://up-as0.qiniup.com';

const QiniuUploader = ({ 
  onUploadSuccess, 
  onUploadStart, 
  onUploadError, 
  accept = "*/*",
  children
}) => {
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (onUploadStart) onUploadStart(file);

    try {
      const tokenResponse = await axios.get('/api/qiniu/upload-token');
      const token = tokenResponse.data.token;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);
      
      const fileExtension = file.name.split('.').pop() || 'tmp';
      const key = `media/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
      formData.append('key', key);

      // 使用修正后的上传地址
      const uploadResponse = await axios.post(QINIU_UPLOAD_URL, formData);
      
      const domain = process.env.NEXT_PUBLIC_QINIU_DOMAIN; 
      const finalUrl = `${domain}/${uploadResponse.data.key}`;
      
      if (onUploadSuccess) onUploadSuccess(finalUrl, file.type);

    } catch (err) {
      console.error('上传失败:', err);
      // 提供更详细的错误提示
      const errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
      if (onUploadError) onUploadError(`上传失败: ${errorMessage}`);
    } finally {
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input 
        ref={fileInputRef}
        type="file" 
        accept={accept}
        onChange={handleFileChange} 
        style={{ display: 'none' }}
      />
      <div onClick={handleClick} style={{ cursor: 'pointer' }}>
        {children}
      </div>
    </>
  );
};

export default QiniuUploader;
