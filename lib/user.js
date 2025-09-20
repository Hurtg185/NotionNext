// lib/user.js (最终修复版 - 优化关注/好友/拉黑功能)
import { 
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc, increment,orderBy // 【核心修复】导入 increment
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
  batch.update(currentUserDocRef, { followingCount: increment(1) }); // 【核心修复】使用 increment(1)
  batch.update(targetUserDocRef, { followersCount: increment(1) }); // 【核心修复】使用 increment(1)

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
  batch.update(currentUserDocRef, { followingCount: increment(-1) }); // 【核心修复】使用 increment(-1)
  batch.update(targetUserDocRef, { followersCount: increment(-1) }); // 【核心修复】使用 increment(-1)

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
  // 拉黑后，通常需要自动取关 (注意：unfollowUser 内部会检查自己关注自己，所以安全)
  await unfollowUser(currentUserId, targetUserId); // 我不再关注他
  // 【新增】如果他关注我，也要让他取关我（Firestore 安全规则需要允许）
  // 这种操作通常在后端云函数中更安全，这里只是前端示例
  // 或者你也可以选择不强制对方取关，只影响自己
  // await unfollowUser(targetUserId, currentUserId); 
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
  // 这是从用户的 favorites 子集合中获取收藏的帖子ID
  const q = query(collection(db, 'users', userId, 'favorites'), orderBy('timestamp', 'desc'));
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const favoritePostIds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // 获取收藏的文档数据
    
    // 【优化】批量获取帖子详情
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
    }).filter(Boolean); // 过滤掉不存在的帖子
    
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
    const users = await Promise.all(userIds.map(id => getUserProfile(id))); // 复用 getUserProfile
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
  
  // 监听我关注的人
  const followingUnsubscribe = onSnapshot(collection(db, 'users', userId, 'following'), async (followingSnapshot) => {
    const followingIds = new Set(followingSnapshot.docs.map(doc => doc.id));

    if (followingIds.size === 0) {
      callback([]); // 如果没有关注任何人，就没有好友
      return;
    }

    // 监听关注我的人
    const followersUnsubscribe = onSnapshot(collection(db, 'users', userId, 'followers'), async (followersSnapshot) => {
      const followersIds = new Set(followersSnapshot.docs.map(doc => doc.id));
      
      const friendIds = [];
      // 找到既在我关注列表，又关注我的人
      for (const id of followersIds) {
        if (followingIds.has(id)) {
          friendIds.push(id);
        }
      }

      if (friendIds.length === 0) {
        callback([]);
        return;
      }
      
      // 批量获取好友资料
      const friends = await Promise.all(friendIds.map(id => getUserProfile(id)));
      callback(friends.filter(Boolean));

    }, (error) => {
      console.error("获取粉丝列表失败 (getFriends):", error);
    });

    return followersUnsubscribe; // 返回粉丝列表的取消订阅函数
  }, (error) => {
    console.error("获取关注列表失败 (getFriends):", error);
  });

  return followingUnsubscribe; // 返回关注列表的取消订阅函数
};
