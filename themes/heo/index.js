/**
 *   HEO 主题定制版 - 中文学习网
 *   Homepage="text-gray-500 dark:text-gray-300 font-medium">{subtitle}</p Redesigned for Chinese Learning (HSK, Pinyin)
 */

import { siteConfig } from '@/lib/>
        </div>
        {/* 装饰圆圈 */}
        <div className="absolute top-0 right-config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'
import { useRouter } from 'next/router'
import { useEffect, useState } from0 w-32 h-32 bg-white/20 rounded-full blur-2xl -mr 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Hero-10 -mt-10 pointer-events-none"></div>
      </div>
    </SmartLink>
 from './components/Hero'
import SideRight from './components/SideRight'
import { NoticeBar } from  )
}

// ==============================================================================
// 页面布局逻辑
// ============================================================================== './components/NoticeBar'
import { Style } from './style'
import LoadingCover from '@/components/Loading

/**
 * 基础布局
 */
const LayoutBase = props => {
  const { children, slotCover'
import CONFIG from './config'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListTop, className } = props
  const { fullWidth } = useGlobal()
  const router = useRouter()

Scroll from './components/BlogPostListScroll'
import SmartLink from '@/components/SmartLink'
import { AdSlot } from '@/components/GoogleAdsense'
import replaceSearchResult from '@/components/Mark'
import SearchNav from './components  useEffect(() => {
    loadWowJS()
  }, [])

  const HEO_HERO_BODY_/SearchNav'
import BlogPostArchive from './components/BlogPostArchive'
import NotionPage from '@/components/NotionPageREVERSE = siteConfig('HEO_HERO_BODY_REVERSE', false, CONFIG)
  const'
import PostAdjacent from './components/PostAdjacent'
import ShareBar from '@/components/ShareBar'
 HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  //import PostCopyright from './components/PostCopyright'
import PostRecommend from './components/PostRecommend'
import Comment from '@/components/Comment'
import { PostLock } from './components/PostLock'
import AISummary 顶部插槽
  const headerSlot = (
    <header>
      <Header {...props} />
      { from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import WWAds from '@/components/WWAds'
import FloatTocButton from './components/FloatTocButton'
import Lazy/* 首页且非全宽模式下，可以显示通知栏 */}
      {router.route === '/' && <NoticeBarImage from '@/components/LazyImage'
import { Transition } from '@headlessui/react'
import LatestPostsGroup from './components/LatestPostsGroup'

/**
 * 基础布局
 * 负责：Header, Footer, 背景 />}
      {/* 注意：我移除了默认的 Hero，因为我们要自己在 LayoutIndex 里写一个更好看的 */}, 侧边栏, 整体容器
 */
const LayoutBase = props => {
  const { children
    </header>
  )

  const slotRight = (router.route === '/404', slotTop, className } = props
  const { fullWidth } = useGlobal()
  const router = useRouter()

 || fullWidth) ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max  useEffect(() => {
    loadWowJS()
  }, [])

  const HEO_HERO_BODY_-w-[96rem] mx-auto' : 'max-w-[86rem]'

  returnREVERSE = siteConfig('HEO_HERO_BODY_REVERSE', false, CONFIG)
  const (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  //7f9fe] dark:bg-[#18171d] h-full min-h-screen 顶部区域：导航栏
  // 注意：如果您想在首页只显示特定的 Hero，可以在这里判断， flex flex-col scroll-smooth`}>
      <Style />
      {headerSlot}
      <main id='wrapper-outer' className={`flex-grow w-full ${maxWidth} mx-auto relative md:px
  // 但为了美观，我们在 LayoutIndex 内部自己写了一个更适合中文学习的 Hero
  -5`}>
        <div id='container-inner' className={`${HEO_HERO_BODY_const headerSlot = (
    <header>
      <Header {...props} />
      {/* 仅REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-在非首页显示通用 Hero，首页我们自定义 */}
      {router.route !== '/' && <NoticeBar />}
    center relative z-10`}>
          <div className={`w-full h-auto ${className || ''</header>
  )

  const slotRight = (router.route === '/404' || full}`}>
            {slotTop}
            {children}
          </div>
          <div className='lg:pxWidth) ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max-w-[9-2'></div>
          <div className='hidden xl:block'>
            {slotRight}
          </div>6rem] mx-auto' : 'max-w-[86rem]'

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe
        </div>
      </main>
      <Footer />
      {HEO_LOADING_COVER && <] dark:bg-[#18171d] h-full min-h-screen flex flex-colLoadingCover />}
    </div>
  )
}

/**
 * 【重做核心】首页 - 学习仪表盘
 scroll-smooth`}>
      <Style />
      {headerSlot}

      <main id='wrapper-outer' className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
 */
const LayoutIndex = props => {
  // 可以在 blog.config.js 里定义 POST_LIST_STYLE        <div id='container-inner' className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-1，或者这里直接写死
  const isPageStyle = siteConfig('POST_LIST_STYLE') === 'page'

0`}>
          <div className={`w-full h-auto ${className || ''}`}>
            {slot  return (
    <div className="px-5 md:px-0 pb-12">
      
Top}
            {children}
          </div>
          <div className='lg:px-2'></div>
          <div className='hidden xl:block'>
            {slotRight}
          </div>
        </div>
            {/* 1. 欢迎区域 & 标语 */}
      <div className="mb-8 mt</main>

      <Footer />
      {HEO_LOADING_COVER && <LoadingCover />}
    </div>
  )
}

/**
 * 【重做】首页 - 中文学习专属设计
 * -4 animate__animated animate__fadeIn">
        <h1 className="text-4xl md:text-包含：Hero区域、HSK导航卡片、功能区、最新文章
 */
const LayoutIndex = props =>5xl font-extrabold text-gray-800 dark:text-gray-100 mb {
  const { locale } = useGlobal()
  
  // HSK 等级配置
  const hsk-2">
          Learn Chinese <span className="text-indigo-600">Faster</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-40Levels = [
    { level: 1, color: 'bg-blue-500', label: 'HSK 1', desc: 'Beginner' },
    { level: 2, color: 'bg-teal0">
          From Pinyin to HSK 6, your ultimate guide to mastering Mandarin.
        </p>
      -500', label: 'HSK 2', desc: 'Basic' },
    { level:</div>

      {/* 2. 核心功能区 (拼音 & 语法) */}
      <div 3, color: 'bg-green-500', label: 'HSK 3', desc: className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
         'Intermediate' },
    { level: 4, color: 'bg-yellow-500', label: 'HSK 4', desc: 'Advanced' },
    { level: 5, color: 'bg-orange<FeatureCard 
          title="Pinyin Chart" 
          subtitle="Interactive Pronunciation Guide" 
          bgClass-500', label: 'HSK 5', desc: 'Fluent' },
    { level: ="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-6, color: 'bg-red-500', label: 'HSK 6', desc: 'blue-900/40 dark:to-blue-800/20 border border-blue-20Master' },
  ]

  return (
    <div id='chinese-learning-home' className='px-2 md:px-0'>
      
      {/* 第一部分：Hero 和 快速入口 (Bento Grid0 dark:border-blue-800"
          href="/tag/pinyin" // 确保你的 Notion 布局) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb 里有 pinyin 标签
        />
        <FeatureCard 
          title="Grammar Wiki" 
          -6 mt-4">
        
        {/* 左侧大卡片：欢迎语 */}
        <divsubtitle="Essential Structures & Rules" 
          bgClass="bg-gradient-to-br from-purple-50 to className="md:col-span-2 bg-white dark:bg-[#1e1e1e] rounded-purple-100 dark:from-purple-900/40 dark:to-purple--xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden800/20 border border-purple-200 dark:border-purple-800" group">
            <div className="relative z-10">
                <h1 className="text-4
          href="/category/Grammar" // 确保你的 Notion 里有 Grammar 分类
        />
      </div>

      xl md:text-5xl font-extrabold text-gray-800 dark:text-white mb-{/* 3. HSK 导航网格 */}
      <div className="mb-10">
        2">
                    Learn Chinese <span className="text-red-500">Fast</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-300 text-lg mb-6<div className="flex items-center justify-between mb-4">
          <h2 className="text-2 max-w-md">
                    Master Pinyin, Grammar, and HSK vocabulary with our structured guides.
                </xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
            <span className="mr-2">📚</span> Select Your Level
          </h2>
          <SmartLink href="/p>
                <SmartLink href="/guide" className="inline-block bg-red-500 text-white px-6 py-3 rounded-full font-bold hover:bg-red-600 transitioncategory/HSK" className="text-sm font-bold text-indigo-500 hover:underline">
            View-colors">
                    Start Learning / 开始学习
                </SmartLink>
            </div>
            {/*  All Levels
          </SmartLink>
        </div>

        <div className="grid grid-cols-2 md装饰背景字 */}
            <div className="absolute -right-4 -bottom-10 text-[10:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* HSK rem] font-serif text-gray-100 dark:text-[#2a2a2a] select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
                1 - Beginner */}
          <HSKCard 
            level="1" label="Beginner" 
            color学
            </div>
        </div>

        {/* 右侧：功能入口 */}
        <div className="grid="bg-emerald-400 dark:bg-emerald-600"
            link="/tag/HSK1 grid-rows-2 gap-4">
            {/* 拼音卡片 */}
            <SmartLink href" 
            icon={<svg className="w-6 h-6 text-white" fill="none" viewBox="/tag/pinyin" className="bg-gradient-to-br from-indigo-500 to-purple="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.82-600 rounded-xl p-6 text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden">
                <div className="font-bold text-2xl">Pinyin / 拼音</div>
                <div className="text-indigo-100 text-sm8a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 ">Pronunciation Guide</div>
                <i className="fas fa-volume-up absolute right-4 bottom-40 11-18 0 9 9 0 0118 0z" text-4xl opacity-20"></i>
            </SmartLink>
            {/* 语法卡片 */}
             /></svg>}
          />
          {/* HSK 2 */}
          <HSKCard 
            level="2<SmartLink href="/tag/grammar" className="bg-white dark:bg-[#1e1e1e" label="Elementary" 
            color="bg-emerald-500 dark:bg-emerald-7] rounded-xl p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all flex flex-col justify-center border-l-4 border-red-500 dark:00"
            link="/tag/HSK2" 
            icon={<svg className="w-6border-red-600">
                <div className="font-bold text-xl text-gray-8 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke00 dark:text-white">Grammar Wiki</div>
                <div className="text-gray-500 dark:="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="Mtext-gray-400 text-sm">Sentence structures & rules</div>
            </SmartLink>
        9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}</div>
      </div>

      {/* 第二部分：HSK 导航条 */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 dark:text
          />
          {/* HSK 3 */}
          <HSKCard 
            level="3-gray-200 mb-4 flex items-center">
           <i className="fas fa-layer" label="Intermediate" 
            color="bg-amber-400 dark:bg-amber-6-group mr-2 text-red-500"></i> HSK Levels
        </h2>
        <div00"
            link="/tag/HSK3" 
            icon={<svg className="w-6 className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap- h-6 text-white" fill="none" viewBox="0 0 24 24" stroke3">
            {hskLevels.map((item) => (
                <SmartLink key={item.="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="Mlevel} href={`/tag/HSK${item.level}`} className="group relative bg-white dark:bg-[#1e1e1e] rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          {/* HSK 4 */}
          <HSKCard 300 border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                    <div className={`absolute top-0 left-0 w-full h-1 rounded-t-
            level="4" label="Upper Int." 
            color="bg-amber-500 dark:bg-amber-700"
            link="/tag/HSK4" 
            icon={<svg classNamexl ${item.color}`}></div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-black text-gray-800 dark:text-gray-100="w-6 h-6 text-white" fill="none" viewBox="0 0 24  group-hover:text-red-500 transition-colors">
                            {item.level}
                        24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2</span>
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-bold mt-1">{item.label}</span>
                        <span className="text-[10px] text-gray} d="M19.428 15.428a2 2 0 00--400 mt-1">{item.desc}</span>
                    </div>
                </SmartLink>
            ))}
1.022-.547l-2.384-.477a6 6         </div>
      </div>

      {/* 第三部分：最新文章列表 */}
      <div className="relative">
         0 00-3.86.517l-.318.158a6 <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-6 0 01-3.86.517L6.05 15.xl font-bold text-gray-800 dark:text-gray-200">
                <i21a2 2 0 00-1.806.547M8  className="fas fa-history mr-2 text-red-500"></i> Latest Updates
            </h2>
4h8l-1 1v5.172a2 2 0 00.            <SmartLink href="/archive" className="text-xs text-gray-500 hover:text-red586 1.414l5 5c1.26 1.26.-500">View All</SmartLink>
         </div>
         
         {/* 复用现有的文章列表组件367 3.414-1.415 3.414H4. */}
         {siteConfig('POST_LIST_STYLE') === 'page' ? (
            <BlogPostListPage828c-1.782 0-2.674-2.154 {...props} />
          ) : (
            <BlogPostListScroll {...props} />
          )}
      -1.414-3.414l5-5A2 2 0 0</div>
    </div>
  )
}

/**
 * 博客列表页 (分类/标签页 复用)
 */
const LayoutPostList = props => {
  return (
    <div id='post-outer-wrapper09 10.172V5L8 4z" /></svg>}
          />
          {/* HSK 5 */}
          <HSKCard 
            level="5" label="Advanced' className='px-5 md:px-0'>
      {siteConfig('POST_LIST_STYLE')" 
            color="bg-rose-400 dark:bg-rose-600"
 === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPost            link="/tag/HSK5" 
            icon={<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477ListScroll {...props} />
      )}
    </div>
  )
}

/**
 * 搜索页
 */
const LayoutSearch = props => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s

  useEffect(() => {
    if (currentSearch) 9.246 5 7.5 5S4.168 5.4 {
      setTimeout(() => {
        replaceSearchResult({
          doms: document.getElementsByClassName('replace'),
          search: currentSearch,
          target: {
            element: 'span',
            className: 'text-red-500 border-b border-dashed'
          }
        })
      }, 77 3 6.253v13C4.168 18.477100)
    }
  }, [currentSearch])

  return (
    <div currentSearch={currentSearch}>
      <div id='post-outer-wrapper' className='px-5 md:px-0'> 5.754 18 7.5 18s3.332.4
        {!currentSearch ? (
          <SearchNav {...props} />
        ) : (
          <77 4.5 1.253m0-13C13.168div id='posts-wrapper'>
            {siteConfig('POST_LIST_STYLE') === 'page' ? (
              <BlogPostListPage {...props} />
            ) : (
              <BlogPostListScroll {...props} 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          />
          {/* HSK 6 */}
          <HSKCard 
            level="6" label="Master" 
            color="bg-rose-500 dark:bg-rose-700"
            link="/tag/HSK6" 
            icon={<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
Linecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8 * 归档页
 */
const LayoutArchive = props => {
  const { archivePosts } = props
  return (
    <div className='p-5 rounded-xl border dark:border-gray-6a2 2 0 012-2h14a2 2 0 012 00 max-w-6xl w-full bg-white dark:bg-[#1e1e1e]'>
      <div className='px-3'>
        {Object.keys(archivePosts).map(archiveTitle => (
          <BlogPostArchive
            key={archiveTitle}
            posts={archivePosts[archiveTitle]}
            archiveTitle={archiveTitle}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 文章详情页
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { locale, fullWidth } = useGlobal()
  const [hasCode, setHasCode] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const hasCode = document.querySelectorAll('[class^="language-"]').length > 0
    setHasCode(hasCode)
  }, [])

  useEffect(() => {
    if (!post) {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const article = document.querySelector('#article-wrapper #not2v8M3 21h18M3 21l8-8 8 8Mion-article')
          if (!article) {
            router.push('/404')
          }
3 21v-8a2 2 0 012-2h14a2         }
      }, 5000)
    }
  }, [post])

  const commentEnable = siteConfig('COMMENT_TWIKOO_ENV_ID') || siteConfig('COMMENT_WALINE_SERVER_URL2 0 012 2v8" /></svg>}
          />
        </div>
      </div>')

  return (
    <>
      <div className={`article h-full w-full ${fullWidth

      {/* 4. 最新课程 (原文章列表) */}
      <div id='recent-posts ? '' : 'xl:max-w-5xl'} ${hasCode ? 'xl:w-[73' className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-4.15vw]' : ''} bg-white dark:bg-[#18171d] dark: md:p-8 border border-gray-100 dark:border-gray-800 shadow-smborder-gray-600 lg:hover:shadow lg:border rounded-2xl lg:px-2">
        <div className="flex items-center mb-6">
          <div className="w-2 lg:py-4 `}>
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && h-8 bg-indigo-600 rounded-full mr-3"></div>
          <h2 className=" post && (
          <div className='mx-auto md:w-full md:px-5'>
text-2xl font-bold dark:text-white m-0">Latest Lessons</h2>
        </div>
        
            <article id='article-wrapper' itemScope itemType='https://schema.org/Article'>
              <section className='wow fadeInUp p-5 justify-center mx-auto' data-wow-delay='.2s'>        {/* 调用文章列表组件 */}
        {isPageStyle ? (
          <BlogPostListPage {...props}
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary />
        ) : (
          <BlogPostListScroll {...props} />
        )}
      </div>

    } />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' /></div>
  )
}

/**
 * 博客列表 (Categories/Tags/Archives 仍需使用)
 */
              </section>

              <PostAdjacent {...props} />
              <ShareBar post={post} />
              
const LayoutPostList = props => {
  return (
    <div id='post-outer-wrapper
              {post?.type === 'Post' && (
                <div className='px-5'>
                  ' className='px-5 md:px-0'>
      <CategoryBar {...props} />
      {<PostCopyright {...props} />
                  <PostRecommend {...props} />
                </div>
              )}
            siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} /></article>

            {fullWidth ? null : (
              <div className={`${commentEnable && post ? ''
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  ) : 'hidden'}`}>
                <hr className='my-4 border-dashed' />
                <div className
}

/**
 * 搜索页
 */
const LayoutSearch = props => {
  const { keyword='py-2'><AdSlot /></div>
                <div className='duration-200 overflow-x- } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s

auto px-5'>
                  <div className='text-2xl dark:text-white'>
                    <  return (
    <div className='px-5 md:px-0'>
      <div className="bg-white dark:bg-[#1e1e1e] p-5 rounded-xl border dark:border-i className='fas fa-comment mr-1' />
                    {locale.COMMON.COMMENTS}
                  </div>
                  <Comment frontMatter={post} className='' />
                </div>
              </div>
            )}
          gray-700 mb-5">
        <h2 className="text-2xl font-bold mb</div>
        )}
      </div>
      <FloatTocButton {...props} />
    </>
  )-2 dark:text-white">Search: <span className="text-indigo-500">{currentSearch}</span></h2>
}

/**
 * 404 页
 */
const Layout404 = props => {
  const {
      </div>
      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div> onLoading, fullWidth } = useGlobal()
  return (
    <main id='wrapper-outer' className
  )
}

/**
 * 归档页
 */
const LayoutArchive = props => {
={`flex-grow ${fullWidth ? '' : 'max-w-4xl'} w-screen mx-auto  const { archivePosts } = props
  import BlogPostArchive from './components/BlogPostArchive' // 动态引入或确保顶部引入

  return (
    <div className='p-5 rounded-xl border dark:border-gray px-5`}>
      <div id='error-wrapper' className={'w-full mx-auto justify-600 max-w-6xl w-full bg-white dark:bg-[#1e1e-center'}>
        <Transition
          show={!onLoading}
          appear={true}
          enter1e]'>
      <CategoryBar {...props} border={false} />
      <div className='px-3'>
        {Object.keys(archivePosts).map(archiveTitle => (
          <BlogPostArchive
            key='transition ease-in-out duration-700 transform order-first'
          enterFrom='opacity-0 translate-y-16'
          enterTo='opacity-100'
          leave='transition ease-in-out duration-300 transform'
          leaveFrom='opacity-100 translate-y-0'
          leaveTo='opacity-0 -translate-y-16'
          unmount={false}
        >
          <div className='error-content flex flex-col md:flex-row w-full mt-12 h-[30rem] md:h-96 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-3xl'>
            <LazyImage className='error-img h-60 md:h-full p-4' src={'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'} />
            <div className='error-info flex-1 flex flex-col justify-center items-center space-y-4'>
              <h1 className='error-title font-extrabold md:text-9xl text-7xl dark:text-white'>404</h1>
              <div className='dark:text-white'>Please try searching within the site</div>
              <SmartLink href='/'>
                <button className='bg-blue-500 py-2 px-4 text-white shadow rounded-lg hover:bg-blue-600 transition-all'>
                  Back Home
                </button>
              </SmartLink>
            </div>
          </div>
          <div className='mt={archiveTitle}
            posts={archivePosts[archiveTitle]}
            archiveTitle={archiveTitle}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 文章详情页 (恢复-12'>
            <LatestPostsGroup {...props} />
          </div>
        </Transition>
      原有逻辑)
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { fullWidth } = useGlobal()
  const [hasCode, setHasCode] = useState(false)
  const router = useRouter()

  // 引入需要的组件
  const PostLock</div>
    </main>
  )
}

/**
 * 分类列表页
 */
const Layout = require('./components/PostLock').PostLock
  const NotionPage = require('@/components/NotionPage').default
  const ShareBar = require('@/components/ShareBar').default
  const Comment = require('@/components/Comment').default
  const PostAdjacent = require('./components/PostAdjacent').default
  const PostCopyright =CategoryIndex = props => {
  const { categoryOptions } = props
  const { locale } = useGlobal require('./components/PostCopyright').default
  const PostRecommend = require('./components/PostRecommend').default
  const FloatTocButton = require('./components/FloatTocButton').default
  const ArticleExpirationNotice = require('@/components/ArticleExpirationNotice').default

  useEffect(() => {
    const hasCode = document.querySelectorAll('[class^="language-"]').length > 0
    setHasCode(hasCode)
    
    if (!post) {()
  return (
    <div id='category-outer-wrapper' className='mt-8 px-5 md
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const article = document.querySelector('#not:px-0'>
      <div className='text-4xl font-extrabold dark:text-ion-article')
          if (!article) router.push('/404')
        }
      },gray-200 mb-5'>{locale.COMMON.CATEGORY}</div>
      <div id='category- 5000)
    }
  }, [post])

  return (
    <>
      <divlist' className='duration-200 flex flex-wrap m-10 justify-center'>
        {categoryOptions?.map(category => (
          <SmartLink key={category.name} href={`/category/${ className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xlcategory.name}`} passHref legacyBehavior>
            <div className='group mr-5 mb-5 flex items'} ${hasCode ? 'xl:w-[73.15vw]' : ''} bg-white dark-center border bg-white text-2xl rounded-xl px-4 cursor-pointer py-3 hover:text-:bg-[#18171d] dark:border-gray-600 lg:hover:shadowwhite hover:bg-red-500 transition-all'>
              {category.name}
              <div lg:border rounded-2xl lg:px-2 lg:py-4`}>
        {lock && <PostLock validPassword={validPassword} />}
        
        {!lock && post && (
          <div className='mx-auto className='bg-[#f1f3f8] ml-2 px-2 rounded-lg text-sm group-hover:text-red-500'>{category.count}</div>
            </div>
          </SmartLink>
 md:w-full md:px-5'>
            <article id='article-wrapper' className="animate        ))}
      </div>
    </div>
  )
}

/**
 * 标签列表页
 */
__animated animate__fadeIn">
              <div className="p-5 justify-center mx-auto">
                 const LayoutTagIndex = props => {
  const { tagOptions } = props
  const { locale } =<ArticleExpirationNotice post={post} />
                 <NotionPage post={post} />
              </div>
 useGlobal()
  return (
    <div id='tag-outer-wrapper' className='px-5              <PostAdjacent {...props} />
              <ShareBar post={post} />
              <div className=' mt-8 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>{locale.COMMON.TAGS}</div>
      <px-5'>
                 <PostCopyright {...props} />
                 <PostRecommend {...props} />
              div id='tag-list' className='duration-200 flex flex-wrap space-x-5 space</div>
            </article>
            <div className='px-5 py-5'>
               <Comment frontMatter-y-5 m-10 justify-center'>
        {tagOptions.map(tag => (
={post} />
            </div>
          </div>
        )}
      </div>
      <FloatTocButton {...props          <SmartLink key={tag.name} href={`/tag/${tag.name}`} passHref legacyBehavior>} />
    </>
  )
}

/**
 * 404页
 */
const
            <div className='group flex items-center border bg-white text-xl rounded-xl px-4 cursor-pointer py-3 hover:text-white hover:bg-red-500 transition-all'> Layout404 = props => {
  return (
    <div className="flex flex-col items-center justify-
              {tag.name}
              <div className='bg-[#f1f3f8] ml-center h-96 text-center">
      <h1 className="text-8xl font-black text-2 px-2 rounded-lg text-sm group-hover:text-red-500'>{tag.gray-200 dark:text-gray-700">404</h1>
      <p classNamecount}</div>
            </div>
          </SmartLink>
        ))}
      </div>
    </div>
  )="text-xl font-bold text-gray-600 dark:text-gray-300 mt
}

export {
  Layout404,
  LayoutArchive,
  LayoutBase,
  Layout-4">Lesson Not Found</p>
      <SmartLink href="/" className="mt-8 px-6CategoryIndex,
  LayoutIndex,
  LayoutPostList,
  LayoutSearch,
  LayoutSlug, py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-70
  LayoutTagIndex,
  CONFIG as THEME_CONFIG
    }
