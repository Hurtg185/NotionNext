// pages/profile/[userId].js (最终修复和功能增强版)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import {
  getUserProfile,
  getPostsByUser,
  getFavoritesByUser,
  getViewHistoryByUser,
  getDynamicsByUser,
  followUser,
  unfollowUser,
  checkFollowing,
} from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- PostList 和 DynamicsList 组件保持不变 ---
const PostList = ({ posts, type, profileUser }) => { /* ... 此组件代码保持不变 ... */ };
const DynamicsList = ({ dynamics, profileUser }) => { /* ... 此组件代码保持不变 ... */ };

const SOCIAL_ICONS = {
    weibo: 'fab fa-weibo',
    github: 'fab fa-github',
    twitter: 'fab fa-twitter',
    instagram: 'fab fa-instagram',
};

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dynamics'); // 默认显示动态
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following');

  const isMyProfile = currentUser && currentUser.uid === userId;

  // 【核心修复】重写数据获取函数，增加错误处理和 finally 块
  const fetchUserProfile = async () => {
    if (!userId) {
      setLoading(false); // 如果没有 userId，直接停止加载
      return;
    }
    
    setLoading(true);
    try {
      // 尝试获取用户资料
      const profileData = await getUserProfile(userId);
      if (profileData) {
        setProfileUser(profileData);
        // 如果是查看他人主页，则检查关注状态
        if (currentUser && currentUser.uid !== userId) {
          const followingStatus = await checkFollowing(currentUser.uid, userId);
          setIsFollowing(followingStatus);
        }
      } else {
        // 用户不存在
        setProfileUser(null);
      }
    } catch (error) {
      // 如果获取过程中发生任何错误
      console.error("获取用户资料失败:", error);
      setProfileUser(null); // 将用户设置为 null 以显示错误信息
    } finally {
      // 无论成功还是失败，这个块都会执行
      setLoading(false); // 保证加载状态最终会被关闭
    }
  };

  useEffect(() => {
    // 当 userId 变化时，重置状态并重新获取数据
    setProfileUser(null);
    setActiveTab('dynamics');
    fetchUserProfile();
  }, [userId, currentUser]);

  useEffect(() => {
    if (!userId || !profileUser) {
      setTabContent([]); // 如果没有用户，清空标签页内容
      return;
    };
    
    let unsubscribe;
    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'dynamics') {
      unsubscribe = getDynamicsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      getFavoritesByUser(userId, setTabContent);
    } else if (activeTab === 'footprints' && isMyProfile) {
      getViewHistoryByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    // 组件卸载时取消订阅
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab, userId, isMyProfile, profileUser]);

  const handleFollow = async () => { /* ... 此函数代码保持不变 ... */ };
  const handleStartChat = () => { /* ... 此函数代码保持不变 ... */ };
  const handleOpenFollowModal = (type) => { /* ... 此函数代码保持不变 ... */ };
  const handleProfileUpdate = () => { /* ... 此函数代码保持不变 ... */ };

  // --- UI 渲染逻辑 ---

  // 首先处理加载状态
  if (loading) {
    return <LayoutBase><div className="flex justify-center items-center h-screen">正在加载用户资料...</div></LayoutBase>;
  }

  // 加载结束后，如果用户不存在，显示错误信息
  if (!profileUser) {
    return <LayoutBase><div className="flex justify-center items-center h-screen text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
  }

  // 正常渲染用户主页
  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="relative w-full h-[33vh] min-h-[250px] bg-cover bg-center" style={{ backgroundImage: `url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})` }}>
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute top-4 right-4 z-10">
            {isMyProfile && (
              <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors">
                编辑资料
              </button>
            )}
          </div>
        </div>
        
        <div className="container mx-auto px-4 -mt-16">
            <div className="relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
                <div className="flex justify-between items-start">
                    <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 object-cover" />
                    {!isMyProfile && (
                        <div className="flex space-x-2 mt-4">
                            <button onClick={handleFollow} disabled={isFollowLoading} className="px-6 py-2 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors disabled:opacity-70">
                                {isFollowing ? '已关注' : '关注'}
                            </button>
                            <button onClick={handleStartChat} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                                私信
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="mt-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{profileUser.displayName || '未命名用户'}</h1>
                </div>

                <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{profileUser.bio || '这位用户很神秘，什么都没留下...'}</p>
                
                <div className="flex items-center space-x-5 mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                        <div className="font-bold text-lg">{profileUser.followingCount || 0}</div>
                        <div className="text-sm text-gray-500">关注</div>
                    </button>
                    <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                        <div className="font-bold text-lg">{profileUser.followersCount || 0}</div>
                        <div className="text-sm text-gray-500">粉丝</div>
                    </button>
                </div>
            </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 py-4 flex-grow">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
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
                        <button onClick={() => setActiveTab('footprints')} className={`py-3 px-6 font-semibold ${activeTab === 'footprints' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                        足迹
                        </button>
                    </>
                    )}
                </div>
                
                <div className="p-2 md:p-4">
                    {activeTab === 'posts' && <PostList posts={tabContent} type={activeTab} profileUser={profileUser} />}
                    {activeTab === 'dynamics' && <DynamicsList dynamics={tabContent} profileUser={profileUser} />}
                    {/* ... 其他标签页内容渲染保持不变 ... */}
                </div>
            </div>
        </div>
      </div>
      
      {isMyProfile && isEditing && (<EditProfileModal onClose={() => setIsEditing(false)} onProfileUpdate={handleProfileUpdate} />)}
      {showFollowModal && (<FollowListModal userId={userId} type={modalType} onClose={() => setShowFollowModal(false)} />)}
    </LayoutBase>
  );
};

export default ProfilePage;
