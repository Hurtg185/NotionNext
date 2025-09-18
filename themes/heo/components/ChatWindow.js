// themes/heo/components/ChatWindow.js (最终Messenger沉浸式UI版)

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

  // --- 所有 useEffect hooks 保持不变 ---
  const scrollToBottom = () => { /* ... */ };
  useEffect(() => { scrollToBottom() }, [messages]);
  useEffect(() => { /* ... 获取对方用户信息 ... */ }, [conversation, user]);
  useEffect(() => { /* ... 监听消息 ... */ }, [chatId]);
  useEffect(() => { /* ... 加载和监听背景变化 ... */ }, [chatId]);

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
        注意: 这个叠加层现在是 z-0，位于背景和内容之间。
      */}
      {isBgImage && <div className="absolute inset-0 bg-black/20 z-0"></div>}
      
      {/* 
        【核心UI修改 2】: 顶部栏改为半透明磨砂玻璃
        - absolute, top-0, left-0, right-0, z-10: 浮动在顶部
        - h-14, p-3: 调整高度和内边距
        - bg-white/70 dark:bg-gray-800/70: 半透明背景
        - backdrop-blur-md: 磨砂玻璃效果 (md-lg可以调节模糊程度)
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
        - pt-0, pb-0: 移除内边距，让内容可以滚动到屏幕边缘
        - scroll-pt-16, scroll-pb-20: 添加滚动内边距，确保第一条和最后一条消息不会被顶部栏和输入框遮挡
      */}
      <div className="relative z-0 flex-grow overflow-y-auto p-4 pt-0 pb-0 scroll-pt-16 scroll-pb-20">
        {/* 为顶部和底部添加占位符，撑开空间 */}
        <div className="h-14 flex-shrink-0"></div>
        {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} chatId={chatId} />
        ))}
        <div className="h-20 flex-shrink-0"></div>
        <div ref={messagesEndRef} />
      </div>

      {/* 
        【核心UI修改 4】: 输入框区域改为半透明磨砂玻璃
        - absolute, bottom-0, left-0, right-0, z-10: 浮动在底部
        - bg-white/70 dark:bg-gray-800/70: 半透明背景
        - backdrop-blur-md: 磨砂玻璃效果
        - border-t: 增加一条细微的顶部边框作为分割
      */}
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
