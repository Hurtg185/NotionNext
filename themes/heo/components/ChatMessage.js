// themes/heo/components/ChatMessage.js (完整且已修改)

import { useAuth } from '@/lib/AuthContext'
import { useState, useEffect } from 'react';
import Link from 'next/link'; // 【新增】引入 Link 组件

const ChatMessage = ({ message, otherUser, chatId }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  // 【优化】senderProfile 现在直接从 props 判断，不再需要自己获取
  const senderProfile = isMe ? user : otherUser;

  const [themeClasses, setThemeClasses] = useState({
      bubbleMe: 'bg-blue-500 text-white',
      bubbleOther: 'bg-gray-200 text-black',
      fontSize: 'text-base',
      fontWeight: 'font-normal'
  });

  useEffect(() => {
    // 主题和字体加载逻辑保持不变
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
        const currentTheme = themes[savedThemeKey] || themes.default;

        setThemeClasses({
            bubbleMe: currentTheme.me,
            bubbleOther: currentTheme.other,
            fontSize: savedFontSize || 'text-base',
            fontWeight: savedFontWeight || 'font-normal'
        });
    };
    loadStyles();

    const handleStyleChange = (event) => {
        const { theme, fontSize, fontWeight } = event.detail; // 假设 event.detail.theme 是 {me: ..., other: ...}
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

  // 如果 senderProfile 还没准备好，可以显示一个简单的占位符
  if (!senderProfile) {
      return <div className="h-14"></div>; // 返回一个固定高度的空 div，防止布局跳动
  }

  return (
    <div className={`flex items-end gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        // 【核心修改】将对方头像用 Link 包裹
        <Link href={`/profile/${senderProfile.id}`} passHref>
          <a className="flex-shrink-0 cursor-pointer">
            <img
              src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
              alt={senderProfile.displayName}
              className="rounded-full w-10 h-10 object-cover"
            />
          </a>
        </Link>
      )}
      
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words ${
          isMe 
            ? `${themeClasses.bubbleMe} rounded-br-none` 
            : `${themeClasses.bubbleOther} dark:bg-gray-700 dark:text-gray-200 rounded-bl-none`
        } ${themeClasses.fontSize} ${themeClasses.fontWeight}`}
      >
        <p>{message.text}</p>
      </div>

       {isMe && (
        // 【核心修改】将自己的头像用 Link 包裹
        <Link href={`/profile/${senderProfile.id}`} passHref>
          <a className="flex-shrink-0 cursor-pointer">
            <img
              src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
              alt={senderProfile.displayName}
              className="rounded-full w-10 h-10 object-cover"
            />
          </a>
        </Link>
      )}
    </div>
  )
}

export default ChatMessage
