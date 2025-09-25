// lib/user.js (最终的、绝对完整的版本)

import {
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc, increment, orderBy, setDoc, addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// =================================================================
// HELPERS
// =================================================================

/**
 * [OPTIMIZATION] Fetches multiple user profiles efficiently using an 'in' query.
 * 【核心修复】确保此函数被导出，以便在其他函数中复用。
 */
export const getUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) {
    return [];
  }
  const users = [];
  for (let i = 0; i < userIds.length; i += 30) {
    const chunk = userIds.slice(i, i + 30);
    const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, uid: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("批量获取用户信息失败:", error);
    }
  }
  return users;
};

/**
 * [REUSABLE & ROBUST] Fetches a user's profile with detailed error handling.
 */
export const getUserProfile = async (userId) => {
  if (!userId) {
    console.error("getUserProfile called with invalid userId");
    return null;
  }
  const userRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, uid: docSnap.id, ...docSnap.data() };
    } else {
        console.warn(`User document not found for id: ${userId}`);
        return null;
    }
  } catch (error) {
    console.error(`获取用户 ${userId} 资料失败:`, error);
    return null;
  }
};


// =================================================================
// USER PROFILE MANAGEMENT (恢复完整代码)
// =================================================================

export const uploadProfilePicture = async (userId, file) => {
  if (!userId || !file) throw new Error('User ID and file are required.');
  const filePath = `profilePictures/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

export const uploadUserBackground = async (userId, file) => {
  if (!userId || !file) throw new Error('User ID and file are required.');
  const filePath = `userBackgrounds/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

export const updateUserProfile = async (userId, data) => {
  if (!userId || !data) throw new Error('User ID and data are required.');
  const userDocRef = doc(db, 'users', userId);
  const updateData = { ...data, updatedAt: serverTimestamp() };
  if (data.displayName) {
    updateData.displayName_lowercase = data.displayName.toLowerCase();
  }
  await updateDoc(userDocRef, updateData);
};

export const searchUsersByNickname = async (searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return [];
  const lowercasedTerm = searchTerm.toLowerCase();
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('displayName_lowercase', '>=', lowercasedTerm),
    where('displayName_lowercase', '<=', lowercasedTerm + '\uf8ff'),
    limit(10)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() }));
};


// =================================================================
// SOCIAL RELATIONSHIPS (恢复完整代码)
// =================================================================

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

export const blockUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  await setDoc(blockRef, { timestamp: serverTimestamp() });
  try { await unfollowUser(currentUserId, targetUserId); } catch (e) {}
  try { await unfollowUser(targetUserId, currentUserId); } catch (e) {}
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


// =================================================================
// USER CONTENT (POSTS, FAVORITES, HISTORY)
// =================================================================

export const getPostsByUser = (userId, callback) => {
  const q = query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(posts);
  });
};

export const getFavoritesByUser = (userId, callback) => {
  const q = query(collection(db, 'users', userId, 'favorites'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, async (snapshot) => {
    const favoritePostIds = snapshot.docs.map(doc => doc.id);
    if (favoritePostIds.length === 0) {
      callback([]);
      return;
    }
    const posts = await getUsersByIds(favoritePostIds.map(id => doc(db, 'posts', id)));
    callback(posts);
  });
};

export const getViewHistoryByUser = (userId, callback) => {
    const q = query(collection(db, 'users', userId, 'viewHistory'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, async (snapshot) => {
        const historyDocs = snapshot.docs.map(doc => doc.id);
        if (historyDocs.length === 0) {
            callback([]);
            return;
        }
        const posts = await getUsersByIds(historyDocs.map(id => doc(db, 'posts', id)));
        callback(posts);
    });
};


// =================================================================
// SOCIAL LISTS (FOLLOWING, FOLLOWERS, FRIENDS)
// =================================================================

export const getFollowing = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'following'));
  return onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await getUsersByIds(userIds);
    callback(users);
  });
};

export const getFollowers = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'followers'));
  return onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await getUsersByIds(userIds);
    callback(users);
  });
};

export const getFriends = (userId, callback) => {
    if (!userId) return () => {};
    let followingIds = new Set();
    let followersIds = new Set();
    let combinedDataFetched = { following: false, followers: false };
    const computeFriends = async () => {
        if (!combinedDataFetched.following || !combinedDataFetched.followers) return;
        const friendIds = [...followersIds].filter(id => followingIds.has(id));
        if (friendIds.length === 0) {
            callback([]);
            return;
        }
        const friends = await getUsersByIds(friendIds);
        callback(friends);
    };
    const followingUnsubscribe = onSnapshot(collection(db, 'users', userId, 'following'), (snapshot) => {
        followingIds = new Set(snapshot.docs.map(doc => doc.id));
        combinedDataFetched.following = true;
        computeFriends();
    });
    const followersUnsubscribe = onSnapshot(collection(db, 'users', userId, 'followers'), (snapshot) => {
        followersIds = new Set(snapshot.docs.map(doc => doc.id));
        combinedDataFetched.followers = true;
        computeFriends();
    });
    return () => {
        followingUnsubscribe();
        followersUnsubscribe();
    };
};


// =================================================================
// APP-SPECIFIC FEATURES (e.g., Language Partners)
// =================================================================

export const getLanguagePartners = (callback) => {
  const q = query(
    collection(db, 'users'),
    where('seekingLanguagePartner', '==', true),
    orderBy('lastSeen', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() }));
    callback(users);
  }, (error) => {
    console.error("Error getting language partners:", error);
    callback([]);
  });
};

// =================================================================
// CHAT DATA FETCHING FUNCTIONS (从 chat.js 移动并整合)
// =================================================================

export const startChat = async (currentUserId, targetUserUid) => {
  if (currentUserId === targetUserUid) return null;
  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserId, targetUserUid].sort();
  const q = query(chatsRef, where('participants', '==', participantsSorted));
  
  try {
    let querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const chatDoc = querySnapshot.docs[0];
      return { id: chatDoc.id, ...chatDoc.data() };
    } else {
      const newChatRef = await addDoc(chatsRef, {
        participants: participantsSorted,
        createdAt: serverTimestamp(),
        lastMessage: "对话已创建",
        lastMessageTimestamp: serverTimestamp(),
        // ... 其他初始化字段
      });
      const newDocSnap = await getDoc(newChatRef);
      return { id: newDocSnap.id, ...newDocSnap.data() };
    }
  } catch (error) {
    console.error("创建或获取聊天失败:", error);
    return null;
  }
};

export const getConversationsForUser = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId), orderBy('lastMessageTimestamp', 'desc'));
  return onSnapshot(q, 
    snapshot => {
      const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(conversations);
    }, 
    error => {
      console.error("获取对话列表失败:", error);
      callback([]);
    }
  );
};

export const getMessagesForChat = (chatId, callback) => {
    if (!chatId) return () => {};
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc')); 
    return onSnapshot(q, 
      (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
      }, 
      (error) => {
        console.error(`获取聊天 ${chatId} 消息失败:`, error);
        callback([]);
      }
    );
};

export const getNotificationsForUser = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'notifications'), where('receiverId', '==', userId), orderBy('timestamp', 'desc'), limit(30));
  return onSnapshot(q, 
    async (snapshot) => {
      const notifications = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        const senderProfile = await getUserProfile(data.senderId);
        return { id: doc.id, ...data, sender: senderProfile };
      }));
      callback(notifications);
    }, 
    (error) => {
      console.error("获取通知列表失败:", error);
      callback([]);
    }
  );
};
