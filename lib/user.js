// lib/user.js (最终整合版 - 已包含所有数据获取函数)

import {
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc, increment, orderBy, setDoc, addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// =================================================================
// HELPERS
// =================================================================

const getUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return [];
  const users = [];
  for (let i = 0; i < userIds.length; i += 30) {
    const chunk = userIds.slice(i, i + 30);
    const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      users.push({ uid: doc.id, ...doc.data() });
    });
  }
  return users;
};

// 【重要】将 getUsersByIds 也导出，以便在其他地方复用
export { getUsersByIds };

export const getUserProfile = async (userId) => {
  if (!userId) return null;
  const userRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? { id: docSnap.id, uid: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error(`获取用户 ${userId} 资料失败:`, error);
    return null;
  }
};

// =================================================================
// USER PROFILE MANAGEMENT (保持不变)
// =================================================================

export const uploadProfilePicture = async (userId, file) => { /* ... (函数体无变化) ... */ };
export const uploadUserBackground = async (userId, file) => { /* ... (函数体无变化) ... */ };
export const updateUserProfile = async (userId, data) => { /* ... (函数体无变化) ... */ };
export const searchUsersByNickname = async (searchTerm) => { /* ... (函数体无变化) ... */ };

// =================================================================
// SOCIAL RELATIONSHIPS (保持不变)
// =================================================================

export const followUser = async (currentUserId, targetUserId) => { /* ... (函数体无变化) ... */ };
export const unfollowUser = async (currentUserId, targetUserId) => { /* ... (函数体无变化) ... */ };
export const checkFollowing = async (currentUserId, targetUserId) => { /* ... (函数体无变化) ... */ };
export const blockUser = async (currentUserId, targetUserId) => { /* ... (函数体无变化) ... */ };
export const unblockUser = async (currentUserId, targetUserId) => { /* ... (函数体无变化) ... */ };
export const checkBlocked = async (currentUserId, targetUserId) => { /* ... (函数体无变化) ... */ };

// =================================================================
// USER CONTENT (POSTS, FAVORITES, HISTORY)
// =================================================================

export const getPostsByUser = (userId, callback) => { /* ... (函数体无变化) ... */ };
export const getFavoritesByUser = (userId, callback) => { /* ... (函数体无变化) ... */ };
export const getViewHistoryByUser = (userId, callback) => { /* ... (函数体无变化) ... */ };

// =================================================================
// SOCIAL LISTS (FOLLOWING, FOLLOWERS, FRIENDS)
// =================================================================

export const getFollowing = (userId, callback) => { /* ... (函数体无变化) ... */ };
export const getFollowers = (userId, callback) => { /* ... (函数体无变化) ... */ };
export const getFriends = (userId, callback) => { /* ... (函数体无变化) ... */ };

// =================================================================
// APP-SPECIFIC FEATURES (e.g., Language Partners)
// =================================================================

export const getLanguagePartners = (callback) => { /* ... (函数体无变化) ... */ };

// =================================================================
// [新增] CHAT DATA FETCHING FUNCTIONS (从 chat.js 移动过来)
// =================================================================

export const startChat = async (currentUserId, targetUserUid) => {
  if (currentUserId === targetUserUid) {
    console.error("startChat: 无法与自己聊天。");
    return null;
  }
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
        lastMessage: '对话已创建',
        lastMessageTimestamp: serverTimestamp(),
        initiator: currentUserId,
        isEstablished: false,
        initiatorMessageCount: 0,
        lastRead: { [currentUserId]: serverTimestamp(), [targetUserUid]: new Date(0) },
        createdAt: serverTimestamp()
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
  if (!userId) {
    callback([]);
    return () => {};
  }
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
    if (!chatId) {
        callback([]);
        return () => {};
    }
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
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'notifications'), where('receiverId', '==', userId), orderBy('timestamp', 'desc'), limit(30));
  return onSnapshot(q, 
    async (snapshot) => {
      const notifications = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        const senderProfile = await getUserProfile(data.senderId); // 内部调用
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
