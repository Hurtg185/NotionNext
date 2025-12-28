import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronDown,
  ExternalLink, Sparkles, ArrowRightLeft,
  Loader2, Star, Languages, Check
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

  // 语言设置
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');

  // 配置与弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false); // 控制顶部语言切换弹窗
  const [selectorType, setSelectorType] = useState('target'); // 'source' or 'target'
  const [showMicMenu, setShowMicMenu] = useState(false); // 长按麦克风弹窗

  // 用户配置
  const [autoSend, setAutoSend] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  // Refs
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const longPressTimerRef = useRef(null); // 用于长按检测

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

  useEffect(() => {
    if (!isListening && autoSend && input.trim().length > 1 && !loading) {
      // 稍微延迟一下，防止识别还在修正中就发送了
      const timer = setTimeout(() => handleTranslate(), 800);
      return () => clearTimeout(timer);
    }
  }, [isListening]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // --- 核心逻辑 ---

  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim() || loading) return;

    setLoading(true);
    // 不清空 results，为了保留上次结果直到新结果出来，体验更好，或者可以选择清空
    // setResults([]); 
    setQuickReplies([]);

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
      if (data.results) {
        setResults(data.results.sort((a,b) => (b.recommended?1:0) - (a.recommended?1:0)));
        setQuickReplies(data.quick_replies || []);
      }
    } catch (e) {
      alert(`发生错误: ${e.message}`);
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
      // 根据 sourceLang 设定识别语言，如果是 auto 则默认中文或上一次的选择
      const currentSourceObj = SOURCE_LANGUAGES.find(l => l.code === sourceLang);
      recognitionRef.current.lang = currentSourceObj?.voice || 'zh-CN'; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // 长按逻辑
  const handleMicDown = (e) => {
    // 防止右键菜单
    if (e.type === 'contextmenu') e.preventDefault();
    
    longPressTimerRef.current = setTimeout(() => {
      // 长按触发：显示语言选择菜单
      if ('vibrate' in navigator) navigator.vibrate(50);
      setShowMicMenu(true);
      longPressTimerRef.current = null;
    }, 600); // 600ms 长按
  };

  const handleMicUp = (e) => {
    if (longPressTimerRef.current) {
      // 如果定时器还存在，说明是短按
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (!showMicMenu) {
        toggleListening();
      }
    }
  };

  const speak = (text) => {
    if (typeof window === 'undefined') return;
    const currentTargetObj = TARGET_LANGUAGES.find(l => l.code === targetLang);
    // 默认回退
    const voice = currentTargetObj?.voice || 'en-US-JennyNeural';
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-10`;
    const audio = new Audio(url);
    audio.play().catch(e => console.error("TTS Play Error", e));
  };

  const swapLanguages = () => {
    if (sourceLang === 'auto') return; // auto 模式下不建议互换
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

  // 获取当前语言显示的 Label
  const getSourceLabel = () => SOURCE_LANGUAGES.find(l => l.code === sourceLang)?.label || sourceLang;
  const getTargetLabel = () => TARGET_LANGUAGES.find(l => l.code === targetLang)?.label || targetLang;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head><title>AI 翻译官 Pro</title></Head>

      <div className="flex flex-col h-[100dvh] max-w-md mx-auto relative overflow-hidden bg-white sm:shadow-2xl sm:rounded-[2.5rem] sm:my-4 sm:h-[calc(100vh-2rem)] sm:border border-slate-200">
        
        {/* --- 顶部紧凑导航栏 --- */}
        <header className="absolute top-0 left-0 right-0 z-40 p-4 flex justify-between items-start pointer-events-none">
          <Link href="/">
            <a className="pointer-events-auto p-2 bg-white/80 backdrop-blur-md shadow-sm border border-white/50 rounded-full text-slate-600 hover:bg-white hover:text-indigo-600 transition-all active:scale-95">
              <Languages size={20} />
            </a>
          </Link>

          {/* 语言切换胶囊 (核心折叠设计) */}
          <div className="pointer-events-auto flex flex-col items-center gap-2 mt-1">
             <button 
                onClick={() => { setSelectorType('target'); setShowLangSelector(true); }}
                className="flex items-center gap-2 bg-white/90 backdrop-blur-xl shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] border border-slate-100 rounded-full px-1 py-1 pr-4 transition-all active:scale-95 hover:shadow-lg"
             >
                <div className="flex items-center">
                    <span 
                      onClick={(e) => { e.stopPropagation(); setSelectorType('source'); setShowLangSelector(true); }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    >
                        {getSourceLabel().split(' ')[1]}
                    </span>
                    
                    <div onClick={(e) => { e.stopPropagation(); swapLanguages(); }} className="p-1.5 rounded-full hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors cursor-pointer">
                        <ArrowRightLeft size={14} />
                    </div>

                    <span className="px-2 text-sm font-black text-indigo-900 flex items-center gap-1">
                        {getTargetLabel().split(' ')[1]}
                        <ChevronDown size={12} className="opacity-50" />
                    </span>
                </div>
             </button>
          </div>

          <button onClick={()=>setShowSettings(true)} className="pointer-events-auto p-2 bg-white/80 backdrop-blur-md shadow-sm border border-white/50 rounded-full text-slate-600 hover:bg-white hover:text-indigo-600 transition-all active:scale-95">
            <Settings size={20} />
          </button>
        </header>

        {/* --- 主内容区：翻译结果 --- */}
        <main className="flex-1 overflow-y-auto px-4 pt-24 pb-48 custom-scrollbar space-y-5">
            
            {/* 等待状态 */}
            {results.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 mt-10 pointer-events-none select-none">
                <BrainCircuit size={100} className="text-slate-300 mb-6" strokeWidth={1} />
                <p className="font-black text-slate-400 text-sm tracking-widest uppercase">Waiting for input</p>
              </div>
            )}

            {/* 加载中 */}
            {loading && (
                <div className="flex flex-col items-center gap-4 py-12">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                        <Loader2 size={32} className="animate-spin text-indigo-600 relative z-10" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 animate-pulse">AI 正在思考...</span>
                </div>
            )}

            {/* 结果卡片列表 */}
            <AnimatePresence mode='popLayout'>
              {results.map((item, idx) => (
                <motion.div 
                    key={`${idx}-${item.label}`}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", bounce: 0.3, delay: idx * 0.1 }}
                    className={`relative overflow-hidden group rounded-[1.5rem] border transition-all duration-300 ${
                        item.recommended 
                        ? 'bg-white border-indigo-100 shadow-[0_10px_40px_-10px_rgba(79,70,229,0.15)]' 
                        : 'bg-slate-50 border-slate-100'
                    }`}
                >
                  {/* 卡片高亮装饰 */}
                  {item.recommended && <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-100 to-transparent opacity-50 rounded-bl-[4rem] -mr-4 -mt-4 pointer-events-none"/>}

                  <div className="p-5 relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <div className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                          item.recommended ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-md' : 'bg-slate-200 text-slate-500'
                      }`}>
                          {item.label}
                      </div>
                      <div className="flex gap-1">
                          {item.recommended && <Star size={14} className="text-amber-400 fill-amber-400" />}
                      </div>
                    </div>

                    <p className="text-[1.05rem] font-medium text-slate-800 leading-relaxed tracking-wide select-all whitespace-pre-wrap">
                        {item.translation}
                    </p>

                    <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100 mobile-actions-visible">
                      <button onClick={()=>speak(item.translation)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-colors active:scale-90">
                          <Volume2 size={18}/>
                      </button>
                      <button onClick={()=>{ if(navigator.clipboard) navigator.clipboard.writeText(item.translation) }} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-emerald-100 hover:text-emerald-600 transition-colors active:scale-90">
                          <Copy size={18}/>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
        </main>
        
        {/* --- 底部悬浮区：快捷回复 & 输入框 --- */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
           
           {/* 快捷回复胶囊 (悬浮在输入框上方) */}
           <div className="px-4 mb-4">
               <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mask-fade-sides">
                  {quickReplies.map((q, i) => ( 
                      <motion.button 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        key={i} 
                        onClick={() => { setInput(q); handleTranslate(q); }} 
                        className="whitespace-nowrap px-4 py-2 bg-white/90 backdrop-blur-sm border border-indigo-100 text-indigo-900 rounded-full text-xs font-bold shadow-lg shadow-indigo-100/50 active:scale-95 transition-all flex items-center gap-1.5 hover:bg-indigo-50"
                      >
                          <Sparkles size={12} className="text-indigo-500"/> {q}
                      </motion.button> 
                    ))}
               </div>
           </div>

           {/* 底部输入面板 */}
           <div className="bg-white/80 backdrop-blur-xl border-t border-slate-100 p-4 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[2rem]">
              <div className="relative group">
                <textarea 
                    ref={textareaRef} 
                    value={input} 
                    onChange={e=>setInput(e.target.value)} 
                    placeholder={isListening ? "正在聆听..." : "输入要翻译的内容..."} 
                    className={`w-full bg-slate-100/80 border border-transparent rounded-[1.5rem] p-4 pr-12 resize-none min-h-[3.5rem] max-h-[150px] text-base font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 ring-indigo-500/20 focus:border-indigo-200 transition-all placeholder:text-slate-400 ${isListening ? 'bg-indigo-50/50 ring-indigo-500/30' : ''}`}
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
                 {/* 麦克风按钮 (带长按逻辑) */}
                 <button 
                    onMouseDown={handleMicDown} onMouseUp={handleMicUp} onMouseLeave={handleMicUp}
                    onTouchStart={handleMicDown} onTouchEnd={handleMicUp} onContextMenu={(e)=>e.preventDefault()}
                    disabled={loading}
                    className={`relative flex-1 rounded-2xl flex items-center justify-center gap-2 font-bold text-white shadow-lg transition-all active:scale-95 select-none overflow-hidden
                        ${isListening ? 'bg-rose-500 shadow-rose-200' : 'bg-slate-900 shadow-slate-300 hover:bg-slate-800'}
                    `}
                 >
                    {isListening && <span className="absolute inset-0 bg-white/20 animate-pulse-fast"></span>}
                    <Mic size={22} className={isListening ? 'animate-bounce' : ''}/>
                    <span>{isListening ? '松开结束' : (input.trim() ? '语音输入' : '按住说话')}</span>
                    {/* 长按提示小条 */}
                    {!isListening && !loading && <span className="absolute bottom-1 w-8 h-1 bg-white/20 rounded-full"></span>}
                 </button>

                 {/* 发送按钮 */}
                 {input.trim() && (
                     <motion.button 
                        initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }}
                        onClick={() => handleTranslate()} 
                        disabled={loading}
                        className="px-6 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95 transition-all hover:bg-indigo-700"
                     >
                        {loading ? <Loader2 className="animate-spin"/> : <Send size={20}/>}
                     </motion.button>
                 )}
              </div>
           </div>
        </div>

        {/* --- 弹窗：语言选择器 (Bottom Sheet) --- */}
        <AnimatePresence>
          {showLangSelector && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end" onClick={()=>setShowLangSelector(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring", damping: 25, stiffness: 300}} className="w-full bg-white rounded-t-[2.5rem] p-6 max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                <h3 className="text-lg font-black text-slate-800 mb-4 text-center">
                    选择{selectorType === 'source' ? '源语言' : '目标语言'}
                </h3>
                
                <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-8 custom-scrollbar">
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

        {/* --- 弹窗：麦克风长按菜单 --- */}
        <AnimatePresence>
            {showMicMenu && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={()=>setShowMicMenu(false)}>
                    <motion.div initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white rounded-[2rem] p-6 w-[80%] max-w-[300px] shadow-2xl" onClick={e=>e.stopPropagation()}>
                        <h4 className="text-center font-black text-slate-800 mb-4">识别语言设置</h4>
                        <div className="space-y-2">
                            {SOURCE_LANGUAGES.filter(l => l.code !== 'auto').map(lang => (
                                <button 
                                    key={lang.code}
                                    onClick={() => { setSourceLang(lang.code); setShowMicMenu(false); }}
                                    className={`w-full p-4 rounded-xl font-bold flex items-center justify-between transition-all ${sourceLang === lang.code ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {lang.label}
                                    {sourceLang === lang.code && <Mic size={16} className="fill-indigo-600"/>}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* --- 弹窗：系统设置 --- */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full sm:w-[90%] sm:max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8" onClick={e=>e.stopPropagation()}>
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
                        <div className="relative">
                            <span className="absolute top-3 left-4 text-xs font-bold text-white/30">KEY</span>
                            <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="sk-xxxxxxxx" className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-mono outline-none focus:bg-white/10 focus:border-indigo-500 transition-all placeholder:text-white/10" />
                        </div>
                        <div className="relative">
                            <span className="absolute top-3 left-4 text-xs font-bold text-white/30">URL</span>
                            <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="API Endpoint" className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-mono outline-none focus:bg-white/10 focus:border-indigo-500 transition-all placeholder:text-white/10" />
                        </div>
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .mask-fade-sides {
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        @media (max-width: 640px) {
            .mobile-actions-visible { opacity: 1 !important; }
        }
        
        .animate-pulse-fast { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}
