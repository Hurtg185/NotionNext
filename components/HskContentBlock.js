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

// --- 拼音模块数据 (分离声调表) ---
const pinyinTopModules = [
  { 
    id: 'initials',
    title: '声母表 (Initials)', 
    description: 'b, p, m, f 等辅音',
    href: '/pinyin/initials', 
    icon: Mic2, 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'finals',
    title: '韵母表 (Finals)', 
    description: 'a, o, e, i 等元音',
    href: '/pinyin/finals', 
    icon: Music4, 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    gradient: 'from-emerald-500 to-teal-500'
  },
  { 
    id: 'whole',
    title: '整体认读 (Whole)', 
    description: 'zi, ci, si 等整体音节',
    href: '/pinyin/whole', 
    icon: Layers, 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    gradient: 'from-purple-500 to-violet-500'
  },
];

const toneModule = { 
    id: 'tones',
    title: '声调表 (Tones)', 
    description: '掌握汉语的四个声调，精准表达字义 (mā, má, mǎ, mà)',
    href: '/pinyin/tones', 
    icon: BookText, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-500 to-orange-500'
};

// --- HSK 词汇数据加载 ---
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { console.warn("HSK 1 words not found."); }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { console.warn("HSK 2 words not found."); }
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) { console.warn("HSK 3 words not found."); }
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) { console.warn("HSK 4 words not found."); }
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) { console.warn("HSK 5 words not found."); }
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) { console.warn("HSK 6 words not found."); }

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
    { 
        level: 4, 
        title: '中级水平', 
        description: '流畅地与母语者进行交流', 
        imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 简单的爱情' },
            { id: 2, title: '第 2 课 真正的朋友' },
            { id: 3, title: '第 3 课 经理对我印象不错' },
            { id: 4, title: '第 4 课 不要太着急赚钱' },
            { id: 5, title: '第 5 课 只买对的，不买贵的' },
            { id: 6, title: '第 6 课 一分钱一分货' },
            { id: 7, title: '第 7 课 最好的医生是自己' },
            { id: 8, title: '第 8 课 话说得越高，摔得越重' },
            { id: 9, title: '第 9 课 阳光总在风雨后' },
            { id: 10, title: '第 10 课 幸福的标准' },
            { id: 11, title: '第 11 课 阅读是种享受' },
            { id: 12, title: '第 12 课 用心发现世界' },
            { id: 13, title: '第 13 课 喝着茶看京剧' },
            { id: 14, title: '第 14 课 保护地球母亲' },
            { id: 15, title: '第 15 课 教育孩子的“学问”' },
            { id: 16, title: '第 16 课 生活可以更美好' },
            { id: 17, title: '第 17 课 人与自然' },
            { id: 18, title: '第 18 课 科技与世界' },
            { id: 19, title: '第 19 课 生活的味道' },
            { id: 20, title: '第 20 课 路上的风景' },
        ]
    },
    { 
        level: 5, 
        title: '高级水平', 
        description: '阅读报刊杂志，欣赏影视节目', 
        imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 爱的细节' }, { id: 2, title: '第 2 课 父母的“唠叨”' }, { id: 3, title: '第 3 课 丈量“幸福”' },
            { id: 4, title: '第 4 课 “朝三暮四”的“猴子”' }, { id: 5, title: '第 5 课 “差不多”先生' }, { id: 6, title: '第 6 课 一张照片' },
            { id: 7, title: '第 7 课 “另类”的母亲' }, { id: 8, title: '第 8 课 “漫画”的启示' }, { id: 9, title: '第 9 课 友谊的“保鲜期”' },
            { id: 10, title: '第 10 课 成长的“痕迹”' }, { id: 11, title: '第 11 课 “跨界”的魅力' }, { id: 12, title: '第 12 课 “一见钟情”的背后' },
            { id: 13, title: '第 13 课 “慢”的智慧' }, { id: 14, title: '第 14 课 “英雄”的定义' }, { id: 15, title: '第 15 课 “距离”的学问' },
            { id: 16, title: '第 16 课 生活中的“发现”' }, { id: 17, title: '第 17 课 “真实”的价值' }, { id: 18, title: '第 18 课 “压力”是“动力”' },
            { id: 19, title: '第 19 课 “明星”的烦恼' }, { id: 20, title: '第 20 课 汉字“三美”' }, { id: 21, title: '第 21 课 京剧的“脸谱”' },
            { id: 22, title: '第 22 课 “环保”从我做起' }, { id: 23, title: '第 23 课 “克隆”的争议' }, { id: 24, title: '第 24 课 “网络”改变生活' },
            { id: 25, title: '第 25 课 “火锅”里的文化' }, { id: 26, title: '第 26 课 “丝绸之路”的今昔' }, { id: 27, title: '第 27 课 “功夫”的魅力' },
            { id: 28, title: '第 28 课 “中医”的智慧' }, { id: 29, title: '第 29 课 “城市”让生活更美好？' }, { id: 30, title: '第 30 课 “乡村”的变迁' },
            { id: 31, title: '第 31 课 “广告”的陷阱' }, { id: 32, title: '第 32 课 “消费”的观念' }, { id: 33, title: '第 33 课 “创新”的力量' },
            { id: 34, title: '第 34 课 “竞争”与“合作”' }, { id: 35, title: '第 35 课 “全球化”的挑战' }, { id: 36, title: '第 36 课 “未来”的展望' },
        ]
    },
    { 
        level: 6, 
        title: '流利水平', 
        description: '轻松理解信息，流利表达观点', 
        imageUrl: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=800&q=80', 
        lessons: [
            { id: 1, title: '第 1 课 创新的“智慧”' }, { id: 2, title: '第 2 课 走进“杂交水稻之父”袁隆平' }, { id: 3, title: '第 3 课 “诺贝尔奖”的背后' },
            { id: 4, title: '第 4 课 “奥运”精神' }, { id: 5, title: '第 5 课 “世界杯”的激情' }, { id: 6, title: '第 6 课 “电子商务”的革命' },
            { id: 7, title: '第 7 课 “人工智能”的未来' }, { id: 8, title: '第 8 课 “大数据”时代' }, { id: 9, title: '第 9 课 “共享经济”的浪潮' },
            { id: 10, title: '第 10 课 “移动支付”的便捷' }, { id: 11, title: '第 11 课 “高铁”的速度' }, { id: 12, title: '第 12 课 “航天”的梦想' },
            { id: 13, title: '第 13 课 “孔子”的智慧' }, { id: 14, title: '第 14 课 “老子”的道' }, { id: 15, title: '第 15 课 “孙子兵法”的谋略' },
            { id: 16, title: '第 16 课 “唐诗”的韵味' }, { id: 17, title: '第 17 课 “宋词”的婉约' }, { id: 18, title: '第 18 课 “元曲”的豪放' },
            { id: 19, title: '第 19 课 “红楼梦”的悲欢' }, { id: 20, title: '第 20 课 “西游记”的奇幻' }, { id: 21, title: '第 21 课 “三国演义”的英雄' },
            { id: 22, title: '第 22 课 “水浒传”的江湖' }, { id: 23, title: '第 23 课 “故宫”的雄伟' }, { id: 24, title: '第 24 课 “长城”的壮丽' },
            { id: 25, title: '第 25 课 “兵马俑”的震撼' }, { id: 26, title: '第 26 课 “敦煌”的瑰宝' }, { id: 27, title: '第 27 课 “茶”的文化' },
            { id: 28, title: '第 28 课 “酒”的故事' }, { id: 29, title: '第 29 课 “筷子”的哲学' }, { id: 30, title: '第 30 课 “春节”的习俗' },
            { id: 31, title: '第 31 课 “中秋”的团圆' }, { id: 32, title: '第 32 课 “端午”的纪念' }, { id: 33, title: '第 33 课 “清明”的追思' },
            { id: 34, title: '第 34 课 “家庭”的变迁' }, { id: 35, title: '第 35 课 “教育”的改革' }, { id: 36, title: '第 36 课 “健康”的追求' },
            { id: 37, title: '第 37 课 “旅游”的意义' }, { id: 38, title: '第 38 课 “时尚”的潮流' }, { id: 39, title: '第 39 课 “幸福”的感悟' },
            { id: 40, title: '第 40 课 “梦想”的力量' },
        ]
    },
];

// ==========================================
// 2. 子组件定义 (Sub Components)
// ==========================================

const HskCard = ({ level, onVocabularyClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 5;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    return (
        <motion.div
            variants={cardVariants}
            className="flex flex-col h-full relative rounded-[2rem] shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-cyan-900/10 transition-all duration-500 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
        >
            {/* 背景图片区域 - 加高 */}
            <div className="h-60 relative overflow-hidden shrink-0">
                <img 
                  src={level.imageUrl} 
                  alt={level.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
                <div className="absolute bottom-5 left-8 z-20 text-white">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Level {level.level}</span>
                    </div>
                    <h2 className="font-extrabold text-4xl tracking-tight mb-1">HSK {level.level}</h2>
                    <p className="font-medium text-lg text-white/90">{level.title}</p>
                </div>
            </div>
            
            <div className="p-8 flex flex-col flex-grow relative z-20">
                <p className="text-base text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 leading-relaxed">{level.description}</p>
                
                <div className="space-y-2.5 mb-8 flex-grow">
                    {visibleLessons.map(lesson => (
                        <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                            <a className="block px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-gray-700 dark:text-gray-200 transition-all duration-200 text-[15px] font-medium truncate flex items-center group/item border border-transparent hover:border-cyan-100 dark:hover:border-cyan-800">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 mr-3 group-hover/item:scale-125 transition-transform" />
                                {lesson.title}
                            </a>
                        </Link>
                    ))}
                </div>
                
                <div className="mt-auto space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {hasMore && (
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            className="w-full text-sm py-2 text-gray-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors flex items-center justify-center gap-1 font-semibold group/btn"
                        >
                            {isExpanded ? '收起列表' : `查看全部 ${level.lessons.length} 门课程`}
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} className="group-hover/btn:translate-y-0.5 transition-transform"/>}
                        </button>
                    )}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            onVocabularyClick(level);
                        }} 
                        className="w-full text-center py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all shadow-lg hover:shadow-cyan-500/30 flex items-center justify-center gap-2 font-bold text-base tracking-wide"
                    >
                        <ListTodo size={20} />
                        全屏背单词模式
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const PinyinSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">拼音学习</h2>
                <span className="text-xs font-bold px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full uppercase shadow-sm">Foundation</span>
            </div>
            
            {/* 拼音技巧按钮 */}
            <Link href="/pinyin/tips" passHref>
                <a className="hidden sm:flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors group">
                    <Lightbulb size={18} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                    发音技巧与秘籍
                    <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </a>
            </Link>
       </div>
       
       <motion.div 
         variants={containerVariants}
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, amount: 0.2 }}
         className="space-y-6"
       >
         {/* 第一排：3个基础模块 */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pinyinTopModules.map((module) => (
            <Link key={module.title} href={module.href} passHref>
                <motion.a
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                className={`block p-6 rounded-2xl border ${module.borderColor} ${module.bg} cursor-pointer transition-shadow hover:shadow-xl hover:shadow-gray-200 dark:hover:shadow-black/30 relative overflow-hidden group h-full`}
                >
                <div className="flex flex-col items-center text-center z-10 relative h-full">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${module.gradient} text-white shadow-lg mb-4 transform group-hover:rotate-6 transition-transform duration-300`}>
                    <module.icon size={28} />
                    </div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">
                    {module.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 px-1 leading-relaxed">
                    {module.description}
                    </p>
                </div>
                </motion.a>
            </Link>
            ))}
         </div>

         {/* 第二排：声调表 (加强版) + 移动端显示的技巧按钮 */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 声调表占据前两格 (或全宽，取决于设计，这里设为占据 2/3 或全宽更合适，为了对齐我们让它占满) */}
             <div className="md:col-span-3">
                 <Link href={toneModule.href} passHref>
                    <motion.a
                        variants={itemVariants}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`flex flex-col md:flex-row items-center md:items-start p-6 rounded-2xl border ${toneModule.borderColor} ${toneModule.bg} cursor-pointer transition-all hover:shadow-lg group relative overflow-hidden`}
                    >
                         <div className={`shrink-0 p-4 rounded-2xl bg-gradient-to-br ${toneModule.gradient} text-white shadow-lg mb-4 md:mb-0 md:mr-6`}>
                             <toneModule.icon size={32} />
                         </div>
                         <div className="text-center md:text-left flex-grow">
                             <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 mb-2 flex items-center justify-center md:justify-start gap-2">
                                 {toneModule.title}
                                 <span className="hidden md:inline-block px-2 py-0.5 rounded text-xs bg-white/50 dark:bg-black/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">Core</span>
                             </h3>
                             <p className="text-gray-600 dark:text-gray-300 mb-3">{toneModule.description}</p>
                             
                             {/* 声调可视化小条 */}
                             <div className="flex justify-center md:justify-start gap-4 text-center mt-2">
                                 {['mā', 'má', 'mǎ', 'mà'].map((t, i) => (
                                     <div key={i} className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm border border-amber-100 dark:border-amber-900/50">
                                         <span className="text-lg font-serif font-bold text-gray-800 dark:text-gray-100">{t}</span>
                                     </div>
                                 ))}
                             </div>
                         </div>
                         <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                             <div className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-md text-amber-500">
                                 <ArrowRight size={20} />
                             </div>
                         </div>
                    </motion.a>
                 </Link>
             </div>

             {/* 移动端显示的技巧按钮 (在桌面端隐藏，因为上面已经有了) */}
             <div className="md:hidden">
                 <Link href="/pinyin/tips" passHref>
                     <motion.a 
                        variants={itemVariants}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl cursor-pointer"
                     >
                         <div className="flex items-center gap-3">
                             <div className="bg-yellow-100 dark:bg-yellow-900/50 p-2 rounded-lg text-yellow-600 dark:text-yellow-400">
                                 <Lightbulb size={20} />
                             </div>
                             <span className="font-bold text-gray-800 dark:text-gray-200">发音技巧与秘籍</span>
                         </div>
                         <ArrowRight size={18} className="text-gray-400" />
                     </motion.a>
                 </Link>
             </div>
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

  const handleVocabularyClick = useCallback((level) => {
    const words = hskWordsData[level.level];
    if (words && words.length > 0) {
      setActiveHskWords(words);
      setActiveLevelTag(`hsk${level.level}`);
      router.push(router.pathname + '#hsk-vocabulary', undefined, { shallow: true });
    } else {
      alert(`HSK ${level.level} 的词汇列表正在准备中，敬请期待！`);
    }
  }, [router]);

  const handleCloseCard = useCallback(() => {
    setActiveHskWords(null);
    setActiveLevelTag(null);
    if (window.location.hash.includes('#hsk-vocabulary')) {
        router.back(); 
    }
  }, [router]);

  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash.includes('hsk-vocabulary')) {
        setActiveHskWords(null);
        setActiveLevelTag(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  
  return (
    <>
      <div 
          className="relative min-h-screen bg-gray-50 dark:bg-gray-900"
          style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1516541196182-6bdb0516ed27?auto=format&fit=crop&q=80&w=2000)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed'
          }}
      >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-950/90 backdrop-blur-sm z-0"></div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-16">
              
              {/* 1. 页面头部 */}
              <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  className="text-center space-y-6"
              >
                  <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 dark:from-blue-400 dark:via-cyan-300 dark:to-teal-200 tracking-tight pb-2">
                    汉语学习中心
                  </h1>
                  <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-light leading-relaxed">
                    从拼音基础到 HSK 高级课程<br className="sm:hidden"/>开启你的中文进阶之旅
                  </p>
              </motion.div>
        
              {/* 2. 拼音部分 */}
              <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-blue-900/5 border border-white/50 dark:border-gray-700/50">
                  <PinyinSection />
              </div>

              {/* 3. HSK 等级部分 */}
              <div className="space-y-10">
                  <div className="flex items-center gap-4 pl-2">
                        <div className="h-8 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">HSK 等级课程</h2>
                  </div>
                  
                  {/* HSK Grid - 改为 2 列布局，卡片更大 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
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

      {/* 4. 全屏背单词组件 */}
      <WordCard 
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={handleCloseCard}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </>
  );
};
