// themes/heo/components/ChatWindow.js (最终沉浸式UI + 稳定布局版)

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
  const [background, setBackground] = useState('default');

  // --- 所有 useEffect hooks 保持我们之前修复好的、健壮的版本 ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => { scrollToBottom() }, [messages]);

  useEffect(() => {
    if (user && conversation?.participants) {
        const otherUserId = conversation.participants.find(uid => uid !== user.uid);
        if (otherUserId) {
            setOtherUser(null); 
            getUserProfile(otherUserId).then(setOtherUser);
        }
    }
  }, [conversation, user]);

  useEffect(() => {
    if (chatId) {
        const unsubscribe = getMessagesForChat(chatId, setMessages);
        return () => unsubscribe();
    } else {
        setMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
        const loadBackground = () => {
          const savedBg = localStorage.getItem(`chat_bg_${chatId}`);
          setBackground(savedBg || 'default');
        };
        loadBackground();

        const handleBgChange = (event) => {
          if (event.detail.chatId === chatId) {
            setBackground(event.detail.bgValue);
          }
        };
        window.addEventListener('chat-bg-change', handleBgChange);
        
        return () => window.removeEventListener('chat-bg-change', handleBgChange);
    }
  }, [chatId]);

  if (!chatId || !conversation) {
    return <div className="flex items-center justify-center h-full">正在加载对话...</div>
  }

  const isBgImage = background !== 'default';
  
  return (
    // 【核心UI修改 1】: 父容器，应用背景图
    <div 
      className={`relative flex flex-col h-full ${!isBgImage ? 'bg-gray-50 dark:bg-gray-900' : 'bg-cover bg-center'}`}
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {/* 
        如果设置了图片背景，则添加一层半透明的叠加层。
        这能确保即使背景图是浅色的，深色模式下的白色字体也能看清。
      */}
      {isBgImage && <div className="absolute inset-0 bg-black/20 z-0"></div>}
      
      {/* 
        【核心UI修改 2】: 顶部栏改为半透明磨砂玻璃
        - relative z-10: 确保它在内容之上
        - bg-white/70 dark:bg-gray-800/70: 半透明背景
        - backdrop-blur-md: 磨砂玻璃效果
      */}
      <div className="relative z-10 flex-shrink-0 p-3 h-14 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md flex justify-between items-center">
        <div className="w-8"></div> 
        {otherUser ? (
            <h2 className="font-bold text-lg text-center text-gray-900 dark:text-white">{otherUser.displayName}</h2>
        ) : (
            <div className="h-5 bg-gray-300/50 dark:bg-gray-600/50 rounded-md w-24 animate-pulse"></div>
        )}
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-full">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      {/* 
        【核心UI修改 3】: 聊天内容区
        - flex-grow: 自动填充所有可用空间
        - overflow-y-auto: 内容超出时出现滚动条
        - p-4: 保持内边距，让气泡不会贴着屏幕边缘
      */}
      <div className="relative z-0 flex-grow overflow-y-auto p-4">
        {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} chatId={chatId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 
        【核心UI修改 4】: 输入框区域改为半透明磨砂玻璃
        - relative z-10: 确保它在内容之上
        - bg-white/70 dark:bg-gray-800/70: 半透明背景
        - backdrop-blur-md: 磨砂玻璃效果
        - border-t: 增加一条细微的顶部边框作为分割
      */}
      <div className="relative z-10 flex-shrink-0 p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-t border-gray-200/20 dark:border-gray-700/20">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow
