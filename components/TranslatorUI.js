import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronDown,
  ExternalLink, Sparkles, ArrowRightLeft,
  Loader2, Star, Languages, Check, Globe,
  MessageCircle, Feather, Zap, User, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import Link from 'next/link';

// --- 发音人配置库 (支持男女声) ---
const VOICE_LIBRARY = {
  zh: { 
    female: 'zh-CN-XiaoxiaoNeural', 
    male: 'zh-CN-YunxiNeural' 
  },
  en: { 
    female: 'en-US-JennyNeural', 
    male: 'en-US-GuyNeural' 
  },
  my: { 
    female: 'my-MM-NilarNeural', 
    male: 'my-MM-ThihaNeural' 
  },
  th: { 
    female: 'th-TH-PremwadeeNeural', 
    male: 'th-TH-NiwatNeural' 
  },
  vi: { 
    female: 'vi-VN-HoaiMyNeural', 
    male: 'vi-VN-NamMinhNeural' 
  },
  ja: { 
    female: 'ja-JP-NanamiNeural', 
    male: 'ja-JP-KeitaNeural' 
  }
};

const SOURCE_LANGUAGES = [
  { code: 'auto', label: '🤖 自动' },
  { code: 'zh', label: '🇨🇳 中文', voice: 'zh-CN' },
  { code: 'en', label: '🇺🇸 英文', voice: 'en-US' },
  { code: 'my', label: '🇲🇲 缅文', voice: 'my-MM' },
  { code: 'th', label: '🇹🇭 泰文', voice: 'th-TH' },
  { code: 'ja', label: '🇯🇵 日文', voice: 'ja-JP' },
  { code: 'vi', label: '🇻🇳 越南', voice: 'vi-VN' },
];

const TARGET_LANGUAGES = [
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'en', label: '🇺🇸 英文' },
  { code: 'th', label: '🇹🇭 泰文' },
  { code: 'vi', label: '🇻🇳 越南' },
  { code: 'ja', label: '🇯🇵 日文' },
];

// --- 组件入口 ---

export default function TranslatorUI() {
  const [mounted, setMounted] = useState(false);
  
  // 状态管理
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);
  
  // 核心逻辑控制
  const isVoiceInputRef = useRef(false); // 标记当前输入是否来自语音
  
  // 布局高度状态
  const [footerHeight, setFooterHeight] = useState(0);

  // 语言设置
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');

  // 配置与弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false); 
  const [selectorType, setSelectorType] = useState('target'); // 'source' or 'target'

  // 用户配置
  const [autoSendVoice, setAutoSendVoice] = useState(true); // 仅控制语音自动发送
  const [voiceGender, setVoiceGender] = useState('female'); // 'female' or 'male'
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  // Refs
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const footerRef = useRef(null); 
  const audioRef = useRef(null); 

  // --- 初始化与副作用 ---

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setApiKey(localStorage.getItem('tr_api_key') || '');
      setAutoSendVoice(localStorage.getItem('tr_auto_send_voice') !== 'false');
      setVoiceGender(localStorage.getItem('tr_voice_gender') || 'female');
      setModel(localStorage.getItem('tr_model') || 'deepseek-v3.2');
      setApiUrl(localStorage.getItem('tr_api_url') || 'https://apis.iflow.cn/v1');
      setSourceLang(localStorage.getItem('tr_src') || 'auto');
      setTargetLang(localStorage.getItem('tr_tar') || 'my');

      // 初始化语音识别
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        
        rec.onstart = () => {
          setIsListening(true);
          isVoiceInputRef.current = true; // 标记开始语音输入
        };

        rec.onresult = (e) => {
          const text = Array.from(e.results).map(r => r[0].transcript).join('');
          setInput(text);
          isVoiceInputRef.current = true; // 确保标记为语音
        };
        
        rec.onend = () => {
          setIsListening(false);
          // 这里的自动发送逻辑移到 useEffect 处理，确保状态同步
        };
        
        recognitionRef.current = rec;
      }
    }
  }, []);

  // 监听底部高度
  useEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver((entries) => {
        const height = entries[0].contentRect.height;
        setFooterHeight(height);
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  // 核心逻辑：语音结束自动发送 (打字不触发)
  useEffect(() => {
    // 条件：语音输入刚结束 + 开启自动发送 + 有内容 + 不是Loading
    if (!isListening && autoSendVoice && isVoiceInputRef.current && input.trim().length > 0 && !loading) {
        handleTranslate();
        isVoiceInputRef.current = false; // 重置标记，防止后续误触发
    }
  }, [isListening, autoSendVoice, input, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // --- 翻译核心 ---

  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim()) return;

    setLoading(true);
    // 每次新翻译重置标记
    isVoiceInputRef.current = false; 

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang,
          targetLang,
          customConfig: { apiKey, model, apiUrl }
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details?.error?.message || err.error || '请求失败');
      }
      
      const data = await res.json();
      
      if (data.parsed) {
        const p = data.parsed;
        // 紧凑卡片数据结构
        const formattedResults = [
          { 
            id: 'direct', 
            label: '直接', 
            translation: p.direct?.translation || '', 
            recommended: true 
          },
          { 
            id: 'spoken', 
            label: '口语', 
            translation: p.spoken?.translation || '', 
            recommended: false 
          },
          { 
            id: 'free', 
            label: '意译', 
            translation: p.free?.translation || '', 
            recommended: false 
          },
          { 
            id: 'social', 
            label: '社交', 
            translation: p.social?.translation || '', 
            recommended: false 
          }
        ].filter(item => item.translation);

        setResults(formattedResults);
      } else if (data.results) {
        setResults(data.results);
      }
      
      setQuickReplies(data.quick_replies || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 语音输入控制
  const toggleListening = () => {
    if (!recognitionRef.current) return alert('不支持语音识别');
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      const currentSourceObj = SOURCE_LANGUAGES.find(l => l.code === sourceLang);
      recognitionRef.current.lang = currentSourceObj?.voice || 'zh-CN'; 
      recognitionRef.current.start();
    }
  };

  // 播放控制 (支持男女声切换)
  const speak = (text) => {
    if (typeof window === 'undefined') return;
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }

    // 从库中查找声音
    const langConfig = VOICE_LIBRARY[targetLang];
    // 默认 fallback 到英文 Jenny
    const voice = langConfig ? langConfig[voiceGender] : 'en-US-JennyNeural';
    
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-10`;
    
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(e => console.error("TTS Error", e));
  };

  const handleCopy = (text) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  };

  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  const selectLanguage = (code) => {
    if (selectorType === 'source') {
      setSourceLang(code);
      localStorage.setItem('tr_src', code);
    } else {
      setTargetLang(code);
      localStorage.setItem('tr_tar', code);
    }
    setShowLangSelector(false);
  };

  const getSourceLabel = () => SOURCE_LANGUAGES.find(l => l.code === sourceLang)?.label || sourceLang;
  const getTargetLabel = () => TARGET_LANGUAGES.find(l => l.code === targetLang)?.label || targetLang;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F0F2F6] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
          <title>AI 翻译官 Pro</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </Head>

      <div className="flex flex-col h-[100dvh] max-w-md mx-auto relative overflow-hidden bg-white sm:shadow-2xl sm:rounded-[2.5rem] sm:my-4 sm:h-[calc(100vh-2rem)] sm:border border-slate-200">
        
        {/* --- 顶部紧凑导航 --- */}
        <header className="absolute top-0 left-0 right-0 z-40 p-3 flex justify-between items-start pointer-events-none">
          <Link href="/">
            <a className="pointer-events-auto p-2 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600 active:scale-95">
              <Languages size={16} />
            </a>
          </Link>

          {/* 语言切换胶囊 */}
          <div className="pointer-events-auto flex flex-col items-center gap-2 mt-0.5">
             <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-xl shadow-sm border border-slate-100 rounded-full p-1 pr-3">
                <button 
                  onClick={() => { setSelectorType('source'); setShowLangSelector(true); }}
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    {getSourceLabel().split(' ')[1]}
                </button>
                
                <button onClick={swapLanguages} className="p-1 rounded-full text-slate-300 hover:text-indigo-500 active:rotate-180 transition-all">
                    <ArrowRightLeft size={12} />
                </button>

                <button 
                   onClick={() => { setSelectorType('target'); setShowLangSelector(true); }}
                   className="px-2 text-xs font-black text-indigo-800 flex items-center gap-1"
                >
                    {getTargetLabel().split(' ')[1]}
                    <ChevronDown size={10} className="opacity-50" />
                </button>
             </div>
          </div>

          <button onClick={()=>setShowSettings(true)} className="pointer-events-auto p-2 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600 active:scale-95">
            <Settings size={16} />
          </button>
        </header>

        {/* --- 主内容区 (紧凑小卡片) --- */}
        <main 
            className="flex-1 overflow-y-auto px-3 pt-20 no-scrollbar space-y-2"
            style={{ paddingBottom: footerHeight + 10 }}
        >
            {/* 空状态 */}
            {results.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none select-none -mt-10">
                <BrainCircuit size={60} className="text-slate-300 mb-3" strokeWidth={1} />
                <p className="font-bold text-slate-400 text-[10px] tracking-widest uppercase">AI TRANSLATOR</p>
              </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-2">
                    <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-sm border border-slate-100 flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-indigo-600" />
                        <span className="text-[10px] font-bold text-indigo-600">Translating...</span>
                    </div>
                </div>
            )}

            {/* 紧凑卡片列表 */}
            <AnimatePresence mode='popLayout'>
              {results.map((item, idx) => (
                <motion.div 
                    key={`${idx}-${item.id}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`bg-white rounded-xl p-3 border shadow-sm flex flex-col gap-1.5 group ${item.recommended ? 'border-indigo-100 shadow-indigo-50' : 'border-slate-100'}`}
                >
                    {/* 卡片头部：标签 + 快捷操作 (一行显示) */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${item.recommended ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                {item.label}
                            </span>
                        </div>
                        
                        {/* 紧凑操作按钮 */}
                        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => speak(item.translation)} className="active:scale-90 transition-transform text-slate-400 hover:text-indigo-600">
                                <Volume2 size={14} />
                             </button>
                             <button onClick={() => handleCopy(item.translation)} className="active:scale-90 transition-transform text-slate-400 hover:text-emerald-600">
                                <Copy size={14} />
                             </button>
                        </div>
                    </div>

                    {/* 卡片内容 */}
                    <div className="text-sm text-slate-800 font-medium leading-normal select-all pl-0.5">
                        {item.translation}
                    </div>
                </motion.div>
              ))}
            </AnimatePresence>
        </main>
        
        {/* --- 底部悬浮区 --- */}
        <div 
            ref={footerRef}
            className="absolute bottom-0 left-0 right-0 z-30 pb-safe" 
        >
           {/* 快捷回复 (极简) */}
           {quickReplies.length > 0 && (
               <div className="px-3 mb-2">
                   <div className="flex gap-2 overflow-x-auto no-scrollbar mask-fade-sides py-1">
                      {quickReplies.map((q, i) => ( 
                          <button 
                            key={i} 
                            onClick={() => { setInput(q); isVoiceInputRef.current = false; handleTranslate(q); }} 
                            className="whitespace-nowrap px-3 py-1.5 bg-white/95 border border-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition-all"
                          >
                              {q}
                          </button> 
                        ))}
                   </div>
               </div>
           )}

           {/* 底部输入面板 */}
           <div className="bg-white/90 backdrop-blur-xl border-t border-slate-100 px-3 py-3 shadow-sm">
              <div className="flex gap-2 items-end">
                 {/* 切换识别语言按钮 */}
                 <button 
                    onClick={() => { setSelectorType('source'); setShowLangSelector(true); }}
                    className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 border border-slate-200 flex flex-col items-center justify-center gap-0.5 shrink-0 active:scale-95 transition-all"
                 >
                    <Globe size={14} />
                    <span className="text-[9px] font-bold leading-none">{getSourceLabel().split(' ')[1]}</span>
                 </button>

                 {/* 输入框 */}
                 <div className="flex-1 relative bg-slate-100 rounded-xl overflow-hidden border border-transparent focus-within:bg-white focus-within:border-indigo-200 focus-within:ring-2 ring-indigo-50 transition-all">
                    <textarea 
                        ref={textareaRef} 
                        value={input} 
                        onChange={e => { setInput(e.target.value); isVoiceInputRef.current = false; }} 
                        placeholder={isListening ? "聆听中..." : "输入内容..."} 
                        className="w-full bg-transparent p-3 pr-8 resize-none text-sm font-medium text-slate-800 outline-none max-h-[80px] min-h-[40px] placeholder:text-slate-400"
                        rows={1} 
                    />
                    {input && (
                        <button onClick={()=>setInput('')} className="absolute top-2.5 right-2 text-slate-400 hover:text-rose-500 p-1">
                            <X size={14} />
                        </button>
                    )}
                 </div>

                 {/* 操作按钮 (Send / Mic) */}
                 <button 
                    onClick={input.trim() ? () => handleTranslate() : toggleListening} // 打字时 handleTranslate, 空白时 Mic
                    disabled={loading}
                    className={`w-12 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-all active:scale-90 shrink-0
                        ${input.trim() 
                            ? 'bg-indigo-600 shadow-indigo-200' 
                            : (isListening ? 'bg-rose-500 animate-pulse shadow-rose-200' : 'bg-slate-900 shadow-slate-200')
                        }
                    `}
                 >
                    {loading ? (
                        <Loader2 size={18} className="animate-spin"/> 
                    ) : (
                        input.trim() ? (
                            <Send size={18} /> // 打字显示发送图标
                        ) : (
                            <Mic size={20} className={isListening ? 'animate-bounce' : ''}/>
                        )
                    )}
                 </button>
              </div>
           </div>
        </div>

        {/* --- 弹窗：语言选择器 --- */}
        <AnimatePresence>
          {showLangSelector && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end" onClick={()=>setShowLangSelector(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-[2rem] p-5 pb-safe max-h-[70vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
                <h3 className="text-base font-black text-slate-800 mb-4 text-center shrink-0">
                    选择{selectorType === 'source' ? '识别语言' : '目标语言'}
                </h3>
                
                <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar pb-2">
                    {(selectorType === 'source' ? SOURCE_LANGUAGES : TARGET_LANGUAGES).map(lang => {
                        const isSelected = (selectorType === 'source' ? sourceLang : targetLang) === lang.code;
                        return (
                            <button 
                                key={lang.code}
                                onClick={() => selectLanguage(lang.code)}
                                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'}`}
                            >
                                <span className="font-bold text-xs">{lang.label}</span>
                                {isSelected && <Check size={14} />}
                            </button>
                        );
                    })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 弹窗：系统设置 (新增发音人) --- */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full sm:w-[90%] sm:max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-safe" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">设置</h3>
                  <button onClick={()=>setShowSettings(false)} className="bg-slate-100 text-slate-500 p-2 rounded-full hover:bg-slate-200"><X size={18}/></button>
                </div>

                <div className="space-y-4">
                  {/* 发音人偏好设置 */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Volume2 size={16} className="text-indigo-600"/>
                        <span className="font-bold text-sm text-slate-700">发音人偏好</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => { setVoiceGender('female'); localStorage.setItem('tr_voice_gender', 'female'); }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${voiceGender === 'female' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                            👩 女声 Female
                        </button>
                        <button 
                            onClick={() => { setVoiceGender('male'); localStorage.setItem('tr_voice_gender', 'male'); }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${voiceGender === 'male' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                            👨 男声 Male
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 px-1">
                        * 将自动应用到所有支持的语言
                    </p>
                  </div>

                  {/* 语音自动发送开关 */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl"> 
                      <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-xs">语音识别后自动发送</span>
                          <span className="text-[10px] text-slate-400">文字输入需手动点击发送</span>
                      </div>
                      <input type="checkbox" checked={autoSendVoice} onChange={e=>{setAutoSendVoice(e.target.checked); localStorage.setItem('tr_auto_send_voice', e.target.checked)}} className="w-5 h-5 accent-indigo-600 rounded" /> 
                  </div>
                  
                  {/* API 设置 */}
                  <div className="p-4 bg-slate-900 rounded-2xl text-white">
                    <div className="flex justify-between items-center mb-3"> 
                        <label className="text-[10px] font-black text-indigo-300 uppercase">API Config</label> 
                        <a href="https://iflow.cn/" target="_blank" rel="noreferrer" className="text-[10px] text-white/50 flex items-center gap-1 hover:text-white">获取 Key <ExternalLink size={10}/></a> 
                    </div>
                    <div className="space-y-2">
                        <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key" className="w-full bg-white/10 border border-white/10 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-indigo-500" />
                        <select value={model} onChange={e=>{setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full py-2 px-3 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-xs font-bold outline-none">
                                <option value="deepseek-v3.2">DeepSeek V3.2</option>
                                <option value="gpt-4o">GPT-4o</option>
                        </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .mask-fade-sides { -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}
