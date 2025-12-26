import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Mic2, Music4, Layers, BookText, Lightbulb,
  Sparkles, PlayCircle, Gem, MessageCircle,
  Crown, Heart, ChevronRight, Star, BookOpen,
  ChevronDown, ChevronUp, GraduationCap,
  MessageSquareText, Headphones, Volume2, 
  Mic, Send, Copy, X, Loader2, Settings,
  Lock, KeyRound, BrainCircuit, Globe, Zap, ShieldCheck, ShieldAlert, ExternalLink
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
const CORRECT_ACCESS_CODE = "fanyi"; // 🔐 密码设置

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
// 2. 组件: 全屏 AI 翻译器 (Pro - 整合版)
// ==========================================

const FullScreenTranslator = ({ isOpen, onClose }) => {
    // 状态管理
    const [isVerified, setIsVerified] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    
    // 翻译相关状态
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [quickReplies, setQuickReplies] = useState([]); // 快捷回复
    
    // 设置状态
    const [sourceLang, setSourceLang] = useState('auto'); // 源语言
    const [targetLang, setTargetLang] = useState('my');   // 目标语言
    const [customApiUrl, setCustomApiUrl] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');
    const [autoSend, setAutoSend] = useState(false);
    const [speedMode, setSpeedMode] = useState(false); // 极速模式
    
    const recognitionRef = useRef(null);

    // 初始化
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const verified = localStorage.getItem('ai_translator_verified');
            if (verified === 'true') setIsVerified(true);

            setCustomApiUrl(localStorage.getItem('ai_api_url') || '');
            setCustomApiKey(localStorage.getItem('ai_api_key') || '');
            setAutoSend(localStorage.getItem('ai_auto_send') === 'true');
            setSpeedMode(localStorage.getItem('ai_speed_mode') === 'true');
            setSourceLang(localStorage.getItem('ai_source_lang') || 'auto');
            setTargetLang(localStorage.getItem('ai_target_lang') || 'my');
        }
    }, [isOpen]);

    // 验证逻辑
    const handleVerify = () => {
        if (passwordInput === CORRECT_ACCESS_CODE) {
            setIsVerified(true);
            localStorage.setItem('ai_translator_verified', 'true');
        } else {
            alert('密码错误 / Password Incorrect');
            setPasswordInput('');
        }
    };

    // 保存设置
    const saveSetting = (key, value) => {
        localStorage.setItem(key, value);
        if (key === 'ai_api_url') setCustomApiUrl(value);
        if (key === 'ai_api_key') setCustomApiKey(value);
        if (key === 'ai_auto_send') setAutoSend(value === 'true');
        if (key === 'ai_speed_mode') setSpeedMode(value === 'true');
        if (key === 'ai_source_lang') setSourceLang(value);
        if (key === 'ai_target_lang') setTargetLang(value);
    };

    // 语音识别
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SR) {
                const recognition = new SR();
                recognition.continuous = false;
                recognition.interimResults = true;
                
                recognition.onresult = (e) => {
                    const text = Array.from(e.results).map(r => r[0].transcript).join('');
                    setInput(text);
                };
                
                recognition.onend = () => {
                    setIsListening(false);
                };
                recognitionRef.current = recognition;
            }
        }
    }, []);

    // 自动发送监听
    useEffect(() => {
        if (!isListening && autoSend && input.trim().length > 1 && !loading) {
            handleTranslate();
        }
    }, [isListening]);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('Browser not support speech');
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            // 根据源语言自动切换听写语言
            let langCode = 'zh-CN';
            if (sourceLang === 'en') langCode = 'en-US';
            if (sourceLang === 'my') langCode = 'my-MM'; 
            
            recognitionRef.current.lang = langCode;
            recognitionRef.current.start();
            setIsListening(true);
            setInput('');
        }
    };

    // 翻译请求
    const handleTranslate = async () => {
        if (!input.trim() || loading) return;
        setLoading(true);
        setResults([]);
        setQuickReplies([]);
        
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: input,
                    sourceLang,
                    targetLang,
                    speedMode,
                    customConfig: {
                        apiUrl: customApiUrl, 
                        apiKey: customApiKey
                    }
                })
            });
            const data = await res.json();
            if (data.results) {
                setResults(data.results);
                if (data.quick_replies) setQuickReplies(data.quick_replies);
            } else if (data.error) {
                alert(`API Error: ${data.error}`);
            }
        } catch (e) {
            alert('Request Failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const speak = (text) => {
        // 简单映射 TTS
        const voiceMap = { 'my': 'my-MM-NilarNeural', 'zh': 'zh-CN-XiaoxiaoNeural', 'en': 'en-US-JennyNeural' };
        const v = voiceMap[targetLang] || 'en-US-JennyNeural';
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${v}&r=-10`;
        new Audio(url).play().catch(e => console.error(e));
    };

    // 点击快捷回复
    const handleQuickReply = (reply) => {
        setInput(reply);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col overflow-hidden">
            {/* 顶栏 */}
            <div className="px-4 py-3 bg-white shadow-sm flex justify-between items-center z-10">
                <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                    <X size={24} />
                </button>
                <div className="flex items-center gap-1">
                     <span className="font-black text-slate-800 text-lg">AI 翻译官</span>
                     {speedMode && <Zap size={14} className="text-amber-500" fill="currentColor"/>}
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full">
                    <Settings size={24} />
                </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {!isVerified ? (
                    // 🔒 锁屏界面
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white/50 backdrop-blur-sm">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600 animate-bounce">
                            <Lock size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">访问受限 (Access Denied)</h2>
                        <p className="text-slate-500 text-sm mb-6 text-center">请输入密码以使用高级翻译功能</p>
                        
                        <div className="w-full max-w-xs relative mb-4">
                            <KeyRound size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="password" 
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="输入密码 (默认为 fanyi)"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center tracking-widest text-lg"
                            />
                        </div>
                        <button 
                            onClick={handleVerify}
                            className="w-full max-w-xs py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                        >
                            解锁 (Unlock)
                        </button>
                    </div>
                ) : (
                    // ✅ 翻译主界面
                    <div className="p-4 pb-32 space-y-4">
                        {/* 快捷回复区域 */}
                        {quickReplies.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1 flex items-center gap-1">
                                    <Sparkles size={12}/> 智能回复建议
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {quickReplies.map((reply, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => handleQuickReply(reply)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold active:scale-95 transition-transform border border-blue-100"
                                        >
                                            {reply}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 结果显示 - 直接展示内容，不折叠 */}
                        {results.map((item, idx) => (
                            <ResultItem key={idx} item={item} onSpeak={() => speak(item.translation)} />
                        ))}
                        
                        {results.length === 0 && !loading && (
                            <div className="text-center mt-20 opacity-30">
                                <BrainCircuit size={64} className="mx-auto mb-4 text-slate-400" />
                                <p className="text-sm font-bold">准备就绪，请说话或输入</p>
                            </div>
                        )}
                        
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <Loader2 size={32} className="animate-spin text-blue-500" />
                                <p className="text-xs font-bold text-slate-400">AI 正在思考...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 底部输入区 */}
            {isVerified && (
                <div className="bg-white border-t border-slate-100 p-4 pb-8 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="relative mb-3">
                        <textarea 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isListening ? "正在聆听..." : "输入内容..."}
                            className={`w-full bg-slate-50 rounded-2xl p-4 pr-12 resize-none h-24 text-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all ${isListening ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}
                        />
                        {input && (
                            <button onClick={() => setInput('')} className="absolute top-3 right-3 p-1 text-slate-400 bg-white rounded-full shadow-sm">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    
                    {/* 按钮合并：有字发送，无字语音 */}
                    <button 
                        onClick={input.trim() ? handleTranslate : toggleListening}
                        disabled={loading}
                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-white shadow-xl transition-all active:scale-95 ${
                            input.trim() 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-200' 
                                : (isListening ? 'bg-rose-500 shadow-rose-200 animate-pulse' : 'bg-slate-800 shadow-slate-300')
                        }`}
                    >
                        {loading ? '翻译中...' : (input.trim() ? <><Send size={20}/> 发送翻译</> : <><Mic size={24}/> 长按或点击说话</>)}
                    </button>
                </div>
            )}

            {/* 设置弹窗 */}
            <AnimatePresence>
                {showSettings && (
                    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <motion.div 
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg">全局设置</h3>
                                <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-100 rounded-full"><X size={18}/></button>
                            </div>
                            
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {/* 极速模式 */}
                                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                    <div>
                                        <span className="font-bold text-amber-900 text-sm flex items-center gap-1">
                                            <Zap size={14} fill="currentColor"/> 极速模式
                                        </span>
                                        <p className="text-[10px] text-amber-700/70">仅3种结果，响应更快</p>
                                    </div>
                                    <input type="checkbox" checked={speedMode} onChange={(e) => saveSetting('ai_speed_mode', e.target.checked ? 'true' : 'false')} className="w-5 h-5 accent-amber-500" />
                                </div>

                                {/* 语言选择 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">源语言</label>
                                        <select value={sourceLang} onChange={(e) => saveSetting('ai_source_lang', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold">
                                            <option value="auto">自动识别</option>
                                            <option value="zh">中文</option>
                                            <option value="en">English</option>
                                            <option value="my">缅甸语</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">目标语言</label>
                                        <select value={targetLang} onChange={(e) => saveSetting('ai_target_lang', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold">
                                            <option value="my">缅甸语</option>
                                            <option value="zh">中文</option>
                                            <option value="en">English</option>
                                            <option value="th">泰语</option>
                                            <option value="vi">越南语</option>
                                            <option value="jp">日语</option>
                                        </select>
                                    </div>
                                </div>

                                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                    <span className="font-medium text-sm text-slate-700">语音结束自动发送</span>
                                    <input type="checkbox" checked={autoSend} onChange={(e) => saveSetting('ai_auto_send', e.target.checked ? 'true' : 'false')} className="w-5 h-5 accent-blue-600" />
                                </label>
                                
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase">自定义 API (心流)</p>
                                    <input 
                                        type="password" 
                                        value={customApiKey} 
                                        onChange={(e) => saveSetting('ai_api_key', e.target.value)}
                                        placeholder="sk-xxxxxxxx" 
                                        className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none border border-transparent focus:border-blue-200 font-mono"
                                    />
                                    <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-500 font-bold mt-1">
                                        <ExternalLink size={12}/> 申请 SiliconFlow API Key
                                    </a>
                                </div>

                                <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold mt-2">
                                    保存设置
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ==========================================
// 组件: 结果展示 (增强版 - 回译字体加大)
// ==========================================
const ResultItem = ({ item, onSpeak }) => {
    // 相似度颜色
    const scoreColor = (score) => {
        if (score >= 0.9) return 'text-green-500';
        if (score >= 0.7) return 'text-amber-500';
        return 'text-red-500';
    };

    // 风险等级图标
    const RiskIcon = ({ level }) => {
        if (level === 'high') return <ShieldAlert size={12} className="text-red-500" />;
        if (level === 'medium') return <ShieldCheck size={12} className="text-amber-500" />;
        return <ShieldCheck size={12} className="text-green-500" />;
    };

    return (
        <div className={`p-4 rounded-2xl border bg-white ${item.recommended ? 'border-blue-200 shadow-md shadow-blue-50' : 'border-slate-100 shadow-sm'}`}>
            {/* 顶部标签栏 */}
            <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                     <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.recommended ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.type || item.label}
                     </span>
                     {item.recommended && <Star size={12} className="text-amber-400 fill-amber-400" />}
                 </div>
                 
                 {/* 评分和风险展示 */}
                 {item.similarity_score !== undefined && (
                     <div className="flex items-center gap-2">
                         <div className="flex items-center gap-1 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded">
                             <Zap size={10} className={scoreColor(item.similarity_score)} fill="currentColor"/>
                             <span className="font-bold text-slate-600">{Math.round(item.similarity_score * 100)}%</span>
                         </div>
                         {item.risk_level && (
                            <div className="flex items-center gap-1 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded" title={`Risk: ${item.risk_level}`}>
                                <RiskIcon level={item.risk_level} />
                            </div>
                         )}
                     </div>
                 )}
            </div>
            
            {/* 内容直接显示 */}
            <p className="text-lg font-bold text-slate-800 leading-relaxed mb-3 select-all">
                {item.translation}
            </p>
            
            {/* 回译 (字体加大 text-sm -> text-base, text-slate-500 -> text-slate-600) */}
            <div className="pt-3 border-t border-slate-50/80">
                <p className="text-sm font-medium text-slate-600 italic">
                    <span className="text-[10px] text-slate-400 not-italic uppercase mr-1">Back:</span>
                    {item.back_translation}
                </p>
                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={onSpeak} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                        <Volume2 size={18} />
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(item.translation)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                        <Copy size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};


// ==========================================
// 3. 核心子组件 (HSK, Pinyin - 复用标准逻辑)
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

// 拼音面板组件
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
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  const [activeHskWords, setActiveHskWords] = useState(null);
  const [activeLevelTag, setActiveLevelTag] = useState(null);
  const [membership, setMembership] = useState({ open: false, level: null });

  const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');

  // 事件处理函数
  const handleSpokenGeneralClick = useCallback((e) => {
    if(e) e.preventDefault();
    router.push('/spoken');
  }, [router]);

  const handleSpokenCollectionClick = useCallback((e) => {
    if(e) e.preventDefault();
    router.push({ pathname: '/spoken', query: { filter: 'favorites' } });
  }, [router]);

  const handleVocabularyClick = useCallback((level) => {
    const levelNum = level?.level || 1;
    const words = hskWordsData[levelNum] || [];
    setActiveHskWords(words);
    setActiveLevelTag(`hsk${levelNum}`);
    router.push({ pathname: router.pathname, query: { ...router.query, level: levelNum }, hash: 'hsk-vocabulary' }, undefined, { shallow: true });
  }, [router]);

  const handleCollectionClick = useCallback(() => {
    const savedIds = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    const allWords = [ ...(hskWordsData[1] || []), ...(hskWordsData[2] || []) ];
    const favoriteWords = allWords.filter(word => 
      savedIds.some(savedId => String(savedId) === String(word.id))
    );

    if (favoriteWords.length === 0) {
      alert("No saved words yet!");
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
        
        <div className="bg-white rounded-[1.8rem] p-4 shadow-xl shadow-slate-200/60 border border-slate-50 mb-4">
             <PinyinSection 
                onOpenCollection={handleCollectionClick} 
                onOpenSpokenCollection={handleSpokenCollectionClick}
             />
        </div>
      </header>

      {/* 🚀 唯一翻译入口：全屏翻译官 (双语标题) */}
      <div className="px-4">
        <button 
          onClick={() => setIsTranslatorOpen(true)}
          className="w-full relative h-24 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl overflow-hidden shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-between px-6 group"
        >
          <div className="z-10 text-left">
            <div className="flex items-center gap-1.5 mb-1 text-indigo-100">
                <BrainCircuit size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">AI Translator Pro</span>
            </div>
            <h3 className="text-xl font-black text-white flex flex-col leading-tight">
                <span>智能翻译官</span>
                <span className="text-xs font-normal opacity-80 mt-0.5">(AI ဘာသာပြန်)</span>
            </h3>
            <p className="text-indigo-100 text-[10px] mt-1 opacity-80">精准直译 · 地道口语 · 文化解析</p>
          </div>
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
            <ChevronRight size={24} />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 -mr-4"></div>
        </button>
      </div>

      {/* 口语练习横图 */}
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
        {isTranslatorOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100]"
          >
            <FullScreenTranslator isOpen={isTranslatorOpen} onClose={() => setIsTranslatorOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

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
