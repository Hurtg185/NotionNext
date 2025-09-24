// 文件路径: lib/ChatStyleContext.js (这是一个新文件)

import React, { createContext, useContext, useState, useEffect } from 'react';

// 主题定义，与您之前的版本完全一致
const THEMES = [
    { id: 'classic-blue', name: '经典蓝', incoming: { className: 'bg-white text-gray-800 border', style: {} }, outgoing: { className: 'bg-blue-600 text-white', style: {} } },
    { id: 'soft-pastel', name: '柔和粉', incoming: { className: 'bg-pink-50 text-pink-800', style: {} }, outgoing: { className: 'bg-rose-200 text-rose-900', style: {} } },
    { id: 'neon-dark', name: '霓虹暗', incoming: { className: 'bg-gray-900 text-gray-200', style: { boxShadow: '0 2px 8px rgba(0,0,0,0.6)' } }, outgoing: { className: 'text-black', style: { background: 'linear-gradient(90deg,#00F5A0,#00D2FF)', color: '#000' } } },
    { id: 'glassmorphism', name: '玻璃拟物', incoming: { className: 'backdrop-blur-sm bg-white/30 text-gray-900 border', style: { borderColor: 'rgba(255,255,255,0.25)' } }, outgoing: { className: 'backdrop-blur-sm text-white', style: { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)' } } },
    { id: 'sunset-gradient', name: '日落渐变', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#FFE29F,#FFA99F)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#FF7E5F,#FEB47B)' } } },
    { id: 'minimal-muted', name: '极简灰', incoming: { className: 'bg-gray-100 text-gray-800', style: {} }, outgoing: { className: 'bg-gray-800 text-white', style: {} } },
    { id: 'tropical', name: '热带风', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#E0F7FA,#B2EBF2)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#00C9FF,#92FE9D)' } } },
    { id: 'mono-line', name: '线条风', incoming: { className: 'bg-white text-indigo-700 border', style: { borderLeft: '4px solid #6366F1' } }, outgoing: { className: 'bg-indigo-600 text-white', style: {} } }
];
const DEFAULT_THEME = THEMES[0];

const ChatStyleContext = createContext();

export const useChatStyle = () => useContext(ChatStyleContext);

export const ChatStyleProvider = ({ chatId, children }) => {
  const [styles, setStyles] = useState({
    theme: DEFAULT_THEME,
    fontSize: 'text-base',
    fontWeight: 'font-normal',
    bubbleShapeKey: 'default'
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && chatId) {
      const savedThemeId = localStorage.getItem(`chat_theme_id_${chatId}`) || 'classic-blue';
      const savedBubbleShapeKey = localStorage.getItem(`chat_bubble_shape_key_${chatId}`) || 'default';
      const savedFontSize = localStorage.getItem(`chat_font_size_${chatId}`) || 'text-base';
      const savedFontWeight = localStorage.getItem(`chat_font_weight_${chatId}`) || 'font-normal';
      const currentTheme = THEMES.find(t => t.id === savedThemeId) || DEFAULT_THEME;
      
      setStyles({
        theme: currentTheme,
        bubbleShapeKey: savedBubbleShapeKey,
        fontSize: savedFontSize,
        fontWeight: savedFontWeight
      });
    }
  }, [chatId]);

  const updateStyles = (newStyles) => {
    setStyles(prevStyles => ({ ...prevStyles, ...newStyles }));
    if (typeof window !== 'undefined' && chatId) {
        if (newStyles.themeId) localStorage.setItem(`chat_theme_id_${chatId}`, newStyles.themeId);
        if (newStyles.bubbleShapeKey) localStorage.setItem(`chat_bubble_shape_key_${chatId}`, newStyles.bubbleShapeKey);
        if (newStyles.fontSize) localStorage.setItem(`chat_font_size_${chatId}`, newStyles.fontSize);
        if (newStyles.fontWeight) localStorage.setItem(`chat_font_weight_${chatId}`, newStyles.fontWeight);
    }
  };

  const value = { styles, updateStyles, THEMES, getBubbleShapeClasses };

  return (
    <ChatStyleContext.Provider value={value}>
      {children}
    </ChatStyleContext.Provider>
  );
};

// 气泡形状函数也移到这里，方便共享
export const getBubbleShapeClasses = (shapeKey, isMe) => {
    switch (shapeKey) {
        case 'squircle': return 'rounded-lg';
        case 'pill': return 'rounded-full';
        case 'sharp': return 'rounded-none';
        case 'soft': return 'rounded-3xl';
        case 'top-tail': return isMe ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md';
        case 'default': default: return isMe ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md';
    }
};
