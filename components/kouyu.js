import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, Mic, Loader2, Volume2, Settings2, X, PlayCircle } from 'lucide-react';

// 引入结构配置
import { speakingCategories } from '@/data/speaking-structure';

// ★★★ 核心修改：显式引入所有数据文件，不要让 Webpack 去猜路径 ★★★
// 假设您的文件在 data/speaking/ 下，请确保文件名对应
import dazhaohu from '@/data/speaking/dazhaohu';
import diancan from '@/data/speaking/diancan';
import chucimian from '@/data/speaking/chucimian';
import jiubiechongfeng from '@/data/speaking/jiubiechongfeng';
import guanxinyuhuiying from '@/data/speaking/guanxinyuhuiying';
import zhaorenshuohua from '@/data/speaking/zhaorenshuohua';
import dianhuayuxinxi from '@/data/speaking/dianhuayuxinxi';
import jieshuyugaobie from '@/data/speaking/jieshuyugaobie';
import yudingzuowei from '@/data/speaking/yudingzuowei';
import jiezhang from '@/data/speaking/jiezhang';
import dache from '@/data/speaking/dache';
import wenlu from '@/data/speaking/wenlu';

// 建立映射表
const ALL_DATA = {
  dazhaohu, diancan, chucimian, jiubiechongfeng, guanxinyuhuiying,
  zhaorenshuohua, dianhuayuxinxi, jieshuyugaobie, yudingzuowei,
  jiezhang, dache, wenlu
};

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
            if (this.currentId !== id) {
                this.stop();
            } else if (this.currentAudio) {
                this.currentAudio.pause();
            }

            const audio = new Audio(url);
            this.currentAudio = audio;
            this.currentId = id;
            audio.preload = 'auto';

            audio.onended = () => { if (this.currentId === id) resolve(); };
            audio.onerror = (e) => reject(e);

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => reject(error));
            }
        });
    }
};

// --- iOS 风格开关 ---
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
        <div className="fixed inset-0 z-[99999] bg-gray-50 dark:bg-[#121212] flex flex-col animate-in slide-in-from-right duration-300">
            {children}
        </div>,
        document.body
    );
};

// --- 短句列表页面 ---
const PhraseListPage = ({ phrases, title, onBack }) => {
    const [chineseRate, setChineseRate] = useState(-30); 
    const [burmeseRate, setBurmeseRate] = useState(-20);
    const [readChinese, setReadChinese] = useState(true);
    const [readBurmese, setReadBurmese] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [playingId, setPlayingId] = useState(null);

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

    const processedData = useMemo(() => {
        if (!phrases || !Array.isArray(phrases)) return [];
        return phrases.map(p => ({
            ...p,
            pinyin: pinyin(p.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' })
        }));
    }, [phrases]);

    const handlePlay = async (item) => {
        if (playingId === item.id) {
            GlobalAudioController.stop();
            setPlayingId(null);
            return;
        }

        setPlayingId(item.id);

        try {
            if (readChinese) {
                const rateVal = chineseRate <= -100 ? -95 : chineseRate;
                const cnUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.chinese)}&v=zh-CN-XiaoyanNeural&r=${rateVal}%`;
                await GlobalAudioController.play(cnUrl, item.id);
            }

            if (GlobalAudioController.currentId !== item.id) return;
            if (readChinese && readBurmese) await new Promise(r => setTimeout(r, 400));
            if (GlobalAudioController.currentId !== item.id) return;

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
            <div className="flex-none bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-50 sticky top-0">
                <div className="px-4 h-14 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <ChevronLeft size={24} className="text-gray-700 dark:text-gray-200"/>
                    </button>
                    <h1 className="font-bold text-lg text-gray-800 dark:text-white truncate max-w-[200px]">{title}</h1>
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 -mr-2 rounded-full transition-colors ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>
                        <Settings2 size={24}/>
                    </button>
                </div>
                
                <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-white dark:bg-[#1e1e1e] border-b dark:border-gray-800 ${showSettings ? 'max-h-96 opacity-100 shadow-lg' : 'max-h-0 opacity-0'}`}>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                            <ToggleSwitch label="朗读中文" checked={readChinese} onChange={setReadChinese} activeColor="bg-blue-600" />
                            <ToggleSwitch label="朗读缅文" checked={readBurmese} onChange={setReadBurmese} activeColor="bg-green-600" />
                        </div>
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

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-gray-50 dark:bg-[#121212]">
                {processedData.map((item) => {
                    const isPlaying = playingId === item.id;
                    return (
                        <div 
                            key={item.id} 
                            onClick={() => handlePlay(item)}
                            className={`
                                relative p-5 rounded-2xl bg-white dark:bg-[#1e1e1e]
                                border transition-all duration-200 cursor-pointer select-none
                                ${isPlaying 
                                    ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/10 dark:shadow-none' 
                                    : 'border-transparent shadow-sm hover:border-gray-200 dark:hover:border-gray-700'
                                }
                            `}
                        >
                            <div className={`absolute top-4 right-4 p-2 rounded-full transition-all ${isPlaying ? 'bg-blue-50 text-blue-600' : 'text-gray-300 dark:text-gray-600'}`}>
                                {isPlaying ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
                            </div>

                            <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 font-mono">
                                {item.pinyin}
                            </div>
                            <h3 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 mb-3 pr-10 leading-snug">
                                {item.chinese}
                            </h3>
                            <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mb-3 leading-loose font-burmese">
                                {item.burmese}
                            </p>
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
    const [activeSub, setActiveSub] = useState(null);
    const [activeCat, setActiveCat] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const handleSubcategoryClick = (category, subcategory) => {
        // 直接从映射表里取，不发请求，不动态导入，绝对稳
        const data = ALL_DATA[subcategory.file];
        
        if (data) {
            setActiveCat(category);
            setActiveSub({ ...subcategory, data });
        } else {
            console.error(`Missing data for file key: ${subcategory.file}`);
            alert(`找不到数据文件: ${subcategory.file}.js`);
        }
    };

    useEffect(() => {
        if (!searchTerm) {
            setSearchResults([]);
            return;
        }
        const allData = Object.values(ALL_DATA).flat();
        const lowerTerm = searchTerm.toLowerCase();
        
        const results = allData.filter(item => 
            (item.chinese && item.chinese.includes(lowerTerm)) || 
            (item.burmese && item.burmese.includes(lowerTerm))
        );
        setSearchResults(results);
    }, [searchTerm]);

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [view, setView] = useState('main');
    const [allPhrasesForSearch, setAllPhrasesForSearch] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleBackToMain = () => {
        setActiveSub(null);
        setSearchTerm('');
        GlobalAudioController.stop();
    };

    return (
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900">
             {!activeSub && !searchTerm && (
                <div className='text-center pt-8 pb-4 px-4'>
                    <h1 className='text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight'>口语练习</h1>
                    <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>地道中文口语 · 缅文谐音助记</p>
                </div>
            )}
            
            {!activeSub && (
                <div className="sticky top-0 z-10 px-4 pb-2 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm pt-2">
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="搜索中文或缅文..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search size={20} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={20}/>
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            <div className="px-4">
                {searchTerm && (
                    <PhraseListPage 
                        phrases={searchResults} 
                        title={`"${searchTerm}" 的结果`} 
                        onBack={() => setSearchTerm('')} 
                    />
                )}

                {!searchTerm && activeSub && (
                    <PhraseListPage 
                        phrases={activeSub.data} 
                        title={activeSub.name} 
                        onBack={handleBackToMain} 
                    />
                )}

                {!searchTerm && !activeSub && (
                    <div className="space-y-6 pb-10">
                        {speakingCategories.map(category => (
                            <div key={category.category} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                                    <span className="text-3xl filter drop-shadow-sm">{category.icon}</span>
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{category.category}</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {category.subcategories.map(subcategory => (
                                        <button 
                                            key={subcategory.name} 
                                            onClick={() => handleSubcategoryClick(category, subcategory)}
                                            className="px-3 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 hover:shadow-md transition-all duration-200 text-center border border-gray-100 dark:border-gray-700 truncate"
                                        >
                                            {subcategory.name}
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
