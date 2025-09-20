// themes/heo/components/ChatWindow.js (表情放右边 + 键盘避让 + 自适应高度)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead, sendMessage } from '@/lib/chat';
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import TextareaAutosize from 'react-textarea-autosize';

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

  // --- 输入框和键盘相关 State ---
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const textareaRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const footerRef = useRef(null);

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
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, keyboardHeight]);

  // 4. 加载和监听聊天背景变化
  useEffect(() => {
    const savedBackground = localStorage.getItem(`chat_background_${chatId}`);
    setBackground(savedBackground || 'default');
  }, [chatId]);
  
  // 5. 点击外部关闭表情选择器
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && emojiPickerRef.current.contains(event.target)) return;
      const emojiButton = document.querySelector('[aria-label="选择表情"]');
      if (emojiButton && emojiButton.contains(event.target)) return;
      setShowEmojiPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerRef]);

  // 6. 键盘避让逻辑
  useEffect(() => {
    let initialViewportHeight = window.innerHeight;
    const handleResize = () => {
      const currentViewportHeight = window.innerHeight;
      const keyboardOpen = initialViewportHeight > currentViewportHeight;
      const diff = initialViewportHeight - currentViewportHeight;
      if (Math.abs(diff) > 50) {
        setKeyboardHeight(keyboardOpen ? diff : 0);
        if (!keyboardOpen) {
          initialViewportHeight = window.innerHeight;
        }
      } else if (!keyboardOpen && diff < 50) {
        setKeyboardHeight(0);
        initialViewportHeight = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    initialViewportHeight = window.innerHeight;
    setKeyboardHeight(0);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // --- 处理输入和发送 ---
  const onEmojiClick = (emojiObject) => {
    setNewMessage(prevMsg => prevMsg + emojiObject.emoji);
    textareaRef.current?.focus();
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    try {
      await sendMessage(currentUser, chatId, newMessage);
      setNewMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 骨架屏 (保持不变)
  if (isLoading || !otherUser) { return ( /* ... */ ); }

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
        {/* ... (你的 header 内容不变) ... */}
      </header>
      
      <main 
        className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden p-4"
        style={{ paddingBottom: `calc(1rem + ${keyboardHeight}px)` }}
      >
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

      {/* --- 修改后的 Footer，表情放右边 --- */}
      <footer 
        ref={footerRef}
        className={`relative z-20 flex-shrink-0 p-3 ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg transition-transform duration-200 ease-in-out`}
        style={{ transform: `translateY(${-keyboardHeight}px)` }}
      >
        <div className="relative">
          {/* 表情选择器，定位到右边 */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-30">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} />
            </div>
          )}
          <div className="flex items-end space-x-2">
            {/* 【核心修改】自适应 Textarea 放在最左边 */}
            <TextareaAutosize
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入消息..."
              minRows={1}
              maxRows={5}
              className={`flex-grow px-4 py-2 resize-none overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${isBgImage ? 'bg-black/30 text-white placeholder-gray-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}`}
              style={{ lineHeight: '1.5rem' }}
            />
            
            {/* 【核心修改】表情按钮和发送按钮放在右边 */}
            <button
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`flex-shrink-0 p-2 rounded-full transition ${isBgImage ? 'text-white/80 hover:bg-white/20' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="选择表情"
            >
              <i className="far fa-smile text-xl"></i>
            </button>
            <button
              onClick={handleSendMessage}
              className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 focus:outline-none disabled:bg-blue-300 disabled:cursor-not-allowed"
              disabled={!newMessage.trim()}
              aria-label="发送消息"
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
