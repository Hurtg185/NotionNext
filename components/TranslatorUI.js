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
  const [showLangPicker, setShowLangPicker] = useState(false); 
  
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
  const bottomRef = useRef(null); // 用于自动滚动到底部
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

  // 结果更新时滚动到底部
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results, loading]);

  // 输入框自适应高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);
  
  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim() || loading) return;

    setLoading(true);
    setResults([]); // 清空旧结果，显示加载状态
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
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans relative">
      <Head>
        <title>AI 翻译官 Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* --- 顶部固定栏 --- */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pro Engine</span>
        </div>
        <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">V3.2 Active</div>
      </header>

      {/* --- 主要内容区 (Padding-bottom 很大，防止被固定底栏遮挡) --- */}
      <main className="w-full max-w-3xl mx-auto pt-20 pb-72 px-4 space-y-6">
        <AnimatePresence>
          {results.length === 0 && !loading && (
            <motion.div initial={{opacity:0}} animate={{opacity:0.3}} className="flex flex-col items-center justify-center pt-32 grayscale">
              <BrainCircuit size={80} strokeWidth={1.2} />
              <p className="mt-6 font-black uppercase tracking-[0.3em] text-xs text-slate-400">Ready to Translate</p>
            </motion.div>
          )}

          {results.map((item, idx) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              key={idx} 
              className={`p-6 rounded-[2rem] shadow-sm border transition-all ${item.recommended ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100/50' : 'bg-white border-slate-100'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide ${item.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {item.label}
                </span>
                {item.recommended && (
                  <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    <Star size={10} fill="currentColor" /> BEST
                  </div>
                )}
              </div>
              <p className="text-lg font-medium text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                {item.translation}
              </p>
              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-50">
                <button onClick={() => speak(item.translation)} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
                  <Volume2 size={18}/>
                </button>
                <button onClick={() => copyToClipboard(item.translation)} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
                  <Copy size={18}/>
                </button>
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={36} className="animate-spin text-indigo-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Processing...</p>
            </div>
          )}
          
          {/* 这是一个隐形的 div，用于确保滚动到底部 */}
          <div ref={bottomRef} />
        </AnimatePresence>
      </main>

      {/* --- 底部固定操作栏 (强制 z-50) --- */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        
        {/* 联想词气泡 (悬浮在操作栏上方) */}
        <AnimatePresence>
          {quickReplies.length > 0 && (
            <motion.div initial={{ opacity:0, y: 10 }} animate={{ opacity:1, y: 0 }} exit={{ opacity:0 }} className="absolute -top-12 left-0 right-0 h-10 px-4 flex gap-2 overflow-x-auto no-scrollbar pointer-events-auto">
              {quickReplies.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); handleTranslate(q); }} className="whitespace-nowrap px-4 h-8 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-1.5 border border-indigo-500">
                  <Sparkles size={12}/> {q}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-3xl mx-auto p-3 space-y-3">
          
          {/* 语言选择行 */}
          <div className="bg-slate-50 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-100">
             <button 
                onClick={() => setShowLangPicker(showLangPicker === 'src' ? null : 'src')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${showLangPicker === 'src' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500'}`}
              >
                {currentSource.label} <ChevronDown size={12} className={`transition-transform ${showLangPicker === 'src' ? 'rotate-180':''}`} />
              </button>

              <button 
                onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
                className="p-2 text-slate-400 bg-white rounded-lg border border-slate-200 shadow-sm active:rotate-180 transition-all"
              >
                <ArrowLeftRight size={14} />
              </button>

              <button 
                onClick={() => setShowLangPicker(showLangPicker === 'tar' ? null : 'tar')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${showLangPicker === 'tar' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500'}`}
              >
                {currentTarget.label} <ChevronDown size={12} className={`transition-transform ${showLangPicker === 'tar' ? 'rotate-180':''}`} />
              </button>
          </div>

          {/* 语言下拉面板 */}
          <AnimatePresence>
            {showLangPicker && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-3 gap-2 p-2 bg-slate-100 rounded-xl mb-2">
                  {ALL_LANGUAGES.map(lang => (
                    <button 
                      key={lang.code}
                      onClick={() => {
                        if (showLangPicker === 'src') setSourceLang(lang.code);
                        else setTargetLang(lang.code);
                        setShowLangPicker(null);
                      }}
                      className="py-2.5 text-[10px] font-bold bg-white border border-slate-200 rounded-lg shadow-sm active:bg-indigo-50"
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 核心输入区：[设置] + [输入框] + [发送/语音] */}
          <div className="flex items-end gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3.5 bg-slate-100 text-slate-500 rounded-[1.2rem] active:scale-95 transition-all"
            >
              <Settings size={20} />
            </button>

            <div className="relative flex-1">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "输入文本..."}
                rows={1}
                className={`w-full bg-slate-100 rounded-[1.5rem] px-4 py-3.5 pr-10 text-base font-medium outline-none resize-none max-h-32 transition-all focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-100 border border-transparent ${isListening ? 'bg-rose-50 ring-2 ring-rose-200' : ''}`}
              />
              {input && (
                <button onClick={() => setInput('')} className="absolute right-3 bottom-3 text-slate-300 p-1 bg-slate-100 rounded-full hover:text-slate-500">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="shrink-0">
              <AnimatePresence mode="wait">
                {input.trim() ? (
                  <motion.button 
                    key="send"
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                    onClick={() => handleTranslate()}
                    disabled={loading}
                    className="w-12 h-12 bg-indigo-600 text-white rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-indigo-200 active:scale-90 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                  </motion.button>
                ) : (
                  <motion.button 
                    key="mic"
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                    onMouseDown={handleMicPressStart}
                    onMouseUp={handleMicPressEnd}
                    onTouchStart={handleMicPressStart}
                    onTouchEnd={handleMicPressEnd}
                    className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-lg transition-all active:scale-90 ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-rose-200' : 'bg-slate-800 text-white shadow-slate-300'}`}
                  >
                    <Mic size={22} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </footer>

      {/* --- 设置抽屉 (高层级 z-100) --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full bg-white rounded-t-[2.5rem] p-6 pb-safe" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              <div className="flex justify-between items-center mb-6 px-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">配置中心</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-slate-900 rounded-[2rem] text-white space-y-4 shadow-xl">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">API Key</label>
                    <input type="password" value={apiKey} onChange={e => {setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="sk-..." className="w-full bg-white/10 border border-white/5 rounded-xl p-3 text-sm font-mono outline-none focus:bg-white/20 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Host URL</label>
                    <input type="text" value={apiUrl} onChange={e => {setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="https://..." className="w-full bg-white/10 border border-white/5 rounded-xl p-3 text-sm font-mono outline-none focus:bg-white/20 transition-colors" />
                  </div>
                  <div className="pt-2">
                     <select value={model} onChange={e => {setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full bg-indigo-600 border-0 rounded-xl p-3 text-sm font-bold outline-none text-center">
                      <option value="deepseek-v3.2">DeepSeek V3.2</option>
                      <option value="qwen3-235b">Qwen3 235B</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">System V3.2.1</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 长按麦克风菜单 --- */}
      <AnimatePresence>
        {showMicLangMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setShowMicLangMenu(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-xs bg-white rounded-[2rem] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h4 className="text-xs font-black text-slate-400 mb-4 px-2 uppercase tracking-widest text-center">Select Voice Language</h4>
              <div className="grid grid-cols-1 gap-2">
                {RECOGNITION_LANGUAGES.map(lang => (
                  <button 
                    key={lang.code}
                    onClick={() => { setSourceLang(lang.code); setShowMicLangMenu(false); }}
                    className={`w-full p-4 rounded-xl text-sm font-bold transition-all ${sourceLang === lang.code ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-600'}`}
                  >
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
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}
