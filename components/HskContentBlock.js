import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    ChevronDown, ChevronUp, Mic2, Music4, BookText,
    ListTodo, Layers, Lightbulb, Sparkles, ChevronRight, PlayCircle,
    Gem, MessageCircle, X, CheckCircle2, Crown, Heart, HelpCircle
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

// 拼音数据 - 移除了 tips，因为 tips 移到了底部栏
const pinyinMain = [
    { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'whole', title: '整体认读', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' }
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
            <div className="h-44 relative overflow-hidden">
                <img src={level.imageUrl} className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-1.5 w-8 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"/>
                        <p className="text-[10px] font-black text-cyan-400 tracking-widest uppercase opacity-90">{level.title}</p>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight drop-shadow-md">HSK {level.level}</h2>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <div className="space-y-3 mb-6 flex-grow">
                    {(isExpanded ? level.lessons : level.lessons.slice(0, 3)).map(lesson => (
                        <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="flex items-center px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm">
                            <PlayCircle size={18} className="text-cyan-500 mr-3 shrink-0" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate flex-grow">{lesson.title}</span>
                            {!checkIsFree(level.level, lesson.id) && <Gem size={14} className="text-amber-500 ml-2" />}
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    {level.lessons.length > 3 && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-[10px] font-black text-slate-400 hover:text-cyan-600 flex items-center justify-center gap-1 uppercase tracking-tighter transition-colors">
                            {isExpanded ? '收起列表' : `查看全部 ${level.lessons.length} 课时`}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const PinyinSection = () => {
    return (
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/20 dark:border-slate-700 shadow-2xl">
            {/* 背景图 + 遮罩 */}
            <img 
                src="https://images.pexels.com/photos/34876269/pexels-photo-34876269.jpeg" 
                className="absolute inset-0 w-full h-full object-cover" 
                alt="bg" 
            />
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl" />

            <div className="relative z-10 p-8">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Sparkles size={20} className="text-amber-500 fill-amber-500" />
                        拼音基础
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-widest border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg">Zero to One</span>
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                    {pinyinMain.map((item) => (
                        <Link key={item.id} href={item.href} passHref>
                            <a className="flex flex-col items-center justify-center py-5 rounded-[2rem] bg-white/50 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/50 active:scale-90 transition-all hover:bg-white hover:shadow-lg group">
                                <div className={`mb-3 p-3 rounded-2xl ${item.bg} group-hover:scale-110 transition-transform`}>
                                    <item.icon size={22} className={item.color} />
                                </div>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{item.title}</span>
                                <span className="text-[8px] font-bold text-slate-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity font-myanmar">{item.sub}</span>
                            </a>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 3. 悬浮客服按钮组件
// ==========================================

const DraggableChatBtn = () => {
    // 简单的拖动约束和样式
    return (
        <motion.div
            drag
            dragMomentum={false}
            whileDrag={{ scale: 1.1, cursor: "grabbing" }}
            dragConstraints={{ left: -100, right: 20, top: -500, bottom: 20 }}
            className="fixed bottom-32 right-4 z-[999] touch-none"
        >
            <a
                href={FB_CHAT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-[0_8px_30px_rgba(59,130,246,0.4)] border-4 border-white/20 backdrop-blur-md relative overflow-hidden group"
                draggable="false" // 防止原生图片拖动干扰
            >
                {/* 脉冲动画 */}
                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-20" />
                
                {/* 图标 */}
                <MessageCircle size={32} className="fill-current relative z-10" />
                
                {/* 在线状态点 */}
                <span className="absolute top-3 right-3 w-3 h-3 bg-green-400 border-2 border-indigo-600 rounded-full z-20"></span>
            </a>
        </motion.div>
    );
};

// ==========================================
// 4. 主页面入口
// ==========================================

export default function HskPageClient() {
    const router = useRouter();
    const [activeHskWords, setActiveHskWords] = useState(null);
    const [activeLevelTag, setActiveLevelTag] = useState(null);
    const [membership, setMembership] = useState({ open: false, level: null });

    const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');

    const handleVocabularyClick = useCallback((level) => {
        const levelNum = level?.level || 1;
        const words = hskWordsData[levelNum] || [];
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${levelNum}`);
        router.push({ pathname: router.pathname, query: { ...router.query, level: levelNum }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
    }, [router]);

    // 默认打开 HSK 1 的生词本
    const openDefaultVocabulary = () => handleVocabularyClick({ level: 1 });

    // 跳转到拼音技巧
    const goToPinyinTips = () => router.push('/pinyin/tips');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] pb-32 relative overflow-x-hidden">
            <style jsx global>{`
                ::-webkit-scrollbar { display: none; }
                body { -ms-overflow-style: none; scrollbar-width: none; background: #f8fafc; }
            `}</style>

            {/* 背景装饰 */}
            <div className="fixed top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-blue-100/30 via-slate-50/50 to-slate-50 pointer-events-none dark:from-blue-900/10 dark:to-[#0a0a0a]" />

            {/* Header: 顶部 Slogan + 拼音入口 */}
            <header className="relative pt-10 pb-24 overflow-visible">
                <div className="relative z-10 text-center px-6 mb-8">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 bg-blue-100/50 dark:bg-blue-900/30 rounded-full border border-blue-200/50 shadow-sm">
                            <Sparkles size={12} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] font-black text-blue-800 dark:text-blue-200 uppercase tracking-wider">Premium Chinese</span>
                        </div>
                        <p className="text-slate-800 dark:text-white text-2xl font-black tracking-tight leading-relaxed drop-shadow-sm">
                            从拼音开始 <span className="text-blue-600 mx-1">·</span> 系统学汉语
                        </p>
                    </motion.div>
                </div>

                {/* 拼音卡片 - 嵌入式悬浮 */}
                <div className="px-4 z-20 relative">
                    <div className="max-w-xl mx-auto transform hover:-translate-y-1 transition-transform duration-500">
                        <PinyinSection />
                    </div>
                </div>
            </header>

            {/* 内容区域 */}
            <div className="max-w-2xl mx-auto px-4 mt-8 relative z-10 space-y-12">
                
                {/* HSK 课程列表 */}
                <div className="space-y-6">
                    <div className="flex items-end justify-between px-2">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">系统课程</h2>
                            <p className="text-slate-400 text-xs font-bold mt-1">HSK 标准教程 · 循序渐进</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-8">
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

            {/* 底部悬浮功能栏 (Floating Action Bar) */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-auto pointer-events-auto">
                <motion.div 
                    initial={{ y: 100, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    className="flex items-center gap-1 p-2 bg-slate-900/85 dark:bg-white/90 backdrop-blur-xl rounded-full shadow-2xl shadow-slate-900/30 border border-white/10 dark:border-slate-200 ring-1 ring-black/5"
                >
                    {/* 生词按钮 */}
                    <button
                        onClick={openDefaultVocabulary}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 rounded-full text-white font-black text-xs active:scale-95 transition-transform shadow-lg shadow-amber-500/20 hover:bg-amber-400"
                    >
                        <Heart size={16} fill="currentColor" />
                        收藏生词
                    </button>

                    {/* 分割线 */}
                    <div className="w-px h-5 bg-white/20 dark:bg-slate-900/10 mx-1" />

                    {/* 拼音技巧按钮 */}
                    <button
                        onClick={goToPinyinTips}
                        className="flex items-center gap-2 px-6 py-3 bg-transparent rounded-full text-white dark:text-slate-900 font-bold text-xs hover:bg-white/10 dark:hover:bg-slate-100/50 transition-colors"
                    >
                        <HelpCircle size={18} className="text-blue-400 dark:text-blue-600" />
                        拼音技巧
                    </button>
                </motion.div>
            </div>

            {/* 可拖动私信按钮 (浮在最上层) */}
            <DraggableChatBtn />

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
