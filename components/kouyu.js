import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import { 
    ChevronLeft, Search, Mic, Loader2, Volume2, 
    Settings2, X, PlayCircle, StopCircle, BookOpen 
} from 'lucide-react';

// 引入结构配置
import { speakingCategories } from '@/data/speaking-structure';
// 引入刚刚创建的数据索引 (解决打包失败的核心)
import { SPEAKING_DATA_MAP } from '@/data/speaking/index';

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

    play(url, id) {
        return new Promise((resolve, reject) => {
            // 切歌逻辑
            if (this.currentId !== id) {
                this.stop();
            } else if (this.currentAudio) {
                this.currentAudio.pause();
            }

            const audio = new Audio(url);
            this.currentAudio = audio;
            this.currentId = id;
            audio.preload = 'auto';

            audio.onended = () => {
                if (this.currentId === id) resolve();
            };
            audio.onerror = (e) => reject(e);

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => reject(error));
            }
        });
    }
};

// --- 精美开关组件 ---
const ToggleSwitch = ({ label, checked, onChange, activeColor = "bg-blue-500" }) => (
    <div className="flex items-center justify-between py-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
        <button 
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${checked ? activeColor : 'bg-gray-200 dark:bg-gray-600'}`}
        >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-300 ease-spring ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
    </div>
);

// --- 全屏传送门 (防止滚动穿透) ---
const FullScreenPortal = ({ children }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-50 dark:bg-[#121212] flex flex-col animate-in slide-in-from-right duration-300">
            {children}
        </div>,
        document.body
    );
};

// --- 短句列表页面 ---
const PhraseListPage = ({ phrases, title, onBack }) => {
    // 语速状态 (-100% ~ 50%)
    const [chineseRate, setChineseRate] = useState(-30); 
    const [burmeseRate, setBurmeseRate] = useState(-20);
    const [readChinese, setReadChinese] = useState(true);
    const [readBurmese, setReadBurmese] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [playingId, setPlayingId] = useState(null);

    // 手势返回逻辑
    useEffect(() => {
        const pushState = () => window.history.pushState({ panel: 'list' }, '', window.location.pathname + '#list');
        pushState();
        const handlePop = () => onBack();
        window.addEventListener('popstate', handlePop);
        return () => {
            window.removeEventListener('popstate', handlePop);
            GlobalAudioController.stop();
        };
    }, [onBack]);

    // 给数据添加拼音
    const processedData = useMemo(() => {
        if (!phrases) return [];
        return phrases.map(p => ({
            ...p,
            pinyin: pinyin(p.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' })
        }));
    }, [phrases]);

    // 播放核心逻辑
    const handlePlay = async (item) => {
        if (playingId === item.id) {
            GlobalAudioController.stop();
            setPlayingId(null);
            return;
        }

        setPlayingId(item.id);

        try {
            // 1. 中文
            if (readChinese) {
                // Edge TTS 支持 -100%，这里做个保底 -95% 防止无声
                const rateVal = chineseRate <= -100 ? -95 : chineseRate;
                const cnUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.chinese)}&v=zh-CN-XiaoyanNeural&r=${rateVal}%`;
                await GlobalAudioController.play(cnUrl, item.id);
            }

            if (GlobalAudioController.currentId !== item.id) return;

            // 间隔
            if (readChinese && readBurmese) await new Promise(r => setTimeout(r, 400));

            if (GlobalAudioController.currentId !== item.id) return;

            // 2. 缅文
            if (readBurmese) {
                const rateVal = burmeseRate <= -100 ? -95 : burmeseRate;
                const myUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.burmese)}&v=my-MM-ThihaNeural&r=${rateVal}%`;
                await GlobalAudioController.play(myUrl, item.id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (GlobalAudioController.currentId === item.id) {
                setPlayingId(null);
                GlobalAudioController.currentId = null;
            }
        }
    };

    return (
        <FullScreenPortal>
            {/* 顶部导航 */}
            <div className="flex-none bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-50 sticky top-0">
                <div className="px-4 h-14 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <ChevronLeft size={24} className="text-gray-700 dark:text-gray-200"/>
                    </button>
                    <h1 className="font-bold text-lg text-gray-800 dark:text-white">{title}</h1>
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 -mr-2 rounded-full transition-colors ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>
                        <Settings2 size={24}/>
                    </button>
                </div>
                
                {/* 设置面板 */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-white dark:bg-[#1e1e1e] border-b dark:border-gray-800 ${showSettings ? 'max-h-96 opacity-100 shadow-lg' : 'max-h-0 opacity-0'}`}>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                            <ToggleSwitch label="朗读中文" checked={readChinese} onChange={setReadChinese} activeColor="bg-blue-600" />
                            <ToggleSwitch label="朗读缅文" checked={readBurmese} onChange={setReadBurmese} activeColor="bg-green-600" />
                        </div>
                        
                        {/* 语速控制 */}
                        {[
                            { label: '中文语速', val: chineseRate, set: setChineseRate, color: 'accent-blue-600' },
                            { label: '缅文语速', val: burmeseRate, set: setBurmeseRate, color: 'accent-green-600' }
                        ].map((s, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-2 text-xs font-bold text-gray-500 uppercase">
                                    <span>{s.label}</span>
                                    <span>{s.val > 0 ? `+${s.val}` : s.val}%</span>
                                </div>
                                <input 
                                    type="range" min="-100" max="50" step="5"
                                    value={s.val} onChange={e => s.set(Number(e.target.value))}
                                    className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${s.color}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 列表区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-gray-50 dark:bg-[#121212]">
                {processedData.map((item) => {
                    const isPlaying = playingId === item.id;
                    return (
                        <div 
                            key={item.id} 
                            onClick={() => handlePlay(item)}
                            className={`
                                relative p-5 rounded-2xl bg-white dark:bg-[#1e1e1e]
                                border transition-all duration-200 cursor-pointer
                                ${isPlaying 
                                    ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/10 dark:shadow-none' 
                                    : 'border-transparent shadow-sm hover:border-gray-200 dark:hover:border-gray-700'
                                }
                            `}
                        >
                            {/* 播放按钮 */}
                            <div className={`absolute top-4 right-4 p-2 rounded-full transition-all ${isPlaying ? 'bg-blue-50 text-blue-600' : 'text-gray-300 dark:text-gray-600'}`}>
                                {isPlaying ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
                            </div>

                            {/* 拼音 */}
                            <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 font-mono">
                                {item.pinyin}
                            </div>
                            
                            {/* 中文 */}
                            <h3 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 mb-3 pr-10">
                                {item.chinese}
                            </h3>
                            
                            {/* 缅文 */}
                            <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mb-3 leading-loose font-burmese">
                                {item.burmese}
                            </p>
                            
                            {/* 谐音 */}
                            {item.xieyin && (
                                <div className="inline-block px-3 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg">
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-500">
                                        谐音: {item.xieyin}
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </FullScreenPortal>
    );
};

// --- 主页面 ---
export default function KouyuPage() {
    // 视图状态
    const [activeSub, setActiveSub] = useState(null);
    const [activeCat, setActiveCat] = useState(null);
    
    // 搜索状态
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // 处理子分类点击
    const handleSubClick = (cat, sub) => {
        // 直接从 MAP 中获取数据，无需 await import
        const data = SPEAKING_DATA_MAP[sub.file];
        if (data) {
            setActiveCat(cat);
            setActiveSub({ ...sub, data }); // 将数据注入
        } else {
            console.warn(`未找到文件对应的 Key: ${sub.file}, 请检查 index.js`);
            alert("该分类暂无数据");
        }
    };

    // 处理搜索
    useEffect(() => {
        if (!searchTerm) {
            setSearchResults([]);
            return;
        }
        
        // 聚合所有数据进行搜索 (因为现在数据是同步的，非常快)
        const allData = Object.values(SPEAKING_DATA_MAP).flat();
        const lowerTerm = searchTerm.toLowerCase();
        
        const results = allData.filter(item => 
            (item.chinese && item.chinese.includes(lowerTerm)) || 
            (item.burmese && item.burmese.includes(lowerTerm))
        );
        setSearchResults(results);
    }, [searchTerm]);

    // 渲染主内容
    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-[#121212] pb-20">
            {/* 标题区 */}
            {!activeSub && !searchTerm && (
                <div className="pt-8 pb-6 px-6 text-center animate-fade-in-down">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">口语练习</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">日常对话 · 基础交流 · 发音纠正</p>
                </div>
            )}

            {/* 搜索框 */}
            {!activeSub && (
                <div className="sticky top-0 z-10 px-4 pb-4 pt-2 bg-gray-50/90 dark:bg-[#121212]/90 backdrop-blur-md">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-10 py-3.5 border-none rounded-2xl bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all"
                            placeholder="搜索句子..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 内容区 */}
            <div className="px-4 animate-fade-in-up">
                {/* 1. 搜索结果模式 */}
                {searchTerm && (
                    <PhraseListPage 
                        phrases={searchResults} 
                        title={`"${searchTerm}" 的结果`} 
                        onBack={() => setSearchTerm('')} 
                    />
                )}

                {/* 2. 详情页模式 */}
                {!searchTerm && activeSub && (
                    <PhraseListPage 
                        phrases={activeSub.data} 
                        title={activeSub.name} 
                        onBack={() => setActiveSub(null)} 
                    />
                )}

                {/* 3. 分类列表模式 */}
                {!searchTerm && !activeSub && (
                    <div className="space-y-6">
                        {speakingCategories.map((cat, i) => (
                            <div key={i} className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-50 dark:border-gray-800">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-xl">
                                        {cat.icon}
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{cat.category}</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {cat.subcategories.map((sub, j) => (
                                        <button 
                                            key={j}
                                            onClick={() => handleSubClick(cat, sub)}
                                            className="text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all duration-200 border border-transparent hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                                        >
                                            {sub.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
                        }
