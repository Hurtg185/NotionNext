// pages/translator.js
import React, { useState, useRef, useEffect } from 'react';
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
  { code: 'my', name: '缅甸语', flag: '🇲🇲' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'th', name: '泰语', flag: '🇹🇭' },
  { code: 'ja', name: '日语', flag: '🇯🇵' },
  { code: 'ko', name: '韩语', flag: '🇰🇷' },
];

// 模型配置
const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5' },
];

export default function TranslatorPage() {
  // --- 状态管理 ---
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('my');
  
  // 翻译结果历史
  const [translations, setTranslations] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showMoreLangs, setShowMoreLangs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [voiceLang, setVoiceLang] = useState('zh');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  
  const [settings, setSettings] = useState({
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    autoSendVoice: true,
  });

  const textareaRef = useRef(null);
  const resultsRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- 初始化 ---
  useEffect(() => {
    // 加载设置
    const saved = localStorage.getItem('translator-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
      setSelectedModel(parsed.model || 'gpt-4o-mini');
    }
  }, []);

  // 监听输入框高度自动变化
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  // --- 辅助函数 ---
  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('translator-settings', JSON.stringify(newSettings));
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const getLangName = (code) => LANGUAGES.find(l => l.code === code)?.name || code;
  const getLangFlag = (code) => LANGUAGES.find(l => l.code === code)?.flag || '🌐';

  // --- 核心功能: 翻译 ---
  const handleTranslate = async () => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          sourceLang: sourceLang, 
          targetLang: targetLang,
          customConfig: {
            baseUrl: settings.apiEndpoint,
            apiKey: settings.apiKey,
            model: selectedModel,
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || '请求失败');
      }

      if (data.translations) {
        const newResult = {
          sourceText: data.sourceText,
          sourceLang: getLangName(data.sourceLang),
          targetLang: getLangName(data.targetLang),
          results: data.translations
        };

        setTranslations(prev => [newResult, ...prev]);
        setInputText(''); // 清空输入框
        
        // 滚动到顶部查看新结果
        if (resultsRef.current) {
          setTimeout(() => {
            resultsRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }, 100);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      alert(`翻译出错: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 核心功能: 语音识别 ---
  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    const langMap = { 'zh': 'zh-CN', 'my': 'my-MM', 'en': 'en-US', 'th': 'th-TH' };
    recognition.lang = langMap[voiceLang] || 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputText(transcript);
      
      if (event.results[0].isFinal && settings.autoSendVoice) {
        setTimeout(() => {
           triggerTranslateWithText(transcript);
        }, 500);
      }
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const triggerTranslateWithText = async (text) => {
    if (!text || !text.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          sourceLang: sourceLang, 
          targetLang: targetLang,
          customConfig: {
            baseUrl: settings.apiEndpoint,
            apiKey: settings.apiKey,
            model: selectedModel,
          },
        }),
      });
      const data = await response.json();
      if (data.translations) {
        setTranslations(prev => [{
          sourceText: data.sourceText,
          sourceLang: getLangName(data.sourceLang),
          targetLang: getLangName(data.targetLang),
          results: data.translations
        }, ...prev]);
        setInputText('');
      }
    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
  };

  // --- 核心功能: 复制 & 朗读 ---
  const copyText = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const speakText = (text, langName) => {
    const utterance = new SpeechSynthesisUtterance(text);
    let code = 'en-US';
    if (langName.includes('中')) code = 'zh-CN';
    else if (langName.includes('缅')) code = 'my-MM';
    else if (langName.includes('英')) code = 'en-US';
    
    utterance.lang = code;
    window.speechSynthesis.speak(utterance);
  };

  const hasInput = inputText.trim().length > 0;

  return (
    <>
      <Head>
        <title>中缅智译</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* 
        ★ 核心修复布局：
        fixed inset-0: 强制占满可视窗口，忽略父级高度限制
        z-[9999]: 确保盖在所有主题元素上面
        flex flex-col: 垂直布局
      */}
      <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-50 overflow-hidden text-slate-900 font-sans">
        
        {/* 1. 顶部 Header (flex-shrink-0 不可压缩) */}
        <header className="flex-shrink-0 bg-white border-b px-4 py-3 z-10 shadow-sm">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            {/* 源语言 */}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => setShowMoreLangs(!showMoreLangs)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold text-sm whitespace-nowrap"
              >
                {getLangFlag(sourceLang)} {getLangName(sourceLang)}
                {showMoreLangs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* 交换按钮 */}
            <button
              onClick={swapLanguages}
              className="mx-2 p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-500 transition-all"
            >
              <ArrowUpDown size={18} />
            </button>

            {/* 目标语言 */}
            <div className="flex-1 min-w-0 flex justify-end">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-600 font-bold text-sm whitespace-nowrap">
                {getLangFlag(targetLang)} {getLangName(targetLang)}
              </button>
            </div>

            {/* 设置按钮 */}
            <button
              onClick={() => setShowSettings(true)}
              className="ml-3 p-2 text-gray-400 hover:text-gray-600"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* 更多语言下拉 */}
          {showMoreLangs && (
            <div className="absolute top-14 left-0 right-0 bg-white border-b shadow-lg z-20 p-4 animate-in slide-in-from-top-2">
              <div className="max-w-lg mx-auto">
                <p className="text-xs text-gray-400 mb-2 font-bold">源语言</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANGUAGES.map(lang => (
                    <button
                      key={`src-${lang.code}`}
                      onClick={() => { setSourceLang(lang.code); setShowMoreLangs(false); }}
                      className={`px-3 py-1.5 rounded-full text-xs border ${sourceLang === lang.code ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mb-2 font-bold">目标语言</p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={`tgt-${lang.code}`}
                      onClick={() => { setTargetLang(lang.code); setShowMoreLangs(false); }}
                      className={`px-3 py-1.5 rounded-full text-xs border ${targetLang === lang.code ? 'bg-green-500 text-white' : 'bg-white'}`}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* 2. 中间滚动区域 (flex-1 自动占据剩余高度, min-h-0 防止溢出) */}
        <main 
          ref={resultsRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-50 scroll-smooth w-full"
        >
          <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
            {translations.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4 text-4xl">🌏</div>
                <p className="text-gray-500 font-medium">输入文字或语音开始翻译</p>
              </div>
            ) : (
              translations.map((response, idx) => (
                <div key={idx} className="animate-in slide-in-from-bottom-2 duration-300">
                  {/* 源文本气泡 */}
                  <div className="flex justify-end mb-2">
                    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm max-w-[85%]">
                      <p className="text-sm">{response.sourceText}</p>
                    </div>
                  </div>
                  
                  {/* 翻译结果 */}
                  <div className="space-y-3">
                    {response.results.map((result, rIdx) => (
                      <div key={rIdx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-400">{result.label}</span>
                          {rIdx === 1 && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">推荐</span>}
                        </div>
                        <p className="text-gray-800 text-lg leading-relaxed font-medium">{result.translation}</p>
                        <div className="mt-2 pt-2 border-t border-gray-50">
                           <p className="text-[10px] text-gray-400 mb-0.5">回译:</p>
                           <p className="text-blue-500 text-sm font-mono">{result.backTranslation}</p>
                        </div>
                        <div className="flex justify-end gap-3 mt-3">
                          <button onClick={() => speakText(result.translation, response.targetLang)} className="p-1.5 text-gray-400 hover:text-blue-500"><Volume2 size={16} /></button>
                          <button onClick={() => copyText(result.translation, `${idx}-${rIdx}`)} className="flex items-center gap-1 p-1.5 text-gray-400 hover:text-green-600 text-xs">
                            {copiedId === `${idx}-${rIdx}` ? <Check size={16} /> : <Copy size={16} />}
                            {copiedId === `${idx}-${rIdx}` ? "已复制" : "复制"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="my-6 border-t border-gray-200/50 w-1/2 mx-auto"></div>
                </div>
              ))
            )}
            {/* 底部垫片 */}
            <div className="h-4 w-full"></div>
          </div>
        </main>

        {/* 3. 底部固定区域 (flex-shrink-0) */}
        <footer className="flex-shrink-0 bg-white border-t border-gray-200 z-30 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-lg mx-auto px-4 py-2 w-full">
            {/* 工具栏 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-gray-400 flex-shrink-0">语音:</span>
                {[{code:'zh', label:'中'}, {code:'my', label:'缅'}, {code:'en', label:'英'}].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setVoiceLang(lang.code)}
                    className={`px-2 py-1 rounded text-xs font-bold ${voiceLang === lang.code ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">模型:</span>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="text-xs bg-gray-100 border-none rounded py-1 pl-2 pr-6 text-gray-600 font-medium">
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {/* 输入框主体 */}
            <div className="flex items-end gap-2 w-full">
              <div className="flex-1 bg-gray-100 rounded-2xl border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTranslate();
                    }
                  }}
                  placeholder="输入文字..."
                  className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-base text-gray-800 placeholder-gray-400"
                  rows={1}
                  style={{ maxHeight: '120px', minHeight: '48px' }}
                />
              </div>
              <button
                onClick={hasInput ? handleTranslate : toggleRecording}
                disabled={isLoading}
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
                  isLoading ? 'bg-gray-300' : hasInput ? 'bg-blue-600 text-white' : isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {isLoading ? <Loader2 size={24} className="animate-spin" /> : hasInput ? <ArrowUp size={24} strokeWidth={3} /> : <Mic size={24} />}
              </button>
            </div>
          </div>
        </footer>

        {/* 设置弹窗 */}
        {showSettings && (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-lg font-bold text-gray-800">设置</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">API 接口地址</label>
                  <input type="text" value={settings.apiEndpoint} onChange={(e) => saveSettings({ ...settings, apiEndpoint: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">API Key</label>
                  <input type="password" value={settings.apiKey} onChange={(e) => saveSettings({ ...settings, apiKey: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-gray-700">语音自动发送</span>
                  <button onClick={() => saveSettings({ ...settings, autoSendVoice: !settings.autoSendVoice })} className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoSendVoice ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.autoSendVoice ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full mt-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20">保存</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
