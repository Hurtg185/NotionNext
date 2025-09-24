// pages/profile/[userId].js (最终修复和功能增强版)

import React, { useState, useEffect } from 'react'; // 【修复】修正了 import 语法
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import {
  getUserProfile,
  getPostsByUser,
  getFavoritesByUser,
  getViewHistoryByUser,
  getDynamicsByUser, // 【新增】导入获取动态的函数
  followUser,
  unfollowUser,
  checkFollowing,
} from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- PostList 组件保持单列帖子布局 ---
const PostList = ({ posts, type, profileUser }) => {
  // ... 此组件代码保持不变 ...
};

// --- 【新增】DynamicsList 组件，用于展示新的“动态”内容 ---
const DynamicsList = ({ dynamics, profileUser }) => {
    const router = useRouter();
    if (!dynamics || dynamics.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">还没有发布任何动态。</p>;
    }
    return (
        <div className="space-y-4">
            {dynamics.map(item => (
                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center space-x-3 mb-3">
                        <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                            <p className="font-bold text-gray-800 dark:text-white">{profileUser.displayName}</p>
                            <p className="text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt.toDate()).toLocaleString() : '刚刚'}</p>
                        </div>
                    </div>
                    {/* 动态文本内容 */}
                    {item.text && <p className="text-gray-700 dark:text-gray-300 mb-3">{item.text}</p>}
                    {/* 动态图片 */}
                    {item.imageUrl && <img src={item.imageUrl} alt="动态图片" className="w-full rounded-lg object-cover" />}
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

  const fetchUserProfile = async () => { /* ... 此函数代码保持不变 ... */ };

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
    } else if (activeTab === 'dynamics') { // 【新增】处理“动态”标签
      unsubscribe = getDynamicsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      getFavoritesByUser(userId, setTabContent);
    } else if (activeTab === 'footprints' && isMyProfile) {
      getViewHistoryByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile, profileUser]);

  const handleFollow = async () => { /* ... 此函数代码保持不变 ... */ };
  
  // 【修复】为私信按钮添加实际的导航功能
  const handleStartChat = () => {
      if (!userId) return;
      // 跳转到与该用户的聊天页面，你需要创建这个页面
      router.push(`/messages/${userId}`);
  };

  const handleOpenFollowModal = (type) => { /* ... 此函数代码保持不变 ... */ };
  const handleProfileUpdate = () => { /* ... 此函数代码保持不变 ... */ };

  if (loading) return <LayoutBase><div className="p-10 text-center">正在加载...</div></LayoutBase>;
  if (!profileUser) return <LayoutBase><div className="p-10 text-center text-red-500">用户不存在。</div></LayoutBase>;

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* 【UI修改】背景图高度改为屏幕的1/3 */}
        <div className="relative w-full h-[33vh] min-h-[250px] bg-cover bg-center" style={{ backgroundImage: `url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})` }}>
          <div className="absolute inset-0 bg-black/40"></div>
          
          <div className="absolute top-4 right-4 z-10">
            {isMyProfile && (
              <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors">
                编辑资料
              </button>
            )}
          </div>
          
          {/* 将用户信息移到背景图下方，形成更清晰的卡片布局 */}
        </div>
        
        {/* 用户信息和操作按钮区域 */}
        <div className="container mx-auto px-4 -mt-16">
            <div className="relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
                <div className="flex justify-between items-start">
                    <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 object-cover" />
                    {!loading && !isMyProfile && (
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
                    {/* ... 社交链接等信息保持不变 ... */}
                </div>

                <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{profileUser.bio || '这位用户很神秘，什么都没留下...'}</p>
                {/* ... 性别、标签等信息保持不变 ... */}
                
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


        {/* 标签页和内容 */}
        <div className="container mx-auto px-2 md:px-4 py-4 flex-grow">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    {/* 【新增】“动态”标签 */}
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
