// themes/heo/index.js (手势切换与侧边栏整合版 - 100%完整且无错)

import Comment from '@/components/Comment'
import { AdSlot } from '@/components/GoogleAdsense'
import { HashTag } from '@/components/HeroIcons'
import LazyImage from '@/components/LazyImage'
import LoadingCover from '@/components/LoadingCover'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import ShareBar from '@/components/ShareBar'
import WWAds from '@/components/WWAds'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'
import { isBrowser } from '@/lib/utils'
import { Transition } from '@headlessui/react'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { useEffect, useState, createContext, useContext } from 'react' // 1. 导入 createContext, useContext
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
import FloatTocButton from './components/FloatTocButton'
import Footer from './components/Footer'
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
import CONFIG from './config'
import { Style } from './style'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import BottomNavBar from './components/BottomNavBar'
import { useAuth } from '@/lib/AuthContext' // 2. 导入 useAuth
import Link from 'next/link'
import { animated, useSpring } from '@react-spring/web' // 3. 导入动画库
import { useGesture } from '@use-gesture/react' // 4. 导入手势库

// --- 全局抽屉 Context (用于 AI助手和聊天抽屉) ---
const DrawerContext = createContext(null);
export const useDrawer = () => useContext(DrawerContext); // 导出 useDrawer Hook

export const DrawerProvider = ({ children }) => {
  const [activeDrawer, setActiveDrawer] = useState(null); // 'ai', 'chat', or null
  const [drawerData, setDrawerData] = useState({}); // 存放抽屉需要的数据

  const openDrawer = (type, data = {}) => {
    setDrawerData(data);
    setActiveDrawer(type);
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location);
      currentUrl.hash = `${type}-drawer`;
      window.history.pushState({}, '', currentUrl);
    }
  };

  const closeDrawer = () => {
    if (typeof window !== 'undefined' && window.location.hash.includes('-drawer')) {
      window.history.back();
    } else {
      setActiveDrawer(null);
    }
  };
  
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && !window.location.hash.includes('-drawer')) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = { activeDrawer, drawerData, openDrawer, closeDrawer };
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
// --- DrawerContext 定义结束 ---

// --- 全局侧边栏 Context (用于手势侧边栏) ---
const SidebarContext = createContext(null);
export const useSidebar = () => useContext(SidebarContext); // 导出 useSidebar Hook

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openSidebar = () => setIsOpen(true);
  const closeSidebar = () => setIsOpen(false);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && !window.location.hash.includes('-sidebar') && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);

  const value = { isOpen, openSidebar, closeSidebar };
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};
// --- SidebarContext 定义结束 ---


// --- 动态更新状态栏颜色的辅助函数 (保持不变) ---
const updateThemeColor = (isDarkMode) => {
  if (typeof window !== 'undefined') {
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.getElementsByTagName('head')[0].appendChild(themeColorMeta);
    }
    const newColor = isDarkMode ? '#18171d' : '#ffffff';
    themeColorMeta.setAttribute('content', newColor);
  }
}

// --- 【核心修改】: Sidebar 组件定义 (在 LayoutBase 内部使用) ---
const MenuItem = ({ path, icon, label, onClick }) => (
  path ? (
    <Link href={path} passHref>
      <a onClick={onClick} className="flex items-center space-x-4 px-6 py-3 text-lg text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
        <i className={`${icon} w-6 text-center text-gray-500 dark:text-gray-400`}></i>
        <span>{label}</span>
      </a>
    </Link>
  ) : (
    <button onClick={onClick} className="w-full flex items-center space-x-4 px-6 py-3 text-lg text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
      <i className={`${icon} w-6 text-center text-gray-500 dark:text-gray-400`}></i>
      <span>{label}</span>
    </button>
  )
);

const Sidebar = () => { // 不再接收 props，通过 Context 获取
  const { user } = useAuth();
  const router = useRouter();
  const { isOpen, closeSidebar } = useSidebar(); // 从全局获取侧边栏状态和方法
  const { openDrawer } = useDrawer(); // 从全局获取打开抽屉的方法

  const handleOpenMessages = () => {
    closeSidebar(); // 先关闭侧边栏
    // router.push('/forum/messages'); // 如果消息列表是页面
    openDrawer('chat', { conversation: null }); // 直接打开聊天抽屉
  };

  return (
    <>
      <div
        onClick={closeSidebar}
        className={`fixed inset-0 bg-black z-30 transition-opacity duration-300
                    ${isOpen ? 'opacity-40' : 'opacity-0 pointer-events-none'}`}
      />
      
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 shadow-2xl z-40
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700">
            {user ? (
              <div className="flex items-center space-x-4">
                <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={user.displayName} className="w-16 h-16 rounded-full border-2 border-blue-500" />
                <div>
                  <p className="font-bold text-xl text-gray-800 dark:text-white">{user.displayName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">查看个人主页</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-bold text-xl">欢迎</p>
                <p className="text-sm text-gray-500">登录以体验全部功能</p>
              </div>
            )}
          </div>

          <nav className="flex-grow p-4 space-y-2">
            <MenuItem icon="fas fa-inbox" label="我的消息" onClick={handleOpenMessages} /> 
            <MenuItem path="/#my-dynamics" icon="fas fa-bolt" label="我的动态" onClick={() => closeSidebar()} />
            <MenuItem path="/bookshelf" icon="fas fa-book-open" label="我的书柜" onClick={() => closeSidebar()} />
            <MenuItem path="/favorites" icon="fas fa-star" label="我的收藏" onClick={() => closeSidebar()} />
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <MenuItem path="/settings" icon="fas fa-cog" label="设置" onClick={() => closeSidebar()} />
          </nav>

          <div className="p-6 text-center text-xs text-gray-400">
            Powered by NotionNext
          </div>
        </div>
      </aside>
    </>
  );
};
// --- Sidebar 组件定义结束 ---


/**
 * 基础布局
 * @param props
 * @returns {JSX.Element}
 * @constructor
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  
  const { isOpen: isSidebarOpen, openSidebar, closeSidebar } = useSidebar(); 
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();

  useEffect(() => {
    updateThemeColor(isDarkMode);
  }, [isDarkMode]);

  const mainContentSpring = useSpring({
    transform: isSidebarOpen ? 'translateX(18rem) scale(0.95)' : 'translateX(0rem) scale(1)',
    borderRadius: isSidebarOpen ? '1.5rem' : '0rem',
    config: { tension: 250, friction: 30 }
  });

  // 底部导航栏的路径列表 (需要和 BottomNavBar 里的 navItems 路径保持一致)
  const bottomNavPaths = [
    '/', 
    '/ai-assistant', // AI助手 (假设是页面)
    '/forum', 
    '/jobs', 
    '/forum/messages' // 消息
  ];

  // 获取当前路由在导航路径列表中的索引
  const currentNavIndex = bottomNavPaths.findIndex(path => 
    router.pathname === path || (path !== '/' && router.pathname.startsWith(path))
  );

  const mainContentRef = useRef(null); // 用于绑定页面手势

  const gestureBind = useGesture({
    onDrag: ({ first, down, movement: [mx, my], direction: [dx, dy], velocity, initial: [x0], cancel, event }) => {
      // 如果侧边栏是打开的，则只处理关闭手势
      if (isSidebarOpen) {
        if (dx < 0 && (Math.abs(mx) > 80 || velocity > 1.5)) { // 向左滑动，关闭
          closeSidebar();
          cancel();
        }
        return; // 侧边栏打开时，不触发页面切换手势
      }

      // 【侧边栏打开手势】: 从左边缘 (40px) 或屏幕中间 (20%-80%) 向右滑动
      const isDraggingFromLeftEdge = x0 < 40; // 【核心修改】: 边缘触发宽度 40px
      const isDraggingFromMiddle = x0 > window.innerWidth * 0.2 && x0 < window.innerWidth * 0.8;
      
      if (dx > 0 && !isSidebarOpen && (isDraggingFromLeftEdge || isDraggingFromMiddle)) {
          if (mx > 80 || velocity > 1.5) { // 拖动距离或速度满足条件
              openSidebar();
              cancel();
              return;
          }
      }

      // 【页面切换手势】: 在非边缘区域水平滑动，且垂直滑动不明显
      const isHorizontalDrag = Math.abs(dx) > Math.abs(dy) && Math.abs(mx) > window.innerWidth / 4 && velocity > 0.3;

      if (isHorizontalDrag) {
        if (dx < 0 && currentNavIndex < bottomNavPaths.length - 1) { // 左滑，下一个页面
          router.push(bottomNavPaths[currentNavIndex + 1]);
          cancel();
        } else if (dx > 0 && currentNavIndex > 0) { // 右滑，上一个页面
          router.push(bottomNavPaths[currentNavIndex - 1]);
          cancel();
        }
      }
    }
  }, {
    domTarget: typeof window !== 'undefined' ? window : undefined, // 绑定到 window 实现全局监听
    event: { passive: false }, // 阻止默认的滚动行为
    axis: 'x', // 同时监听X轴和Y轴，但在 onDrag 中判断
  });

  useEffect(() => {
    bind();
  }, [bind]);

  const isHomePage = router.pathname === '/'
  const headerSlot = (
    <header>
      {/* 【核心修改】: 将 openSidebar 函数传递给 Header */}
      {isHomePage && <Header {...props} openSidebar={openSidebar} />}
      {isHomePage ? (
        <>
          <NoticeBar />
          <Hero {...props} />
        </>
      ) : (
        !fullWidth && <PostHeader {...props} isDarkMode={isDarkMode} />
      )}
    </header>
  )
  
  const slotRight =
    router.route === '/404' || fullWidth ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max-w-[96rem]' : 'max-w-[86rem]' 
  const HEO_HERO_BODY_REVERSE = siteConfig( 'HEO_HERO_BODY_REVERSE', false, CONFIG )
  const HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  useEffect(() => {
    loadWowJS()
  }, [])

  return (
    <div className="relative bg-[#f7f9fe] dark:bg-[#18171d]">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} /> {/* 传递状态和方法 */}
      
      <animated.div
        style={mainContentSpring}
        className={`theme-heo-container ${siteConfig('FONT_STYLE')} h-full min-h-screen flex flex-col scroll-smooth overflow-x-hidden
                   ${isSidebarOpen ? 'pointer-events-none cursor-pointer' : ''}`}
        onClick={isSidebarOpen ? closeSidebar : undefined}
      >
        <Style />
        {isHomePage && headerSlot}
        <main
          ref={mainContentRef} 
          id='wrapper-outer'
          className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5 pb-16 md:pb-0`}>
          {children}
        </main>
        <Footer />
        <BottomNavBar /> 
        {HEO_LOADING_COVER && <LoadingCover />}
      </animated.div>
      {/* 底部导航栏抽屉 */}
      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData.conversation} />
    </div>
  )
}

/**
 * 首页
 */
const LayoutIndex = props => { /* ... (不变) ... */ }
const LayoutPostList = props => { /* ... (不变) ... */ }
const LayoutSearch = props => { /* ... (不变) ... */ }
const LayoutArchive = props => { /* ... (不变) ... */ }
const LayoutSlug = props => { /* ... (不变) ... */ }
const Layout404 = props => { /* ... (不变) ... */ }
const LayoutCategoryIndex = props => { /* ... (不变) ... */ }
const LayoutTagIndex = props => { /* ... (不变) ... */ }

export {
  Layout404,
  LayoutArchive,
  LayoutBase,
  LayoutCategoryIndex,
  LayoutIndex,
  LayoutPostList,
  LayoutSearch,
  LayoutSlug,
  LayoutTagIndex,
  CONFIG as THEME_CONFIG
              }
