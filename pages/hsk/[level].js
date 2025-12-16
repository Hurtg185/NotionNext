import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { BookOpen, GraduationCap, Dumbbell, ChevronLeft, Trophy } from 'lucide-react';
import WordCard from '../../components/WordCard'; // 确保路径正确

// --- 数据导入 (保持你原有的逻辑) ---
import hsk1Words from '../../data/hsk/hsk1.json';
import hsk2Words from '../../data/hsk/hsk2.json';
import hsk3Words from '../../data/hsk/hsk3.json';
import hsk4Words from '../../data/hsk/hsk4.json';
import hsk5Words from '../../data/hsk/hsk5.json';
import hsk6Words from '../../data/hsk/hsk6.json';

const hskWordsData = {
  '1': hsk1Words,
  '2': hsk2Words,
  '3': hsk3Words,
  '4': hsk4Words,
  '5': hsk5Words,
  '6': hsk6Words,
};

const HskLevelPage = () => {
  const router = useRouter();
  const { level } = router.query;
  const [words, setWords] = useState([]);
  const [isCardOpen, setIsCardOpen] = useState(false);

  // 原生轻震动函数
  const vibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15); // 震动 15ms，轻脆的感觉
    }
  };

  useEffect(() => {
    if (level && hskWordsData[level]) {
      // 假设你的 json 结构可能是 { words: [...] } 或者直接就是数组
      // 这里做个兼容，确保 words 是数组
      const data = hskWordsData[level];
      setWords(Array.isArray(data) ? data : (data.words || []));
    } else {
      setWords([]);
    }
  }, [level]);

  // 点击“生词”卡片
  const handleOpenWords = () => {
    vibrate();
    if (words.length > 0) {
      setIsCardOpen(true);
    } else {
      alert("数据加载中或为空，请稍后...");
    }
  };

  // 点击其他卡片（示例）
  const handleOtherClick = (type) => {
    vibrate();
    // 这里可以跳转到语法或练习页面，暂时用 log 代替
    console.log(`Open ${type}`);
    // router.push(`/hsk/${level}/${type}`); 
  };

  // 1. 如果还在加载或 URL 参数未就绪
  if (!level || (router.isReady && !hskWordsData[level])) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">
        <div className="animate-pulse">加载中...</div>
      </div>
    );
  }

  // 2. 如果生词卡片模式打开，显示 WordCard 组件
  if (isCardOpen) {
    return (
      <WordCard
        words={words}
        isOpen={isCardOpen}
        onClose={() => setIsCardOpen(false)}
        progressKey={`hsk${level}_study_page`}
      />
    );
  }

  // 3. 默认主界面 (Dashboard)
  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-gray-950 pb-safe">
      
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-[#F5F7FA]/90 dark:bg-gray-950/90 backdrop-blur-md flex items-center justify-between">
        <Link 
          href="/hsk" 
          onClick={vibrate}
          className="p-2 -ml-2 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
        >
          <ChevronLeft size={24} />
        </Link>
        <span className="font-bold text-gray-800 dark:text-white text-lg">HSK {level}</span>
        <div className="w-8" /> {/* 占位，保持标题居中 */}
      </div>

      {/* 核心内容区 */}
      <div className="px-5 pt-2 pb-10">
        
        {/* Banner / 头部状态 */}
        <div className="mb-8 mt-2 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 flex items-center justify-center mb-4 text-white">
            <Trophy size={36} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 dark:text-white mb-1">
            HSK {level} 级
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            共 {words.length} 个生词等待挑战
          </p>
        </div>

        {/* 核心功能入口：3个卡片 */}
        <div className="grid grid-cols-1 gap-4">
          
          {/* 1. 生词卡片 (点击打开 WordCard) */}
          <button
            onClick={handleOpenWords}
            className="group relative w-full bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-5
                       transition-transform duration-200 active:scale-95 active:bg-gray-50"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0">
              <BookOpen size={26} />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">生词学习</span>
              <span className="text-xs text-gray-400 mt-0.5">Words • {words.length} 词</span>
            </div>
            {/* 右侧箭头装饰 */}
            <div className="ml-auto text-gray-300">
              <ChevronLeft size={20} className="rotate-180" />
            </div>
          </button>

          {/* 2. 语法卡片 (预留) */}
          <div
            onClick={() => handleOtherClick('grammar')}
            className="group relative w-full bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-5
                       transition-transform duration-200 active:scale-95 active:bg-gray-50 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <GraduationCap size={26} />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">语法重点</span>
              <span className="text-xs text-gray-400 mt-0.5">Grammar • 45 个语法点</span>
            </div>
            <div className="ml-auto text-gray-300">
              <ChevronLeft size={20} className="rotate-180" />
            </div>
          </div>

          {/* 3. 练习卡片 (预留) */}
          <div
            onClick={() => handleOtherClick('practice')}
            className="group relative w-full bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-5
                       transition-transform duration-200 active:scale-95 active:bg-gray-50 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Dumbbell size={26} />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">模拟练习</span>
              <span className="text-xs text-gray-400 mt-0.5">Practice • 听力/阅读</span>
            </div>
            <div className="ml-auto text-gray-300">
              <ChevronLeft size={20} className="rotate-180" />
            </div>
          </div>

        </div>

        {/* 底部装饰或提示 */}
        <p className="text-center text-xs text-gray-300 mt-10">
          Keep practicing every day
        </p>
      </div>
    </div>
  );
};

export default HskLevelPage;
