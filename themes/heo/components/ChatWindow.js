// themes/heo/components/ChatWindow.js (JSX语法修复版)

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getMessagesForChat, getUserProfile } from '@/lib/chat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import ChatSettingsPanel from './ChatSettingsPanel'

const ChatWindow = ({ chatId, conversation }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const messagesEndRef = useRef(null)
  const [showSettings, setShowSettings] = useState(false);
  const [background, setBackground] = useState('bg-gray-50 dark:bg-gray-900');

  useEffect(() => {
    const loadBackground = () => {
      const savedBg = localStorage.getItem(`chat_bg_${chatId}`);
      if (savedBg) {
        setBackground(savedBg);
      } else {
        setBackground('bg-gray-50 dark:bg-gray-900');
      }
    };
    loadBackground();

    const handleBgChange = (event) => {
      if (event.detail.chatId === chatId) {
        setBackground(event.detail.bgValue);
      }
    };
    window.addEventListener('chat-bg-change', handleBgChange);
    
    return () => window.removeEventListener('chat-bg-change', handleBgChange);
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => { scrollToBottom() }, [messages]);

  useEffect(() => {
    if (!chatId || !conversation) {
      setMessages([]);
      setOtherUser(null);
      return;
    }
    const otherUserId = conversation.participants.find(uid => uid !== user.uid);
    if (otherUserId) {
      getUserProfile(otherUserId).then(setOtherUser);
    }
    const unsubscribe = getMessagesForChat(chatId, setMessages);
    return () => unsubscribe();
  }, [chatId, conversation, user.uid]);

  if (!chatId) {
    return null; // or a loading spinner
  }

  const isBgImage = background.startsWith('/') || background.startsWith('data:image');
  
  return (
    <div 
      // 【核心修复】: 将两个 className 合并，并使用 style 属性来设置背景图片
      className={`relative flex flex-col h-full bg-cover bg-center ${!isBgImage ? background : ''}`}
      style={{ 
          backgroundImage: isBgImage ? `url("${background}")` : 'none',
      }}
    >
      {isBgImage && <div className="absolute inset-0 bg-black/20 z-0"></div>}
      
      <div className="relative z-10 flex-shrink-0 p-3 h-14 bg-white dark:bg-gray-800 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
        <div className="w-8"></div> 
        <h2 className="font-bold text-lg text-center">{otherUser?.displayName || '加载中...'}</h2>
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-500 p-2 rounded-full">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      <div className="relative z-0 flex-grow overflow-y-auto p-4 pt-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/80">
            <p className="bg-black/20 p-2 rounded-lg">还没有消息，开始对话吧！</p>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} chatId={chatId} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative z-10 flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow;
