import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronDown,
  ExternalLink, Sparkles, ArrowRightLeft,
  Loader2, Star, Languages, Check, Globe,
  MessageCircle, Feather, Zap, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import Link from 'next/link';

// --- 常量定义 ---

const SOURCE_LANGUAGES = [
  { code: 'auto', label: '🤖 自动检测', voice: null },
  { code: 'zh', label: '🇨🇳 中文', voice: 'zh-CN' },
  { code: 'en', label: '🇺🇸 英文', voice: 'en-US' },
  { code: 'my', label: '🇲🇲 缅文', voice: 'my-MM' },
  { code: 'th', label: '🇹🇭 泰文', voice: 'th-TH' },
  { code: 'ja', label: '🇯🇵 日文', voice: 'ja-JP' },
  { code: 'vi', label: '🇻🇳 越南', voice: 'vi-VN' },
];

const TARGET_LANGUAGES = [
  { code: 'my', label: '🇲🇲 缅文', voice: 'my-MM-NilarNeural' },
  { code: 'zh', label: '🇨🇳 中文', voice: 'zh-CN-XiaoxiaoNeural' },
  { code: 'en', label: '🇺🇸 英文', voice: 'en-US-JennyNeural' },
  { code: 'th', label: '🇹🇭 泰文', voice: 'th-TH-PremwadeeNeural' },
  { code: 'vi', label: '🇻🇳 越南', voice: 'vi-VN-HoaiMyNeural' },
  { code: 'ja', label: '🇯🇵 日文', voice: 'ja-JP-NanamiNeural' },
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
  const [autoSend, setAutoSend] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  // Refs
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const footerRef = useRef(null); 
  const audioRef = useRef(null); // 音频缓存 Ref

  // --- 初始化与副作用 ---

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setApiKey(localStorage.getItem('tr_api_key') || '');
      setAutoSend(localStorage.getItem('tr_auto_send') !== 'false');
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
        rec.onresult = (e) => setInput(Array.from(e.results).map(r => r[0].transcript).join(''));
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }
    }
  }, []);

  // 监听底部高度变化
  useEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver((entries) => {
        const height = entries[0].contentRect.height;
        setFooterHeight(height);
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  // 核心修复：正确的自动发送依赖逻辑
  useEffect(() => {
    // 只有在：自动发送开启 + 非录音中 + 非加载中 + 有内容 时触发
    if (autoSend && !isListening && !loading && input.trim().length > 1) {
      // 600ms 防抖，防止打字时频繁请求
      const timer = setTimeout(() => {
        handleTranslate();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [input, isListening, autoSend]); // 必须包含 input

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // --- 核心逻辑 ---

  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim()) return;

    // 注意：这里不要 setResults([])，防止 UI 闪烁，只设置 loading 状态
    setLoading(true);

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
      
      // 核心修复：解析 parsed 结构
      // 优先检查新结构 parsed，如果不存在则回退到 results（兼容旧逻辑）
      if (data.parsed) {
        const p = data.parsed;
        const formattedResults = [
          { 
            id: 'direct', 
            label: '直接翻译', 
            icon: <Zap size={14} />,
            translation: p.direct?.translation || '', 
            recommended: true 
          },
          { 
            id: 'spoken', 
            label: '地道口语', 
            icon: <MessageCircle size={14} />,
            translation: p.spoken?.translation || '', 
            recommended: false 
          },
          { 
            id: 'free', 
            label: '自然意译', 
            icon: <Feather size={14} />,
            translation: p.free?.translation || '', 
            recommended: false 
          },
          { 
            id: 'social', 
            label: '社交语气', 
            icon: <User size={14} />,
            translation: p.social?.translation || '', 
            recommended: false 
          }
        ].filter(item => item.translation); // 过滤掉空结果

        setResults(formattedResults);
      } else if (data.results) {
        // 兼容旧接口
        setResults(data.results);
      }
      
      setQuickReplies(data.quick_replies || []);

    } catch (e) {
      console.error(e);
      // 仅在错误时 alert，或者可以用 toast
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert('当前浏览器不支持语音识别');
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      const currentSourceObj = SOURCE_LANGUAGES.find(l => l.code === sourceLang);
      recognitionRef.current.lang = currentSourceObj?.voice || 'zh-CN'; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // 优化：使用 audioRef 缓存播放器
  const speak = (text) => {
    if (typeof window === 'undefined') return;
    
    // 如果正在播放，先暂停
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }

    const currentTargetObj = TARGET_LANGUAGES.find(l => l.code === targetLang);
    const voice = currentTargetObj?.voice || 'en-US-JennyNeural';
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-10`;
    
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(e => console.error("TTS Play Error", e));
  };

  const handleCopy = (text) => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        // 这里可以加一个 Toast 提示，为了简洁暂略
    }
  };

  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    localStorage.setItem('tr_src', targetLang);
    localStorage.setItem('tr_tar', temp);
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
    <div className="min-h-screen bg-[#F2F4F8] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
          <title>AI 翻译官 Pro</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </Head>

      <div className="flex flex-col h-[100dvh] max-w-md mx-auto relative overflow-hidden bg-white sm:shadow-2xl sm:rounded-[2.5rem] sm:my-4 sm:h-[calc(100vh-2rem)] sm:border border-slate-200">
        
        {/* --- 顶部悬浮导航 --- */}
        <header className="absolute top-0 left-0 right-0 z-40 p-4 flex justify-between items-start pointer-events-none">
          <Link href="/">
            <a className="pointer-events-auto p-2.5 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600 hover:bg-white hover:text-indigo-600 transition-all active:scale-95">
              <Languages size={18} />
            </a>
          </Link>

          {/* 语言切换胶囊 */}
          <div className="pointer-events-auto flex flex-col items-center gap-2 mt-1">
             <div className="flex items-center gap-1 bg-white/90 backdrop-blur-xl shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] border border-slate-100 rounded-full p-1 pr-4 transition-all hover:shadow-lg">
                <button 
                  onClick={() => { setSelectorType('source'); setShowLangSelector(true); }}
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1"
                >
                    {getSourceLabel().split(' ')[1]}
                </button>
                
                <button onClick={swapLanguages} className="p-1.5 rounded-full hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors active:rotate-180">
                    <ArrowRightLeft size={14} />
                </button>

                <button 
                   onClick={() => { setSelectorType('target'); setShowLangSelector(true); }}
                   className="px-2 text-sm font-black text-indigo-900 flex items-center gap-1 hover:opacity-70"
                >
                    {getTargetLabel().split(' ')[1]}
                    <ChevronDown size={12} className="opacity-50" />
                </button>
             </div>
          </div>

          <button onClick={()=>setShowSettings(true)} className="pointer-events-auto p-2.5 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600 hover:bg-white hover:text-indigo-600 transition-all active:scale-95">
            <Settings size={18} />
          </button>
        </header>

        {/* --- 主内容区 (动态 Padding + 小卡片列表) --- */}
        <main 
            className="flex-1 overflow-y-auto px-4 pt-24 no-scrollbar space-y-3"
            style={{ paddingBottom: footerHeight + 20 }}
        >
            {/* 空状态 */}
            {results.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none select-none -mt-10">
                <BrainCircuit size={80} className="text-slate-300 mb-4" strokeWidth={1} />
                <p className="font-black text-slate-400 text-xs tracking-[0.2em] uppercase">Ready to translate</p>
              </div>
            )}

            {/* Loading Indicator (悬浮在列表顶部) */}
            {loading && (
                <div className="flex justify-center py-2">
                    <div className="bg-white/80 backdrop-blur px-4 py-1.5 rounded-full shadow-sm border border-slate-100 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-indigo-600" />
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Thinking...</span>
                    </div>
                </div>
            )}

            {/* 小卡片结果列表 */}
            <AnimatePresence mode='popLayout'>
              {results.map((item, idx) => (
                <motion.div 
                    key={`${idx}-${item.id}`}
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 group"
                >
                    {/* 卡片头部 */}
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <div className="flex items-center gap-2">
                            <span className={`p-1 rounded-md ${item.recommended ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                {item.icon || <Sparkles size={14}/>}
                            </span>
                            <span className={`text-xs font-bold ${item.recommended ? 'text-indigo-700' : 'text-slate-600'}`}>
                                {item.label}
                            </span>
                        </div>
                        {item.recommended && <Star size={12} className="text-amber-400 fill-amber-400" />}
                    </div>

                    {/* 卡片内容 */}
                    <div className="text-[15px] text-slate-800 leading-relaxed font-medium select-all">
                        {item.translation}
                    </div>

                    {/* 卡片底部操作区 */}
                    <div className="flex justify-end gap-2 pt-1">
                         <button 
                            onClick={() => speak(item.translation)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-full text-[10px] font-bold transition-colors active:scale-95"
                         >
                            <Volume2 size={12} /> 朗读
                         </button>
                         <button 
                            onClick={() => handleCopy(item.translation)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-full text-[10px] font-bold transition-colors active:scale-95"
                         >
                            <Copy size={12} /> 复制
                         </button>
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
           {/* 快捷回复 */}
           {quickReplies.length > 0 && (
               <div className="px-4 mb-3">
                   <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mask-fade-sides">
                      {quickReplies.map((q, i) => ( 
                          <motion.button 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            key={i} 
                            onClick={() => { setInput(q); handleTranslate(q); }} 
                            className="whitespace-nowrap px-4 py-2 bg-white/90 backdrop-blur-sm border border-indigo-100 text-indigo-900 rounded-full text-xs font-bold shadow-lg shadow-indigo-100/50 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                              <Sparkles size={12} className="text-indigo-500"/> {q}
                          </motion.button> 
                        ))}
                   </div>
               </div>
           )}

           {/* 底部输入面板 */}
           <div className="bg-white/85 backdrop-blur-2xl border-t border-slate-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] rounded-t-[2rem]">
              <div className="relative group">
                <textarea 
                    ref={textareaRef} 
                    value={input} 
                    onChange={e=>setInput(e.target.value)} 
                    placeholder={isListening ? "正在聆听..." : "输入内容..."} 
                    className={`w-full bg-slate-100/80 border border-transparent rounded-[1.5rem] p-4 pr-12 resize-none min-h-[3.5rem] text-base font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 ring-indigo-500/20 focus:border-indigo-200 transition-all placeholder:text-slate-400 ${isListening ? 'bg-indigo-50/50 ring-indigo-500/30' : ''}`}
                    rows={1} 
                />
                
                {input ? (
                    <button onClick={()=>setInput('')} className="absolute top-3 right-3 p-1.5 bg-slate-200 text-slate-500 rounded-full hover:bg-rose-500 hover:text-white transition-all active:scale-90">
                        <X size={16}/>
                    </button>
                ) : (
                    <div className="absolute top-4 right-4 text-slate-300 pointer-events-none">
                        <ArrowRightLeft size={16} className="rotate-90"/>
                    </div>
                )}
              </div>

              {/* 操作按钮栏 */}
              <div className="flex gap-3 mt-3 h-[3.5rem]">
                 {/* 左侧：独立的识别语言切换按钮 */}
                 <button 
                    onClick={() => { setSelectorType('source'); setShowLangSelector(true); }}
                    className="h-full aspect-square rounded-2xl bg-slate-100 text-slate-600 flex flex-col items-center justify-center gap-0.5 border border-slate-200 active:scale-95 transition-all hover:bg-slate-200"
                    title="切换识别语言"
                 >
                    <Globe size={18} />
                    <span className="text-[10px] font-bold">{getSourceLabel().split(' ')[1]}</span>
                 </button>

                 {/* 右侧：主操作按钮 */}
                 <button 
                    onClick={input.trim() ? () => handleTranslate() : toggleListening}
                    disabled={loading}
                    className={`relative flex-1 rounded-2xl flex items-center justify-center gap-2 font-bold text-white shadow-lg transition-all active:scale-95 overflow-hidden
                        ${input.trim() 
                            ? 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700' 
                            : (isListening ? 'bg-rose-500 shadow-rose-200' : 'bg-slate-900 shadow-slate-300 hover:bg-slate-800')
                        }
                    `}
                 >
                    {loading ? (
                        <Loader2 className="animate-spin"/> 
                    ) : (
                        input.trim() ? (
                            <><Send size={20}/> 翻译</>
                        ) : (
                            <><Mic size={22} className={isListening ? 'animate-bounce' : ''}/> {isListening ? '停止识别' : '按住说话'}</>
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
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring", damping: 25, stiffness: 300}} className="w-full bg-white rounded-t-[2.5rem] p-6 max-h-[75vh] flex flex-col pb-safe" onClick={e=>e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 shrink-0"></div>
                <h3 className="text-lg font-black text-slate-800 mb-4 text-center shrink-0">
                    选择{selectorType === 'source' ? '识别语言' : '目标语言'}
                </h3>
                
                <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pb-4">
                    {(selectorType === 'source' ? SOURCE_LANGUAGES : TARGET_LANGUAGES).map(lang => {
                        const isSelected = (selectorType === 'source' ? sourceLang : targetLang) === lang.code;
                        return (
                            <button 
                                key={lang.code}
                                onClick={() => selectLanguage(lang.code)}
                                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'}`}
                            >
                                <span className="font-bold text-sm">{lang.label}</span>
                                {isSelected && <Check size={16} />}
                            </button>
                        );
                    })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 弹窗：系统设置 --- */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full sm:w-[90%] sm:max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 pb-safe" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">系统偏好</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">PRO SETTINGS</p>
                  </div>
                  <button onClick={()=>setShowSettings(false)} className="bg-slate-100 text-slate-500 p-3 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-3xl"> 
                      <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-sm">自动发送翻译</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">语音输入结束后立即提交</span>
                      </div>
                      <input type="checkbox" checked={autoSend} onChange={e=>{setAutoSend(e.target.checked); localStorage.setItem('tr_auto_send', e.target.checked)}} className="w-6 h-6 accent-indigo-600 rounded-md" /> 
                  </div>
                  
                  <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl shadow-slate-900/20">
                    <div className="flex justify-between items-center mb-6"> 
                        <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">API Configuration</label> 
                        <a href="https://iflow.cn/" target="_blank" rel="noreferrer" className="text-[10px] text-white/50 font-bold flex items-center gap-1 hover:text-white transition-colors">获取 Key <ExternalLink size={10}/></a> 
                    </div>
                    
                    <div className="space-y-3">
                        <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key (sk-...)" className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-mono outline-none focus:bg-white/10 focus:border-indigo-500 transition-all placeholder:text-white/10" />
                        <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="API URL" className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-mono outline-none focus:bg-white/10 focus:border-indigo-500 transition-all placeholder:text-white/10" />
                        <div className="relative pt-2">
                             <select value={model} onChange={e=>{setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full py-3 px-4 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer hover:bg-indigo-500 transition-colors text-center">
                                <option value="deepseek-v3.2">DeepSeek V3.2 (推荐)</option>
                                <option value="qwen3-235b">Qwen3 235B</option>
                                <option value="gpt-4o">GPT-4o (OpenAI)</option>
                            </select>
                        </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style jsx global>{`
        /* 核心：隐藏滚动条但保留功能 */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* 自定义滚动条样式 (如果需要显示时启用) */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

        /* 渐变遮罩 */
        .mask-fade-sides {
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        /* 核心：iOS 安全区域适配 */
        .pb-safe {
            padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
}
