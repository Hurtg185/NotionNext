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
import { useSwipeable } from 'react-swipeable'
import { loadWowJS } from '@/lib/plugins/wow'

// Global State & Config
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'

// Icons
import { FaTiktok, FaFacebook, FaTelegramPlane } from 'react-icons/fa'
import {
    GraduationCap,
    BookOpen,
    Phone,
    MessageSquare,
    Users,
    Settings,
    LifeBuoy,
    Moon,
    Sun,
    UserCircle,
    Mic,
    Heart,
    List,
    BookText,
    SpellCheck2,
    Type
} from 'lucide-react'
import { HashTag } from '@/components/HeroIcons'

// Base Components from NotionNext
import Comment from '@/components/Comment'
import { AdSlot } from '@/components/GoogleAdsense'
import LazyImage from '@/components/LazyImage'
import LoadingCover from '@/components/LoadingCover'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import SmartLink from '@/components/SmartLink'
import WWAds from '@/components/WWAds'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import ShareBar from '@/components/ShareBar'


// Original HEO Theme Components
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
import FloatTocButton from './components/FloatTocButton'
// import Footer from './components/Footer' // <-- 移除 Footer 引用
import Header from './components/Header'
import Hero from './components/Hero'
import LatestPostsGroup from './components/LatestPostsGroup'
import { NoticeBar } from './components/NoticeBar'
import PostAdjacent from './components/PostAdjacent'
import PostCopyright from './components/PostCopyright'
import PostHeader from './components/PostHeader'
import { PostLock } from './components/PostLock'
import PostRecommend from './components/PostRecommend'
import SearchNav from './components/SearchNav'
import SideRight from './components/SideRight'
import { Style } from './style'

// Custom Content Block Components
import PinyinContentBlock from '@/components/PinyinContentBlock'
import WordsContentBlock from '@/components/WordsContentBlock'
import KouyuPage from '@/components/kouyu'
import HskContentBlock from '@/components/HskContentBlock'

// Dynamically imported heavy components
const GlosbeSearchCard = dynamic(() => import('@/components/GlosbeSearchCard'), { ssr: false })
// const ShortSentenceCard = dynamic(() => import('@/components/ShortSentenceCard'), { ssr: false })
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
        
        /* 强制隐藏自带主题的订阅盒、底部信息和统计栏，防止空白占位 */
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

const HomeSidebar = ({ isOpen, onClose, sidebarX, isDragging }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal();
  const sidebarWidth = 288;
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

  const sidebarLinks = [
    { icon: <Settings size={20} />, text: '通用设置', href: '/settings' },
    { icon: <LifeBuoy size={20} />, text: '帮助中心', href: '/help' },
  ];

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
                            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="HSK1-JHM-XXXX" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none uppercase transition-all" />
                            <button onClick={handleActivate} disabled={loading || !code} className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-1.5 rounded-lg text-sm font-medium transition-all disabled:bg-gray-400">{loading ? '验证中...' : '立即激活'}</button>
                            {msg && <p className={`text-xs mt-2 font-medium text-center ${msg.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
                        </div>
                    </div>
                )}
            </div>
            <nav className="flex-grow p-4 space-y-2">
                {sidebarLinks.map((link, index) => (
                    <SmartLink key={index} href={link.href} className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        {link.icon} <span className="font-medium">{link.text}</span>
                    </SmartLink>
                ))}
            </nav>
            <div className="p-4 border-t dark:border-gray-700 space-y-2">
                <button onClick={toggleDarkMode} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="font-medium">{isDarkMode ? '切换日间模式' : '切换夜间模式'}</span>
                </button>
                {user && (
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <i className="fas fa-sign-out-alt w-5 text-center text-lg"></i>
                        <span className="font-medium">退出登录</span>
                    </button>
                )}
            </div>
        </div>
      </div>
    </>
  );
};

// =================================================================================
// ======================  其他辅助组件 (ActionButtons, ContactPanel)  =============
// =================================================================================

const ActionButtons = ({ onOpenFavorites, onOpenContact }) => {
  const actions = [
    { icon: <Phone size={24} />, text: '联系我们', type: 'contact', color: 'from-blue-500 to-sky-500' },
    { icon: <Heart size={24} />, text: '收藏生词', type: 'words', color: 'from-orange-500 to-amber-500' },
  ];
  return (
    <div className="flex justify-center gap-8 px-4">
      {actions.map((action, index) => {
        const content = ( <> <div className="mb-2">{action.icon}</div> <span className="text-sm font-bold">{action.text}</span> </> );
        const className = `flex flex-col items-center justify-center p-4 min-w-[120px] rounded-2xl shadow-lg hover:shadow-xl text-white bg-gradient-to-br ${action.color} transition-all duration-300 transform hover:-translate-y-1`;
        return ( <button key={index} onClick={() => action.type === 'contact' ? onOpenContact() : onOpenFavorites(action.type)} className={className}> {content} </button> );
      })}
    </div>
  );
};

const ContactPanel = ({ isOpen, onClose }) => {
    const socialLinks = [
        { name: 'Facebook', href: 'https://www.facebook.com/share/1ErXyBbrZ1', icon: <FaFacebook size={32} />, color: 'text-blue-600' },
        { name: 'TikTok', href: 'https://www.tiktok.com/@mmzh.onlione?_r=1&_t=ZS-91OzyDddPu8', icon: <FaTiktok size={32} />, color: 'text-black dark:text-white' },
        { name: 'Telegram', href: 'https://t.me/hurt8888', icon: <FaTelegramPlane size={32} />, color: 'text-sky-500' }
    ];
    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/30 backdrop-blur-sm" /></Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 dark:text-gray-100">联系我们</Dialog.Title>
                                <div className="mt-6 space-y-4">
                                    {socialLinks.map(link => (
                                        <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 transition-colors">
                                            <div className={link.color}>{link.icon}</div>
                                            <div><p className="font-semibold text-gray-800 dark:text-gray-200">{link.name}</p><p className="text-xs text-gray-500">点击跳转</p></div>
                                        </a>
                                    ))}
                                </div>
                                <div className="mt-6"><button type="button" className="w-full bg-blue-100 dark:bg-blue-900/50 py-2 rounded-md text-sm font-medium text-blue-900 dark:text-blue-200" onClick={onClose}>关闭</button></div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

// IndexedDB Helper
const DB_NAME = 'ChineseLearningDB';
const WORD_STORE_NAME = 'favoriteWords';
function openDB() {
  return new Promise((resolve, reject) => {
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
  const allTabs = [{ name: 'HSK 课程', key: 'hsk', icon: <GraduationCap size={24} /> }];
  const [activeTabKey, setActiveTabKey] = useState('hsk'); 

  useEffect(() => {
    if (router.isReady) {
      const tabFromQuery = router.query.tab;
      const validTab = allTabs.find(t => t.key === tabFromQuery);
      setActiveTabKey(validTab ? validTab.key : 'hsk');
    }
  }, [router.isReady, router.query.tab]);
  
  const handleTabChange = (key) => {
    router.push(`/?tab=${key}`, undefined, { shallow: true });
    setActiveTabKey(key);
  };

  const [backgroundUrl, setBackgroundUrl] = useState('');
  const scrollableContainerRef = useRef(null);
  const stickySentinelRef = useRef(null);
  const lastScrollY = useRef(0);
  const [isStickyActive, setIsStickyActive] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const mainContentRef = useRef(null);
  
  const sidebarWidth = 288;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarX, setSidebarX] = useState(-sidebarWidth);
  const [isDragging, setIsDragging] = useState(false);

  const [wordCardData, setWordCardData] = useState(null);
  const isWordFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-words' : false;
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  
  const handleOpenFavorites = useCallback(async (type) => {
    if (type === 'words') {
        const words = await getAllFavorites(WORD_STORE_NAME);
        if (words?.length > 0) {
            setWordCardData(words);
            router.push('#favorite-words', undefined, { shallow: true });
        } else { alert('您还没有收藏任何生词。'); }
    }
  }, [router]); 

  const handleCloseFavorites = useCallback(() => {
    router.push(router.pathname, undefined, { shallow: true });
  }, [router]);

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);

    const container = scrollableContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const currentY = container.scrollTop;
      if (isStickyActive) {
          const diff = currentY - lastScrollY.current;
          if (Math.abs(diff) > 5) setIsNavVisible(diff <= 0);
      }
      lastScrollY.current = currentY;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    const observer = new IntersectionObserver(([entry]) => {
            const shouldBeSticky = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            setIsStickyActive(shouldBeSticky);
    }, { threshold: 0 });
    if (stickySentinelRef.current) observer.observe(stickySentinelRef.current);
    return () => { container.removeEventListener('scroll', handleScroll); };
  }, [isStickyActive]);

  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };
  
  const renderTabButtons = () => allTabs.map(tab => (
    <button key={tab.key} onClick={() => handleTabChange(tab.key)} className={`flex flex-col items-center justify-center w-full pt-4 pb-2 transition-all duration-300 ${activeTabKey === tab.key ? 'text-blue-600 scale-105' : 'text-gray-500'}`}>
        {tab.icon} <span className='text-sm font-bold mt-1'>{tab.name}</span>
        <div className={`w-12 h-1 mt-1 rounded-full bg-blue-600 transition-all ${activeTabKey === tab.key ? 'opacity-100' : 'opacity-0'}`}></div>
    </button>
  ));

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
        <Style/><CustomScrollbarStyle />
        <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} isDragging={isDragging} />

        <div className='relative flex-grow w-full h-full'>
            <div className='absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000' style={{ backgroundImage: `url(${backgroundUrl})` }} />
            <div className='absolute inset-0 bg-black/40 backdrop-blur-[2px]'></div>

            <button onClick={openSidebar} className="absolute top-6 left-6 z-30 p-3 text-white bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-all shadow-lg">
                <i className="fas fa-bars text-xl"></i>
            </button>
            
            <div className='absolute top-0 left-0 right-0 h-[45vh] z-10 p-6 flex flex-col justify-center items-center text-center text-white pointer-events-none'>
                <div className='pointer-events-auto max-w-4xl'>
                    <h1 className='text-5xl md:text-6xl font-black tracking-tight mb-4 drop-shadow-2xl'>中缅文培训中心</h1>
                    <div className='bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10'>
                        <p className='text-lg md:text-xl font-medium leading-relaxed mb-2 opacity-95'>
                            专业中缅双语教学，连接文化与机遇的桥梁。从零起点到精通，助力学子跨越语言障碍，开启职场与人生的精彩新篇章。
                        </p>
                        <p className='text-sm md:text-md font-semibold text-blue-300 tracking-widest'>
                            မြန်မာ-တရုတ် နှစ်ဘာသာစကား သင်ကြားရေး ကျွမ်းကျင်သူ။ လူငယ်များအတွက် အနာဂတ် အခွင့်အလမ်းကောင်းများဆီသို့။
                        </p>
                    </div>
                    
                    <div className='mt-8 grid grid-cols-4 gap-4 h-32 w-full max-w-2xl mx-auto'>
                        <div className='col-span-1 rounded-2xl overflow-hidden relative border border-white/20 shadow-xl group'>
                            <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className='absolute inset-0 bg-blue-600/30 backdrop-blur-[2px] flex items-center justify-center font-bold text-[10px]'>互动学习</div>
                        </div>
                        <div className='col-span-2 rounded-2xl overflow-hidden relative border border-white/20 shadow-xl group'>
                            <img src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className='absolute inset-0 bg-black/30 backdrop-blur-md flex flex-col items-center justify-center'>
                                <span className='text-xs font-bold'>HSK 标准课程</span>
                                <span className='text-[8px] opacity-70'>Standard Course</span>
                            </div>
                        </div>
                        <div className='col-span-1 rounded-2xl overflow-hidden relative border border-white/20 shadow-xl group'>
                            <img src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=400" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className='absolute inset-0 bg-indigo-600/30 backdrop-blur-[2px] flex items-center justify-center font-bold text-[10px]'>证书保障</div>
                        </div>
                    </div>
                </div>
            </div>

            <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div className='h-[45vh] flex-shrink-0' />
                <div className='relative bg-white dark:bg-gray-900 rounded-t-[40px] shadow-2xl pb-10 min-h-[calc(55vh+1px)] transition-all'>
                    <div className='bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-t-[40px] pt-8'>
                       <div className='px-6 mb-8 max-w-3xl mx-auto'><GlosbeSearchCard /></div>
                       <div className='pb-8'><ActionButtons onOpenFavorites={handleOpenFavorites} onOpenContact={() => setIsContactPanelOpen(true)} /></div>
                       <div ref={stickySentinelRef}></div>
                       <div className={`${isStickyActive ? 'opacity-0 h-0 overflow-hidden' : ''} border-b border-blue-100 dark:border-gray-800 transition-all`}>
                            <div className='max-w-md mx-auto'>{renderTabButtons()}</div>
                       </div>
                    </div>
                    <div className={`fixed w-full top-0 z-30 transition-transform duration-300 ${isStickyActive ? 'translate-y-0' : '-translate-y-full'} ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                        <div className='bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-blue-100 dark:border-gray-800 shadow-lg'>
                            <div className='max-w-md mx-auto'>{renderTabButtons()}</div>
                        </div>
                    </div>
                    <main ref={mainContentRef} className="max-w-5xl mx-auto px-4 py-8">
                        {activeTabKey === 'hsk' && <HskContentBlock />}
                    </main>
                </div>
            </div>
        </div>
        {wordCardData && <WordCard words={wordCardData} isOpen={isWordFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-words" />}
        <ContactPanel isOpen={isContactPanelOpen} onClose={() => setIsContactPanelOpen(false)} />
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

  // 彻底移除 Header、Footer 以及自带的通知栏
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
      <CustomScrollbarStyle /> {/* 加入强制隐藏 CSS 逻辑 */}
      {headerSlot}
      <main className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
        <div className='w-full mx-auto lg:flex justify-center relative z-10'>
          <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          <div className='lg:px-2'></div>
          <div className='hidden xl:block'>{slotRight}</div>
        </div>
      </main>
      {/* <Footer /> 彻底移除 Footer */}
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
  const { locale, fullWidth } = useGlobal()
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

const Layout404 = (props) => (
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
