// lib/chat.js (最终修复版)

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
  runTransaction // 确保引入 runTransaction
} from 'firebase/firestore'

// startChat, getConversationsForUser, getMessagesForChat 保持不变
// ... (为了简洁，这里省略了未改动的函数，请保留你文件中的原有代码)

export const startChat = async (currentUserUid, targetUserUid) => {
  // 你的 startChat 代码...
  if (currentUserUid === targetUserUid) return null;
  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserUid, targetUserUid].sort();
  const q = query(chatsRef, where('participants', '==', participantsSorted));

  let querySnapshot = await getDocs(q);
  let chatId = null;
  let chatData = null;

  if (!querySnapshot.empty) {
    const chatDoc = querySnapshot.docs[0];
    chatId = chatDoc.id;
    chatData = { id: chatDoc.id, ...chatDoc.data() };
  } else {
    const newChatRef = await addDoc(chatsRef, {
      participants: participantsSorted,
      lastMessage: '对话已创建',
      lastMessageTimestamp: serverTimestamp(),
      initiator: currentUserUid,
      isEstablished: false,
      initiatorMessageCount: 0
    });
    chatId = newChatRef.id;
    const newDocSnap = await getDoc(newChatRef);
    chatData = { id: newDocSnap.id, ...newDocSnap.data() };
  }
  return chatData;
};

export const getConversationsForUser = (userId, callback) => {
  // 你的 getConversationsForUser 代码...
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
  // 你的 getMessagesForChat 代码...
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
    // 你带权限检查的 sendMessage 代码...
    if (!text.trim()) return { success: false, message: '消息不能为空' };
    const chatRef = doc(db, 'chats', chatId);
    try {
      await runTransaction(db, async (transaction) => {
        const chatDoc = await transaction.get(chatRef);
        if (!chatDoc.exists()) throw new Error("聊天不存在！");
        const chatData = chatDoc.data();
        const senderId = currentUser.uid;
        if (currentUser.isAdmin || chatData.isEstablished || chatData.initiator !== senderId || (chatData.initiator === senderId && chatData.initiatorMessageCount < 3)) {
          if (!chatData.isEstablished && chatData.initiator !== senderId) {
            transaction.update(chatRef, { isEstablished: true });
          } else if (chatData.initiator === senderId && !chatData.isEstablished) {
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


/**
 * 【核心修改】: 优化 getUserProfile 函数，使其返回值极其健壮和可预测
 */
export const getUserProfile = async (uid) => {
  // 1. 输入验证
  if (!uid) return null;

  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      // 2. 保证返回对象结构一致，photoURL 字段永远存在
      return {
        id: userDoc.id,
        displayName: userData.displayName || '未知用户',
        // 关键: 即使 Firestore 中没有 photoURL 字段，也返回一个 null，而不是 undefined
        photoURL: userData.photoURL || null,
        ...userData // 包含其他所有字段如 isAdmin
      };
    } else {
      // 3. 即使找不到用户，也返回一个结构一致的 fallback 对象
      console.warn(`User profile not found for UID: ${uid}`);
      return {
        id: uid,
        displayName: '未知用户',
        photoURL: null // 保持 photoURL 字段存在
      };
    }
  } catch (error) {
    console.error("Error fetching user profile for UID:", uid, error);
    // 4. 即使查询出错，也返回一个带错误提示的、结构一致的 fallback 对象
    return {
      id: uid,
      displayName: '加载出错',
      photoURL: null // 保持 photoURL 字段存在
    };
  }
};
