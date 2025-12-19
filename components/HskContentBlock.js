import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    ChevronDown, ChevronUp, Mic2, Music4, BookText,
    ListTodo, Layers, Lightbulb, Sparkles, ChevronRight, PlayCircle,
    Gem, MessageCircle, X, CheckCircle2, Crown, ArrowLeft, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// --- 动态导入核心组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
const InteractiveLesson = dynamic(() => import('@/components/Tixing/InteractiveLesson'), { ssr: false });

// --- 全屏传送门组件 ---
const FullScreenPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-gray-50 flex flex-col" style={{ touchAction: 'none' }}>
      {children}
    </div>,
    document.body
  );
};

// ==========================================
// 1. 全局配置与数据
// ==========================================

const FB_CHAT_LINK = "https://m.me/61575187883357";

const getLevelPrice = (level) => {
    const prices = { 1: "10,000 Ks", 2: "15,000 Ks", 3: "20,000 Ks" };
    return prices[level] || "价格待定";
};

const pinyinMain = [
    { id: 'initials', title: '声母', sub: 'ဗျည်း', icon: Mic2, color: 'text-blue-500' },
    { id: 'finals', title: '韵母', sub: 'သရ', icon: Music4, color: 'text-emerald-500' },
    { id: 'whole', title: '整体认读', sub: 'အသံတွဲ', icon: Layers, color: 'text-purple-500' },
    { id: 'tones', title: '声调', sub: 'အသံ', icon: BookText, color: 'text-amber-500' },
    { id: 'tips', title: '发音技巧', sub: 'နည်းလမ်း', icon: Lightbulb, color: 'text-orange-500' }
];

const hskData = [
    {
        level: 1, title: '入门水平', description: '掌握最常用词语和基本语法',
        imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
        lessons: [
            { id: 1, title: '第 1 课 你好' }, { id: 2, title: '第 2 课 谢谢你' }, { id: 3, title: '第 3 课 你叫什么名字？' }, { id: 4, title: '第 4 课 她是我的汉语老师' }, { id: 5, title: '第 5 课 她女儿今年二十岁' }, { id: 6, title: '第 6 课 我会说汉语' }, { id: 7, title: '第 7 课 今天几号？' }, { id: 8, title: '第 8 课 我想喝茶' }, { id: 9, title: '第 9 课 你儿子在哪儿工作？' }, { id: 10, title: '第 10 课 我能坐这儿吗？' }, { id: 11, title: '第 11 课 现在几点？' }, { id: 12, title: '第 12 课 明天天气怎么样？' }, { id: 13, title: '第 13 课 他在学做中国菜呢' }, { id: 14, title: '第 14 课 她买了不少衣服' }, { id: 15, title: '第 15 课 我是坐飞机来的' },
        ]
    },
    {
        level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流',
        imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
        lessons: [
            { id: 1, title: '第 1 课 九月去北京旅游最好' }, { id: 2, title: '第 2 课 我每天六点起床' }, { id: 3, title: '第 3 课 左边那个红色的是我的' }, { id: 4, title: '第 4 课 这个工作是他帮我介绍的' }, { id: 5, title: '第 5 课 喂，您好' }, { id: 6, title: '第 6 课 我已经找了工作了' }, { id: 7, title: '第 7 课 门开着呢' }, { id: 8, title: '第 8 课 你别忘了带手机' }, { id: 9, title: '第 9 课 他比我大三岁' }, { id: 10, title: '第 10 课 你看过那个电影吗' }, { id: 11, title: '第 11 课 虽然很累，但是很高高兴' }, { id: 12, title: '第 12 课 你穿得太少了' }, { id: 13, title: '第 13 课 我是走回来的' }, { id: 14, title: '第 14 课 你把水果拿过来' }, { id: 15, title: '第 15 课 其他的都没问题' },
        ]
    }
];

const checkIsFree = (level, lessonId) => {
    if (level === 1) return lessonId <= 5; 
    return lessonId === 1;
};

// ==========================================
// 2. 核心子组件
// ==========================================

const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden p-8 text-center border border-slate-100 dark:border-slate-800">
                <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6"><Crown className="text-amber-600" size={32} /></div>
                <h2 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">解锁 HSK {targetLevel}</h2>
                <p className="text-slate-500 text-sm mb-6 px-4">解锁本级别全部内容，一次购买，终身享有视频与练习。</p>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl mb-8">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">价格</p>
                    <p className="text-2xl font-black text-amber-600">{getLevelPrice(targetLevel)}</p>
                </div>
                <a href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-blue-200">
                    <MessageCircle size={22} /> Facebook 私信购买
                </a>
            </motion.div>
        </div>
    );
};

const HskCard = ({ level, onVocabularyClick, onLessonSelect, onShowMembership }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleLessonClick = (lesson) => {
        const isFree = checkIsFree(level.level, lesson.id);
        const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('hsk_user') : null;
        const user = cachedUser ? JSON.parse(cachedUser) : null;
        const unlocked = user?.unlocked_levels ? user.unlocked_levels.split(',') : [];
        const isUnlocked = unlocked.includes(`H${level.level}`) || unlocked.includes(`HSK${level.level}`);

        if (!isFree && !isUnlocked) {
            onShowMembership(level.level);
            return;
        }
        onLessonSelect(level.level, lesson.id);
    };

    return (
        <motion.div className="flex flex-col h-full relative rounded-[2.5rem] shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="h-44 relative overflow-hidden">
                <img src={level.imageUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-5 left-6 text-white">
                    <h2 className="text-3xl font-black tracking-tight">HSK {level.level}</h2>
                    <p className="text-[10px] font-black text-cyan-400 tracking-widest uppercase opacity-90">{level.title}</p>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <div className="space-y-2 mb-6 flex-grow">
                    {(isExpanded ? level.lessons : level.lessons.slice(0, 3)).map(lesson => (
                        <div key={lesson.id} onClick={() => handleLessonClick(lesson)} className="flex items-center px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 cursor-pointer transition-all">
                            <PlayCircle size={18} className="text-cyan-500 mr-3 shrink-0" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate flex-grow">{lesson.title}</span>
                            {!checkIsFree(level.level, lesson.id) && <Gem size={14} className="text-amber-500 ml-2" />}
                        </div>
                    ))}
                </div>
                <div className="mt-auto space-y-4">
                    {level.lessons.length > 3 && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-[10px] font-black text-slate-400 hover:text-cyan-500 flex items-center justify-center gap-1 uppercase tracking-tighter">
                            {isExpanded ? '收起列表' : `查看全部 ${level.lessons.length} 课时`}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                    <button onClick={() => onVocabularyClick(level)} className="w-full py-4 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 dark:from-blue-900/20 dark:to-indigo-900/20 font-black rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 shadow-sm">
                        <ListTodo size={14} /> HSK {level.level} 生词库
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// ==========================================
// 3. 主页面入口
// ==========================================

export default function HskPageClient() {
    const router = useRouter();
    
    // --- 状态管理 ---
    const [activeModule, setActiveModule] = useState(null); // 'lesson' | 'pinyin'
    const [activeHskWords, setActiveHskWords] = useState(null);
    const [activeLevelTag, setActiveLevelTag] = useState(null);
    const [membership, setMembership] = useState({ open: false, level: null });
    const [lessonData, setLessonData] = useState(null);
    const [selectedPinyin, setSelectedPinyin] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lessonKey, setLessonKey] = useState(0);

    // --- 逻辑：加载课程数据 ---
    const handleLessonSelect = useCallback(async (level, lessonId) => {
        setIsLoading(true);
        try {
            // 这里根据你的文件结构加载 JSON
            const res = await fetch(`/data/hsk/level${level}/lesson${lessonId}.json`);
            if (!res.ok) throw new Error("File not found");
            const data = await res.json();
            setLessonData(data);
            setLessonKey(Date.now());
            setActiveModule('lesson');
            router.push({ pathname: router.pathname, hash: 'hsk-lesson' }, undefined, { shallow: true });
        } catch (e) {
            console.error(e);
            alert("该课程内容正在准备中...");
        }
        setIsLoading(false);
    }, [router]);

    // --- 逻辑：点击拼音 ---
    const handlePinyinClick = (item) => {
        setSelectedPinyin(item);
        setActiveModule('pinyin');
        router.push({ pathname: router.pathname, hash: `pinyin-${item.id}` }, undefined, { shallow: true });
    };

    // --- 监听返回键 ---
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (!hash || hash === '') {
                setActiveModule(null);
                setLessonData(null);
                setSelectedPinyin(null);
            }
        };
        window.addEventListener('popstate', handleHashChange);
        return () => window.removeEventListener('popstate', handleHashChange);
    }, []);

    // --- 逻辑：生词库 ---
    const handleVocabularyClick = useCallback((level) => {
        let words = [];
        try {
            const hskWordsData = {
                1: require('@/data/hsk/hsk1.json'),
                2: require('@/data/hsk/hsk2.json')
            };
            words = hskWordsData[level.level] || [];
        } catch (e) {}
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${level.level}`);
        router.push({ pathname: router.pathname, query: { ...router.query, level: level.level }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
    }, [router]);

    const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] pb-24 relative overflow-x-hidden">
            <style jsx global>{`
                ::-webkit-scrollbar { display: none; }
                body { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* 顶栏：高度缩短至 15rem，增加名言 */}
            <header className="h-[15rem] relative overflow-hidden flex items-center justify-center">
                <img src="https://images.pexels.com/photos/34876269/pexels-photo-34876269.jpeg" className="absolute inset-0 w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-50 dark:to-[#0a0a0a]" />
                
                <div className="relative z-10 text-center px-6 pt-4">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/20">
                            <Sparkles size={12} className="text-amber-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest opacity-90">Premium Chinese</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter drop-shadow-lg mb-2">汉语课程中心</h1>
                        <div className="text-white/80 space-y-1">
                            <p className="text-xs font-medium">“学而时习之，不亦说乎？”</p>
                            <p className="text-[10px] opacity-60 italic font-light">"To learn and then do, is it not a pleasure?"</p>
                        </div>
                    </motion.div>
                </div>
            </header>

            {/* 主内容区域 */}
            <div className="max-w-2xl mx-auto px-4 -mt-10 relative z-20 space-y-10">
                
                {/* 拼音导航 */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[3rem] p-8 shadow-xl border border-white/60 dark:border-slate-800">
                    <div className="space-y-8">
                        <div className="grid grid-cols-4 gap-4 px-1">
                            {pinyinMain.slice(0, 4).map((item) => (
                                <button key={item.id} onClick={() => handlePinyinClick(item)} className="flex flex-col items-center justify-center py-5 rounded-[2rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 active:scale-90 transition-transform shadow-sm">
                                    <div className="mb-2.5"><item.icon size={22} className={item.color} /></div>
                                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-100">{item.title}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handlePinyinClick(pinyinMain[4])} className="w-full flex items-center justify-between px-6 py-5 rounded-[2.5rem] bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 text-orange-900 dark:text-orange-200 border border-orange-100/50 active:scale-[0.98] transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white rounded-2xl shadow-sm"><Lightbulb size={20} className="text-orange-500" /></div>
                                <div className="text-left">
                                    <span className="text-base font-black tracking-tight">{pinyinMain[4].title}</span>
                                    <span className="text-[10px] opacity-60 ml-2 font-myanmar">{pinyinMain[4].sub}</span>
                                </div>
                            </div>
                            <ChevronRight size={20} className="opacity-40" />
                        </button>
                    </div>
                </div>

                {/* 课程列表 */}
                <div className="space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">精品系统课程</h2>
                        <p className="text-slate-400 text-xs font-semibold mt-1">权威标准教程 · 实时互动练习</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-8 px-2 sm:grid-cols-2 lg:grid-cols-2">
                        {hskData.map(level => (
                            <HskCard 
                                key={level.level} 
                                level={level} 
                                onVocabularyClick={handleVocabularyClick}
                                onLessonSelect={handleLessonSelect}
                                onShowMembership={(l) => setMembership({ open: true, level: l })}
                            />
                        ))}
                    </div>
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

            {/* 全屏渲染：课程内容 */}
            {activeModule === 'lesson' && lessonData && (
                <FullScreenPortal>
                    <div className="flex flex-col h-full bg-white">
                        <div className="p-4 border-b flex items-center bg-white sticky top-0 z-10 shadow-sm">
                            <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-600 active:scale-90 transition-transform">
                                <ArrowLeft size={24} />
                            </button>
                            <h2 className="ml-2 font-bold text-lg truncate">{lessonData.title}</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <InteractiveLesson key={lessonKey} lesson={lessonData} />
                        </div>
                    </div>
                </FullScreenPortal>
            )}

            {/* 全屏渲染：拼音详情 */}
            {activeModule === 'pinyin' && selectedPinyin && (
                <FullScreenPortal>
                    <div className="flex flex-col h-full bg-slate-50">
                        <div className="p-4 bg-white border-b flex items-center shadow-sm">
                            <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-600 active:scale-90 transition-transform">
                                <ArrowLeft size={24} />
                            </button>
                            <h2 className="ml-2 font-bold text-lg">{selectedPinyin.title}</h2>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
                                <selectedPinyin.icon size={40} className={selectedPinyin.color} />
                            </div>
                            <h3 className="text-2xl font-black mb-2">{selectedPinyin.title} 学习模块</h3>
                            <p className="text-slate-500 mb-8 max-w-xs">正在为您准备拼音学习的互动内容，请稍后查看。</p>
                            <button onClick={() => router.back()} className="px-10 py-4 bg-slate-900 text-white rounded-full font-bold shadow-lg active:scale-95 transition-all">
                                返回课程中心
                            </button>
                        </div>
                    </div>
                </FullScreenPortal>
            )}

            {/* 生词卡片播放器 */}
            <WordCard 
                isOpen={isCardViewOpen}
                words={activeHskWords || []}
                onClose={() => router.back()}
                progressKey={activeLevelTag || 'hsk-vocab'}
            />

            {/* 加载遮罩 */}
            {isLoading && (
                <div className="fixed inset-0 z-[200000] bg-black/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-cyan-600" size={32} />
                        <span className="font-bold text-slate-700">加载课程中...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
