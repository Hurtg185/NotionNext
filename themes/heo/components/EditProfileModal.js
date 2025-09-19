// components/EditProfileModal.js
import { useState, useEffect, useRef } from 'react';
import { updateUserProfile, uploadProfilePicture } from '@/lib/user';

const EditProfileModal = ({ user, onClose, onProfileUpdate }) => {
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || '',
        gender: user.gender || 'not-specified',
        birthDate: user.birthDate || '',
        occupation: user.occupation || '',
        bio: user.bio || '',
        nationality: user.nationality || '',
        learningLanguage: user.learningLanguage || '',
        hometown: user.hometown || '',
        currentCity: user.currentCity || '',
      });
      setImagePreview(user.photoURL || null);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let newPhotoURL = user.photoURL;

      // 1. 如果有新图片，先上传图片
      if (imageFile) {
        newPhotoURL = await uploadProfilePicture(user.uid, imageFile);
      }

      // 2. 准备要更新的文本数据
      const profileData = {
        ...formData,
        photoURL: newPhotoURL // 使用新的或旧的头像URL
      };
      
      // 3. 更新 Firestore 文档
      await updateUserProfile(user.uid, profileData);
      
      onProfileUpdate(); // 通知父组件更新成功
      onClose(); // 关闭模态框
    } catch (err) {
      setError('更新失败，请稍后再试。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start overflow-y-auto py-10" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">编辑个人资料</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 头像上传 */}
          <div className="flex items-center space-x-4">
            <img src={imagePreview || 'https://www.gravatar.com/avatar?d=mp'} alt="头像预览" className="w-20 h-20 rounded-full object-cover"/>
            <button type="button" onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
              更换头像
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden"/>
          </div>

          {/* 表单字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
              <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} className="mt-1 block w-full input-style" required />
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300">性别</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="mt-1 block w-full input-style">
                <option value="not-specified">不透露</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div>
              <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">出生日期</label>
              <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
             <div>
              <label htmlFor="occupation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">职业</label>
              <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="nationality" className="block text-sm font-medium text-gray-700 dark:text-gray-300">国籍</label>
              <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="learningLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">想学的语言</label>
              <input type="text" name="learningLanguage" value={formData.learningLanguage} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="hometown" className="block text-sm font-medium text-gray-700 dark:text-gray-300">我的家乡</label>
              <input type="text" name="hometown" value={formData.hometown} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="currentCity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">目前所在城市</label>
              <input type="text" name="currentCity" value={formData.currentCity} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
          </div>

          {/* 自我介绍 */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">自我介绍</label>
            <textarea name="bio" rows="4" value={formData.bio} onChange={handleChange} className="mt-1 block w-full input-style" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500" disabled={isLoading}>
              取消
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400" disabled={isLoading}>
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
