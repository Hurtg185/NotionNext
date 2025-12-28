// TranslatorUI.js

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { 
  ArrowUpDown, 
  ArrowUp, 
  Mic, 
  Copy, 
  Volume2, 
  Settings, 
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Loader2
} from 'lucide-react';

// 语言配置
const LANGUAGES = [
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'my', name: '缅甸语', flag: '🇲🇲' }, // 确保名字跟后端 Prompt 一致
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'th', name: '泰语', flag: '🇹🇭' },
  { code: 'ja', name: '日语', flag: '🇯🇵' },
  { code: 'ko', name: '韩语', flag: '🇰🇷' },
];

// 语音识别语言映射
const SPEECH_LANG_MAP = {
  'zh': 'zh-CN',
  'my': 'my-MM',
  'en': 'en-US',
  'th': 'th-TH',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
};

// 模型列表
const MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
];

export default function TranslatorApp() {
  // --- 状态管理 ---
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  const [speechLang, setSpeechLang] = useState('zh');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [showMoreLangs, setShowMoreLangs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // 结果数据
  const [translationResult, setTranslationResult] = useState(null);
  
  const [copiedId, setCopiedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  
  // 设置
  const [settings, setSettings] = useState({
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    autoSendVoice: true,
  });

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // --- 初始化 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    
    // 加载本地设置
    const saved = localStorage.getItem('translator-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
      setSelectedModel(parsed.model || 'gpt-4o-mini');
    }
  }, []);

  // --- 辅助函数 ---
  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('translator-settings', JSON.stringify(newSettings));
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    // 同时交换语音语言
    setSpeechLang(targetLang); 
  };

  const getLangName = (code) => LANGUAGES.find(l => l.code === code)?.name || code;
  const getLangFlag = (code) => LANGUAGES.find(l => l.code === code)?.flag || '🌐';

  // --- 复制 & 朗读 ---
  const copyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('复制失败', err);
    }
  };

  const speakText = (text, langCode, id) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // 简单的语言映射兜底
    utterance.lang = SPEECH_LANG_MAP[langCode] || 'en-US';
    
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    
    setPlayingId(id);
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setPlayingId(null);
  };

  // --- 语音识别 ---
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANG_MAP[speechLang] || 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputText(transcript);
      
      if (event.results[0].isFinal && settings.autoSendVoice) {
        // 稍微延迟确保状态更新
        setTimeout(() => handleTranslate(transcript), 300);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // --- 核心翻译逻辑 ---
  const handleTranslate = useCallback(async (textOverride) => {
    const textToTranslate = textOverride || inputText;
    if (!textToTranslate?.trim()) return;

    setIsLoading(true);
    setTranslationResult(null); // 清空旧结果
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          // 后端需要的是语言代码 (zh/my)，在后端代码里会映射成中文名称
          sourceLang: sourceLang, 
          targetLang: targetLang,
          // 适配之前后端的 customConfig 结构
          customConfig: {
            baseUrl: settings.apiEndpoint,
            apiKey: settings.apiKey,
            model: selectedModel || settings.model,
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || '翻译请求失败');
      }
      
      setTranslationResult({
        sourceText: data.sourceText,
        translations: data.translations // 这里的结构就是后端返回的 [{label, translation, backTranslation}, ...]
      });
      
    } catch (error) {
      console.error('Translation error:', error);
      alert(`翻译失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sourceLang, targetLang, settings, selectedModel]);

  // 主要语言（前两个用于快捷显示）
  const primaryLangs = LANGUAGES.slice(0, 2);

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 overflow-hidden text-slate-800">
      <Head>
        <title>中缅智译</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      {/* --- 顶部语言选择栏 --- */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 z-20">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {/* 源语言 */}
          <button
            onClick={() => setShowMoreLangs(!showMoreLangs)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition active:bg-gray-200"
          >
            <span className="text-xl">{getLangFlag(sourceLang)}</span>
            <span className="font-medium text-sm">{getLangName(sourceLang)}</span>
            {showMoreLangs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* 交换按钮 */}
          <button
            onClick={swapLanguages}
            className="p-2 rounded-full hover:bg-gray-100 transition active:scale-95 border border-gray-100"
          >
            <ArrowUpDown size={18} className="text-blue-500" />
          </button>

          {/* 目标语言 */}
          <button
            onClick={() => setShowMoreLangs(!showMoreLangs)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition active:bg-gray-200"
          >
            <span className="text-xl">{getLangFlag(targetLang)}</span>
            <span className="font-medium text-sm">{getLangName(targetLang)}</span>
          </button>

          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full hover:bg-gray-100 transition"
          >
            <Settings size={20} className="text-gray-600" />
          </button>
        </div>

        {/* 更多语言下拉面板 */}
        {showMoreLangs && (
          <div className="absolute top-16 left-0 right-0 z-30 p-2 animate-in slide-in-from-top-2">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-lg mx-auto">
              <p className="text-xs text-gray-500 mb-2 font-bold">源语言</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {LANGUAGES.map(lang => (
                  <button
                    key={`source-${lang.code}`}
                    onClick={() => {
                      setSourceLang(lang.code);
                      setShowMoreLangs(false);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      sourceLang === lang.code
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {lang.flag} {lang.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-2 font-bold">目标语言</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={`target-${lang.code}`}
                    onClick={() => {
                      setTargetLang(lang.code);
                      setShowMoreLangs(false);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      targetLang === lang.code
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {lang.flag} {lang.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* --- 中间滚动区域 (翻译结果) --- */}
      <main 
        ref={resultsContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 pb-48 scroll-smooth" // pb-48 为底部 fixed 区域留出空间
      >
        <div className="max-w-lg mx-auto space-y-4">
          
          {/* 加载状态 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p className="text-sm text-gray-400">正在翻译...</p>
            </div>
          )}

          {/* 结果显示 */}
          {translationResult && !isLoading && (
            <>
              {/* 原文卡片 */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-2 font-bold uppercase">原文</p>
                <p className="text-gray-800 text-lg leading-relaxed">{translationResult.sourceText}</p>
              </div>

              {/* 译文卡片列表 */}
              {translationResult.translations.map((result, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400">{result.label}</span>
                    {result.recommended && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                        推荐
                      </span>
                    )}
                  </div>
                  
                  {/* 译文内容 */}
                  <p className="text-gray-800 text-lg mb-3 leading-relaxed font-medium">
                    {result.translation}
                  </p>
                  
                  {/* 回译内容 */}
                  <div className="mb-3 pl-2 border-l-2 border-blue-100">
                    <p className="text-blue-500 text-sm font-mono leading-relaxed">
                      <span className="opacity-50 text-xs mr-1">↩</span>
                      {result.backTranslation}
                    </p>
                  </div>
                  
                  {/* 操作按钮栏 */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => {
                        if (playingId === index) {
                          stopSpeaking();
                        } else {
                          speakText(result.translation, targetLang, index);
                        }
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition ${
                        playingId === index
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <Volume2 size={14} />
                      <span>{playingId === index ? '停止' : '朗读'}</span>
                    </button>

                    <button
                      onClick={() => copyText(result.translation, index)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition ${
                        copiedId === index
                           ? 'text-green-600 bg-green-50'
                           : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {copiedId === index ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedId === index ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 空状态提示 */}
          {!translationResult && !isLoading && (
            <div className="text-center py-20 opacity-40">
              <div className="bg-gray-200 w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4">
                 <span className="text-4xl">🌏</span>
              </div>
              <p className="text-gray-500">输入文字或按住麦克风开始翻译</p>
            </div>
          )}
        </div>
      </main>

      {/* --- 底部固定输入区域 --- */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto w-full">
          
          {/* 工具栏: 语音语言 & 模型 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-xs font-bold text-gray-400 flex-shrink-0">语音:</span>
              <div className="flex gap-1">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setSpeechLang(lang.code)}
                    className={`px-2 py-1 text-xs rounded-md transition border flex-shrink-0 ${
                      speechLang === lang.code
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 输入框行 */}
          <div className="flex items-end gap-2 w-full">
            <div className="flex-1 relative bg-gray-100 rounded-2xl border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="在此输入内容..."
                className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-gray-800 placeholder-gray-400 text-base"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTranslate();
                  }
                }}
              />
            </div>

            {/* 动态按钮 (发送 / 语音) */}
            {inputText.trim() ? (
              <button
                onClick={() => handleTranslate()}
                disabled={isLoading}
                className="flex-shrink-0 w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/30"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <ArrowUp size={24} strokeWidth={2.5} />
                )}
              </button>
            ) : (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95 shadow-md ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* --- 设置弹窗 --- */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-10">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="font-bold text-lg text-gray-800">设置</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* API 设置 */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">API 配置</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">接口地址 (Base URL)</label>
                  <input
                    type="text"
                    value={settings.apiEndpoint}
                    onChange={(e) => setSettings({ ...settings, apiEndpoint: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                   <select 
                     value={selectedModel}
                     onChange={(e) => {
                       setSelectedModel(e.target.value);
                       setSettings({ ...settings, model: e.target.value });
                     }}
                     className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
                   >
                     {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                </div>
              </div>

              {/* 行为设置 */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">行为</h3>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-800">语音识别自动发送</p>
                    <p className="text-xs text-gray-400">说话结束后自动提交翻译</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, autoSendVoice: !settings.autoSendVoice })}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      settings.autoSendVoice ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        settings.autoSendVoice ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 保存按钮 */}
              <button
                onClick={() => {
                  saveSettings(settings);
                  setShowSettings(false);
                }}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 mt-2"
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
