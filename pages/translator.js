import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic'; // 引入 dynamic
import { 
  Mic, Send, Settings, Lock, KeyRound, X, 
  Volume2, Copy, BrainCircuit, ChevronLeft,
  Globe, Zap, ExternalLink, Sparkles,
  Loader2, ShieldCheck, ShieldAlert, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ACCESS_CODE = "fanyi"; // 默认密码

// 将原本的 TranslatorPage 改名为 TranslatorComponent
function TranslatorComponent() {
  const [mounted, setMounted] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [autoSend, setAutoSend] = useState(true);
  const [speedMode, setSpeedMode] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const recognitionRef = useRef(null);

  // 1. 初始化客户端状态
  useEffect(() => {
    setMounted(true);
    // 确保只在浏览器端运行 localStorage
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('tr_verified') === 'true') setIsVerified(true);
      setApiKey(localStorage.getItem('tr_api_key') || '');
      setAutoSend(localStorage.getItem('tr_auto_send') !== 'false');
      setSpeedMode(localStorage.getItem('tr_speed') === 'true');
      setSourceLang(localStorage.getItem('tr_src') || 'zh');
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

  // 2. 语音自动发送逻辑
  useEffect(() => {
    if (!isListening && autoSend && input.trim().length > 1 && !loading) {
      handleTranslate();
    }
  }, [isListening]);

  const handleVerify = () => {
    if (password === ACCESS_CODE) {
      setIsVerified(true);
      localStorage.setItem('tr_verified', 'true');
    } else {
      alert('密码错误');
      setPassword('');
    }
  };

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
          speedMode,
          customConfig: { apiKey }
        })
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results.sort((a,b) => (b.recommended?1:0) - (a.recommended?1:0)));
        setQuickReplies(data.quick_replies || []);
      }
    } catch (e) {
      alert('请求超时或 Key 错误');
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
      recognitionRef.current.lang = sourceLang === 'zh' ? 'zh-CN' : (sourceLang === 'en' ? 'en-US' : 'my-MM');
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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Head><title>AI 翻译官 Pro - 全屏极速版</title></Head>

      {!isVerified ? (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8">
          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl">
            <Lock size={32} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-black mb-2 text-slate-800">启动加密终端</h1>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full max-w-xs px-6 py-4 bg-slate-100 rounded-2xl mb-4 text-center outline-none focus:ring-2 ring-indigo-500 font-mono tracking-widest" placeholder="••••" />
          <button onClick={handleVerify} className="w-full max-w-xs py-4 bg-indigo-600 text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-indigo-100">验证访问</button>
        </div>
      ) : (
        <div className="flex flex-col h-screen max-w-md mx-auto relative overflow-hidden bg-white shadow-2xl">
          {/* Header */}
          <header className="flex justify-between items-center p-4 border-b bg-white/80 backdrop-blur z-30 sticky top-0">
            <Link href="/"><a className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft /></a></Link>
            <div className="text-center">
              <div className="font-black text-slate-800 flex items-center gap-1">智能翻译官 Pro {speedMode && <Zap size={14} className="text-amber-500 fill-amber-500"/>}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Engine v3.2</div>
            </div>
            <button onClick={()=>setShowSettings(true)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Settings /></button>
          </header>

          {/* Results Area */}
          <main className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-40">
            <AnimatePresence>
              {results.map((item, idx) => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={idx} className={`p-5 rounded-[2rem] border transition-all ${item.recommended ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-50/50' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{item.label}</span>
                    {item.recommended && <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600"><Star size={12} fill="currentColor"/> RECOMMENDED</div>}
                  </div>
                  <p className="text-xl font-bold text-slate-800 leading-relaxed mb-4 select-all">{item.translation}</p>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xl font-medium text-indigo-900/70 italic leading-snug"><span className="text-[10px] text-slate-300 not-italic font-black mr-2">↩ BACK:</span>{item.back_translation}</p>
                    <div className="flex justify-between items-center mt-4">
                      <div className="flex gap-1">
                         {item.similarity_score && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">{Math.round(item.similarity_score*100)}% Match</span>}
                         {item.risk_level && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.risk_level === 'low' ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50'}`}>Risk: {item.risk_level}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>speak(item.translation)} className="p-3 bg-white border border-slate-100 rounded-2xl active:bg-indigo-600 active:text-white transition-all shadow-sm"><Volume2 size={20}/></button>
                        <button onClick={()=>navigator.clipboard.writeText(item.translation)} className="p-3 bg-white border border-slate-100 rounded-2xl active:bg-green-600 active:text-white transition-all shadow-sm"><Copy size={20}/></button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-tighter">AI Processing...</p>
              </div>
            )}

            {results.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale">
                <BrainCircuit size={80} className="mb-4" />
                <p className="font-black text-center uppercase tracking-widest text-xs">Waiting for prompt</p>
              </div>
            )}
          </main>

          {/* Quick Replies Tray */}
          <div className="absolute bottom-[115px] left-0 right-0 px-4 z-20">
             <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                {quickReplies.map((q, i) => (
                  <button key={i} onClick={() => { setInput(q); handleTranslate(q); }} className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg shadow-indigo-100 active:scale-90 transition-all border border-indigo-400 flex items-center gap-1.5"><Sparkles size={12}/> {q}</button>
                ))}
             </div>
          </div>

          {/* Input Panel */}
          <div className="bg-white border-t p-4 pb-8 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
            <div className="relative mb-4">
              <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={isListening ? "正在聆听您的声音..." : "输入内容..."} className={`w-full bg-slate-100 rounded-[2rem] p-5 pr-14 resize-none h-24 text-lg font-medium outline-none focus:ring-2 ring-indigo-500/20 transition-all ${isListening ? 'bg-indigo-50 ring-indigo-200' : ''}`} />
              {input && <button onClick={()=>setInput('')} className="absolute top-4 right-4 p-1.5 bg-white text-slate-400 rounded-full shadow-sm hover:text-rose-500 transition-colors"><X size={18}/></button>}
            </div>
            
            <button 
              onClick={input.trim() ? () => handleTranslate() : toggleListening}
              disabled={loading}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-white shadow-xl transition-all active:scale-95 ${input.trim() ? 'bg-indigo-600 shadow-indigo-200' : (isListening ? 'bg-rose-500 shadow-rose-200 animate-pulse' : 'bg-slate-900 shadow-slate-200')}`}
            >
              {loading ? <Loader2 className="animate-spin"/> : (input.trim() ? <><Send size={20}/> 发送翻译</> : <><Mic size={24}/> {isListening ? '停止识别' : '按住说话'}</>)}
            </button>
          </div>

          {/* Settings Modal */}
          <AnimatePresence>
            {showSettings && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end" onClick={()=>setShowSettings(false)}>
                <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="w-full bg-white rounded-t-[3rem] p-8" onClick={e=>e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-indigo-900">系统偏好</h3>
                    <button onClick={()=>setShowSettings(false)} className="bg-slate-100 p-3 rounded-full active:bg-slate-200 transition-colors"><X size={24}/></button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-3xl">
                      <div className="font-black text-amber-900 text-sm flex items-center gap-2"><Zap size={16} fill="currentColor"/> 极速模式 (仅3条结果)</div>
                      <input type="checkbox" checked={speedMode} onChange={e=>{setSpeedMode(e.target.checked); localStorage.setItem('tr_speed', e.target.checked)}} className="w-6 h-6 accent-amber-600" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Source</label>
                        <select value={sourceLang} onChange={e=>{setSourceLang(e.target.value); localStorage.setItem('tr_src', e.target.value)}} className="w-full p-4 bg-slate-100 rounded-2xl font-bold outline-none appearance-none">
                          <option value="zh">🇨🇳 中文</option><option value="en">🇺🇸 英文</option><option value="my">🇲🇲 缅文</option><option value="auto">🤖 自动</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Target</label>
                        <select value={targetLang} onChange={e=>{setTargetLang(e.target.value); localStorage.setItem('tr_tar', e.target.value)}} className="w-full p-4 bg-slate-100 rounded-2xl font-bold outline-none appearance-none">
                          <option value="my">🇲🇲 缅文</option><option value="zh">🇨🇳 中文</option><option value="en">🇺🇸 英文</option><option value="th">🇹🇭 泰文</option><option value="vi">🇻🇳 越南</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-100 rounded-3xl">
                      <div className="font-black text-slate-700 text-sm">语音识别结束自动发送</div>
                      <input type="checkbox" checked={autoSend} onChange={e=>{setAutoSend(e.target.checked); localStorage.setItem('tr_auto_send', e.target.checked)}} className="w-6 h-6 accent-indigo-600" />
                    </div>

                    <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">API Configuration</label>
                        <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 font-bold flex items-center gap-1 hover:underline">申请心流 API <ExternalLink size={10}/></a>
                      </div>
                      <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value); localStorage.setItem('tr_api_key', e.target.value)}} placeholder="sk-xxxxxxxx" className="w-full bg-white/10 border-0 rounded-2xl p-4 text-sm font-mono outline-none" />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// 核心修复：使用 dynamic 包装组件并禁用服务端渲染 (SSR)
const TranslatorPage = dynamic(() => Promise.resolve(TranslatorComponent), {
  ssr: false,
});

export default TranslatorPage;
