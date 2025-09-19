// pages/profile/[userId].js (修改后，功能完整)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, startChat } from '@/lib/chat';
import { useDrawer } from '@/lib/DrawerContext';
import EditProfileModal from '@/components/EditProfileModal'; // 【新增】导入模态框组件

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  const { openDrawer } = useDrawer();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dynamics');
  const [isEditing, setIsEditing] = useState(false); // 【新增】控制模态框的 state

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const profileData = await getUserProfile(userId);
    setProfileUser(profileData);
    setLoading(false);
  };

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const handleStartChat = async () => {
    if (!currentUser) {
      alert('请先登录再发送私信！');
      return;
    }
    if (!profileUser || profileUser.id === currentUser.uid) return;
    
    const conversation = await startChat(currentUser.uid, profileUser.id);
    if (conversation) {
      openDrawer('chat', { conversation });
    } else {
      alert('开启对话失败，请稍后再试。');
    }
  };
  
  // 【新增】当资料更新成功后的回调函数
  const handleProfileUpdate = () => {
    console.log("Profile updated, refreshing data...");
    fetchUserProfile(); // 重新获取最新的用户数据来刷新页面
  };

  if (loading) {
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }

  if (!profileUser) {
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
  }

  const isMyProfile = currentUser && currentUser.uid === profileUser.id;

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full h-48 bg-gradient-to-r from-blue-400 to-purple-500"></div>
        <div className="flex flex-col items-center -mt-20 px-4 pb-10">
          <img 
            src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
            alt={profileUser.displayName} 
            className="w-28 h-28 rounded-full border-4 border-white dark:border-gray-900 shadow-lg object-cover"
          />
          <h1 className="text-3xl font-bold mt-4 text-gray-900 dark:text-white">{profileUser.displayName}</h1>
          <p className="text-gray-500 dark:text-gray-400">@{profileUser.id?.substring(0, 8)}</p>
          <p className="text-gray-700 dark:text-gray-300 text-center mt-2 px-6 max-w-xl">{profileUser.bio || '这个人很懒，什么都没写...'}</p>
          
          {/* 【修改后】显示更丰富的个人信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-4 text-gray-600 dark:text-gray-400 text-sm">
            {profileUser.currentCity && <span className="flex items-center"><i className="fas fa-map-marker-alt mr-2 w-4 text-center text-gray-400"></i><span className="font-bold mr-1">常住:</span> {profileUser.currentCity}</span>}
            {profileUser.hometown && <span className="flex items-center"><i className="fas fa-home mr-2 w-4 text-center text-gray-400"></i><span className="font-bold mr-1">家乡:</span> {profileUser.hometown}</span>}
            {profileUser.occupation && <span className="flex items-center"><i className="fas fa-briefcase mr-2 w-4 text-center text-gray-400"></i><span className="font-bold mr-1">职业:</span> {profileUser.occupation}</span>}
            {profileUser.learningLanguage && <span className="flex items-center"><i className="fas fa-language mr-2 w-4 text-center text-gray-400"></i><span className="font-bold mr-1">在学:</span> {profileUser.learningLanguage}</span>}
          </div>

          <div className="flex space-x-6 mt-4 text-gray-800 dark:text-white">
            <div><span className="font-bold">{profileUser.followerCount || 0}</span> 关注者</div>
            <div><span className="font-bold">{profileUser.followingCount || 0}</span> 关注</div>
          </div>

          <div className="flex space-x-4 mt-6">
            {isMyProfile ? (
              <button 
                onClick={() => setIsEditing(true)} // 【修改】添加 onClick 事件
                className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors"
              >
                编辑资料
              </button>
            ) : (
              <>
                <button className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors">关注</button>
                <button 
                  onClick={handleStartChat}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  私信
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-around border-b border-gray-200 dark:border-gray-700 mt-8 sticky top-0 bg-white dark:bg-gray-800 z-10">
           {/* ... tabs a ... */}
        </div>

        <div className="p-4 flex-grow">
          {/* ... tabs content ... */}
        </div>
      </div>
      
      {/* 【新增】在页面逻辑顶部渲染模态框 */}
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
