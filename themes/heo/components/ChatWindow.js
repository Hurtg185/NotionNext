// themes/heo/components/ChatWindow.js (最终状态管理修复版)

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
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  useEffect(() => { scrollToBottom() }, [messages]);

  // 【核心修复】: 拆分 useEffect，确保依赖项正确
  useEffect(() => {
    // 这个 effect 只负责获取对方用户信息
    if (user && conversation?.participants) {
        const otherUserId = conversation.participants.find(uid => uid !== user.uid);
        if (otherUserId) {
            getUserProfile(otherUserId).then(setOtherUser);
        }
    }
  }, [conversation, user]); // 依赖 conversation 和 user

  useEffect(() => {
    // 这个 effect 只负责监听消息
    if (chatId) {
        const unsubscribe = getMessagesForChat(chatId, setMessages);
        return () => unsubscribe();
    }
  }, [chatId]); // 只依赖 chatId

  if (!chatId || !conversation) {
    // 这个状态几乎不会出现，但作为安全保障
    return <div className="flex items-center justify-center h-full">加载中...</div>
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b flex justify-between items-center">
        <div className="w-8"></div> 
        <h2 className="font-bold text-lg text-center">{otherUser?.displayName || '加载中...'}</h2>
        <div className="w-8 text-right">
          <button onClick={() => setShowSettings(true)} className="text-gray-500 ...">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4">
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

      <div className="flex-shrink-0 p-4 border-t ...">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow
