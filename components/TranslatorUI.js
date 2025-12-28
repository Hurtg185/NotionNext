// pages/translator.js

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Head from 'next/head';

// --- 图标组件集合 ---
const Icons = {
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  ArrowRightLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>,
  Mic: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Volume2: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  X: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
};

// --- 主页面组件 ---
export default function TranslatorApp() {
  // 核心状态
  const [history, setHistory] = useState([]); // 翻译历史数组
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 语言设置
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  
  // 配置
  const [config, setConfig] = useState({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    autoPlay: false
  });

  // 语音识别
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('zh-CN'); 
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null); // 用于滚动到底部

  // 初始化加载
  useEffect(() => {
    const savedConfig = localStorage.getItem('my_translator_config');
    const savedHistory = localStorage.getItem('my_translator_history');
    if (savedConfig) setConfig(JSON.parse(savedConfig));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // 监听历史记录变化并保存
  useEffect(() => {
    localStorage.setItem('my_translator_history', JSON.stringify(history));
    scrollToBottom();
  }, [history]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 交换语言
  const handleSwapLang = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    // 同时也交换语音识别语言
    if (targetLang === 'zh') setVoiceLang('zh-CN');
    else if (targetLang === 'my') setVoiceLang('my-MM');
  };

  // 清空历史
  const clearHistory = () => {
    if (confirm('确定要清空所有翻译记录吗？')) {
      setHistory([]);
    }
  };

  // 语音识别逻辑
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      if (event.results[0].isFinal) {
        setInputText(prev => prev + transcript);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // 发送翻译请求
  const handleTranslate = async () => {
    if (!inputText.trim() || isLoading) return;

    const currentText = inputText;
    setInputText(''); // 立即清空输入框
    setIsLoading(true);

    // 乐观更新：先显示用户的提问
    const newEntryId = Date.now();
    const tempEntry = {
      id: newEntryId,
      sourceText: currentText,
      sourceLang: sourceLang,
      targetLang: targetLang,
      translations: [], // 还没结果
      loading: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setHistory(prev => [...prev, tempEntry]);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          sourceLang,
          targetLang,
          customConfig: {
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model
          }
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || '请求失败');

      // 更新历史记录中的该条目
      setHistory(prev => prev.map(item => {
        if (item.id === newEntryId) {
          return {
            ...item,
            loading: false,
            // 后端返回的是数组，我们这里保存所有翻译版本
            translations: data.translations, 
            sourceLang: data.sourceLang,
            targetLang: data.targetLang
          };
        }
        return item;
      }));

    } catch (err) {
      // 错误处理：更新条目显示错误
      setHistory(prev => prev.map(item => {
        if (item.id === newEntryId) {
          return { ...item, loading: false, error: err.message };
        }
        return item;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>中缅智译</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      {/* 全屏容器：强制深色背景 */}
      <div 
        className="fixed inset-0 w-full h-full bg-slate-900 text-slate-100 font-sans flex flex-col"
        style={{ backgroundColor: '#0f172a' }} // 兜底样式
      >
        
        {/* --- 1. 顶部语言栏 (固定) --- */}
        <header className="flex-none bg-slate-800 border-b border-slate-700 z-20 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 justify-center">
              <div className="w-20 text-center font-bold text-slate-200">
                {sourceLang === 'zh' ? '中文' : '缅甸语'}
              </div>
              
              <button 
                onClick={handleSwapLang}
                className="p-2 rounded-full hover:bg-slate-700 text-indigo-400 transition-colors"
              >
                <Icons.ArrowRightLeft />
              </button>
              
              <div className="w-20 text-center font-bold text-slate-200">
                {targetLang === 'zh' ? '中文' : '缅甸语'}
              </div>
            </div>

            {/* 设置按钮 */}
            <button 
              onClick={() => setShowSettings(true)}
              className="absolute right-4 p-2 text-slate-400 hover:text-white"
            >
              <Icons.Settings />
            </button>
            {/* 清空按钮（左侧） */}
             <button 
              onClick={clearHistory}
              className="absolute left-4 p-2 text-slate-400 hover:text-red-400"
            >
              <Icons.Trash />
            </button>
          </div>
        </header>

        {/* --- 2. 中间滚动区域 (翻译历史) --- */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-40 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6">
            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 mt-20 opacity-50">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-indigo-500">AI</span>
                </div>
                <p>请输入文字或语音开始翻译</p>
              </div>
            )}

            {history.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
            
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* --- 3. 底部输入区域 (固定) --- */}
        <footer className="flex-none bg-white/5 backdrop-blur-xl border-t border-slate-700/50 z-30 pb-safe">
          <div className="max-w-3xl mx-auto">
            
            {/* 快速切换栏 */}
            <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] text-slate-500 font-bold uppercase mr-1 flex-none">语音识别:</span>
              {[
                { label: '中文', code: 'zh-CN' },
                { label: '缅文', code: 'my-MM' },
                { label: '英文', code: 'en-US' }
              ].map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setVoiceLang(lang.code)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-none ${
                    voiceLang === lang.code 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* 输入框主体 */}
            <div className="p-3 flex items-end gap-3">
              <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all flex items-end">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTranslate();
                    }
                  }}
                  placeholder="请输入内容..."
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-500 resize-none max-h-32 min-h-[44px] py-3 px-4"
                  style={{ height: 'auto' }}
                  rows={1}
                />
              </div>

              {/* 动态按钮：有文字显示发送，无文字显示语音 */}
              {inputText.trim() ? (
                <button
                  onClick={handleTranslate}
                  disabled={isLoading}
                  className="flex-none w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icons.Send />
                </button>
              ) : (
                <button
                  onClick={toggleListening}
                  className={`flex-none w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/30' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {isListening ? <Icons.MicOff /> : <Icons.Mic />}
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* --- 4. 设置弹窗 --- */}
        {showSettings && (
          <SettingsModal 
            config={config} 
            setConfig={setConfig} 
            onClose={() => setShowSettings(false)} 
          />
        )}

      </div>
    </>
  );
}

// --- 子组件：单条历史记录 ---
function HistoryItem({ item }) {
  if (item.loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="flex justify-end">
          <div className="bg-indigo-600/20 text-indigo-100 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
            {item.sourceText}
          </div>
        </div>
        <div className="flex gap-3">
           <div className="w-8 h-8 rounded-full bg-slate-700 flex-none" />
           <div className="bg-slate-800 h-24 w-full rounded-2xl rounded-tl-sm" />
        </div>
      </div>
    );
  }

  if (item.error) {
    return (
       <div className="flex justify-center my-4">
         <span className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20">
           翻译失败: {item.error}
         </span>
       </div>
    );
  }

  // 默认只显示“推荐”的翻译，也就是数组中 recommended: true 的，或者第一个
  const mainTranslation = item.translations.find(t => t.recommended) || item.translations[0];
  const otherTranslations = item.translations.filter(t => t !== mainTranslation);

  return (
    <div className="space-y-2 group">
      {/* 1. 用户输入 (右侧气泡) */}
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-base shadow-md max-w-[85%] break-words">
          {item.sourceText}
        </div>
      </div>

      {/* 2. 机器翻译 (左侧卡片) */}
      <div className="flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-none flex items-center justify-center text-[10px] font-bold text-white shadow-lg mt-1">
          AI
        </div>
        
        <div className="flex-1 space-y-3">
          {/* 主翻译结果卡片 */}
          <TranslationCard result={mainTranslation} isMain={true} />
          
          {/* 其他翻译版本 (可选，稍微小一点) */}
          {otherTranslations.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-300 py-1 select-none">
                查看其他 {otherTranslations.length} 种翻译版本
              </summary>
              <div className="space-y-2 mt-2 pl-2 border-l-2 border-slate-700">
                {otherTranslations.map((t, idx) => (
                  <TranslationCard key={idx} result={t} isMain={false} />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 子组件：翻译结果卡片 ---
function TranslationCard({ result, isMain }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    // 简单的语言判断
    const isMyanmar = /[\u1000-\u109F]/.test(text);
    utterance.lang = isMyanmar ? 'my-MM' : 'zh-CN'; 
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all
      ${isMain 
        ? 'bg-slate-800 border-indigo-500/30 shadow-md' 
        : 'bg-slate-800/50 border-slate-700/50'}
    `}>
      {/* 标签 */}
      <div className="px-3 py-1.5 bg-black/20 flex justify-between items-center border-b border-white/5">
        <span className={`text-xs font-bold ${isMain ? 'text-indigo-400' : 'text-slate-500'}`}>
          {result.label}
        </span>
      </div>

      <div className="p-3">
        {/* 译文 */}
        <div className={`leading-relaxed text-slate-100 ${isMain ? 'text-lg' : 'text-sm'}`}>
          {result.translation}
        </div>
        
        {/* 回译 (蓝色小字) */}
        <div className="mt-2 pt-2 border-t border-white/5">
           <p className="text-[10px] text-slate-500 mb-0.5">回译检测:</p>
           <p className="text-xs text-blue-400 font-mono leading-relaxed">
             {result.backTranslation}
           </p>
        </div>

        {/* 操作按钮行 */}
        <div className="flex gap-4 mt-3 pt-1 justify-end opacity-80 hover:opacity-100 transition-opacity">
          <button 
            onClick={() => handleSpeak(result.translation)}
            className="text-slate-400 hover:text-white p-1"
            title="朗读"
          >
            <Icons.Volume2 />
          </button>
          <button 
            onClick={() => handleCopy(result.translation)}
            className="text-slate-400 hover:text-indigo-400 p-1 flex items-center gap-1"
            title="复制"
          >
            {copied ? <Icons.Check /> : <Icons.Copy />}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 子组件：设置弹窗 ---
function SettingsModal({ config, setConfig, onClose }) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    setConfig(localConfig);
    localStorage.setItem('my_translator_config', JSON.stringify(localConfig));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h3 className="font-bold text-white">翻译设置</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <Icons.X />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">API Key</label>
            <input 
              type="password" 
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({...localConfig, apiKey: e.target.value})}
              placeholder="sk-..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm transition-colors focus:bg-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">接口地址 (Base URL)</label>
            <input 
              type="text" 
              value={localConfig.baseUrl}
              onChange={(e) => setLocalConfig({...localConfig, baseUrl: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">模型</label>
            <input 
              type="text" 
              value={localConfig.model}
              onChange={(e) => setLocalConfig({...localConfig, model: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 pt-2">
             <input 
               type="checkbox" 
               id="autoplay"
               checked={localConfig.autoPlay} 
               onChange={(e) => setLocalConfig({...localConfig, autoPlay: e.target.checked})}
               className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
             />
             <label htmlFor="autoplay" className="text-sm text-slate-300">自动朗读译文 (TTS)</label>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-900/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 transition-colors"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
