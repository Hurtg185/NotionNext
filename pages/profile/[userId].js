// components/EditProfileModal.js (完整且已修复)

import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const EditProfileModal = ({ user, onClose, onProfileUpdate }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [gender, setGender] = useState(user.gender || '');
  const [tags, setTags] = useState((user.tags || []).join(', '));
  const [socials, setSocials] = useState(user.socials || { twitter: '', instagram: '', github: '' });
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSocialChange = (platform, value) => {
    setSocials(prev => ({ ...prev, [platform]: value }));
  };

  const handleFileChange = (e, type) => {
    if (e.target.files[0]) {
      if (type === 'avatar') setAvatarFile(e.target.files[0]);
      if (type === 'background') setBackgroundFile(e.target.files[0]);
    }
  };

  const uploadImage = async (file, path) => {
    const storage = getStorage();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let avatarUrl = user.photoURL;
      let backgroundUrl = user.backgroundImageUrl;

      if (avatarFile) {
        avatarUrl = await uploadImage(avatarFile, `avatars/${user.uid}/${avatarFile.name}`);
      }
      if (backgroundFile) {
        backgroundUrl = await uploadImage(backgroundFile, `backgrounds/${user.uid}/${backgroundFile.name}`);
      }
      
      const updatedData = {
        displayName,
        bio,
        gender,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        socials,
      };

      if (avatarUrl !== user.photoURL) {
        updatedData.photoURL = avatarUrl;
      }
      if (backgroundUrl !== user.backgroundImageUrl) {
        updatedData.backgroundImageUrl = backgroundUrl;
      }
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updatedData);

      onProfileUpdate();
      onClose();

    } catch (error) {
      console.error("更新资料失败:", error);
      alert(`更新失败: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">编辑个人资料</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full input-style" />
          </div>

          <div>
            <label className="block text-sm font-medium">个人简介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows="3" className="mt-1 block w-full input-style"></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium">性别</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full input-style">
              <option value="">不设置</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">爱好标签 (用逗号 , 分隔)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full input-style" placeholder="例如：摄影, 旅游, 编程" />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">社交链接 (只填用户名)</label>
            <div className="flex items-center space-x-2">
              <span className="w-24">Twitter</span>
              <input type="text" value={socials.twitter || ''} onChange={(e) => handleSocialChange('twitter', e.target.value)} className="block w-full input-style" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-24">Instagram</span>
              <input type="text" value={socials.instagram || ''} onChange={(e) => handleSocialChange('instagram', e.target.value)} className="block w-full input-style" />
            </div>
             <div className="flex items-center space-x-2">
              <span className="w-24">GitHub</span>
              <input type="text" value={socials.github || ''} onChange={(e) => handleSocialChange('github', e.target.value)} className="block w-full input-style" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium">头像</label>
            <input type="file" onChange={(e) => handleFileChange(e, 'avatar')} accept="image/*" className="mt-1 block w-full file-input-style" />
          </div>

          <div>
            <label className="block text-sm font-medium">个人主页背景</label>
            <input type="file" onChange={(e) => handleFileChange(e, 'background')} accept="image/*" className="mt-1 block w-full file-input-style" />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} disabled={isUploading} className="btn-secondary">取消</button>
            <button type="submit" disabled={isUploading} className="btn-primary">
              {isUploading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
       <style jsx global>{`
        .input-style {
          background-color: #f3f4f6; /* gray-100 */
          border: 1px solid #d1d5db; /* gray-300 */
          border-radius: 0.375rem; /* rounded-md */
          padding: 0.5rem 0.75rem;
          color: #111827; /* gray-900 */
        }
        .dark .input-style {
          background-color: #374151; /* dark:gray-700 */
          border-color: #4b5563; /* dark:gray-600 */
          color: #f9fafb; /* dark:gray-50 */
        }
        .file-input-style {
          font-size: 0.875rem;
        }
        .btn-primary {
          background-color: #2563eb; /* blue-600 */
          color: white;
          padding: 0.5rem 1.25rem;
          border-radius: 0.375rem;
          font-weight: 600;
          transition: background-color 0.2s;
        }
        .btn-primary:hover { background-color: #1d4ed8; }
        .btn-primary:disabled { background-color: #9ca3af; cursor: not-allowed; }
        .btn-secondary {
            background-color: #e5e7eb; /* gray-200 */
            color: #1f2937; /* gray-800 */
            padding: 0.5rem 1.25rem;
            border-radius: 0.375rem;
            font-weight: 600;
            transition: background-color 0.2s;
        }
        .dark .btn-secondary { background-color: #4b5563; color: #f9fafb; }
        .btn-secondary:hover { background-color: #d1d5db; }
        .dark .btn-secondary:hover { background-color: #6b7280; }
        .btn-secondary:disabled { background-color: #9ca3af; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default EditProfileModal;
