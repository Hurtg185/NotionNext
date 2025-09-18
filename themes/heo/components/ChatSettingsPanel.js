// themes/heo/components/ChatSettingsPanel.js

import React from 'react';

// 这是一个可复用的设置项按钮组件
const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center p-4 text-left text-base transition-colors duration-200 ${
      isDestructive 
        ? 'text-red-500 hover:bg-red-50' 
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    <i className={`${icon} w-6 text-center mr-4`}></i>
    <span>{label}</span>
  </button>
);

const ChatSettingsPanel = ({ onClose }) => {
  // 阻止事件冒泡，防止点击面板内容导致面板关闭
  const handlePanelClick = (e) => {
    e.stopPropagation();
  };

  return (
    // 遮罩层，点击后关闭面板
    <div 
      className="fixed inset-0 bg-black/40 z-50 flex items-end"
      onClick={onClose}
    >
      {/* 从底部滑出的面板 */}
      <div
        className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg p-2 animate-slide-up"
        onClick={handlePanelClick}
      >
        {/* 面板内容 */}
        <div className="py-2">
          <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => alert('功能开发中...')} />
          <SettingsItem icon="fas fa-palette" label="气泡与字体样式" onClick={() => alert('功能开发中...')} />
          <SettingsItem icon="fas fa-search" label="查找聊天记录" onClick={() => alert('功能开发中...')} />
        </div>
        
        <hr className="my-2 border-gray-200 dark:border-gray-600" />

        <div className="py-2">
           <SettingsItem icon="fas fa-trash" label="清空聊天记录" isDestructive={true} onClick={() => alert('功能开发中...')} />
        </div>

        <hr className="my-2 border-gray-200 dark:border-gray-600" />
        
        {/* 取消按钮 */}
        <div className="py-2">
            <button
              onClick={onClose}
              className="w-full p-4 text-center text-base font-semibold text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              取消
            </button>
        </div>
      </div>

      {/* 定义一个简单的滑出动画 */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ChatSettingsPanel;
