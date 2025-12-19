import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    ChevronDown, ChevronUp, Mic2, Music4, BookText,
    ListTodo, Layers, Lightbulb, Sparkles, ChevronRight, PlayCircle,
    Gem, MessageCircle, X, CheckCircle2, Crown
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
    const prices = { 1: "10,000 Ks", 2: "15,000 Ks", 3: "20,000 Ks", 4: "价格待定", 5: "价格待定", 6: "价格待定" };
    return prices[level] || "价格待定";
};

const pinyinMain = [
    { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500' },
    { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-500' },
    { id: 'whole', title: '整体认读', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-500' },
    { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-500' },
    { id: 'tips', title: '发音技巧', sub: 'နည်းလမ်း', href: '/pinyin/tips', icon: Lightbulb, color: 'text-orange-500' }
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
            { id: 1, title: '第 1 课 九月去北京旅游最好' }, { id: 2, title: '第 2 课 我每天六点起床' }, { id: 3, title: '第 3 课 左边那个红色的是我的' }, { id: 4, title: '第 4 课 这个工作是他帮我介绍的' }, { id: 5, title: '第 5 课 喂，您好' }, { id: 6, title: '第 6 课 我已经找了工作了' }, { id: 7, title: '第 7 课 门开着呢' }, { id: 8, title: '第 8 课 你别忘了带手机' }, { id: 9, title: '第 9 课 他比我大三岁' }, { id: 10, title: '第 10 课 你看过那个电影吗' }, { id: 11, title: '第 11 课 虽然很累，但是很高兴' }, { id: 12, title: '第 12 课 你穿得太少了' }, { id: 13, title: '第 13 课 我是走回来的' }, { id: 14, title: '第 14 课 你把水果拿过来' }, { id: 15, title: '第 15 课 其他的都没问题' },
        ]
    }
];

let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { }

const checkIsFree = (level, lessonId) => {
    if (level === 1) return lessonId <= 5; 
    return lessonId === 1;
};

// ==========================================
// 2. 核心子组件
// ==========================================

const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
    if (!isOpen) return null;
    const price = getLevelPrice(targetLevel);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
            />
            <motion.div 
                initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
                <div className="p-8 text-center">
                    <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Crown className="text-amber-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">解锁课程内容</h2>
                    <p className="text-slate-500 text-sm mb-6 px-4">解锁 HSK {targetLevel} 全部内容。一次购买，终身享有视频与练习。</p>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl mb-8">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">价格</p>
                        <p className="text-2xl font-black text-amber-600">{price}</p>
                    </div>
                    <a href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
                        className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-blue-200"
                    >
                        <MessageCircle size={22} /> Facebook 私信购买
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

const HskCard = ({ level, onVocabularyClick, onShowMembership }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();

    const handleLessonClick = (e, lesson) => {
        const isFree = checkIsFree(level.level, lesson.id);
        const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('hsk_user') : null;
        const user = cachedUser ? JSON.parse(cachedUser) : null;
        const unlocked = user?.unlocked_levels ? user.unlocked_levels.split(',') : [];
        const isUnlocked = unlocked.includes(`H${level.level}`) || unlocked.includes(`HSK${level.level}`);

        if (!isFree && !isUnlocked) {
            e.preventDefault();
            onShowMembership(level.level);
            return;
        }
        router.push(`/hsk/${level.level}/lessons/${lesson.id}`);
    };

    return (
        <motion.div className="flex flex-col h-full relative rounded-[2.5rem] shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 overflow-hidden">
            {/* 移除 m-2 边距，让图片占满顶部 */}
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
                        <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="flex items-center px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 cursor-pointer transition-all">
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
                    <button 
                        onClick={() => onVocabularyClick(level)}
                        className="w-full py-4 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 dark:from-blue-900/20 dark:to-indigo-900/20 font-black rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                    >
                        <ListTodo size={14} /> HSK {level.level} 生词库
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const PinyinSection = () => {
    const pinyinGrid = pinyinMain.slice(0, 4);
    const pinyinTip = pinyinMain[4];

    return (
        <div className="space-y-8">
            {/* 增加按钮间距 gap-4 */}
            <div className="grid grid-cols-4 gap-4 px-1">
                {pinyinGrid.map((item) => (
                    <Link key={item.id} href={item.href} passHref>
                        <a className="flex flex-col items-center justify-center py-5 rounded-[2rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 active:scale-90 transition-transform shadow-sm">
                            <div className="mb-2.5">
                                <item.icon size={22} className={item.color} />
                            </div>
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-100">{item.title}</span>
                        </a>
                    </Link>
                ))}
            </div>

            <Link href={pinyinTip.href} passHref>
                <a className="flex items-center justify-between px-6 py-5 rounded-[2.5rem] bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 text-orange-900 dark:text-orange-200 border border-orange-100/50 active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white rounded-2xl shadow-sm"><Lightbulb size={20} className="text-orange-500" /></div>
                        <div>
                            <span className="text-base font-black tracking-tight">{pinyinTip.title}</span>
                            <span className="text-[10px] opacity-60 ml-2 font-myanmar">{pinyinTip.sub}</span>
                        </div>
                    </div>
                    <ChevronRight size={20} className="opacity-40" />
                </a>
            </Link>
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

    const handleVocabularyClick = useCallback((level) => {
        const words = hskWordsData[level.level] || [];
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${level.level}`);
        router.push({ pathname: router.pathname, query: { ...router.query, level: level.level }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] pb-24 relative overflow-x-hidden">
            {/* 模拟全屏沉浸式的 CSS 样式 */}
            <style jsx global>{`
                ::-webkit-scrollbar { display: none; }
                body { -ms-overflow-style: none; scrollbar-width: none; background: #f8fafc; }
            `}</style>

            {/* 仿拼音组件背景装饰 */}
            <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] bg-fuchsia-200/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
            <div className="fixed top-[20%] left-[-10%] w-[600px] h-[600px] bg-violet-200/10 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />

            {/* 顶栏：高度缩短，内容居中 */}
            <header className="h-[20rem] relative overflow-hidden flex items-center justify-center">
                <img src="https://images.pexels.com/photos/34876269/pexels-photo-34876269.jpeg" className="absolute inset-0 w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-50 dark:to-[#0a0a0a]" />
                
                <div className="relative z-10 text-center px-6 pt-4">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/20">
                            <Sparkles size={14} className="text-amber-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest opacity-90">Premium Chinese</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tighter drop-shadow-lg">汉语课程中心</h1>
                    </motion.div>
                </div>
            </header>

            {/* 主内容区域 */}
            <div className="max-w-2xl mx-auto px-4 -mt-12 relative z-20 space-y-10">
                
                {/* 拼音导航 */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-white/60 dark:border-slate-800">
                    <PinyinSection />
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
