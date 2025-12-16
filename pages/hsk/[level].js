import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic'; // 1. 引入 dynamic
import { BookOpen, GraduationCap, Dumbbell, ChevronLeft, Trophy } from 'lucide-react';

import HskContentBlock from '../../components/HskContentBlock'; 

// 2. 使用 dynamic 动态导入 WordCard，彻底解决 self is not defined
const WordCard = dynamic(() => import('../../components/WordCard'), {
  ssr: false, // 关键：禁止在服务端构建此组件
});

// --- 数据导入 ---
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

  // 震动函数（安全的写法）
  const vibrate = () => {
    // 再次确保只在浏览器端执行
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  useEffect(() => {
    if (level && hskWordsData[level]) {
      const data = hskWordsData[level];
      setWords(Array.isArray(data) ? data : (data.words || []));
    } else {
      setWords([]);
    }
  }, [level]);

  const handleOpenWords = () => {
    vibrate();
    if (words.length > 0) {
      setIsCardOpen(true);
    } else {
      alert("数据加载中...");
    }
  };

  const handleOtherClick = (type) => {
    vibrate();
    console.log(`Open ${type}`);
  };

  // 等待路由参数就绪
  if (!level) return <div className="min-h-screen bg-[#F5F7FA]" />;

  // 打开生词卡片
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

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-gray-950 pb-safe">
      
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-[#F5F7FA]/90 dark:bg-gray-950/90 backdrop-blur-md flex items-center justify-between">
        <Link href="/hsk" onClick={vibrate} className="p-2 -ml-2 rounded-full text-gray-600 dark:text-gray-300">
          <ChevronLeft size={24} />
        </Link>
        <span className="font-bold text-gray-800 dark:text-white text-lg">HSK {level}</span>
        <div className="w-8" />
      </div>

      <div className="px-5 pt-2 pb-10">
        {/* Banner */}
        <div className="mb-8 mt-2 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center justify-center mb-4 text-white">
            <Trophy size={36} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 dark:text-white">HSK {level} 级</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">共 {words.length} 个生词等待挑战</p>
        </div>

        {/* 功能卡片列表 */}
        <div className="grid grid-cols-1 gap-4">
          
          <HskContentBlock 
            icon={BookOpen}
            title="生词学习"
            subtitle={`Words • ${words.length} 词`}
            color="blue"
            onClick={handleOpenWords}
          />

          <HskContentBlock 
            icon={GraduationCap}
            title="语法重点"
            subtitle="Grammar • 45 个语法点"
            color="emerald"
            onClick={() => handleOtherClick('grammar')}
          />

          <HskContentBlock 
            icon={Dumbbell}
            title="模拟练习"
            subtitle="Practice • 听力/阅读"
            color="orange"
            onClick={() => handleOtherClick('practice')}
          />

        </div>
      </div>
    </div>
  );
};

export default HskLevelPage;
