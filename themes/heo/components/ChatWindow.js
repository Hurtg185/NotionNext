// themes/heo/components/ChatWindow.js (返璞归真最终修复版)

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/Auth-context' // 修正路径
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

  // --- 所有 useEffect hooks 保持不变 ---
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
    // 【核心修复 1】: 回归最简单的 Flexbox 布局
    <div 
      className={`flex flex-col h-full bg-cover bg-center ${!isBgImage ? 'bg-gray-50 dark:bg-gray-900' : ''}`}
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {isBgImage && <div className="absolute inset-0 bg-black/20 z-0"></div>}

      {/* 
        【核心修复 2】: 恢复正常的文档流布局，不再使用 absolute
        - flex-shrink-0: 确保此元素不会被压缩
        - relative z-10: 确保它在背景图之上
      */}
      <div className="relative z-10 flex-shrink-0 p-3 h-14 bg-white dark:bg-gray-800 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
        <div className="w-8"></div> 
        {otherUser ? (
            <h2 className="font-bold text-lg text-center text-gray-900 dark:text-white">{otherUser.displayName}</h2>
        ) : (
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded-md w-24 animate-pulse"></div>
        )}
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-full">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      {/* 
        【核心修复 3】: 聊天内容区
        - flex-grow: 自动填充所有可用空间
        - overflow-y-auto: 内容超出时出现滚动条
        - 移除了所有复杂的 padding 和 scroll-padding
      */}
      <div className="relative z-0 flex-grow overflow-y-auto p-4">
        {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} chatId={chatId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 
        【核心修复 4】: 输入框区域
        - flex-shrink-0: 确保此元素不会被压缩
      */}
      <div className="relative z-10 flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow
