// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, ChevronUp, Settings, 
  Mic, Send, X
} from 'lucide-react';

/**
 * 自定义样式合并函数 (替代 clsx 和 tailwind-merge)
 * 确保在没有安装额外依赖的情况下也能直接运行
 */
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// --- 语言配置 ---
const LANGUAGES = {
  zh: { code: 'zh', name: '中文', flag: '🇨🇳', voice: 'zh-CN' },
  my: { code: 'my', name: 'မြန်မာ', flag: '🇲🇲', voice: 'my-MM' },
};

// --- 默认设置 ---
const DEFAULT_SETTINGS = {
  apiUrl: '/api/translate', 
  apiKey: '',
  model: 'deepseek-chat',
  autoRead: true,       // 自动朗读自然直译结果
  voiceAutoSend: false, // 语音输入完毕自动发送
  ttsRate: 1.0,         // 朗读速度
};

// --- 翻译风格样式 ---
const TRANSLATION_STYLES = {
  'raw-direct': { label: '原结构直译', color: 'text-blue-700', bg: 'bg-blue-50/50', border: 'border-blue-200' },
  'natural-direct': { label: '自然直译', color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
  'smooth-direct': { label: '顺语直译', color: 'text-purple-700', bg: 'bg-purple-50/50', border: 'border-purple-200' },
  'spoken': { label: '口语版', color: 'text-orange-700', bg: 'bg-orange-50/50', border: 'border-orange-200' },
  'free': { label: '自然意译', color: 'text-pink-700', bg: 'bg-pink-50/50', border: 'border-pink-200' },
};

export default function Translator() {
  // --- 状态定义 ---
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [translations, setTranslations] = useState([]);
  const [streamingText, setStreamingText] = useState(''); // 流式中间文本
  const [status, setStatus] = useState('idle');           // idle | streaming | error
  const [errorMsg, setErrorMsg] = useState('');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('zh');      // 语音识别语言

  const recognitionRef = useRef(null);
  const resultEndRef = useRef(null);

  // --- 初始化: 加载本地设置 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_settings_v2');
      if (saved) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        } catch (e) {
          console.error("Failed to parse settings");
        }
      }
    }
  }, []);

  // --- 自动滚动到底部 ---
  useEffect(() => {
    if (streamingText || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations]);

  // --- 逻辑: 交换语言 ---
  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setVoiceLang(targetLang); // 语音跟随源语言
    setTranslations([]);
    setStreamingText('');
  };

  // --- 逻辑: 发起翻译 (流式) ---
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

      if (!response.ok) throw new Error('API 请求失败，请检查设置');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 检测后端定义的分隔符
        const splitIndex = buffer.indexOf('\n|||FINAL_JSON|||\n');

        if (splitIndex !== -1) {
          // 处理流式文本部分
          const streamPart = buffer.substring(0, splitIndex);
          setStreamingText(prev => prev + streamPart);

          // 处理最终解析的 JSON 部分
          const jsonPart = buffer.substring(splitIndex + '\n|||FINAL_JSON|||\n'.length);
          try {
            const data = JSON.parse(jsonPart);
            setTranslations(data.parsed || []);
            
            // 自动朗读逻辑
            if (settings.autoRead) {
              const recommended = data.parsed.find(t => t.recommended);
              if (recommended) speakText(recommended.translation, targetLang);
            }
          } catch (e) {
            console.error("JSON parse error", e);
          }
          setStatus('idle');
          setStreamingText(''); 
          break;
        } else {
          setStreamingText(prev => prev + chunk);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || '翻译过程出错');
      setStatus('error');
    }
  };

  // --- 逻辑: 语音识别 ---
  const startListening = () => {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
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
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputText(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (settings.voiceAutoSend && inputText.trim()) {
        setTimeout(() => {
          const btn = document.getElementById('send-btn');
          if (btn) btn.click();
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- 逻辑: 语音朗读 ---
  const speakText = (text, langCode) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGES[langCode]?.voice || 'zh-CN';
      utterance.rate = settings.ttsRate;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* 1. 顶部固定导航 (Header) */}
      <header className="flex-none bg-white border-b border-slate-200 z-20 shadow-sm transition-all">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 active:scale-95 transition"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* 语言显示/折叠触发 */}
          <div className="flex items-center gap-3 bg-slate-100 rounded-full p-1 px-3 cursor-pointer"
               onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">{LANGUAGES[sourceLang].flag}</span>
              <span className="text-sm font-bold text-slate-700">{LANGUAGES[sourceLang].name}</span>
            </div>
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-base">{LANGUAGES[targetLang].flag}</span>
              <span className="text-sm font-bold text-slate-700">{LANGUAGES[targetLang].name}</span>
            </div>
            <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isHeaderExpanded && "rotate-180")} />
          </div>

          <div className="w-8" /> 
        </div>

        {/* 展开的语言操作栏 */}
        <AnimatePresence>
          {isHeaderExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-50 border-t border-slate-100"
            >
              <div className="p-4 flex justify-center">
                <button 
                  onClick={() => { swapLanguages(); setIsHeaderExpanded(false); }}
                  className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl shadow-sm active:scale-95 transition text-sm"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                  快速切换翻译方向
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. 中间滚动内容区域 (Results) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 空状态欢迎词 */}
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
            <Globe className="w-16 h-16 mb-4" />
            <p className="text-sm font-medium tracking-wide">请输入文字或点击麦克风翻译</p>
          </div>
        )}

        {/* 流式传输卡片 */}
        <AnimatePresence>
          {status === 'streaming' && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white rounded-2xl p-5 shadow-lg border border-emerald-100"
             >
               <div className="flex items-center gap-2 mb-3">
                 <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">AI 正在翻译</span>
               </div>
               <p className="text-lg text-slate-800 leading-relaxed font-medium">
                 {streamingText}
                 <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-1 animate-pulse align-middle"></span>
               </p>
             </motion.div>
          )}
        </AnimatePresence>

        {/* 结果展示卡片 */}
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

        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm border border-red-100">
            {errorMsg}
          </div>
        )}

        {/* 自动滚动锚点 */}
        <div ref={resultEndRef} className="h-2" />
      </main>

      {/* 3. 底部固定输入区域 (Footer) */}
      <footer className="flex-none bg-white border-t border-slate-100 p-3 pb-safe z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          
          {/* 语音识别语言切换按钮 */}
          <button
            onClick={() => setVoiceLang(voiceLang === 'zh' ? 'my' : 'zh')}
            className="flex-none mb-1 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 active:bg-slate-200 transition-colors"
          >
            {voiceLang.toUpperCase()}
          </button>

          {/* 文本输入框 - 自动增高 */}
          <div className="flex-1 bg-slate-100 rounded-2xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-100 focus-within:bg-white border border-transparent focus-within:border-emerald-200">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "正在聆听..." : "输入内容..."}
              className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 min-h-[48px] resize-none text-base leading-relaxed placeholder:text-slate-400"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
            />
          </div>

          {/* 按钮合并逻辑: 有字为发送，无字为识别 */}
          <div className="flex-none mb-0.5">
             <AnimatePresence mode="wait">
                {!inputText.trim() ? (
                  <motion.button
                    key="mic"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={startListening}
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-all",
                      isListening ? "bg-red-500 animate-pulse" : "bg-emerald-500 active:scale-90"
                    )}
                  >
                    <Mic className="w-5 h-5" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send"
                    id="send-btn"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={handleTranslate}
                    disabled={status === 'streaming'}
                    className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md active:scale-90 disabled:opacity-50"
                  >
                    {status === 'streaming' ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 ml-0.5" />}
                  </motion.button>
                )}
             </AnimatePresence>
          </div>
        </div>
      </footer>

      {/* 设置中心弹窗 */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
      />
    </div>
  );
}

// --- 子组件: 翻译结果卡片 ---
function ResultCard({ item, style, targetLang, onSpeak }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("bg-white rounded-2xl shadow-sm border overflow-hidden", style.border)}
    >
      {/* 顶部紧凑标签 */}
      <div className={cn("px-3 py-1.5 flex justify-between items-center", style.bg)}>
        <span className={cn("text-[10px] font-black uppercase tracking-tighter", style.color)}>
          {style.label}
        </span>
        {item.recommended && (
          <div className="flex items-center gap-0.5 text-amber-500">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-[10px] font-bold">推荐</span>
          </div>
        )}
      </div>

      <div className="p-4 pt-3">
        {/* 翻译核心文本 */}
        <p className="text-lg text-slate-800 font-semibold mb-1 leading-relaxed">
          {item.translation}
        </p>
        
        {/* 回译内容 (蓝色小字) */}
        {item.back && (
          <p className="text-xs text-blue-500/80 mb-4 font-medium italic">
            {item.back}
          </p>
        )}

        {/* 操作区 (紧凑靠右) */}
        <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-50">
          <button 
            onClick={() => onSpeak(item.translation, targetLang)}
            className="p-2 rounded-full text-slate-400 hover:text-blue-500 active:bg-slate-100 transition"
            title="朗读"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleCopy}
            className="p-2 rounded-full text-slate-400 hover:text-emerald-500 active:bg-slate-100 transition"
            title="复制"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- 子组件: 设置中心弹窗 ---
function SettingsModal({ isOpen, onClose, settings, setSettings }) {
  if (!isOpen) return null;

  const update = (key, value) => {
    const newS = { ...settings, [key]: value };
    setSettings(newS);
    localStorage.setItem('app_settings_v2', JSON.stringify(newS));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-black text-slate-700 uppercase tracking-tight">System Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* 接口设置 */}
          <div className="space-y-3">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model Config</h3>
             <div className="space-y-4">
               <label className="block text-sm font-bold text-slate-600">
                 API URL
                 <input 
                   type="text" 
                   value={settings.apiUrl}
                   onChange={e => update('apiUrl', e.target.value)}
                   className="mt-1 w-full p-3 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                 />
               </label>
               <label className="block text-sm font-bold text-slate-600">
                 API Key
                 <input 
                   type="password" 
                   value={settings.apiKey}
                   onChange={e => update('apiKey', e.target.value)}
                   className="mt-1 w-full p-3 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                 />
               </label>
               <label className="block text-sm font-bold text-slate-600">
                 Model Name
                 <input 
                   type="text" 
                   value={settings.model}
                   onChange={e => update('model', e.target.value)}
                   className="mt-1 w-full p-3 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                 />
               </label>
             </div>
          </div>

          <hr className="border-slate-100" />

          {/* 交互设置 */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Automation</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">语音完毕自动发送</span>
              <input 
                type="checkbox" 
                checked={settings.voiceAutoSend}
                onChange={e => update('voiceAutoSend', e.target.checked)}
                className="w-5 h-5 text-emerald-500 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">翻译完成后自动朗读</span>
              <input 
                type="checkbox" 
                checked={settings.autoRead}
                onChange={e => update('autoRead', e.target.checked)}
                className="w-5 h-5 text-blue-500 rounded-lg"
              />
            </div>

            <label className="block text-sm font-bold text-slate-600">
               朗读语速 ({settings.ttsRate})
               <input 
                 type="range" min="0.5" max="1.5" step="0.1"
                 value={settings.ttsRate}
                 onChange={e => update('ttsRate', parseFloat(e.target.value))}
                 className="mt-2 w-full accent-emerald-500"
               />
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Deployed on Cloudflare</p>
        </div>
      </motion.div>
    </div>
  );
}
