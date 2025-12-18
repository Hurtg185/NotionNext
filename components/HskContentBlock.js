import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    ChevronDown, ChevronUp, Mic2, Music4, BookText,
    ListTodo, Layers, Lightbulb, Sparkles, ChevronRight, PlayCircle,
    Gem, MessageCircle, X, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// 动态导入 WordCard 组件 (生词库)
const WordCard = dynamic(
    () => import('@/components/WordCard'),
    { ssr: false }
);

// ==========================================
// 1. 全局配置与数据
// ==========================================

const FB_CHAT_LINK = "https://m.me/61575187883357";

// 价格配置表
const getLevelPrice = (level) => {
    const prices = {
        1: "10,000 Ks",
        2: "价格待定",
        3: "价格待定",
        4: "价格待定",
        5: "价格待定",
        6: "价格待定"
    };
    return prices[level] || "价格待定";
};

// 拼音数据
const pinyinMain = [
    { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500' },
    { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-500' },
    { id: 'whole', title: '整体认读', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-500' },
    { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-500' },
    { id: 'tips', title: '发音技巧', sub: 'နည်းလမ်း', href: '/pinyin/tips', icon: Lightbulb, color: 'text-rose-500' }
];

// HSK 课程数据
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
    },
    {
        level: 4, title: '中级水平', description: '流畅地与母语者进行交流',
        imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
        lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 中级内容展示` }))
    },
    {
        level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目',
        imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
        lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 高级内容展示` }))
    },
    {
        level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点',
        imageUrl: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=800&q=80',
        lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 流利内容展示` }))
    }
];

// --- HSK 词汇数据 (静默加载) ---
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { }

// ==========================================
// 2. 核心子组件
// ==========================================

// 判断课程是否免费
const checkIsFree = (level, lessonId) => {
    if (level === 1) return lessonId <= 5; 
    return lessonId === 1;
};

/**
 * 会员购买/升级弹窗
 */
const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
    if (!isOpen) return null;
    const price = getLevelPrice(targetLevel);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
                {/* 顶部金边装饰 */}
                <div className="h-2 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300" />
                
                <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="p-8">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
                            <Gem size={32} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">解锁 HSK {targetLevel}</h2>
                        <p className="text-gray-500 text-sm mt-1">加入会员，获取当前等级全部完整课程</p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm font-bold text-gray-600 dark:text-gray-400">会员方案</span>
                            <span className="text-xl font-black text-amber-600">{price}</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <CheckCircle2 size={14} className="text-green-500" /> 包含本等级所有视频、听力、PDF课件
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <CheckCircle2 size={14} className="text-green-500" /> 终身永久访问权限
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <CheckCircle2 size={14} className="text-green-500" /> 同步解锁生词库收藏功能
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <a 
                            href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
                            className="w-full py-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                            <MessageCircle size={20} />
                            脸书私信老师一键购买
                        </a>
                        
                        <p className="text-[10px] text-center text-gray-400">
                            支付成功后，老师将发送激活码为您手动解锁
                        </p>
                    </div>
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
        const unlockedLevels = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('hsk_unlocked_levels') || '[]' : '[]');
        const isLevelUnlocked = unlockedLevels.includes(`H${level.level}`);

        if (!isFree && !isLevelUnlocked) {
            e.preventDefault();
            onShowMembership(level.level);
            return;
        }
        router.push(`/hsk/${level.level}/lessons/${lesson.id}`);
    };

    return (
        <motion.div className="flex flex-col h-full relative rounded-[2.5rem] shadow-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-all duration-300">
            <div className="h-44 relative overflow-hidden">
                <img src={level.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-6 text-white">
                    <h2 className="text-3xl font-black">HSK {level.level}</h2>
                    <p className="text-xs font-bold text-cyan-300 tracking-wider uppercase">{level.title}</p>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <div className="space-y-2 mb-4 flex-grow">
                    {visibleLessons.map(lesson => {
                        const isFree = checkIsFree(level.level, lesson.id);
                        return (
                            <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="cursor-pointer group/item">
                                <div className="relative flex items-center px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-cyan-100 dark:hover:border-cyan-900 transition-all">
                                    <PlayCircle size={16} className="text-cyan-500 mr-3 shrink-0" />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate flex-grow">
                                        {lesson.title}
                                    </span>
                                    {!isFree && (
                                        <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black">
                                            <Gem size={10} /> VIP
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-auto space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {hasMore && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-xs font-bold text-gray-400 hover:text-cyan-500 flex items-center justify-center gap-1 transition-colors">
                            {isExpanded ? '收起列表' : `查看全部 ${level.lessons.length} 个课时`}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                    <button 
                        onClick={() => onVocabularyClick(level)}
                        className="w-full py-4 bg-gray-900 dark:bg-cyan-950 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all"
                    >
                        <ListTodo size={16} /> HSK {level.level} 生词库
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

/**
 * 拼音区域布局 (4+1)
 */
const PinyinSection = () => {
    const pinyinGrid = pinyinMain.slice(0, 4);
    const pinyinTip = pinyinMain[4];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 px-2">
                <div className="w-2 h-6 bg-amber-500 rounded-full" />
                <h2 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">拼音基础 (Pinyin)</h2>
            </div>

            {/* 一排四个布局 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {pinyinGrid.map((item) => (
                    <Link key={item.id} href={item.href} passHref>
                        <a className="flex flex-col items-center justify-center p-5 rounded-[2rem] bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all group">
                            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <item.icon size={24} className={item.color} />
                            </div>
                            <span className="text-sm font-black text-gray-800 dark:text-gray-100">{item.title}</span>
                            <span className="text-[10px] text-gray-400 font-myanmar mt-1">{item.sub}</span>
                        </a>
                    </Link>
                ))}
            </div>

            {/* 发音技巧单独一行 */}
            <Link href={pinyinTip.href} passHref>
                <a className="flex items-center gap-5 p-5 rounded-[2rem] bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-opacity">
                    <div className="p-3 bg-white/20 rounded-2xl">
                        <pinyinTip.icon size={24} />
                    </div>
                    <div>
                        <span className="block font-black text-lg">{pinyinTip.title}</span>
                        <span className="text-xs opacity-80 font-myanmar">{pinyinTip.sub}</span>
                    </div>
                    <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <ChevronRight size={20} />
                    </div>
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
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] pb-24">
            {/* 顶栏背景装饰 */}
            <div className="h-80 bg-gradient-to-br from-blue-600 to-cyan-500 relative">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                <div className="max-w-6xl mx-auto px-6 pt-16 relative z-10 text-white text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h1 className="text-5xl font-black tracking-tighter mb-4">HSK ACADEMY</h1>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold uppercase tracking-widest">
                            <ShieldCheck size={14} className="text-cyan-300" /> 专业汉语在线学习平台
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* 内容区 */}
            <div className="max-w-6xl mx-auto px-6 -mt-20 relative z-20 space-y-16">
                
                {/* 拼音导航 */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[3rem] p-8 shadow-xl border border-white dark:border-gray-700">
                    <PinyinSection />
                </div>

                {/* HSK 列表 */}
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white">HSK 核心课程</h2>
                            <p className="text-gray-500 text-sm mt-1">从零基础到精通，系统化掌握汉语知识</p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-xs font-black">
                            <Gem size={14} /> 加入会员解锁全站
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

            {/* 生词卡片 (WordCard) */}
            <WordCard 
                isOpen={isCardViewOpen}
                words={activeHskWords || []}
                onClose={() => router.push(router.pathname, undefined, { shallow: true })}
                progressKey={activeLevelTag || 'hsk-vocab'}
            />
        </div>
    );
}
