// themes/heo/components/ChatWindow.js (完整最终版)

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead } from '@/lib/chat';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext';

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
    const loadBackground = () => {
      const savedBackground = localStorage.getItem(`chat_background_${chatId}`);
      setBackground(savedBackground || 'default');
    };
    loadBackground();
    const handleBackgroundChange = (event) => setBackground(event.detail.background);
    window.addEventListener('chat-background-change', handleBackgroundChange);
    return () => window.removeEventListener('chat-background-change', handleBackgroundChange);
  }, [chatId]);

  // 辅助函数，用于在顶栏显示角色标记
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

  // 处理顶栏点击跳转
  const handleTopBarClick = () => {
    if (otherUser?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${otherUser.id}`), 100);
    }
  };

  if (isLoading || !otherUser) {
    // 骨架屏
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
    // 【核心修复】构建稳健的 Flexbox 布局
    <div
      className="relative flex flex-col h-full w-full overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {/* 如果没有背景图，使用这个 div 作为纯色背景 */}
      {!isBgImage && <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 z-0"></div>}
      {/* 如果有背景图，使用这个 div 作为半透明遮罩 */}
      {isBgImage && <div className="absolute inset-0 bg-black/30 z-0"></div>}

      <header 
        className="relative z-10 flex-shrink-0 p-3 h-14 flex justify-between items-center ${isBgImage ? 'bg-black/20 text-white' : 'bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white'} border-b border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg"
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
      
      {/* 【核心修复】main 区域负责滚动 */}
      <main className="relative z-10 flex-1 w-full overflow-y-auto p-4">
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

      <footer 
        className="relative z-10 flex-shrink-0 p-3 ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg"
      >
        <ChatInput chatId={chatId} conversation={conversation} />
      </footer>

      {showSettings && <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />}
    </div>
  );
};

export default ChatWindow;
