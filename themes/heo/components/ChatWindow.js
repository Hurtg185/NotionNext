// themes/heo/components/ChatWindow.js (已添加设置入口的完整版)

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getMessagesForChat, getUserProfile } from '@/lib/chat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import ChatSettingsPanel from './ChatSettingsPanel' // 1. 导入我们新的设置面板

const ChatWindow = ({ chatId, conversation }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const messagesEndRef = useRef(null)
  
  // 2. 添加一个状态来控制设置面板的显示/隐藏
  const [showSettings, setShowSettings] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!chatId || !conversation) {
      setMessages([])
      setOtherUser(null)
      return
    }

    const otherUserId = conversation.participants.find(uid => uid !== user.uid)
    if (otherUserId) {
      getUserProfile(otherUserId).then(setOtherUser)
    }

    const unsubscribe = getMessagesForChat(chatId, setMessages)
    return () => unsubscribe()
  }, [chatId, conversation, user.uid])

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50 dark:bg-gray-900">
        <p>请选择一个对话</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* 头部区域 */}
      <div className="flex-shrink-0 p-4 border-b flex justify-between items-center">
        {/* 左侧占位符，确保标题居中 */}
        <div className="w-8"></div> 
        
        <h2 className="font-bold text-lg text-center">{otherUser?.displayName || '加载中...'}</h2>
        
        {/* 3. 在这里添加“三个点”按钮 */}
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-gray-800 p-2 rounded-full">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>

      {/* 聊天内容区域 */}
      <div className="flex-grow overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>还没有消息，开始对话吧！</p>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框区域 */}
      <div className="flex-shrink-0 p-4 border-t bg-white dark:bg-gray-800">
        <ChatInput chatId={chatId} />
      </div>

      {/* 4. 条件渲染设置面板 */}
      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default ChatWindow
