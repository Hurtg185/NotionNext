// pages/profile/[userId].js

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, startChat } from '@/lib/chat';
import {
    followUser, unfollowUser, checkFollowing,
    blockUser, unblockUser, checkBlocked,
    getPostsByUser, getFavoritesByUser, getViewHistoryByUser,
    updateUserProfileImage // 假設這是一個更新用戶資料的函數
} from '@/lib/user';
import { useDrawer } from '@/lib/DrawerContext';
import EditProfileModal from '@/components/EditProfileModal';

// 引入圖示庫
import { FaUserPlus, FaCommentDots, FaCheck } from 'react-icons/fa';
import { FiSettings, FiEdit } from 'react-icons/fi';


// 帖子列表組件 (美化版)
const PostList = ({ posts }) => {
    const router = useRouter();
    if (!posts || posts.length === 0) {
        return <p className="text-center text-gray-400 dark:text-gray-500 pt-8">還沒有發布任何筆記。</p>;
    }
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {posts.map(post => (
                <div
                    key={post.id}
                    className="relative aspect-square bg-gray-200 dark:bg-gray-800 cursor-pointer group"
                    onClick={() => router.push(`/forum/post/${post.id}`)}
                >
                    {/* 這裡可以放帖子的封面圖 */}
                    <img src={post.coverImage || 'https://via.placeholder.com/300'} alt={post.title} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <h3 className="font-semibold text-white text-sm truncate">{post.title}</h3>
                    </div>
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
    
    // 新增：背景圖片狀態
    const [profileBg, setProfileBg] = useState(null);
    const fileInputRef = useRef(null);


    const isMyProfile = currentUser && currentUser.uid === userId;

    const fetchUserProfile = async () => {
        if (!userId) return;
        setLoading(true);
        const profileData = await getUserProfile(userId);
        setProfileUser(profileData);
        // 新增：設置背景圖片
        setProfileBg(profileData?.profileBg || 'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=2175&auto=format&fit=crop'); // 默認背景
        
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
        } else if (activeTab === 'collections' && isMyProfile) {
            // 假設你有一個獲取合集的函數
            // unsubscribe = getCollectionsByUser(userId, setTabContent);
            setTabContent([]); // 暫時為空
        } else {
            setTabContent([]);
        }
        return () => unsubscribe && unsubscribe();
    }, [activeTab, userId, isMyProfile]);

    // ... (handleFollow, handleBlock, handleStartChat 函數保持不變)

    const handleProfileUpdate = () => {
        fetchUserProfile();
    };
    
    // 新增：處理背景圖片更換
    const handleBgChange = async (e) => {
        const file = e.target.files[0];
        if (file && isMyProfile) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const newBgUrl = event.target.result;
                setProfileBg(newBgUrl); // 立即預覽
                // 這裡你需要一個函數來上傳圖片並更新用戶資料庫
                // await updateUserProfileImage(currentUser.uid, { profileBg: newBgUrl });
            };
            reader.readAsDataURL(file);
        }
    };
    
    if (loading) {
        return <LayoutBase><div className="p-10 text-center">正在加載...</div></LayoutBase>;
    }
    if (!profileUser) {
        return <LayoutBase><div className="p-10 text-center text-red-500">無法加載該用戶。</div></LayoutBase>;
    }


    return (
        <LayoutBase>
            <div className="min-h-screen bg-white dark:bg-black">
                {/* 背景部分 */}
                <div className="relative w-full h-56 group">
                    <img
                        src={profileBg}
                        alt="Profile Background"
                        className="w-full h-full object-cover"
                    />
                    {isMyProfile && (
                        <button
                            onClick={() => fileInputRef.current.click()}
                            className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            更換背景
                        </button>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleBgChange}
                        className="hidden"
                        accept="image/*"
                    />
                </div>

                {/* 主要內容區域 */}
                <div className="p-4">
                    {/* 頭像和操作按鈕 */}
                    <div className="flex justify-between items-start -mt-16">
                        <img
                            src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
                            alt={profileUser.displayName}
                            className="w-24 h-24 rounded-full border-4 border-white dark:border-black shadow-lg object-cover"
                        />
                        {isMyProfile ? (
                            <div className="flex space-x-2 pt-16">
                                <button onClick={() => setIsEditing(true)} className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-sm font-semibold rounded-md"><FiEdit className="mr-2"/>編輯資料</button>
                                <button className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-sm font-semibold rounded-md"><FiSettings /></button>
                            </div>
                        ) : (
                            <div className="flex space-x-2 pt-16">
                                <button onClick={handleFollow} className={`flex items-center px-4 py-2 text-sm font-bold rounded-md transition-colors ${isFollowing ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : 'bg-red-500 text-white'}`}>
                                    {isFollowing ? <><FaCheck className="mr-2"/>已關注</> : <><FaUserPlus className="mr-2"/>關注</>}
                                </button>
                                <button onClick={handleStartChat} className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-sm font-semibold rounded-md"><FaCommentDots className="mr-2"/>私信</button>
                            </div>
                        )}
                    </div>
                    
                    {/* 用戶名和ID */}
                    <h1 className="text-2xl font-bold mt-3 text-gray-900 dark:text-white">{profileUser.displayName}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">小紅書號：{profileUser.id?.substring(0, 12) || 'N/A'}</p>
                    
                    {/* 簡介 */}
                    <p className="text-gray-700 dark:text-gray-300 mt-3 text-sm">{profileUser.bio || '點擊這裡，填寫簡介'}</p>
                    {profileUser.ipLocation && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">IP屬地：{profileUser.ipLocation}</p>}


                    {/* 統計資料 - 每排兩個 */}
                    <div className="grid grid-cols-2 gap-x-4 mt-4">
                         <div className="flex space-x-4 text-gray-800 dark:text-gray-300">
                            <div><span className="font-bold">{profileUser.followingCount || 0}</span> <span className="text-gray-500">關注</span></div>
                            <div><span className="font-bold">{profileUser.followersCount || 0}</span> <span className="text-gray-500">粉絲</span></div>
                        </div>
                        <div className="flex items-center">
                           <span className="font-bold">{profileUser.likesAndCollects || 0}</span> <span className="text-gray-500 ml-1">獲讚與收藏</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-t border-gray-200 dark:border-gray-800 mt-4">
                    <div className="flex justify-around">
                        <button onClick={() => setActiveTab('posts')} className={`flex-1 py-3 text-sm font-semibold text-center ${activeTab === 'posts' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-500 dark:text-gray-400'}`}>
                            筆記
                        </button>
                        {isMyProfile && (
                            <>
                                <button onClick={() => setActiveTab('collections')} className={`flex-1 py-3 text-sm font-semibold text-center ${activeTab === 'collections' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    合集
                                </button>
                                <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-3 text-sm font-semibold text-center ${activeTab === 'favorites' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    收藏
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Tab 內容 */}
                <div className="pb-10">
                    {activeTab === 'posts' && ( <PostList posts={tabContent} /> )}
                    {activeTab === 'collections' && isMyProfile && ( <p className="text-center text-gray-400 pt-8">還沒有創建任何合集。</p> )}
                    {activeTab === 'favorites' && isMyProfile && ( <PostList posts={tabContent} /> )}
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
