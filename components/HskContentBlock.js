import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    ChevronDown, ChevronUp, Mic2, Music4, BookText,
    ListTodo, Layers, Lightbulb, ChevronRight, PlayCircle,
    Gem, MessageCircle, X, CheckCircle2, CreditCard
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

// 价格配置表 (缅币)
const getLevelPrice = (level) => {
    const prices = {
        1: "10,000 Ks",
        2: "55,000 Ks",
        3: "75,000 Ks",
        4: "95,000 Ks",
        5: "95,000 Ks",
        6: "99,000 Ks"
    };
    return prices[level] || "联系客服";
};

// 拼音数据 - 保留缅文注释
const pinyinMain = [
    { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'whole', title: '整体音', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'tips', title: '发音技巧', sub: 'အသံထွက်နည်းလမ်း', href: '/pinyin/tips', icon: Lightbulb, color: 'text-rose-600', bg: 'bg-rose-50' }
];

// HSK 课程数据 - 恢复全中文，保留原版特色图片
const hskData = [
    {
        level: 1, title: '入门水平', description: '掌握最常用词语和基本语法',
        imageUrl: 'https://images.unsplash.com/photo-1548126049-2e2e92c57802?w=800&q=80', // 熊猫
        lessons: [
            { id: 1, title: '第 1 课 你好' }, { id: 2, title: '第 2 课 谢谢你' }, { id: 3, title: '第 3 课 你叫什么名字？' }, { id: 4, title: '第 4 课 她是我的汉语老师' }, { id: 5, title: '第 5 课 她女儿今年二十岁' }, { id: 6, title: '第 6 课 我会说汉语' }, { id: 7, title: '第 7 课 今天几号？' }, { id: 8, title: '第 8 课 我想喝茶' }, { id: 9, title: '第 9 课 你儿子在哪儿工作？' }, { id: 10, title: '第 10 课 我能坐这儿吗？' }, { id: 11, title: '第 11 课 现在几点？' }, { id: 12, title: '第 12 课 明天天气怎么样？' }, { id: 13, title: '第 13 课 他在学做中国菜呢' }, { id: 14, title: '第 14 课 她买了不少衣服' }, { id: 15, title: '第 15 课 我是坐飞机来的' },
        ]
    },
    {
        level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流',
        imageUrl: 'https://images.unsplash.com/photo-1512413391786-fb9a3d4f35e6?w=800&q=80', // 卷轴/文化
        lessons: [
            { id: 1, title: '第 1 课 九月去北京旅游最好' }, { id: 2, title: '第 2 课 我每天六点起床' }, { id: 3, title: '第 3 课 左边那个红色的是我的' }, { id: 4, title: '第 4 课 这个工作是他帮我介绍的' }, { id: 5, title: '第 5 课 喂，您好' }, { id: 6, title: '第 6 课 我已经找了工作了' }, { id: 7, title: '第 7 课 门开着呢' }, { id: 8, title: '第 8 课 你别忘了带手机' }, { id: 9, title: '第 9 课 他比我大三岁' }, { id: 10, title: '第 10 课 你看过那个电影吗' }, { id: 11, title: '第 11 课 虽然很累，但是很高兴' }, { id: 12, title: '第 12 课 你穿得太少了' }, { id: 13, title: '第 13 课 我是走回来的' }, { id: 14, title: '第 14 课 你把水果拿过来' }, { id: 15, title: '第 15 课 其他的都没问题' },
        ]
    },
    {
        level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际',
        imageUrl: 'https://images.unsplash.com/photo-1541257127-14e3006248c9?w=800&q=80', // 风景
        lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 进阶内容展示` }))
    },
    {
        level: 4, title: '中级水平', description: '流畅地与母语者进行交流',
        imageUrl: 'https://images.unsplash.com/photo-1557002665-c579822a16d8?w=800&q=80', // 书法
        lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 中级内容展示` }))
    },
    {
        level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目',
        imageUrl: 'https://images.unsplash.com/photo-1460501602446-f2893f443b74?w=800&q=80', // 现代中国
        lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课 高级内容展示` }))
    },
    {
        level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点',
        imageUrl: 'https://images.unsplash.com/photo-1496263592395-69b76c117d84?w=800&q=80', // 商务
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

/**
 * 判断课程是否免费
 * HSK 1: 前 3 课免费
 * 其他: 第 1 课免费
 */
const checkIsFree = (level, lessonId) => {
    if (level === 1) return lessonId <= 3;
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
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
                {/* 顶部装饰 */}
                <div className="h-24 bg-gradient-to-br from-amber-400 to-orange-500 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 pb-8 -mt-10 relative">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-lg p-1 mx-auto flex items-center justify-center mb-4">
                        <div className="w-full h-full bg-amber-50 rounded-xl flex items-center justify-center">
                            <Gem size={32} className="text-amber-500" />
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-black text-gray-800">解锁 HSK {targetLevel} 课程</h2>
                        <p className="text-gray-500 text-sm mt-1">加入会员，获取当前等级全部完整课程</p>
                    </div>

                    <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-bold text-gray-600">会员价格</span>
                            <span className="text-xl font-black text-orange-600">{price}</span>
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <CheckCircle2 size={14} className="text-green-500 shrink-0" /> 包含本等级所有视频、听力课程
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <CheckCircle2 size={14} className="text-green-500 shrink-0" /> 终身永久访问权限
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <CheckCircle2 size={14} className="text-green-500 shrink-0" /> 同步解锁生词库收藏功能
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <a 
                            href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
                            className="w-full py-3.5 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                            <MessageCircle size={18} />
                            <span>Facebook 私信老师购买</span>
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
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col h-full bg-white rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-300"
        >
            {/* 卡片封面 */}
            <div className="h-40 relative overflow-hidden group">
                <img 
                    src={level.imageUrl} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    alt={`HSK ${level.level}`} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-6 text-white">
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-3xl font-black">HSK {level.level}</h2>
                        <span className="text-sm font-bold opacity-90 text-amber-300">{level.title}</span>
                    </div>
                    <p className="text-xs font-medium text-white/80">{level.description}</p>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                {/* 课程列表 */}
                <div className="space-y-2.5 mb-6 flex-grow">
                    {visibleLessons.map(lesson => {
                        const isFree = checkIsFree(level.level, lesson.id);
                        return (
                            <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="cursor-pointer">
                                <div className="flex items-center px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-blue-50/50 border border-gray-100 hover:border-blue-100 transition-colors group">
                                    <div className={`mr-3 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isFree ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                        <PlayCircle size={16} fill={isFree ? "currentColor" : "none"} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 truncate flex-grow">
                                        {lesson.title}
                                    </span>
                                    {!isFree && (
                                        <div className="ml-2 px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-md text-[10px] font-bold flex items-center gap-1">
                                            <Gem size={10} /> VIP
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 底部按钮区 */}
                <div className="mt-auto space-y-3">
                    {hasMore && (
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            className="w-full py-2 text-xs font-bold text-gray-400 hover:text-blue-500 flex items-center justify-center gap-1 transition-colors"
                        >
                            {isExpanded ? '收起列表' : `查看全部 ${level.lessons.length} 个课时`}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                    
                    {/* 生词库按钮 - 亮色风格 - 保留缅文提示 */}
                    <button 
                        onClick={() => onVocabularyClick(level)}
                        className="w-full py-3.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-100 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <ListTodo size={18} className="text-cyan-600" /> 
                        <span>HSK {level.level} 生词库</span>
                        <span className="font-myanmar text-xs opacity-70">(ဝေါဟာရများ)</span>
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
        <div>
            <div className="flex items-center gap-3 mb-6 px-1">
                <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                <div>
                    <h2 className="text-lg font-black text-gray-800">拼音基础</h2>
                    <p className="text-[10px] text-gray-400 font-myanmar">တရုတ်စာ အသံထွက် အခြေခံ</p>
                </div>
            </div>

            {/* 一排四个布局 */}
            <div className="grid grid-cols-4 gap-3">
                {pinyinGrid.map((item) => (
                    <Link key={item.id} href={item.href} passHref>
                        <a className="flex flex-col items-center justify-center py-4 px-2 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all">
                            <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center mb-2`}>
                                <item.icon size={20} className={item.color} />
                            </div>
                            <span className="text-xs font-bold text-gray-700">{item.title}</span>
                            <span className="text-[9px] text-gray-400 font-myanmar mt-0.5 text-center leading-tight">{item.sub}</span>
                        </a>
                    </Link>
                ))}
            </div>

            {/* 发音技巧单独一行 - 增加间距 mt-6 */}
            <div className="mt-6">
                <Link href={pinyinTip.href} passHref>
                    <a className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-rose-200 hover:opacity-95 transition-all">
                        <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                            <pinyinTip.icon size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-base">{pinyinTip.title}</span>
                            <span className="text-xs text-white/90 font-myanmar">{pinyinTip.sub}</span>
                        </div>
                        <div className="ml-auto opacity-80">
                            <ChevronRight size={20} />
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

    const handleShowMembership = (level) => setMembership({ open: true, level });
    const handleCloseMembership = () => setMembership({ open: false, level: null });

    const handleVocabularyClick = useCallback((level) => {
        const words = hskWordsData[level.level] || [];
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${level.level}`);
        router.push({ pathname: router.pathname, query: { ...router.query, level: level.level }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
    }, [router]);

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans">
            {/* 顶栏背景装饰 - 更换为中国风红墙金瓦背景图 */}
            <div className="h-72 w-full relative">
                <div className="absolute inset-0">
                    <img 
                        src="https://images.unsplash.com/photo-1515165592879-1d49866334d0?w=1200&q=80" 
                        className="w-full h-full object-cover object-top"
                        alt="Background"
                    />
                    {/* 红色渐变蒙层，确保文字清晰 */}
                    <div className="absolute inset-0 bg-gradient-to-b from-red-900/60 via-red-800/30 to-[#f8fafc]" />
                </div>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 text-white z-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <h1 className="text-4xl font-black tracking-tight drop-shadow-md mb-2">HSK ACADEMY</h1>
                        <p className="text-white/90 font-medium tracking-wider bg-black/10 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block border border-white/20">
                            专业汉语在线学习平台
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* 内容区 */}
            <div className="max-w-5xl mx-auto px-5 -mt-24 relative z-20 space-y-10">
                
                {/* 拼音导航 - 白色玻璃拟态 */}
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-6 shadow-xl shadow-gray-200/50 border border-white">
                    <PinyinSection />
                </div>

                {/* HSK 列表标题 */}
                <div className="space-y-6">
                    <div className="flex flex-col gap-1 px-2">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black text-gray-800">课程列表</h2>
                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-[10px] font-bold border border-amber-100">
                                <Gem size={12} /> VIP Member
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs">从零基础到精通，系统化掌握汉语知识</p>
                    </div>
                    
                    {/* 响应式网格 */}
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
