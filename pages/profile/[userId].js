// pages/profile/[userId].js (根据你的需求全新改版)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // 假设你的firebase实例在这里
import { followUser, unfollowUser, checkFollowing } from '@/lib/user'; // 假设这些函数已存在
import { getPostsByUser, getFavoritesByUser, getViewHistoryByUser } from '@/lib/user'; // 假设这些函数已存在
import EditProfileModal from '@/components/EditProfileModal';
import { FaTwitter, FaInstagram, FaGithub } from 'react-icons/fa'; // 引入社交图标

// --- 【新增】帖子/动态列表组件 ---
// 采用网格布局，更像小红书/Instagram
const ContentGrid = ({ items, type = 'post' }) => {
  const router = useRouter();
  if (!items || items.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">这里空空如也...</p>;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2"> 
      {items.map(item => (
        <div 
          key={item.id} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group aspect-w-1 aspect-h-1" // 保持1:1的比例
          onClick={() => router.push(`/forum/post/${item.id}`)}
        >
          <img 
            src={item.imageUrl || '/images/placeholder.png'} 
            alt={item.title} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
          />
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
            <h3 className="font-semibold text-sm text-white truncate">{item.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- 【新增】社交链接图标组件 ---
const SocialLink = ({ platform, username }) => {
    if (!username) return null;
    const platforms = {
        twitter: { icon: <FaTwitter />, url: `https://twitter.com/${username}` },
        instagram: { icon: <FaInstagram />, url: `https://instagram.com/${username}` },
        github: { icon: <FaGithub />, url: `https://github.com/${username}` },
    };
    const platformInfo = platforms[platform];
    if (!platformInfo) return null;

    return (
        <a href={platformInfo.url} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white text-xl">
            {platformInfo.icon}
        </a>
    );
};


const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 【修改】默认标签改为 'posts' (帖子)
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);

  const isMyProfile = currentUser && currentUser.uid === userId;
  
  // 【修改】使用 onSnapshot 实时监听用户数据变化
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            setProfileUser({
                ...userData,
                // 提供默认值，防止页面因缺少字段而崩溃
                photoURL: userData.photoURL || 'https://www.gravatar.com/avatar?d=mp',
                backgroundImageUrl: userData.backgroundImageUrl || '/images/default-bg.jpg',
                followersCount: userData.followersCount || 0,
                followingCount: userData.followingCount || 0,
                postsCount: userData.postsCount || 0,
                likesAndCollectionsCount: (userData.likesCount || 0) + (userData.collectionsCount || 0),
                tags: userData.tags || [],
                socials: userData.socials || {},
            });

            if (currentUser && currentUser.uid !== userId) {
                const followingStatus = await checkFollowing(currentUser.uid, userId);
                setIsFollowing(followingStatus);
            }
        } else {
            setProfileUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, currentUser]);

  // 【修改】根据 activeTab 获取对应的数据
  useEffect(() => {
    if (!userId) return;
    let unsubscribe;
    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      unsubscribe = getFavoritesByUser(userId, setTabContent);
    } else if (activeTab === 'history' && isMyProfile) {
      unsubscribe = getViewHistoryByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile]);

  const handleFollow = async () => { /* ... 关注/取关逻辑 ... */ };
  const handleStartChat = async () => { alert('私信功能待实现'); };
  const handleProfileUpdate = () => { /* 数据已通过 onSnapshot 实时更新，无需手动刷新 */ };

  if (loading) { /* ... 加载状态 ... */ }
  if (!profileUser) { /* ... 用户不存在状态 ... */ }

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
        <div 
          className="relative w-full h-auto bg-cover bg-center flex flex-col justify-between p-4 text-white min-h-[380px]"
          style={{ backgroundImage: `url(${profileUser.backgroundImageUrl})` }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          
          <div className="relative z-10 self-end">
            {isMyProfile && (
              <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors">
                编辑资料
              </button>
            )}
          </div>

          <div className="relative z-10 mt-auto">
            <div className="flex items-start space-x-4 mb-4">
              <img 
                src={profileUser.photoURL}
                alt={profileUser.displayName} 
                className="w-20 h-20 rounded-full border-2 border-white/50 object-cover flex-shrink-0"
              />
              <div className="flex-grow min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{profileUser.displayName || '未命名用户'}</h1>
                <p className="text-gray-300 text-sm mt-1">{profileUser.bio || '这位用户很神秘，什么都没留下...'}</p>

                {/* 【新增】社交链接 */}
                <div className="flex items-center space-x-4 mt-3">
                    <SocialLink platform="twitter" username={profileUser.socials.twitter} />
                    <SocialLink platform="instagram" username={profileUser.socials.instagram} />
                    <SocialLink platform="github" username={profileUser.socials.github} />
                </div>
              </div>
            </div>

            {/* 【新增】性格爱好标签 */}
            {profileUser.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {profileUser.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">{tag}</span>
                    ))}
                </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <div className="text-center"><div className="font-bold text-lg">{profileUser.followingCount}</div><div className="text-sm text-gray-300">关注</div></div>
                <div className="text-center"><div className="font-bold text-lg">{profileUser.followersCount}</div><div className="text-sm text-gray-300">粉丝</div></div>
                <div className="text-center"><div className="font-bold text-lg">{profileUser.likesAndCollectionsCount}</div><div className="text-sm text-gray-300">获赞与收藏</div></div>
              </div>
              {!isMyProfile && (
                <div className="flex space-x-2">
                  <button onClick={handleFollow} className="px-6 py-2 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors">{isFollowing ? '已关注' : '关注'}</button>
                  <button onClick={handleStartChat} className="px-6 py-2 bg-white/30 rounded-full font-semibold hover:bg-white/50 transition-colors">私信</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 【修改】标签页 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="container mx-auto flex justify-center">
            {/* 你可以保留 “动态” 的叫法，或者直接用 “帖子” */}
            <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
              帖子 ({profileUser.postsCount || 0})
            </button>
            {isMyProfile && (
              <>
                <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>收藏</button>
                <button onClick={() => setActiveTab('history')} className={`py-3 px-6 font-semibold ${activeTab === 'history' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>足迹</button>
              </>
            )}
          </div>
        </div>

        <div className="container mx-auto p-2 md:p-4 flex-grow">
            <ContentGrid items={tabContent} />
        </div>
      </div>
      
      {isEditing && (
        <EditProfileModal user={profileUser} onClose={() => setIsEditing(false)} onProfileUpdate={handleProfileUpdate} />
      )}
    </LayoutBase>
  );
};

export default ProfilePage;
```

#### 第 2 步：创建/更新编辑资料模态框 `components/EditProfileModal.js`

这个组件是关键。它不仅提供了编辑新功能的界面，还修复了 `undefined` 的 bug。

```javascript
// components/EditProfileModal.js (包含 bug 修复和新功能)

import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const EditProfileModal = ({ user, onClose, onProfileUpdate }) => {
  // 使用传入的 user 数据初始化 state
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [gender, setGender] = useState(user.gender || '');
  const [tags, setTags] = useState((user.tags || []).join(', ')); // 将数组转为逗号分隔的字符串
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
      
      // --- 【核心修复】 ---
      // 1. 创建一个基础数据对象
      const baseData = {
        displayName,
        bio,
        gender,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean), // 将字符串转回数组，并过滤空标签
        socials,
      };

      // 2. 创建一个最终要提交的对象
      const updatedData = { ...baseData };

      // 3. 只有当 URL 发生变化时才添加到提交对象中
      // 这样可以避免提交 `undefined` 或未改变的 URL
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

          {/* 【新增】性别选择 */}
          <div>
            <label className="block text-sm font-medium">性别</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full input-style">
              <option value="">不设置</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>

          {/* 【新增】性格/爱好标签 */}
          <div>
            <label className="block text-sm font-medium">爱好标签 (用逗号 , 分隔)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full input-style" placeholder="例如：摄影, 旅游, 编程" />
          </div>

          {/* 【新增】社交平台链接 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">社交链接 (只填用户名)</label>
            <div className="flex items-center space-x-2">
              <span className="w-24">Twitter</span>
              <input type="text" value={socials.twitter} onChange={(e) => handleSocialChange('twitter', e.target.value)} className="block w-full input-style" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-24">Instagram</span>
              <input type="text" value={socials.instagram} onChange={(e) => handleSocialChange('instagram', e.target.value)} className="block w-full input-style" />
            </div>
             <div className="flex items-center space-x-2">
              <span className="w-24">GitHub</span>
              <input type="text" value={socials.github} onChange={(e) => handleSocialChange('github', e.target.value)} className="block w-full input-style" />
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
       {/* 建议在 global.css 中定义一些通用样式 */}
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
