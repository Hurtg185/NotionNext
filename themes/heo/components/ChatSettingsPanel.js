// themes/heo/components/ChatSettingsPanel.js (404修复 + 美化版)

import React, { useState, useEffect } from 'react';

// ... (SettingsItem 组件不变) ...
const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => ( /* ... */ );


const ChatSettingsPanel = ({ onClose, chatId }) => {
  const handlePanelClick = (e) => e.stopPropagation();
  const fileInputRef = React.useRef(null);
  
  const handleBackgroundChange = (event) => { /* ... (功能不变) ... */ };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-gray-100/95 ... animate-slide-up" onClick={handlePanelClick}>
        <div className="py-2">
          <input type="file" ... ref={fileInputRef} onChange={handleBackgroundChange} style={{ display: 'none' }} />
          <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => fileInputRef.current.click()} />
        </div>
        
        {/* 把 chatId 传递给子组件 */}
        <BubbleStyleSettings chatId={chatId} />

        {/* ... (其他按钮不变) ... */}
      </div>
      {/* ... (动画样式不变) ... */}
    </div>
  );
};

// 【核心修复】: 解决 localStorage 导致的SSR错误
const BubbleStyleSettings = ({ chatId }) => {
    const [currentTheme, setCurrentTheme] = useState(null); // 初始为 null

    // 在组件挂载后（即在浏览器中）才读取 localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem(`chat_theme_${chatId}`);
        setCurrentTheme(savedTheme || 'default');
    }, [chatId]);

    const themes = {
        default: { name: '默认', me: 'bg-blue-500 text-white', other: 'bg-gray-200 text-black' },
        purple: { name: '雅紫', me: 'bg-purple-500 text-white', other: 'bg-purple-100 text-purple-900' },
        green: { name: '清新', me: 'bg-green-500 text-white', other: 'bg-green-100 text-green-900' },
        dark: { name: '酷黑', me: 'bg-gray-700 text-white', other: 'bg-gray-300 text-black' },
    };

    const applyTheme = (themeKey) => {
        setCurrentTheme(themeKey);
        localStorage.setItem(`chat_theme_${chatId}`, themeKey);
        window.dispatchEvent(new CustomEvent('chat-style-change', { detail: { theme: themes[themeKey] } }));
    };

    // 如果主题还在加载中，显示一个占位符
    if (!currentTheme) {
        return <div className="h-[120px] animate-pulse"></div>;
    }

    return (
        <div className="px-4 py-2">
            <h3 className="font-bold text-lg mb-3 ...">聊天主题</h3>
            <div className="flex justify-around">
                {Object.entries(themes).map(([key, theme]) => (
                    <div key={key} className="..." onClick={() => applyTheme(key)}>
                        {/* ... (UI不变) ... */}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChatSettingsPanel;
