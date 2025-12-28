// components/TranslatorUI.js
import React, { useState, useEffect, useRef } from 'react';

// 简单的 SVG 图标组件，避免引入额外依赖
const Icons = {
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Mic: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  ),
  MicOff: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  ),
  Send: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  ),
  Copy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  )
};

export default function TranslatorUI() {
  // --- 状态管理 ---
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null); // 存储后端返回的完整结果
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 设置相关
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini'
  });

  // 语音识别相关
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('zh-CN'); // zh-CN or my-MM
  const recognitionRef = useRef(null);

  // --- 初始化加载配置 ---
  useEffect(() => {
    const savedConfig = localStorage.getItem('my_translator_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  // --- 语音识别逻辑 ---
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别功能，请使用 Chrome 或 Edge。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.continuous = false; // 讲完一句自动停止，符合翻译场景
    recognition.interimResults = true; // 显示中间结果

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      // 如果是中间结果，可以考虑显示在 UI 上，这里简化为直接覆盖输入框
      // 实际应用中可以做追加或替换逻辑，这里选择追加
      if (event.results[0].isFinal) {
         setInputText(prev => (prev ? prev + ' ' : '') + transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- 保存设置 ---
  const handleSaveSettings = () => {
    localStorage.setItem('my_translator_config', JSON.stringify(config));
    setShowSettings(false);
  };

  // --- 翻译请求 ---
  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          // 将前端配置传给后端
          customConfig: {
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model
          }
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || '请求失败');
      
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* --- 顶部导航 --- */}
      <header className="px-6 py-4 bg-slate-800/50 backdrop-blur border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">
            AI
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            中缅智译
          </h1>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
          title="设置 API"
        >
          <Icons.Settings />
        </button>
      </header>

      {/* --- 主要内容区域 --- */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col gap-6">
        
        {/* 输入区域 */}
        <div className="bg-slate-800 rounded-2xl p-4 shadow-xl border border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="请输入中文或缅甸语..."
            className="w-full bg-transparent border-none focus:ring-0 text-lg resize-none min-h-[120px] placeholder-slate-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleTranslate();
              }
            }}
          />
          
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
            {/* 语音控制区 */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleListening}
                className={`p-3 rounded-full transition-all flex items-center gap-2 ${
                  isListening 
                    ? 'bg-red-500/20 text-red-400 animate-pulse' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
                title="语音输入"
              >
                {isListening ? <Icons.MicOff /> : <Icons.Mic />}
              </button>
              
              <select 
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="bg-slate-700 text-xs text-slate-300 rounded px-2 py-1 border-none focus:ring-0 cursor-pointer"
                disabled={isListening}
              >
                <option value="zh-CN">说中文</option>
                <option value="my-MM">说缅语</option>
              </select>
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleTranslate}
              disabled={isLoading || !inputText.trim()}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-all ${
                isLoading 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
              }`}
            >
              {isLoading ? '翻译中...' : '翻译'}
              {!isLoading && <Icons.Send />}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 结果展示区 */}
        {result && result.translations && (
          <div className="space-y-4 pb-20">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>{result.sourceLang === 'zh' ? '中文 ➔ 缅甸语' : '缅甸语 ➔ 中文'}</span>
              <span className="bg-slate-800 px-2 py-1 rounded">源文检测完成</span>
            </div>

            {result.translations.map((item) => (
              <TranslationCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* --- 设置弹窗 --- */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-bold text-lg">API 设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <Icons.X />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">接口地址 (Base URL)</label>
                <input 
                  type="text" 
                  value={config.baseUrl}
                  onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">API Key</label>
                <input 
                  type="password" 
                  value={config.apiKey}
                  onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                  placeholder="sk-..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">模型 (Model)</label>
                <input 
                  type="text" 
                  value={config.model}
                  onChange={(e) => setConfig({...config, model: e.target.value})}
                  placeholder="gpt-4o-mini"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-900/50 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 子组件：单张翻译卡片
function TranslationCard({ item }) {
  const [copiedT, setCopiedT] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const copyToClipboard = (text, isBack) => {
    navigator.clipboard.writeText(text);
    if (isBack) {
      setCopiedB(true);
      setTimeout(() => setCopiedB(false), 2000);
    } else {
      setCopiedT(true);
      setTimeout(() => setCopiedT(false), 2000);
    }
  };

  return (
    <div className={`rounded-xl overflow-hidden border transition-all duration-300 ${
      item.recommended 
        ? 'bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-900/10' 
        : 'bg-slate-800/60 border-slate-700'
    }`}>
      {/* 标题栏 */}
      <div className="px-4 py-2 bg-black/20 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${item.recommended ? 'text-indigo-400' : 'text-slate-400'}`}>
            {item.label}
          </span>
          {item.recommended && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
              推荐
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid gap-4">
        {/* 译文 */}
        <div className="group relative">
          <div className="text-lg leading-relaxed text-indigo-100 pr-8">
            {item.translation}
          </div>
          <button 
            onClick={() => copyToClipboard(item.translation, false)}
            className="absolute top-0 right-0 p-1.5 text-slate-500 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
            title="复制译文"
          >
            {copiedT ? <Icons.Check /> : <Icons.Copy />}
          </button>
        </div>

        {/* 回译分割线 */}
        <div className="h-px bg-slate-700/50" />

        {/* 回译 */}
        <div className="group relative">
          <div className="text-sm text-slate-400 font-mono pr-8">
             <span className="opacity-50 select-none mr-2">回译:</span>
             {item.backTranslation}
          </div>
           <button 
            onClick={() => copyToClipboard(item.backTranslation, true)}
            className="absolute top-0 right-0 p-1.5 text-slate-600 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
            title="复制回译"
          >
            {copiedB ? <Icons.Check /> : <Icons.Copy />}
          </button>
        </div>
      </div>
    </div>
  );
}
