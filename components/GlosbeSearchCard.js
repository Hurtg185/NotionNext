import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Globe, Settings, X, Loader2, Copy, Volume2, Save, RotateCcw, ChevronDown } from 'lucide-react';

// ==========================================
// 1. 辅助函数
// ==========================================

// 生成 AI 提示词
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}： "${word}"
请严格按照下面的格式提供多种风格的翻译结果，不要有任何多余的解释或标题：

📖 **自然直译版**，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
*   **[此处为加粗的${toLang}翻译]**
*   ${fromLang}意思

💬 **口语版**，采用${toLang === '缅甸语' ? '缅甸' : '中国'}年轻人日常社交中的常用语和流行说法，风格自然亲切，避免书面语和机器翻译痕迹:
*   **[此处为加粗的${toLang}翻译]**
*   ${fromLang}意思

💡 **自然意译版**，遵循${toLang}的思维方式和表达习惯进行翻译，确保语句流畅地道，适当口语化:
*   **[此处为加粗的${toLang}翻译]**
*   ${fromLang}意思

🐼 **通顺意译**，将句子翻译成符合${toLang === '缅甸语' ? '缅甸人' : '中国人'}日常表达习惯的、流畅自然的${toLang}。
*   **[此处为加粗的${toLang}翻译]**
*   ${fromLang}意思
`.trim();

// 解析 AI 返回的文本内容
const parseTranslationResponse = (text) => {
  const sections = [];
  const sectionRegex = /(📖|💬|💡|🐼)\s*\*\*([^*]+)\*\*[^*]*\*\s*\*\*([^*]+)\*\*\s*\*\s*([^\n*]+)/g;
  
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({
      emoji: match[1],
      title: match[2].trim(),
      translation: match[3].trim(),
      meaning: match[4].trim()
    });
  }
  
  return sections;
};

// ==========================================
// 2. 主组件
// ==========================================

const GlosbeSearchCard = () => {
  // 基础状态
  const [inputText, setInputText] = useState('');
  const [translations, setTranslations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fromLang, setFromLang] = useState('中文');
  const [toLang, setToLang] = useState('缅甸语');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  
  // 设置相关的状态 (默认值)
  const [settings, setSettings] = useState({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    speechLang: 'auto' // 'auto' 跟随源语言，或者具体的语言代码
  });

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // 支持的翻译语言列表
  const languages = ['中文', '缅甸语', '英语', '泰语', '日语', '韩语'];

  // 支持的语音识别语言代码映射
  const speechLangMap = {
    '中文': 'zh-CN',
    '缅甸语': 'my-MM',
    '英语': 'en-US',
    '泰语': 'th-TH',
    '日语': 'ja-JP',
    '韩语': 'ko-KR'
  };

  // 语音识别语言选项 (用于设置界面)
  const voiceOptions = [
    { label: '自动 (跟随源语言)', value: 'auto' },
    { label: '中文 (zh-CN)', value: 'zh-CN' },
    { label: '缅甸语 (my-MM)', value: 'my-MM' },
    { label: '英语 (en-US)', value: 'en-US' },
    { label: '泰语 (th-TH)', value: 'th-TH' },
    { label: '日语 (ja-JP)', value: 'ja-JP' },
    { label: '韩语 (ko-KR)', value: 'ko-KR' },
  ];

  // 初始化加载本地存储的设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('translator-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }, []);

  // 保存设置
  const handleSaveSettings = () => {
    localStorage.setItem('translator-settings', JSON.stringify(settings));
    setShowSettings(false);
    setError(null); // 清除可能存在的旧错误
  };

  // 初始化语音识别
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      // 确定语音识别语言
      let currentLang = 'zh-CN';
      if (settings.speechLang && settings.speechLang !== 'auto') {
        currentLang = settings.speechLang;
      } else {
        currentLang = speechLangMap[fromLang] || 'zh-CN';
      }
      
      recognitionRef.current.lang = currentLang;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setError('语音识别失败，请重试');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [fromLang, settings.speechLang]);

  // 处理翻译逻辑 (支持自定义 API)
  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('请输入要翻译的内容');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranslations([]);

    const prompt = getAIPrompt(inputText, fromLang, toLang);

    try {
      let rawResult = '';

      // 如果配置了 API Key，则使用直连模式
      if (settings.apiKey) {
        let apiUrl = settings.baseUrl;
        // 处理 Base URL 结尾的斜杠
        if (apiUrl.endsWith('/')) {
            apiUrl = apiUrl.slice(0, -1);
        }
        // 如果用户只填了域名，补全路径
        if (!apiUrl.includes('/chat/completions')) {
            apiUrl = `${apiUrl}/chat/completions`;
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: parseFloat(settings.temperature)
          }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API请求失败: ${response.status} ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        rawResult = data.choices?.[0]?.message?.content || '';

      } else {
        // 否则使用默认的后端 API (假设你有一个 /api/translate 路由)
        // 注意：如果你完全想在前端跑，必须填写 Key，或者保留这个后端调用作为备选
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, fromLang, toLang }),
        });

        if (!response.ok) {
          throw new Error('翻译请求失败');
        }

        const data = await response.json();
        rawResult = data.result;
      }

      // 解析结果
      const parsedTranslations = parseTranslationResponse(rawResult);
      
      if (parsedTranslations.length === 0) {
        // 如果解析失败，尝试直接显示原始内容（兜底）
        if (rawResult) {
            setTranslations([{
                emoji: '🤖',
                title: 'AI 原始回复',
                translation: rawResult,
                meaning: '无法按标准格式解析，仅显示原始内容'
            }]);
        } else {
            throw new Error('无法解析翻译结果');
        }
      } else {
        setTranslations(parsedTranslations);
      }

    } catch (err) {
      setError(err.message || '翻译失败，请重试');
      console.error('Translation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 交换语言
  const handleSwapLanguages = () => {
    setFromLang(toLang);
    setToLang(fromLang);
    setInputText('');
    setTranslations([]);
  };

  // 处理语音输入
  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('您的浏览器不支持语音识别');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // 复制文本
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // 可以添加 toast 提示
      console.log('Copied:', text);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  };

  // 朗读文本
  const handleSpeak = (text, lang) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLangMap[lang] || 'zh-CN';
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold text-indigo-900 mb-2">智能翻译助手</h1>
          <p className="text-gray-600">多风格翻译，让沟通更自然</p>
        </header>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 relative">
          
          {/* 右上角设置按钮 */}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all z-10"
            title="设置"
          >
            <Settings className="w-6 h-6" />
          </button>

          {/* Settings Modal (Overlay) */}
          {showSettings && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-2xl p-6 flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                   <Settings className="w-5 h-5 text-indigo-600"/> 配置参数
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key (可选)</label>
                  <input 
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">留空则尝试使用默认后端接口</p>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base URL (接口地址)</label>
                  <input 
                    type="text"
                    value={settings.baseUrl}
                    onChange={(e) => setSettings({...settings, baseUrl: e.target.value})}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model (模型名称)</label>
                  <input 
                    type="text"
                    value={settings.model}
                    onChange={(e) => setSettings({...settings, model: e.target.value})}
                    placeholder="gpt-3.5-turbo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature (随机性): {settings.temperature}
                  </label>
                  <input 
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => setSettings({...settings, temperature: e.target.value})}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>精确 (0.0)</span>
                    <span>创意 (2.0)</span>
                  </div>
                </div>

                {/* Speech Recognition Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">语音识别语言</label>
                  <div className="relative">
                    <select
                      value={settings.speechLang}
                      onChange={(e) => setSettings({...settings, speechLang: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none bg-white"
                    >
                      {voiceOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setSettings({
                    apiKey: '',
                    baseUrl: 'https://api.openai.com/v1',
                    model: 'gpt-3.5-turbo',
                    temperature: 0.7,
                    speechLang: 'auto'
                  })}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> 重置
                </button>
                <button 
                  onClick={handleSaveSettings}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors font-medium shadow-sm"
                >
                  <Save className="w-4 h-4" /> 保存配置
                </button>
              </div>
            </div>
          )}

          {/* Language Selector */}
          <div className="flex items-center justify-between mb-6 pr-10"> {/* pr-10 to avoid overlap with settings button */}
            <select
              value={fromLang}
              onChange={(e) => setFromLang(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>

            <button
              onClick={handleSwapLanguages}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="交换语言"
            >
              <ArrowLeftRight className="w-5 h-5 text-gray-600" />
            </button>

            <select
              value={toLang}
              onChange={(e) => setToLang(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Input Area */}
          <div className="relative mb-4">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入要翻译的内容..."
              className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleTranslate();
                }
              }}
            />
            
            {/* Input Actions */}
            <div className="absolute bottom-3 right-3 flex gap-2">
              {inputText && (
                <button
                  onClick={() => setInputText('')}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="清空"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
              
              <button
                onClick={handleVoiceInput}
                className={`p-2 rounded-full transition-colors ${
                  isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-gray-100 text-gray-600'
                }`}
                aria-label="语音输入"
                title={`语音输入 (${settings.speechLang === 'auto' ? speechLangMap[fromLang] : settings.speechLang})`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Translate Button */}
          <button
            onClick={handleTranslate}
            disabled={isLoading || !inputText.trim()}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                翻译中...
              </>
            ) : (
              <>
                <Globe className="w-5 h-5" />
                翻译 (Ctrl+Enter)
              </>
            )}
          </button>
        </div>

        {/* Translation Results */}
        {translations.length > 0 && (
          <div className="space-y-4">
            {translations.map((section, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <span>{section.emoji}</span>
                    {section.title}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(section.translation)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="复制"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleSpeak(section.translation, toLang)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="朗读"
                    >
                      <Volume2 className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                
                <p className="text-xl text-indigo-900 font-medium mb-2">
                  {section.translation}
                </p>
                
                <p className="text-sm text-gray-600">
                  {section.meaning}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlosbeSearchCard;
