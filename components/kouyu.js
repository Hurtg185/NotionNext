import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, Mic, Loader2, PlayCircle, Settings2, X, StopCircle, Volume2 } from 'lucide-react';
import { speakingCategories } from '@/data/speaking-structure';

// --- 全局音频控制器 ---
const GlobalAudioController = {
    currentAudio: null,
    currentId: null,

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            this.currentId = null;
        }
    },

    /**
     * 播放音频
     * @param {string} url - 音频地址
     * @param {number} id - 当前卡片ID
     * @returns {Promise} - 播放完成resolve，失败reject
     */
    play(url, id) {
        return new Promise((resolve, reject) => {
            // 1. 停止之前的
            if (this.currentId !== id) {
                this.stop();
            } else if (this.currentAudio) {
                // 如果是同ID正在播放，强制停止当前的以便重播
                this.currentAudio.pause();
            }

            // 2. 创建新音频
            const audio = new Audio(url);
            this.currentAudio = audio;
            this.currentId = id;
            audio.preload = 'auto';

            // 3. 事件监听
            audio.onended = () => {
                // 只有ID匹配才视为正常结束
                if (this.currentId === id) {
                    resolve();
                }
            };

            audio.onerror = (e) => {
                console.error("Audio Error:", e, url);
                reject(e);
            };

            // 4. 执行播放
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // 用户未交互导致的自动播放失败，或手动切换导致的打断
                    reject(error);
                });
            }
        });
    }
};

// --- 开关组件 (iOS 风格) ---
const ToggleSwitch = ({ label, checked, onChange, colorClass = "bg-blue-500" }) => (
    <div className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <button 
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${checked ? colorClass : 'bg-gray-300 dark:bg-gray-600'}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

// --- 全屏传送门 ---
const FullScreenPortal = ({ children }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-50 dark:bg-gray-900 flex flex-col animate-in slide-in-from-right duration-200">
            {children}
        </div>,
        document.body
    );
};

// --- 短句列表页面组件 ---
const PhraseListPage = ({ phrases, category, subcategory, onBack }) => {
    // 语速设置：使用百分比整数，范围 -95 到 +50
    const [chineseRate, setChineseRate] = useState(-30); 
    const [burmeseRate, setBurmeseRate] = useState(-20);
    
    // 朗读开关
    const [readChinese, setReadChinese] = useState(true);
    const [readBurmese, setReadBurmese] = useState(true);

    const [showSettings, setShowSettings] = useState(false);
    const [playingId, setPlayingId] = useState(null);

    // 手势返回支持
    useEffect(() => {
        const pushState = () => {
            window.history.pushState({ panel: 'phrase-list' }, '', window.location.pathname + '#list');
        };
        pushState();
        const handlePopState = () => onBack();
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            GlobalAudioController.stop();
        };
    }, [onBack]);

    // 数据处理：添加拼音
    const processedPhrases = useMemo(() => phrases.map(phrase => ({
        ...phrase,
        pinyin: pinyin(phrase.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' }),
    })), [phrases]);

    // 核心播放逻辑
    const handleCardClick = async (phrase) => {
        // 点击正在播放的卡片 -> 停止
        if (playingId === phrase.id) {
            GlobalAudioController.stop();
            setPlayingId(null);
            return;
        }

        setPlayingId(phrase.id);

        try {
            // 1. 播放中文
            if (readChinese) {
                // 构建 URL：使用 Edge TTS 标准的百分比格式 (e.g., -30%)
                const cnUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(phrase.chinese)}&v=zh-CN-XiaoyanNeural&r=${chineseRate}%`;
                await GlobalAudioController.play(cnUrl, phrase.id);
            }

            // 检查是否被中断
            if (GlobalAudioController.currentId !== phrase.id) return;

            // 2. 间隔延时 (让声音不那么紧凑)
            if (readChinese && readBurmese) {
                await new Promise(r => setTimeout(r, 400));
            }

            // 检查是否被中断
            if (GlobalAudioController.currentId !== phrase.id) return;

            // 3. 播放缅文
            if (readBurmese) {
                const myUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(phrase.burmese)}&v=my-MM-ThihaNeural&r=${burmeseRate}%`;
                await GlobalAudioController.play(myUrl, phrase.id);
            }

        } catch (e) {
            console.log("Play sequence interrupted or failed", e);
        } finally {
            // 只有当 ID 依然匹配时才重置状态
            if (GlobalAudioController.currentId === phrase.id) {
                setPlayingId(null);
                GlobalAudioController.currentId = null; // 清除引用
            }
        }
    };

    return (
        <FullScreenPortal>
            <style jsx global>{`
                .thin-scrollbar::-webkit-scrollbar { width: 3px; }
                .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .thin-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 10px; }
            `}</style>

            {/* 顶部导航 */}
            <div className="flex-none bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm safe-area-top sticky top-0">
                <div className="px-4 h-14 flex items-center justify-between">
                    <button 
                        onClick={() => window.history.back()} 
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all text-gray-700 dark:text-gray-200"
                    >
                        <ChevronLeft size={26} />
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <h1 className="font-bold text-base text-gray-800 dark:text-white truncate max-w-[200px]">{subcategory.name}</h1>
                    </div>

                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className={`p-2 -mr-2 rounded-full transition-all duration-300 ${showSettings ? 'bg-blue-100 text-blue-600 rotate-180' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                    >
                        <Settings2 size={24} />
                    </button>
                </div>

                {/* 设置面板 (美化版) */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700 ${showSettings ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-5 space-y-5">
                        {/* 开关区域 */}
                        <div className="grid grid-cols-2 gap-8 border-b border-gray-200 dark:border-gray-700 pb-4">
                            <ToggleSwitch label="朗读中文" checked={readChinese} onChange={setReadChinese} colorClass="bg-blue-500" />
                            <ToggleSwitch label="朗读缅文" checked={readBurmese} onChange={setReadBurmese} colorClass="bg-emerald-500" />
                        </div>

                        {/* 语速滑块区域 */}
                        <div className="space-y-4">
                            {/* 中文语速 */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">中文语速</span>
                                    <span className="text-xs font-mono text-blue-600 font-bold">{chineseRate > 0 ? `+${chineseRate}` : chineseRate}%</span>
                                </div>
                                <input 
                                    type="range" min="-95" max="50" step="5" 
                                    value={chineseRate} 
                                    onChange={e => setChineseRate(Number(e.target.value))} 
                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600" 
                                />
                                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                    <span>极慢</span>
                                    <span>正常</span>
                                    <span>快</span>
                                </div>
                            </div>

                            {/* 缅文语速 */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">缅文语速</span>
                                    <span className="text-xs font-mono text-emerald-600 font-bold">{burmeseRate > 0 ? `+${burmeseRate}` : burmeseRate}%</span>
                                </div>
                                <input 
                                    type="range" min="-95" max="50" step="5" 
                                    value={burmeseRate} 
                                    onChange={e => setBurmeseRate(Number(e.target.value))} 
                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-600" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 列表内容区 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-gray-50 dark:bg-gray-900 thin-scrollbar scroll-smooth">
                {processedPhrases.map((phrase) => {
                    const isPlaying = playingId === phrase.id;
                    return (
                        <div 
                            key={phrase.id} 
                            onClick={() => handleCardClick(phrase)}
                            className={`
                                group relative bg-white dark:bg-gray-800 rounded-2xl p-6 
                                shadow-sm transition-all duration-300 cursor-pointer border
                                flex flex-col items-center text-center select-none overflow-hidden
                                ${isPlaying 
                                    ? 'border-blue-400 dark:border-blue-500 shadow-xl ring-2 ring-blue-500/10 scale-[1.02]' 
                                    : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md active:scale-[0.98]'
                                }
                            `}
                        >
                            {/* 播放状态指示器 */}
                            <div className={`absolute top-3 right-3 p-1.5 rounded-full transition-all duration-300 ${isPlaying ? 'bg-blue-50 text-blue-500' : 'bg-transparent text-gray-300 dark:text-gray-600 group-hover:text-blue-400'}`}>
                                {isPlaying ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
                            </div>

                            {/* 拼音 */}
                            <div className="text-xs font-medium text-gray-400 dark:text-gray-500 font-mono mb-2 tracking-wide uppercase">
                                {phrase.pinyin}
                            </div>
                            
                            {/* 中文 */}
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 leading-snug">
                                {phrase.chinese}
                            </h3>
                            
                            {/* 分割线 */}
                            <div className="w-8 h-1 bg-gray-100 dark:bg-gray-700 rounded-full mb-3"></div>

                            {/* 缅文 */}
                            <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mb-4 leading-relaxed font-burmese">
                                {phrase.burmese}
                            </p>
                            
                            {/* 谐音 */}
                            {phrase.xieyin && (
                                <div className="inline-flex items-center px-3 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700/50 rounded-lg">
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-500">
                                        谐音: {phrase.xieyin}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </FullScreenPortal>
    );
};

// --- 主页/分类视图 ---
const MainView = ({ onSubcategoryClick }) => {
    return (
        <div className="space-y-6 pb-20 animate-fade-in-up">
            {speakingCategories.map((category, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-4 mb-5 pb-3 border-b border-gray-50 dark:border-gray-700">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-2xl shadow-inner">
                            {category.icon}
                        </div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{category.category}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {category.subcategories.map(subcategory => (
                            <button 
                                key={subcategory.name} 
                                onClick={() => onSubcategoryClick(category, subcategory)}
                                className="relative overflow-hidden group px-4 py-3.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 rounded-2xl hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all duration-300 text-left border border-transparent hover:shadow-lg hover:-translate-y-0.5"
                            >
                                <span className="relative z-10">{subcategory.name}</span>
                                {/* 装饰性背景 */}
                                <div className="absolute right-[-10px] bottom-[-10px] opacity-0 group-hover:opacity-10 transition-opacity transform rotate-12">
                                    <Mic size={40} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 根组件 KouyuPage ---
export default function KouyuPage() {
    const [view, setView] = useState('main'); 
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [phrases, setPhrases] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // 搜索
    const [searchTerm, setSearchTerm] = useState('');
    const [allPhrasesForSearch, setAllPhrasesForSearch] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSubcategoryClick = async (category, subcategory) => {
        setIsLoading(true);
        setSelectedCategory(category);
        setSelectedSubcategory(subcategory);
        
        try {
            // 动态导入数据
            const module = await import(`@/data/speaking/${subcategory.file}.js`);
            setPhrases(module.default);
            setView('phrases'); 
        } catch (e) {
            console.error("加载失败:", e);
            alert("加载数据失败，请检查网络或联系管理员");
            setPhrases([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToMain = () => {
        setView('main');
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setPhrases([]);
        GlobalAudioController.stop();
    };

    // 搜索预加载
    useEffect(() => {
        const loadSearchData = async () => {
            if (searchTerm && allPhrasesForSearch.length === 0) {
                setIsSearching(true);
                try {
                    const allPromises = speakingCategories.flatMap(cat => 
                        cat.subcategories.map(sub => 
                            import(`@/data/speaking/${sub.file}.js`).then(m => m.default).catch(() => [])
                        )
                    );
                    const results = (await Promise.all(allPromises)).flat();
                    setAllPhrasesForSearch(results);
                } catch(e) { console.error(e); }
                setIsSearching(false);
            }
        };
        if(searchTerm) loadSearchData();
    }, [searchTerm, allPhrasesForSearch]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return allPhrasesForSearch.filter(p => 
            p.chinese.includes(term) || p.burmese.includes(term)
        );
    }, [searchTerm, allPhrasesForSearch]);

    // 渲染内容路由
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-md">
                    <Loader2 className="animate-spin text-blue-500 mb-2" size={40} />
                    <span className="text-sm font-medium text-gray-500">正在加载数据...</span>
                </div>
            );
        }

        if (searchTerm) {
            return isSearching 
                ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                : <PhraseListPage 
                    phrases={searchResults} 
                    category={{category: '全站搜索'}} 
                    subcategory={{name: `"${searchTerm}"`}} 
                    onBack={() => setSearchTerm('')} 
                  />;
        }
        
        if (view === 'phrases') {
            return <PhraseListPage phrases={phrases} category={selectedCategory} subcategory={selectedSubcategory} onBack={handleBackToMain} />;
        }

        return <MainView onSubcategoryClick={handleSubcategoryClick} />;
    };

    return (
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900">
             {view === 'main' && !searchTerm && (
                <div className='text-center pt-8 pb-6 px-4 animate-fade-in'>
                    <h1 className='text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight'>口语练习</h1>
                    <p className='mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium'>地道中文口语 · 缅文谐音助记</p>
                </div>
            )}
            
            {view === 'main' && (
                <div className="sticky top-0 z-10 px-4 pb-4 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-md pt-2 transition-all">
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="搜索中文或缅文..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-transparent group-hover:border-blue-200 dark:group-hover:border-blue-900 focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all text-base"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search size={20} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={14}/>
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            <div className={view === 'main' ? 'px-4' : ''}>
                {renderContent()}
            </div>
        </div>
    );
                                        }
