// pages/profile/[userId].js (根据截图风格修改后的版本)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, startChat } from '@/lib/chat';
import { 
  followUser, unfollowUser, checkFollowing, 
  blockUser, unblockUser, checkBlocked,
  getPostsByUser, getFavoritesByUser, getViewHistoryByUser
} from '@/lib/user';
import { useDrawer } from '@/lib/DrawerContext';
import EditProfileModal from '@/components/EditProfileModal';

// --- 【修改】PostList 组件，改为两列网格布局，更像小红书 ---
const PostList = ({ posts }) => {
  const router = useRouter();
  if (!posts || posts.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">还没有发布任何笔记。</p>;
  }
  return (
    // 使用 grid-cols-2 实现两列布局，gap-2 设置间距
    <div className="grid grid-cols-2 gap-2"> 
      {posts.map(post => (
        <div 
          key={post.id} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
          onClick={() => router.push(`/forum/post/${post.id}`)}
        >
          {/* 帖子图片，占据卡片主要区域 */}
          <div className="relative">
            <img src={post.imageUrl || '/images/placeholder.png'} alt={post.title} className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105" />
            {/* 置顶标签，如果帖子有 isPinned 属性 */}
            {post.isPinned && (
                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    置顶
                </div>
            )}
          </div>
          {/* 帖子标题，放在图片下方 */}
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
  const [activeTab, setActiveTab] = useState('notes'); // 默认标签改为'笔记'
  const [isEditing, setIsEditing] = useState(false);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);

  const isMyProfile = currentUser && currentUser.uid === userId;
  
  // 假设从数据库获取的用户数据结构如下
  // 你需要确保你的 getUserProfile 函数能返回这些数据
  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    
    // --- 【新增】为了模拟截图效果，我们在这里添加一些示例数据 ---
    // 在实际应用中，这些数据应该来自你的数据库
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
        // 使用一个真实的背景图 URL
        backgroundImageUrl: '/images/zhuyetu.jpg', 
        photoURL: profileData.photoURL || 'https://www.gravatar.com/avatar?d=mp',
        displayName: profileData.displayName || '爱尚壁纸',
        followersCount: profileData.followersCount || 185,
        followingCount: profileData.followingCount || 247,
        postsCount: profileData.postsCount || 10, // 假设有10篇笔记
    };

    setProfileUser({ ...profileData, ...mockData });

    if (currentUser && currentUser.uid !== userId) {
      setIsFollowing(await checkFollowing(currentUser.uid, userId));
    }
    setLoading(false);
  };


  useEffect(() => {
    fetchUserProfile();
  }, [userId, currentUser]);

  useEffect(() => {
    if (!userId) return;
    let unsubscribe;
    // --- 【修改】根据 activeTab 获取数据 ---
    if (activeTab === 'notes') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      unsubscribe = getFavoritesByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile]);

  
  const handleFollow = async () => {
    if (!currentUser) return;
    if (isFollowing) {
      await unfollowUser(currentUser.uid, userId);
    } else {
      await followUser(currentUser.uid, userId);
    }
    fetchUserProfile(); // 重新获取数据以更新粉丝数等
  };
  
  const handleStartChat = async () => {
      // 假设 startChat 和 openDrawer 功能已实现
      alert('私信功能待实现');
  };
  
  const handleProfileUpdate = () => {
    fetchUserProfile(); // 编辑后刷新数据
  };

  if (loading) {
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }
  if (!profileUser) {
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
  }

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen">
        
        {/* --- 【核心修改区域】 --- */}
        {/* 顶部背景图与个人信息整合区域 */}
        <div 
          className="relative w-full h-auto bg-cover bg-center flex flex-col justify-between p-4 text-white min-h-[380px]" // 增加最小高度
          style={{ backgroundImage: `url(${profileUser.backgroundImageUrl})` }}
        >
          {/* 半透明遮罩层 */}
          <div className="absolute inset-0 bg-black/40"></div>
          
          {/* 右上角编辑/更多按钮 (保持不变，但z-index确保在最上) */}
          <div className="relative z-10 self-end">
            {isMyProfile && (
              <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors">
                编辑资料
              </button>
            )}
            {/* 你可以在这里添加一个"更多"按钮 */}
          </div>

          {/* 主要信息区 */}
          <div className="relative z-10 mt-auto">
            {/* 上半部分：头像、昵称、ID、简介 */}
            <div className="flex items-start space-x-4 mb-4">
              <img 
                src={profileUser.photoURL}
                alt={profileUser.displayName} 
                className="w-20 h-20 rounded-full border-2 border-white/50 object-cover flex-shrink-0"
              />
              <div className="flex-grow min-w-0">
                <h1 className="text-2xl font-bold text-white text-shadow-lg truncate">{profileUser.displayName}</h1>
                <p className="text-gray-300 text-sm mt-1">小红书号: {profileUser.xiaohongshuId}</p>
                {/* 简介列表 */}
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

            {/* 中间部分：性别、地点等小标签 */}
            <div className="flex items-center space-x-2 mb-4 text-xs">
                {profileUser.gender && (
                    <span className={`px-2 py-1 rounded-full text-white flex items-center ${profileUser.gender === 'male' ? 'bg-blue-500/80' : 'bg-pink-500/80'}`}>
                        <i className={`fas ${profileUser.gender === 'male' ? 'fa-mars' : 'fa-venus'} mr-1`}></i>
                        {profileUser.gender === 'male' ? '男' : '女'}
                    </span>
                )}
                {profileUser.country && <span className="px-2 py-1 bg-white/20 rounded-full">{profileUser.country}</span>}
            </div>
            
            {/* 下半部分：统计数据和操作按钮 */}
            <div className="flex items-center justify-between">
              {/* 统计数据 */}
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
              
              {/* 操作按钮 */}
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
        {/* --- 核心修改区域结束 --- */}


        {/* 标签页 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="container mx-auto flex">
            {/* --- 【修改】标签名称 --- */}
            <button onClick={() => setActiveTab('notes')} className={`py-3 px-6 font-semibold ${activeTab === 'notes' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
              笔记 ({profileUser.postsCount || 0})
            </button>
            {isMyProfile && (
              <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                收藏
              </button>
            )}
            {/* 可以根据需要添加更多标签 */}
          </div>
        </div>

        {/* 标签页内容 */}
        <div className="container mx-auto p-2 md:p-4 flex-grow">
            {activeTab === 'notes' && ( <PostList posts={tabContent} /> )}
            {activeTab === 'favorites' && isMyProfile && ( <PostList posts={tabContent} /> /* 假设收藏也是帖子列表 */ )}
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
