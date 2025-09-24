// pages/profile/[userId].js (已将帖子列表修改为单列布局)

import React, [ useState, useEffect } from 'react';
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

// --- 【核心修改】PostList 组件，改为单列帖子列表布局 ---
const PostList = ({ posts, type, profileUser }) => {
  const router = useRouter();
  const emptyMessages = {
    posts: "还没有发布任何帖子。",
    favorites: "还没有收藏任何帖子。",
    footprints: "还没有留下任何足迹。"
  };
  if (!posts || posts.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{emptyMessages[type]}</p>;
  }
  
  // 主容器：从 grid 改为 space-y-4，实现单列垂直间距
  return (
    <div className="space-y-4">
      {posts.map(post => (
        // 帖子项：使用 flex 布局，包含头像、标题和信息
        <div
          key={post.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          onClick={() => router.push(`/forum/post/${post.id}`)}
        >
          <div className="flex items-start space-x-4">
            {/* 头像 */}
            <img 
              src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
              alt={profileUser.displayName} 
              className="w-11 h-11 rounded-full object-cover flex-shrink-0"
            />
            {/* 右侧内容区 */}
            <div className="flex-1 min-w-0">
              {/* 作者昵称 */}
              <p className="font-bold text-gray-800 dark:text-white truncate">{profileUser.displayName}</p>
              
              {/* 帖子标题 */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1 break-words">
                {post.title}
              </h3>
              
              {/* 帖子统计信息和日期 */}
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                <span>
                  <i className="far fa-heart mr-1"></i>
                  {post.likesCount || 0}
                </span>
                <span>
                  <i className="far fa-comment mr-1"></i>
                  {post.commentsCount || 0}
                </span>
                <span className="flex-grow text-right">
                  {post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : '刚刚'}
                </span>
              </div>
            </div>
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
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following');

  const isMyProfile = currentUser && currentUser.uid === userId;

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    setProfileUser(profileData);

    if (currentUser && currentUser.uid !== userId && profileData) {
      const followingStatus = await checkFollowing(currentUser.uid, userId);
      setIsFollowing(followingStatus);
    }
    setLoading(false);
  };

  useEffect(() => {
    setProfileUser(null);
    setActiveTab('posts');
    if(userId) fetchUserProfile();
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
    fetchUserProfile();
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
        {/* 背景和用户信息卡片 */}
        <div className="relative w-full h-auto bg-cover bg-center flex flex-col justify-between p-4 text-white min-h-[420px]"
          style={{ backgroundImage: `url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})` }}>
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
              <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-20 h-20 rounded-full border-2 border-white/50 object-cover flex-shrink-0"/>
              <div className="flex-grow min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{profileUser.displayName || '未命名用户'}</h1>
                {profileUser.socials && Object.keys(profileUser.socials).length > 0 && (
                    <div className="flex items-center space-x-3 mt-2">
                        {Object.entries(profileUser.socials).map(([key, value]) => value && (
                            <a key={key} href={`https://${key}.com/${value}`} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">
                                <i className={`${SOCIAL_ICONS[key]} text-xl`}></i>
                            </a>
                        ))}
                    </div>
                )}
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
                {profileUser.tags && profileUser.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-white/20 rounded-full">{tag}</span>
                ))}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                  <div className="font-bold text-lg">{profileUser.followingCount || 0}</div>
                  <div className="text-sm text-gray-300">关注</div>
                </button>
                <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                  <div className="font-bold text-lg">{profileUser.followersCount || 0}</div>
                  <div className="text-sm text-gray-300">粉丝</div>
                </button>
              </div>
              
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

        {/* 标签页和内容 */}
        <div className="container mx-auto px-2 md:px-4 py-4 flex-grow">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
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
                    {/* 【核心修改】传递 profileUser 以获取头像和昵称 */}
                    <PostList posts={tabContent} type={activeTab} profileUser={profileUser} />
                </div>
            </div>
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
