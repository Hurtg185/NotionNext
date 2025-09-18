// themes/heo/components/ChatWindow.js (最终布局 + 背景功能版)

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
  const [background, setBackground] = useState('bg-gray-50 dark:bg-gray-900'); // 1. 背景状态

  // 2. 加载和监听背景变化
  useEffect(() => {
    const loadBackground = () => {
      const savedBg = localStorage.getItem(`chat_bg_${chatId}`);
      if (savedBg) {
        setBackground(`url(${savedBg})`);
      }
    };
    loadBackground();

    const handleBgChange = (event) => {
      if (event.detail.chatId === chatId) {
        setBackground(`url(${event.detail.imageUrl})`);
      }
    };
    window.addEventListener('chat-bg-change', handleBgChange);
    
    return () => window.removeEventListener('chat-bg-change', handleBgChange);
  }, [chatId]);


  const scrollToBottom = () => { /* ... (不变) ... */ }
  useEffect(() => { scrollToBottom() }, [messages]);
  useEffect(() => {
    // ... (获取用户信息和消息的逻辑不变)
  }, [chatId, conversation, user.uid]);

  if (!chatId) { /* ... (不变) ... */ }

  return (
    // 【UI修改】: 应用背景图片样式
    <div 
      className="relative flex flex-col h-full bg-cover bg-center"
      style={{ 
          backgroundImage: background.startsWith('url') ? background : 'none',
          backgroundColor: background.startsWith('url') ? '' : undefined
      }}
    >
      {/* 覆盖一层半透明遮罩，让文字更清晰 */}
      {background.startsWith('url') && <div className="absolute inset-0 bg-black/20"></div>}
      
      {/* 
        【UI修改】: 顶部栏变窄，恢复不透明，分割线变淡
        - `h-14`: 高度变窄
        - `border-b border-gray-200/50`: 分割线
      */}
      <div className="relative z-10 flex-shrink-0 p-3 h-14 bg-white dark:bg-gray-800 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
        <div className="w-8"></div> 
        <h2 className="font-bold text-lg text-center">{otherUser?.displayName || '加载中...'}</h2>
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-500 p-2 rounded-full">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      {/* 【UI修改】: 聊天内容区 padding 调整 */}
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

      {/* 
        【UI修改】: 输入框恢复不透明背景
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
