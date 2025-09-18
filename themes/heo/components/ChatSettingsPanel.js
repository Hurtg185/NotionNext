// themes/heo/components/ChatSettingsPanel.js (最终修复版)

import React, { useState, useEffect } from 'react';

const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center p-4 text-left text-base font-semibold transition-colors duration-200 ${
      isDestructive 
        ? 'text-red-500 hover:bg-red-50/50' 
        : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'
    }`}
  >
    <i className={`${icon} w-6 text-center mr-4`}></i>
    <span>{label}</span>
  </button>
);

const ChatSettingsPanel = ({ onClose, chatId }) => {
  const [view, setView] = useState('main'); // 'main', 'background', 'theme'
  const handlePanelClick = e => e.stopPropagation();
  const fileInputRef = React.useRef(null);
  
  const handleBackgroundChange = event => { /* ... (逻辑不变) ... */ };

  const renderContent = () => {
    switch (view) {
      case 'background':
        return <BackgroundSettings chatId={chatId} onClose={onClose} />;
      case 'theme': // 切换到主题设置
        return <BubbleStyleSettings chatId={chatId} />;
      default:
        return (
          <>
            <div className="py-2">
              <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => setView('background')} />
              {/* 【核心修复】: 添加聊天主题入口 */}
              <SettingsItem icon="fas fa-palette" label="聊天主题" onClick={() => setView('theme')} />
              <SettingsItem icon="fas fa-search" label="查找聊天记录" onClick={() => alert('功能开发中...')} />
            </div>
            
            <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />

            <div className="py-2">
               <SettingsItem icon="fas fa-trash" label="清空聊天记录" isDestructive={true} onClick={() => alert('功能开发中...')} />
            </div>

            <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
            
            <div className="py-2">
                <button
                  onClick={onClose}
                  className="w-full p-4 text-center text-base font-bold text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg"
                >
                  取消
                </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-t-2xl shadow-lg animate-slide-up" onClick={handlePanelClick}>
        {/* 返回按钮，只在子视图中显示 */}
        {view !== 'main' && (
          // 【UI修复】: 返回按钮样式
          <button onClick={() => setView('main')} className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
        )}
        {renderContent()}
      </div>
      <style jsx global>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

// --- 子组件：背景设置 ---
const BackgroundSettings = ({ chatId, onClose }) => {
  const fileInputRef = React.useRef(null);
  const [currentBg, setCurrentBg] = useState(null);

  const defaultBackgrounds = [
    '/images/chat-backgrounds/liaotianbeijing-1.jpg',
    '/images/chat-backgrounds/liaotianbeijing-2.jpg',
    '/images/chat-backgrounds/liaotianbeijing-3.jpg',
    '/images/chat-backgrounds/liaotianbeijing-4.jpg',
  ];

  useEffect(() => {
    const savedBg = localStorage.getItem(`chat_bg_${chatId}`);
    setCurrentBg(savedBg);
  }, [chatId]);

  const applyBackground = (bgValue) => {
    setCurrentBg(bgValue);
    localStorage.setItem(`chat_bg_${chatId}`, bgValue);
    window.dispatchEvent(new CustomEvent('chat-bg-change', { detail: { chatId, bgValue } }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      applyBackground(e.target.result);
      // onClose(); // 选择图片后不自动关闭，让用户继续选择或返回
    };
    reader.readAsDataURL(file);
  };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4 text-gray-800 dark:text-gray-100">设置聊天背景</h2>
      
      <button 
        onClick={() => fileInputRef.current.click()}
        className="w-full flex justify-between items-center p-4 bg-white dark:bg-gray-700 rounded-lg mb-4 text-gray-800 dark:text-gray-100"
      >
        <span className="font-semibold">从相册选择</span>
        <i className="fas fa-chevron-right text-gray-400"></i>
      </button>
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <div className="grid grid-cols-3 gap-3">
        {defaultBackgrounds.map((bg, index) => (
          <div key={index} className="relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer" onClick={() => applyBackground(bg)}>
            <img src={bg} alt={`背景${index + 1}`} className="w-full h-full object-cover" />
            {currentBg === bg && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="bg-purple-500 text-white text-sm px-3 py-1 rounded-full">已选择</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 子组件：气泡样式设置 ---
const BubbleStyleSettings = ({ chatId }) => {
    const [currentTheme, setCurrentTheme] = useState(null); // 初始为 null

    useEffect(() => {
        const savedTheme = localStorage.getItem(`chat_theme_${chatId}`);
        setCurrentTheme(savedTheme || 'default');
    }, [chatId]);

    const themes = {
        default: { name: '默认', me: 'bg-blue-500 text-white', other: 'bg-gray-200 text-black' },
        purple: { name: '雅紫', me: 'bg-purple-500 text-white', other: 'bg-purple-100 text-purple-900' },
        green: { name: '清新', me: 'bg-green-500 text-white', other: 'bg-green-100 text-green-900' },
        dark: { name: '酷黑', me: 'bg-gray-700 text-white', other: 'bg-gray-300 text-black' },
        pink: { name: '甜粉', me: 'bg-pink-400 text-white', other: 'bg-pink-100 text-pink-900' }, // 新增主题
        orange: { name: '橙意', me: 'bg-orange-400 text-white', other: 'bg-orange-100 text-orange-900' }, // 新增主题
    };

    const fontSizes = [
      { label: '小', value: 'text-sm' },
      { label: '中', value: 'text-base' },
      { label: '大', value: 'text-lg' }
    ];

    const fontWeights = [
      { label: '常规', value: 'font-normal' },
      { label: '加粗', value: 'font-bold' }
    ];

    const applyThemeAndFont = (themeKey, fontSize = 'text-base', fontWeight = 'font-normal') => {
        setCurrentTheme(themeKey);
        localStorage.setItem(`chat_theme_${chatId}`, themeKey);
        localStorage.setItem(`chat_font_size_${chatId}`, fontSize);
        localStorage.setItem(`chat_font_weight_${chatId}`, fontWeight);
        window.dispatchEvent(new CustomEvent('chat-style-change', { 
            detail: { 
                theme: themes[themeKey], 
                fontSize: fontSize, 
                fontWeight: fontWeight 
            } 
        }));
    };

    if (!currentTheme) {
        return <div className="h-[120px] animate-pulse"></div>;
    }

    return (
        <div className="px-4 py-2">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">聊天主题</h3>
            <div className="flex justify-around mb-4 flex-wrap gap-y-3">
                {Object.entries(themes).map(([key, theme]) => (
                    <div key={key} className="flex flex-col items-center space-y-2 cursor-pointer w-1/3" onClick={() => applyThemeAndFont(key)}>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${currentTheme === key ? 'border-blue-500' : 'border-transparent'}`}>
                            <div className={`w-12 h-12 rounded-full flex overflow-hidden ${theme.me}`}>
                                <div className={`w-1/2 h-full ${theme.other}`}></div>
                            </div>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{theme.name}</span>
                    </div>
                ))}
            </div>

            {/* 字体大小 */}
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">字体大小</h3>
            <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1 mb-4">
              {fontSizes.map((sizeOpt) => (
                <button
                  key={sizeOpt.value}
                  onClick={() => applyThemeAndFont(currentTheme, sizeOpt.value, localStorage.getItem(`chat_font_weight_${chatId}`))}
                  className={`flex-1 p-1 rounded-md text-gray-800 dark:text-gray-100 ${localStorage.getItem(`chat_font_size_${chatId}`) === sizeOpt.value ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                >
                  {sizeOpt.label}
                </button>
              ))}
            </div>

            {/* 字体粗细 */}
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">字体粗细</h3>
            <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1">
              {fontWeights.map((weightOpt) => (
                <button
                  key={weightOpt.value}
                  onClick={() => applyThemeAndFont(currentTheme, localStorage.getItem(`chat_font_size_${chatId}`), weightOpt.value)}
                  className={`flex-1 p-1 rounded-md text-gray-800 dark:text-gray-100 ${localStorage.getItem(`chat_font_weight_${chatId}`) === weightOpt.value ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                >
                  {weightOpt.label}
                </button>
              ))}
            </div>
        </div>
    );
};

export default ChatSettingsPanel;
