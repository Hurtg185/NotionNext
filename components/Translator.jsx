// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, Settings, 
  Mic, Send, X, Sparkles, Cpu
} from 'lucide-react';

// --- 工具函数：合并类名 ---
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// --- 样式注入：解决滚动条和 iOS 安全区域 ---
const globalStyles = `
  .hide-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  textarea { border: none; outline: none; resize: none; -webkit-appearance: none; }
  .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
  /* 解决 iOS 点击缩放问题 */
  @media screen and (max-width: 768px) {
    input, textarea, select { font-size: 16px !important; }
  }
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
  voiceName: '', 
};

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
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  const recognitionRef = useRef(null);
  const resultEndRef = useRef(null);

  // --- 核心修复：监听视口高度，防止键盘弹出或地址栏遮挡输入框 ---
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      }
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // 加载设置和发音人
  useEffect(() => {
    const saved = localStorage.getItem('app_settings_v5');
    if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  useEffect(() => {
    if (status === 'streaming' || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations, status]);

  const swapLanguages = useCallback(() => {
    const oldSource = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(oldSource);
    setVoiceLang(targetLang); 
    setTranslations([]);
    setStreamingText('');
  }, [sourceLang, targetLang]);

  const cycleModel = () => {
    const currentIndex = MODELS.indexOf(settings.model);
    const nextModel = MODELS[(currentIndex + 1) % MODELS.length];
    const newSettings = { ...settings, model: nextModel };
    setSettings(newSettings);
    localStorage.setItem('app_settings_v5', JSON.stringify(newSettings));
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

      if (!response.ok) throw new Error('翻译引擎故障');

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
    if (!SR) return alert('此浏览器不支持语音识别');
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SR();
    rec.lang = voiceLang === 'zh' ? 'zh-CN' : 'my-MM';
    rec.interimResults = true;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => setInputText(Array.from(e.results).map(r => r[0].transcript).join(''));
    rec.onend = () => {
      setIsListening(false);
      if (settings.voiceAutoSend && inputText.trim()) {
        setTimeout(() => document.getElementById('send-btn')?.click(), 500);
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
    <div 
      className="fixed inset-0 flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans"
      style={{ height: viewportHeight }}
    >
      <style>{globalStyles}</style>

      {/* 顶部导航 */}
      <header className="flex-none bg-white border-b border-slate-200 z-50 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400">
            <Settings className="w-5 h-5" />
          </button>

          <div 
            onClick={swapLanguages}
            className="flex items-center gap-3 bg-slate-900 text-white px-5 py-1.5 rounded-full active:scale-95 transition-all shadow-md"
          >
            <span className="text-xs font-bold uppercase tracking-wider">{LANGUAGES[sourceLang].name}</span>
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider">{LANGUAGES[targetLang].name}</span>
          </div>

          <div className="w-9"></div>
        </div>
      </header>

      {/* 翻译结果滚动区 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-4 space-y-4">
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-[50vh] flex flex-col items-center justify-center text-slate-200">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Neutral Neural Engine</p>
          </div>
        )}

        {/* 流式预览 */}
        <AnimatePresence>
          {status === 'streaming' && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
               <div className="flex items-center gap-2 mb-3">
                 <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                 <span className="text-[10px] font-black text-emerald-600 uppercase">Translating...</span>
               </div>
               <p className="text-lg text-slate-800 leading-relaxed font-medium">{streamingText}</p>
             </motion.div>
          )}
        </AnimatePresence>

        {/* 卡片结果 */}
        <div className="space-y-4">
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
        <div ref={resultEndRef} className="h-4" />
      </main>

      {/* 底部固定输入区 - 这里的 z-index 和背景颜色至关重要 */}
      <footer className="flex-none bg-white border-t border-slate-100 p-4 safe-area-bottom z-[60] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          
          <div className="flex items-center justify-between px-1">
             <div className="flex gap-2">
                <button
                  onClick={() => setVoiceLang(prev => (prev === 'zh' ? 'my' : 'zh'))}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-500"
                >
                  SPEECH: {voiceLang.toUpperCase()}
                </button>
                <button
                  onClick={cycleModel}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-500 flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3" /> {settings.model.toUpperCase()}
                </button>
             </div>
          </div>

          <div className="relative flex items-end gap-2 bg-slate-100 rounded-[22px] p-2 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-100 border border-transparent focus-within:border-slate-200">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type text..."}
              className="flex-1 bg-transparent p-3 text-base min-h-[48px] max-h-32 leading-relaxed font-medium"
              rows={1}
            />

            <AnimatePresence mode="wait">
              {!inputText.trim() ? (
                <motion.button
                  key="mic" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                  onClick={startListening}
                  className={cn(
                    "w-11 h-11 rounded-[18px] flex items-center justify-center text-white shadow-lg",
                    isListening ? "bg-red-500 animate-pulse" : "bg-slate-900"
                  )}
                >
                  <Mic className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.button
                  key="send" id="send-btn" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                  onClick={handleTranslate}
                  disabled={status === 'streaming'}
                  className="w-11 h-11 rounded-[18px] bg-blue-600 text-white flex items-center justify-center shadow-lg disabled:opacity-50"
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

// --- 卡片组件 ---
function ResultCard({ item, style, targetLang, onSpeak }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(item.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-white rounded-[24px] shadow-sm border overflow-hidden", style.border)}>
      <div className={cn("px-4 py-2 flex justify-between items-center", style.bg)}>
        <span className={cn("text-[9px] font-black uppercase tracking-widest", style.color)}>{style.label}</span>
        {item.recommended && <div className="bg-white/60 text-emerald-600 px-2 py-0.5 rounded-full text-[8px] font-black">RECOMMENDED</div>}
      </div>
      
      <div className="p-4 pt-3">
        <p className="text-base text-slate-800 font-bold leading-relaxed mb-1">{item.translation}</p>
        
        {/* 回译：蓝色小字 */}
        {item.back && (
          <p className="text-[11px] text-blue-500/80 font-medium mb-3">
             {item.back}
          </p>
        )}

        <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-50">
          <button onClick={() => onSpeak(item.translation, targetLang)} className="p-2 text-slate-400 active:text-blue-500"><Volume2 className="w-4 h-4" /></button>
          <button onClick={handleCopy} className="p-2 text-slate-400 active:text-emerald-500">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- 设置弹窗 ---
function SettingsModal({ isOpen, onClose, settings, setSettings, voices }) {
  if (!isOpen) return null;
  const update = (k, v) => {
    const s = { ...settings, [k]: v };
    setSettings(s);
    localStorage.setItem('app_settings_v5', JSON.stringify(s));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-black text-slate-800 uppercase tracking-tighter">System Config</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto hide-scrollbar">
          <div className="space-y-4">
             <label className="block">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endpoint</span>
               <input type="text" value={settings.apiUrl} onChange={e => update('apiUrl', e.target.value)} className="mt-1 w-full p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
             </label>
             <label className="block">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Auth Key</span>
               <input type="password" value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} className="mt-1 w-full p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
             </label>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Auto Read Result</span>
              <input type="checkbox" checked={settings.autoRead} onChange={e => update('autoRead', e.target.checked)} className="w-6 h-6 rounded-lg text-slate-900" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Auto Send after Speech</span>
              <input type="checkbox" checked={settings.voiceAutoSend} onChange={e => update('voiceAutoSend', e.target.checked)} className="w-6 h-6 rounded-lg text-slate-900" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reading Voice</span>
              <select 
                value={settings.voiceName} 
                onChange={e => update('voiceName', e.target.value)}
                className="mt-1 w-full p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold appearance-none"
              >
                <option value="">System Default</option>
                {voices.filter(v => v.lang.includes('zh') || v.lang.includes('my')).map((v, i) => (
                  <option key={i} value={v.name}>{v.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="h-8 bg-white safe-area-bottom"></div>
      </motion.div>
    </div>
  );
}
