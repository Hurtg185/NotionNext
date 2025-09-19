// themes/heo/components/MessagesListDrawer.js

import React from 'react';
import ConversationList from '@/themes/heo/components/ConversationList'; // 导入消息列表组件

const MessagesListDrawer = ({ isOpen, onClose }) => {
  return (
    <>
      {/* 遮罩层 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-40' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* 抽屉内容 */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '90dvh' }} // 消息列表抽屉可以更高一些
      >
        <div className="p-4 flex justify-center items-center cursor-grab border-b border-gray-200 dark:border-gray-700" onTouchMove={onClose}>
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        
        <div className="h-full overflow-y-auto">
          {/* 在这里渲染消息列表 */}
          {isOpen && <ConversationList />}
        </div>
      </div>
    </>
  );
};

export default MessagesListDrawer;
