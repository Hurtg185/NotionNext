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
import { useAI } from '@/components/AIConfigContext' // 确保路径正确

// Icons
import {
    GraduationCap, Settings, LifeBuoy, Moon, Sun, UserCircle,
    BookOpen, Sparkles, Gem
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

// ... (PriceChartDisplay 组件保持不变) ...
const PriceChartDisplay = () => { /* ... */ };

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
                    <PriceChartDisplay />
                </div>

                <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                    <div className='h-[310px] w-full flex-shrink-0' />
                    
                    <div className='relative bg-white dark:bg-gray-900 rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] pb-10 min-h-screen'>
                        <div className='w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto my-4'></div>

                        <main className="px-4">
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

const LayoutPostList = (props) => { /* ... */ };
const LayoutSearch = (props) => { /* ... */ };
const LayoutArchive = (props) => { /* ... */ };
const LayoutSlug = (props) => { /* ... */ };
const Layout404 = () => { /* ... */ };
const LayoutCategoryIndex = (props) => { /* ... */ };
const LayoutTagIndex = (props) => { /* ... */ };

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
}
