// -----------------------------------------------------------------------------
// 补丁：虽然 import 会提升，但保留这个补丁可以防止某些运行时错误
// -----------------------------------------------------------------------------
if (typeof global.self === 'undefined') {
  global.self = global;
}
if (typeof global.window === 'undefined') {
  global.window = {};
  global.document = {};
}

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic'; // ✅ 引入 dynamic
import { 
  ChevronLeft, Trophy, Star, BookOpen, 
  GraduationCap, Dumbbell, Play, CheckCircle2 
} from 'lucide-react';

// =========================================================================
// ✅ 关键修复：使用 dynamic 引入 WordCard
// 这样服务器构建时会直接跳过它，彻底解决 "self is not defined"
// =========================================================================
const WordCard = dynamic(() => import('../../components/WordCard'), {
  ssr: false, // 禁止服务端渲染
  loading: () => (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
    </div>
  ),
});

// =========================================================================
// 1. 数据导入
// =========================================================================
import hsk1Words from '../../data/hsk/hsk1.json';
import hsk2Words from '../../data/hsk/hsk2.json';
import hsk3Words from '../../data/hsk/hsk3.json';
import hsk4Words from '../../data/hsk/hsk4.json';
import hsk5Words from '../../data/hsk/hsk5.json';
import hsk6Words from '../../data/hsk/hsk6.json';

const hskDataMap = {
  '1': hsk1Words, '2': hsk2Words, '3': hsk3Words, 
  '4': hsk4Words, '5': hsk5Words, '6': hsk6Words,
};

// =========================================================================
// 2. 核心逻辑：自动分课算法
// =========================================================================
const WORDS_PER_LESSON = 15; // 每课 15 个词

const createLessons = (allWords) => {
  const lessons = [];
  // 遍历切割数组
  for (let i = 0; i < allWords.length; i += WORDS_PER_LESSON) {
    const chunk = allWords.slice(i, i + WORDS_PER_LESSON);
    const lessonNum = (i / WORDS_PER_LESSON) + 1;
    lessons.push({
      id: lessonNum,
      title: `第 ${lessonNum} 课`,
      words: chunk,
      // 取第一个词作为主题词，防止空数据报错
      topic: chunk[0] ? `${chunk[0].hanzi} (${chunk[0].pinyin})` : '复习', 
    });
  }
  return lessons;
};

// =========================================================================
// 3. 子组件：课程操作面板 (点击课程后弹出的菜单)
// =========================================================================
const LessonActionSheet = ({ lesson, onClose, onStartWords, onStartGrammar, onStartPractice }) => {
  if (!lesson) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      {/* 黑色半透明背景 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* 弹窗主体 */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
        {/* 顶部把手 */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden"></div>

        <div className="text-center mb-8">
          <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Lesson {lesson.id}</div>
          <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white mb-2">{lesson.topic} 等</h2>
          <p className="text-gray-500 text-sm">本课包含 {lesson.words.length} 个重点生词</p>
        </div>

        <div className="grid gap-3">
          {/* 学习生词按钮 */}
          <button 
            onClick={() => onStartWords(lesson.words)}
            className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl font-bold hover:bg-blue-100 transition-colors active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center mr-4">
              <BookOpen size={20} />
            </div>
            学习生词
            <span className="ml-auto bg-white dark:bg-blue-900 py-1 px-2 rounded-md text-xs font-mono opacity-70">
              {lesson.words.length} 词
            </span>
          </button>

          {/* 语法按钮 */}
          <button 
            onClick={() => onStartGrammar(lesson.id)}
            className="flex items-center p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold hover:bg-emerald-100 transition-colors active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center mr-4">
              <GraduationCap size={20} />
            </div>
            语法重点
          </button>

          {/* 练习按钮 */}
          <button 
            onClick={() => onStartPractice(lesson.words)}
            className="flex items-center p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-xl font-bold hover:bg-orange-100 transition-colors active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center mr-4">
              <Dumbbell size={20} />
            </div>
            课后练习
          </button>
        </div>

        <button onClick={onClose} className="mt-6 w-full py-3 text-gray-400 font-medium hover:text-gray-600">
          取消
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 4. 主页面组件
// =========================================================================
const HskLevelPage = () => {
  const router = useRouter();
  const { level } = router.query;
  
  const [levelData, setLevelData] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  
  // 学习模式状态
  const [studyMode, setStudyMode] = useState(null); // 'words' | 'grammar' | 'practice'
  const [activeWords, setActiveWords] = useState([]);

  // 加载数据
  useEffect(() => {
    if (level && hskDataMap[level]) {
      const rawData = hskDataMap[level];
      // 兼容 JSON 格式 (数组或对象)
      const wordsArray = Array.isArray(rawData) ? rawData : (rawData.words || []);
      setLevelData(wordsArray);
      setLessons(createLessons(wordsArray));
    }
  }, [level]);

  // --- 交互处理 ---
  const handleStartWords = (words) => {
    setSelectedLesson(null); 
    setActiveWords(words);
    setStudyMode('words');
  };

  const handleStartGrammar = (lessonId) => {
    alert(`第 ${lessonId} 课的语法功能正在开发中...`);
  };

  const handleStartPractice = (words) => {
    alert(`针对这 ${words.length} 个词的练习正在生成...`);
  };

  const vibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  };

  if (!level) return <div className="min-h-screen bg-[#F5F7FA] dark:bg-gray-950"/>;

  // ---------------------------------------------------------------------------
  // 场景 1：全屏背单词模式
  // ---------------------------------------------------------------------------
  if (studyMode === 'words') {
    return (
      <WordCard
        words={activeWords}
        isOpen={true}
        onClose={() => setStudyMode(null)}
        progressKey={`hsk${level}_lesson_session`}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // 场景 2：分课列表主页
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-gray-950 font-sans pb-safe">
      <Head>
        <title>HSK {level} - 课程模式</title>
      </Head>

      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-[#F5F7FA]/90 dark:bg-gray-950/90 backdrop-blur-md flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <Link href="/hsk" onClick={vibrate} className="p-2 -ml-2 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
          <ChevronLeft size={24} />
        </Link>
        <span className="font-bold text-gray-800 dark:text-white text-lg">HSK {level} 级课程</span>
        <div className="w-8" />
      </div>

      <div className="px-5 pt-6 pb-20">
        
        {/* 总复习卡片 */}
        <div className="mb-8 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl text-white shadow-xl shadow-indigo-500/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">总复习</h1>
              <p className="text-indigo-100 text-sm">Ready for the exam?</p>
            </div>
            <Trophy className="text-yellow-300" size={28} />
          </div>
          
          <div className="flex gap-3 mt-4">
             <button 
               onClick={() => handleStartWords(levelData)}
               className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-sm font-bold transition-colors border border-white/10"
             >
               全部 {levelData.length} 词
             </button>
          </div>
        </div>

        {/* 课程列表 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-gray-800 dark:bg-white rounded-full"></div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">分课学习</h2>
        </div>

        <div className="space-y-4">
          {lessons.map((lesson, index) => (
            <button
              key={lesson.id}
              onClick={() => { vibrate(); setSelectedLesson(lesson); }}
              className="group w-full bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 text-left transition-all active:scale-[0.98]"
            >
              {/* 序号装饰 */}
              <div className="relative w-14 h-14 flex-shrink-0">
                <div className={`absolute inset-0 rounded-2xl rotate-3 ${index % 2 === 0 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-pink-100 dark:bg-pink-900'}`}></div>
                <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center z-10">
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Lesson</span>
                   <span className="text-xl font-extrabold text-gray-800 dark:text-white">{lesson.id}</span>
                </div>
              </div>

              {/* 文本信息 */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                   {lesson.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} /> {lesson.words.length} 词
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={12} /> 核心必考
                  </span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                <Play size={16} fill="currentColor" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">已加载 {lessons.length} 节课程</p>
        </div>

      </div>

      {/* 底部操作面板 */}
      <LessonActionSheet 
        lesson={selectedLesson}
        onClose={() => setSelectedLesson(null)}
        onStartWords={handleStartWords}
        onStartGrammar={handleStartGrammar}
        onStartPractice={handleStartPractice}
      />

    </div>
  );
};

export default HskLevelPage;
