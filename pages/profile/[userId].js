// pages/profile/[userId].js (已根据您的所有需求修改和增强)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import {
  getUserProfile,
  getPostsByUser,
  getFavoritesByUser,
  getViewHistoryByUser,
  followUser,
  unfollowUser,
  checkFollowing,
  startChat
} from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- 【修改】PostList 组件，改为两列网格布局 ---
const PostList = ({ posts, type }) => {
  const router = useRouter();
  const emptyMessages = {
    posts: "还没有发布任何帖子。",
    favorites: "还没有收藏任何帖子。",
    footprints: "还没有留下任何足迹。"
  };
  if (!posts || posts.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{emptyMessages[type]}</p>;
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
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{post.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};

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
  const [activeTab, setActiveTab] = useState('posts'); // 默认标签改为'帖子'
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  // 【新增】关注/粉丝列表弹窗状态
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following'); // 'following' or 'followers'

  // 【核心修复】将 isMyProfile 变为一个 memoized 或静态变量，在数据加载后确定
  const isMyProfile = currentUser && currentUser.uid === userId;

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    setProfileUser(profileData);

    // 【核心修复】仅在非自己主页时检查关注状态
    if (currentUser && currentUser.uid !== userId) {
      const followingStatus = await checkFollowing(currentUser.uid, userId);
      setIsFollowing(followingStatus);
    }
    setLoading(false);
  };

  useEffect(() => {
    // userId 变化时，重置所有状态
    setProfileUser(null);
    setActiveTab('posts');
    fetchUserProfile();
  }, [userId, currentUser]);

  useEffect(() => {
    if (!userId || !profileUser) return;
    
    let unsubscribe;
    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      getFavoritesByUser(userId, setTabContent);
    } else if (activeTab === 'footprints' && isMyProfile) {
      getViewHistoryByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile, profileUser]);

  const handleFollow = async () => {
    if (!currentUser || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, userId);
      } else {
        await followUser(currentUser.uid, userId);
      }
      // 关注后立即更新状态和页面数据
      setIsFollowing(!isFollowing);
      fetchUserProfile();
    } catch (error) {
      console.error("关注/取关失败:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleOpenFollowModal = (type) => {
    setModalType(type);
    setShowFollowModal(true);
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
        <div
          className="relative w-full h-auto bg-cover bg-center flex flex-col justify-between p-4 text-white min-h-[420px]"
          style={{ backgroundImage: `url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})` }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          
          <div className="relative z-10 self-end">
            {isMyProfile ? (
              <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors">
                编辑资料
              </button>
            ) : null}
          </div>

          <div className="relative z-10 mt-auto">
            <div className="flex items-start space-x-4 mb-4">
              <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-20 h-20 rounded-full border-2 border-white/50 object-cover flex-shrink-0"/>
              <div className="flex-grow min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{profileUser.displayName || '未命名用户'}</h1>
                {/* 【新增】社交链接 */}
                {profileUser.socials && Object.keys(profileUser.socials).length > 0 && (
                    <div className="flex items-center space-x-3 mt-2">
                        {Object.entries(profileUser.socials).map(([key, value]) => value && (
                            <a key={key} href={`https://${key}.com/${value}`} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">
                                <i className={`${SOCIAL_ICONS[key]} text-xl`}></i>
                            </a>
                        ))}
                    </div>
                )}
                {/* 自我介绍 */}
                <p className="text-sm mt-2 text-white/90">{profileUser.bio || '这位用户很神秘，什么都没留下...'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                {profileUser.gender && profileUser.gender !== 'not_specified' && (
                    <span className={`px-2 py-1 rounded-full text-white flex items-center ${profileUser.gender === 'male' ? 'bg-blue-500/80' : 'bg-pink-500/80'}`}>
                        <i className={`fas ${profileUser.gender === 'male' ? 'fa-mars' : 'fa-venus'} mr-1`}></i>
                        {profileUser.gender === 'male' ? '男' : '女'}
                    </span>
                )}
                {/* 【新增】性格爱好标签 */}
                {profileUser.tags && profileUser.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-white/20 rounded-full">{tag}</span>
                ))}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-5">
                {/* 【修改】关注和粉丝数可点击 */}
                <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                  <div className="font-bold text-lg">{profileUser.followingCount || 0}</div>
                  <div className="text-sm text-gray-300">关注</div>
                </button>
                <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                  <div className="font-bold text-lg">{profileUser.followersCount || 0}</div>
                  <div className="text-sm text-gray-300">粉丝</div>
                </button>
              </div>
              
              {/* 【核心修复】只有在加载完毕且非本人主页时才显示按钮 */}
              {!loading && !isMyProfile && (
                <div className="flex space-x-2">
                  <button onClick={handleFollow} disabled={isFollowLoading} className="px-6 py-2 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors disabled:opacity-70">
                    {isFollowing ? '已关注' : '关注'}
                  </button>
                  <button onClick={() => startChat(userId)} className="px-6 py-2 bg-white/30 rounded-full font-semibold hover:bg-white/50 transition-colors">
                    私信
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="container mx-auto flex">
            {/* 【修改】标签页名称和内容 */}
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
        </div>

        <div className="container mx-auto p-2 md:p-4 flex-grow">
            <PostList posts={tabContent} type={activeTab} />
        </div>
      </div>
      
      {isMyProfile && isEditing && (
        <EditProfileModal onClose={() => setIsEditing(false)} onProfileUpdate={handleProfileUpdate} />
      )}
      
      {showFollowModal && (
        <FollowListModal userId={userId} type={modalType} onClose={() => setShowFollowModal(false)} />
      )}
    </LayoutBase>
  );
};

export default ProfilePage;
