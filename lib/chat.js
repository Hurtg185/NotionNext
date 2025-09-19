// lib/chat.js

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
  getDoc
} from 'firebase/firestore'

// startChat 函数保持不变
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

// getConversationsForUser 函数保持不变
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

// getMessagesForChat 函数保持不变
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

// sendMessage 函数保持不变
export const sendMessage = async (chatId, text, senderId) => {
  if (!text.trim()) return;
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  await addDoc(messagesRef, { senderId, text, timestamp: serverTimestamp() });
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, { lastMessage: text, lastMessageTimestamp: serverTimestamp() });
};


// 【优化】getUserProfile - 确保返回包含 id 的完整对象，并处理 Timestamp
export const getUserProfile = async (uid) => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // 预处理 Timestamp, 以便未来在 getServerSideProps 中使用
            const serializedData = Object.keys(userData).reduce((acc, key) => {
              if (userData[key]?.toDate) {
                acc[key] = userData[key].toDate().toISOString();
              } else {
                acc[key] = userData[key];
              }
              return acc;
            }, {});
            // 返回包含 id 的完整对象
            return { id: userDoc.id, ...serializedData };
        }
    } catch (error) { console.error("getUserProfile: 获取用户信息失败:", error); }
    // 如果找不到用户，返回一个包含 id 的默认对象
    return { id: uid, displayName: '未知用户', photoURL: 'https://www.gravatar.com/avatar?d=mp' };
};
