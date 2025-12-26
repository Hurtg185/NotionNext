import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Mic2, Music4, Layers, BookText, Lightbulb,
  Sparkles, PlayCircle, Gem, MessageCircle,
  Crown, Heart, ChevronRight, Star, BookOpen,
  ChevronDown, ChevronUp, GraduationCap,
  MessageSquareText, Headphones, Volume2, 
  Mic, Send, Copy, X, Loader2, Settings // 新增翻译所需图标
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// 动态导入 WordCard 组件
const WordCard = dynamic(
  () => import('@/components/WordCard'),
  { ssr: false }
);

// ==========================================
// 0. 图标组件 (Messenger)
// ==========================================
const MessengerIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.03 2 11C2 13.66 3.39 16.03 5.61 17.58V21.5C5.61 21.78 5.81 22 6.09 22.04C6.18 22.05 6.27 22.05 6.36 22.02L9.2 21.17C10.09 21.41 11.03 21.54 12 21.54C17.52 21.54 22 17.51 22 12.54C22 7.57 17.52 2 12 2ZM12.98 14.54L10.56 12.07L6.33 14.47C6.18 14.55 5.99 14.53 5.88 14.41C5.76 14.28 5.76 14.09 5.85 13.96L8.85 9.47C8.96 9.3 9.17 9.25 9.35 9.35L11.77 11.82L15.99 9.42C16.14 9.33 16.33 9.36 16.44 9.48C16.56 9.61 16.56 9.8 16.47 9.93L12.98 14.54Z" fill="#0084FF"/>
  </svg>
);

// ==========================================
// 1. 全局配置与数据
// ==========================================

const FB_CHAT_LINK = "https://m.me/61575187883357";
const FAVORITES_STORAGE_KEY = 'framer-pinyin-favorites';

const getLevelPrice = (level) => {
  const prices = { 
    1: "10,000 Ks", 
    2: "15,000 Ks", 
    3: "20,000 Ks",
    'SP': "30,000 Ks" 
  };
  return prices[level] || "Contact Us";
};

// 拼音数据 (双语/缅语)
const pinyinMain = [
  { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'whole', title: '整体', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-500', bg: 'bg-amber-50' },
];

// HSK 课程数据
const hskData = [
  {
    level: 1, 
    title: '入门 (Intro)', 
    description: '掌握最常用词语和基本语法',
    descBurmese: 'အသုံးအများဆုံး စကားလုံးများနှင့် သဒ္ဒါ',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    lessons: [
      { id: 1, title: '第 1 课 你好' }, { id: 2, title: '第 2 课 谢谢你' }, { id: 3, title: '第 3 课 你叫什么名字？' }, { id: 4, title: '第 4 课 她是我的汉语老师' }, { id: 5, title: '第 5 课 她女儿今年二十岁' },
      { id: 6, title: '第 6 课 我会说汉语' }, { id: 7, title: '第 7 课 今天几号？' }, { id: 8, title: '第 8 课 我想喝茶' },
    ]
  },
  {
    level: 2, 
    title: '基础 (Basic)', 
    description: '就熟悉的日常话题进行交流',
    descBurmese: 'နေ့စဉ်သုံး စကားပြောများ',
    imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
    lessons: [
      { id: 1, title: '第 1 课 九月去北京旅游最好' }, { id: 2, title: '第 2 课 我每天六点起床' }, { id: 3, title: '第 3 课 左边那个红色的是我的' },
    ]
  }
];

// 核心生词数据加载
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) { console.warn('HSK1 data missing'); }
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) { console.warn('HSK2 data missing'); }

const checkIsFree = (level, lessonId) => {
  if (level === 1) return lessonId <= 2;
  return lessonId === 1;
};

// ==========================================
// 2. 新增组件: AI 翻译器 (适配 HSK 风格)
// ==========================================
const AITranslator = () => {
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [targetLang, setTargetLang] = useState('my'); // 默认译成缅文
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const recognitionRef = useRef(null);

    // 语音识别初始化
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SR) {
                const recognition = new SR();
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.lang = 'zh-CN'; // 默认听中文
                recognition.onresult = (e) => {
                    const text = Array.from(e.results)
                        .map(result => result[0].transcript)
                        .join('');
                    setInput(text);
                };
                recognition.onend = () => setIsListening(false);
                recognition.onerror = () => setIsListening(false);
                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('Browser not support speech recognition');
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setResults([]);
        
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: input, targetLang })
            });
            const data = await res.json();
            if (data.results) setResults(data.results);
        } catch (e) {
            console.error(e);
            alert('Error');
        } finally {
            setLoading(false);
        }
    };

    const speak = (text, lang) => {
        const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoNeural';
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-10`;
        new Audio(url).play().catch(e => console.error(e));
    };

    return (
        <div className="bg-white rounded-[1.8rem] p-4 shadow-xl shadow-slate-200/60 border border-slate-50 relative overflow-hidden">
            {/* 标题栏 */}
            <div className="flex justify-between items-center mb-3 px-1">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-blue-50 rounded-full text-blue-500">
                      <Sparkles size={14} fill="currentColor" />
                   </div>
                   <span className="text-sm font-black text-slate-700">AI 智能翻译</span>
                </div>
                <div className="flex items-center gap-2">
                    <select 
                        value={targetLang} 
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="bg-slate-50 border-none text-[10px] font-bold text-slate-600 rounded-lg py-1 px-2 focus:ring-1 focus:ring-blue-200 outline-none"
                    >
                        <option value="my">译成缅文 (Myanmar)</option>
                        <option value="zh">译成中文 (Chinese)</option>
                        <option value="en">译成英文 (English)</option>
                    </select>
                </div>
            </div>

            {/* 输入框 */}
            <div className="relative mb-3">
                <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="请输入内容或语音输入..."
                    className="w-full min-h-[70px] bg-slate-50 border-0 rounded-2xl p-3 pr-10 resize-none text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    {input && (
                        <button onClick={() => setInput('')} className="p-1.5 text-slate-300 hover:text-slate-500 bg-white rounded-full shadow-sm">
                            <X size={12} />
                        </button>
                    )}
                    <button 
                        onClick={toggleListening}
                        className={`p-2 rounded-full transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}
                    >
                        <Mic size={16} />
                    </button>
                    <button 
                        onClick={handleSend}
                        disabled={!input || loading}
                        className={`p-2 rounded-full transition-all ${input ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-300'}`}
                    >
                       {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>

            {/* 结果显示 */}
            {results.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {results.map((item, idx) => (
                        <div key={idx} className={`p-3 rounded-2xl border ${item.recommended ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50/50 border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${item.recommended ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {item.label}
                                </span>
                                {item.recommended && <Star size={10} className="text-amber-400 fill-amber-400" />}
                            </div>
                            <p className="text-sm font-bold text-slate-800 leading-relaxed my-1.5">{item.translation}</p>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                                <p className="text-[10px] text-slate-400 truncate max-w-[70%]">↩ {item.back_translation}</p>
                                <div className="flex gap-1">
                                    <button onClick={() => speak(item.translation, targetLang)} className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-blue-500 transition-colors">
                                        <Volume2 size={14} />
                                    </button>
                                    <button onClick={() => navigator.clipboard.writeText(item.translation)} className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-emerald-500 transition-colors">
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ==========================================
// 3. 核心子组件
// ==========================================

// 会员弹窗
const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
  if (!isOpen) return null;
  const price = getLevelPrice(targetLevel);
  const isSpoken = targetLevel === 'SP';

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
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-colors">
           <ChevronRight className="rotate-45" size={20} />
        </button>
        <div className="text-center mt-2">
          <div className="bg-amber-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <Crown className="text-amber-600" size={28} />
          </div>
          <h2 className="text-xl font-black text-slate-800">
            {isSpoken ? "口语特训课程" : `HSK ${targetLevel}`}
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1 mb-5">
            {isSpoken ? "地道场景、谐音助记与 AI 评测" : "完整视频讲解与练习题"}
            <br/>
            <span className="text-xs text-slate-400">(အတန်းစုံလင်စွာ သင်ယူနိုင်ပါသည်)</span>
          </p>
          <div className="bg-slate-50 p-4 rounded-2xl mb-5 border border-slate-100">
            <p className="text-3xl font-black text-amber-500">{price}</p>
          </div>
          <a href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
            className="w-full py-3.5 bg-[#0084FF] text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg hover:bg-blue-600"
          >
            <MessageCircle size={20} fill="currentColor" />
            ဆက်သွယ်ရန် (Contact)
          </a>
        </div>
      </motion.div>
    </div>
  );
};

// 课程卡片组件
const HskCard = ({ level, onVocabularyClick, onShowMembership }) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

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
      whileTap={{ scale: 0.995 }}
      className="flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative z-10"
    >
      <div className="h-36 relative">
        <img src={level.imageUrl} className="w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-5 text-white">
          <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-0.5">{level.title}</p>
          <h2 className="text-2xl font-black">HSK {level.level}</h2>
          <p className="text-[10px] text-slate-200 mt-1">{level.descBurmese}</p>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {(isExpanded ? level.lessons : level.lessons.slice(0, 3)).map(lesson => (
          <div key={lesson.id} onClick={(e) => handleLessonClick(e, lesson)} className="flex items-center p-3 rounded-xl bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors">
            <div className={`p-1.5 rounded-full mr-3 ${checkIsFree(level.level, lesson.id) ? 'bg-cyan-100 text-cyan-600' : 'bg-amber-100 text-amber-600'}`}>
              {checkIsFree(level.level, lesson.id) ? <PlayCircle size={14} fill="currentColor" /> : <Gem size={14} />}
            </div>
            <span className="text-sm font-bold text-slate-700 truncate flex-grow">{lesson.title}</span>
          </div>
        ))}
      </div>

      <div className="px-4 pb-5 pt-1 flex flex-col gap-3">
        {level.lessons.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-2.5 flex items-center justify-center text-xs font-bold text-slate-500 gap-1 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors active:scale-95"
          >
            {isExpanded ? 'See Less' : `View All ${level.lessons.length} Lessons`} 
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVocabularyClick(level);
          }}
          className="relative z-20 w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-50 to-rose-50 text-rose-500 rounded-xl font-black text-xs active:scale-95 transition-all border border-pink-100 hover:shadow-sm"
        >
          <BookOpen size={14} />
          <span>核心生词</span>
          <span className="text-[10px] opacity-70 font-normal ml-1">(ဝေါဟာရများ)</span>
        </button>
      </div>
    </motion.div>
  );
};

// 拼音面板组件 (保持不变)
const PinyinSection = ({ onOpenCollection, onOpenSpokenCollection }) => {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {/* 第一行：4个基础功能 */}
      <div className="grid grid-cols-4 gap-2">
        {pinyinMain.map((item) => (
          <Link key={item.id} href={item.href} passHref>
            <a className={`flex flex-col items-center justify-center py-3 rounded-2xl ${item.bg} active:scale-95 transition-transform`}>
              <div className="mb-1 bg-white p-1.5 rounded-full shadow-sm">
                <item.icon size={16} className={item.color} />
              </div>
              <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">
                {item.title}<br/><span className="text-[8px] opacity-70">{item.sub}</span>
              </span>
            </a>
          </Link>
        ))}
      </div>

      {/* 第二行：发音技巧 (通栏) */}
      <button 
        onClick={() => router.push('/pinyin/tips')}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100/50 active:scale-95 transition-transform group"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white rounded-full text-orange-500 shadow-sm shrink-0">
            <Lightbulb size={16} fill="currentColor" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-black text-slate-700">发音技巧 (Tips)</span>
            <span className="block text-[10px] text-slate-500 font-medium">အသံထွက်နည်းလမ်းများ</span>
          </div>
        </div>
        <ChevronRight size={16} className="text-orange-300" />
      </button>
      
      {/* 第四行：双收藏按钮 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 单词收藏 */}
        <button 
          onClick={onOpenCollection}
          className="flex flex-col items-center justify-center py-3 bg-white border border-blue-100 rounded-2xl shadow-sm active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-1.5 mb-1 text-blue-600">
             <Star size={14} fill="currentColor"/>
             <span className="text-xs font-black">单词收藏</span>
          </div>
          <span className="text-[9px] text-slate-400">မှတ်ထားသော စာလုံး</span>
        </button>

        {/* 口语收藏 */}
        <button 
          onClick={onOpenSpokenCollection}
          className="flex flex-col items-center justify-center py-3 bg-white border border-emerald-100 rounded-2xl shadow-sm active:scale-95 transition-transform"
        >
           <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
             <Volume2 size={14} fill="currentColor"/>
             <span className="text-xs font-black">口语收藏</span>
           </div>
           <span className="text-[9px] text-slate-400">မှတ်ထားသော စကားပြော</span>
        </button>
      </div>
    </div>
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

  // 口语跳转逻辑
  const handleSpokenGeneralClick = useCallback((e) => {
    if(e) e.preventDefault();
    router.push('/spoken');
  }, [router]);

  const handleSpokenCollectionClick = useCallback((e) => {
    if(e) e.preventDefault();
    router.push({ pathname: '/spoken', query: { filter: 'favorites' } });
  }, [router]);

  // 处理生词本点击逻辑
  const handleVocabularyClick = useCallback((level) => {
    const levelNum = level?.level || 1;
    const words = hskWordsData[levelNum] || [];
    setActiveHskWords(words);
    setActiveLevelTag(`hsk${levelNum}`);
    router.push({ pathname: router.pathname, query: { ...router.query, level: levelNum }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
  }, [router]);

  // 处理生词收藏点击
  const handleCollectionClick = useCallback(() => {
    const savedIds = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    const allWords = [ ...(hskWordsData[1] || []), ...(hskWordsData[2] || []) ];
    const favoriteWords = allWords.filter(word => 
      savedIds.some(savedId => String(savedId) === String(word.id))
    );

    if (favoriteWords.length === 0) {
      alert("No saved words yet!\nမှတ်ထားသော စာလုံး မရှိသေးပါ");
      return;
    }

    setActiveHskWords(favoriteWords);
    setActiveLevelTag('my-favorites-collection');
    router.push({ pathname: router.pathname, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-20 relative overflow-x-hidden max-w-md mx-auto shadow-2xl shadow-slate-200">
      
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      <header className="relative pt-4 px-4 pb-1 z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur rounded-full border border-blue-100 shadow-sm">
            <Sparkles size={12} className="text-blue-500" />
            <span className="text-[10px] font-bold text-blue-800 uppercase">Premium Class</span>
          </div>
          
          <a href={FB_CHAT_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-full shadow-sm border border-slate-100 active:scale-95 transition-all"
          >
            <MessengerIcon size={18} />
            <span className="text-xs font-bold text-slate-700">Messenger</span>
          </a>
        </div>

        <div className="bg-white rounded-[1.8rem] p-4 shadow-xl shadow-slate-200/60 border border-slate-50">
          <PinyinSection 
            onOpenCollection={handleCollectionClick} 
            onOpenSpokenCollection={handleSpokenCollectionClick}
          />
        </div>
      </header>

      {/* ================================================== */}
      {/* 🚀 插入点：AI 翻译器 (AITranslator) */}
      {/* ================================================== */}
      <div className="px-4 mt-4">
        <AITranslator />
      </div>
      {/* ================================================== */}

      {/* 口语练习横图入口 */}
      <div className="px-4 mt-4">
        <div 
          onClick={handleSpokenGeneralClick}
          className="block relative h-28 w-full rounded-3xl overflow-hidden shadow-lg shadow-emerald-100 group active:scale-[0.98] transition-all cursor-pointer"
        >
          <img 
            src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            alt="Oral Chinese" 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-emerald-600/40 to-transparent flex flex-col justify-center px-6">
            <div className="flex items-center gap-2 text-emerald-100 mb-1">
              <Headphones size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Oral Practice</span>
            </div>
            <h3 className="text-xl font-black text-white">日常口语练习</h3>
            <p className="text-emerald-50/90 text-xs font-medium font-burmese mt-0.5">နေ့စဉ်သုံး စကားပြော လေ့ကျင့်ခန်း</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white">
            <ChevronRight size={20} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 relative z-10 mt-6 space-y-4">
        <div className="flex items-center gap-2 px-1 opacity-70">
          <BookText size={14} className="text-slate-500" />
          <h2 className="text-xs font-black text-slate-600 uppercase tracking-wider">System Courses (သင်ရိုး)</h2>
        </div>

        <div className="grid grid-cols-1 gap-5 pb-10">
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

      <AnimatePresence>
        {membership.open && (
          <MembershipModal
            isOpen={membership.open}
            onClose={() => setMembership({ open: false, level: null })}
            targetLevel={membership.level}
          />
        )}
      </AnimatePresence>

      <WordCard
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={() => router.push(router.pathname, undefined, { shallow: true })}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </div>
  );
}
