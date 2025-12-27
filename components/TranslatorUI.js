import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit,
  Loader2, Star, Sparkles, ChevronDown, 
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';

// 语言配置
const ALL_LANGUAGES = [
  { code: 'auto', label: '🤖 自动检测' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'my', label: '🇲🇲 缅文' },
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
  const [showSettings, setShowSettings] = useState(false);
  const [showMicLangMenu, setShowMicLangMenu] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false); // 'src' | 'tar' | null
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');

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
      setApiKey(localStorage.getItem('tr_api_key') || '');
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
    }
  }, []);

  // 翻译结果出来后自动滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, loading]);

  // 输入框自适应高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      if (data.results) {
        setResults(data.results.sort((a,b) => (b.recommended?1:0) - (a.recommended?1:0)));
        setQuickReplies(data.quick_replies || []);
      }
    } catch (e) {
      alert(`错误: ${e.message}`);
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
      const recognitionLangMap = { zh: 'zh-CN', en: 'en-US', my: 'my-MM' };
      recognitionRef.current.lang = recognitionLangMap[sourceLang] || 'zh-CN'; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleMicPressStart = (e) => {
    // 阻止默认行为防止触发浏览器的上下文菜单
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
    const cleanedText = text.replace(/\*/g, ''); 
    const voiceMap = { my: 'my-MM-NilarNeural', zh: 'zh-CN-XiaoxiaoNeural', en: 'en-US-JennyNeural' };
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${voiceMap[targetLang] || 'my-MM-NilarNeural'}&r=-10`;
    new Audio(url).play().catch(() => {});
  };

  const copyToClipboard = (text) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text.replace(/\*/g, ''));
    }
  };

  if (!mounted) return null;

  const currentSource = ALL_LANGUAGES.find(l => l.code === sourceLang) || ALL_LANGUAGES[0];
  const currentTarget = ALL_LANGUAGES.find(l => l.code === targetLang) || ALL_LANGUAGES[2];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Head>
        <title>AI 翻译官 Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* 顶部状态条 */}
      <div className="shrink-0 pt-safe bg-white border-b border-slate-100 flex justify-between items-center px-6 py-3 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">AI Neural Link</span>
        </div>
        <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-tighter">v3.2.0 Build</div>
      </div>

      {/* 聊天记录/结果区域 */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50">
        <AnimatePresence>
          {results.length === 0 && !loading && (
            <motion.div initial={{opacity:0}} animate={{opacity:0.15}} className="flex flex-col items-center justify-center h-full grayscale py-20">
              <BrainCircuit size={100} strokeWidth={1} />
              <p className="mt-4 font-black uppercase tracking-[0.3em] text-[10px]">READY FOR COMMAND</p>
            </motion.div>
          )}

          {results.map((item, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              key={idx} 
              className={`p-5 rounded-[2.5rem] border shadow-sm ${item.recommended ? 'bg-white border-indigo-200 ring-4 ring-indigo-500/5' : 'bg-slate-100/80 border-transparent'}`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${item.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {item.label}
                </span>
                {item.recommended && (
                  <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600">
                    <Star size={12} fill="currentColor" /> RECOMMENDED
                  </div>
                )}
              </div>
              <p className="text-lg font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                {item.translation}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => speak(item.translation)} className="p-3 bg-white border border-slate-100 rounded-2xl active:bg-slate-50 transition-colors text-slate-500 shadow-sm">
                  <Volume2 size={20}/>
                </button>
                <button onClick={() => copyToClipboard(item.translation)} className="p-3 bg-white border border-slate-100 rounded-2xl active:bg-slate-50 transition-colors text-slate-500 shadow-sm">
                  <Copy size={20}/>
                </button>
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Computing...</p>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* 底部操作区：强制收缩为 0 保证不被挤压 */}
      <footer className="shrink-0 bg-white border-t border-slate-200 z-[100] pb-safe shadow-[0_-15px_40px_rgba(0,0,0,0.05)]">
        
        {/* 联想词 */}
        <AnimatePresence>
          {quickReplies.length > 0 && (
            <motion.div initial={{height:0}} animate={{height:'auto'}} className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar bg-slate-50/50 border-b border-slate-100">
              {quickReplies.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); handleTranslate(q); }} className="whitespace-nowrap px-4 py-2 bg-white text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
                  <Sparkles size={12}/> {q}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          
          {/* 语言选择面板 (输入框上方) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowLangPicker(showLangPicker === 'src' ? null : 'src')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-tighter transition-all ${showLangPicker === 'src' ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
              >
                {currentSource.label} <ChevronDown size={14} className={showLangPicker === 'src' ? 'rotate-180' : ''} />
              </button>

              <button 
                onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
                className="p-2.5 text-slate-400 bg-slate-50 rounded-full border border-slate-100 active:rotate-180 transition-transform duration-500 shadow-sm"
              >
                <ArrowLeftRight size={16} />
              </button>

              <button 
                onClick={() => setShowLangPicker(showLangPicker === 'tar' ? null : 'tar')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-tighter transition-all ${showLangPicker === 'tar' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-500'}`}
              >
                {currentTarget.label} <ChevronDown size={14} className={showLangPicker === 'tar' ? 'rotate-180' : ''} />
              </button>
            </div>

            <AnimatePresence>
              {showLangPicker && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 p-2 bg-slate-100 rounded-[1.5rem] border border-slate-200/50 mt-1">
                    {ALL_LANGUAGES.map(lang => (
                      <button 
                        key={lang.code}
                        onClick={() => {
                          if (showLangPicker === 'src') setSourceLang(lang.code);
                          else setTargetLang(lang.code);
                          setShowLangPicker(null);
                        }}
                        className="py-3 text-[11px] font-bold bg-white border border-slate-200/60 rounded-xl active:bg-indigo-50 active:border-indigo-200 transition-colors"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 三段式主交互栏 */}
          <div className="flex items-end gap-3">
            {/* 1. 设置按钮 */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-4 bg-slate-100 text-slate-500 rounded-full active:scale-90 transition-all border border-slate-200/50 shadow-sm shrink-0"
            >
              <Settings size={22} />
            </button>

            {/* 2. 输入框 */}
            <div className="relative flex-1">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "Type anything..."}
                rows={1}
                className={`w-full bg-slate-100 rounded-[1.8rem] px-5 py-4 pr-12 text-base font-medium outline-none transition-all resize-none max-h-40 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 border border-transparent focus:border-slate-200 ${isListening ? 'ring-4 ring-rose-500/10 bg-rose-50/30' : ''}`}
              />
              {input && (
                <button onClick={() => setInput('')} className="absolute right-4 bottom-4 text-slate-300 hover:text-slate-500 p-1">
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 3. 智能按钮 */}
            <div className="shrink-0">
              <AnimatePresence mode="wait">
                {input.trim() ? (
                  <motion.button 
                    key="send"
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                    onClick={() => handleTranslate()}
                    disabled={loading}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-200 active:scale-95 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={24}/> : <Send size={24}/>}
                  </motion.button>
                ) : (
                  <motion.button 
                    key="mic"
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                    onMouseDown={handleMicPressStart}
                    onMouseUp={handleMicPressEnd}
                    onTouchStart={handleMicPressStart}
                    onTouchEnd={handleMicPressEnd}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-rose-200' : 'bg-slate-900 text-white active:scale-95 shadow-slate-300'}`}
                  >
                    <Mic size={26} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </footer>

      {/* 设置面板 (底部抽屉) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="w-full bg-white rounded-t-[3rem] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-slate-800 tracking-tighter">PREFERENCES</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white space-y-4 shadow-2xl">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">API Key</label>
                    <input type="password" value={apiKey} onChange={e => {setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="sk-xxxx" className="w-full bg-white/10 border-0 rounded-2xl p-4 text-sm font-mono outline-none focus:ring-2 ring-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Endpoint URL</label>
                    <input type="text" value={apiUrl} onChange={e => {setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="https://..." className="w-full bg-white/10 border-0 rounded-2xl p-4 text-sm font-mono outline-none focus:ring-2 ring-white/20" />
                  </div>
                  <select value={model} onChange={e => {setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full bg-white/10 border-0 rounded-2xl p-4 text-sm font-bold outline-none appearance-none cursor-pointer">
                    <option value="deepseek-v3.2">DeepSeek V3.2 (Recommended)</option>
                    <option value="qwen3-235b">Qwen3 235B Pro</option>
                  </select>
                </div>
              </div>
              <div className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] pb-4">AI Link Pro v3.2</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 识别语言快捷菜单 (长按弹出) */}
      <AnimatePresence>
        {showMicLangMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[210] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowMicLangMenu(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-xs bg-white rounded-[2.5rem] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h4 className="text-xs font-black text-slate-400 mb-6 px-2 uppercase tracking-[0.2em]">Voice Input Language</h4>
              <div className="space-y-2">
                {RECOGNITION_LANGUAGES.map(lang => (
                  <button 
                    key={lang.code}
                    onClick={() => { setSourceLang(lang.code); setShowMicLangMenu(false); }}
                    className={`w-full text-left p-4 rounded-2xl text-sm font-bold transition-all ${sourceLang === lang.code ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowMicLangMenu(false)} className="w-full mt-6 py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">Dismiss</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .pt-safe { padding-top: env(safe-area-inset-top); }
      `}</style>
    </div>
  );
}
