// lib/chat.js (完整增强版 - sendMessage 支持媒体)

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
  runTransaction,
  writeBatch // 导入 writeBatch 用于更复杂的操作
} from 'firebase/firestore';

// ... (startChat, getConversationsForUser, getMessagesForChat 函数保持不变)
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


/**
 * [增强版] 发送消息，支持文本和媒体
 * @param {Object} currentUser - 当前用户对象 (必须包含 uid, isAdmin, isModerator)
 * @param {string} chatId - 聊天室ID
 * @param {Object} messageContent - 消息内容
 * @param {string} messageContent.text - 文本内容
 * @param {string} [messageContent.mediaUrl] - 媒体URL
 * @param {string} [messageContent.mediaType] - 'image', 'video', 'audio'
 */
export const sendMessage = async (currentUser, chatId, { text, mediaUrl, mediaType }) => {
    const contentText = text || '';
    if (!contentText.trim() && !mediaUrl) {
        return { success: false, message: '消息不能为空' };
    }
    
    const chatRef = doc(db, 'chats', chatId);
    try {
      await runTransaction(db, async (transaction) => {
        const chatDoc = await transaction.get(chatRef);
        if (!chatDoc.exists()) throw new Error("聊天不存在！");

        const chatData = chatDoc.data();
        const senderId = currentUser.uid;
        const isInitiator = chatData.initiator === senderId;

        // 检查发送权限
        const canSendMessage = 
            currentUser.isAdmin || 
            currentUser.isModerator || 
            chatData.isEstablished || 
            !isInitiator || 
            (isInitiator && chatData.initiatorMessageCount < 3);

        if (!canSendMessage) {
          throw new Error("消息发送达到上限，请等待对方回复。");
        }

        // 准备消息数据
        const messageData = {
            senderId,
            text: contentText,
            timestamp: serverTimestamp()
        };
        if (mediaUrl && mediaType) {
            messageData.mediaUrl = mediaUrl;
            messageData.mediaType = mediaType;
        }

        // 更新聊天室状态
        const chatUpdateData = {};
        if (!chatData.isEstablished && !isInitiator) {
            chatUpdateData.isEstablished = true;
        } else if (isInitiator && !chatData.isEstablished) {
            chatUpdateData.initiatorMessageCount = chatData.initiatorMessageCount + 1;
        }

        // 设置 lastMessage
        let lastMessageText = contentText;
        if (mediaUrl) {
            const typeText = mediaType === 'image' ? '[图片]' : mediaType === 'video' ? '[视频]' : '[语音]';
            lastMessageText = contentText ? `${typeText} ${contentText}` : typeText;
        }
        chatUpdateData.lastMessage = lastMessageText.substring(0, 100); // 限制长度
        chatUpdateData.lastMessageTimestamp = serverTimestamp();
        
        // 执行数据库操作
        const newMessageRef = doc(collection(db, 'chats', chatId, 'messages'));
        transaction.set(newMessageRef, messageData);
        transaction.update(chatRef, chatUpdateData);
      });

      return { success: true };
    } catch (e) {
      console.error("发送消息失败: ", e.message);
      return { success: false, message: e.message };
    }
};

// ... (getUserProfile, markChatAsRead, getNotificationsForUser 保持不变)
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


export const markChatAsRead = async (chatId, userId) => {
  if (!chatId || !userId) return;
  const chatRef = doc(db, 'chats', chatId);
  try {
    await updateDoc(chatRef, {
      [`lastRead.${userId}`]: serverTimestamp() 
    });
  } catch (error) {
    console.warn("Could not mark chat as read using dot notation, trying fallback. Error:", error.message);
    try {
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
            const chatData = chatSnap.data();
            const newLastRead = { ...chatData.lastRead, [userId]: serverTimestamp() };
            await updateDoc(chatRef, { lastRead: newLastRead });
        }
    } catch (fallbackError) {
        console.error("Error marking chat as read (fallback failed):", fallbackError);
    }
  }
};

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
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const notifications = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      const senderProfile = await getUserProfile(data.senderId);
      return {
        id: doc.id,
        ...data,
        sender: senderProfile
      };
    }));
    callback(notifications);
  }, (error) => {
    console.error("获取通知列表失败:", error);
    callback([]);
  });
  return unsubscribe;
};
