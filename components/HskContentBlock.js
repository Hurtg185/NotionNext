import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    ChevronDown, ChevronUp, Mic2, Music4, BookText,
    ListTodo, Layers, Lightbulb, Sparkles, ChevronRight, PlayCircle,
    Gem, MessageCircle, X, CheckCircle2, ShieldCheck, CreditCard, Crown
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
    const prices = {
        1: "10,000 Ks",
        2: "15,000 Ks",
        3: "20,000 Ks",
        4: "价格待定",
        5: "价格待定",
        6: "价格待定"
    };
    return prices[level] || "价格待定";
};

const pinyinMain = [
    { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500' },
    { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-500' },
    { id: 'whole', title: '整体认读', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-500' },
    { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-500' },
    { id: 'tips', title: '发音技巧', sub: 'နည်းလမ်း', href: '/pinyin/tips', icon: Lightbulb, color: 'text-rose-500' }
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
    },
    {
        level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际',
        imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80',
        lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 进阶内容展示` }))
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

/**
 * 会员购买/升级弹窗 (美化版)
 */
const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
    if (!isOpen) return null;
    const price = getLevelPrice(targetLevel);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div 
                initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl">
                            <Crown className="text-amber-600" size={28} />
                        </div>
                        <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400">
                            <X size={18} />
                        </button>
                    </div>

                    <h2 className="text-2xl font-black mb-2 text-gray-900 dark:text-white">解锁 HSK {targetLevel} 课程</h2>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        您正在尝试观看付费课程。一次购买，终身享有该等级所有视频与练习。
                    </p>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <div className="bg-white dark:bg-gray-700 p-2 rounded-xl shadow-sm">
                                <CreditCard className="text-blue-500" size={20} />
                            </div>
                            <div className="flex-grow">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">价格方案</p>
                                <p className="text-lg font-black text-amber-600">{price}</p>
                            </div>
                        </div>
                        <ul className="space-y-2 px-2">
                            {['同步解锁生词库', '无限制观看所有课时', '终身免费升级更新'].map((text, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                    <CheckCircle2 size={14} className="text-green-500" /> {text}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <a 
                        href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 transition-all hover:shadow-xl hover:shadow-blue-500/20 active:scale-95"
                    >
                        <MessageCircle size={22} />
                        Facebook 私信老师购买
                    </a>
                    
                    <p className="mt-4 text-[10px] text-center text-gray-400 font-medium px-4">
                        支付成功后，您将获得一个唯一的激活码，在侧边栏输入即可解锁。
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

/**
 * HSK 等级卡片
 */
const HskCard = ({ level, onVocabularyClick, onShowMembership }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();

    const hasMore = level.lessons.length > 3;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 3);

    const handleLessonClick = (e, lesson) => {
        const isFree = checkIsFree(level.level, lesson.id);
        
        // 关键逻辑：从 localStorage 获取最新的解锁状态
        const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('hsk_user') : null;
        const user = cachedUser ? JSON.parse(cachedUser) : null;
        
        // 允许 H1 或 HSK1 两种存储格式的兼容
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
        <motion.div className="flex flex-col h-full relative rounded-[2.5rem] shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 group">
            <div className="h-44 relative overflow-hidden rounded-[2.5rem] m-2">
                <img src={level.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-5 left-6 text-white">
                    <h2 className="text-3xl font-black">HSK {level.level}</h2>
                    <p className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">{level.title}</p>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <div className="space-y-2 mb-4 flex-grow">
                    {visibleLessons.map(lesson => {
                        const isFree = checkIsFree(level.level, lesson.id);
                        return (
                            <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="cursor-pointer">
                                <div className="flex items-center px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all border border-transparent hover:border-cyan-100 dark:hover:border-cyan-900">
                                    <PlayCircle size={16} className="text-cyan-500 mr-3 shrink-0" />
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate flex-grow">
                                        {lesson.title}
                                    </span>
                                    {!isFree && (
                                        <Gem size={12} className="text-amber-500 ml-2" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-auto space-y-3 pt-4 border-t border-gray-50 dark:border-gray-700">
                    {hasMore && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-[10px] font-black text-gray-400 hover:text-cyan-500 flex items-center justify-center gap-1 uppercase tracking-tighter">
                            {isExpanded ? '收起列表' : `查看全部 ${level.lessons.length} 个课时`}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                    <button 
                        onClick={() => onVocabularyClick(level)}
                        className="w-full py-4 bg-gray-900 dark:bg-black text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg"
                    >
                        <ListTodo size={14} /> HSK {level.level} 生词库
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

/**
 * 拼音区域布局 (手机一排4个，去掉技巧卡片)
 */
const PinyinSection = () => {
    const pinyinGrid = pinyinMain.slice(0, 4);
    const pinyinTip = pinyinMain[4];

    return (
        <div className="space-y-8">
            {/* 一排四个布局 */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 px-1">
                {pinyinGrid.map((item) => (
                    <Link key={item.id} href={item.href} passHref>
                        <a className="flex flex-col items-center justify-center py-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform shadow-sm">
                            <div className="mb-2">
                                <item.icon size={20} className={item.color} />
                            </div>
                            <span className="text-[10px] font-black text-gray-800 dark:text-gray-100">{item.title}</span>
                        </a>
                    </Link>
                ))}
            </div>

            {/* 发音技巧 - 简约条状样式 */}
            <Link href={pinyinTip.href} passHref>
                <a className="flex items-center justify-between px-6 py-4 rounded-2xl bg-gray-900 text-white shadow-xl shadow-gray-200 dark:shadow-none active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-3">
                        <Lightbulb size={18} className="text-amber-400" />
                        <div>
                            <span className="text-sm font-black tracking-tight">{pinyinTip.title}</span>
                            <span className="text-[10px] opacity-50 ml-2 font-myanmar">{pinyinTip.sub}</span>
                        </div>
                    </div>
                    <ChevronRight size={18} className="opacity-50" />
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

    const handleShowMembership = (level) => setMembership({ open: true, level });
    const handleCloseMembership = () => setMembership({ open: false, level: null });

    const handleVocabularyClick = useCallback((level) => {
        const words = hskWordsData[level.level] || [];
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${level.level}`);
        router.push({ pathname: router.pathname, query: { ...router.query, level: level.level }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
    }, [router]);

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-24">
            {/* 顶栏背景装饰 */}
            <div className="h-64 bg-gray-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20" />
                <div className="max-w-6xl mx-auto px-6 pt-12 relative z-10">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
                            <Sparkles size={12} className="text-amber-400" />
                            <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Premium Learning</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter">HSK 汉语课程中心</h1>
                    </motion.div>
                </div>
            </div>

            {/* 内容区 */}
            <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-20 space-y-12">
                
                {/* 拼音导航 */}
                <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-sm border border-white/20">
                    <PinyinSection />
                </div>

                {/* HSK 列表 */}
                <div className="space-y-6">
                    <div className="flex flex-col gap-1 px-4">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">系统课程</h2>
                        <p className="text-gray-400 text-xs font-medium">HSK 官方标准教程 · 同步练习</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {hskData.map(level => (
                            <HskCard 
                                key={level.level} 
                                level={level} 
                                onVocabularyClick={handleVocabularyClick}
                                onShowMembership={handleShowMembership}
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
                        onClose={handleCloseMembership} 
                        targetLevel={membership.level} 
                    />
                )}
            </AnimatePresence>

            {/* 生词卡片 */}
            <WordCard 
                isOpen={isCardViewOpen}
                words={activeHskWords || []}
                onClose={() => router.push(router.pathname, undefined, { shallow: true })}
                progressKey={activeLevelTag || 'hsk-vocab'}
            />
        </div>
    );
}
