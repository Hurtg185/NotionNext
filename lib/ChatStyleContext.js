// 文件路径: lib/ChatStyleContext.js (最终健壮版)

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

// 【核心修改】将 createContext() 的初始值设为 null，而不是 undefined (默认)
// 这让我们可以更明确地检查 Provider 是否存在。
const ChatStyleContext = createContext(null);

export const useChatStyle = () => {
    const context = useContext(ChatStyleContext);
    
    // 【核心修改】增加安全检查
    // 如果 context 是 null (意味着没有找到 Provider)，就抛出一个明确的错误。
    // 这会在开发环境中立即告诉您问题所在，而不是在运行时产生一个模糊的 undefined 错误。
    if (context === null) {
        throw new Error("useChatStyle must be used within a ChatStyleProvider. Make sure your component is wrapped correctly.");
    }
    
    return context;
};

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
    // 寻找新的 theme 对象
    const themeId = newStyles.themeId || styles.theme.id;
    const newTheme = THEMES.find(t => t.id === themeId) || styles.theme;
    
    const updatedStyles = {
        theme: newTheme,
        bubbleShapeKey: newStyles.bubbleShapeKey || styles.bubbleShapeKey,
        fontSize: newStyles.fontSize || styles.fontSize,
        fontWeight: newStyles.fontWeight || styles.fontWeight,
    };
    setStyles(updatedStyles);
    
    // 保存到 localStorage
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
