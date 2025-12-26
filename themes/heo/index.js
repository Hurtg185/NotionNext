// React & Next.js
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

// UI & Animation
import { loadWowJS } from '@/lib/plugins/wow'

// Global State & Config
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'
import { useAI } from '@/components/AIConfigContext' 

// Icons
import {
    GraduationCap, Settings, LifeBuoy, Moon, Sun, UserCircle,
    BookOpen, Sparkles, Gem, Mic, Send, Volume2, Copy, X, Star, Loader2, Languages
} from 'lucide-react'
import { HashTag } from '@/components/HeroIcons'

// Base Components
import Comment from '@/components/Comment'
import LazyImage from '@/components/LazyImage'
import NotionPage from '@/components/NotionPage'
import SmartLink from '@/components/SmartLink'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import ShareBar from '@/components/ShareBar'

// Theme Components
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
import FloatTocButton from './components/FloatTocButton'
import Header from './components/Header'
import PostAdjacent from './components/PostAdjacent'
import PostCopyright from './components/PostCopyright'
import PostHeader from './components/PostHeader'
import { PostLock } from './components/PostLock'
import PostRecommend from './components/PostRecommend'
import SearchNav from './components/SearchNav'
import { Style } from './style'

// Custom Components
import HskContentBlock from '@/components/HskContentBlock'

const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })
const isBrowser = typeof window !== 'undefined';

// =================================================================================
// ======================  辅助组件 & 工具函数  ========================
// =================================================================================

const CustomScrollbarStyle = () => (
    <style jsx global>{`
        /* ... 样式保持不变 ... */
        .custom-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
        .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        #theme-heo footer, #theme-heo .footer-wrapper, #theme-heo #footer, 
        #theme-heo .subscribe-box, #theme-heo #subscribe-wrapper, 
        #theme-heo .busuanzi_container_site_pv, #theme-heo .busuanzi_container_site_uv {
            display: none !important;
        }
        body { background-color: #0f172a; }
        
        /* 翻译器动画 */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    `}</style>
);

// =================================================================================
// ======================  核心组件: 智能侧边栏 (HomeSidebar)  =====================
// =================================================================================

const HomeSidebar = ({ isOpen, onClose, sidebarX }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal();
  
  // 从全局 Context 获取所有需要的状态和函数
  const {
    user,
    isGoogleLoaded,
    handleGoogleCallback,
    handleActivate,
    logout
  } = useAI();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 谷歌登录按钮渲染逻辑
  useEffect(() => {
    if (window.google && !user && isOpen && isGoogleLoaded) {
      try {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: async (response) => {
              const result = await handleGoogleCallback(response);
              if (!result.success) setMsg(result.error);
          },
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-btn-container'),
          { theme: isDarkMode ? 'filled_black' : 'outline', size: 'large', width: '240', shape: 'pill' }
        );
      } catch(e) {
        console.error("Google button render error:", e)
      }
    }
  }, [user, isOpen, isDarkMode, isGoogleLoaded, handleGoogleCallback]);

  // 激活函数现在也调用 Context 的版本
  const onActivateClick = async () => {
    setLoading(true);
    setMsg('');
    const result = await handleActivate(code);
    setLoading(false);
    if (result.success) {
      setMsg(`✅ ${result.message}`);
      setCode('');
    } else {
      setMsg(`❌ ${result.error}`);
    }
  };

  return (
    <>
      <div className={`absolute inset-0 bg-black z-30 transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`absolute inset-y-0 left-0 w-64 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-2xl z-40 transform transition-transform duration-300 overflow-y-auto custom-scrollbar`} style={{ transform: `translateX(${sidebarX}px)` }}>
        <div className="flex flex-col min-h-full">
            <div className="p-6 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-black/20">
                {!user ? (
                    <div className="flex flex-col items-center gap-4">
                         <div className="flex items-center gap-3 w-full mb-2">
                            <UserCircle size={40} className="text-gray-400" />
                            <div>
                                <p className="font-semibold text-base text-gray-800 dark:text-gray-100">访客</p>
                                <p className="text-[10px] text-gray-500">请登录以同步进度</p>
                            </div>
                        </div>
                        <div id="google-btn-container" className="scale-90 flex justify-center min-h-[40px]"></div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="avatar" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                            ) : (
                                <UserCircle size={40} className="text-blue-500" />
                            )}
                            <div className="overflow-hidden">
                                <p className="font-bold text-gray-800 dark:text-white truncate text-sm">{user.name}</p>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">已解锁: {user.unlocked_levels || '无'}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">激活码验证</label>
                            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="格式: H1-JHM-XXXX" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs mb-2 outline-none uppercase" />
                            <button onClick={onActivateClick} disabled={loading || !code} className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium">{loading ? '验证中...' : '立即激活'}</button>
                            {msg && <p className={`text-[10px] mt-1 font-medium text-center ${msg.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
                        </div>
                    </div>
                )}
            </div>
            <nav className="flex-grow p-4 space-y-1">
                <SmartLink href='/help' className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 text-sm">
                    <LifeBuoy size={18} /> <span>帮助中心</span>
                </SmartLink>
                <SmartLink href='/settings' className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 text-sm">
                    <Settings size={18} /> <span>设置</span>
                </SmartLink>
            </nav>
            <div className="p-4 border-t dark:border-gray-700 space-y-1">
                <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 text-sm">
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>{isDarkMode ? '日间模式' : '夜间模式'}</span>
                </button>
                {user && (
                    <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-sm">
                        <i className="fas fa-sign-out-alt"></i> <span>退出登录</span>
                    </button>
                )}
            </div>
        </div>
      </div>
    </>
  );
};

// =================================================================================
// ======================  组件: AI 翻译器 (AITranslator)  =========================
// =================================================================================

const AITranslator = () => {
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [targetLang, setTargetLang] = useState('my'); // 默认缅甸语
    const [recognitionLang, setRecognitionLang] = useState('zh');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const recognitionRef = useRef(null);
    const [customApiUrl, setCustomApiUrl] = useState(''); // 支持设置自定义API
    const [customApiKey, setCustomApiKey] = useState('');

    // 初始化语音识别
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SR) {
                const recognition = new SR();
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.onresult = (e) => {
                    const text = Array.from(e.results)
                        .map(result => result[0].transcript)
                        .join('');
                    setInput(text);
                };
                recognition.onend = () => setIsListening(false);
                recognition.onerror = () => setIsListening(false);
                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('当前浏览器不支持语音识别');
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.lang = recognitionLang === 'zh' ? 'zh-CN' : (recognitionLang === 'my' ? 'my-MM' : 'en-US');
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setResults([]);
        
        try {
            // 调用我们写好的 Next.js API
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: input,
                    targetLang,
                    // 如果需要在前端透传自定义API设置，可以在这里扩展，目前使用后端硬编码
                })
            });
            const data = await res.json();
            if (data.results) {
                setResults(data.results);
            } else if (data.error) {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('翻译请求失败');
        } finally {
            setLoading(false);
        }
    };

    // 微软 TTS
    const speak = (text, lang) => {
        const voice = lang === 'my' ? 'my-MM-NilarNeural' : (lang === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-JennyNeural');
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-10`;
        new Audio(url).play().catch(e => console.error("TTS play error", e));
    };

    return (
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden mb-6 transition-all duration-300">
            {/* 顶部栏 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex justify-between items-center border-b dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                    <Sparkles size={16} className="text-blue-500" />
                    <span>AI 深度翻译</span>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={targetLang} 
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="bg-white dark:bg-gray-800 border-none text-xs rounded-lg py-1 px-2 focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                    >
                        <option value="my">🇲🇲 译成缅文</option>
                        <option value="zh">🇨🇳 译成中文</option>
                        <option value="en">🇺🇸 译成英文</option>
                    </select>
                    <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {/* 设置面板 */}
            {showSettings && (
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span>语音识别语言</span>
                            <div className="flex gap-2">
                                <button onClick={() => setRecognitionLang('zh')} className={`px-2 py-1 rounded ${recognitionLang === 'zh' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200'}`}>中文</button>
                                <button onClick={() => setRecognitionLang('my')} className={`px-2 py-1 rounded ${recognitionLang === 'my' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200'}`}>缅文</button>
                            </div>
                        </div>
                        <div className="mt-1 pt-2 border-t dark:border-gray-700">
                            <label className="block mb-1 font-bold">自定义 API (可选)</label>
                            <input 
                                type="text" 
                                placeholder="默认为阿里心流 DeepSeek-v3.2" 
                                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 mb-1"
                                disabled
                            />
                            <p className="text-[10px] text-gray-400">目前使用后端统一配置以保护密钥安全。</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 输入区 */}
            <div className="p-4">
                <div className="relative">
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="输入内容或点击话筒说话..."
                        className="w-full min-h-[80px] bg-gray-50 dark:bg-black/20 border-0 rounded-xl p-3 pr-10 resize-none focus:ring-2 focus:ring-blue-500/50 text-sm text-gray-800 dark:text-gray-200"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        {input && (
                            <button 
                                onClick={() => setInput('')}
                                className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                        <button 
                            onClick={toggleListening}
                            className={`p-2 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 text-white shadow-red-500/50 shadow-lg scale-110 animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}
                        >
                            <Mic size={18} />
                        </button>
                        <button 
                            onClick={handleSend}
                            disabled={!input || loading}
                            className={`p-2 rounded-full transition-all duration-300 ${input ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-300'}`}
                        >
                           {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 结果展示区 */}
            {results.length > 0 && (
                <div className="bg-gray-50/50 dark:bg-black/10 border-t dark:border-gray-700 p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {results.map((item, idx) => (
                        <div key={idx} className={`relative p-3 rounded-xl border ${item.recommended ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'} animate-fade-in`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.recommended ? 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                    {item.label}
                                </span>
                                {item.recommended && <span className="flex items-center text-[10px] text-orange-500 font-bold gap-1"><Star size={10} fill="currentColor" /> 推荐</span>}
                            </div>
                            
                            <p className="text-base text-gray-800 dark:text-gray-100 font-medium leading-relaxed my-1 select-all">
                                {item.translation}
                            </p>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                <p className="text-[10px] text-gray-400 italic">
                                    ↩ {item.back_translation}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => speak(item.translation, targetLang)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                        <Volume2 size={14} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(item.translation);
                                            // 这里可以加一个简单的 Toast 提示，简单起见略过
                                        }} 
                                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ... (PriceChartDisplay 组件保持不变) ...
const PriceChartDisplay = () => { return null; }; // 假设这是你原来的组件逻辑

// =================================================================================
// ======================  新主页布局 (手机端强制) ========================
// =================================================================================

const LayoutIndex = props => {
  const router = useRouter();
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const scrollableContainerRef = useRef(null);
  
  const sidebarWidth = 256;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarX, setSidebarX] = useState(-sidebarWidth);

  const [wordCardData, setWordCardData] = useState(null);
  const isWordFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-words' : false;

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1543165796-5426273eaec3?q=80&w=2070',
        'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=2072'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);
  }, []);

  const handleCloseFavorites = useCallback(() => {
    router.push(router.pathname, undefined, { shallow: true });
  }, [router]);

  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-[#0f172a] flex justify-center overflow-hidden`}>
        <Style/><CustomScrollbarStyle />
        
        <div className="relative w-full max-w-md h-full bg-black shadow-2xl overflow-hidden">
            
            <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} />
            
            <div className='relative w-full h-full'>
                <div className='absolute inset-0 z-0 bg-gray-900 bg-cover bg-center transition-opacity duration-1000' style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none' }} />
                <div className='absolute inset-0 bg-black/50 backdrop-blur-[1px]'></div>

                <button onClick={openSidebar} className="absolute top-5 left-5 z-50 p-2 text-white bg-black/30 rounded-full backdrop-blur-md border border-white/10">
                    <i className="fas fa-bars text-lg"></i>
                </button>
                
                <div className='absolute top-0 left-0 right-0 z-10 pt-16 px-4 flex flex-col items-center text-center text-white pointer-events-none'>
                    <h1 className='text-2xl font-black tracking-tight mb-2 drop-shadow-lg'>中缅文培训中心</h1>
                    <div className='mb-4'>
                        <p className='text-xs font-bold opacity-90 mb-1'>专业中缅双语教学，文化与机遇的桥梁。</p>
                        <p className='text-[8px] font-bold text-blue-300 tracking-wider'>မြန်မာ-တရုတ် နှစ်ဘာသာစကား သင်ကြားရေး။</p>
                    </div>
                    {/* 这里如果是你原来的价格表组件，可以放回 */}
                    <PriceChartDisplay />
                </div>

                <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                    {/* 调整顶部留白，为翻译器腾出空间 */}
                    <div className='h-[280px] w-full flex-shrink-0' />
                    
                    <div className='relative bg-white dark:bg-gray-900 rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] pb-10 min-h-screen'>
                        <div className='w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto my-4'></div>

                        <main className="px-4">
                            {/* ============ 插入 AI 翻译器 ============ */}
                            <div className="mb-6 -mt-2">
                                <AITranslator />
                            </div>
                            {/* ======================================= */}

                            <div className='mb-4 flex items-center justify-between'>
                                <div>
                                    <h2 className='text-lg font-black text-gray-800 dark:text-gray-100 flex items-center gap-2'>
                                        <GraduationCap size={20} className='text-blue-600' /> HSK 标准课程
                                    </h2>
                                    <p className='text-[10px] text-gray-400 mt-1 font-medium'>从零基础到精通，系统化学习汉语。</p>
                                </div>
                                <button onClick={() => router.push('/spoken')} className='p-2 bg-blue-50 text-blue-600 rounded-xl active:scale-95 transition-all'>
                                    <BookOpen size={20} />
                                </button>
                            </div>
                            <HskContentBlock />
                        </main>
                    </div>
                </div>
            </div>
            {wordCardData && <WordCard words={wordCardData} isOpen={isWordFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-words" />}
        </div>
    </div>
  );
};


// =================================================================================
// ====================== 其他页面布局 (保持不变) ========================
// =================================================================================

const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { isDarkMode } = useGlobal()
  const router = useRouter()
  if (router.route === '/') return <LayoutIndex {...props} />

  const headerSlot = <div className="max-w-md mx-auto w-full"><PostHeader {...props} isDarkMode={isDarkMode} /></div>
  
  useEffect(() => { loadWowJS() }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#0f172a] min-h-screen flex justify-center`}>
      <Style /> <CustomScrollbarStyle />
      <div className="w-full max-w-md bg-[#f7f9fe] dark:bg-[#18171d] shadow-2xl flex flex-col min-h-screen relative overflow-hidden">
          {headerSlot}
          <main className={`flex-grow w-full relative px-4 pb-10`}>
            <div className='w-full mx-auto relative z-10'>
              <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
            </div>
          </main>
      </div>
    </div>
  )
}

const LayoutPostList = (props) => { return <LayoutBase {...props}><div>PostList Placeholder</div></LayoutBase> };
const LayoutSearch = (props) => { return <LayoutBase {...props}><div>Search Placeholder</div></LayoutBase> };
const LayoutArchive = (props) => { return <LayoutBase {...props}><div>Archive Placeholder</div></LayoutBase> };
const LayoutSlug = (props) => { return <LayoutBase {...props}><div>Slug Placeholder</div></LayoutBase> };
const Layout404 = (props) => { return <LayoutBase {...props}><div>404 Not Found</div></LayoutBase> };
const LayoutCategoryIndex = (props) => { return <LayoutBase {...props}><div>Category Placeholder</div></LayoutBase> };
const LayoutTagIndex = (props) => { return <LayoutBase {...props}><div>Tag Placeholder</div></LayoutBase> };

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
}
