// components/EditProfileModal.js (最终修复版 - 包含背景图上传 UI)

import { useState, useEffect, useRef } from 'react';
import { updateUserProfile, uploadProfilePicture, uploadUserBackground } from '@/lib/user'; // 确保导入 uploadUserBackground

const EditProfileModal = ({ user, onClose, onProfileUpdate }) => {
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState(null); // 头像预览
  const [imageFile, setImageFile] = useState(null);       // 头像文件
  const fileInputRef = useRef(null);

  const [backgroundPreview, setBackgroundPreview] = useState(null); // 【新增】背景图预览
  const [backgroundFile, setBackgroundFile] = useState(null);       // 【新增】背景图文件
  const backgroundInputRef = useRef(null);                          // 【新增】背景图文件输入 ref


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
      setBackgroundPreview(user.backgroundImageUrl || null); // 【新增】初始化背景图预览
    }
  }, [user]);

  // 【新增】useEffect 来控制 body 样式 (防止滚动，已存在)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('modal-open');
      return () => {
        document.body.classList.remove('modal-open');
      };
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 文件大小限制 5MB
          setError("头像图片文件不能超过 5MB");
          return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); // 本地预览
      setError('');
    }
  };

  // 【新增】处理背景图文件选择
  const handleBackgroundChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 背景图也限制 5MB
          setError("背景图片文件不能超过 5MB");
          return;
      }
      setBackgroundFile(file);
      setBackgroundPreview(URL.createObjectURL(file)); // 本地预览
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!user || !user.uid) { // 检查用户ID，避免上传失败
      setError('用户信息无效，无法保存。请尝试重新登录。');
      setIsLoading(false);
      return;
    }

    try {
      let newPhotoURL = user.photoURL;
      let newBackgroundURL = user.backgroundImageUrl;

      if (imageFile) {
        newPhotoURL = await uploadProfilePicture(user.uid, imageFile);
        console.log('DEBUG [EditProfileModal]: New photoURL uploaded:', newPhotoURL);
      }
      if (backgroundFile) {
        newBackgroundURL = await uploadUserBackground(user.uid, backgroundFile);
        console.log('DEBUG [EditProfileModal]: New backgroundURL uploaded:', newBackgroundURL);
      }

      const profileData = {
        ...formData,
        photoURL: newPhotoURL,
        backgroundImageUrl: newBackgroundURL
      };
      
      await updateUserProfile(user.uid, profileData);
      
      onProfileUpdate();
      onClose();
    } catch (err) {
      setError('更新失败，请稍后再试。' + err.message);
      console.error("ERROR [EditProfileModal]: handleSubmit failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-center items-start overflow-y-auto py-10" onClick={onClose}>
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-lg shadow-xl p-6 w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">编辑个人资料</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 头像上传 */}
          <div className="flex items-center space-x-4">
            <img src={imagePreview || 'https://www.gravatar.com/avatar?d=mp'} alt="头像预览" className="w-20 h-20 rounded-full object-cover"/>
            <button type="button" onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
              更换头像
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/png, image/jpeg, image/gif" className="hidden"/>
          </div>

          {/* 【核心新增】背景图上传 UI */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">个人主页背景图</label>
            <div className="flex items-center space-x-4">
              <div className="w-32 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 border border-gray-300 dark:border-gray-600">
                {backgroundPreview ? (
                  <img src={backgroundPreview} alt="背景图预览" className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">无背景图</div>
                )}
              </div>
              <button type="button" onClick={() => backgroundInputRef.current.click()} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                更换背景
              </button>
              <input type="file" ref={backgroundInputRef} onChange={handleBackgroundChange} accept="image/png, image/jpeg, image/gif" className="hidden"/>
            </div>
          </div>


          {/* 表单字段 (保持不变) */}
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
              <input type="text" name="occupation" placeholder="例如：学生、工程师" value={formData.occupation} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="nationality" className="block text-sm font-medium text-gray-700 dark:text-gray-300">国籍</label>
              <input type="text" name="nationality" placeholder="例如：中国" value={formData.nationality} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="learningLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">想学的语言</label>
              <input type="text" name="learningLanguage" placeholder="例如：英语、日语" value={formData.learningLanguage} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="hometown" className="block text-sm font-medium text-gray-700 dark:text-gray-300">我的家乡</label>
              <input type="text" name="hometown" placeholder="例如：北京" value={formData.hometown} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
            <div>
              <label htmlFor="currentCity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">目前所在城市</label>
              <input type="text" name="currentCity" value={formData.currentCity} onChange={handleChange} className="mt-1 block w-full input-style" />
            </div>
          </div>

          {/* 自我介绍 */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">自我介绍</label>
            <textarea name="bio" rows="4" placeholder="介绍一下自己吧..." value={formData.bio} onChange={handleChange} className="mt-1 block w-full input-style" />
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
