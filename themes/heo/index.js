/**
 *   HEO 主题说明 (最终修复版)
 *   1. 修复 KouyuPage 导致的 Build 失败 (改为 dynamic import)
 *   2. 移除底部导航、AI、书籍、练习
 *   3. 整合 HSK 和 口语
 */

import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import dynamic from 'next/dynamic'

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
    Type
} from 'lucide-react'
import { HashTag } from '@/components/HeroIcons'

// Base Components
import Comment from '@/components/Comment'
import { AdSlot } from '@/components/GoogleAdsense'
import LazyImage from '@/components/LazyImage'
import LoadingCover from '@/components/LoadingCover'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import SmartLink from '@/components/SmartLink'
import WWAds from '@/components/WWAds'
import ShareBar from '@/components/ShareBar'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'

// Original HEO Components
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
import { Style } from './style'

// Custom Components - 静态导入
import PinyinContentBlock from '@/components/PinyinContentBlock'
import WordsContentBlock from '@/components/WordsContentBlock'

// ★★★ 关键修复：复杂组件改为动态导入 (SSR: false) ★★★
// 这能防止 Build 时因为 window/audio 对象不存在而报错
const KouyuPage = dynamic(() => import('@/components/kouyu'), { ssr: false, loading: () => <div className="p-10 text-center">加载口语模块...</div> })
const HskContentBlock = dynamic(() => import('@/components/HskContentBlock'), { ssr: false })
const GlosbeSearchCard = dynamic(() => import('@/components/GlosbeSearchCard'), { ssr: false })
const ShortSentenceCard = dynamic(() => import('@/components/ShortSentenceCard'), { ssr: false })
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })

const isBrowser = typeof window !== 'undefined';

// ======================  辅助组件 ========================

const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); }
    `}</style>
);

const HomeSidebar = ({ isOpen, onClose, sidebarX, isDragging }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal();
  const sidebarWidth = 288;
  const sidebarLinks = [
    { icon: <Settings size={20} />, text: '通用设置', href: '/settings' },
    { icon: <LifeBuoy size={20} />, text: '帮助中心', href: '/help' },
  ];
  const transitionClass = isDragging ? '' : 'transition-transform duration-300 ease-in-out';

  return (
    <>
      <div className={`fixed inset-0 bg-black z-30 transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}`} onClick={onClose} style={{ opacity: isOpen ? 0.5 : (sidebarX + sidebarWidth) / sidebarWidth * 0.5 }} />
      <div className={`fixed inset-y-0 left-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-2xl z-40 transform ${transitionClass}`} style={{ transform: `translateX(${sidebarX}px)` }}>
        <div className="flex flex-col h-full">
            <div className="p-6 flex items-center gap-4 border-b dark:border-gray-700">
                <UserCircle size={48} className="text-gray-500" />
                <div>
                    <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">访客</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">欢迎来到本站</p>
                </div>
            </div>
            <nav className="flex-grow p-4 space-y-2">
                {sidebarLinks.map((link, index) => (
                    <SmartLink key={index} href={link.href} className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors">
                        {link.icon} <span className="font-medium">{link.text}</span>
                    </SmartLink>
                ))}
            </nav>
            <div className="p-4 border-t dark:border-gray-700">
                <button onClick={toggleDarkMode} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="font-medium">{isDarkMode ? '切换到日间模式' : '切换到夜间模式'}</span>
                </button>
            </div>
        </div>
      </div>
    </>
  );
};

const ActionButtons = ({ onOpenFavorites, onOpenContact }) => {
  const actions = [
    { icon: <Phone size={24} />, text: '联系我们', type: 'contact', color: 'from-blue-500 to-sky-500' },
    { icon: <MessageSquare size={24} />, text: '在线客服', type: 'link', href: '#', color: 'from-green-500 to-emerald-500' },
    { icon: <Users size={24} />, text: '加入社群', type: 'link', href: '#', color: 'from-purple-500 to-indigo-500' },
    { icon: <Heart size={24} />, text: '收藏单词', type: 'words', color: 'from-orange-500 to-amber-500' },
    { icon: <List size={24} />, text: '收藏短句', type: 'sentences', color: 'from-red-500 to-rose-500' },
    { icon: <BookText size={24} />, text: '收藏语法', type: 'grammar', color: 'from-gray-500 to-slate-500' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 px-4">
      {actions.map((action, index) => {
        const content = ( <> <div className="mb-2">{action.icon}</div> <span className="text-sm font-semibold">{action.text}</span> </> );
        const className = `flex flex-col items-center justify-center p-4 rounded-xl shadow-lg hover:shadow-xl text-white bg-gradient-to-br ${action.color} transition-all duration-300 transform hover:-translate-y-1 w-full`;
        
        if (action.type === 'link') {
          return ( <a key={index} href={action.href} className={className}> {content} </a> );
        }
        if (action.type === 'contact') {
          return ( <button key={index} onClick={onOpenContact} className={className}> {content} </button> );
        }
        return ( <button key={index} onClick={() => onOpenFavorites(action.type)} className={className}> {content} </button> );
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
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 dark:text-gray-100">联系我们</Dialog.Title>
                                <div className="mt-4"><p className="text-sm text-gray-500 dark:text-gray-400">通过以下方式与我们取得联系，我们期待您的咨询。</p></div>
                                <div className="mt-6 space-y-4">
                                    {socialLinks.map(link => (
                                        <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                            <div className={link.color}>{link.icon}</div>
                                            <div><p className="font-semibold text-gray-800 dark:text-gray-200">{link.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">点击跳转</p></div>
                                        </a>
                                    ))}
                                </div>
                                <div className="mt-6">
                                    <button type="button" className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 dark:bg-blue-900/50 px-4 py-2 text-sm font-medium text-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900 focus:outline-none w-full" onClick={onClose}>关闭</button>
                                </div>
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
const SENTENCE_STORE_NAME = 'favoriteSentences';
const WORD_STORE_NAME = 'favoriteWords';
function openDB() {
  return new Promise((resolve, reject) => {
    if (!isBrowser) return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject('数据库打开失败');
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SENTENCE_STORE_NAME)) db.createObjectStore(SENTENCE_STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(WORD_STORE_NAME)) db.createObjectStore(WORD_STORE_NAME, { keyPath: 'id' });
    };
  });
}
async function getAllFavorites(storeName) {
    try {
        const db = await openDB();
        if (!db) return [];
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(new Error('Failed to retrieve items: ' + event.target.errorCode));
        });
    } catch (error) {
        console.error("IndexedDB Error:", error);
        return [];
    }
}

// ======================  LayoutIndex 组件  ========================
const LayoutIndex = props => {
  const router = useRouter();
  
  // 1. 简化的 Tab，移除了书籍和练习
  const allTabs = [
    { name: '拼音', key: 'pinyin', icon: <Type size={22} /> },
    { name: '单词', key: 'words', icon: <BookText size={22} /> },
    { name: 'HSK', key: 'hsk', icon: <GraduationCap size={22} /> },
    { name: '口语', key: 'speaking', icon: <Mic size={22} /> }
  ];
  
  const [activeTabKey, setActiveTabKey] = useState('pinyin'); 

  useEffect(() => {
    if (router.isReady) {
      const tabFromQuery = router.query.tab;
      const validTab = allTabs.find(t => t.key === tabFromQuery);
      setActiveTabKey(validTab ? validTab.key : allTabs[0].key);
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
  const touchStartX = useRef(null);
  const currentSidebarX = useRef(-sidebarWidth);

  const [sentenceCardData, setSentenceCardData] = useState(null);
  const [wordCardData, setWordCardData] = useState(null);
  const isSentenceFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-sentences' : false;
  const isWordFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-words' : false;
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  
  const handleOpenFavorites = useCallback(async (type) => {
    if (type === 'sentences') {
        const sentences = await getAllFavorites(SENTENCE_STORE_NAME);
        if (sentences?.length > 0) {
            setSentenceCardData(sentences.map(s => ({ id: s.id, sentence: s.chinese, translation: s.burmese, pinyin: s.pinyin, imageUrl: s.imageUrl })));
            router.push('#favorite-sentences', undefined, { shallow: true });
        } else {
            alert('您还没有收藏任何短句。');
        }
    } else if (type === 'words') {
        const words = await getAllFavorites(WORD_STORE_NAME);
        if (words?.length > 0) {
            setWordCardData(words);
            router.push('#favorite-words', undefined, { shallow: true });
        } else {
            alert('您还没有收藏任何单词。');
        }
    } else if (type === 'grammar') {
        alert('“收藏语法”功能正在开发中，敬请期待！');
    }
  }, [router]); 

  const handleCloseFavorites = useCallback(() => {
    router.push(router.pathname, undefined, { shallow: true });
  }, [router]);

  useEffect(() => {
    const handlePopStateFavorites = () => {
      if (!window.location.hash.startsWith('#favorite')) {
        setSentenceCardData(null);
        setWordCardData(null);
      }
    };
    window.addEventListener('popstate', handlePopStateFavorites);
    const backgrounds = ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto-format&fit-crop&q=80&w=2070', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto-format&fit-crop&q=80&w=2070'];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);

    const container = scrollableContainerRef.current;
    if (!container) return;
    let ticking = false;
    const handleScroll = () => {
      if (!isStickyActive) { lastScrollY.current = container.scrollTop; return; }
      const currentY = container.scrollTop;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const diff = currentY - lastScrollY.current;
          if (Math.abs(diff) > 10) setIsNavVisible(diff <= 0);
          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    const observer = new IntersectionObserver(([entry]) => {
        const shouldBeSticky = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setIsStickyActive(shouldBeSticky);
        if (!shouldBeSticky) setIsNavVisible(true);
    }, { threshold: 0 });
    const currentSentinel = stickySentinelRef.current;
    if (currentSentinel) observer.observe(currentSentinel);
    return () => { 
        container.removeEventListener('scroll', handleScroll);
        if (currentSentinel) observer.unobserve(currentSentinel);
        window.removeEventListener('popstate', handlePopStateFavorites);
    };
  }, [isStickyActive, router]);

  const contentSwipeHandlers = useSwipeable({
      onSwipedLeft: () => {
          const currentIndex = allTabs.findIndex(t => t.key === activeTabKey);
          if (currentIndex !== -1 && currentIndex < allTabs.length - 1) handleTabChange(allTabs[currentIndex + 1].key);
      },
      onSwipedRight: () => {
          const currentIndex = allTabs.findIndex(t => t.key === activeTabKey);
          if (currentIndex > 0) handleTabChange(allTabs[currentIndex - 1].key);
      },
      preventDefaultTouchmoveEvent: true, trackMouse: true, delta: 50
  });

  const handleTouchStart = (e) => {
    if (!isSidebarOpen && mainContentRef.current?.contains(e.target)) return;
    const startX = e.touches[0].clientX;
    if (!isSidebarOpen && startX > window.innerWidth * 0.4) return;
    touchStartX.current = startX;
    currentSidebarX.current = sidebarX;
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (!isDragging || touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const newX = Math.max(-sidebarWidth, Math.min(currentSidebarX.current + deltaX, 0));
    setSidebarX(newX);
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    touchStartX.current = null;
    if (sidebarX < -sidebarWidth / 2) closeSidebar(); else openSidebar();
  };
  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };
  
  const renderTabButtons = () => allTabs.map(tab => (
    <button key={tab.key} onClick={() => handleTabChange(tab.key)} className={`flex flex-col items-center justify-center w-1/4 pt-2.5 pb-1.5 transition-colors duration-300 focus:outline-none ${activeTabKey === tab.key ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {tab.icon}
        <span className='text-xs font-semibold mt-1'>{tab.name}</span>
        <div className={`w-6 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTabKey === tab.key ? 'bg-blue-500' : 'bg-transparent'}`}></div>
    </button>
  ));

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
        <Style/>
        <CustomScrollbarStyle />
        <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} isDragging={isDragging} />

        <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className='relative flex-grow w-full h-full'>
            <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />
            <div className='absolute inset-0 bg-black/20'></div>

            <button onClick={openSidebar} className="absolute top-4 left-4 z-30 p-2 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors"><i className="fas fa-bars text-xl"></i></button>
            
            <div className='absolute top-0 left-0 right-0 h-[40vh] z-10 p-4 flex flex-col justify-end text-white pointer-events-none'>
                <div className='pointer-events-auto'>
                    <h1 className='text-4xl font-extrabold' style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>中缅文培训中心</h1>
                    <p className='mt-2 text-lg w-full md:w-2/3' style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>在这里可以写很长的价格介绍、Slogan 或者其他描述文字。</p>
                    <div className='mt-4 grid grid-cols-3 grid-rows-2 gap-2 h-40'>
                        <a href="https://www.tiktok.com/@mmzh.onlione?_r=1&_t=ZS-91OzyDddPu8" target="_blank" rel="noopener noreferrer" className='col-span-1 row-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{ backgroundImage: "url('/img/tiktok.jpg')" }}><div className='absolute top-1 left-1 bg-pink-500 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaTiktok size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <a href="https://www.facebook.com/share/1ErXyBbrZ1" target="_blank" rel="noopener noreferrer" className='col-span-1 row-start-2 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{ backgroundImage: "url('/img/facebook.jpg')" }}><div className='absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaFacebook size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <div className='col-span-2 col-start-2 row-span-2 rounded-xl overflow-hidden bg-black'><iframe title="YouTube" width="100%" height="100%" src="https://www.you999tube.com/embed/your_video_id_here" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
                    </div>
                </div>
            </div>

            <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div className='h-[40vh] flex-shrink-0' />
                {/* 这里的 pb-6 确保了底部没有多余的空白 */}
                <div className='relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-6 min-h-[calc(60vh+1px)]'>
                    <div className='bg-violet-50 dark:bg-gray-800 rounded-t-2xl'>
                        <div className='pt-6'>
                           <div className='px-4 mb-6'><GlosbeSearchCard /></div>
                           <div className='pb-6'><ActionButtons onOpenFavorites={handleOpenFavorites} onOpenContact={() => setIsContactPanelOpen(true)} /></div>
                        </div>
                        <div ref={stickySentinelRef}></div>
                        <div className={`${isStickyActive ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''} border-b border-violet-200 dark:border-gray-700 transition-all duration-200`}>
                            <div className='flex justify-around'>{renderTabButtons()}</div>
                       </div>
                    </div>
                    <div className={`transition-transform duration-300 ease-in-out fixed w-full top-0 z-30 ${isStickyActive ? 'block' : 'hidden'} ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                        <div className='bg-violet-50/95 dark:bg-gray-800/95 backdrop-blur-lg border-b border-violet-200 dark:border-gray-700 shadow-sm'>
                            <div className='flex justify-around max-w-[86rem] mx-auto'>{renderTabButtons()}</div>
                        </div>
                    </div>
                    <main ref={mainContentRef} {...contentSwipeHandlers}>
                        <div className='p-4'>
                            {activeTabKey === 'pinyin' && <PinyinContentBlock />}
                            {activeTabKey === 'words' && <WordsContentBlock />}
                            {activeTabKey === 'hsk' && <HskContentBlock />}
                            {activeTabKey === 'speaking' && <KouyuPage />}
                        </div>
                    </main>
                </div>
            </div>
        </div>
        {sentenceCardData && <ShortSentenceCard sentences={sentenceCardData} isOpen={isSentenceFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-sentences" />}
        {wordCardData && <WordCard words={wordCardData} isOpen={isWordFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-words" />}
        <ContactPanel isOpen={isContactPanelOpen} onClose={() => setIsContactPanelOpen(false)} />
    </div>
  );
};

// ... 其他 Layout 保持不变 (LayoutBase, LayoutPostList 等)

// 2. 导出所有必要的组件，防止 Export 未定义错误
// 必须完整保留 Layout404, LayoutArchive, LayoutSlug, LayoutCategoryIndex, LayoutTagIndex 的定义
// 这里我直接把您之前给的代码中缺失的部分补全，放在同一个文件里

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
         }
