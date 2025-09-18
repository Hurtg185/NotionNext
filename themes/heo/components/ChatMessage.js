// themes/heo/components/ChatMessage.js (动态样式版)

import { useAuth } from '@/lib/AuthContext'
import { useState, useEffect } from 'react';

const ChatMessage = ({ message, otherUser, chatId }) => { // 1. 接收 chatId
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  // 2. 创建一个 state 来存储当前对话的样式
  const [styles, setStyles] = useState({
    bubbleColor: 'bg-blue-500',
    textColor: 'text-white',
    fontSize: 'text-base',
    fontWeight: 'font-normal'
  });

  // 3. 使用 useEffect 来读取 localStorage 和监听自定义事件
  useEffect(() => {
    // 组件加载时，从 localStorage 读取保存的样式
    const loadStyles = () => {
        const savedStyles = localStorage.getItem(`chat_styles_${chatId}`);
        if (savedStyles) {
            setStyles(JSON.parse(savedStyles));
        }
    };
    loadStyles();

    // 监听 'chat-style-change' 事件
    const handleStyleChange = (event) => {
        setStyles(event.detail);
    };
    window.addEventListener('chat-style-change', handleStyleChange);

    // 组件卸载时，移除事件监听器
    return () => {
        window.removeEventListener('chat-style-change', handleStyleChange);
    };
  }, [chatId]); // 依赖 chatId，确保切换对话时能重新加载样式

  return (
    <div className={`flex items-end gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className="flex-shrink-0">
          <img
            src={otherUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={otherUser?.displayName}
            className="rounded-full w-10 h-10 object-cover"
          />
        </div>
      )}
      
      {/* 4. 应用动态样式 */}
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words ${
          isMe 
            ? `${styles.bubbleColor} ${styles.textColor} rounded-br-none` // 我方气泡应用动态样式
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none' // 对方气泡保持默认
        } ${styles.fontSize} ${styles.fontWeight}`} // 字体大小和粗细对双方都生效
      >
        <p>{message.text}</p>
      </div>

       {isMe && (
        <div className="flex-shrink-0">
          <img
            src={user?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={user?.displayName}
            className="rounded-full w-10 h-10 object-cover"
          />
        </div>
      )}
    </div>
  )
}

export default ChatMessage
