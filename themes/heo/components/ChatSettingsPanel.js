// themes/heo/components/ChatSettingsPanel.js (404修复 + 美化版)

import React, { useState, useEffect } from 'react'; // 1. 引入 useEffect

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

const ChatSettingsPanel = ({ onClose, chatId }) => { // 2. 接收 chatId
  const handlePanelClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/30 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-t-2xl shadow-lg p-2 animate-slide-up"
        onClick={handlePanelClick}
      >
        <div className="py-2">
          <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => alert('功能开发中...')} />
        </div>
        
        <BubbleStyleSettings chatId={chatId} />

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
      </div>

      <style jsx global>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

const BubbleStyleSettings = ({ chatId }) => {
    // 3. 初始 state 设为 null，避免在服务器端访问 localStorage
    const [styles, setStyles] = useState(null);

    // 4. 使用 useEffect 在组件挂载后（即在浏览器中）才读取 localStorage
    useEffect(() => {
        const savedStyles = localStorage.getItem(`chat_styles_${chatId}`);
        setStyles(savedStyles ? JSON.parse(savedStyles) : {
            bubbleColor: 'bg-blue-500',
            textColor: 'text-white',
            fontSize: 'text-base',
            fontWeight: 'font-normal'
        });
    }, [chatId]);

    const updateStyle = (key, value) => {
        const newStyles = { ...styles, [key]: value };
        setStyles(newStyles);
        localStorage.setItem(`chat_styles_${chatId}`, JSON.stringify(newStyles));
        window.dispatchEvent(new CustomEvent('chat-style-change', { detail: newStyles }));
    };

    const colorOptions = [
        { name: '经典蓝', bubble: 'bg-blue-500', text: 'text-white' },
        { name: '活力绿', bubble: 'bg-green-500', text: 'text-white' },
        { name: '优雅紫', bubble: 'bg-purple-500', text: 'text-white' },
        { name: '简约灰', bubble: 'bg-gray-200', text: 'text-black' },
    ];
    
    // 5. 如果 styles 还在加载中，可以显示一个加载状态或什么都不显示
    if (!styles) {
        return <div className="p-4 text-center">加载样式设置...</div>;
    }

    return (
        <div className="px-4 py-2">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">气泡与字体样式</h3>
            <div className="mb-4">
                <p className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">气泡颜色</p>
                <div className="flex space-x-3">
                    {colorOptions.map(opt => (
                        <button key={opt.name} onClick={() => {updateStyle('bubbleColor', opt.bubble); updateStyle('textColor', opt.text)}}
                            className={`w-8 h-8 rounded-full ${opt.bubble} border-2 ${styles.bubbleColor === opt.bubble ? 'border-blue-500' : 'border-transparent'}`}
                        />
                    ))}
                </div>
            </div>
            <div className="mb-4">
                 <p className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">字体大小</p>
                 <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1">
                     <button onClick={() => updateStyle('fontSize', 'text-sm')} className={`flex-1 p-1 rounded-md ${styles.fontSize === 'text-sm' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>小</button>
                     <button onClick={() => updateStyle('fontSize', 'text-base')} className={`flex-1 p-1 rounded-md ${styles.fontSize === 'text-base' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>中</button>
                     <button onClick={() => updateStyle('fontSize', 'text-lg')} className={`flex-1 p-1 rounded-md ${styles.fontSize === 'text-lg' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>大</button>
                 </div>
            </div>
            <div>
                 <p className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">字体粗细</p>
                 <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1">
                     <button onClick={() => updateStyle('fontWeight', 'font-normal')} className={`flex-1 p-1 rounded-md ${styles.fontWeight === 'font-normal' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>常规</button>
                     <button onClick={() => updateStyle('fontWeight', 'font-bold')} className={`flex-1 p-1 rounded-md ${styles.fontWeight === 'font-bold' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>加粗</button>
                 </div>
            </div>
        </div>
    );
};

export default ChatSettingsPanel;
