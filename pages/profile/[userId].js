// pages/profile/[userId].js (最终修复版 - 单文件方案)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, startChat } from '@/lib/chat';
import { 
  followUser, unfollowUser, checkFollowing, 
  getPostsByUser, getFavoritesByUser
} from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';

// --- PostList 组件保持不变 ---
const PostList = ({ posts }) => {
  const router = useRouter();
  if (!posts || posts.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">还没有发布任何笔记。</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2"> 
      {posts.map(post => (
        <div 
          key={post.id} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
          onClick={() => router.push(`/forum/post/${post.id}`)}
        >
          <div className="relative">
            <img src={post.imageUrl || '/images/placeholder.png'} alt={post.title} className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105" />
            {post.isPinned && (
                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    置顶
                </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{post.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};


const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes');
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  
  // 【核心修复】新增一个状态，用于判断是否在客户端环境
  const [isClient, setIsClient] = useState(false);
  
  // 这个 useEffect 只在客户端运行时执行一次，将 isClient 设为 true
  useEffect(() => {
    setIsClient(true);
  }, []);

  const isMyProfile = currentUser && currentUser.uid === userId;

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);

    if (!profileData) {
        setProfileUser(null);
        setLoading(false);
        return;
    }

    const mockData = {
        xiaohongshuId: '679432589',
        bioItems: [
            { icon: '🌻', text: 'AI绘画||部分为摄影作品' },
            { icon: '🌻', text: '持续更新★风格不定' },
            { icon: '🌻', text: '礼貌四连★评论区找我取图' },
            { icon: '🌻', text: '可定制' }
        ],
        gender: 'female',
        country: '中国',
        likesAndCollectionsCount: 3754,
        backgroundImageUrl: '/images/zhuyetu.jpg', 
        photoURL: profileData.photoURL || 'https://www.gravatar.com/avatar?d=mp',
        displayName: profileData.displayName || '爱尚壁纸',
        followersCount: profileData.followersCount || 185,
        followingCount: profileData.followingCount || 247,
        postsCount: profileData.postsCount || 10,
    };

    setProfileUser({ ...profileData, ...mockData });

    if (currentUser && currentUser.uid !== userId) {
      setIsFollowing(await checkFollowing(currentUser.uid, userId));
    }
    setLoading(false);
  };

  useEffect(() => {
    // 确保在客户端和 router 准备好之后再获取数据
    if (isClient && router.isReady) {
      fetchUserProfile();
    }
  }, [userId, currentUser, isClient, router.isReady]);

  useEffect(() => {
    if (!userId || !isClient) return;
    let unsubscribe;
    if (activeTab === 'notes') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      unsubscribe = getFavoritesByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile, isClient]);

  const handleFollow = async () => { /* ... */ };
  const handleStartChat = async () => { /* ... */ };
  const handleProfileUpdate = () => { fetchUserProfile(); };

  // 【核心修复】在返回 JSX 之前，增加 isClient 的判断
  // 如果不是客户端环境（即在服务器构建时），直接返回一个简单的加载占位符
  if (!isClient) {
    return (
        <LayoutBase>
            <div className="p-10 text-center">加载页面中...</div>
        </LayoutBase>
    );
  }

  // --- 以下是只有在客户端才会执行的渲染逻辑 ---

  if (loading) {
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }
  if (!profileUser) {
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
  }

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen">
        
        {/* --- 你的个人主页 JSX 保持不变 --- */}
        <div 
          className="relative w-full h-auto bg-cover bg-center flex flex-col justify-between p-4 text-white min-h-[380px]"
          style={{ backgroundImage: `url(${profileUser.backgroundImageUrl})` }}
        >
          {/* ... (你的完整 JSX 代码) ... */}
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
                <h1 className="text-2xl font-bold text-white text-shadow-lg truncate">{profileUser.displayName}</h1>
                <p className="text-gray-300 text-sm mt-1">小红书号: {profileUser.xiaohongshuId}</p>
                <div className="mt-3 space-y-1 text-sm">
                  {profileUser.bioItems.map((item, index) => (
                    <div key={index} className="flex items-center">
                      <span>{item.icon}</span>
                      <p className="ml-2 text-white">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-4 text-xs">
                {profileUser.gender && (
                    <span className={`px-2 py-1 rounded-full text-white flex items-center ${profileUser.gender === 'male' ? 'bg-blue-500/80' : 'bg-pink-500/80'}`}>
                        <i className={`fas ${profileUser.gender === 'male' ? 'fa-mars' : 'fa-venus'} mr-1`}></i>
                        {profileUser.gender === 'male' ? '男' : '女'}
                    </span>
                )}
                {profileUser.country && <span className="px-2 py-1 bg-white/20 rounded-full">{profileUser.country}</span>}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <div className="text-center">
                  <div className="font-bold text-lg">{profileUser.followingCount}</div>
                  <div className="text-sm text-gray-300">关注</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{profileUser.followersCount}</div>
                  <div className="text-sm text-gray-300">粉丝</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{profileUser.likesAndCollectionsCount}</div>
                  <div className="text-sm text-gray-300">获赞与收藏</div>
                </div>
              </div>
              
              {!isMyProfile && (
                <div className="flex space-x-2">
                  <button onClick={handleFollow} className="px-6 py-2 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors">
                    {isFollowing ? '已关注' : '关注'}
                  </button>
                  <button onClick={handleStartChat} className="px-6 py-2 bg-white/30 rounded-full font-semibold hover:bg-white/50 transition-colors">
                    私信
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="container mx-auto flex">
            <button onClick={() => setActiveTab('notes')} className={`py-3 px-6 font-semibold ${activeTab === 'notes' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
              笔记 ({profileUser.postsCount || 0})
            </button>
            {isMyProfile && (
              <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                收藏
              </button>
            )}
          </div>
        </div>

        {/* 标签页内容 */}
        <div className="container mx-auto p-2 md:p-4 flex-grow">
            {activeTab === 'notes' && ( <PostList posts={tabContent} /> )}
            {activeTab === 'favorites' && isMyProfile && ( <PostList posts={tabContent} /> )}
        </div>
      </div>
      
      {isEditing && (
        <EditProfileModal
          user={currentUser}
          onClose={() => setIsEditing(false)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </LayoutBase>
  );
};

export default ProfilePage;
