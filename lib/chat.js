// lib/chat.js (最终性能和BUG修复版)

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

export const startChat = async (currentUserUid, targetUserUid) => {
  if (currentUserUid === targetUserUid) return null;
  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserUid, targetUserUid].sort();
  const q = query(chatsRef, where('participants', '==', participantsSorted));
  
  const querySnapshot = await getDocs(q);
  let existingChatId = null;
  querySnapshot.forEach(doc => { existingChatId = doc.id; });

  let chatId = existingChatId;
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
  } catch (error) { console.error("获取对话数据失败:", error); }
  return null;
};

// 【核心修复 1】: 优化加载速度
export const getConversationsForUser = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTimestamp', 'desc')
  );

  // 立即获取一次初始数据，解决冷启动慢的问题
  getDocs(q).then(snapshot => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(conversations, false); // 第二个参数 false 表示非加载中
  });

  // 然后再设置实时监听器
  const unsubscribe = onSnapshot(q, snapshot => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(conversations, false);
  });
  return unsubscribe;
};

// 【核心修复 2】: 确保消息实时更新
export const getMessagesForChat = (chatId, callback) => {
    if (!chatId) return () => {};
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    // onSnapshot 会在第一次调用时返回完整的当前快照，并在后续更新时实时触发
    // 它本身就能处理初始加载，无需再 getDocs
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
    return unsubscribe;
};

export const sendMessage = async (chatId, text, senderId) => {
  if (!text.trim()) return;
  const chatRef = doc(db, 'chats', chatId);
  const messagesRef = collection(chatRef, 'messages');

  // 使用 writeBatch 保证原子性操作，要么都成功，要么都失败
  const batch = writeBatch(db);

  // 1. 添加新消息
  const newMessageRef = doc(collection(db, `chats/${chatId}/messages`));
  batch.set(newMessageRef, {
    senderId,
    text,
    timestamp: serverTimestamp()
  });

  // 2. 更新对话的最后一条消息
  batch.update(chatRef, {
    lastMessage: text,
    lastMessageTimestamp: serverTimestamp()
  });

  await batch.commit();
};

export const getUserProfile = async (uid) => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            return userDoc.data();
        }
    } catch (error) { console.error("获取用户信息失败:", error); }
    return { displayName: '未知用户', photoURL: 'https://www.gravatar.com/avatar?d=mp' };
};
