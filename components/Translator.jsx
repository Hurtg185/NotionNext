// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, Settings, 
  Mic, Send, X
} from 'lucide-react';

/**
 * 自定义样式合并函数
 */
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// --- 样式注入：隐藏滚动条或使其极细 ---
const scrollbarHideStyle = `
  .hide-scrollbar::-webkit-scrollbar {
    width: 2px;
  }
  .hide-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .hide-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(0,0,0,0.1);
    border-radius: 10px;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: thin;
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
};

const TRANSLATION_STYLES = {
  'raw-direct': { label: '原结构直译', color: 'text-blue-700', bg: 'bg-blue-50/50', border: 'border-blue-200' },
  'natural-direct': { label: '自然直译', color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
  'smooth-direct': { label: '顺语直译', color: 'text-purple-700', bg: 'bg-purple-50/50', border: 'border-purple-200' },
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

  const recognitionRef = useRef(null);
  const resultEndRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_settings_v3');
      if (saved) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        } catch (e) { console.error(e); }
      }
    }
  }, []);

  useEffect(() => {
    if (streamingText || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations]);

  // 立即切换语言逻辑
  const swapLanguages = useCallback(() => {
    setSourceLang(prev => (prev === 'zh' ? 'my' : 'zh'));
    setTargetLang(prev => (prev === 'zh' ? 'my' : 'zh'));
    setVoiceLang(targetLang); 
    setTranslations([]);
    setStreamingText('');
  }, [targetLang]);

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

      if (!response.ok) throw new Error('API 请求失败');

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
          const streamPart = buffer.substring(0, splitIndex);
          setStreamingText(prev => prev + streamPart);
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
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return alert('不支持语音识别');
    if (isListening) return recognitionRef.current?.stop();

    const rec = new SR();
    rec.lang = voiceLang === 'zh' ? 'zh-CN' : 'my-MM';
    rec.interimResults = true;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => setInputText(Array.from(e.results).map(r => r[0].transcript).join(''));
    rec.onend = () => {
      setIsListening(false);
      if (settings.voiceAutoSend && inputText.trim()) {
        setTimeout(() => document.getElementById('send-btn')?.click(), 300);
      }
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const speakText = (text, lang) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANGUAGES[lang]?.voice || 'zh-CN';
      u.rate = settings.ttsRate;
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 text-slate-800 font-sans select-none overflow-hidden">
      <style>{scrollbarHideStyle}</style>

      {/* 1. 顶部 Header - 点击胶囊立即切换 */}
      <header className="flex-none bg-white border-b border-slate-200 z-30 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setShowSettings(true)} className="p-2 -ml-2 text-slate-400">
            <Settings className="w-5 h-5" />
          </button>

          <div 
            onClick={swapLanguages}
            className="flex items-center gap-4 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all px-4 py-1.5 rounded-full cursor-pointer border border-slate-200 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-700">{LANGUAGES[sourceLang].name}</span>
            </div>
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-700">{LANGUAGES[targetLang].name}</span>
            </div>
          </div>

          <div className="w-8" /> 
        </div>
      </header>

      {/* 2. 中间滚动区域 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40">
            <Globe className="w-12 h-12 mb-3" />
            <p className="text-xs font-bold uppercase tracking-widest">Ready to Translate</p>
          </div>
        )}

        <AnimatePresence>
          {status === 'streaming' && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
               <div className="flex items-center gap-2 mb-3">
                 <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                 <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">STREAMING</span>
               </div>
               <p className="text-base text-slate-800 leading-relaxed font-medium">{streamingText}</p>
             </motion.div>
          )}
        </AnimatePresence>

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

        {errorMsg && <div className="p-3 bg-red-50 text-red-500 rounded-xl text-center text-xs border border-red-100 font-bold">{errorMsg}</div>}
        <div ref={resultEndRef} className="h-4" />
      </main>

      {/* 3. 底部固定输入区域 - 适配 Safe Area */}
      <footer className="flex-none bg-white border-t border-slate-100 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          
          {/* 语音语言切换 */}
          <button
            onClick={() => setVoiceLang(prev => (prev === 'zh' ? 'my' : 'zh'))}
            className="flex-none mb-1 w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 active:bg-emerald-100 active:text-emerald-700 transition-colors"
          >
            {voiceLang.toUpperCase()}
          </button>

          {/* 输入框 */}
          <div className="flex-1 bg-slate-100 rounded-2xl overflow-hidden focus-within:bg-white border-2 border-transparent focus-within:border-emerald-500/20 transition-all">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type or speak..."}
              className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 min-h-[44px] resize-none text-base leading-snug placeholder:text-slate-400"
              rows={1}
            />
          </div>

          {/* 发送/语音合并按钮 */}
          <div className="flex-none mb-0.5">
             <AnimatePresence mode="wait">
                {!inputText.trim() ? (
                  <motion.button
                    key="mic" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                    onClick={startListening}
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm transition-all",
                      isListening ? "bg-red-500 animate-pulse" : "bg-emerald-500 active:scale-90"
                    )}
                  >
                    <Mic className="w-5 h-5" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send" id="send-btn" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                    onClick={handleTranslate}
                    disabled={status === 'streaming'}
                    className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm active:scale-90 disabled:opacity-50"
                  >
                    {status === 'streaming' ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 ml-0.5" />}
                  </motion.button>
                )}
             </AnimatePresence>
          </div>
        </div>
      </footer>

      {/* 设置弹窗 */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} />
    </div>
  );
}

// --- 子组件: 翻译卡片 ---
function ResultCard({ item, style, targetLang, onSpeak }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(item.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-white rounded-2xl shadow-sm border overflow-hidden", style.border)}>
      <div className={cn("px-3 py-1.5 flex justify-between items-center", style.bg)}>
        <span className={cn("text-[10px] font-black uppercase tracking-wider", style.color)}>{style.label}</span>
        {item.recommended && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
      </div>
      <div className="p-4 pt-3">
        <p className="text-base text-slate-800 font-bold mb-1 leading-relaxed">{item.translation}</p>
        {item.back && <p className="text-xs text-blue-500 font-semibold opacity-90 italic">回译: {item.back}</p>}
        <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-slate-50">
          <button onClick={() => onSpeak(item.translation, targetLang)} className="p-2 rounded-xl text-slate-400 active:bg-slate-100 transition"><Volume2 className="w-4 h-4" /></button>
          <button onClick={handleCopy} className="p-2 rounded-xl text-slate-400 active:bg-slate-100 transition">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- 子组件: 设置弹窗 ---
function SettingsModal({ isOpen, onClose, settings, setSettings }) {
  if (!isOpen) return null;
  const update = (k, v) => {
    const s = { ...settings, [k]: v };
    setSettings(s);
    localStorage.setItem('app_settings_v3', JSON.stringify(s));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-black text-slate-800 uppercase tracking-tighter">Engine Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto hide-scrollbar">
          <div className="space-y-4">
             <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">API Endpoint</label>
             <input type="text" value={settings.apiUrl} onChange={e => update('apiUrl', e.target.value)} className="w-full p-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500" />
             <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Secret Key</label>
             <input type="password" value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} className="w-full p-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500" />
             <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">AI Model</label>
             <input type="text" value={settings.model} onChange={e => update('model', e.target.value)} className="w-full p-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Voice Auto Send</span>
              <input type="checkbox" checked={settings.voiceAutoSend} onChange={e => update('voiceAutoSend', e.target.checked)} className="w-5 h-5 text-emerald-500 rounded-lg focus:ring-0" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Auto Read Result</span>
              <input type="checkbox" checked={settings.autoRead} onChange={e => update('autoRead', e.target.checked)} className="w-5 h-5 text-blue-500 rounded-lg focus:ring-0" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100">Local Configuration Only</div>
      </motion.div>
    </div>
  );
}
