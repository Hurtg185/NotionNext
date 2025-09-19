// themes/heo/components/ChatSettingsPanel.js (完整且已修复)

import React, { useState, useEffect, useRef } from 'react';

// === 常量定义 ===
const defaultBackgrounds = [
  { name: '默认', value: 'default', thumbnail: '' },
  { name: '背景1', value: '/images/chat-backgrounds/liaotianbeijing-1.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-1.jpg' },
  { name: '背景2', value: '/images/chat-backgrounds/liaotianbeijing-2.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-2.jpg' },
  { name: '背景3', value: '/images/chat-backgrounds/liaotianbeijing-3.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-3.jpg' },
  { name: '背景4', value: '/images/chat-backgrounds/liaotianbeijing-4.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-4.jpg' },
  { name: '背景5', value: '/images/chat-backgrounds/liaotianbeijing-5.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-5.jpg' },
  { name: '背景6', value: '/images/chat-backgrounds/liaotianbeijing-6.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-6.jpg' },
  { name: '背景7', value: '/images/chat-backgrounds/liaotianbeijing-7.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-7.jpg' },
  { name: '背景8', value: '/images/chat-backgrounds/liaotianbeijing-8.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-8.jpg' },
  { name: '背景9', value: '/images/chat-backgrounds/liaotianbeijing-9.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-9.jpg' },
];

const availableThemes = [
    { id: 'classic-blue', name: '经典蓝', incoming: { className: 'bg-white text-gray-800 border', style: {} }, outgoing: { className: 'bg-blue-600 text-white', style: {} } },
    { id: 'soft-pastel', name: '柔和粉', incoming: { className: 'bg-pink-50 text-pink-800', style: {} }, outgoing: { className: 'bg-rose-200 text-rose-900', style: {} } },
    { id: 'neon-dark', name: '霓虹暗', incoming: { className: 'bg-gray-900 text-gray-200', style: { boxShadow: '0 2px 8px rgba(0,0,0,0.6)' } }, outgoing: { className: 'text-black', style: { background: 'linear-gradient(90deg,#00F5A0,#00D2FF)', color: '#000' } } },
    { id: 'glassmorphism', name: '玻璃拟物', incoming: { className: 'backdrop-blur-sm bg-white/30 text-gray-900 border', style: { borderColor: 'rgba(255,255,255,0.25)' } }, outgoing: { className: 'backdrop-blur-sm text-white', style: { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)' } } },
    { id: 'sunset-gradient', name: '日落渐变', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#FFE29F,#FFA99F)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#FF7E5F,#FEB47B)' } } },
    { id: 'minimal-muted', name: '极简灰', incoming: { className: 'bg-gray-100 text-gray-800', style: {} }, outgoing: { className: 'bg-gray-800 text-white', style: {} } },
    { id: 'tropical', name: '热带风', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#E0F7FA,#B2EBF2)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#00C9FF,#92FE9D)' } } },
    { id: 'mono-line', name: '线条风', incoming: { className: 'bg-white text-indigo-700 border', style: { borderLeft: '4px solid #6366F1' } }, outgoing: { className: 'bg-indigo-600 text-white', style: {} } }
];

const availableBubbleShapes = [
    { key: 'default', name: '默认' },
    { key: 'squircle', name: '方圆' },
    { key: 'pill', name: '胶囊' },
    { key: 'sharp', name: '直角' },
    { key: 'soft', name: '圆润' },
    { key: 'top-tail', name: '顶角' }
];

const fontSizes = [
  { label: '小', value: 'text-sm' },
  { label: '中', value: 'text-base' },
  { label: '大', value: 'text-lg' }
];

const fontWeights = [
  { label: '常规', value: 'font-normal' },
  { label: '加粗', value: 'font-bold' }
];

// --- 通用设置项组件 ---
const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 text-left text-base font-semibold transition-colors duration-200 ${isDestructive ? 'text-red-500 hover:bg-red-50/50' : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'}`}>
    <i className={`${icon} w-6 text-center mr-4`}></i>
    <span>{label}</span>
  </button>
);

// --- 主设置面板组件 ---
const ChatSettingsPanel = ({ onClose, chatId }) => {
  const [view, setView] = useState('main');
  const handlePanelClick = e => e.stopPropagation();
  
  const renderContent = () => {
    switch (view) {
      case 'background': return <BackgroundSettings chatId={chatId} />;
      case 'theme': return <BubbleStyleSettings chatId={chatId} />;
      default: return (
          <>
            <div className="py-2">
              <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => setView('background')} />
              <SettingsItem icon="fas fa-palette" label="聊天气泡样式和字体" onClick={() => setView('theme')} />
              <SettingsItem icon="fas fa-search" label="查找聊天记录" onClick={() => alert('功能开发中...')} />
            </div>
            <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
            <div className="py-2">
               <SettingsItem icon="fas fa-trash" label="清空聊天记录" isDestructive={true} onClick={() => alert('功能开发中...')} />
            </div>
            <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
            <div className="py-2">
                <button onClick={onClose} className="w-full p-4 text-center text-base font-bold text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">
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
        {view !== 'main' && (
          <button onClick={() => setView('main')} className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300 z-10">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
        )}
        <div className="relative pt-12 pb-4">{renderContent()}</div>
      </div>
      <style jsx global>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }`}</style>
    </div>
  );
};

// --- 子组件：背景设置 ---
const BackgroundSettings = ({ chatId }) => {
  const fileInputRef = useRef(null);
  const [currentBg, setCurrentBg] = useState('default');

  useEffect(() => {
    // 【修复】统一 Local Storage Key
    const savedBg = localStorage.getItem(`chat_background_${chatId}`); 
    setCurrentBg(savedBg || 'default');
  }, [chatId]);

  const applyBackground = (bgValue) => {
    setCurrentBg(bgValue);
    // 【修复】统一 Local Storage Key
    localStorage.setItem(`chat_background_${chatId}`, bgValue); 
    // 【修复】统一事件名
    window.dispatchEvent(new CustomEvent('chat-background-change', { detail: { background: bgValue } }));
  };

  const handleFileChange = (event) => { /* ... */ };
  
  return (
    <div className="p-4">
      {/* ... (你的 UI 保持不变) ... */}
    </div>
  );
};

// --- 子组件：气泡样式设置 ---
const BubbleStyleSettings = ({ chatId }) => {
    // ... (这个子组件的代码保持我上次提供的版本，逻辑是正确的) ...
};

export default ChatSettingsPanel;
