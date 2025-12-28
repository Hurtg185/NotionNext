// components/Translator.jsx
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, Star, ChevronDown, ChevronUp, Sparkles 
} from 'lucide-react';

// 语言配置
const LANGUAGES = {
  zh: { code: 'zh', name: '中文', flag: '🇨🇳' },
  my: { code: 'my', name: 'မြန်မာ', flag: '🇲🇲' },
};

// 翻译类型样式
const TRANSLATION_STYLES = {
  'raw-direct': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'natural-direct': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'smooth-direct': { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  'colloquial': { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'natural-free': { color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
};

export default function Translator() {
  // 状态
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [translations, setTranslations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  
  const inputRef = useRef(null);

  // 交换语言
  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText('');
    setTranslations([]);
  }, [sourceLang, targetLang]);

  // 翻译请求
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError('');
    setTranslations([]);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          sourceLang,
          targetLang,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '翻译失败');
      }

      setTranslations(data.translations);
      // 自动展开推荐版本
      const recommended = data.translations.find(t => t.recommended);
      if (recommended) {
        setExpandedId(recommended.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sourceLang, targetLang]);

  // 复制文本
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // 文本朗读 (TTS)
  const speakText = useCallback((text, lang) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'my' ? 'my-MM' : 'zh-CN';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, []);

  // 键盘快捷键
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleTranslate();
    }
  }, [handleTranslate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* 标题 */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-2">
            <Globe className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              中缅翻译
            </h1>
          </div>
          <p className="text-slate-500">5种翻译风格 · 精准回译对照</p>
        </motion.div>

        {/* 语言选择器 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-4 mb-6"
        >
          <LanguageButton 
            lang={LANGUAGES[sourceLang]} 
            label="源语言"
          />
          
          <button
            onClick={swapLanguages}
            className="p-3 rounded-full bg-white shadow-md hover:shadow-lg 
                     transition-all hover:scale-110 active:scale-95"
          >
            <ArrowRightLeft className="w-5 h-5 text-slate-600" />
          </button>
          
          <LanguageButton 
            lang={LANGUAGES[targetLang]} 
            label="目标语言"
          />
        </motion.div>

        {/* 输入区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sourceLang === 'zh' ? '输入中文...' : 'မြန်မာစာ ရိုက်ထည့်ပါ...'}
            className="w-full h-32 resize-none border-0 focus:ring-0 text-lg 
                     placeholder:text-slate-300 outline-none"
          />
          
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => speakText(inputText, sourceLang)}
                disabled={!inputText}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 
                         transition-colors"
              >
                <Volume2 className="w-5 h-5 text-slate-500" />
              </button>
              <span className="text-sm text-slate-400">
                {inputText.length} 字符
              </span>
            </div>
            
            <button
              onClick={handleTranslate}
              disabled={!inputText.trim() || isLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-blue-500 
                       text-white font-medium rounded-xl shadow-md
                       hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all hover:scale-105 active:scale-95
                       flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  翻译中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  翻译
                  <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.5 
                               text-xs bg-white/20 rounded">
                    ⌘↵
                  </kbd>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* 错误提示 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 翻译结果 */}
        <AnimatePresence mode="popLayout">
          {translations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {translations.map((item, index) => (
                <TranslationCard
                  key={item.id}
                  item={item}
                  index={index}
                  style={TRANSLATION_STYLES[item.id]}
                  isExpanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onCopy={copyToClipboard}
                  onSpeak={speakText}
                  isCopied={copiedId === item.id}
                  targetLang={targetLang}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// 语言按钮组件
function LanguageButton({ lang, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-slate-400 mb-1">{label}</span>
      <div className="px-4 py-2 bg-white rounded-xl shadow-md flex items-center gap-2">
        <span className="text-xl">{lang.flag}</span>
        <span className="font-medium text-slate-700">{lang.name}</span>
      </div>
    </div>
  );
}

// 翻译卡片组件
function TranslationCard({ 
  item, index, style, isExpanded, onToggle, 
  onCopy, onSpeak, isCopied, targetLang 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white rounded-2xl shadow-md overflow-hidden border-2 
                ${isExpanded ? style.border : 'border-transparent'}`}
    >
      {/* 卡片头部 */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.color}`}>
            {item.label}
          </span>
          {item.recommended && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Star className="w-3 h-3 fill-current" />
              推荐
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <p className="text-sm text-slate-500 truncate max-w-[200px]">
              {item.translation}
            </p>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* 展开内容 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* 翻译结果 */}
              <div className={`p-4 rounded-xl ${style.bg}`}>
                <div className="flex items-start justify-between gap-4">
                  <p className={`text-lg ${style.color} flex-1`}>
                    {item.translation}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSpeak(item.translation, targetLang)}
                      className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <Volume2 className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => onCopy(item.translation, item.id)}
                      className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 回译 */}
              {item.backTranslation && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-2">回译对照</p>
                  <p className="text-slate-600">{item.backTranslation}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
