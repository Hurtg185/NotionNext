/**
 *   HEO 主题说明
 *  > 主题设计者 [张洪](https://zhheo.com/)
 *  > 主题开发者 [tangly1024](https://github.com/tangly1024)
 *  > 此文件已强制设为手机端显示模式，隐藏价格，移除私信功能。
 */

// React & Next.js
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'

// UI & Animation
import { Transition, Dialog } from '@headlessui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadWowJS } from '@/lib/plugins/wow'

// Global State & Config
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'

// Icons
import {
    GraduationCap,
    Settings,
    LifeBuoy,
    Moon,
    Sun,
    UserCircle,
    BookOpen,
    Sparkles,
    Gem
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
        /* 强制隐藏桌面滚动条或美化 */
        .custom-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
        .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        #theme-heo footer, 
        #theme-heo .footer-wrapper, 
        #theme-heo #footer, 
        #theme-heo .subscribe-box, 
        #theme-heo #subscribe-wrapper, 
        #theme-heo .busuanzi_container_site_pv, 
        #theme-heo .busuanzi_container_site_uv {
            display: none !important;
        }

        /* 强制手机容器背景 */
        body {
            background-color: #0f172a; /* 深色外部背景 */
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
      {/* 遮罩层只在手机容器内生效 */}
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
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">课程激活</label>
                            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="HSK1-JHM-XXXX" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs mb-2 outline-none uppercase" />
                            <button onClick={handleActivate} disabled={loading || !code} className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium">{loading ? '...' : '激活'}</button>
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
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-sm">
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
// ======================  价格表组件 (隐藏价格版)  ========================
// =================================================================================

const PriceChartDisplay = () => {
    const courses = [
        {
            id: 1,
            title: 'HSK 1',
            image: 'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/IMG_20251219_162925.png'
        },
        {
            id: 2,
            title: 'HSK 2',
            image: 'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/IMG_20251219_162958.png'
        },
        {
            id: 3,
            title: '口语课',
            image: 'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/IMG_20251219_162958.png'
        }
    ];

    return (
        <div className="w-full px-2 pointer-events-auto">
            <div className="bg-black/30 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-xl">
                 <div className="flex items-center justify-between px-1 mb-3">
                     <span className="text-xs font-bold text-white/90 flex items-center gap-1.5 tracking-wider">
                        <Sparkles size={12} className="text-yellow-400" /> 热门课程
                     </span>
                     <span className="text-[8px] text-white/40 uppercase tracking-widest flex items-center gap-1">
                        <Gem size={8} /> 官方
                     </span>
                 </div>
                 
                <div className="grid grid-cols-3 gap-2">
                    {courses.map((course) => (
                        <div key={course.id} className="relative group">
                            <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-900/40 relative border border-white/10">
                                <img 
                                    src={course.image} 
                                    alt={course.title} 
                                    className="w-full h-full object-cover" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />
                                <div className="absolute bottom-0 left-0 right-0 p-1.5 text-center">
                                    <h3 className="text-white text-[10px] font-bold leading-tight drop-shadow-md">{course.title}</h3>
                                    {/* 价格已移除 */}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

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
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-[#0f172a] flex justify-center overflow-hidden`}>
        <Style/><CustomScrollbarStyle />
        
        {/* 核心手机容器 */}
        <div className="relative w-full max-w-md h-full bg-black shadow-2xl overflow-hidden">
            
            <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} />
            
            <div className='relative w-full h-full'>
                {/* 背景图层 */}
                <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />
                <div className='absolute inset-0 bg-black/50 backdrop-blur-[2px]'></div>

                {/* 侧边栏触发器 */}
                <button 
                    onClick={openSidebar} 
                    className="absolute top-5 left-5 z-50 p-2 text-white bg-black/30 rounded-full backdrop-blur-md border border-white/10"
                >
                    <i className="fas fa-bars text-lg"></i>
                </button>
                
                {/* Hero 文字及价格图示 */}
                <div className='absolute top-0 left-0 right-0 z-10 pt-16 px-4 flex flex-col items-center text-center text-white pointer-events-none'>
                    <h1 className='text-2xl font-black tracking-tight mb-2 drop-shadow-lg'>中缅文培训中心</h1>
                    <div className='mb-4'>
                        <p className='text-xs font-bold opacity-90 mb-1'>专业中缅双语教学，文化与机遇的桥梁。</p>
                        <p className='text-[8px] font-bold text-blue-300 tracking-wider'>မြန်မာ-တရုတ် နှစ်ဘာသာစကား သင်ကြားရေး။</p>
                    </div>
                    
                    <PriceChartDisplay />
                </div>

                {/* 滚动内容区 */}
                <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                    <div className='h-[360px] w-full flex-shrink-0' />
                    
                    <div className='relative bg-white dark:bg-gray-900 rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] pb-10 min-h-screen'>
                        <div className='w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto my-4'></div>

                        <main className="px-4">
                            <div className='mb-4'>
                                <h2 className='text-lg font-black text-gray-800 dark:text-gray-100 flex items-center gap-2'>
                                    <GraduationCap size={20} className='text-blue-600' /> HSK 标准课程
                                </h2>
                                <p className='text-[10px] text-gray-400 mt-1 font-medium'>从零基础到精通，系统化学习汉语。</p>
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
// ====================== 其他页面布局 (强制手机宽度) ========================
// =================================================================================

const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  if (router.route === '/') return <LayoutIndex {...props} />

  const headerSlot = (
    <header className="max-w-md mx-auto">
      {fullWidth ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </header>
  )
  
  useEffect(() => { loadWowJS() }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#0f172a] min-h-screen flex justify-center`}>
      <Style /> 
      <CustomScrollbarStyle />
      
      <div className="w-full max-w-md bg-[#f7f9fe] dark:bg-[#18171d] shadow-2xl flex flex-col min-h-screen">
          {headerSlot}
          <main className={`flex-grow w-full relative px-4`}>
            <div className='w-full mx-auto relative z-10'>
              <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
            </div>
          </main>
      </div>
    </div>
  )
}

const LayoutPostList = props => (
    <div id='post-outer-wrapper'>
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
    <div id='post-outer-wrapper'>
      {!currentSearch ? <SearchNav {...props} /> : <div id='posts-wrapper'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>}
    </div>
  )
}

const LayoutArchive = props => (
  <div className='p-4 rounded-2xl border dark:border-gray-600 w-full bg-white dark:bg-[#1e1e1e]'>
    <CategoryBar {...props} border={false} />
    <div className='px-1'>
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
      <div className={`w-full bg-white dark:bg-[#18171d] dark:border-gray-600 rounded-2xl`}>
        {lock ? <PostLock validPassword={validPassword} /> : post && (
          <div className='px-4 py-2'>
            <article>
              <ArticleExpirationNotice post={post} /><AISummary aiSummary={post.aiSummary} />
              <NotionPage post={post} /><ShareBar post={post} /><PostCopyright {...props} /><PostRecommend {...props} /><PostAdjacent {...props} />
            </article>
            {commentEnable && <div className='px-2'><hr className='my-4 border-dashed' /><Comment frontMatter={post} /></div>}
          </div>
        )}
      </div>
      <FloatTocButton {...props} />
    </>
  )
}

const Layout404 = () => (
    <div className='flex flex-col w-full mt-12 h-64 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-2xl'>
      <LazyImage className='h-32' src={'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'} />
      <h1 className='font-extrabold text-4xl dark:text-white mt-4'>404</h1>
      <SmartLink href='/'><button className='bg-blue-500 py-2 px-4 text-white rounded-lg mt-4'>回到主页</button></SmartLink>
    </div>
)

const LayoutCategoryIndex = props => (
    <div className='mt-8 px-2'>
      <div className='text-2xl font-extrabold mb-5'>分类</div>
      <div className='flex flex-wrap justify-start'>
        {props.categoryOptions?.map(c => (
          <SmartLink key={c.name} href={`/category/${c.name}`} className='group mr-2 mb-2 flex items-center border bg-white rounded-xl px-3 py-2 text-sm hover:bg-indigo-600 hover:text-white transition-all'>
            <HashTag className='w-4 h-4' />{c.name}<div className='ml-1 px-1.5 rounded-lg bg-gray-100 group-hover:text-indigo-600 text-xs'>{c.count}</div>
          </SmartLink>
        ))}
      </div>
    </div>
)

const LayoutTagIndex = props => (
    <div className='px-2 mt-8'>
      <div className='text-2xl font-extrabold mb-5'>标签</div>
      <div className='flex flex-wrap justify-start'>
        {props.tagOptions.map(t => (
          <SmartLink key={t.name} href={`/tag/${t.name}`} className='group mr-2 mb-2 flex items-center border bg-white rounded-xl px-3 py-2 text-sm hover:bg-indigo-600 hover:text-white transition-all'>
            <HashTag className='w-4 h-4' />{t.name}<div className='ml-1 px-1.5 rounded-lg bg-gray-100 group-hover:text-indigo-600 text-xs'>{t.count}</div>
          </SmartLink>
        ))}
      </div>
    </div>
)

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
}
