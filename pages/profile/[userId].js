// pages/profile/[userId].js (个人主页核心页面)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo'; // 你的基础布局
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'; // Firebase Firestore
import { db } from '@/lib/firebase'; // 你的 Firebase DB 实例

// 导入其他需要的组件
// import UserPostsList from '@/components/UserPostsList'; // 用于显示用户动态
// import UserBookmarksList from '@/components/UserBookmarksList'; // 用于显示用户收藏
// import StartChatButton from '@/themes/heo/components/StartChatButton'; // 私信按钮

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query; // 从URL获取用户ID
  const { user: currentUser } = useAuth(); // 当前登录用户
  const [profileUser, setProfileUser] = useState(null); // 被访问的个人主页的用户
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dynamics'); // 'dynamics', 'posts', 'bookmarks', 'bookshelf'

  // 获取用户资料
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setProfileUser({ id: userDoc.id, ...userDoc.data() });
        } else {
          setProfileUser(null);
          alert('用户不存在！');
        }
      } catch (error) {
        console.error("获取用户资料失败:", error);
        setProfileUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [userId]);

  if (loading) {
    return <LayoutBase><div className="p-10 text-center">加载用户资料...</div></LayoutBase>;
  }

  if (!profileUser) {
    return <LayoutBase><div className="p-10 text-center text-red-500">用户资料加载失败或用户不存在。</div></LayoutBase>;
  }

  const isMyProfile = currentUser && currentUser.uid === profileUser.id;

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* 顶部背景图 (可选) */}
        <div className="w-full h-48 bg-gradient-to-r from-blue-500 to-purple-600 dark:from-gray-700 dark:to-gray-800 relative">
          {/* 这里可以放一个背景图片 */}
        </div>

        {/* 用户信息区 */}
        <div className="flex flex-col items-center -mt-20 px-4">
          <img 
            src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
            alt={profileUser.displayName} 
            className="w-28 h-28 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"
          />
          <h1 className="text-3xl font-bold mt-4 text-gray-900 dark:text-white">{profileUser.displayName}</h1>
          <p className="text-gray-500 dark:text-gray-400">@{profileUser.id?.substring(0, 8)}</p> {/* 简化的用户名 */}
          <p className="text-gray-700 dark:text-gray-300 text-center mt-2 px-6">{profileUser.bio || '这个人很懒，什么都没写...'}</p>
          
          {/* 年龄和国籍 */}
          <div className="flex items-center space-x-4 mt-3 text-gray-600 dark:text-gray-400">
            {profileUser.country && <span className="flex items-center"><i className="fas fa-flag mr-2"></i>{profileUser.country}</span>}
            {profileUser.age && <span className="flex items-center"><i className="fas fa-birthday-cake mr-2"></i>{profileUser.age}岁</span>}
          </div>

          {/* 关注者数据 */}
          <div className="flex space-x-6 mt-4 text-gray-800 dark:text-white">
            <div><span className="font-bold">{profileUser.followerCount || 0}</span> 关注者</div>
            <div><span className="font-bold">{profileUser.followingCount || 0}</span> 关注</div>
          </div>

          {/* 按钮区 */}
          <div className="flex space-x-4 mt-6">
            {isMyProfile ? (
              <button className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600">编辑资料</button>
            ) : (
              <>
                {/* 
                  这里需要根据实际情况添加关注/取关逻辑和按钮
                  <button className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600">关注</button>
                  <StartChatButton targetUserId={profileUser.id} /> 
                */}
                <button className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600">关注</button>
                <button className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">私信</button>
              </>
            )}
          </div>
        </div>

        {/* Tab 切换区 */}
        <div className="flex justify-around border-b border-gray-200 dark:border-gray-700 mt-8 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <button 
            onClick={() => setActiveTab('dynamics')} 
            className={`py-3 px-6 font-semibold ${activeTab === 'dynamics' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}
          >
            动态 ({profileUser.postCount || 0})
          </button>
          <button 
            onClick={() => setActiveTab('posts')} 
            className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}
          >
            帖子
          </button>
          <button 
            onClick={() => setActiveTab('bookmarks')} 
            className={`py-3 px-6 font-semibold ${activeTab === 'bookmarks' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}
          >
            收藏
          </button>
          {/* <button onClick={() => setActiveTab('bookshelf')} className={`...`}>书柜</button> */}
        </div>

        {/* 内容显示区 */}
        <div className="p-4 flex-grow">
          {activeTab === 'dynamics' && (
            <div className="text-gray-700 dark:text-gray-300">
              {/* 这里会渲染用户发布的动态，例如一个卡片瀑布流 */}
              {/* 暂时显示占位符 */}
              <p>用户动态加载中...</p>
            </div>
          )}
          {activeTab === 'posts' && (
            <div className="text-gray-700 dark:text-gray-300">
              {/* 这里会渲染用户发布的论坛帖子列表 */}
              <p>用户帖子列表...</p>
            </div>
          )}
          {activeTab === 'bookmarks' && (
            <div className="text-gray-700 dark:text-gray-300">
              {/* 这里会渲染用户收藏的内容 */}
              <p>用户收藏列表...</p>
            </div>
          )}
        </div>
      </div>
    </LayoutBase>
  );
};

export default ProfilePage;
