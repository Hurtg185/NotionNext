// components/Profile/ProfilePageContent.js (新建文件)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
// 注意：LayoutBase 不在这里导入，而在外层页面导入
import { getUserProfile, startChat } from '@/lib/chat';
import { 
  followUser, unfollowUser, checkFollowing, 
  getPostsByUser, getFavoritesByUser
} from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';

// --- PostList 组件保持不变 ---
const PostList = ({ posts }) => {
  // ... (你的 PostList 组件代码)
};

// 【核心修改】组件名称改为 ProfilePageContent，并且它不再是默认导出
export const ProfilePageContent = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes');
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  
  const isMyProfile = currentUser && currentUser.uid === userId;
  
  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    
    // 如果获取不到真实数据，直接返回，避免使用 mock 数据导致崩溃
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
    // 增加 router.isReady 判断
    if (router.isReady) {
        fetchUserProfile();
    }
  }, [userId, currentUser, router.isReady]);

  useEffect(() => {
    if (!userId) return;
    let unsubscribe;
    if (activeTab === 'notes') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      unsubscribe = getFavoritesByUser(userId, setTabContent);
    } else {
      setTabContent([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile]);
  
  const handleFollow = async () => { /* ... */ };
  const handleStartChat = async () => { /* ... */ };
  const handleProfileUpdate = () => { fetchUserProfile(); };

  if (loading) {
    return <div className="p-10 text-center">正在加载用户资料...</div>;
  }
  if (!profileUser) {
    return <div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div>;
  }

  // --- 返回 JSX ---
  // 这部分是你原来的 return 内容，保持不变
  return (
    <div className="flex flex-col min-h-screen">
      {/* 顶部背景图与个人信息整合区域 */}
      {/* ... (你的完整 JSX 代码) ... */}

      {isEditing && (
        <EditProfileModal
          user={currentUser}
          onClose={() => setIsEditing(false)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
};
