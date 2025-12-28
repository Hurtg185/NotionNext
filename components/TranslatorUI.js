// components/TranslatorChat.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, ArrowRightLeft,
  Loader2, Star, Check, Globe,
  MicOff, RotateCcw, ChevronDown, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 语音配置 ---
const VOICE_LIBRARY: Record<string, Array<{ name: string; id: string }>> = {
  "中文": [
    { name: '小晓 (女声)', id: 'zh-CN-XiaoxiaoNeural' },
    { name: '云希 (男声)', id: 'zh-CN-YunxiNeural' },
    { name: '晓辰 (女声)', id: 'zh-CN-XiaochenNeural' },
    { name: '云健 (男声)', id: 'zh-CN-YunjianNeural' },
  ],
  "缅甸语": [
    { name: 'Thiha (男声)', id: 'my-MM-ThihaNeural' },
    { name: 'Nilar (女声)', id: 'my-MM-NilarNeural' },
  ],
  "英文": [
    { name: 'Jenny (女声)', id: 'en-US-JennyNeural' },
    { name: 'Guy (男声)', id: 'en-US-GuyNeural' },
  ],
};

// --- 类型定义 ---
interface Translation {
  id: string;
  name: string;
  translation: string;
  backTranslation: string;
  recommended: boolean;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  originalText?: string;
  translations?: Translation[];
  timestamp: Date;
  sourceLang?: string;
  targetLang?: string;
}

interface TranslatorChatProps {
  apiEndpoint?: string;
}

// --- 主组件 ---
export default function TranslatorChat({ 
  apiEndpoint = '/api/translate' 
}: TranslatorChatProps) {
  // 状态
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceLang, setSourceLang] = useState<'zh' | 'my'>('zh');
  const [targetLang, setTargetLang] = useState<'zh' | 'my'>('my');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_LIBRARY["中文"][0].id);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favoriteTranslations, setFavoriteTranslations] = useState<Set<string>>(new Set());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // 语言配置
  const languages = {
    zh: { name: '中文', flag: '🇨🇳' },
    my: { name: '缅甸语', flag: '🇲🇲' },
  };

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 语音识别初始化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                 (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = sourceLang === 'zh' ? 'zh-CN' : 'my-MM';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInputText(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };
      }
    }
  }, [sourceLang]);

  // 切换语言
  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  }, [sourceLang, targetLang]);

  // 开始/停止语音识别
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = sourceLang === 'zh' ? 'zh-CN' : 'my-MM';
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, sourceLang]);

  // 发送翻译请求
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      originalText: inputText.trim(),
      timestamp: new Date(),
      sourceLang: languages[sourceLang].name,
      targetLang: languages[targetLang].name,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage.originalText,
          sourceLang,
          targetLang,
        }),
      });

      if (!response.ok) {
        throw new Error('翻译请求失败');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        originalText: userMessage.originalText,
        translations: data.translations,
        timestamp: new Date(),
        sourceLang: languages[sourceLang].name,
        targetLang: languages[targetLang].name,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Translation error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        translations: [{
          id: 'error',
          name: '错误',
          translation: '翻译失败，请重试',
          backTranslation: '',
          recommended: false,
        }],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, sourceLang, targetLang, apiEndpoint]);

  // 复制文本
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // 朗读文本
  const speakText = useCallback((text: string, lang: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === '缅甸语' ? 'my-MM' : 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // 收藏翻译
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteTranslations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 按键处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  }, [handleTranslate]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 头部 */}
      <header className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">中缅翻译</h1>
            <p className="text-xs text-white/60">AI 智能翻译引擎</p>
          </div>
        </div>

        {/* 语言切换器 */}
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-2">
          <span className="text-sm font-medium text-white">
            {languages[sourceLang].flag} {languages[sourceLang].name}
          </span>
          <button
            onClick={swapLanguages}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-sm font-medium text-white">
            {languages[targetLang].flag} {languages[targetLang].name}
          </span>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <Settings className="w-5 h-5 text-white/70" />
        </button>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl mb-4">
              <Sparkles className="w-12 h-12 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">开始翻译</h2>
            <p className="text-white/60 max-w-sm">
              输入中文或缅甸语，获取5种不同风格的翻译结果
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'user' ? (
                // 用户消息
                <div className="max-w-[85%] bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl rounded-tr-md px-4 py-3">
                  <p className="text-white">{message.originalText}</p>
                  <p className="text-xs text-white/70 mt-1">
                    {message.sourceLang} → {message.targetLang}
                  </p>
                </div>
              ) : (
                // 翻译结果
                <div className="max-w-[90%] space-y-3">
                  {message.translations?.map((t) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`bg-white/10 backdrop-blur-xl rounded-2xl p-4 border ${
                        t.recommended 
                          ? 'border-purple-500/50 ring-1 ring-purple-500/30' 
                          : 'border-white/10'
                      }`}
                    >
                      {/* 标签 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            t.recommended 
                              ? 'bg-purple-500 text-white' 
                              : 'bg-white/20 text-white/70'
                          }`}>
                            {t.name}
                          </span>
                          {t.recommended && (
                            <span className="text-xs text-purple-400">✨ 推荐</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => speakText(t.translation, message.targetLang || '')}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                          >
                            <Volume2 className="w-4 h-4 text-white/70" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(t.translation, t.id)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                          >
                            {copiedId === t.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-white/70" />
                            )}
                          </button>
                          <button
                            onClick={() => toggleFavorite(t.id)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                          >
                            <Star className={`w-4 h-4 ${
                              favoriteTranslations.has(t.id) 
                                ? 'text-yellow-400 fill-yellow-400' 
                                : 'text-white/70'
                            }`} />
                          </button>
                        </div>
                      </div>

                      {/* 翻译文本 */}
                      <p className="text-white text-lg leading-relaxed">
                        {t.translation}
                      </p>

                      {/* 回译 */}
                      {t.backTranslation && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-white/50 mb-1">回译验证：</p>
                          <p className="text-sm text-white/70">{t.backTranslation}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 加载状态 */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                <span className="text-white/70">正在翻译...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-4 bg-black/30 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-end gap-3">
          {/* 语音按钮 */}
          <button
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all ${
              isListening 
                ? 'bg-red-500 animate-pulse' 
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isListening ? (
              <MicOff className="w-5 h-5 text-white" />
            ) : (
              <Mic className="w-5 h-5 text-white/70" />
            )}
          </button>

          {/* 输入框 */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`输入${languages[sourceLang].name}...`}
              rows={1}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl 
                         text-white placeholder-white/40 resize-none focus:outline-none 
                         focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleTranslate}
            disabled={!inputText.trim() || isLoading}
            className={`p-3 rounded-xl transition-all ${
              inputText.trim() && !isLoading
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90'
                : 'bg-white/10 opacity-50 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* 提示 */}
        <p className="text-xs text-white/40 mt-2 text-center">
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>

      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 h-full w-80 bg-slate-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {/* 语音选择 */}
              <div className="mb-6">
                <label className="text-sm text-white/70 mb-2 block">朗读语音</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg 
                             text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(VOICE_LIBRARY).map(([lang, voices]) => (
                    <optgroup key={lang} label={lang}>
                      {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* 清除历史 */}
              <button
                onClick={() => {
                  setMessages([]);
                  setShowSettings(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 
                           bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                清除对话历史
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
