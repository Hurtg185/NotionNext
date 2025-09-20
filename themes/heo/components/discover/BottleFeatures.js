// themes/heo/components/discover/BottleFeatures.js漂流瓶
import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { useAuth } from '@/lib/AuthContext';
// import { addBottle, getRandomBottle } from '@/lib/bottle'; // 假设这些后端函数已存在
import { HiOutlineSparkles, HiOutlinePaperAirplane } from 'react-icons/hi2';

// 导入 Lottie 动画文件 (你需要自行准备)
// import bottleThrowAnimation from '../../../../public/animations/bottles/bottle_throw.json';
// import bottlePopUpAnimation from '../../../../public/animations/bottles/bottle_pop_up.json';
// import bottleOpenAnimation from '../../../../public/animations/bottles/bottle_open.json';

const BottleFeatures = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState('idle');
  const [currentBottle, setCurrentBottle] = useState(null);
  const [newBottleContent, setNewBottleContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // --- 扔瓶子逻辑 (示例) ---
  const handleThrowBottle = async () => {
    // ... (你的扔瓶子逻辑) ...
    alert('扔瓶子功能待实现');
  };

  // --- 捞瓶子逻辑 (示例) ---
  const handleFetchBottle = async () => {
    // ... (你的捞瓶子逻辑) ...
    alert('捞瓶子功能待实现');
  };

  // --- 渲染部分 ---
  const renderIdleState = () => (
    <div className="flex flex-col items-center justify-center p-6 space-y-6">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">漂流瓶</h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        写下你想说的话扔进大海，或从海中捞起一个未知的瓶子。
      </p>
      
      <div className="w-full max-w-md bg-white dark:bg-gray-700 p-5 rounded-lg shadow-lg">
        <textarea
          value={newBottleContent}
          onChange={(e) => setNewBottleContent(e.target.value)}
          placeholder="写下你的心情或想说的话..."
          rows="4"
          className="w-full p-3 mb-3 border rounded-md dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
        <button
          onClick={handleThrowBottle}
          disabled={isLoading || !user}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-md transition-colors disabled:opacity-50"
        >
          <HiOutlinePaperAirplane className="inline-block mr-2" />
          {isLoading ? '正在扔...' : '扔一个瓶子'}
        </button>
      </div>

      <button
        onClick={handleFetchBottle}
        disabled={isLoading || !user}
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50"
      >
        <HiOutlineSparkles className="inline-block mr-3 h-6 w-6" />
        {isLoading ? '正在捞...' : '捞一个漂流瓶'}
      </button>

      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );

  const renderContent = () => {
    switch (mode) {
      // 在这里可以添加 'throwing', 'fetching', 'viewing' 的动画状态
      case 'idle':
      default:
        return renderIdleState();
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center relative">
      <div className="relative z-10 w-full">
        {renderContent()}
      </div>
    </div>
  );
};

export default BottleFeatures;
