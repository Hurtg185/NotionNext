import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit,
  Loader2, Star, Sparkles, ChevronDown, 
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';

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
  const [viewportHeight, setViewportHeight] = useState('100vh'); // 核心修复：动态高度
  
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
  const scrollRef = useRef(null); // 滚动容器 ref
  const bottomRef = useRef(null); // 底部锚点
  const longPressTimerRef = useRef(null);
  const isLongPress = useRef(false);

  // 1. 初始化与动态高度计算 (最关键的一步)
  useEffect(() => {
    setMounted(true);
    
    // 初始化配置
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

      // --- 强制计算视口高度，解决移动端底部遮挡问题 ---
      const handleResize = () => {
        setViewportHeight(`${window.innerHeight}px`);
      };
      
      // 初始设置
      handleResize();
      
      // 监听窗口变化（如键盘弹出、旋转）
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // 2. 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, loading, quickReplies]);

  // 3. 输入框自适应高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // 限制最大高度，防止撑破布局
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
    if (typeof navigator !== 'undefined') navigator.clipboard.writeText(text.replace(/\*/g, ''));
  };

  if (!mounted) return null;

  const currentSource = ALL_LANGUAGES.find(l => l.code === sourceLang) || ALL_LANGUAGES[0];
  const currentTarget = ALL_LANGUAGES.find(l => l.code === targetLang) || ALL_LANGUAGES[2];

  return (
    <>
      <Head>
        <title>AI 翻译官 Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* 
         布局容器：
         1. style={{ height: viewportHeight }} -> 强制设为浏览器可见区域的高度
         2. flex flex-col -> 垂直弹性布局
         3. overflow-hidden -> 禁止整个页面滚动，只让中间部分滚
      */}
      <div 
        style={{ height: viewportHeight }} 
        className="w-full bg-[#f8fafc] text-slate-900 font-sans flex flex-col overflow-hidden relative"
      >
        
        {/* --- 1. 顶部栏 (固定高度) --- */}
        <header className="shrink-0 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pro v3.2</span>
          </div>
          <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
             Connected
          </div>
        </header>

        {/* --- 2. 核心内容区 (占据剩余空间，可滚动) --- */}
        <main ref={scrollRef} className="flex-1 w-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
          
          {/* 空状态 */}
          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full pb-20 opacity-30">
              <BrainCircuit size={80} strokeWidth={1} />
              <p className="mt-4 font-black uppercase tracking-[0.2em] text-xs">Waiting for Input</p>
            </div>
          )}

          {/* 结果列表 */}
          <AnimatePresence>
            {results.map((item, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                key={idx} 
                className={`p-5 rounded-[1.5rem] border shadow-sm ${item.recommended ? 'bg-white border-indigo-200 ring-2 ring-indigo-50' : 'bg-white border-slate-100'}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${item.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {item.label}
                  </span>
                  {item.recommended && <Star size={12} className="text-indigo-500" fill="currentColor"/>}
                </div>
                <p className="text-lg font-medium text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                  {item.translation}
                </p>
                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-50">
                  <button onClick={() => speak(item.translation)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><Volume2 size={18}/></button>
                  <button onClick={() => copyToClipboard(item.translation)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><Copy size={18}/></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 加载中 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <p className="text-[10px] font-bold text-slate-300 uppercase">Processing...</p>
            </div>
          )}
          
          {/* 底部垫片，确保最后一条消息不贴边 */}
          <div className="h-4" />
        </main>

        {/* --- 3. 底部操作区 (不使用 fixed，而是 flex item，绝对不会被遮挡) --- */}
        <footer className="shrink-0 bg-white border-t border-slate-200 z-20 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
          
          {/* 联想词气泡 */}
          <AnimatePresence>
            {quickReplies.length > 0 && (
              <motion.div initial={{height:0}} animate={{height:'auto'}} className="overflow-hidden bg-slate-50">
                <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {quickReplies.map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); handleTranslate(q); }} className="whitespace-nowrap px-3 py-1.5 bg-white text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 shadow-sm">
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-3 space-y-3 max-w-3xl mx-auto">
            
            {/* 语言切换栏 */}
            <div className="flex items-center gap-2">
               <button 
                  onClick={() => setShowLangPicker(showLangPicker === 'src' ? null : 'src')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex justify-center items-center gap-1 transition-colors ${showLangPicker === 'src' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {currentSource.label} <ChevronDown size={12}/>
                </button>
                <button 
                  onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
                  className="p-2 bg-slate-50 text-slate-400 rounded-lg border border-slate-100"
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

            {/* 语言选择面板 */}
            <AnimatePresence>
              {showLangPicker && (
                <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl mb-1">
                    {ALL_LANGUAGES.map(lang => (
                      <button 
                        key={lang.code}
                        onClick={() => {
                          if (showLangPicker === 'src') setSourceLang(lang.code);
                          else setTargetLang(lang.code);
                          setShowLangPicker(null);
                        }}
                        className="py-2 text-[10px] font-bold bg-white border border-slate-200 rounded-lg shadow-sm"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 核心输入行 */}
            <div className="flex items-end gap-2">
              <button onClick={() => setShowSettings(true)} className="p-3 bg-slate-100 text-slate-500 rounded-xl">
                <Settings size={20} />
              </button>

              <div className="relative flex-1">
                <textarea 
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isListening ? "正在聆听..." : "输入文本..."}
                  rows={1}
                  className={`w-full bg-slate-100 rounded-xl px-4 py-3 pr-10 text-sm font-medium outline-none resize-none max-h-32 transition-colors focus:bg-white focus:ring-2 focus:ring-indigo-500/10 ${isListening ? 'bg-rose-50 ring-2 ring-rose-100' : ''}`}
                />
                {input && <button onClick={() => setInput('')} className="absolute right-2 bottom-3 p-1 text-slate-300"><X size={14} /></button>}
              </div>

              <div className="shrink-0">
                {input.trim() ? (
                  <button onClick={() => handleTranslate()} disabled={loading} className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 active:scale-95">
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                  </button>
                ) : (
                  <button 
                    onMouseDown={handleMicPressStart}
                    onMouseUp={handleMicPressEnd}
                    onTouchStart={handleMicPressStart}
                    onTouchEnd={handleMicPressEnd}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-colors ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-white'}`}
                  >
                    <Mic size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </footer>

        {/* --- 弹窗组件 --- */}
        
        {/* 设置面板 */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} className="w-full bg-white rounded-t-3xl p-6 pb-10" onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6"/>
                <h3 className="text-lg font-bold mb-4">系统设置</h3>
                <div className="space-y-3">
                  <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value);localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none border border-slate-100" />
                  <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value);localStorage.setItem('tr_api_url', e.target.value)}} placeholder="Host URL" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none border border-slate-100" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 语音语言选择 */}
        <AnimatePresence>
          {showMicLangMenu && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-8" onClick={()=>setShowMicLangMenu(false)}>
              <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl" onClick={e=>e.stopPropagation()}>
                <h4 className="text-xs font-bold text-slate-400 mb-3 text-center uppercase">选择识别语言</h4>
                <div className="grid gap-2">
                  {RECOGNITION_LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => {setSourceLang(lang.code); setShowMicLangMenu(false)}} className={`p-3 rounded-xl text-sm font-bold ${sourceLang === lang.code ? 'bg-indigo-600 text-white' : 'bg-slate-50'}`}>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 0px; display: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </>
  );
}
