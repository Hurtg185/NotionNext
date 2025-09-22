// pages/profile/[userId].js (最终美化版 - 类似小红书/抖音主页)

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

import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// 帖子列表组件 (示例) (保持不变)
const PostList = ({ posts }) => {
  const router = useRouter();
  if (!posts || posts.length === 0) {
    return <p className="text-center text-gray-500">还没有发布任何帖子。</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      {posts.map(post => (
        <div 
          key={post.id} 
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push(`/forum/post/${post.id}`)}
        >
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{post.title}</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{post.content.substring(0, 100)}...</p>
        </div>
      ))}
    </div>
  );
};


const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  const { openDrawer } = useDrawer();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [tabContent, setTabContent] = useState([]);

  const isMyProfile = currentUser && currentUser.uid === userId;

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    setProfileUser(profileData);
    if (currentUser && currentUser.uid !== userId) {
      setIsFollowing(await checkFollowing(currentUser.uid, userId));
      setIsBlocked(await checkBlocked(currentUser.uid, userId));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUserProfile();
  }, [userId, currentUser]);

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

  
  const handleFollow = async () => {
    if (!currentUser) return;
    if (isFollowing) {
      await unfollowUser(currentUser.uid, userId);
    } else {
      await followUser(currentUser.uid, userId);
    }
    fetchUserProfile();
  };
  
  const handleBlock = async () => {
    if (!currentUser) return;
    if (isBlocked) {
      await unblockUser(currentUser.uid, userId);
    } else {
      if (window.confirm('确定要拉黑该用户吗？拉黑后将互相取关且无法看到对方动态。')) {
        await blockUser(currentUser.uid, userId);
      }
    }
    fetchUserProfile();
  };

  const handleStartChat = async () => {
    if (!currentUser) {
      alert('请先登录再发送私信！');
      return;
    }
    if (!profileUser || profileUser.id === currentUser.uid) return;
    const conversation = await startChat(currentUser.uid, profileUser.id);
    if (conversation) {
      openDrawer('chat', { conversation, chatId: conversation.id });
    } else {
      alert('开启对话失败，请稍后再试。');
    }
  };
  
  const handleProfileUpdate = () => {
    fetchUserProfile();
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return '很久以前';
    return dayjs(timestamp.toDate()).fromNow();
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return '';
    const birthDateObj = dayjs(birthDate);
    if (!birthDateObj.isValid()) return '无效日期';
    return dayjs().diff(birthDateObj, 'year');
  };


  if (loading) {
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }
  if (!profileUser) {
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
  }


  return (
    <LayoutBase>
      {/* 【核心修改】整个页面容器，移除 LayoutBase 默认 padding, 背景色由主题 body 决定 */}
      <div className="flex flex-col min-h-screen">
        
        {/* 【核心修改】顶部背景图区域 - 更高，背景更深沉，信息块浮动在其上 */}
        <div 
          className="relative w-full h-60 bg-cover bg-center flex flex-col justify-end p-4 text-white" // h-60 增加高度
          style={{ backgroundImage: profileUser.backgroundImageUrl ? `url(${profileUser.backgroundImageUrl})` : 'none' }}
        >
          {/* 半透明遮罩层，提升文字可读性 */}
          {profileUser.backgroundImageUrl && <div className="absolute inset-0 bg-black/50"></div>} {/* 更深的遮罩 */}
          {/* 如果没有背景图，显示一个默认的浅灰/深灰背景，与 body 颜色一致 */}
          {!profileUser.backgroundImageUrl && <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900"></div>}

          {/* 右上角编辑资料按钮 (如果是我自己的主页) */}
          {isMyProfile && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="absolute top-4 right-4 px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors z-20"
            >
              编辑资料
            </button>
          )}

          {/* 【核心修改】个人信息浮动块 - 在背景图内，头像左侧，资料右侧 */}
          <div className="relative z-10 flex items-end space-x-4">
            {/* 头像及在线状态 */}
            <div className="relative flex-shrink-0">
              <img 
                src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
                alt={profileUser.displayName} 
                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 shadow-lg object-cover" // 调整头像大小
              />
              {profileUser.isOnline && (
                <span
                  className="absolute bottom-0 right-0 block h-5 w-5 rounded-full border-3 border-white dark:border-gray-900 bg-green-500 animate-pulse" // 调整绿点大小
                  title="在线"
                />
              )}
              {/* 性别标志 - 定位在头像左上角 */}
              {profileUser.gender && profileUser.gender !== 'not-specified' && (
                <span className={`absolute top-0 left-0 p-1 rounded-full text-white text-xs ${profileUser.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'} flex items-center justify-center w-5 h-5`}>
                  <i className={`fas ${profileUser.gender === 'male' ? 'fa-male' : 'fa-female'}`}></i>
                </span>
              )}
            </div>

            {/* 右侧信息区 */}
            <div className="flex-grow min-w-0">
              <h1 className="text-3xl font-bold text-white text-shadow-lg mb-1 truncate">{profileUser.displayName}</h1>
              
              {/* 在线状态文本 */}
              <p className={`text-sm font-semibold ${profileUser.isOnline ? 'text-green-400' : 'text-gray-300'} text-shadow-lg`}>
                {profileUser.isOnline ? '在线' : `最后上线: ${formatLastSeen(profileUser.lastSeen)}`}
              </p>

              <p className="text-gray-300 text-shadow-lg text-sm truncate">@{profileUser.id?.substring(0, 8)}</p>
            </div>
          </div>
        </div>
        
        {/* 【核心修改】下方紧凑的个人详细信息和操作按钮 */}
        <div className="relative -mt-4 mx-auto w-full max-w-lg z-20 px-4"> {/* -mt-4 继续上移，减少与上方背景块的间距 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4"> {/* 新的白色卡片 */}
            
            {/* 关注/粉丝计数 */}
            <div className="flex justify-around items-center text-gray-800 dark:text-white mb-4">
              <div className="text-center">
                <div className="font-bold text-xl">{profileUser.followersCount || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">粉丝</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-xl">{profileUser.followingCount || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">关注</div>
              </div>
            </div>

            {/* 操作按钮 (如果不是自己的主页) */}
            {!isMyProfile && (
              <div className="flex space-x-3 justify-center mb-4">
                <button onClick={handleFollow} className={`px-4 py-2 rounded-full font-semibold text-sm transition-colors ${isFollowing ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                  {isFollowing ? '已关注' : '关注'}
                </button>
                <button onClick={handleStartChat} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm">
                  私信
                </button>
                <button onClick={handleBlock} className="px-3 py-2 text-gray-500 text-sm hover:text-red-500 bg-gray-100 dark:bg-gray-700 rounded-full">
                  {isBlocked ? '取消拉黑' : '拉黑'}
                </button>
              </div>
            )}
            
            {/* 个人资料详情 (更紧凑的网格布局) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-gray-600 dark:text-gray-400 text-sm mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              {profileUser.currentCity && <span className="flex items-center"><i className="fas fa-map-marker-alt mr-2 w-4 text-center"></i><span className="font-bold mr-1">常住:</span> {profileUser.currentCity}</span>}
              {profileUser.hometown && <span className="flex items-center"><i className="fas fa-home mr-2 w-4 text-center"></i><span className="font-bold mr-1">家乡:</span> {profileUser.hometown}</span>}
              {profileUser.occupation && <span className="flex items-center"><i className="fas fa-briefcase mr-2 w-4 text-center"></i><span className="font-bold mr-1">职业:</span> {profileUser.occupation}</span>}
              {profileUser.learningLanguage && <span className="flex items-center"><i className="fas fa-language mr-2 w-4 text-center"></i><span className="font-bold mr-1">在学:</span> {profileUser.learningLanguage}</span>}
              
              {profileUser.birthDate && (
                <span className="flex items-center">
                  <i className="fas fa-birthday-cake mr-2 w-4 text-center"></i>
                  <span className="font-bold mr-1">年龄:</span> {calculateAge(profileUser.birthDate)}岁
                </span>
              )}
              {profileUser.nationality && (
                <span className="flex items-center">
                  <i className="fas fa-flag mr-2 w-4 text-center"></i>
                  <span className="font-bold mr-1">国籍:</span> {profileUser.nationality}
                </span>
              )}
            </div>
          </div>
        </div>


        {/* 标签页 */}
        <div className="flex justify-around border-b border-gray-200 dark:border-gray-700 mt-8 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <button onClick={() => setActiveTab('dynamics')} className={`py-3 px-6 font-semibold ${activeTab === 'dynamics' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
            动态
          </button>
          <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
            帖子 ({profileUser.postsCount || 0})
          </button>
          {isMyProfile && (
            <>
              <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                收藏
              </button>
              <button onClick={() => setActiveTab('history')} className={`py-3 px-6 font-semibold ${activeTab === 'history' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                历史
              </button>
            </>
          )}
        </div>

        {/* 标签页内容 */}
        <div className="p-4 flex-grow">
          {activeTab === 'dynamics' && ( <p className="text-center text-gray-500">用户的动态将会在这里展示...</p> )}
          {activeTab === 'posts' && ( <PostList posts={tabContent} /> )}
          {activeTab === 'favorites' && isMyProfile && ( <p className="text-center text-gray-500">你的收藏列表...</p> )}
          {activeTab === 'history' && isMyProfile && ( <p className="text-center text-gray-500">你的浏览历史...</p> )}
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
