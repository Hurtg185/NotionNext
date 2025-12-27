import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit,
  Loader2, ArrowLeftRight, ChevronDown 
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
  const scrollRef = useRef(null);

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

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, loading]);

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
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, sourceLang, targetLang, customConfig: { apiKey, model, apiUrl } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      if (data.results) setResults(data.results);
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

  const handleMicPress = () => {
    isLongPress.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setIsListening(false);
      setShowMicLangMenu(true);
    }, 400); 
  };

  const handleMicRelease = () => {
    clearTimeout(longPressTimerRef.current);
    if (!isLongPress.current) startListening();
  };

  const speak = (text) => {
    const cleanedText = text.replace(/\*/g, ''); 
    const voiceMap = { my: 'my-MM-NilarNeural', zh: 'zh-CN-XiaoxiaoNeural', en: 'en-US-JennyNeural' };
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${voiceMap[targetLang] || 'my-MM-NilarNeural'}&r=-10`;
    new Audio(url).play().catch(() => {});
  };

  if (!mounted) return null;

  const currentSourceLang = ALL_LANGUAGES.find(l => l.code === sourceLang) || ALL_LANGUAGES[0];
  const currentTargetLang = ALL_LANGUAGES.find(l => l.code === targetLang) || ALL_LANGUAGES[2];

  return (
    <>
      <Head>
        <title>AI 全能翻译官</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* 这里的 h-screen 改为 flex 布局 */}
      <div className="flex flex-col h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
        
        {/* 中间内容区：可滚动 */}
        <main ref={scrollRef} className="flex-grow w-full max-w-3xl mx-auto p-4 space-y-4 overflow-y-auto custom-scrollbar">
          <AnimatePresence>
            {results.map((item, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                key={idx} 
                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase">{item.label}</span>
                  <div className="flex gap-1">
                    <button onClick={() => speak(item.translation)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><Volume2 size={16}/></button>
                    <button onClick={() => navigator.clipboard.writeText(item.translation.replace(/\*/g, ''))} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><Copy size={16}/></button>
                  </div>
                </div>
                <p className="text-base font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{item.translation}</p>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <p className="text-[10px] font-bold">AI正在翻译...</p>
            </div>
          )}

          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
              <BrainCircuit size={80} strokeWidth={1} />
              <p className="mt-4 font-bold text-sm">等待输入内容</p>
            </div>
          )}
        </main>

        {/* 底部输入区：固定高度，不使用 fixed 以免被遮挡 */}
        <footer className="shrink-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 pb-safe">
          <div className="max-w-3xl mx-auto p-3 space-y-3">
            
            {/* 语言切换器 */}
            <div className="flex items-center justify-between gap-2 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setShowAllLangs(showAllLangs === 'source' ? false : 'source')}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold text-slate-600"
              >
                {currentSourceLang.label} <ChevronDown size={12} />
              </button>
              
              <button 
                onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
                className="p-1.5 text-slate-400 hover:bg-white rounded-lg shadow-sm"
              >
                <ArrowLeftRight size={14} />
              </button>

              <button 
                onClick={() => setShowAllLangs(showAllLangs === 'target' ? false : 'target')}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold text-slate-600"
              >
                {currentTargetLang.label} <ChevronDown size={12} />
              </button>
            </div>

            {/* 语言选择浮层 */}
            <AnimatePresence>
              {showAllLangs && (
                <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="overflow-hidden">
                  <div className="grid grid-cols-3 gap-1 shadow-inner bg-slate-50 p-2 rounded-xl">
                    {ALL_LANGUAGES.map(lang => (
                      <button 
                        key={lang.code} 
                        onClick={() => showAllLangs === 'source' ? handleSourceLangChange(lang.code) : handleTargetLangChange(lang.code)}
                        className="py-2 text-[10px] font-bold bg-white border border-slate-200 rounded-lg"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 输入框行 */}
            <div className="flex items-end gap-2">
              <button onClick={() => setShowSettings(true)} className="p-3 text-slate-400"><Settings size={20}/></button>
              
              <div className="relative flex-grow">
                <textarea 
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isListening ? "正在聆听..." : "输入文字或长按语音"}
                  className="w-full bg-slate-100 rounded-2xl p-3 pr-10 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 max-h-32 resize-none"
                  rows={1}
                />
                {input && <button onClick={()=>setInput('')} className="absolute right-3 top-3 text-slate-300"><X size={16}/></button>}
              </div>

              {input.trim() ? (
                <button onClick={() => handleTranslate()} disabled={loading} className="w-11 h-11 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-lg active:scale-95">
                  <Send size={18} />
                </button>
              ) : (
                <button 
                  onMouseDown={handleMicPress} onMouseUp={handleMicRelease}
                  onTouchStart={handleMicPress} onTouchEnd={handleMicRelease}
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-white active:scale-95'}`}
                >
                  <Mic size={20} />
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* 弹窗部分（代码未变） */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:'100%'}} animate={{y:0}} className="w-full bg-white rounded-t-3xl p-6" onClick={e=>e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"/>
                <div className="space-y-4 max-w-md mx-auto">
                  <h3 className="text-lg font-bold">配置</h3>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
                    <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key" className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
                    <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="API URL" className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 语音语言选择菜单 */}
        <AnimatePresence>
          {showMicLangMenu && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={()=>setShowMicLangMenu(false)}>
              <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white w-full max-w-xs rounded-3xl p-4 shadow-2xl" onClick={e=>e.stopPropagation()}>
                <h4 className="text-sm font-bold mb-4 px-2">识别语言</h4>
                <div className="grid grid-cols-1 gap-2">
                  {RECOGNITION_LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => { setSourceLang(lang.code); setShowMicLangMenu(false); }} className={`p-3 text-left rounded-xl text-sm font-bold ${sourceLang === lang.code ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}>
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
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </>
  );

  function handleSourceLangChange(lang) {
    setSourceLang(lang);
    localStorage.setItem('tr_src', lang);
    setShowAllLangs(false);
  }

  function handleTargetLangChange(lang) {
    setTargetLang(lang);
    localStorage.setItem('tr_tar', lang);
    setShowAllLangs(false);
  }
}
