import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Volume2, Copy, ExternalLink, X, BookOpen } from 'lucide-react';

// ==========================================
// 1. 数据加载逻辑 (增强版：适配正反面/缅文数据)
// ==========================================
const loadLocalData = () => {
  let allItems = [];
  const hskLevels = [1, 2, 3, 4, 5, 6];
  
  hskLevels.forEach(level => {
    try {
      const words = require(`@/data/hsk/hsk${level}.json`); 
      
      if (Array.isArray(words)) {
        // 数据清洗：尝试获取更多字段 (背面内容)
        const taggedWords = words.map(w => ({ 
            // 正面 (Front)
            hanzi: w.hanzi || w.chinese || w.word, 
            pinyin: w.pinyin,
            
            // 背面 (Back) - 尝试匹配各种可能的字段名
            definition: w.definition || w.meaning || w.english, // 英文释义
            burmese: w.burmese || w.myanmar || w.translation_my || w.meaning_my, // 缅文释义 (关键!)
            example: w.example || w.sentence || w.usage, // 例句
            
            level: level,
            type: 'hsk'
        })).filter(w => w.hanzi); 
        
        allItems = [...allItems, ...taggedWords];
      }
    } catch (e) {
      // ignore missing files
    }
  });
  
  return allItems;
};

// 预加载数据
let localDictionary = [];
try { localDictionary = loadLocalData(); } catch(e) { console.error("Local dict load failed", e); }


// ==========================================
// 2. 汉缅字典组件
// ==========================================
const HanMyanDictionary = () => {
    const [word, setWord] = useState('');
    const [searchDirection, setSearchDirection] = useState('zh2my'); // 默认中->缅
    const [isListening, setIsListening] = useState(false);
    const [localResults, setLocalResults] = useState([]); // 改为数组，可能匹配多个结果

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    // 自动调整高度
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [word]);

    // 自动检测语言方向
    const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(text);
    const containsBurmese = (text) => /[\u1000-\u109F]/.test(text); // 简单的缅文范围检测

    useEffect(() => {
        if (!word || word.trim() === '') {
            setLocalResults([]);
            return;
        }
        // 如果输入汉字 -> 中搜缅；如果输入缅文 -> 缅搜中；否则默认
        if (containsChinese(word)) {
            setSearchDirection('zh2my');
        } else if (containsBurmese(word)) {
            setSearchDirection('my2zh');
        }
    }, [word]);

    // ------------------------------------------------------------
    // 核心搜索功能 (支持双向搜索)
    // ------------------------------------------------------------
    const handleSearch = () => {
        const query = word.trim();
        if (!query) return;

        // 在本地词库中查找
        // 策略：模糊匹配汉字 或 缅文释义
        const matches = localDictionary.filter(item => {
            // 1. 精确匹配汉字
            if (item.hanzi === query) return true;
            // 2. 模糊匹配缅文释义 (如果 query 是缅文)
            if (item.burmese && item.burmese.includes(query)) return true;
            return false;
        });

        if (matches.length > 0) {
            // 命中本地数据
            setLocalResults(matches);
        } else {
            // 未命中：跳转 Glosbe
            setLocalResults([]);
            handleExternalSearch(query);
        }
    };

    const handleExternalSearch = (text) => {
        const direction = containsChinese(text) ? 'zh2my' : 'my2zh';
        const fromCode = direction === 'zh2my' ? 'zh' : 'my';
        const toCode = direction === 'zh2my' ? 'my' : 'zh';
        const glosbeUrl = `https://glosbe.com/${fromCode}/${toCode}/${encodeURIComponent(text)}`;
        window.open(glosbeUrl, '_blank');
    };

    // ------------------------------------------------------------
    // 语音 & 朗读
    // ------------------------------------------------------------
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognitionRef.current = recognition;
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setWord(transcript);
                setTimeout(() => handleSearch(), 500); // 语音输入后自动搜索
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('浏览器不支持语音');
        if (isListening) recognitionRef.current.stop();
        else {
            recognitionRef.current.lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
            recognitionRef.current.start();
        }
    };

    const handleSpeak = (text, lang = 'zh') => {
        const voiceName = lang === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'my-MM-NilarNeural';
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voiceName}&r=0`;
        new Audio(url).play().catch(() => {});
    };

    const handleCopy = (text) => navigator.clipboard.writeText(text);

    return (
        <div className="w-full max-w-lg mx-auto bg-white/95 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xl rounded-3xl p-5 sm:p-6 transition-all duration-300">
            
            {/* 标题栏 */}
            <div className="flex justify-center items-center mb-6">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                    <BookOpen size={16} className="text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">汉缅字典</span>
                </div>
            </div>

            {/* 搜索框 */}
            <div className="relative group">
                 <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
                </div>
                <textarea
                    ref={textareaRef}
                    rows="1"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSearch();
                        }
                    }}
                    // 提示语改为中缅双语
                    placeholder={isListening ? "နားထောင်နေသည်..." : "汉字 / မြန်မာစာ..."}
                    className="w-full pl-12 pr-12 py-4 text-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/80 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 resize-none overflow-hidden shadow-inner text-center font-medium placeholder:text-gray-400"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                    {word && (
                        <button onClick={() => {setWord(''); setLocalResults([]);}} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <X size={18} />
                        </button>
                    )}
                    <button
                        onClick={toggleListening}
                        className={`p-2 rounded-full transition-colors ${
                            isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <Mic size={20} />
                    </button>
                </div>
            </div>

            {/* 搜索结果区域 (本地结果优先) */}
            {localResults.length > 0 && (
                <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {localResults.map((result, idx) => (
                        <div key={idx} className="relative p-5 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border border-cyan-100 dark:border-gray-700 shadow-sm overflow-hidden">
                            {/* 级别标签 */}
                            <div className="absolute top-0 right-0 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-xs font-bold px-3 py-1 rounded-bl-xl">
                                HSK {result.level}
                            </div>

                            <div className="space-y-3">
                                {/* 正面：中文 + 拼音 */}
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                                            {result.hanzi}
                                        </h3>
                                        <button onClick={() => handleSpeak(result.hanzi, 'zh')} className="p-1.5 rounded-full bg-white/50 dark:bg-gray-700 hover:bg-white text-cyan-600 transition-colors">
                                            <Volume2 size={16} />
                                        </button>
                                    </div>
                                    <p className="text-lg text-cyan-600 dark:text-cyan-400 font-serif mt-1">
                                        {result.pinyin}
                                    </p>
                                </div>

                                {/* 分割线 */}
                                <div className="h-px bg-gray-200 dark:bg-gray-700/50 w-full"></div>

                                {/* 背面：缅文含义 (核心) */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Meaning (Burmese)</h4>
                                    <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                                        {/* 优先显示缅文，如果没有则显示英文释义 */}
                                        {result.burmese || result.definition || "暂无翻译"}
                                    </p>
                                </div>

                                {/* 背面：例句 (如果有) */}
                                {result.example && (
                                    <div className="bg-white/60 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Example</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                            {result.example}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* 底部操作栏 */}
                            <div className="flex justify-end gap-3 mt-4 pt-2">
                                <button onClick={() => handleCopy(result.hanzi)} className="text-xs text-gray-400 hover:text-cyan-600 flex items-center gap-1 transition-colors">
                                    <Copy size={12} /> 复制
                                </button>
                                <button onClick={() => handleExternalSearch(result.hanzi)} className="text-xs text-gray-400 hover:text-cyan-600 flex items-center gap-1 transition-colors">
                                    Glosbe 详情 <ExternalLink size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 无结果时的提示 */}
            {word && localResults.length === 0 && (
                <div className="mt-4 text-center">
                    <button 
                        onClick={() => handleExternalSearch(word)}
                        className="text-sm text-gray-500 hover:text-cyan-600 underline underline-offset-4 decoration-dashed transition-colors"
                    >
                        本地未找到，点击跳转网络搜索 &rarr;
                    </button>
                </div>
            )}
        </div>
    );
};

export default HanMyanDictionary;
