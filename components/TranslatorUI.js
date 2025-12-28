import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronDown,
  ExternalLink, Sparkles, ArrowRightLeft,
  Loader2, Star, Languages, Check, Globe,
  MessageCircle, Feather, Zap, User, PlayCircle, Voicemail
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
  const isVoiceInputRef = useRef(false); 
  
  // 布局高度状态
  const [footerHeight, setFooterHeight] = useState(0);

  // 语言设置
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');

  // 配置与弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false); 
  const [selectorType, setSelectorType] = useState('target');

  // 用户配置
  const [autoSendVoice, setAutoSendVoice] = useState(true);
  const [voiceGender, setVoiceGender] = useState('female');
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

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        rec.onstart = () => { setIsListening(true); isVoiceInputRef.current = true; };
        rec.onresult = (e) => setInput(Array.from(e.results).map(r => r[0].transcript).join(''));
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setFooterHeight(entries[0].contentRect.height);
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  // 核心逻辑：仅语音输入结束后自动发送
  useEffect(() => {
    if (autoSendVoice && !isListening && isVoiceInputRef.current && input.trim().length > 0 && !loading) {
        handleTranslate();
        isVoiceInputRef.current = false;
    }
  }, [isListening]); // 只依赖 isListening 确保只在语音状态改变时触发

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // --- 核心翻译与交互逻辑 ---

  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim()) return;

    setLoading(true);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, sourceLang, targetLang, customConfig: { apiKey, model, apiUrl }})
      });
      
      if (!res.ok) throw new Error((await res.json()).error || '请求失败');
      
      const data = await res.json();
      
      if (data.parsed) {
        const p = data.parsed;
        const formattedResults = [
          { id: 'direct', label: '直接', translation: p.direct?.translation || '', recommended: true },
          { id: 'spoken', label: '口语', translation: p.spoken?.translation || '' },
          { id: 'free', label: '意译', translation: p.free?.translation || '' },
          { id: 'social', label: '社交', translation: p.social?.translation || '' }
        ].filter(item => item.translation);
        setResults(formattedResults);
      }
      
      setQuickReplies(data.quick_replies || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      const langConfig = SOURCE_LANGUAGES.find(l => l.code === sourceLang);
      recognitionRef.current.lang = langConfig?.voice || 'zh-CN'; 
      recognitionRef.current.start();
    }
  };

  const speak = (text) => {
    if (audioRef.current) {
        audioRef.current.pause();
    }
    const langConfig = VOICE_LIBRARY[targetLang];
    const voice = langConfig?.[voiceGender] || 'en-US-JennyNeural';
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-10`;
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(e => console.error("TTS Error", e));
  };

  const handleCopy = (text) => navigator.clipboard?.writeText(text);

  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  const selectLanguage = (code, type) => {
    const setter = type === 'source' ? setSourceLang : setTargetLang;
    const key = type === 'source' ? 'tr_src' : 'tr_tar';
    setter(code);
    localStorage.setItem(key, code);
    setShowLangSelector(false);
  };

  const getSourceLabel = () => SOURCE_LANGUAGES.find(l => l.code === sourceLang)?.label.split(' ')[1] || '自动';
  const getTargetLabel = () => TARGET_LANGUAGES.find(l => l.code === targetLang)?.label.split(' ')[1] || '缅文';

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F0F2F6] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
          <title>AI 翻译官 Pro</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </Head>

      <div className="flex flex-col h-[100dvh] max-w-md mx-auto relative overflow-hidden bg-white sm:shadow-2xl sm:rounded-[2.5rem] sm:my-4 sm:h-[calc(100vh-2rem)] sm:border border-slate-200">
        
        <header className="absolute top-0 left-0 right-0 z-40 p-3 flex justify-between items-start pointer-events-none">
          <Link href="/"><a className="pointer-events-auto p-2 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600"><Languages size={16} /></a></Link>
          <div className="pointer-events-auto flex items-center gap-0.5 bg-white/95 backdrop-blur-xl shadow-sm border border-slate-100 rounded-full p-1 pr-3 mt-0.5">
            <button onClick={() => { setSelectorType('source'); setShowLangSelector(true); }} className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50">{getSourceLabel()}</button>
            <button onClick={swapLanguages} className="p-1 rounded-full text-slate-300 hover:text-indigo-500 active:rotate-180 transition-transform"><ArrowRightLeft size={12} /></button>
            <button onClick={() => { setSelectorType('target'); setShowLangSelector(true); }} className="px-2 text-xs font-black text-indigo-800 flex items-center gap-1">{getTargetLabel()}<ChevronDown size={10} /></button>
          </div>
          <button onClick={()=>setShowSettings(true)} className="pointer-events-auto p-2 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600"><Settings size={16} /></button>
        </header>

        <main className="flex-1 overflow-y-auto px-3 pt-20 no-scrollbar space-y-1.5" style={{ paddingBottom: footerHeight + 10 }}>
            {results.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none select-none -mt-10">
                <BrainCircuit size={60} className="text-slate-300 mb-3" strokeWidth={1} /><p className="font-bold text-slate-400 text-[10px] tracking-widest uppercase">AI TRANSLATOR</p>
              </div>
            )}
            {loading && (
                <div className="flex justify-center py-2">
                    <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-sm border border-slate-100 flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-indigo-600" /><span className="text-[10px] font-bold text-indigo-600">Translating...</span>
                    </div>
                </div>
            )}
            {/* --- 真正的小卡片模式 --- */}
            <AnimatePresence>
              {results.map((item, idx) => (
                <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                    className="bg-white rounded-lg p-2.5 border shadow-sm flex items-center gap-3 group"
                >
                    <span className={`text-[10px] font-black w-10 text-center shrink-0 ${item.recommended ? 'text-indigo-600' : 'text-slate-400'}`}>{item.label}</span>
                    <p className="flex-1 text-sm text-slate-800 font-medium leading-snug select-all">{item.translation}</p>
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => speak(item.translation)} className="text-slate-400 hover:text-indigo-600"><Volume2 size={14} /></button>
                         <button onClick={() => handleCopy(item.translation)} className="text-slate-400 hover:text-emerald-600"><Copy size={14} /></button>
                    </div>
                </motion.div>
              ))}
            </AnimatePresence>
        </main>
        
        <div ref={footerRef} className="absolute bottom-0 left-0 right-0 z-30 pb-safe">
           {quickReplies.length > 0 && (
               <div className="px-3 mb-2">
                   <div className="flex gap-2 overflow-x-auto no-scrollbar mask-fade-sides py-1">
                      {quickReplies.map((q, i) => ( 
                          <button key={i} onClick={() => { setInput(q); isVoiceInputRef.current = false; }} className="whitespace-nowrap px-3 py-1.5 bg-white border border-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition-all">{q}</button> 
                      ))}
                   </div>
               </div>
           )}
           <div className="bg-white/90 backdrop-blur-xl border-t border-slate-100 px-3 py-3 shadow-sm">
              <div className="flex gap-2 items-end">
                 <button onClick={() => { setSelectorType('source'); setShowLangSelector(true); }} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 border border-slate-200 flex flex-col items-center justify-center gap-0.5 shrink-0 active:scale-95 transition-all">
                    <Globe size={14} /><span className="text-[9px] font-bold leading-none">{getSourceLabel()}</span>
                 </button>
                 <div className="flex-1 relative bg-slate-100 rounded-xl border border-transparent focus-within:bg-white focus-within:border-indigo-200 focus-within:ring-1 ring-indigo-50 transition-all">
                    <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); isVoiceInputRef.current = false; }} placeholder={isListening ? "聆听中..." : "输入内容..."} className="w-full bg-transparent p-3 pr-8 resize-none text-sm font-medium text-slate-800 outline-none max-h-[80px] min-h-[40px] placeholder:text-slate-400" rows={1} />
                    {input && <button onClick={()=>setInput('')} className="absolute top-2.5 right-2 text-slate-400 hover:text-rose-500 p-1"><X size={14} /></button>}
                 </div>
                 <button onClick={input.trim() ? () => handleTranslate() : toggleListening} disabled={loading} className={`w-12 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-all active:scale-90 shrink-0 ${input.trim() ? 'bg-indigo-600 shadow-indigo-200' : (isListening ? 'bg-rose-500 animate-pulse' : 'bg-slate-900 shadow-slate-200')}`}>
                    {loading ? <Loader2 size={18} className="animate-spin"/> : (input.trim() ? <Send size={18} /> : <Mic size={20} />)}
                 </button>
              </div>
           </div>
        </div>

        {/* --- 弹窗 --- */}
        <AnimatePresence>
          {showLangSelector && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end" onClick={()=>setShowLangSelector(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-[2rem] p-5 pb-safe max-h-[70vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
                <h3 className="text-base font-black text-slate-800 mb-4 text-center shrink-0">选择{selectorType === 'source' ? '识别语言' : '目标语言'}</h3>
                <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar pb-2">
                    {(selectorType === 'source' ? SOURCE_LANGUAGES : TARGET_LANGUAGES).map(lang => (
                        <button key={lang.code} onClick={() => selectLanguage(lang.code, selectorType)} className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${((selectorType === 'source' ? sourceLang : targetLang) === lang.code) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                            <span className="font-bold text-xs">{lang.label}</span>
                            {((selectorType === 'source' ? sourceLang : targetLang) === lang.code) && <Check size={14} />}
                        </button>
                    ))}
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full sm:w-[90%] sm:max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-safe" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-slate-900">设置</h3><button onClick={()=>setShowSettings(false)} className="bg-slate-100 text-slate-500 p-2 rounded-full hover:bg-slate-200"><X size={18}/></button></div>
                <div className="space-y-4">
                  
                  {/* --- 发音人偏好设置 (重构后) --- */}
                  <fieldset className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <legend className="flex items-center gap-2 px-1">
                        <Voicemail size={14} className="text-indigo-600"/>
                        <span className="font-bold text-sm text-slate-700">发音人偏好</span>
                    </legend>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={() => { setVoiceGender('female'); localStorage.setItem('tr_voice_gender', 'female'); }} className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${voiceGender === 'female' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200'}`}>👩 女声 Female</button>
                        <button onClick={() => { setVoiceGender('male'); localStorage.setItem('tr_voice_gender', 'male'); }} className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${voiceGender === 'male' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200'}`}>👨 男声 Male</button>
                    </div>
                  </fieldset>

                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl"> 
                      <div><span className="font-bold text-slate-700 text-xs">语音后自动发送</span><p className="text-[10px] text-slate-400">文字输入需手动发送</p></div>
                      <input type="checkbox" checked={autoSendVoice} onChange={e=>{setAutoSendVoice(e.target.checked); localStorage.setItem('tr_auto_send_voice', e.target.checked)}} className="w-5 h-5 accent-indigo-600 rounded" /> 
                  </div>
                  
                  <div className="p-4 bg-slate-900 rounded-2xl text-white">
                    <div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-indigo-300 uppercase">API Config</label><a href="https://iflow.cn/" target="_blank" rel="noreferrer" className="text-[10px] text-white/50 flex items-center gap-1 hover:text-white">获取 Key <ExternalLink size={10}/></a></div>
                    <div className="space-y-2">
                        <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key" className="w-full bg-white/10 border border-white/10 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-indigo-500" />
                        <select value={model} onChange={e=>{setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full py-2 px-3 bg-indigo-600 border border-indigo-500 text-white rounded-xl text-xs font-bold outline-none">
                            <option value="deepseek-v3.2">DeepSeek V3.2</option><option value="gpt-4o">GPT-4o</option>
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
