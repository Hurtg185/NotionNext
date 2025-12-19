import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Mic2, Music4, Layers, BookText, Lightbulb,
  Sparkles, PlayCircle, Gem, MessageCircle,
  Crown, Heart, ChevronRight, Star, BookOpen,
  ChevronDown, ChevronUp, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// 动态导入 WordCard 组件
const WordCard = dynamic(
  () => import('@/components/WordCard'),
  { ssr: false }
);

// ==========================================
// 1. 全局配置与数据
// ==========================================

const FB_CHAT_LINK = "https://m.me/61575187883357";

const getLevelPrice = (level) => {
  const prices = { 1: "10,000 Ks", 2: "15,000 Ks", 3: "20,000 Ks" };
  return prices[level] || "价格待定";
};

// 拼音数据
const pinyinMain = [
  { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'whole', title: '整体认读', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-500', bg: 'bg-amber-50' },
];

// HSK 课程数据
const hskData = [
  {
    level: 1, title: '入门水平', description: '掌握最常用词语和基本语法',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    lessons: [
      { id: 1, title: '第 1 课 你好' }, { id: 2, title: '第 2 课 谢谢你' }, { id: 3, title: '第 3 课 你叫什么名字？' }, { id: 4, title: '第 4 课 她是我的汉语老师' }, { id: 5, title: '第 5 课 她女儿今年二十岁' },
      { id: 6, title: '第 6 课 我会说汉语' }, { id: 7, title: '第 7 课 今天几号？' }, { id: 8, title: '第 8 课 我想喝茶' },
    ]
  },
  {
    level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流',
    imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
    lessons: [
      { id: 1, title: '第 1 课 九月去北京旅游最好' }, { id: 2, title: '第 2 课 我每天六点起床' }, { id: 3, title: '第 3 课 左边那个红色的是我的' },
    ]
  }
];

// 核心生词数据加载
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { console.warn('HSK1 data missing'); }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { console.warn('HSK2 data missing'); }

const checkIsFree = (level, lessonId) => {
  if (level === 1) return lessonId <= 2;
  return lessonId === 1;
};

// ==========================================
// 2. 核心子组件
// ==========================================

// 会员弹窗
const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
  if (!isOpen) return null;
  const price = getLevelPrice(targetLevel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-colors">
          <MessageCircle className="rotate-45" size={20} />
        </button>
        <div className="text-center mt-2">
          <div className="bg-amber-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <Crown className="text-amber-600" size={28} />
          </div>
          <h2 className="text-xl font-black text-slate-800">解锁 HSK {targetLevel}</h2>
          <p className="text-slate-500 text-sm mt-1 mb-5">获取完整视频讲解与练习题</p>
          <div className="bg-slate-50 p-4 rounded-2xl mb-5 border border-slate-100">
            <p className="text-3xl font-black text-amber-500">{price}</p>
          </div>
          <a href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-200"
          >
            <MessageCircle size={20} fill="currentColor" />
            联系老师开通
          </a>
        </div>
      </motion.div>
    </div>
  );
};

// 课程卡片组件
const HskCard = ({ level, onVocabularyClick, onShowMembership }) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLessonClick = (e, lesson) => {
    const isFree = checkIsFree(level.level, lesson.id);
    if (!isFree) {
      e.preventDefault();
      onShowMembership(level.level);
      return;
    }
    router.push(`/hsk/${level.level}/lessons/${lesson.id}`);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.995 }}
      className="flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative z-10"
    >
      {/* 海报区域 */}
      <div className="h-36 relative">
        <img src={level.imageUrl} className="w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-5 text-white">
          <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-0.5">{level.title}</p>
          <h2 className="text-2xl font-black">HSK {level.level}</h2>
        </div>
      </div>

      {/* 课程列表 */}
      <div className="p-4 space-y-2">
        {(isExpanded ? level.lessons : level.lessons.slice(0, 3)).map(lesson => (
          <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="flex items-center p-3 rounded-xl bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors">
            <div className={`p-1.5 rounded-full mr-3 ${checkIsFree(level.level, lesson.id) ? 'bg-cyan-100 text-cyan-600' : 'bg-amber-100 text-amber-600'}`}>
              {checkIsFree(level.level, lesson.id) ? <PlayCircle size={14} fill="currentColor" /> : <Gem size={14} />}
            </div>
            <span className="text-sm font-bold text-slate-700 truncate flex-grow">{lesson.title}</span>
          </div>
        ))}
      </div>

      {/* 底部功能区 */}
      <div className="px-4 pb-5 pt-1 flex flex-col gap-3">
        {/* 1. 全部课程 (上) - 修复：点击不再跳转空白页，而是展开/收起 */}
        {level.lessons.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-2.5 flex items-center justify-center text-xs font-bold text-slate-500 gap-1 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors active:scale-95"
          >
            {isExpanded ? '收起课时' : `查看全部 ${level.lessons.length} 课时`} 
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {/* 2. 本级核心生词 (下) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVocabularyClick(level);
          }}
          className="relative z-20 w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-50 to-rose-50 text-rose-500 rounded-xl font-black text-xs active:scale-95 transition-all border border-pink-100 hover:shadow-sm"
        >
          <BookOpen size={14} />
          <span>本级核心生词</span>
          <span className="text-[10px] opacity-70 font-normal ml-1">(View Words)</span>
        </button>
      </div>
    </motion.div>
  );
};

// 拼音面板组件
const PinyinSection = ({ onOpenCollection }) => {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* 拼音 4 格 */}
      <div className="grid grid-cols-4 gap-2">
        {pinyinMain.map((item) => (
          <Link key={item.id} href={item.href} passHref>
            <a className={`flex flex-col items-center justify-center py-3 rounded-2xl ${item.bg} active:scale-95 transition-transform`}>
              <div className="mb-1 bg-white p-1.5 rounded-full shadow-sm">
                <item.icon size={16} className={item.color} />
              </div>
              <span className="text-[10px] font-bold text-slate-600">{item.title}</span>
            </a>
          </Link>
        ))}
      </div>

      {/* 底部功能区：发音技巧 + 单词收藏 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 发音技巧 */}
        <button 
          onClick={() => router.push('/pinyin/tips')}
          className="flex items-center justify-between px-3 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100/50 active:scale-95 transition-transform group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white rounded-full text-orange-500 shadow-sm shrink-0">
              <Lightbulb size={14} fill="currentColor" />
            </div>
            <div className="text-left leading-tight">
              <span className="block text-xs font-black text-slate-700">发音技巧</span>
            </div>
          </div>
          <ChevronRight size={14} className="text-orange-300" />
        </button>

        {/* 单词收藏 - 修复：点击不再跳转空白页，而是触发弹窗显示已收藏单词 */}
        <button 
          onClick={onOpenCollection}
          className="flex items-center justify-between px-3 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50 active:scale-95 transition-transform group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white rounded-full text-blue-500 shadow-sm shrink-0">
              <Star size={14} fill="currentColor" />
            </div>
            <div className="text-left leading-tight">
              <span className="block text-xs font-black text-slate-700">单词收藏</span>
            </div>
          </div>
          <ChevronRight size={14} className="text-blue-300" />
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 3. 主页面入口
// ==========================================

export default function HskPageClient() {
  const router = useRouter();
  const [activeHskWords, setActiveHskWords] = useState(null);
  const [activeLevelTag, setActiveLevelTag] = useState(null);
  const [membership, setMembership] = useState({ open: false, level: null });

  const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');

  // 处理生词本点击逻辑
  const handleVocabularyClick = useCallback((level) => {
    const levelNum = level?.level || 1;
    const words = hskWordsData[levelNum] || [];
    
    setActiveHskWords(words);
    setActiveLevelTag(`hsk${levelNum}`);
    
    router.push({
      pathname: router.pathname,
      query: { ...router.query, level: levelNum },
      hash: 'hsk-vocabulary'
    }, undefined, { shallow: true });
  }, [router]);

  // 【核心功能】处理收藏夹逻辑：点击收藏按钮时，过滤出所有点过红心的单词
  const handleCollectionClick = useCallback(() => {
    // 1. 从本地存储获取收藏的单词 ID 列表
    // 这个 Key 必须和你的 WordCard 组件内保存收藏的 Key 一致
    const favoritesKey = 'framer-pinyin-favorites'; 
    const savedIds = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    
    // 2. 汇总所有可能的单词
    const allWords = [
      ...(hskWordsData[1] || []),
      ...(hskWordsData[2] || [])
    ];
    
    // 3. 过滤出已收藏的单词对象
    const favoriteWords = allWords.filter(word => savedIds.includes(word.id));

    if (favoriteWords.length === 0) {
      alert("你还没有收藏任何单词哦！在学习单词时点击红心即可收藏。");
      return;
    }

    // 4. 打开弹窗播放收藏的单词
    setActiveHskWords(favoriteWords);
    setActiveLevelTag('my-favorites-collection');
    
    router.push({
      pathname: router.pathname,
      hash: 'hsk-vocabulary'
    }, undefined, { shallow: true });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-20 relative overflow-x-hidden">
      {/* 顶部背景装饰 */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      {/* Header 区域 */}
      <header className="relative pt-4 px-4 pb-1 z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur rounded-full border border-blue-100 shadow-sm">
            <Sparkles size={12} className="text-blue-500" />
            <span className="text-[10px] font-bold text-blue-800 uppercase">Premium Class</span>
          </div>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center text-white font-black italic shadow-md">
            CN
          </div>
        </div>

        {/* 拼音面板 */}
        <div className="bg-white rounded-[1.8rem] p-4 shadow-xl shadow-slate-200/60 border border-slate-50">
          <PinyinSection onOpenCollection={handleCollectionClick} />
        </div>
      </header>

      {/* 系统课程列表 */}
      <div className="max-w-2xl mx-auto px-4 relative z-10 mt-2 space-y-4">
        <div className="flex items-center gap-2 px-1 opacity-70">
          <BookText size={14} className="text-slate-500" />
          <h2 className="text-xs font-black text-slate-600 uppercase tracking-wider">System Courses</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 pb-10">
          {hskData.map(level => (
            <HskCard
              key={level.level}
              level={level}
              onVocabularyClick={handleVocabularyClick}
              onShowMembership={(l) => setMembership({ open: true, level: l })}
            />
          ))}
        </div>
      </div>

      {/* 会员升级弹窗 */}
      <AnimatePresence>
        {membership.open && (
          <MembershipModal
            isOpen={membership.open}
            onClose={() => setMembership({ open: false, level: null })}
            targetLevel={membership.level}
          />
        )}
      </AnimatePresence>

      {/* 生词卡片播放器 */}
      <WordCard
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={() => router.push(router.pathname, undefined, { shallow: true })}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </div>
  );
}
