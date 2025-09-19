// themes/heo/components/ChatSettingsPanel.js (正确且独立的文件)

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

const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 text-left text-base font-semibold transition-colors duration-200 ${isDestructive ? 'text-red-500 hover:bg-red-50/50' : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'}`}>
    <i className={`${icon} w-6 text-center mr-4`}></i>
    <span>{label}</span>
  </button>
);

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

const BackgroundSettings = ({ chatId }) => {
  const fileInputRef = useRef(null);
  const [currentBg, setCurrentBg] = useState('default');

  useEffect(() => {
    const savedBg = localStorage.getItem(`chat_background_${chatId}`); 
    setCurrentBg(savedBg || 'default');
  }, [chatId]);

  const applyBackground = (bgValue) => {
    setCurrentBg(bgValue);
    localStorage.setItem(`chat_background_${chatId}`, bgValue); 
    window.dispatchEvent(new CustomEvent('chat-background-change', { detail: { background: bgValue } }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => applyBackground(e.target.result);
    reader.readAsDataURL(file);
  };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4 text-gray-800 dark:text-gray-100">设置聊天背景</h2>
      <button onClick={() => fileInputRef.current.click()} className="w-full flex justify-between items-center p-4 bg-white dark:bg-gray-700 rounded-lg mb-4 text-gray-800 dark:text-gray-100">
        <span className="font-semibold">从相册选择</span>
        <i className="fas fa-chevron-right text-gray-400"></i>
      </button>
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      <div className="grid grid-cols-3 gap-3">
        {defaultBackgrounds.map((bg) => (
          <div key={bg.value} className={`relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 ${currentBg === bg.value ? 'border-blue-500' : 'border-transparent'}`} onClick={() => applyBackground(bg.value)}>
            {bg.value !== 'default' ? ( 
              <img src={bg.thumbnail || bg.value} alt={bg.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm bg-gray-200 dark:bg-gray-700">无背景</div>
            )}
            {currentBg === bg.value && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full">已选择</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const BubbleStyleSettings = ({ chatId }) => {
    const [currentThemeId, setCurrentThemeId] = useState('classic-blue');
    const [currentBubbleShapeKey, setCurrentBubbleShapeKey] = useState('default');
    const [currentFontSize, setCurrentFontSize] = useState('text-base');
    const [currentFontWeight, setCurrentFontWeight] = useState('font-normal');

    useEffect(() => {
        setCurrentThemeId(localStorage.getItem(`chat_theme_id_${chatId}`) || 'classic-blue');
        setCurrentBubbleShapeKey(localStorage.getItem(`chat_bubble_shape_key_${chatId}`) || 'default');
        setCurrentFontSize(localStorage.getItem(`chat_font_size_${chatId}`) || 'text-base');
        setCurrentFontWeight(localStorage.getItem(`chat_font_weight_${chatId}`) || 'font-normal');
    }, [chatId]);

    const applyStyles = (styles) => {
        const { themeId = currentThemeId, bubbleShapeKey = currentBubbleShapeKey, fontSize = currentFontSize, fontWeight = currentFontWeight } = styles;
        setCurrentThemeId(themeId);
        setCurrentBubbleShapeKey(bubbleShapeKey);
        setCurrentFontSize(fontSize);
        setCurrentFontWeight(fontWeight);
        localStorage.setItem(`chat_theme_id_${chatId}`, themeId);
        localStorage.setItem(`chat_bubble_shape_key_${chatId}`, bubbleShapeKey);
        localStorage.setItem(`chat_font_size_${chatId}`, fontSize);
        localStorage.setItem(`chat_font_weight_${chatId}`, fontWeight);
        window.dispatchEvent(new CustomEvent('chat-style-change', { detail: { themeId, bubbleShapeKey, fontSize, fontWeight } }));
    };

    if (!currentThemeId || !currentBubbleShapeKey || !currentFontSize || !currentFontWeight) {
        return <div className="h-[120px] animate-pulse"></div>;
    }

    return (
        <div className="px-4 py-2">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">气泡主题</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {availableThemes.map((theme) => (
                    <div key={theme.id} className={`flex flex-col items-center p-2 rounded-lg cursor-pointer border-2 ${currentThemeId === theme.id ? 'border-blue-500' : 'border-transparent'} hover:bg-gray-100 dark:hover:bg-gray-700`} onClick={() => applyStyles({ themeId: theme.id })}>
                        <div className="w-full flex items-center justify-between mb-1">
                            <div className={`h-4 w-[45%] rounded-full ${theme.incoming.className}`} style={theme.incoming.style} />
                            <div className={`h-4 w-[45%] rounded-full ${theme.outgoing.className}`} style={theme.outgoing.style} />
                        </div>
                        <span className="text-xs text-center text-gray-600 dark:text-gray-300">{theme.name}</span>
                    </div>
                ))}
            </div>
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">气泡形状</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {availableBubbleShapes.map((shape) => (
                    <button key={shape.key} onClick={() => applyStyles({ bubbleShapeKey: shape.key })} className={`p-2 rounded-md border text-center text-sm ${currentBubbleShapeKey === shape.key ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600'} text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700`}>
                        {shape.name}
                    </button>
                ))}
            </div>
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">字体大小</h3>
            <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1 mb-4">
              {fontSizes.map((sizeOpt) => (
                <button key={sizeOpt.value} onClick={() => applyStyles({ fontSize: sizeOpt.value })} className={`flex-1 p-1 rounded-md text-gray-800 dark:text-gray-100 ${currentFontSize === sizeOpt.value ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>
                  {sizeOpt.label}
                </button>
              ))}
            </div>
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">字体粗细</h3>
            <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1">
              {fontWeights.map((weightOpt) => (
                <button key={weightOpt.value} onClick={() => applyStyles({ fontWeight: weightOpt.value })} className={`flex-1 p-1 rounded-md text-gray-800 dark:text-gray-100 ${currentFontWeight === weightOpt.value ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>
                  {weightOpt.label}
                </button>
              ))}
            </div>
        </div>
    );
};

export default ChatSettingsPanel;
