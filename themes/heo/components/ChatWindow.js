// themes/heo/components/ChatWindow.js (最终背景应用版)

import { useState, useEffect, useRef } from 'react'
// ... (其他 import 不变)
import ChatSettingsPanel from './ChatSettingsPanel'

const ChatWindow = ({ chatId, conversation }) => {
  // ... (user, messages, otherUser, showSettings 等 state 不变)
  const [background, setBackground] = useState('bg-gray-50 dark:bg-gray-900');

  useEffect(() => {
    // 【核心修改】: 优化背景加载和监听逻辑
    const loadBackground = () => {
      const savedBg = localStorage.getItem(`chat_bg_${chatId}`);
      if (savedBg) {
        // savedBg 可能是 /path/to/image.jpg 或 data:image/...
        setBackground(savedBg);
      } else {
        // 如果没有保存的背景，恢复默认
        setBackground('bg-gray-50 dark:bg-gray-900');
      }
    };
    loadBackground();

    const handleBgChange = (event) => {
      if (event.detail.chatId === chatId) {
        setBackground(event.detail.bgValue);
      }
    };
    window.addEventListener('chat-bg-change', handleBgChange);
    
    return () => window.removeEventListener('chat-bg-change', handleBgChange);
  }, [chatId]);
  
  // ... (其他 useEffect 和逻辑不变)

  const isBgImage = background.startsWith('url(') || background.startsWith('data:image');
  
  return (
    <div 
      className="relative flex flex-col h-full bg-cover bg-center"
      style={{ 
          backgroundImage: isBgImage ? `url(${background.replace(/url\(['"]?|['"]?\)/g, '')})` : 'none',
          backgroundColor: isBgImage ? undefined : (background.includes('dark:bg-gray-900') ? 'var(--your-dark-bg-color)' : 'var(--your-light-bg-color)')
      }}
      // 如果不是图片背景，则使用 CSS 类
      className={`relative flex flex-col h-full bg-cover bg-center ${!isBgImage ? background : ''}`}
    >
      {isBgImage && <div className="absolute inset-0 bg-black/20 z-0"></div>}
      
      {/* 所有子元素都需要相对定位和更高的 z-index */}
      <div className="relative z-10 flex-shrink-0 p-3 h-14 bg-white dark:bg-gray-800 ...">
        {/* ... (顶部栏不变) ... */}
      </div>
      
      <div className="relative z-0 flex-grow overflow-y-auto p-4 pt-4 pb-4">
        {/* ... (聊天内容区不变) ... */}
      </div>

      <div className="relative z-10 flex-shrink-0 p-4 bg-white dark:bg-gray-800 ...">
        <ChatInput chatId={chatId} />
      </div>

      {showSettings && (
        <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />
      )}
    </div>
  )
}

export default ChatWindow;
