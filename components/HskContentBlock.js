import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  ChevronDown, ChevronUp, Mic2, Music4, BookText, 
  ListTodo, Layers, Lightbulb, Sparkles 
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

// --- 拼音数据 (视觉调整：去除背景块配置，改用图标颜色) ---

// 第一排：2个
const pinyinRow1 = [
  { 
    id: 'initials',
    title: 'ဗျည်း', // 声母
    href: '/pinyin/initials', 
    icon: Mic2, 
    // 整个卡片的背景（极淡）
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    // 边框
    borderColor: 'border-blue-100 dark:border-blue-800',
    // 图标本身的颜色
    iconColor: 'text-blue-500', 
    // 文字颜色
    textColor: 'text-blue-900 dark:text-blue-100'
  },
  { 
    id: 'finals',
    title: 'သရ', // 韵母
    href: '/pinyin/finals', 
    icon: Music4, 
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    borderColor: 'border-emerald-100 dark:border-emerald-800',
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-900 dark:text-emerald-100'
  }
];

// 第二排：3个
const pinyinRow2 = [
  { 
    id: 'tones',
    title: 'အသံ', // 声调
    href: '/pinyin/tones', 
    icon: BookText, 
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    borderColor: 'border-amber-100 dark:border-amber-800',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-900 dark:text-amber-100'
  },
  { 
    id: 'whole',
    title: 'အသံတွဲ', // 整体认读
    href: '/pinyin/whole', 
    icon: Layers, 
    bg: 'bg-purple-50 dark:bg-purple-900/10',
    borderColor: 'border-purple-100 dark:border-purple-800',
    iconColor: 'text-purple-500',
    textColor: 'text-purple-900 dark:text-purple-100'
  },
  { 
    id: 'tips',
    title: 'နည်းလမ်း', // 技巧
    href: '/pinyin/tips', 
    icon: Lightbulb, 
    bg: 'bg-rose-50 dark:bg-rose-900/10',
    borderColor: 'border-rose-100 dark:border-rose-800',
    iconColor: 'text-rose-500',
    textColor: 'text-rose-900 dark:text-rose-100'
  }
];

// --- HSK 词汇数据加载 ---
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) {}
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) {}
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) {}
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) {}
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) {}
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) {}

// --- HSK 课程列表数据 (包含完整的 HSK 4) ---
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
// 2. 子组件定义
// ==========================================

const HskCard = ({ level, onVocabularyClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 3;
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

  // 渲染单个拼音模块的辅助函数 - 方形磁贴风格
  const renderCard = (module) => (
    <Link key={module.id} href={module.href} passHref>
        <motion.a
            variants={itemVariants}
            whileTap={{ scale: 0.95 }}
            className={`
                aspect-square 
                flex flex-col items-center justify-center 
                rounded-[24px] border ${module.borderColor} ${module.bg} 
                shadow-sm hover:shadow-md transition-all duration-300
                group relative overflow-hidden
            `}
        >
            {/* 图标 - 无背景框，直接染色，加大尺寸 */}
            <module.icon className={`${module.iconColor} mb-3 group-hover:scale-110 transition-transform duration-300`} size={36} />
            
            {/* 缅甸语标题 - 加粗 */}
            <h3 className={`font-bold text-base ${module.textColor} tracking-wide text-center leading-tight px-1`}>
                {module.title}
            </h3>
        </motion.a>
    </Link>
  );

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-500" />
                拼音基础
            </h2>
            <div className="h-px flex-grow bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700"></div>
       </div>
       
       <motion.div 
         variants={containerVariants}
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, amount: 0.2 }}
         className="space-y-4"
       >
         {/* 第一排：2个 (方形) */}
         <div className="grid grid-cols-2 gap-4">
            {pinyinRow1.map(renderCard)}
         </div>

         {/* 第二排：3个 (方形) */}
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

  useEffect(() => {
    if (!router.isReady || !router.asPath.includes('#hsk-vocabulary')) return;
    if (activeHskWords && activeHskWords.length > 0) return;

    const { level } = router.query;
    if (!level) return;

    const levelNum = parseInt(level, 10);
    const words = hskWordsData[levelNum];

    if (words && words.length > 0) {
        setActiveHskWords(words);
        setActiveLevelTag(`hsk${levelNum}`);
    }
  }, [router.isReady, router.asPath, router.query, activeHskWords]);

  const handleVocabularyClick = useCallback((level) => {
    const words = hskWordsData[level.level];
    if (!words || words.length === 0) {
      alert(`HSK ${level.level} 的词汇数据暂未加载，请检查 data 目录。`);
      return;
    }
    setActiveHskWords(words);
    setActiveLevelTag(`hsk${level.level}`);
    
    router.push({
        pathname: router.pathname,
        query: { ...router.query, level: level.level },
        hash: 'hsk-vocabulary'
    }, undefined, { shallow: true });
  }, [router]);

  const handleCloseCard = useCallback(() => {
    setActiveHskWords(null);
    setActiveLevelTag(null);
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
          <div className="absolute inset-0 bg-white/95 dark:bg-black/90 backdrop-blur-sm z-0"></div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 py-10 space-y-10">
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
        
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/50 dark:border-gray-700/50">
                  <PinyinSection />
              </div>

              <div className="space-y-6">
                  <div className="flex items-center gap-3 pl-1">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">HSK 等级课程</h2>
                  </div>
                  
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
