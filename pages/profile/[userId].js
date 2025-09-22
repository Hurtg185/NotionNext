// pages/profile/[userId].js (最终功能完整版 + 在线状态优化 + 新增功能)

import React, { useState, useEffect, useRef } from 'react';
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

// 【新增】导入 react-icons 用于性别图标
import { FaMars, FaVenus, FaGenderless } from 'react-icons/fa';

import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// 帖子列表组件 (示例)
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

  // 【新增】背景图片状态
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const fileInputRef = useRef(null);

  const isMyProfile = currentUser && currentUser.uid === userId;

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    setProfileUser(profileData);
    // 【新增】设置初始背景图 (如果用户已保存)
    if (profileData && profileData.backgroundURL) {
      setBackgroundUrl(profileData.backgroundURL);
    }
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

  // 【新增】处理背景图片上传
  const handleBackgroundChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundUrl(reader.result);
        // 在这里，您还可以添加将图片上传到服务器并保存URL的逻辑
        // 例如: await uploadBackground(currentUser.uid, file);
      };
      reader.readAsDataURL(file);
    }
  };

  // 【新增】点击背景区域触发文件选择
  const handleBackgroundClick = () => {
    if (isMyProfile) {
      fileInputRef.current.click();
    }
  };

  // 【新增】根据性别返回对应图标
  const getGenderIcon = (gender) => {
    switch (gender) {
      case 'male':
        return <FaMars className="text-blue-500" />;
      case 'female':
        return <FaVenus className="text-pink-500" />;
      default:
        return <FaGenderless className="text-gray-500" />;
    }
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
        {/* 【核心修改】背景部分 */}
        <div
          className="w-full h-48 bg-gradient-to-r from-blue-400 to-purple-500 bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: `url(${backgroundUrl || 'https://via.placeholder.com/600x200'})` }}
          onClick={handleBackgroundClick}
        >
          {/* 【新增】隐藏的文件输入框 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBackgroundChange}
            className="hidden"
            accept="image/*"
          />
        </div>

        <div className="flex flex-col items-center -mt-20 px-4 pb-10">

          <div className="relative">
            <img
              src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
              alt={profileUser.displayName}
              className="w-28 h-28 rounded-full border-4 border-white dark:border-gray-900 shadow-lg object-cover"
            />
            {profileUser.isOnline && (
              <span
                className="absolute bottom-1 right-1 block h-6 w-6 rounded-full border-4 border-white dark:border-gray-900 bg-green-500 animate-pulse"
                title="在线"
              />
            )}
          </div>

          {/* 【核心修改】将用户名和性别图标放在同一行 */}
          <div className="flex items-center mt-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{profileUser.displayName}</h1>
            <span className="ml-2 text-xl">{getGenderIcon(profileUser.gender)}</span>
          </div>

          <p className={`mt-1 text-sm font-semibold ${profileUser.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
            {profileUser.isOnline ? '在线' : `最后上线: ${formatLastSeen(profileUser.lastSeen)}`}
          </p>

          <p className="text-gray-500 dark:text-gray-400 mt-1">@{profileUser.id?.substring(0, 8)}</p>
          <p className="text-gray-700 dark:text-gray-300 text-center mt-2 px-6 max-w-xl">{profileUser.bio || '这个人很懒，什么都没写...'}</p>

          {/* 【核心修改】密集化个人资料显示 */}
          <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {profileUser.currentCity && <span>常住: {profileUser.currentCity}</span>}
            {profileUser.hometown && <span className="mx-2">|</span>}
            {profileUser.hometown && <span>家乡: {profileUser.hometown}</span>}
            <br />
            {profileUser.occupation && <span>职业: {profileUser.occupation}</span>}
            {profileUser.learningLanguage && <span className="mx-2">|</span>}
            {profileUser.learningLanguage && <span>在学: {profileUser.learningLanguage}</span>}
          </div>


          <div className="flex space-x-6 mt-4 text-gray-800 dark:text-white">
            <div><span className="font-bold">{profileUser.followersCount || 0}</span> 粉丝</div>
            <div><span className="font-bold">{profileUser.followingCount || 0}</span> 关注</div>
          </div>

          <div className="flex items-center space-x-4 mt-6">
            {isMyProfile ? (
              <button onClick={() => setIsEditing(true)} className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors">编辑资料</button>
            ) : (
              <>
                <button onClick={handleFollow} className={`px-6 py-3 rounded-full font-semibold transition-colors ${isFollowing ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                  {isFollowing ? '已关注' : '关注'}
                </button>
                <button onClick={handleStartChat} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  私信
                </button>
                <button onClick={handleBlock} className="text-gray-500 text-xs hover:text-red-500">
                  {isBlocked ? '取消拉黑' : '拉黑'}
                </button>
              </>
            )}
          </div>
        </div>

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

        <div className="p-4 flex-grow">
          {activeTab === 'dynamics' && (<p className="text-center text-gray-500">用户的动态将会在这里展示...</p>)}
          {activeTab === 'posts' && (<PostList posts={tabContent} />)}
          {activeTab === 'favorites' && isMyProfile && (<p className="text-center text-gray-500">你的收藏列表...</p>)}
          {activeTab === 'history' && isMyProfile && (<p className="text-center text-gray-500">你的浏览历史...</p>)}
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
