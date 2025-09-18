// themes/heo/components/ChatWindow.js (最终UI美化版)

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
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>请选择一个对话</p>
      </div>
    )
  }

  return (
    // 【UI修改】: 添加 relative 定位，为绝对定位的头部和底部提供基准
    <div className="relative flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      
      {/* 
        【UI修改】: 头部改为绝对定位、透明磨砂玻璃效果 
        - `absolute top-0 left-0 right-0 z-10`: 绝对定位并置于顶层
        - `bg-white/50 dark:bg-gray-800/50`: 半透明背景
        - `backdrop-blur-lg`: 磨砂玻璃效果
        - `border-b-0`: 移除底部边框，让分割线更细
      */}
      <div className="absolute top-0 left-0 right-0 z-10 flex-shrink-0 p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg flex justify-between items-center">
        <div className="w-8"></div> 
        <h2 className="font-bold text-lg text-center">{otherUser?.displayName || '加载中...'}</h2>
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-gray-800 p-2 rounded-full">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      {/* 
        【UI修改】: 聊天内容区域
        - 添加 `pt-20 pb-24` (padding-top/bottom) 为浮动的头部和底部留出空间
      */}
      <div className="flex-grow overflow-y-auto p-4 pt-20 pb-24">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>还没有消息，开始对话吧！</p>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} chatId={chatId} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 
        【UI修改】: 输入框区域
        - `absolute bottom-0 left-0 right-0`: 同样使用绝对定位
        - `bg-transparent`: 背景完全透明
        - `border-t`: 使用边框代替背景来创建分割线
      */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex-shrink-0 p-4 bg-transparent border-t border-gray-200/50 dark:border-gray-700/50">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        // 传递 chatId 给设置面板
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow
