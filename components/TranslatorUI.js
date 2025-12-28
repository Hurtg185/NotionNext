import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronDown,
  ExternalLink, Sparkles, ArrowRightLeft,
  Loader2, Star, Languages, Check, Globe, Voicemail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import Link from 'next/link';

// --- [重构] 发音人配置库 (包含显示名和ID) ---
const VOICE_LIBRARY = {
  "中文": [
    { name: '小晓 (女声)', id: 'zh-CN-XiaoxiaoNeural' },
    { name: '云希 (男声)', id: 'zh-CN-YunxiNeural' },
    { name: '晓辰 (女声)', id: 'zh-CN-XiaochenNeural' },
  ],
  "英文": [
    { name: 'Jenny (女声)', id: 'en-US-JennyNeural' },
    { name: 'Guy (男声)', id: 'en-US-GuyNeural' },
    { name: 'Aria (女声)', id: 'en-US-AriaNeural' },
  ],
  "缅文": [
    { name: 'Nilar (女声)', id: 'my-MM-NilarNeural' },
    { name: 'Thiha (男声)', id: 'my-MM-ThihaNeural' },
  ],
  "泰文": [
    { name: 'Premwadee (女声)', id: 'th-TH-PremwadeeNeural' },
    { name: 'Niwat (男声)', id: 'th-TH-NiwatNeural' },
  ],
  "越南": [
    { name: 'HoaiMy (女声)', id: 'vi-VN-HoaiMyNeural' },
    { name: 'NamMinh (男声)', id: 'vi-VN-NamMinhNeural' },
  ],
  "日文": [
    { name: 'Nanami (女声)', id: 'ja-JP-NanamiNeural' },
    { name: 'Keita (男声)', id: 'ja-JP-KeitaNeural' },
  ]
};

const SOURCE_LANGUAGES = [
  { code: 'auto', label: '🤖 自动' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'en', label: '🇺🇸 英文' },
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'th', label: '🇹🇭 泰文' },
  { code: 'ja', label: '🇯🇵 日文' },
  { code: 'vi', label: '🇻🇳 越南' },
];

const TARGET_LANGUAGES = [
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'en', label: '🇺🇸 英文' },
  { code: 'th', label: '🇹🇭 泰文' },
  { code: 'vi', label: '🇻🇳 越南' },
  { code: 'ja', label: '🇯🇵 日文' },
];

export default function TranslatorUI() {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');
  const [showSettings, setShowSettings] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false); 
  const [selectorType, setSelectorType] = useState('target');
  
  // --- [新增] 用户配置 ---
  const [autoSendVoice, setAutoSendVoice] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false); // 默认关闭
  const [voiceSelection, setVoiceSelection] = useState('my-MM-NilarNeural');
  
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const footerRef = useRef(null); 
  const audioRef = useRef(null);
  const isVoiceInputRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setApiKey(localStorage.getItem('tr_api_key') || '');
      setAutoSendVoice(localStorage.getItem('tr_auto_send_voice') !== 'false');
      setAutoSpeak(localStorage.getItem('tr_auto_speak') === 'true');
      setVoiceSelection(localStorage.getItem('tr_voice_selection') || 'my-MM-NilarNeural');
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
    const ro = new ResizeObserver(entries => setFooterHeight(entries[0].contentRect.height));
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (autoSendVoice && !isListening && isVoiceInputRef.current && input.trim() && !loading) {
        handleTranslate();
        isVoiceInputRef.current = false;
    }
  }, [isListening]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleTranslate = async (overrideInput) => {
    const textToTranslate = overrideInput || input;
    if (!textToTranslate.trim()) return;
    setLoading(true);

    const sourceLangLabel = SOURCE_LANGUAGES.find(l => l.code === (sourceLang === 'auto' ? 'zh' : sourceLang))?.label.split(' ')[1];
    const targetLangLabel = TARGET_LANGUAGES.find(l => l.code === targetLang)?.label.split(' ')[1];

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: textToTranslate, 
          sourceLang, 
          targetLang,
          sourceLangForHint: sourceLangLabel,
          targetLangForHint: targetLangLabel,
          customConfig: { apiKey, model, apiUrl }
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || '请求失败');
      const data = await res.json();
      
      if (data.parsed && Array.isArray(data.parsed)) {
        setResults(data.parsed);
        if (autoSpeak && data.parsed.length > 0) {
          speak(data.parsed.find(r => r.recommended)?.translation || data.parsed[0].translation);
        }
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
    isVoiceInputRef.current = true; // 标记为语音输入
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
    if (audioRef.current) audioRef.current.pause();
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voiceSelection}&r=-10`;
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(e => console.error("TTS Error", e));
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
            <button onClick={() => { if(sourceLang !== 'auto'){ const temp = sourceLang; setSourceLang(targetLang); setTargetLang(temp);}}} className="p-1 rounded-full text-slate-300 hover:text-indigo-500 active:rotate-180 transition-transform"><ArrowRightLeft size={12} /></button>
            <button onClick={() => { setSelectorType('target'); setShowLangSelector(true); }} className="px-2 text-xs font-black text-indigo-800 flex items-center gap-1">{getTargetLabel()}<ChevronDown size={10} /></button>
          </div>
          <button onClick={()=>setShowSettings(true)} className="pointer-events-auto p-2 bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 rounded-full text-slate-600"><Settings size={16} /></button>
        </header>

        <main className="flex-1 overflow-y-auto px-3 pt-20 no-scrollbar space-y-2" style={{ paddingBottom: footerHeight + 10 }}>
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
            <AnimatePresence>
              {results.map((item) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className={`bg-white rounded-xl p-3 border shadow-sm flex flex-col gap-2 group ${item.recommended ? 'border-indigo-100 shadow-indigo-50' : 'border-slate-100'}`}
                >
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${item.recommended ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>{item.label}</span>
                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => speak(item.translation)} className="text-slate-400 hover:text-indigo-600"><Volume2 size={14} /></button>
                                <button onClick={() => navigator.clipboard.writeText(item.translation)} className="text-slate-400 hover:text-emerald-600"><Copy size={14} /></button>
                            </div>
                        </div>
                        <p className="text-base text-slate-800 font-medium leading-normal select-all">{item.translation}</p>
                        {item.back && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><ArrowRightLeft size={10}/> {item.back}</p>}
                    </div>
                </motion.div>
              ))}
            </AnimatePresence>
        </main>
        
        <div ref={footerRef} className="absolute bottom-0 left-0 right-0 z-30 pb-safe">
           {quickReplies.length > 0 && (
               <div className="px-3 mb-2"><div className="flex gap-2 overflow-x-auto no-scrollbar mask-fade-sides py-1">
                  {quickReplies.map((q, i) => ( 
                      <button key={i} onClick={() => { setInput(q); isVoiceInputRef.current = false; }} className="whitespace-nowrap px-3 py-1.5 bg-white border border-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold shadow-sm">{q}</button> 
                  ))}
               </div></div>
           )}
           <div className="bg-white/90 backdrop-blur-xl border-t border-slate-100 px-3 py-3 shadow-sm">
              <div className="relative">
                 <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); isVoiceInputRef.current = false; }} placeholder={isListening ? "聆听中..." : "输入或说话..."} className="w-full bg-slate-100 rounded-2xl border-2 border-transparent p-4 pr-24 resize-none text-base font-medium text-slate-800 outline-none min-h-[56px] max-h-[120px] focus:bg-white focus:border-indigo-200 transition-all" rows={1} />
                 <div className="absolute top-0 right-0 h-full flex items-center pr-3 gap-1">
                     <button onClick={() => { setSelectorType('source'); setShowLangSelector(true); }} className="h-8 w-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center transition-colors hover:bg-slate-300"><Globe size={16} /></button>
                     <button onClick={toggleListening} className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white'}`}><Mic size={16} /></button>
                 </div>
              </div>
              <div className="mt-2">
                 <button onClick={() => handleTranslate()} disabled={loading || !input.trim()} className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center shadow-lg shadow-indigo-200 disabled:bg-slate-300 disabled:shadow-none transition-all active:scale-95">
                    {loading ? <Loader2 className="animate-spin"/> : <Send/>}
                 </button>
              </div>
           </div>
        </div>

        {/* --- Modals --- */}
        <AnimatePresence>
          {showLangSelector && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end" onClick={()=>setShowLangSelector(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-[2rem] p-5 pb-safe max-h-[70vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
                <h3 className="text-base font-black text-slate-800 mb-4 text-center shrink-0">选择{selectorType === 'source' ? '识别语言' : '目标语言'}</h3>
                <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar pb-2">
                    {(selectorType === 'source' ? SOURCE_LANGUAGES : TARGET_LANGUAGES).map(lang => {
                        const isSelected = (selectorType === 'source' ? sourceLang : targetLang) === lang.code;
                        return <button key={lang.code} onClick={() => { const setter = selectorType === 'source' ? setSourceLang : setTargetLang; setter(lang.code); setShowLangSelector(false); }} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-slate-100'}`}><span className="font-bold text-xs">{lang.label}</span>{isSelected && <Check size={14} />}</button>
                    })}
                </div>
              </motion.div>
            </motion.div>
          )}
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full sm:w-[90%] sm:max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-safe" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-slate-900">设置</h3><button onClick={()=>setShowSettings(false)} className="bg-slate-100 text-slate-500 p-2 rounded-full hover:bg-slate-200"><X size={18}/></button></div>
                <div className="space-y-4">
                  <fieldset className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <legend className="flex items-center gap-2 px-1"><Voicemail size={14} className="text-indigo-600"/><span className="font-bold text-sm text-slate-700">发音人选择</span></legend>
                    <select value={voiceSelection} onChange={e => { setVoiceSelection(e.target.value); localStorage.setItem('tr_voice_selection', e.target.value); }} className="mt-2 w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none appearance-none">
                        {Object.entries(VOICE_LIBRARY).map(([lang, voices]) => (
                            <optgroup key={lang} label={lang}>
                                {voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                  </fieldset>

                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl"> 
                      <div><span className="font-bold text-slate-700 text-xs">自动朗读首条译文</span></div>
                      <input type="checkbox" checked={autoSpeak} onChange={e=>{setAutoSpeak(e.target.checked); localStorage.setItem('tr_auto_speak', e.target.checked)}} className="w-5 h-5 accent-indigo-600 rounded" /> 
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl"> 
                      <div><span className="font-bold text-slate-700 text-xs">语音后自动发送</span></div>
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
