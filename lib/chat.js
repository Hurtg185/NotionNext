// lib/chat.js (返璞归真最终修复版)

import { db } from './firebase'
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
  writeBatch
} from 'firebase/firestore'

// startChat 函数已经稳定，保持不变
export const startChat = async (currentUserUid, targetUserUid) => {
  if (currentUserUid === targetUserUid) return null;
  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserUid, targetUserUid].sort();
  const q = query(chatsRef, where('participants', '==', participantsSorted));
  
  const querySnapshot = await getDocs(q);
  let chatId = null;
  querySnapshot.forEach(doc => { chatId = doc.id; });

  if (!chatId) {
    const newChatRef = await addDoc(chatsRef, {
      participants: participantsSorted,
      lastMessage: '对话已创建',
      lastMessageTimestamp: serverTimestamp(),
    });
    chatId = newChatRef.id;
  }
  
  try {
    const convDoc = await getDoc(doc(db, 'chats', chatId));
    if (convDoc.exists()) {
      return { id: convDoc.id, ...convDoc.data() };
    }
  } catch (error) { console.error("startChat: 获取对话数据失败:", error); }
  return null;
};

// 【核心修复】: 回归最简单的 onSnapshot 实现，移除所有 getDocs 优化
export const getConversationsForUser = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {}; 
  }
  
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTimestamp', 'desc')
  );

  const unsubscribe = onSnapshot(q, snapshot => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(conversations);
  }, error => {
    console.error("getConversationsForUser: Firestore 错误:", error);
    callback([]);
  });
  return unsubscribe;
};

// 【核心修复】: 确保这个函数也是最简单、最可靠的 onSnapshot 实现
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

// 【核心修复】: sendMessage 回归到最简单的 addDoc 和 updateDoc，移除 writeBatch
// 虽然 batch 很好，但简单的 add/update 更容易调试，且对于这个场景足够用
export const sendMessage = async (chatId, text, senderId) => {
  if (!text.trim()) return;
  
  // 1. 添加新消息
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  await addDoc(messagesRef, {
    senderId,
    text, // 注意：我们只支持发送文本
    timestamp: serverTimestamp()
  });

  // 2. 更新对话的最后一条消息
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    lastMessage: text,
    lastMessageTimestamp: serverTimestamp()
  });
};


// getUserProfile 函数已稳定，保持不变
export const getUserProfile = async (uid) => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            return userDoc.data();
        }
    } catch (error) { console.error("getUserProfile: 获取用户信息失败:", error); }
    return { displayName: '未知用户', photoURL: 'https://www.gravatar.com/avatar?d=mp' };
};
