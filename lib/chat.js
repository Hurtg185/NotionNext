// 文件路径: lib/chat.js (已确保 startChat 正确导出)

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
  Timestamp,
} from 'firebase/firestore';

// 确保从 lib/user 导入 getUserProfile
import { getUserProfile } from './user'; 

/**
 * [已导出] 获取或创建聊天室。
 * @param {string} currentUserId
 * @param {string} targetUserUid - 修正参数名以匹配 getUserProfile
 * @returns {Promise<Object|null>} chatData (包含 id)
 */
export const startChat = async (currentUserId, targetUserUid) => { // 修正参数名
  if (currentUserId === targetUserUid) {
    console.error("startChat: 无法与自己聊天。");
    return null;
  }
  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserId, targetUserUid].sort(); 
  
  const q = query(chatsRef, where('participants', '==', participantsSorted));
  let querySnapshot = await getDocs(q);
  let chatData = null;

  if (!querySnapshot.empty) {
    const chatDoc = querySnapshot.docs[0];
    chatData = { id: chatDoc.id, ...chatDoc.data() };
  } else {
    try {
        const newChatRef = await addDoc(chatsRef, {
            participants: participantsSorted,
            lastMessage: '对话已创建',
            lastMessageTimestamp: serverTimestamp(),
            initiator: currentUserId,
            isEstablished: false,
            initiatorMessageCount: 0,
            lastRead: {
                [currentUserId]: serverTimestamp(),
                [targetUserUid]: new Date(0)
            },
            createdAt: serverTimestamp()
        });
        const newDocSnap = await getDoc(newChatRef);
        chatData = { id: newDocSnap.id, ...newDocSnap.data() };
    } catch (error) {
        console.error("创建聊天室失败:", error);
        return null;
    }
  }
  return chatData;
};

/**
 * 获取用户的所有对话列表。
 * @param {string} userId
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const getConversationsForUser = (userId, callback) => {
  if (!userId) {
    console.warn("getConversationsForUser: userId 为空。");
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
 * 获取特定聊天室的消息列表。
 * @param {string} chatId
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const getMessagesForChat = (chatId, callback) => {
    if (!chatId) {
        console.warn("getMessagesForChat: chatId 为空，无法获取消息。");
        callback([]);
        return () => {};
    }
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc')); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    }, (error) => {
        console.error(`获取 chatId 为 ${chatId} 的消息时出错:`, error);
        callback([]);
    });
    return unsubscribe;
};

/**
 * 发送消息，支持文本和媒体。
 * @param {Object} currentUser - 当前用户对象 (必须包含 uid, isAdmin, isModerator)
 * @param {string} chatId - 聊天室ID
 * @param {Object} messagePayload - 消息内容
 * @param {string} messagePayload.text - 文本内容
 * @param {string} [messagePayload.mediaUrl] - 媒体URL
 * @param {string} [messagePayload.mediaType] - 'image', 'video', 'audio'
 * @param {string} [messagePayload.thumbnailUrl] - 媒体缩略图URL
 */
export const sendMessage = async (currentUser, chatId, { text, mediaUrl, mediaType, thumbnailUrl }) => {
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

        const canSendMessage = 
            currentUser.isAdmin || 
            currentUser.isModerator || 
            chatData.isEstablished || 
            !isInitiator || 
            (isInitiator && chatData.initiatorMessageCount < 3);

        if (!canSendMessage) {
          throw new Error("消息发送达到上限，请等待对方回复。");
        }

        const messageData = {
            senderId,
            text: contentText,
            timestamp: serverTimestamp()
        };
        if (mediaUrl && mediaType) {
            messageData.mediaUrl = mediaUrl;
            messageData.mediaType = mediaType;
            messageData.thumbnailUrl = thumbnailUrl || null; // 保存缩略图URL
        }

        const chatUpdateData = {};
        if (!chatData.isEstablished && !isInitiator) {
            chatUpdateData.isEstablished = true;
        } else if (isInitiator && !chatData.isEstablished) {
            chatUpdateData.initiatorMessageCount = chatData.initiatorMessageCount + 1;
        }

        let lastMessageText = contentText;
        if (mediaUrl) {
            const typeText = mediaType === 'image' ? '[图片]' : mediaType === 'video' ? '[视频]' : mediaType === 'audio' ? '[语音]' : '[媒体]';
            lastMessageText = contentText ? `${typeText} ${contentText}` : typeText;
        }
        chatUpdateData.lastMessage = lastMessageText.substring(0, 100);
        chatUpdateData.lastMessageTimestamp = serverTimestamp();
        
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

/**
 * 将指定聊天室的所有消息标记为已读（针对当前用户）。
 * @param {string} chatId
 * @param {string} userId - 当前用户ID
 */
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

/**
 * 获取通知的函数 (保持不变)
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
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const notifications = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      // 这里确保调用从 lib/user 导入的 getUserProfile
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
