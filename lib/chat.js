// 文件路径: lib/chat.js (简化版 - 只包含操作)

import { db } from './firebase';
import {
  doc,
  updateDoc,
  collection,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';

// 注意：这个文件不再导入任何来自 lib/user.js 的函数

/**
 * [保留] 发送消息
 * @param {Object} currentUser
 * @param {string} chatId
 * @param {string} text
 * @returns {Promise<Object>}
 */
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

/**
 * [保留] 标记聊天为已读
 * @param {string} chatId
 * @param {string} userId
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
        const chatSnap = await getDoc(chatRef); // getDoc 需要从 firestore 导入
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
