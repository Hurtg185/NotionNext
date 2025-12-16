import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Volume2, Copy, ExternalLink, X, BookOpen } from 'lucide-react';

// ==========================================
// 1. 静态导入数据 (最稳妥的方式，防止打包丢失)
// ==========================================
// 确保这些文件真实存在于您的项目中
import hsk1Data from '@/data/hsk/hsk1.json';
import hsk2Data from '@/data/hsk/hsk2.json';
import hsk3Data from '@/data/hsk/hsk3.json';
import hsk4Data from '@/data/hsk/hsk4.json';
import hsk5Data from '@/data/hsk/hsk5.json';
import hsk6Data from '@/data/hsk/hsk6.json';

const loadLocalData = () => {
  let allItems = [];
  
  // 建立映射表
  const dataMap = {
    1: hsk1Data,
    2: hsk2Data,
    3: hsk3Data,
    4: hsk4Data,
    5: hsk5Data,
    6: hsk6Data
  };

  Object.keys(dataMap).forEach(level => {
    const words = dataMap[level];
    if (Array.isArray(words)) {
      const taggedWords = words.map(w => ({
        // --- 核心修正：适配您的实际数据结构 ---
        hanzi: w.chinese,           // 汉字
        burmese: w.burmese,         // 缅文短义
        explanation: w.explanation, // 缅文解释
        mnemonic: w.mnemonic,       // 缅文注音/助记 (无拼音时显示这个)
        example: w.example,         // 例句 1
        example2: w.example2,       // 例句 2
        level: w.hsk_level || level,
        id: w.id
      })).filter(w => w.hanzi); // 过滤无效数据
      
      allItems = [...allItems, ...taggedWords];
    }
  });
  
  return allItems;
};

// 初始化词库
let localDictionary = [];
try { localDictionary = loadLocalData(); } catch(e) { console.error("数据加载错误:", e); }


// ==========================================
// 2. 汉缅字典组件
// ==========================================
const HanMyanDictionary = () => {
    const [word, setWord] = useState('');
    const [searchDirection, setSearchDirection] = useState('zh2my'); 
    const [isListening, setIsListening] = useState(false);
    const [localResults, setLocalResults] = useState([]);

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    // 自动调整输入框高度
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [word]);

    // 语言方向检测
    const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(text);
    const containsBurmese = (text) => /[\u1000-\u109F]/.test(text);

    useEffect(() => {
        if (!word || word.trim() === '') {
            setLocalResults([]);
            return;
        }
        if (containsChinese(word)) setSearchDirection('zh2my');
        else if (containsBurmese(word)) setSearchDirection('my2zh');
    }, [word]);

    // ------------------------------------------------------------
    // 核心搜索功能
    // ------------------------------------------------------------
    const handleSearch = () => {
        const query = word.trim();
        if (!query) return;

        // 模糊搜索逻辑
        const matches = localDictionary.filter(item => {
            // 1. 匹配汉字 (包含即可，不用完全相等，体验更好)
            if (item.hanzi && item.hanzi.includes(query)) return true;
            
            // 2. 匹配缅文意思 (比如搜 "မ...ဘူး")
            if (item.burmese && item.burmese.includes(query)) return true;
            
            // 3. 匹配缅文解释
            if (item.explanation && item.explanation.includes(query)) return true;

            return false;
        });

        // 结果排序：完全匹配的排前面
        matches.sort((a, b) => {
            if (a.hanzi === query) return -1;
            if (b.hanzi === query) return 1;
            return 0;
        });

        if (matches.length > 0) {
            setLocalResults(matches);
        } else {
            setLocalResults([]);
            handleExternalSearch(query);
        }
    };

    const handleExternalSearch = (text) => {
        const direction = containsChinese(text) ? 'zh2my' : 'my2zh';
        const fromCode = direction === 'zh2my' ? 'zh' : 'my';
        const toCode = direction === 'zh2my' ? 'my' : 'zh';
        // 如果本地没找到，跳转 Glosbe
        window.open(`https://glosbe.com/${fromCode}/${toCode}/${encodeURIComponent(text)}`, '_blank');
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
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setWord(transcript);
                setTimeout(() => handleSearch(), 500);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('不支持语音输入');
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSpeak = (text) => {
        // 使用微软中文语音
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoNeural&r=0`;
        new Audio(url).play().catch(() => {});
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-white/95 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xl rounded-3xl p-5 sm:p-6 transition-all duration-300">
            
            {/* 标题 */}
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
                    placeholder="汉字 / မြန်မာစာ..."
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

            {/* 结果展示区 */}
            {localResults.length > 0 && (
                <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                    {localResults.map((result, idx) => (
                        <div key={idx} className="relative p-5 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border border-cyan-100 dark:border-gray-700 shadow-sm overflow-hidden">
                            {/* 等级标签 */}
                            <div className="absolute top-0 right-0 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-xs font-bold px-3 py-1 rounded-bl-xl">
                                HSK {result.level}
                            </div>

                            <div className="space-y-4">
                                {/* 1. 正面：汉字 + 发音 */}
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                                            {result.hanzi}
                                        </h3>
                                        <button onClick={() => handleSpeak(result.hanzi)} className="p-2 rounded-full bg-white/60 dark:bg-gray-700 hover:bg-white text-cyan-600 shadow-sm transition-colors">
                                            <Volume2 size={18} />
                                        </button>
                                    </div>
                                    {/* 显示 Mnemonic (缅文注音) 作为拼音替代 */}
                                    <p className="text-lg text-cyan-600 dark:text-cyan-400 font-serif mt-1 font-medium">
                                        {result.mnemonic || "---"}
                                    </p>
                                </div>

                                <div className="h-px bg-gray-200 dark:bg-gray-700/50 w-full"></div>

                                {/* 2. 背面：缅文意思 & 解释 */}
                                <div className="space-y-2">
                                    {/* 主要意思 */}
                                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed font-myanmar">
                                        {result.burmese}
                                    </p>
                                    
                                    {/* 详细解释 */}
                                    {result.explanation && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-white/50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700/50">
                                            {result.explanation}
                                        </p>
                                    )}
                                </div>

                                {/* 3. 例句 */}
                                {(result.example || result.example2) && (
                                    <div className="bg-white/60 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Example</h4>
                                        {result.example && <p className="text-sm text-gray-700 dark:text-gray-300">{result.example}</p>}
                                        {result.example2 && <p className="text-sm text-gray-700 dark:text-gray-300 border-t border-dashed border-gray-200 dark:border-gray-700 pt-2">{result.example2}</p>}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end mt-3 pt-2">
                                <button onClick={() => navigator.clipboard.writeText(result.hanzi)} className="text-xs text-gray-400 hover:text-cyan-600 flex items-center gap-1 transition-colors">
                                    <Copy size={12} /> 复制汉字
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 没找到时的提示 */}
            {word && localResults.length === 0 && (
                <div className="mt-6 text-center animate-in fade-in zoom-in duration-300">
                    <p className="text-gray-500 text-sm mb-2">本地词库未收录</p>
                    <button 
                        onClick={() => handleExternalSearch(word)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-all font-medium text-sm"
                    >
                        去 Glosbe 网络字典搜索 <ExternalLink size={14}/>
                    </button>
                </div>
            )}
        </div>
    );
};

export default HanMyanDictionary;
