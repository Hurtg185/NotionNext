// themes/heo/components/ChatWindow.js (完整且已修改)

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'; // 【新增】引入 Link 组件
import { useAuth } from '@/lib/AuthContext'
import { getMessagesForChat, getUserProfile, markChatAsRead } from '@/lib/chat' // 【新增】引入 markChatAsRead
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
  
  const [isLoading, setIsLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => { scrollToBottom() }, [messages])

  // 负责获取对方用户信息
  useEffect(() => {
    if (user && conversation?.participants) {
        const otherUserId = conversation.participants.find(uid => uid !== user.uid);
        if (otherUserId) {
            // 在开始获取新用户信息前，可以先清空旧的，防止显示错误
            setOtherUser(null); 
            getUserProfile(otherUserId).then(setOtherUser);
        }
    }
  }, [conversation, user]);

  // 负责监听消息列表
  useEffect(() => {
    setIsLoading(true);
    if (chatId) {
        const unsubscribe = getMessagesForChat(chatId, (loadedMessages) => {
          setMessages(loadedMessages);
          setIsLoading(false);
          // 【新增】标记消息为已读
          if (user && loadedMessages.length > 0) {
            markChatAsRead(chatId, user.uid);
          }
        });
        return () => unsubscribe();
    } else {
        setMessages([]);
        setIsLoading(false);
    }
  }, [chatId, user]); // 【新增】依赖 user

  // 负责加载和监听背景变化
  useEffect(() => {
    if (chatId) {
        // 【修复】统一 LocalStorage 的 key
        const loadBackground = () => {
          const savedBg = localStorage.getItem(`chat_background_${chatId}`);
          setBackground(savedBg || 'default');
        };
        loadBackground();

        const handleBgChange = (event) => {
          // 确保事件是从 ChatSettingsPanel 正确派发的
          if (event.detail && typeof event.detail.background !== 'undefined') {
            setBackground(event.detail.background);
          }
        };
        // 【修复】统一事件名称
        window.addEventListener('chat-background-change', handleBgChange);
        
        return () => window.removeEventListener('chat-background-change', handleBgChange);
    }
  }, [chatId]);

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

      <div
        className={`relative z-10 flex-shrink-0 p-3 h-14 flex justify-between items-center 
        ${isBgImage ? 'bg-black/20 text-white' : 'bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white'} 
        border-b border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}
      >
        <div className="w-8"></div>
        
        {/* 【核心修改】将顶栏用户名用 Link 包裹起来 */}
        <Link href={`/profile/${otherUser?.id}`} passHref>
            <a className="flex items-center gap-2 group cursor-pointer">
                <h2 className="font-bold text-lg text-center truncate group-hover:text-blue-400">
                    {otherUser?.displayName || '加载中...'}
                </h2>
                {/* 你可以在这里添加角色标记 */}
            </a>
        </Link>

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
              // 【重要】将 otherUser 传递给子组件
              otherUser={otherUser} 
              chatId={chatId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className={`relative z-10 flex-shrink-0 p-3 
        ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} 
        border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}
      >
        <ChatInput chatId={chatId} conversation={conversation} />
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
