// lib/user.js (最终修复版 - 优化关注/好友/拉黑功能)

import { 
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc, increment, orderBy, setDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { getUserProfile } from './chat'; // 假设 getUserProfile 在 lib/chat.js 中

// --- 头像上传 ---
export const uploadProfilePicture = async (userId, file) => {
  if (!userId || !file) {
    throw new Error('User ID and file are required.');
  }
  const filePath = `profilePictures/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

// --- 上传用户背景图 ---
export const uploadUserBackground = async (userId, file) => {
  if (!userId || !file) {
    throw new Error('User ID and file are required to upload background.');
  }
  const filePath = `userBackgrounds/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);

  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};


// --- 更新用户资料 ---
export const updateUserProfile = async (userId, data) => {
  console.log('DEBUG [updateUserProfile]: Function called.');
  console.log('DEBUG [updateUserProfile]: Attempting to update profile for userId:', userId);
  console.log('DEBUG [updateUserProfile]: Data to update:', data);

  if (!userId || !data) {
    console.error('ERROR [updateUserProfile]: User ID or data is missing.', { userId, data });
    throw new Error('User ID and data are required to update profile.');
  }
  const userDocRef = doc(db, 'users', userId);
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };

  if (data.displayName) {
    updateData.displayName_lowercase = data.displayName.toLowerCase();
  }

  try {
    await updateDoc(userDocRef, updateData);
    console.log('SUCCESS [updateUserProfile]: Firestore updateDoc succeeded for userId:', userId);
  } catch (error) {
    console.error('ERROR [updateUserProfile]: Firestore updateDoc failed:', error.message);
    console.error('ERROR [updateUserProfile]: Full error object:', JSON.stringify(error, null, 2));
    throw error; 
  }
};

// --- 昵称搜索 ---
export const searchUsersByNickname = async (searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return [];
  }
  const lowercasedTerm = searchTerm.toLowerCase();
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('displayName_lowercase', '>=', lowercasedTerm),
    where('displayName_lowercase', '<=', lowercasedTerm + '\uf8ff'),
    limit(10)
  );
  try {
    const querySnapshot = await getDocs(q);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};


// --- 关注/取关 ---
export const followUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;

  const currentUserFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  const currentUserDocRef = doc(db, 'users', currentUserId);
  const targetUserDocRef = doc(db, 'users', targetUserId);

  const batch = writeBatch(db);
  batch.set(currentUserFollowingRef, { timestamp: serverTimestamp() });
  batch.set(targetUserFollowersRef, { timestamp: serverTimestamp() });
  batch.update(currentUserDocRef, { followingCount: increment(1) });
  batch.update(targetUserDocRef, { followersCount: increment(1) });

  await batch.commit();
};

export const unfollowUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;

  const currentUserFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  const currentUserDocRef = doc(db, 'users', currentUserId);
  const targetUserDocRef = doc(db, 'users', targetUserId);

  const batch = writeBatch(db);
  batch.delete(currentUserFollowingRef);
  batch.delete(targetUserFollowersRef);
  batch.update(currentUserDocRef, { followingCount: increment(-1) });
  batch.update(targetUserDocRef, { followersCount: increment(-1) });

  await batch.commit();
};

export const checkFollowing = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return false;
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const docSnap = await getDoc(followingRef);
  return docSnap.exists();
};

// --- 拉黑/取消拉黑 ---
export const blockUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  await setDoc(blockRef, { timestamp: serverTimestamp() });
  
  // 【核心修复】拉黑后，自动取关双方（如果已关注）
  // 注意：这个 unfollowUser 自身是安全的，不会造成无限循环
  try { await unfollowUser(currentUserId, targetUserId); } catch (e) { console.warn("Error unfollowing after blocking:", e.message); }
  // 不再强制对方取关自己，只影响自己这边的关系
  // try { await unfollowUser(targetUserId, currentUserId); } catch (e) { console.warn("Error unfollowing (target to current) after blocking:", e.message); }
};

export const unblockUser = async (currentUserId, targetUserId) => {
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  await deleteDoc(blockRef);
};

export const checkBlocked = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return false;
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  const docSnap = await getDoc(blockRef);
  return docSnap.exists();
};

// --- 获取用户发布的帖子 ---
export const getPostsByUser = (userId, callback) => {
  const q = query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(posts);
  });
  return unsubscribe;
};

// --- 获取用户收藏的帖子 ---
export const getFavoritesByUser = (userId, callback) => {
  const q = query(collection(db, 'users', userId, 'favorites'), orderBy('timestamp', 'desc'));
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const favoritePostIds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (favoritePostIds.length === 0) {
      callback([]);
      return;
    }
    const postRefs = favoritePostIds.map(fav => doc(db, 'posts', fav.id));
    const postSnaps = await Promise.all(postRefs.map(ref => getDoc(ref)));
    
    const favoritePosts = postSnaps.map(snap => {
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      return null;
    }).filter(Boolean);
    
    callback(favoritePosts);
  });
  return unsubscribe;
};

// --- 获取用户历史记录 ---
export const getViewHistoryByUser = (userId, callback) => {
  const q = query(collection(db, 'users', userId, 'viewHistory'), orderBy('timestamp', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(history);
  });
  return unsubscribe;
};

// --- 获取我关注的人 (Following) ---
export const getFollowing = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'following'));
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await Promise.all(userIds.map(id => getUserProfile(id)));
    callback(users.filter(Boolean));
  });
  return unsubscribe;
};

// --- 获取关注我的人 (Followers) ---
export const getFollowers = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'followers'));
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await Promise.all(userIds.map(id => getUserProfile(id)));
    callback(users.filter(Boolean));
  });
  return unsubscribe;
};

// --- 获取好友 (互相关注) ---
export const getFriends = (userId, callback) => {
  if (!userId) return () => {};
  
  const followingUnsubscribe = onSnapshot(collection(db, 'users', userId, 'following'), async (followingSnapshot) => {
    const followingIds = new Set(followingSnapshot.docs.map(doc => doc.id));

    if (followingIds.size === 0) {
      callback([]);
      return;
    }

    const followersUnsubscribe = onSnapshot(collection(db, 'users', userId, 'followers'), async (followersSnapshot) => {
      const followersIds = new Set(followersSnapshot.docs.map(doc => doc.id));
      
      const friendIds = [];
      for (const id of followersIds) {
        if (followingIds.has(id)) {
          friendIds.push(id);
        }
      }

      if (friendIds.length === 0) {
        callback([]);
        return;
      }
      
      const friends = await Promise.all(friendIds.map(id => getUserProfile(id)));
      callback(friends.filter(Boolean));

    }, (error) => {
      console.error("获取粉丝列表失败 (getFriends):", error);
    });

    return followersUnsubscribe;
  }, (error) => {
    console.error("获取关注列表失败 (getFriends):", error);
  });

  return followingUnsubscribe;
};

// --- 获取语言伙伴 (为 PartnerFinder 设计) ---
export const getLanguagePartners = (callback) => {
  const q = query(
    collection(db, 'users'),
    where('seekingLanguagePartner', '==', true), // 只获取标记为“正在找语伴”的用户
    orderBy('lastSeen', 'desc'), // 按最近上线时间排序
    limit(50) // 每次获取50个，以便前端进行算法排序
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  }, (error) => {
    console.error("获取语伴列表失败:", error);
    callback([]);
  });

  return unsubscribe;
};
