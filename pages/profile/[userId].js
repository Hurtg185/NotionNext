// pages/profile/[userId].js (已根据您的所有新需求重构和增强)

import React, { useState, useEffect, useMemo } from 'react';
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
  startChat,
  // 【重要】您需要在您的 API 文件中实现这个函数
  // It should accept an array of post IDs and return an array of full post objects.
  getPostsByIds 
} from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- 时间格式化工具函数 ---
const timeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "年前";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "月前";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "天前";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "小时前";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "分钟前";
    return "刚刚";
};


// --- 【重构】PostList 组件，以支持更多信息 ---
const PostList = ({ posts, type, author }) => {
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
        <div className="space-y-4">
            {posts.map(post => (
                <div
                    key={post.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden flex flex-col"
                    onClick={() => router.push(`/forum/post/${post.id}`)}
                >
                    <div className="flex items-start p-4">
                        <img src={author?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={author?.displayName} className="w-10 h-10 rounded-full object-cover mr-4"/>
                        <div className="flex-grow">
                            <p className="font-semibold text-gray-900 dark:text-white">{author?.displayName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(post.createdAt?.toDate())}</p>
                        </div>
                    </div>
                    
                    <div className="px-4 pb-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{post.title}</h3>
                        {post.imageUrl && (
                             <img src={post.imageUrl} alt={post.title} className="w-full h-auto object-cover rounded-md mb-2" />
                        )}
                    </div>
                    
                    {/* 点赞、踩、评论数据 */}
                    <div className="flex items-center space-x-4 px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center"><i className="far fa-thumbs-up mr-1"></i> {post.likesCount || 0}</span>
                        <span className="flex items-center"><i className="far fa-thumbs-down mr-1"></i> {post.dislikesCount || 0}</span>
                        <span className="flex items-center"><i className="far fa-comment mr-1"></i> {post.commentsCount || 0}</span>
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
    const [profileUser, setProfileUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');
    const [isEditing, setIsEditing] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [tabContent, setTabContent] = useState([]);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [showFollowModal, setShowFollowModal] = useState(false);
    const [modalType, setModalType] = useState('following');
    const [sortBy, setSortBy] = useState('latest'); // 'latest' or 'hot'

    const isMyProfile = currentUser && currentUser.uid === userId;

    const fetchUserProfile = async () => {
        if (!userId) return;
        setLoading(true);
        const profileData = await getUserProfile(userId);
        setProfileUser(profileData);

        if (currentUser && currentUser.uid !== userId) {
            const followingStatus = await checkFollowing(currentUser.uid, userId);
            setIsFollowing(followingStatus);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (userId) {
            fetchUserProfile();
        }
    }, [userId, currentUser]);

    // 【修复】重构数据获取逻辑以修复收藏和足迹
    useEffect(() => {
        if (!userId || !profileUser) return;
        
        let unsubscribe;
        const fetchAndSetPosts = async (fetcher) => {
            try {
                // Favorites/History functions should return a list of post IDs.
                const postIds = await fetcher(userId);
                if (postIds && postIds.length > 0) {
                    // Fetch full post details using the IDs.
                    const postsData = await getPostsByIds(postIds);
                    setTabContent(postsData);
                } else {
                    setTabContent([]);
                }
            } catch (error) {
                console.error("Error fetching tab content:", error);
                setTabContent([]);
            }
        };

        if (activeTab === 'posts') {
            unsubscribe = getPostsByUser(userId, setTabContent);
        } else if (activeTab === 'favorites' && isMyProfile) {
            fetchAndSetPosts(getFavoritesByUser); // 假设返回 post ID 数组
        } else if (activeTab === 'footprints' && isMyProfile) {
            fetchAndSetPosts(getViewHistoryByUser); // 假设返回 post ID 数组
        } else {
            setTabContent([]);
        }
        
        return () => unsubscribe && unsubscribe();
    }, [activeTab, userId, isMyProfile, profileUser]);


    const handleFollow = async (e) => {
        e.stopPropagation(); // 【修复】阻止事件冒泡
        if (!currentUser || isFollowLoading) return;
        setIsFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(currentUser.uid, userId);
            } else {
                await followUser(currentUser.uid, userId);
            }
            setIsFollowing(!isFollowing);
            // 【优化】前端即时更新粉丝数，提供更好体验
            setProfileUser(prev => ({
                ...prev,
                followersCount: isFollowing ? (prev.followersCount || 1) - 1 : (prev.followersCount || 0) + 1
            }));
        } catch (error) {
            console.error("关注/取关失败:", error);
        } finally {
            setIsFollowLoading(false);
        }
    };
    
    const handleStartChat = (e) => {
        e.stopPropagation(); // 【修复】阻止事件冒泡
        startChat(userId);
    };

    const handleOpenFollowModal = (type) => {
        setModalType(type);
        setShowFollowModal(true);
    };
    
    const handleProfileUpdate = () => {
        fetchUserProfile();
    };
    
    // 【新增】客户端排序逻辑
    const sortedContent = useMemo(() => {
        if (sortBy === 'hot') {
            return [...tabContent].sort((a, b) => {
                const scoreA = (a.likesCount || 0) * 2 + (a.commentsCount || 0);
                const scoreB = (b.likesCount || 0) * 2 + (b.commentsCount || 0);
                return scoreB - scoreA;
            });
        }
        // 'latest' is the default from Firestore, so no need to sort again if sortBy is 'latest'
        return tabContent;
    }, [sortBy, tabContent]);

    if (loading) {
        return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
    }
    if (!profileUser) {
        return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
    }

    return (
        <LayoutBase>
            <div className="flex flex-col min-h-screen">
                {/* --- 【重构】顶部背景和个人资料区域 --- */}
                <div
                    className="relative w-full bg-cover bg-center text-white p-4 flex flex-col justify-end"
                    style={{ 
                        backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.6), transparent), url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})`,
                        minHeight: '35vh'
                    }}
                >
                    <div className="relative z-10">
                        <div className="flex items-start mb-4">
                            <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-20 h-20 rounded-full border-2 border-white/80 object-cover flex-shrink-0 mr-4"/>
                            <div className="flex-grow min-w-0">
                                <h1 className="text-3xl font-bold text-white truncate">{profileUser.displayName || '未命名用户'}</h1>
                                <p className="text-sm mt-1 text-white/90">{profileUser.bio || '这位用户很神秘，什么都没留下...'}</p>
                            </div>
                            {isMyProfile && (
                                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors flex-shrink-0">
                                    编辑资料
                                </button>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                            {profileUser.gender && profileUser.gender !== 'not_specified' && (
                                <span className={`px-2 py-1 rounded-full text-white flex items-center ${profileUser.gender === 'male' ? 'bg-blue-500/80' : 'bg-pink-500/80'}`}>
                                    <i className={`fas ${profileUser.gender === 'male' ? 'fa-mars' : 'fa-venus'} mr-1`}></i>
                                    {profileUser.gender === 'male' ? '男' : '女'}
                                </span>
                            )}
                            {profileUser.nationality && (<span className="px-2 py-1 bg-white/20 rounded-full">{profileUser.nationality}</span>)}
                            {profileUser.city && (<span className="px-2 py-1 bg-white/20 rounded-full">{profileUser.city}</span>)}
                            {profileUser.tags && profileUser.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-white/20 rounded-full">{tag}</span>
                            ))}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                                <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                                    <div className="font-bold text-lg">{profileUser.followingCount || 0}</div>
                                    <div className="text-sm text-gray-300">关注</div>
                                </button>
                                <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                                    <div className="font-bold text-lg">{profileUser.followersCount || 0}</div>
                                    <div className="text-sm text-gray-300">粉丝</div>
                                </button>
                            </div>
                            
                            {!isMyProfile && (
                                <div className="flex space-x-2">
                                    <button onClick={handleFollow} disabled={isFollowLoading} className={`px-5 py-2 rounded-full font-semibold transition-colors disabled:opacity-70 ${isFollowing ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                                        {isFollowing ? '已关注' : '关注'}
                                    </button>
                                    <button onClick={handleStartChat} className="px-5 py-2 bg-white/30 rounded-full font-semibold hover:bg-white/50 transition-colors">
                                        私信
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- 标签页导航 --- */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">
                    <div className="container mx-auto flex">
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

                {/* --- 内容区域 --- */}
                <div className="container mx-auto p-2 md:p-4 flex-grow bg-gray-50 dark:bg-gray-900">
                    {/* 【新增】排序切换 */}
                    {activeTab === 'posts' && (
                        <div className="flex items-center space-x-2 mb-4">
                            <button onClick={() => setSortBy('latest')} className={`px-3 py-1 text-sm rounded-full ${sortBy === 'latest' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>最新</button>
                            <button onClick={() => setSortBy('hot')} className={`px-3 py-1 text-sm rounded-full ${sortBy === 'hot' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>热门</button>
                        </div>
                    )}
                    <PostList posts={sortedContent} type={activeTab} author={profileUser} />
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
