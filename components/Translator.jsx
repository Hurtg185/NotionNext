// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, Settings, 
  Mic, Send, X, Sparkles, Cpu
} from 'lucide-react';

/**
 * 样式工具函数
 */
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// --- 全局样式：隐藏滚动条且支持 iOS 安全区域 ---
const globalStyles = `
  .hide-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  textarea { border: none; outline: none; resize: none; }
  .safe-pb { padding-bottom: env(safe-area-inset-bottom); }
`;

const LANGUAGES = {
  zh: { code: 'zh', name: '中文', flag: '🇨🇳', voice: 'zh-CN' },
  my: { code: 'my', name: 'မြန်မာ', flag: '🇲🇲', voice: 'my-MM' },
};

const DEFAULT_SETTINGS = {
  apiUrl: '/api/translate', 
  apiKey: '',
  model: 'deepseek-chat',
  autoRead: true,
  voiceAutoSend: false,
  ttsRate: 1.0,
  voiceName: '', // 发音人选择
};

// 预设模型列表
const MODELS = ['deepseek-chat', 'gpt-4o-mini', 'claude-3-haiku'];

const TRANSLATION_STYLES = {
  'raw-direct': { label: '原结构直译', color: 'text-blue-700', bg: 'bg-blue-50/50', border: 'border-blue-200' },
  'natural-direct': { label: '自然直译', color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
  'fluent-direct': { label: '顺语直译', color: 'text-purple-700', bg: 'bg-purple-50/50', border: 'border-purple-200' },
  'spoken': { label: '口语版', color: 'text-orange-700', bg: 'bg-orange-50/50', border: 'border-orange-200' },
  'free': { label: '自然意译', color: 'text-pink-700', bg: 'bg-pink-50/50', border: 'border-pink-200' },
};

export default function Translator() {
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [translations, setTranslations] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('zh');
  const [voices, setVoices] = useState([]);

  const recognitionRef = useRef(null);
  const resultEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // 初始化设置与发音人
  useEffect(() => {
    const saved = localStorage.getItem('app_settings_v4');
    if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  // 自动滚动
  useEffect(() => {
    if (status === 'streaming' || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations, status]);

  // 立即切换语言
  const swapLanguages = useCallback(() => {
    const oldSource = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(oldSource);
    setVoiceLang(targetLang); 
    setTranslations([]);
    setStreamingText('');
  }, [sourceLang, targetLang]);

  // 快速切换模型
  const cycleModel = () => {
    const currentIndex = MODELS.indexOf(settings.model);
    const nextModel = MODELS[(currentIndex + 1) % MODELS.length];
    const newSettings = { ...settings, model: nextModel };
    setSettings(newSettings);
    localStorage.setItem('app_settings_v4', JSON.stringify(newSettings));
  };

  const handleTranslate = async () => {
    if (!inputText.trim() || status === 'streaming') return;
    setStatus('streaming');
    setTranslations([]);
    setStreamingText('');
    setErrorMsg('');

    try {
      const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          sourceLang,
          targetLang,
          customConfig: {
            apiKey: settings.apiKey,
            model: settings.model,
            apiUrl: 'https://apis.iflow.cn/v1' 
          }
        }),
      });

      if (!response.ok) throw new Error('翻译引擎连接失败');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const splitIndex = buffer.indexOf('\n|||FINAL_JSON|||\n');

        if (splitIndex !== -1) {
          const jsonPart = buffer.substring(splitIndex + '\n|||FINAL_JSON|||\n'.length);
          try {
            const data = JSON.parse(jsonPart);
            setTranslations(data.parsed || []);
            if (settings.autoRead) {
              const rec = data.parsed.find(t => t.recommended);
              if (rec) speakText(rec.translation, targetLang);
            }
          } catch (e) { console.error(e); }
          setStatus('idle');
          setStreamingText(''); 
          break;
        } else {
          setStreamingText(prev => prev + chunk);
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('当前浏览器环境不支持语音识别');
    if (isListening) return recognitionRef.current?.stop();

    const rec = new SR();
    rec.lang = voiceLang === 'zh' ? 'zh-CN' : 'my-MM';
    rec.interimResults = true;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => setInputText(Array.from(e.results).map(r => r[0].transcript).join(''));
    rec.onend = () => {
      setIsListening(false);
      if (settings.voiceAutoSend && inputText.trim()) {
        setTimeout(() => document.getElementById('send-btn')?.click(), 400);
      }
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const speakText = (text, lang) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANGUAGES[lang]?.voice || 'zh-CN';
      u.rate = settings.ttsRate;
      if (settings.voiceName) {
        const selectedVoice = voices.find(v => v.name === settings.voiceName);
        if (selectedVoice) u.voice = selectedVoice;
      }
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans select-none">
      <style>{globalStyles}</style>

      {/* 顶部：快速切换 + 折叠效果 */}
      <header className="flex-none bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 active:bg-slate-100 rounded-full transition">
            <Settings className="w-5 h-5" />
          </button>

          <div 
            onClick={swapLanguages}
            className="flex items-center gap-3 bg-slate-900 text-white px-5 py-1.5 rounded-full active:scale-95 transition-transform shadow-lg shadow-slate-200"
          >
            <span className="text-xs font-bold tracking-tight">{LANGUAGES[sourceLang].name}</span>
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            <span className="text-xs font-bold tracking-tight">{LANGUAGES[targetLang].name}</span>
          </div>

          <div className="w-9 flex justify-end">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </header>

      {/* 中间：翻译结果滚动区 */}
      <main ref={scrollContainerRef} className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-4 pb-24 space-y-4">
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-slate-200">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Intelligence Translation</p>
          </div>
        )}

        <AnimatePresence>
          {status === 'streaming' && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100">
               <div className="flex items-center gap-2 mb-4">
                 <div className="flex gap-1">
                   <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                   <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                   <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                 </div>
                 <span className="text-[10px] font-black text-emerald-600 tracking-widest uppercase">Streaming...</span>
               </div>
               <p className="text-lg text-slate-800 leading-relaxed font-medium">{streamingText}</p>
             </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {translations.map((item, idx) => (
            <ResultCard 
              key={idx}
              item={item}
              style={TRANSLATION_STYLES[item.id] || TRANSLATION_STYLES['natural-direct']}
              targetLang={targetLang}
              onSpeak={speakText}
            />
          ))}
        </div>

        {errorMsg && <div className="p-4 bg-red-50 text-red-500 rounded-2xl text-center text-xs font-bold border border-red-100">{errorMsg}</div>}
        <div ref={resultEndRef} className="h-2" />
      </main>

      {/* 底部：固定大输入框 + 组合按钮 */}
      <footer className="flex-none bg-white border-t border-slate-100 p-4 safe-pb z-50">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          
          <div className="flex items-center justify-between px-1">
             <div className="flex gap-2">
                <button
                  onClick={() => setVoiceLang(prev => (prev === 'zh' ? 'my' : 'zh'))}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-500 active:bg-slate-200 transition"
                >
                  VOICE: {voiceLang.toUpperCase()}
                </button>
                <button
                  onClick={cycleModel}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-500 active:bg-slate-200 transition flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3" /> {settings.model.toUpperCase()}
                </button>
             </div>
             <span className="text-[10px] font-bold text-slate-300">{inputText.length} chars</span>
          </div>

          <div className="relative flex items-end gap-2 bg-slate-100 rounded-[24px] p-2 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-100 border border-transparent focus-within:border-slate-200">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type anything..."}
              className="flex-1 bg-transparent p-3 text-base min-h-[56px] max-h-40 leading-relaxed"
              rows={1}
            />

            <AnimatePresence mode="wait">
              {!inputText.trim() ? (
                <motion.button
                  key="mic" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  onClick={startListening}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all",
                    isListening ? "bg-red-500 animate-pulse" : "bg-slate-900 active:scale-90"
                  )}
                >
                  <Mic className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.button
                  key="send" id="send-btn" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  onClick={handleTranslate}
                  disabled={status === 'streaming'}
                  className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-50"
                >
                  {status === 'streaming' ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 ml-0.5" />}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </footer>

      {/* 设置中心 */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        settings={settings} 
        setSettings={setSettings} 
        voices={voices}
      />
    </div>
  );
}

// --- 子组件：紧凑卡片 ---
function ResultCard({ item, style, targetLang, onSpeak }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(item.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-white rounded-[24px] shadow-sm border overflow-hidden transition-all active:scale-[0.99]", style.border)}>
      <div className={cn("px-4 py-2 flex justify-between items-center", style.bg)}>
        <span className={cn("text-[9px] font-black uppercase tracking-widest", style.color)}>{style.label}</span>
        {item.recommended && <div className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] font-black italic">RECOMMENDED</div>}
      </div>
      
      <div className="p-4 pt-3">
        <p className="text-base text-slate-800 font-bold leading-relaxed mb-1">{item.translation}</p>
        
        {/* 回译：蓝色小字 */}
        {item.back && (
          <p className="text-[11px] text-blue-500/70 font-medium leading-snug mb-3">
             <ArrowRightLeft className="w-2.5 h-2.5 inline mr-1 opacity-50" />
             {item.back}
          </p>
        )}

        <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-50">
          <button onClick={() => onSpeak(item.translation, targetLang)} className="p-2 text-slate-400 active:text-blue-500 active:bg-blue-50 rounded-xl transition">
            <Volume2 className="w-4 h-4" />
          </button>
          <button onClick={handleCopy} className="p-2 text-slate-400 active:text-emerald-500 active:bg-emerald-50 rounded-xl transition">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- 子组件：设置弹窗 ---
function SettingsModal({ isOpen, onClose, settings, setSettings, voices }) {
  if (!isOpen) return null;
  const update = (k, v) => {
    const s = { ...settings, [k]: v };
    setSettings(s);
    localStorage.setItem('app_settings_v4', JSON.stringify(s));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-black text-slate-800 tracking-tighter uppercase">Translator Config</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm active:scale-90 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto hide-scrollbar">
          <div className="space-y-4">
             <div className="grid grid-cols-1 gap-4">
               <label className="block">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Endpoint</span>
                 <input type="text" value={settings.apiUrl} onChange={e => update('apiUrl', e.target.value)} className="mt-1 w-full p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
               </label>
               <label className="block">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key</span>
                 <input type="password" value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} className="mt-1 w-full p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
               </label>
             </div>
          </div>

          <div className="p-5 bg-slate-50 rounded-[24px] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Auto Send after Speech</span>
              <input type="checkbox" checked={settings.voiceAutoSend} onChange={e => update('voiceAutoSend', e.target.checked)} className="w-6 h-6 rounded-lg text-slate-900 focus:ring-0" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Auto Read Result</span>
              <input type="checkbox" checked={settings.autoRead} onChange={e => update('autoRead', e.target.checked)} className="w-6 h-6 rounded-lg text-blue-600 focus:ring-0" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Speaker (TTS Voice)</span>
              <select 
                value={settings.voiceName} 
                onChange={e => update('voiceName', e.target.value)}
                className="mt-1 w-full p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold appearance-none"
              >
                <option value="">Default System Voice</option>
                {voices.filter(v => v.lang.includes('zh') || v.lang.includes('my') || v.lang.includes('en')).map((v, i) => (
                  <option key={i} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reading Speed: {settings.ttsRate}x</span>
              <input type="range" min="0.5" max="1.5" step="0.1" value={settings.ttsRate} onChange={e => update('ttsRate', parseFloat(e.target.value))} className="mt-2 w-full h-2 bg-slate-100 rounded-lg appearance-none accent-slate-900" />
            </label>
          </div>
        </div>

        <div className="p-6 bg-slate-900 text-center">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Advanced Translation Engine v4.0</p>
        </div>
      </motion.div>
    </div>
  );
}
