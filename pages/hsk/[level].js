import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic'; // 关键引入
import { BookOpen, GraduationCap, Dumbbell, ChevronLeft, Trophy } from 'lucide-react';

// 引入 UI 组件
import HskEntryCard from '../../components/HskEntryCard';

// =========================================================================
// 1. 动态加载重型组件 (解决 self defined 报错的关键)
// =========================================================================

// 生词组件 (假设这是你的刷卡组件)
const DynamicWordModule = dynamic(() => import('../../components/WordCard'), {
  ssr: false, // 禁止服务端渲染
  loading: () => <LoadingOverlay text="正在加载单词卡片..." />
});

// 语法组件 (还没写的话，下面会提供一个占位符)
const DynamicGrammarModule = dynamic(() => import('../../components/GrammarCard'), {
  ssr: false,
  loading: () => <LoadingOverlay text="正在加载语法模块..." />
});

// 练习组件
const DynamicPracticeModule = dynamic(() => import('../../components/PracticeCard'), {
  ssr: false,
  loading: () => <LoadingOverlay text="正在加载练习模块..." />
});

// 简单的加载动画组件
const LoadingOverlay = ({ text }) => (
  <div className="fixed inset-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-gray-500 font-medium">{text}</p>
    </div>
  </div>
);

// =========================================================================
// 2. 数据准备 (保持你原有的逻辑)
// =========================================================================
import hsk1Words from '../../data/hsk/hsk1.json';
import hsk2Words from '../../data/hsk/hsk2.json';
// ... 导入其他 JSON

const hskDataMap = {
  '1': hsk1Words,
  '2': hsk2Words,
  // ... 添加其他级别
};

// =========================================================================
// 3. 页面逻辑
// =========================================================================
const HskLevelPage = () => {
  const router = useRouter();
  const { level } = router.query;
  
  // 状态管理：当前激活的模块 ('words' | 'grammar' | 'practice' | null)
  const [activeModule, setActiveModule] = useState(null);
  const [levelData, setLevelData] = useState([]);

  // 加载数据
  useEffect(() => {
    if (level && hskDataMap[level]) {
      const data = hskDataMap[level];
      // 兼容处理：有些 JSON 可能是数组，有些可能是 { words: [] } 对象
      setLevelData(Array.isArray(data) ? data : (data.words || []));
    }
  }, [level]);

  // 返回处理
  const handleCloseModule = () => setActiveModule(null);

  // 震动辅助
  const vibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  };

  // 如果路由没准备好
  if (!level) return null;

  // =========================================================================
  // 4. 渲染逻辑：如果某个模块被激活，渲染对应组件，否则渲染仪表盘
  // =========================================================================
  
  // 渲染：生词模块
  if (activeModule === 'words') {
    return (
      <DynamicWordModule
        words={levelData}
        isOpen={true}
        onClose={handleCloseModule}
        progressKey={`hsk${level}_words`}
      />
    );
  }

  // 渲染：语法模块
  if (activeModule === 'grammar') {
    return (
      <DynamicGrammarModule
        level={level}
        onClose={handleCloseModule}
      />
    );
  }

  // 渲染：练习模块
  if (activeModule === 'practice') {
    return (
      <DynamicPracticeModule
        level={level}
        words={levelData}
        onClose={handleCloseModule}
      />
    );
  }

  // =========================================================================
  // 5. 渲染逻辑：主仪表盘 (Dashboard)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-gray-950 font-sans pb-safe">
      <Head>
        <title>HSK Level {level} - Study</title>
      </Head>

      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-[#F5F7FA]/90 dark:bg-gray-950/90 backdrop-blur-md flex items-center justify-between">
        <Link 
            href="/hsk" 
            onClick={vibrate}
            className="p-2 -ml-2 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
        >
          <ChevronLeft size={24} />
        </Link>
        <span className="font-bold text-gray-800 dark:text-white text-lg tracking-tight">
          HSK {level} 级
        </span>
        <div className="w-8" />
      </div>

      <div className="px-5 pt-4 pb-10">
        
        {/* Banner 区域 */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-500/20 mb-8">
            <div className="relative z-10 flex flex-col items-center text-center">
                <div className="mb-3 p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                    <Trophy size={32} className="text-yellow-300" />
                </div>
                <h1 className="text-3xl font-extrabold mb-1">Level {level}</h1>
                <p className="text-blue-100 text-sm font-medium">
                    核心词汇 • 语法突破 • 模拟测试
                </p>
                
                <div className="mt-5 flex gap-8 w-full justify-center border-t border-white/10 pt-4">
                    <div>
                        <div className="text-2xl font-bold">{levelData.length}</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-60">Words</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">45</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-60">Grammar</div>
                    </div>
                </div>
            </div>
            {/* 装饰圆圈 */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-500/30 rounded-full blur-2xl"></div>
        </div>

        {/* 核心入口 (使用分离的 UI 组件) */}
        <div className="space-y-4">
          
          <HskEntryCard 
            icon={BookOpen}
            title="生词学习"
            subtitle={`Vocabulary (${levelData.length})`}
            color="blue"
            onClick={() => setActiveModule('words')}
          />

          <HskEntryCard 
            icon={GraduationCap}
            title="语法重点"
            subtitle="Grammar Points"
            color="emerald"
            onClick={() => setActiveModule('grammar')}
          />

          <HskEntryCard 
            icon={Dumbbell}
            title="强化练习"
            subtitle="Practice & Quiz"
            color="orange"
            onClick={() => setActiveModule('practice')}
          />

        </div>

        <p className="text-center text-xs text-gray-300 mt-12 mb-4">
          Keep calm and learn Chinese
        </p>

      </div>
    </div>
  );
};

export default HskLevelPage;
