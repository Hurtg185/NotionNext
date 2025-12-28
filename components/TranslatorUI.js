import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Send, Settings, X,
  Volume2, Copy, BrainCircuit,
  Loader2, Star, Sparkles, ChevronDown,
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';

/* ---------- 语言配置 ---------- */
const ALL_LANGUAGES = [
  { code: 'auto', label: '🤖 自动检测' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'en', label: '🇺🇸 英文' },
];

const RECOGNITION_LANGUAGES = [
  { code: 'auto', label: '🤖 自动' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'my', label: '🇲🇲 缅文' },
  { code: 'en', label: '🇺🇸 英文' },
];

export default function TranslatorUI() {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my');

  const [showLangPicker, setShowLangPicker] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMicLangMenu, setShowMicLangMenu] = useState(false);

  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  /* ⭐ 核心：footer 高度感知 */
  const footerRef = useRef(null);
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* footer 动态高度 */
  useEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver(() => {
      setFooterHeight(footerRef.current.offsetHeight);
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  /* 输入框自适应高度 */
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 150) + 'px';
  }, [input]);

  /* 自动滚到底 */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results, loading]);

  const handleTranslate = async (override) => {
    const text = override ?? input;
    if (!text.trim() || loading) return;

    setLoading(true);
    setResults([]);
    setQuickReplies([]);

    /* 模拟接口（你换成真实接口） */
    setTimeout(() => {
      setResults([
        { label: '推荐', translation: text.split('').reverse().join(''), recommended: true },
        { label: '直译', translation: text }
      ]);
      setQuickReplies(['再来一句', '换个说法']);
      setLoading(false);
    }, 800);
  };

  if (!mounted) return null;

  const currentSource = ALL_LANGUAGES.find(l => l.code === sourceLang);
  const currentTarget = ALL_LANGUAGES.find(l => l.code === targetLang);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Head>
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"
        />
      </Head>

      {/* ---------- 顶部 ---------- */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur border-b px-4 py-3">
        <div className="text-xs font-black text-indigo-600">AI 翻译官 Pro</div>
      </header>

      {/* ---------- 主内容区 ---------- */}
      <main
        className="max-w-3xl mx-auto pt-16 px-4 space-y-4"
        style={{ paddingBottom: footerHeight + 16 }}
      >
        <AnimatePresence>
          {results.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              className="flex flex-col items-center pt-32"
            >
              <BrainCircuit size={72} />
            </motion.div>
          )}

          {results.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-3xl p-5 shadow ${
                item.recommended ? 'border border-indigo-200' : ''
              }`}
            >
              <div className="flex justify-between mb-3">
                <span className="text-xs font-bold">{item.label}</span>
                {item.recommended && (
                  <span className="text-xs text-indigo-600 flex items-center gap-1">
                    <Star size={12} /> BEST
                  </span>
                )}
              </div>
              <p className="text-lg whitespace-pre-wrap">
                {item.translation}
              </p>
            </motion.div>
          ))}

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </main>

      {/* ---------- 底部输入栏（修复点） ---------- */}
      <footer
        ref={footerRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t pb-safe"
      >
        <div className="max-w-3xl mx-auto p-3 space-y-3">
          {/* quick replies */}
          {quickReplies.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {quickReplies.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleTranslate(q)}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 bg-slate-100 rounded-xl"
            >
              <Settings size={18} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入文本..."
              rows={1}
              className="flex-1 bg-slate-100 rounded-2xl px-4 py-3 resize-none outline-none"
            />

            <button
              onClick={() => handleTranslate()}
              className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
