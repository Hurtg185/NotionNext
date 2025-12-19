import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    Mic2, Music4, Layers, BookText, Lightbulb, 
    Sparkles, PlayCircle, Gem, MessageCircle, 
    Crown, Heart, ChevronRight, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// 动态导入 WordCard 组件 (生词本核心组件)
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

// 核心生词数据加载逻辑
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { console.warn('HSK1 data missing'); }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { console.warn('HSK2 data missing'); }

const checkIsFree = (level, lessonId) => {
    if (level === 1) return lessonId <= 5; 
    return lessonId === 1;
};

// ==========================================
// 2. 核心子组件
// ==========================================

// 悬浮 Messenger 按钮 (官方蓝紫渐变风格)
const FloatingMessenger = () => {
    const constraintsRef = useRef(null);

    return (
        <>
            <div ref={constraintsRef} className="fixed inset-y-0 right-0 w-24 z-[90] pointer-events-none" />
            
            <motion.div
                drag
                dragConstraints={constraintsRef}
                dragMomentum={false}
                dragElastic={0.1}
                whileDrag={{ scale: 1.1 }}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="fixed right-4 top-[70%] z-[100] cursor-pointer touch-none"
            >
                <a 
                    href={FB_CHAT_LINK} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center"
                >
                    <div className="relative group">
                        {/* 动态光晕 */}
                        <div className="absolute inset-0 bg-purple-500 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity animate-pulse"></div>
                        
                        {/* 按钮主体 - 蓝紫粉渐变 */}
                        <div className="relative w-14 h-14 bg-gradient-to-tr from-[#00C6FF] via-[#0078FF] to-[#A334FA] rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20 overflow-hidden">
                            <MessageCircle size={30} className="text-white fill-current relative z-10" />
                            {/* 内部高光装饰 */}
                            <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 blur-md rounded-full -mr-2 -mt-2"></div>
                        </div>

                        {/* 红色通知点 */}
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 z-20">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                        </span>
                    </div>
                </a>
            </motion.div>
        </>
    );
};

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
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400"><MessageCircle className="rotate-45" size={20}/></button>
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
            whileTap={{ scale: 0.99 }}
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
                {/* 收藏生词入口按钮 */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onVocabularyClick(level); }}
                    className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 text-white p-2.5 rounded-full active:bg-white/40 transition-colors"
                >
                    <Heart size={20} fill="currentColor" />
                </button>
            </div>

            <div className="p-4 space-y-2">
                {level.lessons.slice(0, 3).map(lesson => (
                    <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="flex items-center p-3 rounded-xl bg-slate-50 active:bg-slate-100 cursor-pointer">
                        <div className={`p-1.5 rounded-full mr-3 ${checkIsFree(level.level, lesson.id) ? 'bg-cyan-100 text-cyan-600' : 'bg-amber-100 text-amber-600'}`}>
                            {checkIsFree(level.level, lesson.id) ? <PlayCircle size={14} fill="currentColor" /> : <Gem size={14} />}
                        </div>
                        <span className="text-sm font-bold text-slate-700 truncate flex-grow">{lesson.title}</span>
                    </div>
                ))}
            </div>
            
            <div className="px-4 pb-3">
                <div className="w-full py-2 flex items-center justify-center text-xs font-bold text-slate-400 gap-1 bg-slate-50/50 rounded-lg">
                    全部课程 <ChevronRight size={12} />
                </div>
            </div>
        </motion.div>
    );
};

// 拼音面板组件
const PinyinSection = ({ onOpenFavorites }) => {
    return (
        <div className="space-y-3">
            {/* 拼音 4 格 - 紧凑型 */}
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

            {/* 功能入口 (收藏生词 + 技巧) */}
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={onOpenFavorites}
                    className="flex items-center gap-2 p-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl border border-pink-100/50 active:scale-95 transition-transform"
                >
                    <div className="p-1.5 bg-white rounded-full text-rose-500 shadow-sm"><Heart size={14} fill="currentColor" /></div>
                    <div className="text-left leading-tight">
                        <span className="block text-xs font-black text-slate-700">收藏生词</span>
                        <span className="block text-[9px] text-slate-400 font-myanmar">မှတ်စု</span>
                    </div>
                </button>

                <Link href="/pinyin/tips" passHref>
                    <a className="flex items-center gap-2 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100/50 active:scale-95 transition-transform">
                        <div className="p-1.5 bg-white rounded-full text-orange-500 shadow-sm"><Lightbulb size={14} fill="currentColor" /></div>
                        <div className="text-left leading-tight">
                            <span className="block text-xs font-black text-slate-700">发音技巧</span>
                            <span className="block text-[9px] text-slate-400 font-myanmar">နည်းလမ်း</span>
                        </div>
                    </a>
                </Link>
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
        // 确保路由跳转带上 hash 以触发弹窗
        router.push({ 
            pathname: router.pathname, 
            query: { ...router.query, level: levelNum }, 
            hash: 'hsk-vocabulary' 
        }, undefined, { shallow: true });
    }, [router]);

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-20 relative overflow-x-hidden">
            {/* 1. 顶部极淡背景装饰 */}
            <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

            {/* 2. 底部水墨山水背景 (替换黑色) */}
            <div 
                className="fixed bottom-0 left-0 right-0 h-80 z-0 pointer-events-none opacity-10"
                style={{
                    backgroundImage: `url('https://img.freepik.com/free-vector/chinese-style-ink-landscape-background_52683-39296.jpg')`, // 示例背景链接
                    backgroundSize: 'cover',
                    backgroundPosition: 'bottom center',
                    maskImage: 'linear-gradient(to top, black, transparent)'
                }}
            />

            {/* Header 区域：去除 Slogan，仅保留 Logo 和 拼音面板 */}
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

                {/* 拼音面板 (背景全白，阴影柔和) */}
                <div className="bg-white rounded-[1.8rem] p-4 shadow-xl shadow-slate-200/60 border border-slate-50">
                    <PinyinSection onOpenFavorites={() => handleVocabularyClick({ level: 1 })} />
                </div>
            </header>

            {/* 系统课程列表 - 紧贴上方 (mt-2 极小间距) */}
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

            {/* 悬浮 Messenger 按钮 (渐变色) */}
            <FloatingMessenger />

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

            {/* 生词卡片播放器 (保留所有功能) */}
            <WordCard 
                isOpen={isCardViewOpen}
                words={activeHskWords || []}
                onClose={() => router.push(router.pathname, undefined, { shallow: true })}
                progressKey={activeLevelTag || 'hsk-vocab'}
            />
        </div>
    );
}
