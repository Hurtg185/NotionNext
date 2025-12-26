import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Send, Volume2, Copy, Settings, X, Star
} from 'lucide-react';

/**
 * ===============================
 * AI Translator Component
 * ===============================
 */

const AITranslator = () => {
  /** ======================
   * 状态
   * ====================== */
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState('auto'); // auto | zh | my | en ...
  const [targetLang, setTargetLang] = useState('my'); // 必选
  const [autoDetect, setAutoDetect] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const recognitionRef = useRef(null);

  /** ======================
   * 语音识别初始化
   * ====================== */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  /** ======================
   * 开关语音
   * ====================== */
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('浏览器不支持语音识别');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang =
        recognitionLang === 'auto'
          ? 'zh-CN'
          : recognitionLang === 'my'
          ? 'my-MM'
          : 'en-US';

      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  /** ======================
   * 发送翻译
   * ====================== */
  const handleSend = async () => {
    if (!input.trim()) return;
    if (!targetLang) return alert('请选择目标语言');

    setLoading(true);
    setResults([]);

    /**
     * 这里调用你的 AI 翻译接口
     * 你只需要把 prompt + context + input 发给后端
     */
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        targetLang,
        autoDetect,
      }),
    });

    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  };

  /** ======================
   * TTS 播放（微软）
   * ====================== */
  const speak = (text, lang) => {
    const voice =
      lang === 'zh'
        ? 'zh-CN-XiaoxiaoNeural'
        : lang === 'my'
        ? 'my-MM-NilarNeural'
        : 'en-US-JennyNeural';

    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(
      text
    )}&v=${voice}&r=-20`;

    new Audio(url).play().catch(() => {});
  };

  /** ======================
   * UI
   * ====================== */
  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-5 space-y-4">

      {/* 语言设置 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          → 目标语言：
          <select
            className="ml-2 bg-transparent border rounded px-2"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            <option value="my">缅甸语</option>
            <option value="zh">中文</option>
            <option value="en">英语</option>
          </select>
        </div>

        <button onClick={() => setShowSettings(!showSettings)}>
          <Settings size={18} />
        </button>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={() => setAutoDetect(!autoDetect)}
            />
            自动识别源语言
          </label>

          <label className="flex items-center gap-2">
            语音识别语言：
            <select
              value={recognitionLang}
              onChange={(e) => setRecognitionLang(e.target.value)}
              className="bg-transparent border rounded px-2"
            >
              <option value="auto">自动</option>
              <option value="zh">中文</option>
              <option value="my">缅甸语</option>
              <option value="en">英语</option>
            </select>
          </label>
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex items-center justify-center">
        {!input ? (
          <button
            onClick={toggleListening}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-cyan-500 text-white'
            }`}
          >
            <Mic size={36} />
          </button>
        ) : (
          <div className="w-full flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 resize-none border rounded-xl p-3"
              rows={2}
            />
            <button
              onClick={handleSend}
              className="bg-cyan-500 text-white rounded-xl px-4"
            >
              <Send />
            </button>
          </div>
        )}
      </div>

      {/* 结果 */}
      {loading && <p className="text-center text-sm">翻译中…</p>}

      {results.map((r, i) => (
        <div
          key={i}
          className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold">
              {r.label}
              {r.recommended && (
                <Star size={14} className="inline ml-1 text-yellow-500" />
              )}
            </span>
            <div className="flex gap-2">
              <button onClick={() => speak(r.translation, targetLang)}>
                <Volume2 size={16} />
              </button>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(r.translation)
                }
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          <p className="text-lg">{r.translation}</p>

          <details className="text-sm text-gray-500">
            <summary>回译</summary>
            {r.backTranslation}
          </details>
        </div>
      ))}
    </div>
  );
};

export default AITranslator;
