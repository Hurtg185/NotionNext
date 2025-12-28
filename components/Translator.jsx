import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, ChevronUp, Settings, 
  Mic, Send, X, MonitorSmartphone
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- 工具函数 ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- 常量配置 ---
const LANGUAGES = {
  zh: { code: 'zh', name: '中文', flag: '🇨🇳', voice: 'zh-CN' },
  my: { code: 'my', name: 'မြန်မာ', flag: '🇲🇲', voice: 'my-MM' },
};

const DEFAULT_SETTINGS = {
  apiUrl: '/api/translate', // 或者你的完整后端地址
  apiKey: '',
  model: 'deepseek-chat',
  autoRead: true, // 自动朗读自然直译结果
  voiceAutoSend: false, // 语音输入完毕自动发送
  ttsRate: 1.0,
};

const TRANSLATION_STYLES = {
  'raw-direct': { label: '原结构', color: 'text-blue-700', bg: 'bg-blue-50/50', border: 'border-blue-200' },
  'natural-direct': { label: '自然直译', color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
  'smooth-direct': { label: '顺语', color: 'text-purple-700', bg: 'bg-purple-50/50', border: 'border-purple-200' },
  'colloquial': { label: '口语', color: 'text-orange-700', bg: 'bg-orange-50/50', border: 'border-orange-200' },
  'natural-free': { label: '意译', color: 'text-pink-700', bg: 'bg-pink-50/50', border: 'border-pink-200' },
};

export default function Translator() {
  // --- State ---
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  
  // 结果数据
  const [translations, setTranslations] = useState([]);
  const [streamingText, setStreamingText] = useState(''); // 流式传输中的临时文本
  
  // 状态标志
  const [status, setStatus] = useState('idle'); // idle, streaming, processing, error
  const [errorMsg, setErrorMsg] = useState('');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 设置
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  // 语音识别引用
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('zh'); // 当前语音识别的语言

  // 滚动引用
  const resultEndRef = useRef(null);

  // --- Effect: Load Settings ---
  useEffect(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
  }, []);

  // --- Effect: Auto Scroll ---
  useEffect(() => {
    if (streamingText || translations.length > 0) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, translations]);

  // --- Logic: 交换语言 ---
  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setVoiceLang(targetLang); // 语音语言随源语言切换
    // 自动清理之前的翻译，但不清理输入框
    setTranslations([]);
    setStreamingText('');
  };

  // --- Logic: 翻译核心 (Streaming) ---
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
            apiUrl: 'https://apis.iflow.cn/v1' // 这里的apiUrl是传给后端去调用的第三方API
          }
        }),
      });

      if (!response.ok) throw new Error('Network error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collectedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 检查是否包含最终 JSON 分隔符
        const splitIndex = buffer.indexOf('\n|||FINAL_JSON|||\n');

        if (splitIndex !== -1) {
          // 前半部分是流式文本
          const streamPart = buffer.substring(0, splitIndex);
          collectedText += streamPart; // 确保加上最后一点流
          setStreamingText(prev => prev + streamPart); // 这里的逻辑可能多余，取决于你的后端是否在最后一次flush前已经发完了所有流

          // 后半部分是 JSON
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
            console.error("JSON Parse error", e);
          }
          setStatus('idle');
          setStreamingText(''); // 清除流式显示，转为卡片显示
          break;
        } else {
          // 纯流式文本更新
          setStreamingText(prev => prev + chunk);
          collectedText += chunk;
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '翻译服务暂时不可用');
      setStatus('error');
    }
  };

  // --- Logic: 语音识别 ---
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    // 如果正在识别，则停止
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = voiceLang === 'zh' ? 'zh-CN' : 'my-MM';
    recognition.continuous = false;
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
      // 如果开启了语音自动发送且有内容
      if (settings.voiceAutoSend && inputText.trim().length > 0) {
        // 使用 timeout 确保状态更新后再发送，避免闭包问题
        setTimeout(() => document.getElementById('send-btn')?.click(), 100);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- Logic: TTS ---
  const speakText = (text, langCode) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGES[langCode]?.voice || 'zh-CN';
      utterance.rate = settings.ttsRate;
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    // 这里可以使用 toast 提示
  };

  // --- UI Components ---

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* 1. 顶部 Header (固定) */}
      <header className="flex-none bg-white border-b border-slate-200 z-20 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 active:scale-95 transition"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* 语言切换核心区 */}
          <div className="flex items-center gap-3 bg-slate-100 rounded-full p-1 px-2 cursor-pointer"
               onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
          >
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-lg">{LANGUAGES[sourceLang].flag}</span>
              <span className="text-sm font-medium text-slate-700">{LANGUAGES[sourceLang].name}</span>
            </div>
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-lg">{LANGUAGES[targetLang].flag}</span>
              <span className="text-sm font-medium text-slate-700">{LANGUAGES[targetLang].name}</span>
            </div>
            <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isHeaderExpanded && "rotate-180")} />
          </div>

          <div className="w-8" /> {/* 占位，保持中间居中 */}
        </div>

        {/* 语言选择折叠面板 */}
        <AnimatePresence>
          {isHeaderExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-50 border-t border-slate-100"
            >
              <div className="p-4 grid grid-cols-2 gap-4">
                 {/* 这里可以添加更多语言选项，目前只做快速交换演示 */}
                 <div className="col-span-2 flex justify-center pb-2">
                    <button 
                      onClick={() => { swapLanguages(); setIsHeaderExpanded(false); }}
                      className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl shadow-sm active:scale-95 transition"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm">交换源/目标语言</span>
                    </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. 中间滚动区域 (结果显示) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {/* 欢迎/空状态 */}
        {!streamingText && translations.length === 0 && !errorMsg && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
            <Globe className="w-16 h-16 mb-4 text-slate-200" />
            <p className="text-sm">请输入或语音输入开始翻译</p>
          </div>
        )}

        {/* 流式传输中的卡片 */}
        <AnimatePresence>
          {status === 'streaming' && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white rounded-2xl p-5 shadow-lg border border-emerald-100"
             >
               <div className="flex items-center gap-2 mb-3">
                 <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                 <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">正在生成...</span>
               </div>
               <p className="text-lg text-slate-800 leading-relaxed font-medium">
                 {streamingText}
                 <span className="inline-block w-2 h-4 bg-emerald-500 ml-1 animate-pulse align-middle"></span>
               </p>
             </motion.div>
          )}
        </AnimatePresence>

        {/* 最终结果卡片列表 */}
        <AnimatePresence mode="popLayout">
          {translations.map((item, idx) => (
            <ResultCard 
              key={item.id || idx}
              item={item}
              style={TRANSLATION_STYLES[item.id] || TRANSLATION_STYLES['natural-direct']}
              targetLang={targetLang}
              onSpeak={speakText}
              onCopy={copyText}
            />
          ))}
        </AnimatePresence>

        {/* 错误信息 */}
        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm">
            {errorMsg}
          </div>
        )}

        <div ref={resultEndRef} className="h-4" />
      </main>

      {/* 3. 底部输入区域 (固定) */}
      <footer className="flex-none bg-white border-t border-slate-100 p-3 pb-safe z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          
          {/* 语音语言快速切换 */}
          <button
            onClick={() => setVoiceLang(voiceLang === 'zh' ? 'my' : 'zh')}
            className="flex-none mb-1 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 hover:bg-slate-200 transition"
          >
            {LANGUAGES[voiceLang].code.toUpperCase()}
          </button>

          {/* 文本输入框 */}
          <div className="flex-1 bg-slate-100 rounded-2xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-100 focus-within:bg-white border border-transparent focus-within:border-emerald-200">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "正在听..." : "输入文字..."}
              className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 min-h-[48px] resize-none text-base leading-relaxed placeholder:text-slate-400"
              rows={inputText.split('\n').length > 1 ? Math.min(inputText.split('\n').length, 5) : 1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
            />
          </div>

          {/* 动态按钮: 语音 或 发送 */}
          <div className="flex-none mb-0.5">
             <AnimatePresence mode="wait">
                {!inputText.trim() ? (
                  <motion.button
                    key="mic"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={startListening}
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md",
                      isListening ? "bg-red-500 text-white animate-pulse" : "bg-emerald-500 text-white hover:bg-emerald-600"
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
                    className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'streaming' ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 ml-0.5" />}
                  </motion.button>
                )}
             </AnimatePresence>
          </div>
        </div>
      </footer>

      {/* 设置弹窗 */}
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
function ResultCard({ item, style, targetLang, onSpeak, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(item.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("bg-white rounded-2xl shadow-sm border overflow-hidden", style.border)}
    >
      {/* 头部标签 */}
      <div className={cn("px-4 py-1.5 flex justify-between items-center bg-opacity-30", style.bg)}>
        <span className={cn("text-xs font-bold tracking-wide", style.color)}>
          {style.label}
        </span>
        {item.recommended && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
      </div>

      <div className="p-4 pt-3">
        {/* 译文 */}
        <p className="text-lg text-slate-800 font-medium mb-2 leading-relaxed selection:bg-blue-100">
          {item.translation}
        </p>
        
        {/* 回译 (蓝色小字) */}
        {item.back && (
          <div className="mb-4 text-xs leading-relaxed text-blue-500/80 bg-slate-50 p-2 rounded-lg border border-slate-100">
             {item.back}
          </div>
        )}

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-50">
          <button 
            onClick={() => onSpeak(item.translation, targetLang)}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleCopy}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-500 transition"
          >
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

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-lg text-slate-700">配置中心</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* API 设置 */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI 模型配置</h3>
             <label className="block">
               <span className="text-sm text-slate-600 block mb-1">接口地址 (API URL)</span>
               <input 
                 type="text" 
                 value={settings.apiUrl}
                 onChange={e => handleChange('apiUrl', e.target.value)}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               />
             </label>
             <label className="block">
               <span className="text-sm text-slate-600 block mb-1">API Key (OpenAI格式)</span>
               <input 
                 type="password" 
                 value={settings.apiKey}
                 onChange={e => handleChange('apiKey', e.target.value)}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               />
             </label>
             <label className="block">
               <span className="text-sm text-slate-600 block mb-1">模型名称 (Model)</span>
               <input 
                 type="text" 
                 value={settings.model}
                 onChange={e => handleChange('model', e.target.value)}
                 placeholder="deepseek-chat"
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               />
             </label>
          </div>

          <div className="h-px bg-slate-100" />

          {/* 功能开关 */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">交互体验</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">语音输入后自动发送</span>
              <button 
                onClick={() => handleChange('voiceAutoSend', !settings.voiceAutoSend)}
                className={cn("w-11 h-6 rounded-full transition-colors relative", settings.voiceAutoSend ? "bg-emerald-500" : "bg-slate-200")}
              >
                <span className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", settings.voiceAutoSend && "translate-x-5")} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">自动朗读译文 (推荐版)</span>
              <button 
                onClick={() => handleChange('autoRead', !settings.autoRead)}
                className={cn("w-11 h-6 rounded-full transition-colors relative", settings.autoRead ? "bg-blue-500" : "bg-slate-200")}
              >
                <span className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", settings.autoRead && "translate-x-5")} />
              </button>
            </div>

            <label className="block">
               <span className="text-sm text-slate-600 block mb-1">朗读语速 ({settings.ttsRate})</span>
               <input 
                 type="range" min="0.5" max="2" step="0.1"
                 value={settings.ttsRate}
                 onChange={e => handleChange('ttsRate', parseFloat(e.target.value))}
                 className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
               />
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Powered by Cloudflare Pages & React</p>
        </div>
      </motion.div>
    </div>
  );
}
