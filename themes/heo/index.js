/**
 *   HEO 主题说明
 *  > 主题设计者 [张洪](https://zhheo.com/)
 *  > 主题开发者 [tangly1024](https://github.com/tangly1024)
 *  > 此文件已根据用户需求进行深度定制修改，整合了新的主页布局及 Cloudflare D1 权限系统。
 */

// React & Next.js
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'

// UI & Animation
import { Transition, Dialog } from '@headlessui/react'
import { loadWowJS } from '@/lib/plugins/wow'

// Global State & Config
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'

// Icons
import { FaTiktok, FaFacebook, FaTelegramPlane } from 'react-icons/fa'
import {
    GraduationCap,
    Phone,
    Settings,
    LifeBuoy,
    Moon,
    Sun,
    UserCircle,
    Heart,
    Star,
    CheckCircle,
    BookOpen,
    MessageCircle,
    Maximize2,
    Sparkles
} from 'lucide-react'
import { HashTag } from '@/components/HeroIcons'

// Base Components from NotionNext
import Comment from '@/components/Comment'
import LazyImage from '@/components/LazyImage'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import SmartLink from '@/components/SmartLink'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import ShareBar from '@/components/ShareBar'

// Original HEO Theme Components
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
import SideRight from './components/SideRight'
import { Style } from './style'

// Custom Content Block Components
import HskContentBlock from '@/components/HskContentBlock'

// Dynamically imported heavy components
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })

const isBrowser = typeof window !== 'undefined';

// =================================================================================
// ======================  辅助组件 & 工具函数  ========================
// =================================================================================

const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); }
        
        /* 隐藏价格图的滚动条，保持美观 */
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        
        #theme-heo footer, 
        #theme-heo .footer-wrapper, 
        #theme-heo #footer, 
        #theme-heo .subscribe-box, 
        #theme-heo #subscribe-wrapper, 
        #theme-heo .busuanzi_container_site_pv, 
        #theme-heo .busuanzi_container_site_uv {
            display: none !important;
            height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            visibility: hidden !important;
            overflow: hidden !important;
        }
    `}</style>
);

const validateActivationCode = (code) => {
    if (!code) return { isValid: false, error: "请输入激活码" };
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode.includes('-JHM-')) return { isValid: false, error: "格式错误 (缺少标识)" };
    const parts = trimmedCode.split('-');
    if (parts.length < 3) return { isValid: false, error: "激活码不完整" };
    const VALID_LEVELS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9'];
    if (!VALID_LEVELS.includes(parts[0])) return { isValid: false, error: `不支持的等级: ${parts[0]}` };
    return { isValid: true, level: parts[0] };
};

// =================================================================================
// ======================  核心组件: 智能侧边栏 (HomeSidebar)  =====================
// =================================================================================

const HomeSidebar = ({ isOpen, onClose, sidebarX }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal();
  const [user, setUser] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    const cachedUser = localStorage.getItem('hsk_user');
    if (cachedUser) {
      try { setUser(JSON.parse(cachedUser)); } catch (e) { localStorage.removeItem('hsk_user'); }
    }
  }, []);

  const handleGoogleCallback = async (response) => {
    try {
      const res = await fetch('/api/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential }),
      });
      if (!res.ok) throw new Error('Login failed');
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem('hsk_user', JSON.stringify(userData));
      setMsg('');
    } catch (err) { setMsg('登录失败，请刷新重试'); }
  };

  useEffect(() => {
    if (window.google && !user && isOpen) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-btn-container'),
        { theme: isDarkMode ? 'filled_black' : 'outline', size: 'large', width: '240', shape: 'pill' }
      );
    }
  }, [user, isOpen, isDarkMode, isGoogleLoaded]);

  const handleActivate = async () => {
    setMsg('');
    const validation = validateActivationCode(code);
    if (!validation.isValid) { setMsg(`❌ ${validation.error}`); return; }
    if (user.unlocked_levels && user.unlocked_levels.split(',').includes(validation.level)) {
      setMsg(`⚠️ 您已经解锁了 ${validation.level}`); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(`❌ ${data.error}`); } 
      else {
        setMsg(`✅ 成功解锁 ${data.level}！`);
        const updatedUser = { ...user, unlocked_levels: data.new_unlocked_levels };
        setUser(updatedUser);
        localStorage.setItem('hsk_user', JSON.stringify(updatedUser));
        setCode('');
      }
    } catch (e) { setMsg('❌ 网络错误'); } finally { setLoading(false); }
  };

  const handleLogout = () => { localStorage.removeItem('hsk_user'); setUser(null); };

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onLoad={() => setIsGoogleLoaded(true)} />
      <div className={`fixed inset-0 bg-black z-30 transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed inset-y-0 left-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-2xl z-40 transform transition-transform duration-300 overflow-y-auto custom-scrollbar`} style={{ transform: `translateX(${sidebarX}px)` }}>
        <div className="flex flex-col min-h-full">
            <div className="p-6 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-black/20">
                {!user ? (
                    <div className="flex flex-col items-center gap-4">
                         <div className="flex items-center gap-3 w-full mb-2">
                            <UserCircle size={48} className="text-gray-400" />
                            <div>
                                <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">访客</p>
                                <p className="text-xs text-gray-500">请登录以同步进度</p>
                            </div>
                        </div>
                        <div id="google-btn-container" className="w-full flex justify-center min-h-[40px]"></div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="avatar" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                            ) : (
                                <UserCircle size={48} className="text-blue-500" />
                            )}
                            <div className="overflow-hidden">
                                <p className="font-bold text-gray-800 dark:text-white truncate">{user.name}</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">已解锁: {user.unlocked_levels || '无'}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">课程激活</label>
                            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="HSK1-JHM-XXXX" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm mb-2 outline-none uppercase transition-all" />
                            <button onClick={handleActivate} disabled={loading || !code} className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium transition-all">{loading ? '验证中...' : '立即激活'}</button>
                            {msg && <p className={`text-xs mt-2 font-medium text-center ${msg.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
                        </div>
                    </div>
                )}
            </div>
            <nav className="flex-grow p-4 space-y-2">
                <SmartLink href='/help' className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <LifeBuoy size={20} /> <span className="font-medium">帮助中心</span>
                </SmartLink>
                <SmartLink href='/settings' className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <Settings size={20} /> <span className="font-medium">设置</span>
                </SmartLink>
            </nav>
            <div className="p-4 border-t dark:border-gray-700 space-y-2">
                <button onClick={toggleDarkMode} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="font-medium">{isDarkMode ? '日间模式' : '夜间模式'}</span>
                </button>
                {user && (
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50">
                        <i className="fas fa-sign-out-alt w-5"></i> <span className="font-medium">退出登录</span>
                    </button>
                )}
            </div>
        </div>
      </div>
    </>
  );
};

// =================================================================================
// ======================  价格表组件 (可拖动 - 豪华大图版)  ========================
// =================================================================================

const DraggablePriceChart = () => {
    const scrollRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // 课程数据定义 - 按照要求修改了价格和图片
    const courses = [
        {
            id: 1,
            title: '七天搞定hsk',
            price: '10,000 Ks',
            image: 'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/IMG_20251219_162925.png'
        },
        {
            id: 2,
            title: '汉语日常会话10000句',
            price: '60,000 Ks',
            image: 'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/IMG_20251219_163032.png'
        },
        {
            id: 3,
            title: 'hsk2速成',
            price: '30,000 Ks',
            image: 'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/IMG_20251219_162958.png'
        }
    ];

    // 鼠标按下
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    // 鼠标离开或松开
    const handleMouseUpOrLeave = () => {
        setIsDragging(false);
    };

    // 鼠标移动
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // 滚动速度系数
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    return (
        <div className="w-full max-w-4xl px-4 pointer-events-auto">
             {/* 容器：深色磨砂玻璃背景，营造高端感 */}
            <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl ring-1 ring-white/5">
                 <div className="flex items-center justify-between px-2 mb-4">
                     <span className="text-sm font-bold text-white/90 flex items-center gap-2 tracking-wider">
                        <Sparkles size={14} className="text-yellow-400" /> 精选课程
                     </span>
                     <span className="text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-1">
                        <Maximize2 size={10} /> 左右滑动查看
                     </span>
                 </div>
                 
                {/* 滚动区域 */}
                <div 
                    ref={scrollRef}
                    className="overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none flex gap-6 pb-2"
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseUpOrLeave}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseMove={handleMouseMove}
                >
                    {courses.map((course) => (
                        <div key={course.id} className="relative flex-shrink-0 w-44 md:w-56 group">
                            {/* 卡片容器：默认微光边框，悬停高亮 */}
                            <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-gray-900/50 shadow-xl relative border border-white/10 transition-all duration-500 group-hover:border-yellow-500/50 group-hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                                {/* 图片 - 关键：draggable=false 修复拖动问题 */}
                                <img 
                                    src={course.image} 
                                    alt={course.title} 
                                    draggable="false" 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                />
                                
                                {/* 底部渐变遮罩 */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                                {/* 内容区域 */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                                    <div className="w-8 h-1 bg-yellow-500 mb-2 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
                                    <h3 className="text-white text-lg font-bold leading-tight drop-shadow-md">{course.title}</h3>
                                    <p className="text-yellow-400 text-xl font-black mt-1 tracking-wide">{course.price}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* 右侧留白，防止最后一个卡片贴边 */}
                    <div className="w-2 flex-shrink-0" />
                </div>
            </div>
        </div>
    );
};

// IndexedDB Helper
const DB_NAME = 'ChineseLearningDB';
const WORD_STORE_NAME = 'favoriteWords';
function openDB() {
  return new Promise((resolve) => {
    if (!isBrowser) return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(WORD_STORE_NAME)) db.createObjectStore(WORD_STORE_NAME, { keyPath: 'id' });
    };
  });
}
async function getAllFavorites(storeName) {
    try {
        const db = await openDB(); if (!db) return [];
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });
    } catch (e) { return []; }
}

// =================================================================================
// ======================  新主页布局 (LayoutIndex) ========================
// =================================================================================

const LayoutIndex = props => {
  const router = useRouter();
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const scrollableContainerRef = useRef(null);
  
  const sidebarWidth = 288;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarX, setSidebarX] = useState(-sidebarWidth);

  const [wordCardData, setWordCardData] = useState(null);
  const isWordFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-words' : false;

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1543165796-5426273eaec3?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=2072&auto=format&fit=crop'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);
  }, []);

  const handleCloseFavorites = useCallback(() => {
    router.push(router.pathname, undefined, { shallow: true });
  }, [router]);

  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
        <Style/><CustomScrollbarStyle />
        <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} />

        <div className='relative flex-grow w-full h-full'>
            {/* 背景图层 */}
            <div className='absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000' style={{ backgroundImage: `url(${backgroundUrl})` }} />
            <div className='absolute inset-0 bg-black/40 backdrop-blur-[1px]'></div>

            {/* 汉堡按钮 - 固定左上角，纯图标，无背景，带投影 */}
            <button 
                onClick={openSidebar} 
                className="fixed top-6 left-6 z-50 p-2 text-white hover:opacity-80 transition-opacity drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
            >
                <i className="fas fa-bars text-xl"></i>
            </button>
            
            {/* Hero 区域：包含文字和价格表 */}
            <div className='absolute top-0 left-0 right-0 h-[68vh] z-10 pt-20 px-6 flex flex-col items-center text-center text-white pointer-events-none'>
                <div className='max-w-4xl w-full flex flex-col items-center'>
                    <h1 className='text-5xl md:text-6xl font-black tracking-tight mb-4 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]'>中缅文培训中心</h1>
                    <div className='mb-6'>
                        <p className='text-lg md:text-xl font-bold leading-relaxed mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] opacity-95'>
                            专业中缅双语教学，连接文化与机遇的桥梁。
                        </p>
                        <p className='text-sm md:text-md font-bold text-blue-300 tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]'>
                            မြန်မာ-တရုတ် နှစ်ဘာသာစကား သင်ကြားရေး ကျွမ်းကျင်သူ။
                        </p>
                    </div>
                    
                    {/* 
                        DraggablePriceChart 容器
                        z-30 保证层级高于滚动层，pointer-events-auto 保证可拖动
                    */}
                    <div className="z-30 w-full flex justify-center mt-2 pointer-events-auto">
                        <DraggablePriceChart />
                    </div>
                </div>
            </div>

            {/* 内容滚动层 */}
            <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                {/* 增加Spacer高度以容纳更大的图片卡片 */}
                <div className='h-[65vh] flex-shrink-0' />
                
                <div className='relative bg-white dark:bg-gray-900 rounded-t-[40px] shadow-[0_-15px_35px_rgba(0,0,0,0.3)] pb-10 min-h-[calc(35vh+1px)] transition-all'>
                    <div className='w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto my-6'></div>

                    <main className="max-w-5xl mx-auto px-4 py-2">
                        <div className='mb-6 px-4'>
                            <h2 className='text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3'>
                                <GraduationCap className='text-blue-600' /> HSK 标准课程
                            </h2>
                            <p className='text-xs text-gray-500 mt-1 font-medium'>从零基础到精通，系统化学习汉语知识。</p>
                        </div>
                        <HskContentBlock />
                    </main>
                </div>
            </div>
        </div>
        {wordCardData && <WordCard words={wordCardData} isOpen={isWordFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-words" />}
    </div>
  );
};

// =================================================================================
// ====================== 其他页面布局 (保持 HEO 主题原有功能) ========================
// =================================================================================

const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  if (router.route === '/') return <LayoutIndex {...props} />

  const headerSlot = (
    <header>
      {fullWidth ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </header>
  )
  const slotRight = router.route === '/404' || fullWidth ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]'
  useEffect(() => { loadWowJS() }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] min-h-screen flex flex-col`}>
      <Style /> 
      <CustomScrollbarStyle />
      {headerSlot}
      <main className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
        <div className='w-full mx-auto lg:flex justify-center relative z-10'>
          <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          <div className='lg:px-2'></div>
          <div className='hidden xl:block'>{slotRight}</div>
        </div>
      </main>
    </div>
  )
}

const LayoutPostList = props => (
    <div id='post-outer-wrapper' className='px-5 md:px-0'>
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}
    </div>
)

const LayoutSearch = props => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s
  useEffect(() => {
    if (currentSearch) {
      replaceSearchResult({
        doms: document.getElementsByClassName('replace'),
        search: currentSearch,
        target: { element: 'span', className: 'text-red-500 border-b border-dashed' }
      })
    }
  }, [currentSearch])
  return (
    <div id='post-outer-wrapper' className='px-5 md:px-0'>
      {!currentSearch ? <SearchNav {...props} /> : <div id='posts-wrapper'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>}
    </div>
  )
}

const LayoutArchive = props => (
  <div className='p-5 rounded-xl border dark:border-gray-600 max-w-6xl w-full bg-white dark:bg-[#1e1e1e]'>
    <CategoryBar {...props} border={false} />
    <div className='px-3'>
      {Object.keys(props.archivePosts).map(title => <BlogPostArchive key={title} posts={props.archivePosts[title]} archiveTitle={title} />)}
    </div>
  </div>
)

const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { fullWidth } = useGlobal()
  const commentEnable = siteConfig('COMMENT_TWIKOO_ENV_ID') || siteConfig('COMMENT_WALINE_SERVER_URL')
  return (
    <>
      <div className={`w-full ${fullWidth ? '' : 'xl:max-w-5xl lg:hover:shadow lg:border'} lg:px-2 lg:py-4 bg-white dark:bg-[#18171d] dark:border-gray-600 rounded-2xl`}>
        {lock ? <PostLock validPassword={validPassword} /> : post && (
          <div className='px-5'>
            <article>
              <ArticleExpirationNotice post={post} /><AISummary aiSummary={post.aiSummary} />
              <NotionPage post={post} /><ShareBar post={post} /><PostCopyright {...props} /><PostRecommend {...props} /><PostAdjacent {...props} />
            </article>
            {commentEnable && <div className='px-5'><hr className='my-4 border-dashed' /><Comment frontMatter={post} /></div>}
          </div>
        )}
      </div>
      <FloatTocButton {...props} />
    </>
  )
}

const Layout404 = () => (
    <div className='error-content flex flex-col md:flex-row w-full mt-12 h-96 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-3xl'>
      <LazyImage className='h-full p-4' src={'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'} />
      <div className='flex-1 flex flex-col items-center space-y-4'>
        <h1 className='font-extrabold text-7xl dark:text-white'>404</h1>
        <SmartLink href='/'><button className='bg-blue-500 py-2 px-4 text-white rounded-lg'>回到主页</button></SmartLink>
      </div>
    </div>
)

const LayoutCategoryIndex = props => (
    <div className='mt-8 px-5 md:px-0'>
      <div className='text-4xl font-extrabold mb-5'>分类</div>
      <div className='flex flex-wrap justify-center'>
        {props.categoryOptions?.map(c => (
          <SmartLink key={c.name} href={`/category/${c.name}`} className='group mr-5 mb-5 flex items-center border bg-white rounded-xl px-4 py-3 hover:bg-indigo-600 hover:text-white transition-all'>
            <HashTag className='w-5 h-5' />{c.name}<div className='ml-1 px-2 rounded-lg bg-gray-100 group-hover:text-indigo-600'>{c.count}</div>
          </SmartLink>
        ))}
      </div>
    </div>
)

const LayoutTagIndex = props => (
    <div className='px-5 mt-8 md:px-0'>
      <div className='text-4xl font-extrabold mb-5'>标签</div>
      <div className='flex flex-wrap justify-center'>
        {props.tagOptions.map(t => (
          <SmartLink key={t.name} href={`/tag/${t.name}`} className='group mr-5 mb-5 flex items-center border bg-white rounded-xl px-4 py-3 hover:bg-indigo-600 hover:text-white transition-all'>
            <HashTag className='w-5 h-5' />{t.name}<div className='ml-1 px-2 rounded-lg bg-gray-100 group-hover:text-indigo-600'>{t.count}</div>
          </SmartLink>
        ))}
      </div>
    </div>
)

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
}
