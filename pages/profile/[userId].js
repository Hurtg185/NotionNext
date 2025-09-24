// pages/profile/[userId].js (Modified and enhanced according to your requirements)

import React, { useState, useEffect, useCallback } from 'react';
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

// --- [Modified] PostList component, changed to a single-column community post list style ---
const PostList = ({ posts, type, author }) => {
    const router = useRouter();
    const emptyMessages = {
        posts: "No posts have been published yet.",
        favorites: "No posts have been favorited yet.",
        footprints: "No footprints have been left yet."
    };

    if (!posts || posts.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{emptyMessages[type]}</p>;
    }

    return (
        <div className="space-y-4">
            {posts.map(post => (
                <div
                    key={post.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden flex"
                    onClick={() => router.push(`/forum/post/${post.id}`)}
                >
                    {/* Dynamic part on the left - displays the author's avatar */}
                    <div className="flex-shrink-0 p-4">
                        <img src={author?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={author?.displayName} className="w-12 h-12 rounded-full object-cover"/>
                    </div>

                    <div className="flex-grow p-4 min-w-0">
                         {/* Post content */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                 {/* You can keep the author's name if needed in the list */}
                                <p className="font-semibold text-gray-900 dark:text-white">{author?.displayName}</p>
                                {/* You can add other metadata here, such as the publication time */}
                            </div>
                        </div>

                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate my-2">{post.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 truncate">{post.content ? post.content.slice(0, 100) + '...' : ''}</p> {/* Simple content preview */}

                        {post.imageUrl && (
                             <img src={post.imageUrl} alt={post.title} className="mt-2 w-full max-h-48 object-cover rounded-md" />
                        )}
                         {/* You can add likes, comment counts, etc. here */}
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

    const fetchUserProfile = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const profileData = await getUserProfile(userId);
            setProfileUser(profileData);

            if (currentUser && currentUser.uid !== userId) {
                const followingStatus = await checkFollowing(currentUser.uid, userId);
                setIsFollowing(followingStatus);
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, currentUser]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

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

    // --- [Fixed] Follow and private message click events ---
    const handleFollow = async (e) => {
        e.stopPropagation(); // Prevents the event from bubbling up to the parent element.
        if (!currentUser || isFollowLoading) return;
        setIsFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(currentUser.uid, userId);
            } else {
                await followUser(currentUser.uid, userId);
            }
            setIsFollowing(!isFollowing);
            // Update the follow/follower count in real-time to avoid refetching the entire profile
            setProfileUser(prev => ({
                ...prev,
                followersCount: isFollowing ? (prev.followersCount || 1) - 1 : (prev.followersCount || 0) + 1
            }));
            // Also update the current user's following count
            if (currentUser) {
                 // This update logic needs to be adjusted based on how your `useAuth` context works
            }

        } catch (error) {
            console.error("Follow/unfollow failed:", error);
        } finally {
            setIsFollowLoading(false);
        }
    };

    const handleStartChat = async (e) => {
        e.stopPropagation(); // Prevents event bubbling
        if (!userId) return;
        try {
           await startChat(userId);
           // startChat should handle the logic for route navigation or opening the chat window internally
        } catch(error){
            console.error("Failed to start chat: ", error);
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
        return <LayoutBase><div className="p-10 text-center">Loading user profile...</div></LayoutBase>;
    }
    if (!profileUser) {
        return <LayoutBase><div className="p-10 text-center text-red-500">Could not load this user's information or the user does not exist.</div></LayoutBase>;
    }

    return (
        <LayoutBase>
            <div className="flex flex-col min-h-screen">
                {/* --- [Modified] Background image height reduced, occupies 1/3 of the screen --- */}
                <div
                    className="relative w-full bg-cover bg-center flex flex-col justify-between p-4 text-white"
                    style={{
                        backgroundImage: `url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})`,
                        height: '33.33vh' // Use vh unit.
                    }}
                >
                    <div className="absolute inset-0 bg-black/40"></div>

                    <div className="relative z-10 self-end">
                        {isMyProfile && (
                            <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/30 text-white rounded-full text-sm font-semibold backdrop-blur-sm hover:bg-white/50 transition-colors">
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {/* This part has been moved below the background image to prevent content from being cut off due to the height limit */}
                </div>

                {/* --- User information and action area --- */}
                <div className="relative z-10 bg-white dark:bg-gray-800 p-4 -mt-16">
                     <div className="container mx-auto">
                        <div className="flex items-end space-x-4 mb-4">
                             <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 object-cover flex-shrink-0"/>
                            <div className="flex-grow min-w-0 flex justify-between items-end">
                                 <div>
                                     <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{profileUser.displayName || 'Unnamed User'}</h1>
                                      {/* Social links */}
                                    {profileUser.socials && Object.keys(profileUser.socials).length > 0 && (
                                        <div className="flex items-center space-x-3 mt-2">
                                            {Object.entries(profileUser.socials).map(([key, value]) => value && (
                                                <a key={key} href={`https://${key}.com/${value}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 dark:text-gray-400 hover:text-blue-500">
                                                    <i className={`${SOCIAL_ICONS[key]} text-xl`}></i>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                 </div>
                                 {/* Follow and private message buttons */}
                                {!loading && !isMyProfile && (
                                    <div className="flex space-x-2 flex-shrink-0">
                                        <button onClick={handleFollow} disabled={isFollowLoading} className={`px-6 py-2 rounded-full font-semibold transition-colors disabled:opacity-70 ${isFollowing ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                        <button onClick={handleStartChat} className="px-6 py-2 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors">
                                            Message
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                         {/* Bio */}
                        <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{profileUser.bio || 'This user is mysterious and has left nothing behind...'}</p>


                        <div className="flex flex-wrap items-center gap-2 my-4 text-xs">
                            {profileUser.gender && profileUser.gender !== 'not_specified' && (
                                <span className={`px-2 py-1 rounded-full text-white flex items-center ${profileUser.gender === 'male' ? 'bg-blue-500/80' : 'bg-pink-500/80'}`}>
                                    <i className={`fas ${profileUser.gender === 'male' ? 'fa-mars' : 'fa-venus'} mr-1`}></i>
                                    {profileUser.gender === 'male' ? 'Male' : 'Female'}
                                </span>
                            )}
                            {profileUser.tags && profileUser.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">{tag}</span>
                            ))}
                        </div>

                        <div className="flex items-center space-x-5">
                            <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                                <div className="font-bold text-lg text-gray-900 dark:text-white">{profileUser.followingCount || 0}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Following</div>
                            </button>
                            <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                                <div className="font-bold text-lg text-gray-900 dark:text-white">{profileUser.followersCount || 0}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Followers</div>
                            </button>
                        </div>
                    </div>
                </div>


                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
                    <div className="container mx-auto flex">
                        <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                            Posts ({profileUser.postsCount || 0})
                        </button>
                        {isMyProfile && (
                            <>
                                <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                    Favorites
                                </button>
                                <button onClick={() => setActiveTab('footprints')} className={`py-3 px-6 font-semibold ${activeTab === 'footprints' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                    Footprints
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="container mx-auto p-2 md:p-4 flex-grow bg-gray-50 dark:bg-gray-900">
                    <PostList posts={tabContent} type={activeTab} author={profileUser} />
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
