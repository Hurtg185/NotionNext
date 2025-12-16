import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Volume2, Copy, ExternalLink, X } from 'lucide-react';

// ==========================================
// 1. 数据加载逻辑 (本地 HSK 数据聚合)
// ==========================================
const loadLocalData = () => {
  let allItems = [];
  const hskLevels = [1, 2, 3, 4, 5, 6];
  
  hskLevels.forEach(level => {
    try {
      // 尝试加载 data/hsk/hsk{n}.json
      // 确保你的项目根目录下有 data/hsk 文件夹
      const words = require(`@/data/hsk/hsk${level}.json`); 
      
      if (Array.isArray(words)) {
        // 数据清洗：统一字段名 (兼容 hanzi/chinese/word 等不同命名)
        const taggedWords = words.map(w => ({ 
            hanzi: w.hanzi || w.chinese || w.word, 
            pinyin: w.pinyin,
            definition: w.definition || w.meaning || w.translation,
            level: level,
            type: 'hsk'
        })).filter(w => w.hanzi); // 过滤掉无效数据
        
        allItems = [...allItems, ...taggedWords];
      }
    } catch (e) {
      // 如果文件不存在，忽略错误，继续加载下一个
      // console.warn(`HSK ${level} 数据未找到`);
    }
  });
  
  return allItems;
};

// 在组件外部预加载数据，避免重复计算
let localDictionary = [];
try { localDictionary = loadLocalData(); } catch(e) { console.error("本地词库加载失败", e); }


// ==========================================
// 2. 搜索组件主体
// ==========================================
const GlosbeSearchCard = () => {
    // 状态管理
    const [word, setWord] = useState('');
    const [searchDirection, setSearchDirection] = useState('my2zh'); // my2zh: 缅->中, zh2my: 中->缅
    const [isListening, setIsListening] = useState(false);
    const [localResult, setLocalResult] = useState(null); // 用于存储本地搜索命中的结果

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    // 自动调整输入框高度
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [word]);

    // 自动检测输入语言方向 (有汉字则视为 中->缅)
    const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(text);
    
    useEffect(() => {
        if (!word || word.trim() === '') {
            setLocalResult(null); // 清空结果
            return;
        }
        const targetDirection = containsChinese(word) ? 'zh2my' : 'my2zh';
        if (targetDirection !== searchDirection) {
            setSearchDirection(targetDirection);
        }
    }, [word]);

    // ------------------------------------------------------------
    // 核心搜索功能
    // ------------------------------------------------------------
    const handleSearch = () => {
        const query = word.trim();
        if (!query) return;

        // 1. 本地搜索优先 (精确匹配汉字)
        // 你也可以加上 .toLowerCase() 来匹配拼音，这里暂只匹配汉字以确保准确性
        const match = localDictionary.find(item => item.hanzi === query);

        if (match) {
            // 命中本地数据：显示卡片
            setLocalResult(match);
        } else {
            // 未命中：跳转 Glosbe
            setLocalResult(null);
            handleExternalSearch(query);
        }
    };

    // 跳转到 Glosbe
    const handleExternalSearch = (text) => {
        const direction = containsChinese(text) ? 'zh2my' : 'my2zh';
        // zh2my -> 查中文 (glosbe.com/zh/my)
        // my2zh -> 查缅文 (glosbe.com/my/zh)
        const fromCode = direction === 'zh2my' ? 'zh' : 'my';
        const toCode = direction === 'zh2my' ? 'my' : 'zh';
        
        const glosbeUrl = `https://glosbe.com/${fromCode}/${toCode}/${encodeURIComponent(text)}`;
        window.open(glosbeUrl, '_blank');
    };

    // ------------------------------------------------------------
    // 辅助功能：语音 & 朗读 & 复制
    // ------------------------------------------------------------
    
    // 浏览器原生语音识别
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognitionRef.current = recognition;
            
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setWord(transcript);
                // 语音输入后，延迟自动搜索
                setTimeout(() => {
                    const match = localDictionary.find(i => i.hanzi === transcript);
                    if (match) setLocalResult(match);
                    else handleExternalSearch(transcript);
                }, 800);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('您的浏览器不支持语音识别功能。');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            // 根据当前方向设置语言
            recognitionRef.current.lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
            recognitionRef.current.start();
        }
    };

    // 简单的 TTS 朗读
    const handleSpeak = (text) => {
        const isChinese = containsChinese(text);
        // 使用微软优质语音源
        const voiceName = isChinese ? 'zh-CN-XiaoxiaoNeural' : 'my-MM-NilarNeural';
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voiceName}&r=0`;
        new Audio(url).play().catch(e => alert("朗读失败，请检查网络"));
    };

    const handleCopy = (text) => navigator.clipboard.writeText(text);

    const handleSwapLanguages = () => {
        setSearchDirection(prev => prev === 'my2zh' ? 'zh2my' : 'my2zh');
        setLocalResult(null); // 切换语言时清空结果
    };

    const fromLangText = searchDirection === 'my2zh' ? '缅甸语' : '中文';
    const toLangText = searchDirection === 'my2zh' ? '中文' : '缅甸语';

    return (
        <div className="w-full max-w-lg mx-auto bg-white/90 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-lg rounded-2xl p-4 sm:p-6 transition-all duration-300">
            
            {/* 顶部栏 */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">词典搜索</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 font-medium">
                        本地优先
                    </span>
                </div>
            </div>

            {/* 输入框区域 */}
            <div className="relative">
                 <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
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
                    placeholder={isListening ? "正在聆听..." : "输入单词查找..."}
                    className="w-full pl-12 pr-12 py-3 text-base text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 resize-none overflow-hidden shadow-inner"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                    {word && (
                        <button 
                            onClick={() => {setWord(''); setLocalResult(null);}} 
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <button
                        onClick={toggleListening}
                        className={`p-2 rounded-full transition-colors ${
                            isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        title="语音输入"
                    >
                        <Mic size={20} />
                    </button>
                </div>
            </div>

            {/* 操作栏 */}
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    <span>{fromLangText}</span>
                    <button 
                        onClick={handleSwapLanguages} 
                        className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeftRight size={16} />
                    </button>
                    <span>{toLangText}</span>
                </div>
                <button
                    onClick={handleSearch}
                    disabled={!word.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    搜索
                </button>
            </div>
            
            {/* --- 本地结果展示区域 --- */}
            {localResult && (
                 <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900/30 shadow-sm relative overflow-hidden group">
                        {/* 背景装饰 */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-50 dark:bg-cyan-900/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 pointer-events-none"></div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide">
                                    {localResult.hanzi}
                                </h3>
                                <span className="px-2.5 py-1 rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 text-xs font-bold shadow-sm">
                                    HSK {localResult.level}
                                </span>
                            </div>
                            
                            <p className="text-lg text-cyan-600 dark:text-cyan-400 font-serif mb-3">
                                {localResult.pinyin}
                            </p>
                            
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 text-sm leading-relaxed border border-gray-100 dark:border-gray-700">
                                <span className="font-bold text-gray-400 mr-2">释义:</span>
                                {localResult.definition}
                            </div>

                            {/* 底部按钮栏 */}
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <button onClick={() => handleSpeak(localResult.hanzi)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors" title="朗读">
                                    <Volume2 size={18} />
                                </button>
                                <button onClick={() => handleCopy(localResult.hanzi)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors" title="复制">
                                    <Copy size={18} />
                                </button>
                                <div className="flex-grow"></div>
                                <button 
                                    onClick={() => handleExternalSearch(localResult.hanzi)}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-500 transition-colors"
                                >
                                    去 Glosbe 查看更多 <ExternalLink size={12}/>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlosbeSearchCard;
