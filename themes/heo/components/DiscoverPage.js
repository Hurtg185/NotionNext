// themes/heo/components/DiscoverPage.js (新增漂流瓶 + 背景色)

import React, { useState } from 'react';
import { HiOutlineUsers, HiOutlineSparkles } from 'react-icons/hi2';
import { GiBottleVapors } from 'react-icons/gi'; // 漂流瓶图标

// 引入子组件
import PartnerFinder from './discover/PartnerFinder'; // 语伴广场
import ShakeMatch from './discover/ShakeMatch'; // 摇一摇
import BottleFeatures from './discover/BottleFeatures'; // 【新增】漂流瓶

const DiscoverPage = () => {
  const [activeSubTab, setActiveSubTab] = useState('finder'); // 默认显示语伴广场

  const subTabs = [
    { key: 'finder', name: '语伴广场', icon: <HiOutlineUsers className="w-5 h-5" /> },
    { key: 'shake', name: '摇一摇', icon: <HiOutlineSparkles className="w-5 h-5" /> },
    { key: 'bottles', name: '漂流瓶', icon: <GiBottleVapors className="w-5 h-5" /> }, // 【新增】漂流瓶标签
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 次级标签导航 */}
      <div className="flex justify-around border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 sticky top-0">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center justify-center py-2 px-4 font-semibold text-center w-1/3 transition-colors duration-300 ${activeSubTab === tab.key ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500'}`}
          >
            {tab.icon}
            <span className="ml-2">{tab.name}</span>
          </button>
        ))}
      </div>

      {/* 【核心修改】内容区域添加背景色 */}
      <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {activeSubTab === 'finder' && <PartnerFinder />}
        {activeSubTab === 'shake' && <ShakeMatch />}
        {activeSubTab === 'bottles' && <BottleFeatures />} {/* 【新增】渲染漂流瓶组件 */}
      </div>
    </div>
  );
};

export default DiscoverPage;
