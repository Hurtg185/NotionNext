import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronLeft,
  ExternalLink, Sparkles,
  Loader2, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import Link from 'next/link';

// 定义支持的语言列表，方便复用
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

// 关键：我们将之前的 TranslatorMain 组件重命名为 TranslatorUI
export default function TranslatorUI() {
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');
  const [autoSend, setAutoSend] = useState(true);

  // --- 支持自定义配置的状态 ---
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v3.2');
  const [apiUrl, setApiUrl] = useState('https://apis.iflow.cn/v1');

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
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
    }
  }, []);

  useEffect(() => {
    if (!isListening && autoSend && input.trim().length > 1 && !loading) {
      handleTranslate();
    }
  }, [isListening]);

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
      const recognitionLangMap = { zh: 'zh-CN', en: 'en-US', my: 'my-MM'};
      recognitionRef.current.lang = recognitionLangMap[sourceLang] || 'zh-CN'; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speak = (text) => {
    if (typeof window === 'undefined') return;
    const voiceMap = { my: 'my-MM-NilarNeural', zh: 'zh-CN-XiaoxiaoNeural', en: 'en-US-JennyNeural' };
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voiceMap[targetLang] || 'my-MM-NilarNeural'}&r=-10`;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  const handleSourceLangChange = (lang) => {
    setSourceLang(lang);
    localStorage.setItem('tr_src', lang);
  }

  const handleTargetLangChange = (lang) => {
    setTargetLang(lang);
    localStorage.setItem('tr_tar', lang);
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Head><title>AI 翻译官 Pro - Cloudflare 版</title></Head>

      <div className="flex flex-col h-screen max-w-md mx-auto relative overflow-hidden bg-white shadow-2xl">
        <header className="flex justify-between items-center p-4 border-b bg-white/80 backdrop-blur z-30 sticky top-0">
          <Link href="/"><a className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft /></a></Link>
          <div className="text-center">
            <div className="font-black text-slate-800 flex items-center gap-1">智能翻译官 Pro</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Engine v3.2</div>
          </div>
          <button onClick={()=>setShowSettings(true)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Settings /></button>
        </header>
        
        <div className="px-4 pt-3 pb-2 border-b bg-white z-10">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-slate-400 mr-2">译为:</span>
                {TARGET_LANGUAGES.map(lang => (
                    <button 
                        key={lang.code}
                        onClick={() => handleTargetLangChange(lang.code)}
                        className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all whitespace-nowrap ${targetLang === lang.code ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {lang.label}
                    </button>
                ))}
            </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-40">
          <AnimatePresence>
            {results.map((item, idx) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={idx} className={`p-5 rounded-[2rem] border transition-all ${item.recommended ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-50/50' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{item.label}</span>
                  {item.recommended && <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600"><Star size={12} fill="currentColor"/> RECOMMENDED</div>}
                </div>
                <p className="text-lg font-medium text-slate-800 leading-relaxed mb-4 select-all whitespace-pre-wrap">{item.translation}</p>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={()=>speak(item.translation)} className="p-3 bg-white border border-slate-100 rounded-2xl active:bg-indigo-600 active:text-white transition-all shadow-sm"><Volume2 size={20}/></button>
                  <button onClick={()=>{ if(typeof navigator !== 'undefined') navigator.clipboard.writeText(item.translation) }} className="p-3 bg-white border border-slate-100 rounded-2xl active:bg-green-600 active:text-white transition-all shadow-sm"><Copy size={20}/></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && ( <div className="flex flex-col items-center justify-center py-20 gap-4"> <Loader2 size={40} className="animate-spin text-indigo-600" /> <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-tighter">AI Processing...</p> </div> )}
          {results.length === 0 && !loading && ( <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale"> <BrainCircuit size={80} className="mb-4" /> <p className="font-black text-center uppercase tracking-widest text-xs">Waiting for prompt</p> </div> )}
        </main>
        
        <div className="absolute bottom-[130px] left-0 right-0 px-4 z-20">
           <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              {quickReplies.map((q, i) => ( <button key={i} onClick={() => { setInput(q); handleTranslate(q); }} className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg shadow-indigo-100 active:scale-90 transition-all border border-indigo-400 flex items-center gap-1.5"><Sparkles size={12}/> {q}</button> ))}
           </div>
        </div>

        <div className="bg-white border-t p-4 pb-8 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
          <div className="px-1 pb-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <span className="text-xs font-bold text-slate-400 mr-2">原文:</span>
                  {SOURCE_LANGUAGES.map(lang => ( <button key={lang.code} onClick={() => handleSourceLangChange(lang.code)} className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap ${sourceLang === lang.code ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}> {lang.label} </button> ))}
              </div>
          </div>
          <div className="relative">
            <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} placeholder={isListening ? "正在聆听您的声音..." : "输入内容..."} className={`w-full bg-slate-100 rounded-[2rem] p-5 pr-14 resize-none min-h-[6rem] text-lg font-medium outline-none focus:ring-2 ring-indigo-500/20 transition-all overflow-y-hidden ${isListening ? 'bg-indigo-50 ring-indigo-200' : ''}`} rows={1} />
            {input && <button onClick={()=>setInput('')} className="absolute top-4 right-4 p-1.5 bg-white text-slate-400 rounded-full shadow-sm hover:text-rose-500 transition-colors"><X size={18}/></button>}
          </div>
          <button onClick={input.trim() ? () => handleTranslate() : toggleListening} disabled={loading} className={`w-full mt-4 py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-white shadow-xl transition-all active:scale-95 ${input.trim() ? 'bg-indigo-600 shadow-indigo-200' : (isListening ? 'bg-rose-500 shadow-rose-200 animate-pulse' : 'bg-slate-900 shadow-slate-200')}`}>
            {loading ? <Loader2 className="animate-spin"/> : (input.trim() ? <><Send size={20}/> 发送翻译</> : <><Mic size={24}/> {isListening ? '停止识别' : '按住说话'}</>)}
          </button>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end" onClick={()=>setShowSettings(false)}>
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-[3rem] p-8" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-indigo-900">系统偏好</h3>
                  <button onClick={()=>setShowSettings(false)} className="bg-slate-100 p-3 rounded-full active:bg-slate-200 transition-colors"><X size={24}/></button>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-100 rounded-3xl"> <div className="font-black text-slate-700 text-sm">语音识别结束自动发送</div> <input type="checkbox" checked={autoSend} onChange={e=>{setAutoSend(e.target.checked); localStorage.setItem('tr_auto_send', e.target.checked)}} className="w-6 h-6 accent-indigo-600" /> </div>
                  <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
                    <div className="flex justify-between items-center mb-4"> <label className="text-xs font-black text-slate-500 uppercase tracking-widest">API Configuration</label> <a href="https://iflow.cn/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 font-bold flex items-center gap-1 hover:underline">获取 API <ExternalLink size={10}/></a> </div>
                    <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="API Key (sk-xxxxxxxx)" className="w-full bg-white/10 border-0 rounded-2xl p-4 text-sm font-mono outline-none mb-3" />
                    <input type="text" value={apiUrl} onChange={e=>{setApiUrl(e.target.value); localStorage.setItem('tr_api_url', e.target.value)}} placeholder="API URL (e.g. https://api.openai.com/v1)" className="w-full bg-white/10 border-0 rounded-2xl p-4 text-sm font-mono outline-none mb-3" />
                    <select value={model} onChange={e=>{setModel(e.target.value); localStorage.setItem('tr_model', e.target.value)}} className="w-full p-4 bg-white/10 border-0 text-white rounded-2xl font-bold outline-none appearance-none">
                      <option value="deepseek-v3.2">DeepSeek V3.2 (推荐)</option>
                      <option value="qwen3-235b">Qwen3 235B</option>
                    </select>
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
