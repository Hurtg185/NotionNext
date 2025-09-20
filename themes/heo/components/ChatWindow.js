// themes/heo/components/ChatWindow.js (最终修复版 - 键盘避让优化 + 所有功能整合)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead, sendMessage } from '@/lib/chat';
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext';

import EmojiPicker, { Theme } from 'emoji-picker-react';
import TextareaAutosize from 'react-textarea-autosize';

// 【修改】不再使用全局变量直接记录 window.innerHeight，改为在组件内部 useRef
// let windowHeightWithoutKeyboard = 0; // 删除或注释掉这行

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

  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const textareaRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const footerRef = useRef(null);

  // 【修改】使用 useRef 存储初始视口高度，并在客户端初始化
  const initialViewportHeightRef = useRef(0); 

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
    const loadBackground = () => {
      if (typeof window !== 'undefined') {
        const savedBackground = localStorage.getItem(`chat_background_${chatId}`);
        setBackground(savedBackground || 'default');
      }
    };
    loadBackground();
    if (typeof window !== 'undefined') {
      const handleBackgroundChange = (event) => setBackground(event.detail.background);
      window.addEventListener('chat-background-change', handleBackgroundChange);
      return () => window.removeEventListener('chat-background-change', handleBackgroundChange);
    }
  }, [chatId]);
  
  // 5. 点击外部关闭表情选择器
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleClickOutside(event) {
      if (emojiPickerRef.current && emojiPickerRef.current.contains(event.target)) return;
      const emojiButton = document.querySelector('[aria-label="选择表情"]');
      if (emojiButton && emojiButton.contains(event.target)) return;
      setShowEmojiPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerRef]);

  // 【核心修改】优化键盘避让逻辑，采用 visualViewport 或更精确的 resize 处理
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 首次挂载时，记录初始视口高度 (假设此时键盘未弹起)
    // 并且只记录一次，作为基准
    if (initialViewportHeightRef.current === 0) {
      initialViewportHeightRef.current = window.innerHeight;
    }

    const handleViewportChange = () => {
      const currentViewportHeight = window.innerHeight;
      let calculatedKeyboardHeight = 0;

      // 优先使用 visualViewport.height (更精确)
      if (window.visualViewport) {
        calculatedKeyboardHeight = initialViewportHeightRef.current - window.visualViewport.height;
      } else {
        // Fallback 到 window.innerHeight
        // 只有当当前视口高度小于初始高度时，才认为是键盘弹起
        if (currentViewportHeight < initialViewportHeightRef.current) {
          calculatedKeyboardHeight = initialViewportHeightRef.current - currentViewportHeight;
        }
      }
      
      // 设置一个最小阈值，防止微小变化被误判为键盘
      if (calculatedKeyboardHeight < 80) { // 提高阈值，键盘通常在80px以上
        setKeyboardHeight(0);
      } else {
        setKeyboardHeight(calculatedKeyboardHeight);
      }
    };

    // 监听 resize 事件 (window.innerHeight 变化)
    window.addEventListener('resize', handleViewportChange);
    // 监听 visualViewport resize 事件 (更精确的可见视口变化)
    // 优先使用 visualViewport 的事件
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    
    // 组件卸载时，移除事件监听
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []); // 空数组确保只在挂载时设置事件监听


  const getTopBarRoleTag = (profile) => {
    if (!profile) return null;
    if (profile.isAdmin) {
      return (
        <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full ml-2 font-bold flex items-center">
          <i className="fas fa-crown text-xs mr-1"></i> 站长
        </span>
      );
    } else if (profile.isModerator) {
      return (
        <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full ml-2 font-bold flex items-center">
          <i className="fas fa-shield-alt text-xs mr-1"></i> 管理员
        </span>
      );
    }
    return null;
  };

  const handleTopBarClick = () => {
    if (otherUser?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${otherUser.id}`), 100);
    }
  };

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

  if (isLoading || !otherUser) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 animate-pulse">
        <header className="flex-shrink-0 p-3 h-14 flex justify-between items-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-b border-gray-200/20 dark:border-gray-700/20">
          <div className="flex-grow flex justify-center items-center">
            <div className="h-5 w-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 flex items-center justify-center text-gray-500 dark:text-gray-400">
          加载中...
        </main>
        <footer className="flex-shrink-0 p-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-t border-gray-200/20 dark:border-gray-700/20">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </footer>
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
        <div 
          className="flex-grow flex justify-center items-center relative cursor-pointer"
          onClick={handleTopBarClick}
        >
          <h2 className="font-bold text-lg text-center truncate">{otherUser?.displayName || '未知用户'}</h2>
          {getTopBarRoleTag(otherUser)}
        </div>
        <button 
          onClick={() => setShowSettings(true)} 
          className={`p-2 rounded-full transition ${isBgImage ? 'text-white/80 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <i className="fas fa-ellipsis-v"></i>
        </button>
      </header>
      
      {/* 【核心修改】main 区域的 padding-bottom 动态调整 */}
      <main 
        className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden p-4"
        style={{ paddingBottom: `calc(1rem + ${keyboardHeight}px)` }} // 底部留出键盘空间
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

      {/* --- 【核心修改】Footer 区域，只保留 fixed 定位，不进行 transform 移动 --- */}
      <footer 
        ref={footerRef} 
        className={`fixed bottom-0 left-0 right-0 z-20 flex-shrink-0 p-3 ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg transition-transform duration-200 ease-in-out`}
        // 【删除】 style={{ transform: `translateY(${-keyboardHeight}px)` }} // 移除 footer 的 translateY 移动
      >
        <div className="relative">
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-30">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} />
            </div>
          )}
          <div className="flex items-end space-x-2">
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

      {showSettings && <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />}
    </div>
  );
};

export default ChatWindow;
