import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronLeft,
  ExternalLink, Sparkles,
  Loader2, Star, ChevronDown, ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import Link from 'next/link';

const SOURCE_LANGUAGES = [
  { code: 'auto', label: '🤖 自动检测' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'en', label: '🇺🇸 英文' },
];

const TARGET_LANGUAGES = [
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'en', label: '🇺🇸 英文' },
  { code: 'th', label: '🇹🇭 泰文' },
  { code: 'vi', label: '🇻🇳 越南' },
];

const RECOGNITION_LANGUAGES = [
  { code: 'auto', label: '🤖 自动' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'en', label: '🇺🇸 英文' },
];

export default function TranslatorUI() {
  const [mounted, setMounted] = useState(false);
  // 核心修复：使用动态计算的视口高度
  const [viewportHeight, setViewportHeight] = useState('100vh');
  
  const [showSettings, setShowSettings] = useState(false);
  const [showMicLangMenu, setShowMicLangMenu] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');
  const [autoSend, setAutoSend] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      // 初始化本地存储配置
      setApiKey(localStorage.getItem('tr_api_key') || '');
      setAutoSend(localStorage.getItem('tr_auto_send') !== 'false');
      setModel(localStorage.getItem('tr_model') || 'deepseek-v3.2');
      setApiUrl(localStorage.getItem('tr_api_url') || 'https://apis.iflow.cn/v1');
      setSourceLang(localStorage.getItem('tr_src') || 'auto');
      setTargetLang(localStorage.getItem('tr_tar') || 'my');

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        rec.onresult = (e) => setInput(Array.from(e.results).map(r => r[0].transcript).join(''));
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }

      // --- 核心修复：监听 resize 事件动态调整高度 ---
      const handleResize = () => {
        setViewportHeight(`${window.innerHeight}px`);
      };
      window.addEventListener('resize', handleResize);
      handleResize(); // 初始化
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // 监听输入自动发送
  useEffect(() => {
    if (!isListening && autoSend && input.trim().length > 1 && !loading) {
      // 简单的防抖逻辑可以加在这里，目前直接发送
    }
  }, [isListening]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, loading, quickReplies]);

  // 输入框高度自适应
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);
  
  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim() || loading) return;

    setLoading(true);
    setResults([]);
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
  
  const startListening = () => {
    if (!recognitionRef.current) return alert('当前浏览器不支持语音识别');
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      const recognitionLangMap = { zh: 'zh-CN', en: 'en-US', my: 'my-MM'};
      recognitionRef.current.lang = recognitionLangMap[sourceLang] || 'zh-CN'; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleMicPressStart = () => {
    isLongPress.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setShowMicLangMenu(true);
    }, 500);
  };

  const handleMicPressEnd = () => {
    clearTimeout(longPressTimerRef.current);
    if (!isLongPress.current) {
      startListening();
    }
  };

  const speak = (text) => {
    if (typeof window === 'undefined') return;
    const voiceMap = { my: 'my-MM-NilarNeural', zh: 'zh-CN-XiaoxiaoNeural', en: 'en-US-JennyNeural' };
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voiceMap[targetLang] || 'my-MM-NilarNeural'}&r=-10`;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  if (!mounted) return null;

  const currentSource = SOURCE_LANGUAGES.find(l => l.code === sourceLang) || SOURCE_LANGUAGES[0];
  const currentTarget = TARGET_LANGUAGES.find(l => l.code === targetLang) || TARGET_LANGUAGES[0];

  return (
    <div 
      style={{ height: viewportHeight }} 
      className="bg-slate-50 text-slate-900 font-sans w-full flex flex-col overflow-hidden"
    >
      <Head>
          <title>AI 翻译官 Pro</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* --- Header (Flex Item: 固定高度) --- */}
      <header className="shrink-0 flex justify-between items-center p-4 bg-white/80 backdrop-blur border-b border-slate-200 z-10">
        <Link href="/">
            <a className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronLeft /></a>
        </Link>
        <div className="text-center">
          <div className="font-black text-slate-800 text-sm">智能翻译官 Pro</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Engine v3.2</div>
        </div>
        <div className="w-10"></div> {/* 占位符保持居中 */}
      </header>
      
      {/* --- Main Content (Flex Item: 自动伸缩，内部滚动) --- */}
      <main ref={scrollRef} className="flex-1 w-full overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50">
        <AnimatePresence>
          {results.length === 0 && !loading && (
             <div className="flex flex-col items-center justify-center h-full opacity-30 pb-20">
                <BrainCircuit size={60} strokeWidth={1.5} />
                <p className="mt-4 font-black uppercase tracking-widest text-xs">Waiting for Input</p>
             </div>
          )}

          {results.map((item, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
              key={idx} 
              className={`p-5 rounded-[2rem] border transition-all ${item.recommended ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 shadow-sm'}`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${item.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.label}</span>
                {item.recommended && <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600"><Star size={10} fill="currentColor"/> BEST</div>}
              </div>
              <p className="text-lg font-medium text-slate-800 leading-relaxed whitespace-pre-wrap select-text">{item.translation}</p>
              <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-50">
                <button onClick={()=>speak(item.translation)} className="p-2 bg-slate-50 text-slate-500 rounded-full active:bg-indigo-50 active:text-indigo-600 transition-colors"><Volume2 size={18}/></button>
                <button onClick={()=>{ if(typeof navigator !== 'undefined') navigator.clipboard.writeText(item.translation) }} className="p-2 bg-slate-50 text-slate-500 rounded-full active:bg-green-50 active:text-green-600 transition-colors"><Copy size={18}/></button>
              </div>
            </motion.div>
          ))}

          {loading && ( 
            <div className="flex flex-col items-center justify-center py-10 gap-2"> 
                <Loader2 size={30} className="animate-spin text-indigo-600" /> 
                <p className="text-[10px] font-bold text-slate-400 animate-pulse uppercase">AI Processing...</p> 
            </div> 
          )}
        </AnimatePresence>
      </main>

      {/* --- Footer (Flex Item: 固定高度，绝对不会被遮挡) --- */}
      <footer className="shrink-0 bg-white border-t border-slate-200 z-20 pb-safe shadow-[0_-5px_30px_rgba(0,0,0,0.04)]">
        
        {/* 联想词 (嵌入在 Footer 内部) */}
        <AnimatePresence>
            {quickReplies.length > 0 && (
                <motion.div initial={{height:0}} animate={{height:'auto'}} className="overflow-hidden bg-slate-50 border-b border-slate-100">
                   <div className="flex gap-2 overflow-x-auto no-scrollbar p-3">
                      {quickReplies.map((q, i) => ( 
                          <button key={i} onClick={() => { setInput(q); handleTranslate(q); }} className="whitespace-nowrap px-4 py-1.5 bg-white text-indigo-600 rounded-full text-xs font-bold shadow-sm border border-indigo-100 active:scale-95 transition-all flex items-center gap-1">
                              <Sparkles size={10}/> {q}
                          </button> 
                      ))}
                   </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="p-3 space-y-3">
          
          {/* 语言选择栏 */}
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowLangPicker(showLangPicker === 'src' ? null : 'src')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex justify-center items-center gap-1 transition-colors ${showLangPicker === 'src' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
                {currentSource.label} <ChevronDown size={12}/>
            </button>
            <button 
                onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
                className="p-2 bg-slate-50 text-slate-400 rounded-lg border border-slate-100 active:rotate-180 transition-transform"
            >
                <ArrowLeftRight size={14} />
            </button>
            <button 
                onClick={() => setShowLangPicker(showLangPicker === 'tar' ? null : 'tar')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex justify-center items-center gap-1 transition-colors ${showLangPicker === 'tar' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
                {currentTarget.label} <ChevronDown size={12}/>
            </button>
          </div>

          {/* 展开的语言列表 */}
          <AnimatePresence>
            {showLangPicker && (
                <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl mb-2">
                        {(showLangPicker === 'src' ? SOURCE_LANGUAGES : TARGET_LANGUAGES).map(lang => (
                            <button 
                                key={lang.code}
                                onClick={() => {
                                    if(showLangPicker==='src') { setSourceLang(lang.code); localStorage.setItem('tr_src', lang.code); }
                                    else { setTargetLang(lang.code); localStorage.setItem('tr_tar', lang.code); }
                                    setShowLangPicker(false);
                                }}
                                className="py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-sm"
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
          </AnimatePresence>

          {/* 输入交互区 (Settings | Input | Action) */}
          <div className="flex items-end gap-2">
            <button onClick={()=>setShowSettings(true)} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors">
                <Settings size={20}/>
            </button>
            
            <div className="relative flex-1">
              <textarea 
                  ref={textareaRef} 
                  value={input} 
                  onChange={e=>setInput(e.target.value)} 
                  placeholder={isListening ? "Listening..." : "输入文本..."} 
                  className={`w-full bg-slate-100 rounded-[1.2rem] px-4 py-3 pr-10 text-base font-medium outline-none transition-all resize-none max-h-32 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 border border-transparent ${isListening ? 'bg-rose-50 ring-2 ring-rose-200' : ''}`} 
                  rows={1} 
              />
              {input && <button onClick={()=>setInput('')} className="absolute top-3 right-3 text-slate-300 hover:text-slate-500"><X size={16}/></button>}
            </div>

            <div className="shrink-0">
               {input.trim() ? (
                  <button onClick={() => handleTranslate()} disabled={loading} className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-90 transition-all">
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                  </button>
               ) : (
                  <button 
                    onMouseDown={handleMicPressStart}
                    onMouseUp={handleMicPressEnd}
                    onTouchStart={handleMicPressStart}
                    onTouchEnd={handleMicPressEnd}
                    className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-90 shadow-lg ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-rose-200' : 'bg-slate-800 text-white shadow-slate-300'}`}
                  >
                    <Mic size={22}/>
                  </button>
               )}
            </div>
          </div>
        </div>
      </footer>

      {/* --- Settings Modal --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end" onClick={()=>setShowSettings(false)}>
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-[2.5rem] p-6 pb-10" onClick={e=>e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"/>
              <div className="flex justify-between items-center mb-6 px-2">
                <h3 className="text-xl font-black text-indigo-900">配置中心</h3>
                <button onClick={()=>setShowSettings(false)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"> 
                    <div className="font-bold text-slate-700 text-sm">自动发送语音</div> 
                    <input type="checkbox" checked={autoSend} onChange={e=>{setAutoSend(e.target.checked); localStorage.setItem('tr_auto_send', e.target.checked)}} className="w-5 h-5 accent-indigo-600" /> 
                </div>
                <div className="p-5 bg-slate-900 rounded-[2rem] text-white space-y-3 shadow-xl">
                  <div className="flex justify-between items-center"> <label className="text-[10px] font-black text-slate-500 uppercase">API Key</label> <a href="https://iflow.cn/" className="text-[10px] text-blue-400 font-bold flex gap-1">Get Key <ExternalLink size={10}/></a> </div>
                  <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="sk-..." className="w-full bg-white/10 border-0 rounded-xl p-3 text-sm font-mono outline-none" />
                  <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="API URL" className="w-full bg-white/10 border-0 rounded-xl p-3 text-sm font-mono outline-none" />
                  <select value={model} onChange={e=>{setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full bg-indigo-600 p-3 rounded-xl text-sm font-bold outline-none text-center">
                    <option value="deepseek-v3.2">DeepSeek V3.2</option>
                    <option value="qwen3-235b">Qwen3 235B</option>
                  </select>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Mic Language Modal --- */}
      <AnimatePresence>
        {showMicLangMenu && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8" onClick={()=>setShowMicLangMenu(false)}>
                <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white rounded-[2rem] p-5 w-full max-w-xs shadow-2xl" onClick={e=>e.stopPropagation()}>
                    <h4 className="text-xs font-black text-slate-400 mb-4 text-center uppercase tracking-widest">语音识别语言</h4>
                    <div className="grid gap-2">
                        {RECOGNITION_LANGUAGES.map(lang => (
                            <button key={lang.code} onClick={() => { setSourceLang(lang.code); setShowMicLangMenu(false); }} className={`p-3 rounded-xl text-sm font-bold transition-colors ${sourceLang === lang.code ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-700'}`}>
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 0px; display: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}
