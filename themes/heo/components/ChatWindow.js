// themes/heo/components/ChatWindow.js (最终路径修复版)

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext' // 【核心修复】: 修正了这里的导入路径
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
    <div 
      className={`relative flex flex-col h-full ${!isBgImage ? 'bg-gray-50 dark:bg-gray-900' : 'bg-cover bg-center'}`}
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {isBgImage && <div className="absolute inset-0 bg-black/20 z-0"></div>}
      
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
      
      <div className="relative z-0 flex-grow overflow-y-auto p-4 scroll-pt-16 scroll-pb-20">
        <div className="h-14 flex-shrink-0"></div>
        {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} chatId={chatId} />
        ))}
        <div className="h-20 flex-shrink-0"></div>
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 flex-shrink-0 p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-t border-gray-200/20 dark:border-gray-700/20">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow
