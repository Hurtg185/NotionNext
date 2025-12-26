import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Send, Volume2, Copy, Settings, Star
} from 'lucide-react';

const AITranslator = () => {
  // --- 状态 ---
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [targetLang, setTargetLang] = useState('my');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 语音识别引用
  const recognitionRef = useRef(null);

  // --- 初始化语音识别 ---
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
      // 可选：语音输入完直接触发翻译
      // handleSend(text); 
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  // --- 切换录音 ---
  const toggleListening = () => {
    if (!recognitionRef.current) return alert('浏览器不支持语音识别');

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // 根据目标语言反推输入语言：如果目标是缅语，我就是说中文，反之亦然
      recognitionRef.current.lang = targetLang === 'my' ? 'zh-CN' : 'my-MM';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // --- 发送翻译 ---
  const handleSend = async (overrideText) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if (!textToSend.trim()) return;

    setLoading(true);
    setResults([]);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          targetLang,
          sourceLang: "auto", // 自动检测
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results || []);
    } catch (e) {
      alert("翻译失败: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 朗读 (微软源) ---
  const speak = (text) => {
    // 简单的微软 TTS 代理
    const voice = targetLang === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'my-MM-NilarNeural';
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
    new Audio(url).play().catch(() => alert("播放失败"));
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-5 space-y-4">
      
      {/* 顶部栏 */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-700 dark:text-gray-200">极速翻译</h2>
        <div className="flex items-center gap-2">
           <select
            className="bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-3 py-1 text-sm font-bold text-cyan-600"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            <option value="my">翻译成 → 缅甸语</option>
            <option value="zh">翻译成 → 中文</option>
          </select>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:text-cyan-500">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="relative">
         <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-transparent focus:border-cyan-500 outline-none resize-none transition-all"
            placeholder={isListening ? "正在聆听..." : "请输入内容..."}
          />
          
          <div className="absolute bottom-3 right-3 flex gap-2">
             <button
              onClick={toggleListening}
              className={`p-3 rounded-full transition-all ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600 hover:bg-cyan-100'
              }`}
            >
              <Mic size={20} />
            </button>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input}
              className="px-6 py-2 bg-cyan-500 text-white font-bold rounded-full hover:bg-cyan-600 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "..." : <Send size={18} />}
            </button>
          </div>
      </div>

      {/* 结果显示 */}
      {results.map((r, i) => (
        <div key={i} className="bg-cyan-50 dark:bg-gray-800/50 border border-cyan-100 dark:border-gray-700 rounded-2xl p-5 space-y-3 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-600 bg-white px-2 py-1 rounded-md shadow-sm border border-cyan-100">
              {r.label}
            </span>
            <div className="flex gap-3 text-gray-400">
              <button onClick={() => speak(r.translation)} className="hover:text-cyan-600"><Volume2 size={18} /></button>
              <button onClick={() => navigator.clipboard.writeText(r.translation)} className="hover:text-cyan-600"><Copy size={18} /></button>
            </div>
          </div>

          <p className="text-xl font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
            {r.translation}
          </p>

          <div className="pt-2 border-t border-cyan-100 dark:border-gray-700">
             <p className="text-sm text-gray-500 dark:text-gray-400">
               <span className="mr-2 opacity-50">回译:</span> 
               {/* 注意：后端传回来的是 back_translation (下划线) */}
               {r.back_translation}
             </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AITranslator;
