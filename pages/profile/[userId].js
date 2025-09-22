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
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* 【核心修改】顶部背景图区域 */}
        <div 
          className="relative w-full h-60 bg-cover bg-center flex items-end justify-between p-4" // h-60 增加高度
          style={{ backgroundImage: profileUser.backgroundImageUrl ? `url(${profileUser.backgroundImageUrl})` : 'none' }}
        >
          {/* 半透明遮罩层，提升文字可读性 */}
          {profileUser.backgroundImageUrl && <div className="absolute inset-0 bg-black/30"></div>}
          {!profileUser.backgroundImageUrl && <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500"></div>} {/* 如果没有背景图，显示默认渐变色 */}

          {/* 【新增】右上角编辑资料按钮 (如果是我自己的主页) */}
          {isMyProfile && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="absolute top-4 right-4 px-4 py-2 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors z-20"
            >
              编辑资料
            </button>
          )}
        </div>
        
        {/* 【核心修改】个人资料信息区域，置于背景图上方并紧凑布局 */}
        <div className="relative flex flex-col items-center -mt-20 px-4 pb-10 z-10 w-full max-w-xl mx-auto"> {/* -mt-20 抬高头像 */}
          
          {/* 头像及在线状态 */}
          <div className="relative mb-3"> {/* mb-3 减少与名字的间距 */}
            <img 
              src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
              alt={profileUser.displayName} 
              className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-900 shadow-lg object-cover" // w-32 h-32 放大头像
            />
            {profileUser.isOnline && (
              <span
                className="absolute bottom-1 right-1 block h-7 w-7 rounded-full border-4 border-white dark:border-gray-900 bg-green-500 animate-pulse" // 放大绿点
                title="在线"
              />
            )}
            {/* 【新增】性别标志 */}
            {profileUser.gender && profileUser.gender !== 'not-specified' && (
              <span className={`absolute top-0 right-0 p-1 rounded-full text-white text-xs ${profileUser.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                <i className={`fas ${profileUser.gender === 'male' ? 'fa-male' : 'fa-female'}`}></i>
              </span>
            )}
          </div>
          
          <h1 className="text-4xl font-bold text-white text-shadow-lg mb-0">{profileUser.displayName}</h1> {/* text-4xl 放大，text-white text-shadow-lg */}
          
          {/* 在线状态文本 */}
          <p className={`mt-1 text-base font-semibold ${profileUser.isOnline ? 'text-green-400' : 'text-gray-300'} text-shadow-lg`}> {/* text-base 放大，颜色和阴影 */}
            {profileUser.isOnline ? '在线' : `最后上线: ${formatLastSeen(profileUser.lastSeen)}`}
          </p>

          <p className="text-gray-300 text-shadow-lg mt-1">@{profileUser.id?.substring(0, 8)}</p> {/* text-gray-300 text-shadow-lg */}
          
          {/* 个人简介 */}
          <p className="text-white text-center mt-3 px-6 text-shadow-lg max-w-xl">{profileUser.bio || '这个人很懒，什么都没写...'}</p>
          
          {/* 【修改】更紧凑的个人信息网格布局 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-4 text-white text-sm w-full bg-black/30 backdrop-blur-sm rounded-lg p-3 text-shadow-lg"> {/* 增加背景、模糊、圆角 */}
            {profileUser.currentCity && <span className="flex items-center"><i className="fas fa-map-marker-alt mr-2 w-4 text-center text-gray-300"></i><span className="font-bold mr-1">常住:</span> {profileUser.currentCity}</span>}
            {profileUser.hometown && <span className="flex items-center"><i className="fas fa-home mr-2 w-4 text-center text-gray-300"></i><span className="font-bold mr-1">家乡:</span> {profileUser.hometown}</span>}
            {profileUser.occupation && <span className="flex items-center"><i className="fas fa-briefcase mr-2 w-4 text-center text-gray-300"></i><span className="font-bold mr-1">职业:</span> {profileUser.occupation}</span>}
            {profileUser.learningLanguage && <span className="flex items-center"><i className="fas fa-language mr-2 w-4 text-center text-gray-300"></i><span className="font-bold mr-1">在学:</span> {profileUser.learningLanguage}</span>}
            
            {profileUser.birthDate && (
              <span className="flex items-center">
                <i className="fas fa-birthday-cake mr-2 w-4 text-center text-gray-300"></i>
                <span className="font-bold mr-1">年龄:</span> {calculateAge(profileUser.birthDate)}岁
              </span>
            )}
            {/* 性别标志已移到头像旁边，这里不再显示 */}
          </div>

          {/* 关注/粉丝计数 */}
          <div className="flex justify-center space-x-6 mt-4 w-full bg-white/30 backdrop-blur-sm rounded-lg p-3 text-shadow-lg text-white font-bold text-lg"> {/* 放大计数，增加背景 */}
            <div className="text-center">
              <div>{profileUser.followersCount || 0}</div>
              <div className="text-sm">粉丝</div>
            </div>
            <div className="text-center">
              <div>{profileUser.followingCount || 0}</div>
              <div className="text-sm">关注</div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-4 mt-6">
            {!isMyProfile ? ( // 如果是别人主页，显示关注/私信/拉黑
              <>
                <button onClick={handleFollow} className={`px-6 py-3 rounded-full font-semibold transition-colors ${isFollowing ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                  {isFollowing ? '已关注' : '关注'}
                </button>
                <button onClick={handleStartChat} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  私信
                </button>
                <button onClick={handleBlock} className="text-white text-xs hover:text-red-300 bg-black/30 rounded-full px-4 py-2 backdrop-blur-sm">
                  {isBlocked ? '取消拉黑' : '拉黑'}
                </button>
              </>
            ) : (
                // 自己的主页，编辑资料按钮已移到右上角
                null
            )}
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
