import { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Globe, Settings, X, Loader2, Copy, Volume2, Repeat } from 'lucide-react';

// Helper function to generate AI prompt
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

// Parse AI response into structured data
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

const TranslatorApp = () => {
  const [inputText, setInputText] = useState('');
  const [translations, setTranslations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fromLang, setFromLang] = useState('中文');
  const [toLang, setToLang] = useState('缅甸语');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Supported languages
  const languages = ['中文', '缅甸语', '英语', '泰语', '日语', '韩语'];

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      // Set language based on fromLang
      const langMap = {
        '中文': 'zh-CN',
        '缅甸语': 'my-MM',
        '英语': 'en-US',
        '泰语': 'th-TH',
        '日语': 'ja-JP',
        '韩语': 'ko-KR'
      };
      recognitionRef.current.lang = langMap[fromLang] || 'zh-CN';

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
  }, [fromLang]);

  // Handle translation
  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('请输入要翻译的内容');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranslations([]);

    try {
      const prompt = getAIPrompt(inputText, fromLang, toLang);
      
      // Replace with your actual AI API call
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
      const parsedTranslations = parseTranslationResponse(data.result);
      
      if (parsedTranslations.length === 0) {
        throw new Error('无法解析翻译结果');
      }
      
      setTranslations(parsedTranslations);
    } catch (err) {
      setError(err.message || '翻译失败，请重试');
      console.error('Translation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle language swap
  const handleSwapLanguages = () => {
    setFromLang(toLang);
    setToLang(fromLang);
    setInputText('');
    setTranslations([]);
  };

  // Handle voice input
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

  // Handle copy to clipboard
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You can add a toast notification here
      console.log('Copied:', text);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  };

  // Handle text-to-speech
  const handleSpeak = (text, lang) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap = {
        '中文': 'zh-CN',
        '缅甸语': 'my-MM',
        '英语': 'en-US',
        '泰语': 'th-TH',
        '日语': 'ja-JP',
        '韩语': 'ko-KR'
      };
      utterance.lang = langMap[lang] || 'zh-CN';
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold text-indigo-900 mb-2">智能翻译助手</h1>
          <p className="text-gray-600">多风格翻译，让沟通更自然</p>
        </header>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* Language Selector */}
          <div className="flex items-center justify-between mb-6">
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
                  isListening ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
                aria-label="语音输入"
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

export default TranslatorApp;
