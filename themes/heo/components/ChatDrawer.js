// themes/heo/components/ChatDrawer.js (最终强制高度修复版)

import React from 'react';
import ChatWindow from './ChatWindow';

const ChatDrawer = ({ isOpen, onClose, conversation }) => {
  return (
    <>
      {/* 遮罩层 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* 抽屉容器 */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        // 【核心CSS修复】: 使用 h-[85dvh] 来强制抽屉的高度
        // 85dvh = 85% 的动态视口高度，这是一个非常适合抽屉的高度
        style={{ height: '85dvh' }} 
      >
        {/*
          确保内部的 ChatWindow 能填满这个容器。
          我们通过给 ChatWindow 的父容器添加 h-full 来实现。
        */}
        <div className="h-full">
            {isOpen && conversation && (
              <ChatWindow chatId={conversation.id} conversation={conversation} />
            )}
        </div>
      </div>
    </>
  );
};

export default ChatDrawer;
