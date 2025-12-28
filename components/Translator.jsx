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

// --- 全局样式 ---
const globalStyles = `
  .hide-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  textarea { border: none; outline: none; resize: none; }
  .safe-pb { padding-bottom: env(safe-area-inset-bottom); }
`;

// --- 语言配置 ---
const LANGUAGES = {
  zh: { code: 'zh', name: '中文', flag: '🇨🇳', voice: 'zh-CN' },
  en: { code: 'en', name: 'English', flag: '🇺🇸', voice: 'en-US' },
  ja: { code: 'ja', name: '日本語', flag: '🇯🇵', voice: 'ja-JP' },
  ko: { code: 'ko', name: '한국어', flag: '🇰🇷', voice: 'ko-KR' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷', voice: 'fr-FR' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪', voice: 'de-DE' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸', voice: 'es-ES' },
  ru: { code: 'ru', name: 'Русский', flag: '🇷🇺', voice: 'ru-RU' },
};

// --- 翻译引擎配置 ---
const ENGINES = {
  google: { id: 'google', name: 'Google', icon: '🔍' },
  deepl: { id: 'deepl', name: 'DeepL', icon: '📚' },
  ai: { id: 'ai', name: 'AI翻译', icon: '🤖' },
};

// --- 语言选择器组件 ---
const LanguageSelector = ({ selected, onChange, languages, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl",
          "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
          "border border-white/20 transition-all duration-200",
          "text-white font-medium min-w-[140px] justify-between"
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">{languages[selected]?.flag}</span>
          <span className="text-sm">{languages[selected]?.name}</span>
        </span>
        <ChevronDown 
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-full left-0 mt-2 w-full z-50",
              "bg-slate-800/95 backdrop-blur-xl rounded-xl",
              "border border-white/20 shadow-2xl overflow-hidden"
            )}
          >
            {Object.values(languages).map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  onChange(lang.code);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3",
                  "hover:bg-white/10 transition-colors",
                  selected === lang.code && "bg-blue-500/20 text-blue-300"
                )}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm text-white">{lang.name}</span>
                {selected === lang.code && (
                  <Check className="w-4 h-4 ml-auto text-blue-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 翻译引擎选择器 ---
const EngineSelector = ({ selected, onChange }) => {
  return (
    <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
      {Object.values(ENGINES).map((engine) => (
        <button
          key={engine.id}
          onClick={() => onChange(engine.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "text-sm font-medium transition-all duration-200",
            selected === engine.id
              ? "bg-blue-500 text-white shadow-lg"
              : "text-white/60 hover:text-white hover:bg-white/10"
          )}
        >
          <span>{engine.icon}</span>
          <span>{engine.name}</span>
        </button>
      ))}
    </div>
  );
};

// --- 操作按钮组件 ---
const ActionButton = ({ icon: Icon, onClick, active, disabled, tooltip }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    className={cn(
      "p-2.5 rounded-xl transition-all duration-200",
      "hover:scale-105 active:scale-95",
      active 
        ? "bg-blue-500 text-white" 
        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
      disabled && "opacity-50 cursor-not-allowed hover:scale-100"
    )}
  >
    <Icon className="w-5 h-5" />
  </button>
);

// --- 主翻译器组件 ---
const Translator = () => {
  // 状态管理
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engine, setEngine] = useState('google');
  const [favorites, setFavorites] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // 注入全局样式
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = globalStyles;
    document.head.appendChild(styleEl);
    return () => styleEl.remove();
  }, []);

  // 模拟翻译API调用
  const translateText = useCallback(async (text, from, to, engineType) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }

    setIsTranslating(true);
    
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));

    // 模拟翻译结果（实际项目中替换为真实API）
    const mockTranslations = {
      'zh-en': {
        '你好': 'Hello',
        '世界': 'World',
        '翻译': 'Translation',
      },
      'en-zh': {
        'hello': '你好',
        'world': '世界',
        'translation': '翻译',
      }
    };

    const key = `${from}-${to}`;
    const lowerText = text.toLowerCase();
    
    let result = mockTranslations[key]?.[lowerText] || 
      `[${ENGINES[engineType].name}] ${text} → ${LANGUAGES[to].name}`;
    
    setTranslatedText(result);
    setIsTranslating(false);
  }, []);

  // 防抖翻译
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputText) {
        translateText(inputText, sourceLang, targetLang, engine);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputText, sourceLang, targetLang, engine, translateText]);

  // 交换语言
  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(translatedText);
    setTranslatedText(inputText);
  }, [sourceLang, targetLang, inputText, translatedText]);

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  // 文本转语音
  const speakText = useCallback((text, lang) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGES[lang]?.voice || 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // 语音识别
  const toggleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = LANGUAGES[sourceLang]?.voice || 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, sourceLang]);

  // 添加到收藏
  const toggleFavorite = useCallback(() => {
    if (!inputText || !translatedText) return;
    
    const item = {
      id: Date.now(),
      source: inputText,
      target: translatedText,
      from: sourceLang,
      to: targetLang,
    };

    setFavorites(prev => {
      const exists = prev.some(f => f.source === item.source && f.target === item.target);
      if (exists) {
        return prev.filter(f => !(f.source === item.source && f.target === item.target));
      }
      return [item, ...prev].slice(0, 50);
    });
  }, [inputText, translatedText, sourceLang, targetLang]);

  const isFavorited = favorites.some(
    f => f.source === inputText && f.target === translatedText
  );

  // 清除输入
  const clearInput = () => {
    setInputText('');
    setTranslatedText('');
    textareaRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">智能翻译</h1>
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
          <p className="text-white/60">支持多引擎、语音识别的智能翻译工具</p>
        </motion.div>

        {/* 翻译引擎选择 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <EngineSelector selected={engine} onChange={setEngine} />
        </motion.div>

        {/* 语言选择栏 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-4 mb-6"
        >
          <LanguageSelector
            selected={sourceLang}
            onChange={setSourceLang}
            languages={LANGUAGES}
            label="源语言"
          />
          
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={swapLanguages}
            className={cn(
              "p-3 rounded-full",
              "bg-gradient-to-r from-blue-500 to-purple-600",
              "text-white shadow-lg hover:shadow-xl",
              "transition-shadow duration-200"
            )}
          >
            <ArrowRightLeft className="w-5 h-5" />
          </motion.button>

          <LanguageSelector
            selected={targetLang}
            onChange={setTargetLang}
            languages={LANGUAGES}
            label="目标语言"
          />
        </motion.div>

        {/* 翻译区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-2 gap-4"
        >
          {/* 输入区域 */}
          <div className={cn(
            "relative rounded-2xl overflow-hidden",
            "bg-white/10 backdrop-blur-xl",
            "border border-white/20 shadow-xl"
          )}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-white/80">
                {LANGUAGES[sourceLang].flag} {LANGUAGES[sourceLang].name}
              </span>
              <div className="flex items-center gap-2">
                <ActionButton
                  icon={Mic}
                  onClick={toggleVoiceInput}
                  active={isListening}
                  tooltip="语音输入"
                />
                <ActionButton
                  icon={Volume2}
                  onClick={() => speakText(inputText, sourceLang)}
                  disabled={!inputText}
                  tooltip="朗读"
                />
                {inputText && (
                  <ActionButton
                    icon={X}
                    onClick={clearInput}
                    tooltip="清除"
                  />
                )}
              </div>
            </div>
            
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入要翻译的文本..."
              className={cn(
                "w-full h-48 p-4 bg-transparent",
                "text-white placeholder-white/40",
                "text-lg leading-relaxed",
                "hide-scrollbar"
              )}
            />

            {/* 字符计数 */}
            <div className="absolute bottom-3 right-3 text-xs text-white/40">
              {inputText.length} / 5000
            </div>
          </div>

          {/* 输出区域 */}
          <div className={cn(
            "relative rounded-2xl overflow-hidden",
            "bg-gradient-to-br from-blue-500/10 to-purple-500/10",
            "backdrop-blur-xl border border-white/20 shadow-xl"
          )}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-white/80">
                {LANGUAGES[targetLang].flag} {LANGUAGES[targetLang].name}
              </span>
              <div className="flex items-center gap-2">
                <ActionButton
                  icon={Volume2}
                  onClick={() => speakText(translatedText, targetLang)}
                  disabled={!translatedText}
                  tooltip="朗读"
                />
                <ActionButton
                  icon={copied ? Check : Copy}
                  onClick={() => copyToClipboard(translatedText)}
                  disabled={!translatedText}
                  active={copied}
                  tooltip={copied ? "已复制" : "复制"}
                />
                <ActionButton
                  icon={Star}
                  onClick={toggleFavorite}
                  disabled={!translatedText}
                  active={isFavorited}
                  tooltip={isFavorited ? "取消收藏" : "收藏"}
                />
              </div>
            </div>
            
            <div className={cn(
              "h-48 p-4 overflow-auto hide-scrollbar",
              "text-white text-lg leading-relaxed"
            )}>
              <AnimatePresence mode="wait">
                {isTranslating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center h-full"
                  >
                    <div className="flex items-center gap-3 text-white/60">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>正在翻译...</span>
                    </div>
                  </motion.div>
                ) : translatedText ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {translatedText}
                  </motion.div>
                ) : (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-white/40"
                  >
                    翻译结果将显示在这里
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 引擎标识 */}
            {translatedText && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-white/40">
                <Cpu className="w-3 h-3" />
                <span>{ENGINES[engine].name}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* 收藏列表 */}
        <AnimatePresence>
          {favorites.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white/80">收藏记录</span>
                <span className="text-xs text-white/40">({favorites.length})</span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-auto hide-scrollbar">
                {favorites.slice(0, 5).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-xl",
                      "bg-white/5 border border-white/10",
                      "hover:bg-white/10 transition-colors cursor-pointer"
                    )}
                    onClick={() => {
                      setInputText(item.source);
                      setTranslatedText(item.target);
                      setSourceLang(item.from);
                      setTargetLang(item.to);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.source}</p>
                      <p className="text-xs text-white/60 truncate">{item.target}</p>
                    </div>
                    <div className="text-xs text-white/40">
                      {LANGUAGES[item.from]?.flag} → {LANGUAGES[item.to]?.flag}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-sm text-white/40"
        >
          <p>支持 {Object.keys(LANGUAGES).length} 种语言 · {Object.keys(ENGINES).length} 种翻译引擎</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Translator;
