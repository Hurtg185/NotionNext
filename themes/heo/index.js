// themes/heo/index.js (JSX闭合修复后的最终版)

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
import { useEffect, useState, createContext, useContext } from 'react'
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
import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'
import { animated, useSpring } from '@react-spring/web'
import { useGesture } from '@use-gesture/react'

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

// --- 【核心修改】: 创建 Sidebar 组件 (现在它是一个内部组件) ---
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

// 【核心修改】: Sidebar 组件现在接收 isOpen 和 closeSidebar 作为 props
const Sidebar = ({ isOpen, closeSidebar }) => {
  const { user } = useAuth();
  const router = useRouter();

  const handleOpenMessages = () => {
    closeSidebar();
    router.push('/forum/messages');
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
            <MenuItem path="/#my-dynamics" icon="fas fa-bolt" label="我的动态" onClick={closeSidebar} />
            <MenuItem path="/bookshelf" icon="fas fa-book-open" label="我的书柜" onClick={closeSidebar} />
            <MenuItem path="/favorites" icon="fas fa-star" label="我的收藏" onClick={closeSidebar} />
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <MenuItem path="/settings" icon="fas fa-cog" label="设置" onClick={closeSidebar} />
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
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  
  // 5. 将侧边栏状态管理移入 LayoutBase 内部
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    updateThemeColor(isDarkMode);
  }, [isDarkMode]);

  // 6. 使用 react-spring 创建主内容区的动画
  const mainContentSpring = useSpring({
    transform: isSidebarOpen ? 'translateX(18rem) scale(0.95)' : 'translateX(0rem) scale(1)', // 18rem = w-72
    borderRadius: isSidebarOpen ? '1.5rem' : '0rem',
    config: { tension: 250, friction: 30 }
  });

  // 7. 绑定手势
  const bind = useGesture({
    onDrag: ({ first, down, movement: [mx], direction: [dx], velocity, initial: [x0], cancel }) => {
      // 允许从左边缘开始拖动（用于打开）
      const isDraggingFromLeftEdge = x0 < 80; // 【更新】从屏幕左侧 80px 范围内开始
      // 允许从屏幕中间大部分区域向右滑动（用于打开）
      const isDraggingFromMiddle = x0 > window.innerWidth * 0.2 && x0 < window.innerWidth * 0.8;
      
      // 如果侧边栏是打开的，则允许从任何地方向左滑动关闭
      const isDraggingToClose = isSidebarOpen && dx < 0;

      // 如果手势开始时不在有效触发区域，且侧边栏未打开，则忽略
      if (first && !isSidebarOpen && !isDraggingFromLeftEdge && !isDraggingFromMiddle) {
        return;
      }

      // 如果是向右滑动 (打开侧边栏)
      if (dx > 0) {
        if (!isSidebarOpen && (isDraggingFromLeftEdge || isDraggingFromMiddle) && (mx > 80 || velocity > 1.5)) { 
          openSidebar();
          cancel();
        }
      } 
      // 如果是向左滑动 (关闭侧边栏)
      else if (dx < 0 && isSidebarOpen) {
        if (Math.abs(mx) > 80 || velocity > 1.5) {
          closeSidebar();
          cancel();
        }
      }
    }
  }, {
    domTarget: typeof window !== 'undefined' ? window : undefined, // 绑定到 window 实现全局监听
    event: { passive: false }, // 阻止默认的滚动行为
    axis: 'x', // 只关心水平方向的拖动
  });

  useEffect(() => {
    bind();
  }, [bind]);

  const isHomePage = router.pathname === '/'
  const headerSlot = (
    <header>
      {/* 8. 将 openSidebar 函数传递给 Header */}
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
  const maxWidth = fullWidth ? 'max-w-[96rem]' : 'max-w-[86rem]' // Changed mx-auto to auto
  const HEO_HERO_BODY_REVERSE = siteConfig( 'HEO_HERO_BODY_REVERSE', false, CONFIG )
  const HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  useEffect(() => {
    loadWowJS()
  }, [])

  return (
    <div className="relative bg-[#f7f9fe] dark:bg-[#18171d]">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} /> {/* 将 isOpen 和 closeSidebar 传递给 Sidebar */}
      
      <animated.div
        style={mainContentSpring}
        className={`theme-heo-container ${siteConfig('FONT_STYLE')} h-full min-h-screen flex flex-col scroll-smooth overflow-x-hidden
                   ${isSidebarOpen ? 'pointer-events-none cursor-pointer' : ''}`}
        onClick={isSidebarOpen ? closeSidebar : undefined}
      >
        <Style />
        {isHomePage && headerSlot}
        <main
          id='wrapper-outer'
          className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5 pb-16 md:pb-0`}>
          <div
            id='container-inner'
            className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
            <div className={`w-full h-auto ${className || ''}`}>
              {!isHomePage && <PostHeader {...props} isDarkMode={isDarkMode} />}
              {slotTop}
              {children}
            </div>
            <div className='lg:px-2'></div>
            <div className='hidden xl:block'>
              {slotRight}
            </div>
          </div>
        </main>
        <Footer />
        <BottomNavBar /> 
        {HEO_LOADING_COVER && <LoadingCover />}
      </animated.div>
    </div>
  )
}

/**
 * 首页
 */
const LayoutIndex = props => {
  return (
    <div id='post-outer-wrapper' className='px-5 md:px-0'>
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  )
}

/**
 * 博客列表
 */
const LayoutPostList = props => {
  return (
    <div id='post-outer-wrapper' className='px-5  md:px-0'>
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  )
}

/**
 * 搜索
 */
const LayoutSearch = props => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s

  useEffect(() => {
    if (currentSearch) {
      setTimeout(() => {
        replaceSearchResult({
          doms: document.getElementsByClassName('replace'),
          search: currentSearch,
          target: {
            element: 'span',
            className: 'text-red-500 border-b border-dashed'
          }
        })
      }, 100)
    }
  }, [])
  return (
    <div currentSearch={currentSearch}>
      <div id='post-outer-wrapper' className='px-5  md:px-0'>
        {!currentSearch ? (
          <SearchNav {...props} />
        ) : (
          <div id='posts-wrapper'>
            {siteConfig('POST_LIST_STYLE') === 'page' ? (
              <BlogPostListPage {...props} />
            ) : (
              <BlogPostListScroll {...props} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 归档
 */
const LayoutArchive = props => {
  const { archivePosts } = props
  const hasArchivePosts = archivePosts && typeof archivePosts === 'object' && Object.keys(archivePosts).length > 0;

  return (
    <div className='p-5 rounded-xl border dark:border-gray-600 max-w-6xl w-full bg-white dark:bg-[#1e1e1e]'>
      <CategoryBar {...props} border={false} />
      <div className='px-3'>
        {hasArchivePosts ? (
          Object.keys(archivePosts).map(archiveTitle => (
            <BlogPostArchive
              key={archiveTitle}
              posts={archivePosts[archiveTitle]}
              archiveTitle={archiveTitle}
            />
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">没有找到相关的归档文章</div>
        )}
      </div>
    </div>
  )
}

/**
 * 文章详情
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { locale, fullWidth } = useGlobal()
  const [hasCode, setHasCode] = useState(false)

  useEffect(() => {
    const hasCode = document.querySelectorAll('[class^="language-"]').length > 0
    setHasCode(hasCode)
  }, [])

  const commentEnable =
    siteConfig('COMMENT_TWIKOO_ENV_ID') ||
    siteConfig('COMMENT_WALINE_SERVER_URL') ||
    siteConfig('COMMENT_VALINE_APP_ID') ||
    siteConfig('COMMENT_GISCUS_REPO') ||
    siteConfig('COMMENT_CUSDIS_APP_ID') ||
    siteConfig('COMMENT_UTTERRANCES_REPO') ||
    siteConfig('COMMENT_GITALK_CLIENT_ID') ||
    siteConfig('COMMENT_WEBMENTION_ENABLE')

  const router = useRouter()
  const waiting404 = siteConfig('POST_WAITING_TIME_FOR_404') * 1000
  useEffect(() => {
    if (!post) {
      setTimeout(
        () => {
          if (isBrowser) {
            const article = document.querySelector(
              '#article-wrapper #notion-article'
            )
            if (!article) {
              router.push('/404').then(() => {
                console.warn('找不到页面', router.asPath)
              })
            }
          }
        },
        waiting404
      )
    }
  }, [post])
  return (
    <>
      <div
        className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xl'} ${hasCode ? 'xl:w-[73.15vw]' : ''}  bg-white dark:bg-[#18171d] dark:border-gray-600 lg:hover:shadow lg:border rounded-2xl lg:px-2 lg:py-4 `}>
        {lock && <PostLock validPassword={validPassword} />}
        {!lock && post && (
          <div className='mx-auto md:w-full md:px-5'>
            <article
              itemScope
              itemType='https://schema.org/Movie'>
              <section
                className='wow fadeInUp p-5 justify-center mx-auto'
                data-wow-delay='.2s'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>
              <PostAdjacent {...props} />
              <ShareBar {...props} /> 
              {post?.type === 'Post' && (
                <div className='px-5'>
                  <PostCopyright {...props} />
                  <PostRecommend {...props} />
                </div>
              )}
            </article>
            {fullWidth ? null : (
              <div className={`${commentEnable && post ? '' : 'hidden'}`}>
                <hr className='my-4 border-dashed' />
                <div className='py-2'>
                  <AdSlot />
                </div>
                <div className='duration-200 overflow-x-auto px-5'>
                  <div className='text-2xl dark:text-white'>
                    <i className='fas fa-comment mr-1' />
                    {locale.COMMON.COMMENTS}
                  </div>
                  <Comment frontMatter={post} className='' />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <FloatTocButton {...props} />
    </>
  )
}

/**
 * 404
 */
const Layout404 = props => {
  const { onLoading, fullWidth } = useGlobal()
  return (
    <>
      <main
        id='wrapper-outer'
        className={`flex-grow ${fullWidth ? '' : 'max-w-4xl'} w-screen mx-auto px-5`}>
        <div id='error-wrapper' className={'w-full mx-auto justify-center'}>
          <Transition
            show={!onLoading}
            appear={true}
            enter='transition ease-in-out duration-700 transform order-first'
            enterFrom='opacity-0 translate-y-16'
            enterTo='opacity-100'
            leave='transition ease-in-out duration-300 transform'
            leaveFrom='opacity-100 translate-y-0'
            leaveTo='opacity-0 -translate-y-16'
            unmount={false}>
            <div className='error-content flex flex-col md:flex-row w-full mt-12 h-[30rem] md:h-96 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-3xl'>
              <LazyImage
                className='error-img h-60 md:h-full p-4'
                src={
                  'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'
                }></LazyImage>
              <div className='error-info flex-1 flex flex-col justify-center items-center space-y-4'>
                <h1 className='error-title font-extrabold md:text-9xl text-7xl dark:text-white'>
                  404
                </h1>
                <div className='dark:text-white'>请尝试站内搜索寻找文章</div>
                <SmartLink href='/'>
                  <button className='bg-blue-500 py-2 px-4 text-white shadow rounded-lg hover:bg-blue-600 hover:shadow-md duration-200 transition-all'>
                    回到主页
                  </button>
                </SmartLink>
              </div>
            </div>
            <div className='mt-12'>
              <LatestPostsGroup {...props} />
            </div>
          </Transition>
        </div>
      </main>
    </>
  )
}

/**
 * 分类列表
 */
const LayoutCategoryIndex = props => {
  const { categoryOptions } = props
  const { locale } = useGlobal()
  return (
    <div id='category-outer-wrapper' className='mt-8 px-5 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>
        {locale.COMMON.CATEGORY}
      </div>
      <div
        id='category-list'
        className='duration-200 flex flex-wrap m-10 justify-center'>
        {categoryOptions?.map(category => {
          return (
            <SmartLink
              key={category.name}
              href={`/category/${category.name}`}
              passHref
              legacyBehavior>
              <div
                className={
                  'group mr-5 mb-5 flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'
                }>
                <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />
                {category.name}
                <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>
                  {category.count}
                </div>
              </div>
            </SmartLink>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 标签列表
 */
const LayoutTagIndex = props => {
  const { tagOptions } = props
  const { locale } = useGlobal()
  return (
    <div id='tag-outer-wrapper' className='px-5 mt-8 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>
        {locale.COMMON.TAGS}
      </div>
      <div
        id='tag-list'
        className='duration-200 flex flex-wrap space-x-5 space-y-5 m-10 justify-center'>
        {tagOptions.map(tag => {
          return (
            <SmartLink
              key={tag.name}
              href={`/tag/${tag.name}`}
              passHref
              legacyBehavior>
              <div
                className={
                  'group flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'
                }>
                <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />
                {tag.name}
                <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>
                  {tag.count}
                </div>
              </div>
            </SmartLink>
          )
        })}
      </div>
    </div>
  )
}

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
