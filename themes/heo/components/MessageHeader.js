// themes/heo/components/MessageHeader.js (将“探索”改为“发现”)

import React from 'react';
import { HiOutlineChatBubbleLeftRight, HiOutlineBell, HiOutlineGlobeAlt, HiOutlineUsers } from 'react-icons/hi2';

const MessageHeader = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { key: 'messages', name: '私信', icon: <HiOutlineChatBubbleLeftRight className="w-6 h-6" /> },
    { key: 'notifications', name: '通知', icon: <HiOutlineBell className="w-6 h-6" /> },
    { key: 'discover', name: '发现', icon: <HiOutlineGlobeAlt className="w-6 h-6" /> }, // 【修改】
    { key: 'contacts', name: '联系人', icon: <HiOutlineUsers className="w-6 h-6" /> },
  ];

  const baseClasses = "flex flex-col items-center justify-center pt-3 pb-2 font-semibold text-center w-1/4 transition-colors duration-300";
  const activeClasses = "text-white scale-110";
  const inactiveClasses = "text-white/70 hover:text-white";

  return (
    <div className="flex justify-around sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 shadow-md z-10">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`${baseClasses} ${activeTab === tab.key ? activeClasses : inactiveClasses}`}
        >
          {tab.icon}
          <span className="text-xs mt-1">{tab.name}</span>
          <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.key ? 'bg-white' : 'bg-transparent'}`}></div>
        </button>
      ))}
    </div>
  );
};

export default MessageHeader;
