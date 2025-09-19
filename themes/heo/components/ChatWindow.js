// themes/heo/components/ChatWindow.js (完整且已修复)

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead } from '@/lib/chat';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext'; // 【核心】引入 useDrawer

const ChatWindow = ({ chatId, conversation }) => {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { closeDrawer } = useDrawer(); // 【核心】获取 closeDrawer
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [background, setBackground] = useState('default');
  const messagesEndRef = useRef(null);

  useEffect(() => { /* 获取对方用户信息的 useEffect 保持不变 */ }, [conversation, currentUser]);
  useEffect(() => { /* 监听消息列表的 useEffect 保持不变 */ }, [chatId, currentUser]);
  useEffect(() => { /* 滚动到底部的 useEffect 保持不变 */ }, [messages]);

  useEffect(() => {
    const loadBackground = () => {
      // 【修复】统一 Local Storage Key
      const savedBackground = localStorage.getItem(`chat_background_${chatId}`);
      setBackground(savedBackground || 'default');
    };
    loadBackground();
    // 【修复】统一事件名
    const handleBackgroundChange = (event) => setBackground(event.detail.background);
    window.addEventListener('chat-background-change', handleBackgroundChange);
    return () => window.removeEventListener('chat-background-change', handleBackgroundChange);
  }, [chatId]);

  const getTopBarRoleTag = (profile) => { /* ... */ };

  // 【核心】处理顶栏点击跳转
  const handleTopBarClick = () => {
    if (otherUser?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${otherUser.id}`), 100);
    }
  };

  if (isLoading || !otherUser) {
    return <div className="animate-pulse">...</div>;
  }

  const isBgImage = background !== 'default';

  return (
    <div
      className={`relative flex flex-col h-full ${!isBgImage ? 'bg-gray-50 dark:bg-gray-900' : 'bg-cover bg-center'}`}
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {isBgImage && <div className="absolute inset-0 bg-black/30 z-0"></div>}

      <header className={`relative z-10 flex-shrink-0 p-3 h-14 flex justify-between items-center ${/*...*/}`}>
        <div 
          className="flex-grow flex justify-center items-center relative cursor-pointer"
          onClick={handleTopBarClick}
        >
          <h2 className="font-bold text-lg text-center truncate">{otherUser?.displayName || '未知用户'}</h2>
          {getTopBarRoleTag(otherUser)}
        </div>
        <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition ${/*...*/}`}>
          <i className="fas fa-ellipsis-v"></i>
        </button>
      </header>
      
      <main className="relative z-0 flex-grow overflow-y-auto p-4">
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

      <footer className={`relative z-10 flex-shrink-0 p-3 ${/*...*/}`}>
        <ChatInput chatId={chatId} conversation={conversation} />
      </footer>

      {showSettings && <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />}
    </div>
  );
};

export default ChatWindow;
