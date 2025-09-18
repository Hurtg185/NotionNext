// themes/heo/components/ChatMessage.js (最终主题+字体应用版)

import { useAuth } from '@/lib/AuthContext'
import { useState, useEffect } from 'react';

const ChatMessage = ({ message, otherUser, chatId }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  const [themeClasses, setThemeClasses] = useState({
      bubbleMe: 'bg-blue-500 text-white',
      bubbleOther: 'bg-gray-200 text-black',
      fontSize: 'text-base',
      fontWeight: 'font-normal'
  });

  useEffect(() => {
    // 【核心修改】: 加载和监听主题和字体变化
    const themes = {
        default: { me: 'bg-blue-500 text-white', other: 'bg-gray-200 text-black' },
        purple: { name: '雅紫', me: 'bg-purple-500 text-white', other: 'bg-purple-100 text-purple-900' },
        green: { name: '清新', me: 'bg-green-500 text-white', other: 'bg-green-100 text-green-900' },
        dark: { name: '酷黑', me: 'bg-gray-700 text-white', other: 'bg-gray-300 text-black' },
        pink: { name: '甜粉', me: 'bg-pink-400 text-white', other: 'bg-pink-100 text-pink-900' },
        orange: { name: '橙意', me: 'bg-orange-400 text-white', other: 'bg-orange-100 text-orange-900' },
    };

    const loadStyles = () => {
        const savedThemeKey = localStorage.getItem(`chat_theme_${chatId}`);
        const savedFontSize = localStorage.getItem(`chat_font_size_${chatId}`);
        const savedFontWeight = localStorage.getItem(`chat_font_weight_${chatId}`);

        setThemeClasses({
            bubbleMe: (themes[savedThemeKey] || themes.default).me,
            bubbleOther: (themes[savedThemeKey] || themes.default).other,
            fontSize: savedFontSize || 'text-base',
            fontWeight: savedFontWeight || 'font-normal'
        });
    };
    loadStyles();

    const handleStyleChange = (event) => {
        const { theme, fontSize, fontWeight } = event.detail;
        setThemeClasses({
            bubbleMe: theme.me,
            bubbleOther: theme.other,
            fontSize: fontSize || 'text-base',
            fontWeight: fontWeight || 'font-normal'
        });
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
          <img
            src={otherUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={otherUser?.displayName}
            className="rounded-full w-10 h-10 object-cover"
          />
        </div>
      )}
      
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words ${
          // 【核心修改】: 应用主题和字体样式
          isMe 
            ? `${themeClasses.bubbleMe} rounded-br-none` 
            : `${themeClasses.bubbleOther} dark:bg-gray-700 dark:text-gray-200 rounded-bl-none` // 确保对方气泡在深色模式下颜色正常
        } ${themeClasses.fontSize} ${themeClasses.fontWeight}`}
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
