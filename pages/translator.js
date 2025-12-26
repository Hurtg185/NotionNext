import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Mic, Send, Settings, Lock, KeyRound, X, 
  Volume2, Copy, BrainCircuit, ChevronLeft,
  Globe, Zap, ExternalLink, MessageSquare, Sparkles,
  Loader2, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// 全局配置
// ==========================================
const DEFAULT_ACCESS_CODE = "fanyi"; // 进门密码

export default function TranslatorPage() {
  // --- 状态管理 ---
  const [isVerified, setIsVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // 核心交互
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]); // 智能回复
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // 设置项
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [autoSend, setAutoSend] = useState(false);
  const [speedMode, setSpeedMode] = useState(false); // 极速模式开关
  const [customApiKey, setCustomApiKey] = useState('');
  
  const recognitionRef = useRef(null);

  // --- 初始化：读取本地存储 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const verified = localStorage.getItem('translator_unlocked');
      if (verified === 'true') setIsVerified(true);
      
      setCustomApiKey(localStorage.getItem('user_api_key') || '');
      setAutoSend(localStorage.getItem('voice_auto_send') === 'true');
      setSpeedMode(localStorage.getItem('trans_speed_mode') === 'true');
      setSourceLang(localStorage.getItem('trans_source_lang') || 'zh');
      setTargetLang(localStorage.getItem('trans_target_lang') || 'my');
    }
  }, []);

  // --- 1. 密码验证逻辑 ---
  const handleLogin = () => {
    if (passwordInput === DEFAULT_ACCESS_CODE) {
      setIsVerified(true);
      localStorage.setItem('translator_unlocked', 'true');
    } else {
      alert('密码错误 / Incorrect Password');
      setPasswordInput('');
    }
  };

  // --- 2. 设置保存逻辑 ---
  const saveSettings = (key, value) => {
    localStorage.setItem(key, value);
    if (key === 'user_api_key') setCustomApiKey(value);
    if (key === 'voice_auto_send') setAutoSend(value === 'true');
    if (key === 'trans_speed_mode') setSpeedMode(value === 'true');
    if (key === 'trans_source_lang') setSourceLang(value);
    if (key === 'trans_target_lang') setTargetLang(value);
  };

  // --- 3. 语音识别逻辑 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        
        recognition.onresult = (e) => {
          const text = Array.from(e.results).map(r => r[0].transcript).join('');
          setInput(text);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
  }, []);

  // 监听语音结束自动发送
  useEffect(() => {
    if (!isListening && autoSend && input.trim().length > 1 && !loading) {
      handleTranslate();
    }
  }, [isListening]);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert('浏览器不支持语音识别');
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      let langCode = 'zh-CN';
      if (sourceLang === 'en') langCode = 'en-US';
      if (sourceLang === 'my') langCode = 'my-MM'; 
      
      recognitionRef.current.lang = langCode;
      recognitionRef.current.start();
      setIsListening(true);
      setInput('');
    }
  };

  // --- 4. 翻译核心逻辑 ---
  const handleTranslate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResults([]);
    setQuickReplies([]);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input,
          sourceLang,
          targetLang,
          speedMode, // 传递极速模式标记
          customConfig: { apiKey: customApiKey }
        })
      });
      
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        if (data.quick_replies) setQuickReplies(data.quick_replies);
      } else if (data.error) {
        alert(data.error);
      }
      
    } catch (e) {
      alert('翻译失败，请检查网络或 Key');
    } finally {
      setLoading(false);
    }
  };

  // TTS 发音
  const speak = (text) => {
    const voiceMap = { 'my': 'my-MM-NilarNeural', 'zh': 'zh-CN-XiaoxiaoNeural', 'en': 'en-US-JennyNeural' };
    const v = voiceMap[targetLang] || 'en-US-JennyNeural';
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${v}&r=-10`;
    new Audio(url).play().catch(console.error);
  };

  // 点击智能回复
  const handleQuickReply = (text) => {
    setInput(text);
    // 可选：点击直接发送
    // setTimeout(() => handleTranslate(), 100); 
  };

  // 风险图标
  const RiskIcon = ({ level }) => {
    if (!level) return null;
    if (level === 'low') return <ShieldCheck size={12} className="text-green-500" />;
    return <ShieldAlert size={12} className="text-amber-500" />;
  };

  // --- UI 渲染 ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Head>
        <title>AI 智能翻译官 Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* 🔒 锁屏界面 */}
      {!isVerified && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <Lock size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">访问受限</h1>
          <p className="text-slate-500 mb-8 text-sm">请输入密码以进入独立翻译系统</p>
          
          <div className="w-full max-w-xs relative mb-4">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
            <input 
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="输入密码 (默认 fanyi)"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button onClick={handleLogin} className="w-full max-w-xs py-3.5 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-all">
            解锁进入
          </button>
        </div>
      )}

      {/* ✅ 主界面 */}
      {isVerified && (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-2xl relative">
          
          {/* 顶栏 */}
          <header className="flex justify-between items-center p-4 border-b border-slate-100 bg-white/80 backdrop-blur z-10 sticky top-0">
            <Link href="/">
              <a className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-full"><ChevronLeft /></a>
            </Link>
            <div className="flex flex-col items-center">
              <span className="font-black text-slate-800 flex items-center gap-1">
                 AI 翻译官 {speedMode && <Zap size={12} className="text-amber-500" fill="currentColor"/>}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Pro Version</span>
            </div>
            <button onClick={() => setShowSettings(true)} className="p-2 -mr-2 text-slate-500 hover:bg-slate-50 rounded-full">
              <Settings />
            </button>
          </header>

          {/* 滚动内容区 */}
          <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4 custom-scrollbar">
            {results.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-64 opacity-40">
                <BrainCircuit size={64} className="text-slate-300 mb-4" />
                <p className="text-sm font-bold text-slate-400">准备就绪，请开始输入</p>
              </div>
            )}

            {/* 智能回复建议 (显示在结果上方或空状态时) */}
            {quickReplies.length > 0 && (
              <div className="mb-2 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Sparkles size={10} /> 智能回复建议
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((reply, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleQuickReply(reply)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 active:scale-95 transition-all"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.map((item, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border transition-all ${item.recommended ? 'bg-blue-50/30 border-blue-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${item.recommended ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.label}
                    </span>
                    {item.risk && <RiskIcon level={item.risk} />}
                  </div>
                  {item.recommended && <span className="text-[10px] font-black text-amber-500 flex items-center gap-1"><Zap size={12} fill="currentColor"/> 推荐</span>}
                </div>
                
                {/* 译文主体 */}
                <p className="text-lg font-bold text-slate-800 leading-relaxed mb-3 select-all">
                  {item.translation}
                </p>
                
                {/* 回译 (字体加大) */}
                <div className="pt-3 border-t border-slate-100/50">
                  <p className="text-base text-slate-500 leading-snug mb-2 font-medium">
                    <span className="text-[10px] text-slate-300 uppercase mr-1 align-middle">BACK:</span>
                    {item.back_translation}
                  </p>
                </div>

                {/* 操作栏 */}
                <div className="flex justify-end gap-3 mt-2">
                  <button onClick={() => speak(item.translation)} className="p-2 text-slate-400 hover:text-blue-500 bg-slate-50 rounded-full active:scale-90 transition-transform">
                    <Volume2 size={18} />
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(item.translation)} className="p-2 text-slate-400 hover:text-green-500 bg-slate-50 rounded-full active:scale-90 transition-transform">
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <p className="text-xs font-bold text-slate-400 animate-pulse">AI 正在深度思考...</p>
              </div>
            )}
          </main>

          {/* 底部输入区 */}
          <div className="bg-white border-t border-slate-100 p-4 pb-8 z-20">
            <div className="relative mb-3">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "正在聆听..." : "输入文字..."}
                className={`w-full bg-slate-50 rounded-2xl p-4 pr-12 resize-none h-24 text-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isListening ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}
              />
              {input && (
                <button onClick={() => setInput('')} className="absolute top-3 right-3 p-1 text-slate-400 bg-white rounded-full shadow-sm">
                  <X size={16} />
                </button>
              )}
            </div>
            
            {/* 核心按钮：有字发送，无字语音 */}
            <button 
              onClick={input.trim() ? handleTranslate : toggleListening}
              disabled={loading}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white shadow-xl active:scale-95 transition-all ${
                input.trim() 
                  ? 'bg-blue-600 shadow-blue-200' 
                  : (isListening ? 'bg-rose-500 animate-pulse shadow-rose-200' : 'bg-slate-800 shadow-slate-300')
              }`}
            >
              {loading ? (
                 <span className="flex items-center gap-2">思考中...</span> 
              ) : (
                input.trim() ? <><Send size={20}/> 发送翻译</> : <><Mic size={24}/> 长按或点击说话</>
              )}
            </button>
          </div>

          {/* 设置弹窗 */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
                onClick={() => setShowSettings(false)}
              >
                <motion.div 
                  initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                  className="w-full bg-white rounded-t-3xl p-6"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-slate-800">全局设置</h3>
                    <button onClick={() => setShowSettings(false)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button>
                  </div>

                  <div className="space-y-5">
                    {/* 极速模式开关 */}
                    <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
                      <div>
                        <span className="font-bold text-amber-900 text-sm flex items-center gap-1">
                           <Zap size={14} fill="currentColor"/> 极速模式 (Speed Mode)
                        </span>
                        <p className="text-[10px] text-amber-700/70 mt-0.5">仅生成 3 种结果，速度更快</p>
                      </div>
                      <input type="checkbox" checked={speedMode} onChange={e => saveSettings('trans_speed_mode', e.target.checked ? 'true' : 'false')} className="w-5 h-5 accent-amber-500"/>
                    </div>

                    {/* 语言选择 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">源语言 (Source)</label>
                        <select value={sourceLang} onChange={e => saveSettings('trans_source_lang', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none">
                          <option value="zh">中文 (Chinese)</option>
                          <option value="en">English</option>
                          <option value="my">缅甸语 (Burmese)</option>
                          <option value="auto">自动识别</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">目标语言 (Target)</label>
                        <select value={targetLang} onChange={e => saveSettings('trans_target_lang', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none">
                          <option value="my">缅甸语 (Burmese)</option>
                          <option value="zh">中文 (Chinese)</option>
                          <option value="en">English</option>
                          <option value="th">泰语 (Thai)</option>
                          <option value="vi">越南语 (Vietnamese)</option>
                          <option value="jp">日语 (Japanese)</option>
                        </select>
                      </div>
                    </div>

                    {/* 语音自动发送 */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="font-bold text-slate-700 text-sm">语音结束自动发送</span>
                      <input type="checkbox" checked={autoSend} onChange={e => saveSettings('voice_auto_send', e.target.checked ? 'true' : 'false')} className="w-5 h-5 accent-blue-600"/>
                    </div>

                    {/* API Key */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">自定义 API Key (心流)</label>
                      <input 
                        type="password" 
                        value={customApiKey}
                        onChange={e => saveSettings('user_api_key', e.target.value)}
                        placeholder="sk-xxxxxxxx"
                        className="w-full bg-white p-2 rounded-lg border border-slate-200 text-sm font-mono mb-2"
                      />
                      <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                        <ExternalLink size={10} /> 申请 SiliconFlow API Key
                      </a>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}
    </div>
  );
}
