import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit,
  ExternalLink, Sparkles,
  Loader2, Star, ArrowRightArrowLeft, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';

// 定义语言列表
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
  const [showAllLangs, setShowAllLangs] = useState(false);
  const [showMicLangMenu, setShowMicLangMenu] = useState(false);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');
  
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const longPressTimerRef = useRef();
  const isLongPress = useRef(false);
  const messagesEndRef = useRef(null); // 用于自动滚动到底部

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

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`; // 限制最大高度
    }
  }, [input]);

  // 新结果产生时滚动到底部
  useEffect(() => {
    if (results.length > 0 || loading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [results, loading]);
  
  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim() || loading) return;
    setLoading(true);
    // 这里不清空 results，而是追加或替换，视需求而定。当前逻辑为替换当前显示。
    setResults([]); 
    
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
        setResults(data.results);
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
      const recognitionLangMap = { zh: 'zh-CN', en: 'en-US', my: 'my-MM' };
      recognitionRef.current.lang = recognitionLangMap[sourceLang] || 'zh-CN'; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleMicPress = () => {
    isLongPress.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setIsListening(false);
      setShowMicLangMenu(true);
    }, 400); // 400ms 长按触发
  };

  const handleMicRelease = () => {
    clearTimeout(longPressTimerRef.current);
    if (!isLongPress.current) {
      startListening();
    }
  };

  const speak = (text) => {
    if (typeof window === 'undefined') return;
    const cleanedText = text.replace(/\*/g, ''); // 移除Markdown星号
    const voiceMap = { my: 'my-MM-NilarNeural', zh: 'zh-CN-XiaoxiaoNeural', en: 'en-US-JennyNeural' };
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${voiceMap[targetLang] || 'my-MM-NilarNeural'}&r=-10`;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  const handleSourceLangChange = (lang) => {
    setSourceLang(lang);
    localStorage.setItem('tr_src', lang);
    setShowAllLangs(false);
    setShowMicLangMenu(false);
  };

  const handleTargetLangChange = (lang) => {
    setTargetLang(lang);
    localStorage.setItem('tr_tar', lang);
    setShowAllLangs(false);
  };

  if (!mounted) return null;

  const currentSourceLang = ALL_LANGUAGES.find(l => l.code === sourceLang);
  const currentTargetLang = ALL_LANGUAGES.find(l => l.code === targetLang);

  return (
    <>
      <Head>
        <title>AI 全能翻译官</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* 
        核心布局修改：
        1. h-[100dvh]: 动态视口高度，解决移动端地址栏遮挡
        2. flex flex-col: 垂直弹性布局
        3. overflow-hidden: 防止外层滚动
      */}
      <div className="flex flex-col h-[100dvh] w-full bg-slate-100 font-sans text-slate-900 overflow-hidden">
        
        {/* 
          中间内容区域：
          1. flex-1: 占据剩余所有空间
          2. overflow-y-auto: 内部独立滚动
          3. overscroll-contain: 防止滚动链
          4. 移除 pb-48: 不再需要 huge padding，因为 Footer 也是 flex 的一部分，不会遮挡
        */}
        <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto custom-scrollbar overscroll-contain">
          <AnimatePresence>
            {results.map((item, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }}
                key={idx} 
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/50"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{item.label}</span>
                  <div className="flex gap-2">
                    <button onClick={() => speak(item.translation)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><Volume2 size={18}/></button>
                    <button onClick={() => { if(typeof navigator !== 'undefined') navigator.clipboard.writeText(item.translation.replace(/\*/g, '')) }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><Copy size={18}/></button>
                  </div>
                </div>
                <p className="text-base md:text-lg font-medium text-slate-800 leading-relaxed select-all whitespace-pre-wrap">{item.translation}</p>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && ( 
            <div className="flex flex-col items-center justify-center py-10 gap-4"> 
              <Loader2 size={32} className="animate-spin text-indigo-500" /> 
              <p className="text-xs font-bold text-slate-400">AI 思考中...</p> 
            </div> 
          )}
          
          {results.length === 0 && !loading && ( 
            <div className="flex flex-col items-center justify-center h-full opacity-40"> 
              <BrainCircuit size={60} strokeWidth={1.5} /> 
              <p className="mt-4 font-bold text-sm text-slate-500">等待输入</p> 
            </div> 
          )}
          
          {/* 滚动锚点 */}
          <div ref={messagesEndRef} className="h-2" />
        </main>

        {/* 
          底部 Footer：
          1. flex-shrink-0: 禁止压缩，保持高度
          2. z-30: 确保浮动层级
          3. 移除 fixed: 改为自然流布局，位于 flex 容器底部，完美解决遮挡和键盘弹起问题
        */}
        <footer className="flex-shrink-0 z-30 bg-white/80 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3 pb-safe">
            {/* Language Selector */}
            <AnimatePresence>
              {showAllLangs && (
                <motion.div initial={{height: 0, opacity: 0}} animate={{height: 'auto', opacity: 1}} exit={{height: 0, opacity: 0}} className="overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 p-2 bg-slate-100 rounded-lg mb-2">
                    {ALL_LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => (showAllLangs === 'source' ? handleSourceLangChange(lang.code) : handleTargetLangChange(lang.code))} className="p-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-md transition-colors">
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setShowAllLangs(showAllLangs === 'source' ? false : 'source')} className="flex-1 flex items-center justify-center gap-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                <span className="text-sm font-bold text-slate-700">{currentSourceLang?.label}</span>
                <ChevronDown size={14} className={`transition-transform ${showAllLangs === 'source' ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={() => { handleSourceLangChange(targetLang); handleTargetLangChange(sourceLang); }} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors active:scale-90">
                <ArrowRightArrowLeft size={16} />
              </button>
              <button onClick={() => setShowAllLangs(showAllLangs === 'target' ? false : 'target')} className="flex-1 flex items-center justify-center gap-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                <span className="text-sm font-bold text-slate-700">{currentTargetLang?.label}</span>
                <ChevronDown size={14} className={`transition-transform ${showAllLangs === 'target' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Input Row */}
            <div className="flex items-end gap-2">
              <button onClick={() => setShowSettings(true)} className="p-3 h-12 text-slate-500 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0">
                <Settings size={22} />
              </button>
              <div className="relative flex-grow">
                <textarea 
                  ref={textareaRef} 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder={isListening ? "正在聆听..." : "输入文本或长按麦克风"} 
                  className="w-full bg-slate-100 rounded-2xl p-3 pr-10 text-base font-medium resize-none overflow-hidden outline-none focus:ring-2 focus:ring-indigo-400 min-h-[48px]" 
                  rows={1} 
                />
                {input && <button onClick={() => setInput('')} className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={16}/></button>}
              </div>
              {input.trim() ? (
                <button onClick={() => handleTranslate()} disabled={loading} className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full transition-all shadow-lg shadow-indigo-200 active:scale-90 shrink-0">
                  {loading ? <Loader2 className="animate-spin" size={24}/> : <Send size={22}/>}
                </button>
              ) : (
                <button 
                  onMouseDown={handleMicPress}
                  onMouseUp={handleMicRelease}
                  onTouchStart={handleMicPress}
                  onTouchEnd={handleMicRelease}
                  disabled={loading} 
                  className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0 ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-slate-800 text-white shadow-lg shadow-slate-300'}`}
                >
                  <Mic size={24}/>
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 flex items-end" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-2xl p-4" onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"/>
                <h3 className="text-lg font-bold text-center mb-6">系统偏好</h3>
                <div className="max-w-md mx-auto space-y-4 pb-6">
                  <div className="p-4 bg-slate-900 rounded-2xl text-white">
                    <label className="text-xs font-bold text-slate-400">API 配置</label>
                    <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key (sk-xxxxxxxx)" className="w-full bg-white/10 mt-2 rounded-lg p-3 text-sm font-mono outline-none" />
                    <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="API URL" className="w-full bg-white/10 mt-2 rounded-lg p-3 text-sm font-mono outline-none" />
                    <select value={model} onChange={e=>{setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full bg-white/10 mt-2 rounded-lg p-3 text-sm outline-none appearance-none">
                      <option value="deepseek-v3.2">DeepSeek V3.2 (推荐)</option>
                      <option value="qwen3-235b">Qwen3 235B</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic Lang Quick Select Menu */}
        <AnimatePresence>
          {showMicLangMenu && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-end" onClick={()=>setShowMicLangMenu(false)}>
              <motion.div initial={{x: "100%"}} animate={{x: 0}} exit={{x: "100%"}} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="bg-white rounded-l-2xl p-4 shadow-2xl mb-20 mr-2" onClick={e=>e.stopPropagation()}>
                <h4 className="text-sm font-bold mb-3">选择识别语言</h4>
                <div className="space-y-2">
                  {RECOGNITION_LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => handleSourceLangChange(lang.code)} className={`w-full text-left p-3 rounded-lg text-sm font-bold transition-colors ${sourceLang === lang.code ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* 适配 iPhone 底部安全区域 */
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </>
  );
}
