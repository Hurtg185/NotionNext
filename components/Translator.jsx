// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, ChevronUp, Settings, 
  Mic, Send, X
} from 'lucide-react';

// --- 自定义样式合并函数 (替代 clsx 和 tailwind-merge，防止部署报错) ---
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// --- 常量配置 ---
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
  'raw-direct': { label: '原结构', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'natural-direct': { label: '自然直译', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'smooth-direct': { label: '顺语', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  'colloquial': { label: '口语', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  'natural-free': { label: '意译', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
};

export default function Translator() {
  // --- State ---
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [translations, setTranslations] = useState([]);
  const [streamingText, setStreamingText] = useState(''); 
  const [status, setStatus] = useState('idle'); 
  const [errorMsg, setErrorMsg] = useState('');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('zh'); 

  const recognitionRef = useRef(null);
  const resultEndRef = useRef(null);

  // --- Effect: Load Settings ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        } catch (e) {
          console.error("Settings parse error");
        }
      }
    }
  }, []);

  // --- Effect: Auto Scroll ---
  useEffect(() => {
    if (streamingText || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations]);

  // --- Logic ---
  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setVoiceLang(targetLang); 
    setTranslations([]);
    setStreamingText('');
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

      if (!response.ok) throw new Error('网络请求失败，请检查配置');

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
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      alert('当前浏览器不支持语音识别');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang === 'zh' ? 'zh-CN' : 'my-MM';
    recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join('');
      setInputText(text);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (settings.voiceAutoSend && inputText.trim()) {
        setTimeout(() => document.getElementById('send-btn')?.click(), 200);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakText = (text, langCode) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANGUAGES[langCode]?.voice || 'zh-CN';
      u.rate = settings.ttsRate;
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 overflow-hidden">
      
      {/* 1. 顶部固定导航 */}
      <header className="flex-none bg-white border-b border-slate-200 z-20 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setShowSettings(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
            <Settings className="w-5 h-5" />
          </button>

          <div 
            className="flex items-center gap-3 bg-slate-100 rounded-full p-1 px-3 cursor-pointer"
            onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
          >
            <span className="text-sm font-medium">{LANGUAGES[sourceLang].name}</span>
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            <span className="text-sm font-medium">{LANGUAGES[targetLang].name}</span>
            <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isHeaderExpanded && "rotate-180")} />
          </div>
          <div className="w-8" />
        </div>

        <AnimatePresence>
          {isHeaderExpanded && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 border-t border-slate-100">
              <div className="p-4 flex justify-center">
                <button onClick={() => { swapLanguages(); setIsHeaderExpanded(false); }} className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm shadow-sm active:scale-95 transition">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" /> 切换语言方向
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. 中间滚动翻译结果 */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
            <Globe className="w-16 h-16 mb-4" />
            <p className="text-sm">开始您的中缅翻译</p>
          </div>
        )}

        {/* 流式生成展示 */}
        <AnimatePresence>
          {status === 'streaming' && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 shadow-lg border border-emerald-100">
               <div className="flex items-center gap-2 mb-3">
                 <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                 <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">正在思考...</span>
               </div>
               <p className="text-lg text-slate-800 leading-relaxed">{streamingText}</p>
             </motion.div>
          )}
        </AnimatePresence>

        {/* 结果卡片列表 */}
        {translations.map((item, idx) => (
          <ResultCard 
            key={idx} 
            item={item} 
            style={TRANSLATION_STYLES[item.id] || TRANSLATION_STYLES['natural-direct']}
            targetLang={targetLang}
            onSpeak={speakText}
          />
        ))}

        {errorMsg && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm">{errorMsg}</div>}
        <div ref={resultEndRef} className="h-4" />
      </main>

      {/* 3. 底部固定输入框 */}
      <footer className="flex-none bg-white border-t border-slate-100 p-3 pb-safe shadow-lg">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          
          {/* 快速切换语音输入语言 */}
          <button
            onClick={() => setVoiceLang(voiceLang === 'zh' ? 'my' : 'zh')}
            className="flex-none mb-1 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 active:bg-slate-200"
          >
            {voiceLang.toUpperCase()}
          </button>

          {/* 输入框 */}
          <div className="flex-1 bg-slate-100 rounded-2xl border border-transparent focus-within:bg-white focus-within:border-emerald-200 transition-all">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "正在倾听..." : "输入文字开始翻译..."}
              className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 min-h-[48px] resize-none text-base"
              rows={1}
            />
          </div>

          {/* 发送/语音按钮合并 */}
          <div className="flex-none mb-0.5">
            {!inputText.trim() ? (
              <button
                onClick={startListening}
                className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-all", isListening ? "bg-red-500 animate-pulse" : "bg-emerald-500")}
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button
                id="send-btn"
                onClick={handleTranslate}
                disabled={status === 'streaming'}
                className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md disabled:opacity-50"
              >
                {status === 'streaming' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            )}
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden", style.border)}>
      <div className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider", style.bg, style.color)}>
        {style.label} {item.recommended && "★ 推荐"}
      </div>
      <div className="p-4">
        <p className="text-lg text-slate-800 font-medium mb-1">{item.translation}</p>
        {item.back && <p className="text-xs text-blue-500 mb-3 font-normal opacity-80">回译: {item.back}</p>}
        <div className="flex justify-end gap-1 pt-2 border-t border-slate-50">
          <button onClick={() => onSpeak(item.translation, targetLang)} className="p-2 text-slate-400 hover:text-blue-500"><Volume2 className="w-4 h-4" /></button>
          <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-emerald-500">
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
    localStorage.setItem('app_settings', JSON.stringify(s));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="font-bold">系统设置</h2>
          <button onClick={onClose} className="p-1"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">API URL</label>
            <input type="text" value={settings.apiUrl} onChange={e => update('apiUrl', e.target.value)} className="w-full p-2 bg-slate-100 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">API KEY</label>
            <input type="password" value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} className="w-full p-2 bg-slate-100 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">模型名称</label>
            <input type="text" value={settings.model} onChange={e => update('model', e.target.value)} className="w-full p-2 bg-slate-100 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center justify-between py-2 border-t">
            <span className="text-sm">语音输入后自动翻译</span>
            <input type="checkbox" checked={settings.voiceAutoSend} onChange={e => update('voiceAutoSend', e.target.checked)} className="rounded text-emerald-500" />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">自动朗读推荐结果</span>
            <input type="checkbox" checked={settings.autoRead} onChange={e => update('autoRead', e.target.checked)} className="rounded text-blue-500" />
          </div>
        </div>
        <div className="p-4 bg-slate-50 text-center text-[10px] text-slate-400">设置将保存在本地浏览器</div>
      </motion.div>
    </div>
  );
}
