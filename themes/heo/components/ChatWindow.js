// themes/heo/components/ChatWindow.js (修改后，集成输入框和表情功能)

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead, sendMessage } from '@/lib/chat'; // 假设 sendMessage 也在这里
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext';
import EmojiPicker, { Theme } from 'emoji-picker-react'; // 1. 导入表情选择器

const ChatWindow = ({ chatId, conversation }) => {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { closeDrawer } = useDrawer();
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [background, setBackground] = useState('default');
  const messagesEndRef = useRef(null);

  // --- 新增 State 用于输入框 ---
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  
  // 1. 获取对方用户信息
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      if (currentUser && conversation) {
        const targetId = conversation.participants.find(p => p !== currentUser.uid);
        if (targetId) {
          const profile = await getUserProfile(targetId);
          setOtherUser(profile);
        }
      }
      setIsLoading(false);
    };
    fetchData();
  }, [conversation, currentUser]);

  // 2. 实时获取聊天消息
  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = getMessagesForChat(chatId, (newMessages) => {
      setMessages(newMessages);
      if (currentUser && newMessages.length > 0) {
        markChatAsRead(chatId, currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser]);

  // 3. 聊天消息滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. 加载和监听聊天背景变化
  useEffect(() => {
    const savedBackground = localStorage.getItem(`chat_background_${chatId}`);
    setBackground(savedBackground || 'default');
    // ... (你的背景变化监听逻辑保持不变)
  }, [chatId]);
  
  // 5. 点击外部关闭表情选择器
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerRef]);

  // --- 新增函数用于处理输入和发送 ---
  const onEmojiClick = (emojiObject) => {
    setNewMessage(prevMsg => prevMsg + emojiObject.emoji);
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    try {
      await sendMessage(currentUser, chatId, newMessage);
      setNewMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Failed to send message:", error);
      // 在这里可以用 react-toastify 提示用户发送失败
    }
  };


  if (isLoading || !otherUser) {
    // 骨架屏 (保持不变)
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 animate-pulse">
        {/* ... */}
      </div>
    );
  }

  const isBgImage = background !== 'default';

  return (
    <div
      className="relative flex flex-col h-full w-full overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {!isBgImage && <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 z-0"></div>}
      {isBgImage && <div className="absolute inset-0 bg-black/30 z-0"></div>}

      <header 
        className={`relative z-20 flex-shrink-0 p-3 h-14 flex justify-between items-center ${isBgImage ? 'bg-black/20 text-white' : 'bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white'} border-b border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}
      >
        {/* ... (你的 header 内容保持不变) ... */}
      </header>
      
      <main className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden p-4">
        {messages.map(msg => (
          <ChatMessage 
            key={msg.id} 
            message={msg} 
            chatId={chatId}
            currentUserProfile={currentUser}
            otherUserProfile={otherUser}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* --- 修改后的 Footer，直接包含输入框和表情功能 --- */}
      <footer 
        className={`relative z-20 flex-shrink-0 p-3 ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}
      >
        <div className="relative">
          {/* 表情选择器 */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-2 z-30">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} />
            </div>
          )}
          <div className="flex items-center space-x-2">
            {/* 表情按钮 */}
            <button
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`p-2 rounded-full transition ${isBgImage ? 'text-white/80 hover:bg-white/20' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              <i className="far fa-smile text-xl"></i>
            </button>
            {/* 文本输入框 */}
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
              placeholder="输入消息..."
              className={`flex-grow px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${isBgImage ? 'bg-black/30 text-white placeholder-gray-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}`}
            />
            {/* 发送按钮 */}
            <button
              onClick={handleSendMessage}
              className="p-2 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 focus:outline-none disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={!newMessage.trim()}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </footer>
      {/* --- Footer 修改结束 --- */}

      {showSettings && <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />}
    </div>
  );
};

export default ChatWindow;
