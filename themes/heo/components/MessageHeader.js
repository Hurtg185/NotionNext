// themes/heo/components/MessageHeader.js (带渐变背景和图标的消息顶栏)

import React from 'react';
// 导入图标 (需要先安装 react-icons: yarn add react-icons)
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineGlobeAlt, HiOutlineUsers } from 'react-icons/hi2';

const MessageHeader = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { key: 'messages', name: '私信', icon: <HiOutlineChatBubbleLeftRight className="w-6 h-6" /> },
    { key: 'notifications', name: '通知', icon: <HiOutlineBell className="w-6 h-6" /> },
    { key: 'explore', name: '探索', icon: <HiOutlineGlobeAlt className="w-6 h-6" /> },
    { key: 'contacts', name: '联系人', icon: <HiOutlineUsers className="w-6 h-6" /> },
  ];

  const baseClasses = "flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/4 transition-colors duration-300";
  const activeClasses = "text-white scale-110"; // 激活状态：白色，放大
  const inactiveClasses = "text-white/70 hover:text-white"; // 未激活状态：半透明白色

  return (
    // 【核心】使用渐变色背景
    <div className="flex justify-around sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 shadow-md z-10">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`${baseClasses} ${activeTab === tab.key ? activeClasses : inactiveClasses}`}
        >
          {tab.icon}
          <span className="text-xs mt-1">{tab.name}</span>
          {/* 激活状态的下划线指示器 */}
          <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.key ? 'bg-white' : 'bg-transparent'}`}></div>
        </button>
      ))}
    </div>
  );
};

export default MessageHeader;
