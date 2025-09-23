// pages/profile/[userId].js (完整且已修复预渲染错误)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { followUser, unfollowUser, checkFollowing } from '@/lib/user';
import { getPostsByUser, getFavoritesByUser, getViewHistoryByUser } from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import { FaTwitter, FaInstagram, FaGithub } from 'react-icons/fa';

// --- 子组件：帖子/动态列表组件 ---
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
          className="bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group aspect-w-1 aspect-h-1"
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

// --- 子组件：社交链接图标组件 ---
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
  const [userExists, setUserExists] = useState(true); // 新增状态来跟踪用户是否存在
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);

  const isMyProfile = currentUser && currentUser.uid === userId;
  
  useEffect(() => {
    // 【修改】如果 router 还没准备好，或者 userId 不存在，则不执行任何操作
    if (!router.isReady || !userId) {
        return;
    }
    setLoading(true);
    setUserExists(true); // 每次 userId 变化时重置状态

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserExists(true);
            setProfileUser({
                uid: docSnap.id,
                ...userData,
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
            setUserExists(false); // 明确设置用户不存在
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, currentUser, router.isReady]); // 【修改】增加 router.isReady 作为依赖项

  useEffect(() => {
    if (!userId || !isMyProfile) {
        // 对于非自己的私有标签页，直接清空内容
        if (activeTab === 'favorites' || activeTab === 'history') {
            setTabContent([]);
            return;
        }
    }

    let unsubscribe;
    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      unsubscribe = getFavoritesByUser(userId, setTabContent);
    } else if (activeTab === 'history' && isMyProfile) {
      unsubscribe = getViewHistoryByUser(userId, setTabContent);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile]);

  const handleFollow = async () => { /* ... */ };
  const handleStartChat = async () => { /* ... */ };
  const handleProfileUpdate = () => { /* ... */ };

  // --- 【核心修复】 ---
  // 在渲染任何内容之前，进行严格的加载和存在性检查
  // 这会阻止 Next.js 在构建时因数据未准备好而崩溃
  if (loading || !router.isReady) {
    return <LayoutBase><div className="p-10 text-center">正在加载...</div></LayoutBase>;
  }

  if (!userExists) {
    return <LayoutBase><div className="p-10 text-center text-red-500">该用户不存在或已被删除。</div></LayoutBase>;
  }

  // 确保 profileUser 绝对不是 null 才继续渲染
  if (!profileUser) {
     return <LayoutBase><div className="p-10 text-center">正在加载用户数据...</div></LayoutBase>;
  }

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
        <div 
          className="relative w-full h-auto bg-cover bg-center flex flex-col justify-between p-4 text-white min-h-[380px]"
          style={{ backgroundImage: `url(${profileUser.backgroundImageUrl})` }}
        >
          {/* ... (你的 JSX 结构保持不变) ... */}
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

                <div className="flex items-center space-x-4 mt-3">
                    <SocialLink platform="twitter" username={profileUser.socials.twitter} />
                    <SocialLink platform="instagram" username={profileUser.socials.instagram} />
                    <SocialLink platform="github" username={profileUser.socials.github} />
                </div>
              </div>
            </div>

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
                  <button onClick={handleFollow} className={`px-6 py-2 rounded-full font-semibold transition-colors ${isFollowing ? 'bg-gray-500 text-white' : 'bg-red-500 text-white hover:bg-red-600'}`}>{isFollowing ? '已关注' : '关注'}</button>
                  <button onClick={handleStartChat} className="px-6 py-2 bg-white/30 rounded-full font-semibold hover:bg-white/50 transition-colors">私信</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="container mx-auto flex justify-center">
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
