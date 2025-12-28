// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, Settings, 
  Mic, Send, X, Sparkles, Cpu
} from 'lucide-react';

// --- 全局样式注入 ---
const globalStyles = `
  /* 隐藏滚动条但保留滚动功能 */
  .hide-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* 解决移动端点击输入框页面缩放的问题 */
  @media screen and (max-width: 768px) {
    input, textarea, select { font-size: 16px !important; }
  }

  /* 基础 Reset */
  body, html { 
    margin: 0; padding: 0; 
    overflow: hidden; /* 禁止全局滚动 */
    width: 100%; height: 100%;
    background-color: #f8fafc;
  }
  
  textarea { border: none; outline: none; resize: none; -webkit-appearance: none; }
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
  
  // 核心：使用 state 追踪视口高度
  const [vHeight, setVHeight] = useState('100vh');

  const recognitionRef = useRef(null);
  const resultEndRef = useRef(null);

  // --- 适配逻辑：处理移动端视口和键盘 ---
  useEffect(() => {
    const updateHeight = () => {
      // visualViewport 能获取到被键盘顶起后的真实高度
      if (window.visualViewport) {
        setVHeight(`${window.visualViewport.height}px`);
      }
    };

    window.visualViewport?.addEventListener('resize', updateHeight);
    window.visualViewport?.addEventListener('scroll', updateHeight);
    updateHeight();

    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('scroll', updateHeight);
    };
  }, []);

  // 加载设置
  useEffect(() => {
    const saved = localStorage.getItem('app_settings_v6');
    if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  // 翻译结果自动滚动
  useEffect(() => {
    if (status === 'streaming' || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations, status]);

  const swapLanguages = useCallback(() => {
    const s = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(s);
    setVoiceLang(targetLang);
    setTranslations([]);
    setStreamingText('');
  }, [sourceLang, targetLang]);

  const cycleModel = () => {
    const idx = MODELS.indexOf(settings.model);
    const next = MODELS[(idx + 1) % MODELS.length];
    const newSet = { ...settings, model: next };
    setSettings(newSet);
    localStorage.setItem('app_settings_v6', JSON.stringify(newSet));
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

      if (!response.ok) throw new Error('API ERROR');

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
    if (!SR) return alert('No Support');
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
        setTimeout(() => document.getElementById('send-btn')?.click(), 300);
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
        const v = voices.find(v => v.name === settings.voiceName);
        if (v) u.voice = v;
      }
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col bg-slate-50 text-slate-900 overflow-hidden"
      style={{ height: vHeight }} // 动态高度核心
    >
      <style>{globalStyles}</style>

      {/* --- 顶部固定区 (Header) --- */}
      <header className="flex-none bg-white border-b border-slate-200 z-50 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400">
            <Settings className="w-5 h-5" />
          </button>

          <div 
            onClick={swapLanguages}
            className="flex items-center gap-3 bg-slate-900 text-white px-5 py-1.5 rounded-full active:scale-95 shadow-md"
          >
            <span className="text-xs font-bold uppercase">{LANGUAGES[sourceLang].name}</span>
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            <span className="text-xs font-bold uppercase">{LANGUAGES[targetLang].name}</span>
          </div>

          <div className="w-9"></div>
        </div>
      </header>

      {/* --- 中间滚动区 (Main) --- */}
      {/* flex-1 配合 overflow-y-auto 保证这里可以滚，而头尾不动 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-4 space-y-4">
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-full flex flex-col items-center justify-center text-slate-200">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Translating...</p>
          </div>
        )}

        {/* 流式显示 */}
        <AnimatePresence>
          {status === 'streaming' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-2 mb-3 text-emerald-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px] font-black uppercase">Thinking</span>
              </div>
              <p className="text-lg text-slate-800 leading-relaxed font-medium">{streamingText}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 结果卡片 */}
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
        
        {/* 到底部锚点 */}
        <div ref={resultEndRef} className="h-10" />
      </main>

      {/* --- 底部固定区 (Footer) --- */}
      <footer className="flex-none bg-white border-t border-slate-100 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] z-50">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          
          <div className="flex items-center justify-between px-1">
             <div className="flex gap-2">
                <button
                  onClick={() => setVoiceLang(voiceLang === 'zh' ? 'my' : 'zh')}
                  className="px-2 py-1 rounded bg-slate-100 text-[10px] font-black text-slate-500"
                >
                  MIC: {voiceLang.toUpperCase()}
                </button>
                <button
                  onClick={cycleModel}
                  className="px-2 py-1 rounded bg-slate-100 text-[10px] font-black text-slate-500 flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3" /> {settings.model.split('-')[0].toUpperCase()}
                </button>
             </div>
          </div>

          <div className="relative flex items-end gap-2 bg-slate-100 rounded-[20px] p-1.5 focus-within:bg-white border border-transparent focus-within:border-slate-200 transition-all shadow-inner focus-within:shadow-sm">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : "Enter text..."}
              className="flex-1 bg-transparent px-3 py-2.5 text-base min-h-[44px] max-h-32 leading-relaxed"
              rows={1}
            />

            <AnimatePresence mode="wait">
              {!inputText.trim() ? (
                <motion.button
                  key="mic" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                  onClick={startListening}
                  className={cn(
                    "w-10 h-10 rounded-[16px] flex items-center justify-center text-white shadow-lg",
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
                  className="w-10 h-10 rounded-[16px] bg-blue-600 text-white flex items-center justify-center shadow-lg disabled:opacity-50"
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-white rounded-2xl shadow-sm border overflow-hidden", style.border)}>
      <div className={cn("px-4 py-1.5 flex justify-between items-center", style.bg)}>
        <span className={cn("text-[9px] font-black uppercase tracking-widest", style.color)}>{style.label}</span>
        {item.recommended && <div className="text-emerald-600 text-[8px] font-black underline decoration-2">RECOMMENDED</div>}
      </div>
      
      <div className="p-4 pt-2">
        <p className="text-base text-slate-800 font-bold leading-relaxed mb-1">{item.translation}</p>
        
        {/* 回译：蓝色小字 */}
        {item.back && (
          <p className="text-[11px] text-blue-500 font-medium mb-3 opacity-80">
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
    localStorage.setItem('app_settings_v6', JSON.stringify(s));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-white w-full max-w-md rounded-[24px] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="font-black text-slate-800 uppercase text-sm tracking-widest">Settings</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto hide-scrollbar text-sm">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-widest">Endpoint</label>
            <input type="text" value={settings.apiUrl} onChange={e => update('apiUrl', e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl font-bold border-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-widest">API Key</label>
            <input type="password" value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl font-bold border-none" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold">Auto Read</span>
            <input type="checkbox" checked={settings.autoRead} onChange={e => update('autoRead', e.target.checked)} className="w-5 h-5 accent-slate-900" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold">Voice Auto Send</span>
            <input type="checkbox" checked={settings.voiceAutoSend} onChange={e => update('voiceAutoSend', e.target.checked)} className="w-5 h-5 accent-slate-900" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-widest">Speaker</label>
            <select 
              value={settings.voiceName} 
              onChange={e => update('voiceName', e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-xl font-bold appearance-none border-none"
            >
              <option value="">System Default</option>
              {voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('my')).map((v, i) => (
                <option key={i} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4 bg-slate-50 text-center text-[9px] font-black text-slate-400 tracking-[0.3em]">ENGINE V6.0</div>
      </motion.div>
    </div>
  );
}
