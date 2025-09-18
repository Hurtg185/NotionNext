// themes/heo/components/ChatWindow.js (最终BUG修复 + UI微调版)

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
  const [showSettings, setShowSettings] = useState(false)
  const [background, setBackground] = useState('default')
  
  // 【核心BUG修复】: 增加一个明确的 loading 状态
  const [isLoading, setIsLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => { scrollToBottom() }, [messages])

  // --- 拆分 useEffect，确保依赖项绝对正确 ---
  
  // 负责获取对方用户信息
  useEffect(() => {
    if (user && conversation?.participants) {
        const otherUserId = conversation.participants.find(uid => uid !== user.uid);
        if (otherUserId) {
            setOtherUser(null); 
            getUserProfile(otherUserId).then(setOtherUser);
        }
    }
  }, [conversation, user]);

  // 负责监听消息列表
  useEffect(() => {
    // 【核心BUG修复】: 在开始监听前，设置 isLoading 为 true
    setIsLoading(true);
    if (chatId) {
        const unsubscribe = getMessagesForChat(chatId, (loadedMessages) => {
          setMessages(loadedMessages);
          setIsLoading(false); // 第一次获取到数据后（即使是空数组），就停止 loading
        });
        return () => unsubscribe();
    } else {
        setMessages([]);
        setIsLoading(false); // 如果没有 chatId，也停止 loading
    }
  }, [chatId]);

  // 负责加载和监听背景变化
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

  // 安全保障，如果核心数据不存在，直接返回 null 或一个加载占位符
  if (!chatId || !conversation) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="animate-pulse">正在进入对话...</div>
        </div>
      );
  }

  const isBgImage = background !== 'default'

  return (
    <div
      className={`relative flex flex-col h-full ${
        !isBgImage ? 'bg-gray-50 dark:bg-gray-900' : 'bg-cover bg-center'
      }`}
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {isBgImage && <div className="absolute inset-0 bg-black/30 z-0"></div>}

      {/* 
        【UI微调】: 提高透明度
        - bg-white/50 dark:bg-gray-800/50: 从70%不透明度改为50%
      */}
      <div
        className={`relative z-10 flex-shrink-0 p-3 h-14 flex justify-between items-center 
        ${isBgImage ? 'bg-black/20 text-white' : 'bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white'} 
        border-b border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}
      >
        <div className="w-8"></div>
        <h2 className="font-bold text-lg text-center truncate">
          {otherUser?.displayName || '加载中...'}
        </h2>
        <div className="w-8 text-right">
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 rounded-full transition ${
              isBgImage
                ? 'text-white/80 hover:bg-white/10 hover:text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>

      <div className="relative z-0 flex-grow overflow-y-auto p-4">
        {/* 【核心BUG修复】: 使用 isLoading 状态来决定显示内容 */}
        {isLoading ? (
            <div className="flex items-center justify-center h-full text-white/80">
                <p className="bg-black/20 p-2 rounded-lg">正在加载消息...</p>
            </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p
              className={`px-3 py-2 rounded-lg text-sm ${
                isBgImage
                  ? 'bg-black/40 text-white/80'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              还没有消息，开始对话吧！
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              otherUser={otherUser}
              chatId={chatId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 
        【UI微调】: 提高透明度
        - bg-white/50 dark:bg-gray-800/50: 从70%不透明度改为50%
      */}
      <div
        className={`relative z-10 flex-shrink-0 p-3 
        ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} 
        border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}
      >
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel
          onClose={() => setShowSettings(false)}
          chatId={chatId}
        />
      )}
    </div>
  )
}

export default ChatWindow
