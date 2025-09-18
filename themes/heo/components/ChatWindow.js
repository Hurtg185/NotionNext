// themes/heo/components/ChatWindow.js (沉浸式美化版)

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
  const [background, setBackground] = useState('default') // 'default' 或图片URL

  useEffect(() => { /* ... scrollToBottom 不变 ... */ }, [messages])
  useEffect(() => { /* ... 获取用户信息不变 ... */ }, [conversation, user])
  useEffect(() => { /* ... 获取消息不变 ... */ }, [chatId])

  // 加载和监听背景变化
  useEffect(() => {
    const loadBackground = () => {
      const savedBg = localStorage.getItem(`chat_bg_${chatId}`)
      setBackground(savedBg || 'default')
    }
    loadBackground()

    const handleBgChange = (event) => {
      if (event.detail.chatId === chatId) {
        setBackground(event.detail.bgValue)
      }
    }
    window.addEventListener('chat-bg-change', handleBgChange)

    return () => window.removeEventListener('chat-bg-change', handleBgChange)
  }, [chatId])

  if (!chatId || !conversation) return null

  const isBgImage = background !== 'default'

  return (
    <div
      className={`relative flex flex-col h-full ${
        !isBgImage ? 'bg-gray-50 dark:bg-gray-900' : 'bg-cover bg-center'
      }`}
      style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}
    >
      {/* 遮罩层：如果是背景图，加点暗化处理 */}
      {isBgImage && <div className="absolute inset-0 bg-black/30 z-0"></div>}

      {/* 顶栏：透明或半透明背景，沉浸式 */}
      <div
        className={`relative z-10 flex-shrink-0 p-3 h-14 flex justify-between items-center 
        ${isBgImage ? 'bg-black/30 text-white' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'} 
        border-b border-gray-200/30 dark:border-gray-700/30 backdrop-blur-md`}
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
                ? 'text-white/80 hover:bg-white/20 hover:text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>

      {/* 聊天内容区 */}
      <div className="relative z-0 flex-grow overflow-y-auto p-4">
        {messages.length === 0 ? (
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

      {/* 输入框：半透明沉浸式 */}
      <div
        className={`relative z-10 flex-shrink-0 p-3 
        ${isBgImage ? 'bg-black/30' : 'bg-white dark:bg-gray-800'} 
        border-t border-gray-200/30 dark:border-gray-700/30 backdrop-blur-md`}
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
