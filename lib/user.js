// 文件路径: lib/user.js (数据获取中心)

import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  doc,
  limit,
  getDoc,
} from 'firebase/firestore';

// ===================================================================
// USER & PROFILE FUNCTIONS (从您之前的 lib/chat.js 移入)
// ===================================================================

/**
 * [已移动] 获取单个用户信息的函数
 * @param {string} uid - 用户ID
 * @returns {Promise<Object|null>}
 */
export const getUserProfile = async (uid) => {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userDoc.id,
        uid: userDoc.id, // 兼容 uid 写法
        displayName: userData.displayName || '未知用户',
        photoURL: userData.photoURL || null,
        bio: userData.bio || '',
        gender: userData.gender || 'not-specified',
        birthDate: userData.birthDate || '',
        occupation: userData.occupation || '',
        nationality: userData.nationality || '',
        learningLanguage: userData.learningLanguage || '',
        hometown: userData.hometown || '',
        currentCity: userData.currentCity || '',
        isOnline: userData.isOnline || false,
        lastSeen: userData.lastSeen || null,
        ...userData
      };
    } else {
      console.warn(`User profile not found for UID: ${uid}`);
      return { 
        id: uid, 
        displayName: '未知用户', 
        photoURL: null, 
        isOnline: false,
        lastSeen: null 
      };
    }
  } catch (error) {
    console.error("Error fetching user profile for UID:", uid, error);
    return { 
      id: uid, 
      displayName: '加载出错', 
      photoURL: null, 
      isOnline: false,
      lastSeen: null
    };
  }
};

// ===================================================================
// CHAT DATA FUNCTIONS (从您之前的 lib/chat.js 移入)
// ===================================================================

/**
 * [已移动] 获取或创建聊天室。
 * @param {string} currentUserId
 * @param {string} targetUserUid
 * @returns {Promise<Object|null>} chatData
 */
export const startChat = async (currentUserUid, targetUserUid) => {
  if (currentUserUid === targetUserUid) return null;
  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserUid, targetUserUid].sort();
  const q = query(chatsRef, where('participants', '==', participantsSorted));
  let querySnapshot = await getDocs(q);
  let chatData = null;
  if (!querySnapshot.empty) {
    const chatDoc = querySnapshot.docs[0];
    chatData = { id: chatDoc.id, ...chatDoc.data() };
  } else {
    const newChatRef = await addDoc(chatsRef, {
      participants: participantsSorted,
      lastMessage: '对话已创建',
      lastMessageTimestamp: serverTimestamp(),
      initiator: currentUserUid,
      isEstablished: false,
      initiatorMessageCount: 0,
      lastRead: {
        [currentUserUid]: serverTimestamp(),
        [targetUserUid]: new Date(0)
      }
    });
    const newDocSnap = await getDoc(newChatRef);
    chatData = { id: newDocSnap.id, ...newDocSnap.data() };
  }
  return chatData;
};

/**
 * [已移动] 获取用户的所有对话列表。
 * @param {string} userId
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const getConversationsForUser = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId), orderBy('lastMessageTimestamp', 'desc'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(conversations);
  }, error => {
    console.error("getConversationsForUser: Firestore 错误:", error);
    callback([]);
  });
  return unsubscribe;
};

/**
 * [已移动] 获取特定聊天室的消息列表。
 * @param {string} chatId
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const getMessagesForChat = (chatId, callback) => {
    if (!chatId) {
        callback([]);
        return () => {};
    }
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    }, error => {
        console.error("getMessagesForChat: Firestore 错误:", error);
        callback([]);
    });
    return unsubscribe;
};

// ===================================================================
// NOTIFICATION FUNCTIONS (从您之前的 lib/chat.js 移入)
// ===================================================================

/**
 * [已移动] 获取通知的函数
 * @param {string} userId
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const getNotificationsForUser = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'notifications'),
    where('receiverId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(30)
  );
  // 这里不再需要 async/await Promise.all，因为 getUserProfile 已经移到了同一个文件
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      // 直接调用本文件内的函数，不会产生依赖问题
      // 注意：为了性能，这里最好只获取 sender 的简要信息，而不是完整的 profile
      // 但为了保持逻辑，我们暂时保留
      // const senderProfile = await getUserProfile(data.senderId); 
      return {
        id: doc.id,
        ...data,
        // sender: senderProfile // 暂时注释掉以提高性能和避免异步问题
      };
    });
    // 如果需要发送者信息，最好在前端单独获取
    callback(notifications);
  }, (error) => {
    console.error("获取通知列表失败:", error);
    callback([]);
  });
  return unsubscribe;
};
