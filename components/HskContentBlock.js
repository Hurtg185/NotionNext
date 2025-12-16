import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  ChevronDown, ChevronUp, Mic2, Music4, BookText, 
  ListTodo, Layers, Lightbulb, ArrowRight 
} from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

// 动态导入 WordCard 组件
const WordCard = dynamic(
  () => import('@/components/WordCard'),
  { ssr: false }
);

// ==========================================
// 1. 数据中心 (Data Center)
// ==========================================

// --- 拼音数据 (按你的要求分为两组) ---

// 第一排：2个 (声母、韵母)
const pinyinRow1 = [
  { 
    id: 'initials',
    title: '声母', 
    subtitle: 'Initials',
    href: '/pinyin/initials', 
    icon: Mic2, 
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'finals',
    title: '韵母', 
    subtitle: 'Finals',
    href: '/pinyin/finals', 
    icon: Music4, 
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500 to-teal-500'
  }
];

// 第二排：3个 (声调、整体认读、技巧)
const pinyinRow2 = [
  { 
    id: 'tones',
    title: '声调', 
    subtitle: 'Tones',
    href: '/pinyin/tones', 
    icon: BookText, 
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-500 to-orange-500'
  },
  { 
    id: 'whole',
    title: '整体认读', 
    subtitle: 'Whole',
    href: '/pinyin/whole', 
    icon: Layers, 
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-500 to-violet-500'
  },
  { 
    id: 'tips',
    title: '技巧', 
    subtitle: 'Tips',
    href: '/pinyin/tips', 
    icon: Lightbulb, 
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-500 to-pink-500'
  }
];

// --- HSK 词汇数据加载 ---
// 确保你的 data/hsk 目录下有这些 json 文件
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { console.warn("HSK 1 words missing"); }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { console.warn("HSK 2 words missing"); }
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) { console.warn("HSK 3 words missing"); }
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) { console.warn("HSK 4 words missing"); }
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) { console.warn("HSK 5 words missing"); }
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) { console.warn("HSK 6 words missing"); }

// --- HSK 课程列表数据 ---
const hskData = [
    { 
        level: 1, 
        title: '入门水平', 
        description: '掌握最常用词语和基本语法', 
        imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 你好' },
            { id: 2, title: '第 2 课 谢谢你' },
            { id: 3, title: '第 3 课 你叫什么名字？' },
            { id: 4, title: '第 4 课 她是我的汉语老师' },
            { id: 5, title: '第 5 课 她女儿今年二十岁' },
            { id: 6, title: '第 6 课 我会说汉语' },
            { id: 7, title: '第 7 课 今天几号？' },
            { id: 8, title: '第 8 课 我想喝茶' },
            { id: 9, title: '第 9 课 你儿子在哪儿工作？' },
            { id: 10, title: '第 10 课 我能坐这儿吗？' },
            { id: 11, title: '第 11 课 现在几点？' },
            { id: 12, title: '第 12 课 明天天气怎么样？' },
            { id: 13, title: '第 13 课 他在学做中国菜呢' },
            { id: 14, title: '第 14 课 她买了不少衣服' },
            { id: 15, title: '第 15 课 我是坐飞机来的' },
        ]
    },
    { 
        level: 2, 
        title: '基础水平', 
        description: '就熟悉的日常话题进行交流', 
        imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 九月去北京旅游最好' },
            { id: 2, title: '第 2 课 我每天六点起床' },
            { id: 3, title: '第 3 课 左边那个红色的是我的' },
            { id: 4, title: '第 4 课 这个工作是他帮我介绍的' },
            { id: 5, title: '第 5 课 喂，您好' },
            { id: 6, title: '第 6 课 我已经找了工作了' },
            { id: 7, title: '第 7 课 门开着呢' },
            { id: 8, title: '第 8 课 你别忘了带手机' },
            { id: 9, title: '第 9 课 他比我大三岁' },
            { id: 10, title: '第 10 课 你看过那个电影吗' },
            { id: 11, title: '第 11 课 虽然很累，但是很高兴' },
            { id: 12, title: '第 12 课 你穿得太少了' },
            { id: 13, title: '第 13 课 我是走回来的' },
            { id: 14, title: '第 14 课 你把水果拿过来' },
            { id: 15, title: '第 15 课 其他的都没问题' },
        ]
    },
    { 
        level: 3, 
        title: '进阶水平', 
        description: '完成生活、学习、工作的基本交际', 
        imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 周末你有什么打算' },
            { id: 2, title: '第 2 课 他什么时候回来' },
            { id: 3, title: '第 3 课 桌子上放着很多饮料' },
            { id: 4, title: '第 4 课 我总是饿' },
            { id: 5, title: '第 5 课 我家离公司很远' },
            { id: 6, title: '第 6 课 我最近越来越胖了' },
            { id: 7, title: '第 7 课 你感冒了？' },
            { id: 8, title: '第 8 课 我们去看电影吧' },
            { id: 9, title: '第 9 课 你的腿怎么了？' },
            { id: 10, title: '第 10 课 别忘了把空调关了' },
            { id: 11, title: '第 11 课 我把护照放在哪儿了？' },
            { id: 12, title: '第 12 课 你为什么那么高兴？' },
            { id: 13, title: '第 13 课 我是走着去学校的' },
            { id: 14, title: '第 14 课 你把这个句子抄十遍' },
            { id: 15, title: '第 15 课 新年就要到了' },
            { id: 16, title: '第 16 课 我要跟你一起去' },
            { id: 17, title: '第 17 课 我觉得他好多了' },
            { id: 18, title: '第 18 课 我相信他们会同意的' },
            { id: 19, title: '第 19 课 你没看出来吗？' },
            { id: 20, title: '第 20 课 我被他影响了' },
        ]
    },
    // ... 其他等级省略，为节省篇幅，逻辑同上
];

// ==========================================
// 2. 子组件定义
// ==========================================

const HskCard = ({ level, onVocabularyClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 3;
    // 修改默认显示数量为 3
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 3);

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    return (
        <motion.div
            variants={cardVariants}
            className="flex flex-col h-full relative rounded-[2rem] shadow-xl overflow-hidden group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
        >
            {/* 增加图片高度，更有冲击力 */}
            <div className="h-56 sm:h-64 relative overflow-hidden shrink-0">
                <img 
                  src={level.imageUrl} 
                  alt={level.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
                <div className="absolute bottom-5 left-6 z-20 text-white">
                    <span className="inline-block bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1">
                        Level {level.level}
                    </span>
                    <h2 className="font-extrabold text-3xl tracking-tight mb-0.5">HSK {level.level}</h2>
                    <p className="font-medium text-base text-white/90">{level.title}</p>
                </div>
            </div>
            
            <div className="p-6 flex flex-col flex-grow relative z-20">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 line-clamp-2 leading-relaxed">
                    {level.description}
                </p>
                
                <div className="space-y-2 mb-6 flex-grow">
                    {visibleLessons.map(lesson => (
                        <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                            <a className="block px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 active:bg-cyan-50 dark:active:bg-cyan-900/20 text-gray-700 dark:text-gray-200 transition-colors text-sm font-medium truncate flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2.5" />
                                {lesson.title}
                            </a>
                        </Link>
                    ))}
                </div>
                
                <div className="mt-auto space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    {hasMore && (
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            className="w-full text-xs py-2 text-gray-500 hover:text-cyan-600 transition-colors flex items-center justify-center gap-1 font-medium"
                        >
                            {isExpanded ? '收起列表' : `展开剩余 ${level.lessons.length - 3} 课`}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            onVocabularyClick(level);
                        }} 
                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 active:scale-[0.98] text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 font-bold text-sm"
                    >
                        <ListTodo size={18} />
                        全屏单词卡
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const PinyinSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 10, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  // 渲染单个拼音模块的辅助函数
  const renderCard = (module) => (
    <Link key={module.id} href={module.href} passHref>
        <motion.a
            variants={itemVariants}
            whileTap={{ scale: 0.95 }}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border ${module.borderColor} ${module.bg} relative overflow-hidden h-full`}
        >
            <div className={`p-3 rounded-full bg-gradient-to-br ${module.gradient} text-white shadow-md mb-2`}>
                <module.icon size={20} />
            </div>
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">
                {module.title}
            </h3>
            <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                {module.subtitle}
            </span>
        </motion.a>
    </Link>
  );

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">拼音基础</h2>
            <div className="h-px flex-grow bg-gray-200 dark:bg-gray-700"></div>
       </div>
       
       <motion.div 
         variants={containerVariants}
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, amount: 0.2 }}
         className="space-y-3"
       >
         {/* 第一排：2个 */}
         <div className="grid grid-cols-2 gap-3">
            {pinyinRow1.map(renderCard)}
         </div>

         {/* 第二排：3个 */}
         <div className="grid grid-cols-3 gap-3">
            {pinyinRow2.map(renderCard)}
         </div>
       </motion.div>
    </div>
  );
};

// ==========================================
// 3. 主页面组件 (Main Page Client)
// ==========================================

export default function HskPageClient() { 
  const router = useRouter();
  const [activeHskWords, setActiveHskWords] = useState(null);
  const [activeLevelTag, setActiveLevelTag] = useState(null);

  const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');

  // =========================================================================
  // 核心修复逻辑：监听 URL 参数，防止刷新/分享后数据丢失导致的“空白”
  // =========================================================================
  useEffect(() => {
    // 1. 确保路由就绪且当前处于单词模式
    if (!router.isReady || !router.asPath.includes('#hsk-vocabulary')) return;

    // 2. 如果 state 里已经有数据，不重复加载
    if (activeHskWords && activeHskWords.length > 0) return;

    // 3. 从 URL 获取 level 参数
    const { level } = router.query;
    if (!level) return;

    const levelNum = parseInt(level, 10);
    const words = hskWordsData[levelNum];

    // 4. 恢复数据
    if (words && words.length > 0) {
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${levelNum}`);
    }
  }, [router.isReady, router.asPath, router.query, activeHskWords]);

  const handleVocabularyClick = useCallback((level) => {
    const words = hskWordsData[level.level];
    
    // 安全检查：防止数据为空时打开空白弹窗
    if (!words || words.length === 0) {
      alert(`HSK ${level.level} 的词汇数据暂未加载，请检查 data 目录。`);
      return;
    }

    setActiveHskWords(words);
    setActiveLevelTag(`hsk${level.level}`);
    
    // 关键修改：将 level 参数写入 URL，支持页面刷新恢复数据
    router.push({
        pathname: router.pathname,
        query: { ...router.query, level: level.level },
        hash: 'hsk-vocabulary'
    }, undefined, { shallow: true });

  }, [router]);

  const handleCloseCard = useCallback(() => {
    setActiveHskWords(null);
    setActiveLevelTag(null);
    
    // 关闭时清除 URL 中的 hash 和参数
    const { level, ...restQuery } = router.query;
    router.push({
        pathname: router.pathname,
        query: restQuery,
        hash: ''
    }, undefined, { shallow: true });

  }, [router]);
  
  return (
    <>
      <div 
          className="relative min-h-screen bg-gray-50 dark:bg-gray-900 pb-20"
          style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1519120944692-1a8d8cfc107f?auto=format&fit=crop&q=80&w=2000)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed'
          }}
      >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-white/95 dark:bg-black/90 backdrop-blur-sm z-0"></div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 py-10 space-y-10">
              
              {/* 头部 */}
              <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-2"
              >
                  <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">
                    汉语学习中心
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    拼音 · 词汇 · HSK 课程
                  </p>
              </motion.div>
        
              {/* 拼音部分 - 移动端优化 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/50 dark:border-gray-700/50">
                  <PinyinSection />
              </div>

              {/* HSK 部分 */}
              <div className="space-y-6">
                  <div className="flex items-center gap-3 pl-1">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">HSK 等级课程</h2>
                  </div>
                  
                  {/* 改为单列布局适合手机，平板以上可双列 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {hskData.map(level => (
                        <HskCard 
                          key={level.level} 
                          level={level} 
                          onVocabularyClick={handleVocabularyClick}
                        />
                      ))}
                  </div>
              </div>
          </div>
      </div>

      <WordCard 
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={handleCloseCard}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </>
  );
};
