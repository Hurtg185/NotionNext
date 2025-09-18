// themes/heo/components/ChatSettingsPanel.js (最终美化+功能完整版)

import React, { useState, useEffect } from 'react';

// --- 子组件：设置项按钮 ---
const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 text-left text-base font-semibold ...`}>
    {/* ... (此组件不变) ... */}
  </button>
);

// --- 子组件：气泡主题设置 ---
const BubbleStyleSettings = ({ chatId }) => { /* ... (见下文，我们将把它拆分出来) ... */ };

// --- 子组件：背景设置 (新！) ---
const BackgroundSettings = ({ chatId, onClose }) => {
  const fileInputRef = React.useRef(null);
  const [currentBg, setCurrentBg] = useState(null);

  // 预设的默认背景图列表
  const defaultBackgrounds = [
    '/images/chat-backgrounds/liaotianbeijing-1.jpg',
    '/images/chat-backgrounds/liaotianbeijing-2.jpg',
    '/images/chat-backgrounds/liaotianbeijing-3.jpg',
    '/images/chat-backgrounds/liaotianbeijing-4.jpg',
    // ... 您可以继续添加更多图片
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
    reader.onload = e => applyBackground(e.target.result);
    reader.readAsDataURL(file);
  };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4">设置聊天背景</h2>
      
      <button 
        onClick={() => fileInputRef.current.click()}
        className="w-full flex justify-between items-center p-4 bg-white dark:bg-gray-700 rounded-lg mb-4"
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


// --- 主组件：聊天设置面板 ---
const ChatSettingsPanel = ({ onClose, chatId }) => {
  const [view, setView] = useState('main'); // 'main', 'background', 'theme'

  const handlePanelClick = e => e.stopPropagation();
  
  const renderContent = () => {
    switch (view) {
      case 'background':
        return <BackgroundSettings chatId={chatId} onClose={onClose} />;
      // case 'theme':
      //   return <BubbleStyleSettings chatId={chatId} />;
      default:
        return (
          <>
            <div className="py-2">
              <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => setView('background')} />
              {/* <SettingsItem icon="fas fa-palette" label="聊天主题" onClick={() => setView('theme')} /> */}
            </div>
            {/* ... 其他设置项 ... */}
            <hr className="my-2 border-gray-200/50" />
            <div className="py-2">
              <SettingsItem icon="fas fa-trash" label="清空聊天记录" isDestructive={true} onClick={() => alert('功能开发中...')} />
            </div>
            <hr className="my-2 border-gray-200/50" />
            <div className="py-2">
              <button onClick={onClose} className="w-full p-4 text-center text-base font-bold text-blue-500 ...">
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
          <button onClick={() => setView('main')} className="absolute top-4 left-4 p-2">
            <i className="fas fa-arrow-left"></i>
          </button>
        )}
        {renderContent()}
      </div>
      {/* ... (动画样式不变) ... */}
    </div>
  );
};

export default ChatSettingsPanel;
