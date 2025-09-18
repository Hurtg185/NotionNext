// themes/heo/components/ChatMessage.js (主题应用版)

import { useAuth } from '@/lib/AuthContext'
import { useState, useEffect } from 'react';

const ChatMessage = ({ message, otherUser, chatId }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  // 默认主题
  const defaultTheme = { me: 'bg-blue-500 text-white', other: 'bg-gray-200 text-black' };
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    // 【核心修改】: 加载和监听主题变化
    const themes = {
        default: { me: 'bg-blue-500 text-white', other: 'bg-gray-200 text-black' },
        purple: { name: '雅紫', me: 'bg-purple-500 text-white', other: 'bg-purple-100 text-purple-900' },
        green: { name: '清新', me: 'bg-green-500 text-white', other: 'bg-green-100 text-green-900' },
        dark: { name: '酷黑', me: 'bg-gray-700 text-white', other: 'bg-gray-300 text-black' },
    };

    const loadTheme = () => {
        const savedThemeKey = localStorage.getItem(`chat_theme_${chatId}`);
        setTheme(themes[savedThemeKey] || defaultTheme);
    };
    loadTheme();

    const handleStyleChange = (event) => {
        setTheme(event.detail.theme);
    };
    window.addEventListener('chat-style-change', handleStyleChange);

    return () => {
        window.removeEventListener('chat-style-change', handleStyleChange);
    };
  }, [chatId]);

  return (
    <div className={`flex items-end gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className="flex-shrink-0">
          <img src={otherUser?.photoURL || '...'} alt={otherUser?.displayName} className="rounded-full w-10 h-10 object-cover" />
        </div>
      )}
      
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words font-semibold ${
          // 【核心修改】: 应用主题样式
          isMe ? `${theme.me} rounded-br-none` : `${theme.other} dark:bg-gray-700 dark:text-gray-200 rounded-bl-none`
        }`}
      >
        <p>{message.text}</p>
      </div>

       {isMe && (
        <div className="flex-shrink-0">
          <img src={user?.photoURL || '...'} alt={user?.displayName} className="rounded-full w-10 h-10 object-cover" />
        </div>
      )}
    </div>
  )
}

export default ChatMessage
