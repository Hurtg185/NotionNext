// lib/chat.js (完整修复版 - getUserProfile 已更新)

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
  updateDoc,
  limit,
  getDoc,
  runTransaction
} from 'firebase/firestore';

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

export const sendMessage = async (currentUser, chatId, text) => {
    if (!text.trim()) return { success: false, message: '消息不能为空' };
    const chatRef = doc(db, 'chats', chatId);
    try {
      await runTransaction(db, async (transaction) => {
        const chatDoc = await transaction.get(chatRef);
        if (!chatDoc.exists()) throw new Error("聊天不存在！");
        const chatData = chatDoc.data();
        const senderId = currentUser.uid;
        const isInitiator = chatData.initiator === senderId;
        const canSendMessage = 
            currentUser.isAdmin || 
            currentUser.isModerator || 
            chatData.isEstablished || 
            !isInitiator || 
            (isInitiator && chatData.initiatorMessageCount < 3);
        if (canSendMessage) {
          if (!chatData.isEstablished && !isInitiator) {
            transaction.update(chatRef, { isEstablished: true });
          } else if (isInitiator && !chatData.isEstablished) {
            transaction.update(chatRef, { initiatorMessageCount: chatData.initiatorMessageCount + 1 });
          }
          const newMessageRef = doc(collection(db, 'chats', chatId, 'messages'));
          transaction.set(newMessageRef, { senderId, text, timestamp: serverTimestamp() });
          transaction.update(chatRef, { lastMessage: text, lastMessageTimestamp: serverTimestamp() });
        } else {
          throw new Error("消息发送达到上限，请等待对方回复。");
        }
      });
      return { success: true };
    } catch (e) {
      console.error("发送消息失败: ", e.message);
      return { success: false, message: e.message };
    }
};

// --- 【核心修改】在 getUserProfile 中增加 isOnline 和 lastSeen 字段 ---
export const getUserProfile = async (uid) => {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userDoc.id,
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
        
        // 【新增】确保返回在线状态数据，并提供默认值
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
        isOnline: false, // 确保即使找不到用户，也有默认的在线状态
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


export const markChatAsRead = async (chatId, userId) => {
  if (!chatId || !userId) return;
  const chatRef = doc(db, 'chats', chatId);
  try {
    await updateDoc(chatRef, {
      [`lastRead.${userId}`]: serverTimestamp()
