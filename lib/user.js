// lib/user.js (最终修复版 - 已添加 getLanguagePartners)

import { 
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc, increment, orderBy, setDoc // 确保 setDoc 已导入
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
  await unfollowUser(currentUserId, targetUserId); 
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

// --- 【新增】获取语言伙伴 ---
// 这个函数从 'users' 集合中获取除当前用户外的所有其他用户。
export const getLanguagePartners = async (currentUserId) => {
  // 确保有当前用户ID，否则无法排除自己
  if (!currentUserId) {
    console.error("需要提供当前用户ID才能查找语言伙伴。");
    return []; // 返回空数组以避免错误
  }

  try {
    const usersRef = collection(db, 'users');
    // 创建一个查询，条件是用户的 'uid' 字段不等于 'currentUserId'
    const q = query(usersRef, where('uid', '!=', currentUserId));
    
    const querySnapshot = await getDocs(q);
    
    // 遍历查询结果，将每个文档的数据转换为对象
    const partners = querySnapshot.docs.map(doc => ({
      id: doc.id, // 使用文档ID作为key
      ...doc.data()
    }));
    
    return partners; // 返回获取到的伙伴列表
  } catch (error) {
    console.error("获取语言伙伴列表时出错:", error);
    return []; // 如果查询过程中发生错误，也返回一个空数组
  }
};
