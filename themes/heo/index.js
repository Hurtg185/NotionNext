/**
 *   HEO 主题说明
 *  > 此版本已将首页改为你提供的“磨砂玻璃+抽屉侧栏+课程卡片+底部导航”样式，
 *  > 并保留 NotionNext 主题其余页面布局逻辑。
 */

// React & Next.js
import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'

// Plugins / Global
import { loadWowJS } from '@/lib/plugins/wow'
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'

// Icons
import {
  BookOpen,
  BookText,
  ChevronRight,
  Compass,
  FileText,
  Globe,
  Globe2,
  Layers3,
  Library,
  Lightbulb,
  Menu,
  MessageCircle,
  Mic,
  Music2,
  Star,
  Users,
  Volume2,
  X
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
import PostAdjacent from './components/PostAdjacent'
import PostCopyright from './components/PostCopyright'
import PostHeader from './components/PostHeader'
import { PostLock } from './components/PostLock'
import PostRecommend from './components/PostRecommend'
import SearchNav from './components/SearchNav'
import { Style } from './style'

// =================================================================================
// ======================  公共样式  ========================
// =================================================================================

const CustomScrollbarStyle = () => (
  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar {
      width: 0px;
      height: 0px;
    }
    .custom-scrollbar {
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
    }

    body {
      background-color: #0f172a;
    }
  `}</style>
)

// =================================================================================
// ======================  首页配置数据  ========================
// =================================================================================

const PINYIN_NAV = [
  { zh: '声母', mm: 'ဗျည်း', icon: Mic, href: '/pinyin/initials', bg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { zh: '韵母', mm: 'သရ', icon: Music2, href: '/pinyin/finals', bg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { zh: '整体', mm: 'အသံတွဲ', icon: Layers3, href: '/pinyin/syllables', bg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { zh: '声调', mm: 'အသံ', icon: FileText, href: '/pinyin/tones', bg: 'bg-orange-100', iconColor: 'text-orange-600' }
]

const CORE_TOOLS = [
  { zh: 'AI 翻译', mm: 'AI ဘာသာပြန်', icon: Globe, href: '/translator', bg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  { zh: '免费书籍', mm: 'စာကြည့်တိုက်', icon: Library, href: '/library', bg: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  { zh: '单词收藏', mm: 'မှတ်ထားသော စာလုံး', icon: Star, href: '/words', bg: 'bg-slate-200', iconColor: 'text-slate-700' },
  { zh: '口语收藏', mm: 'မှတ်ထားသော စကားပြော', icon: Volume2, href: '/spoken?filter=favorites', bg: 'bg-slate-200', iconColor: 'text-slate-700' }
]

const SYSTEM_COURSES = [
  {
    badge: 'Words',
    sub: '词汇 (VOCABULARY)',
    title: '日常高频词汇',
    mmDesc: 'အခြေခံ စကားလုံးများကို လေ့လာပါ。',
    zhDesc: '掌握生活与考试中最核心的词汇',
    bgImg: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1200',
    href: '/course/words'
  },
  {
    badge: 'Spoken',
    sub: '口语 (ORAL)',
    title: '地道汉语口语',
    mmDesc: 'နေ့စဉ်သုံး စကားပြောဆိုမှုများကို လေ့ကျင့်ပါ。',
    zhDesc: '跟读与练习最纯正的日常交流口语',
    bgImg: 'https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&q=80&w=1200',
    href: '/spoken'
  },
  {
    badge: 'HSK 1',
    sub: '入门 (INTRO)',
    title: 'HSK 1',
    mmDesc: 'အသုံးအများဆုံး စကားလုံးများနှင့် သဒ္ဒါ',
    zhDesc: '掌握最常用词语和基本语法',
    bgImg: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=1200',
    href: '/hsk/1'
  }
]

const SIDEBAR_LINKS = [
  { label: '首页', href: '/' },
  { label: 'HSK 课程', href: '/hsk/1' },
  { label: '免费书籍', href: '/library' },
  { label: '设置', href: '/settings' }
]

const DRAWER_WIDTH = 288

// =================================================================================
// ======================  新首页布局（替换版）  ========================
// =================================================================================

const LayoutIndex = props => {
  const router = useRouter()

  const [backgroundUrl, setBackgroundUrl] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerX, setDrawerX] = useState(-DRAWER_WIDTH)
  const [dragging, setDragging] = useState(false)

  const touchStartX = useRef(0)
  const startDrawerX = useRef(-DRAWER_WIDTH)

  useEffect(() => {
    const backgrounds = [
      '/images/home-bg.jpg',
      'https://images.unsplash.com/photo-1543165796-5426273eaec3?q=80&w=2070',
      'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=2072'
    ]
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)])
  }, [])

  const openDrawer = () => {
    setDrawerOpen(true)
    setDrawerX(0)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerX(-DRAWER_WIDTH)
  }

  const handleTouchStart = e => {
    const startX = e.touches?.[0]?.clientX ?? 0
    if (!drawerOpen && startX > 24) return
    touchStartX.current = startX
    startDrawerX.current = drawerX
    setDragging(true)
  }

  const handleTouchMove = e => {
    if (!dragging) return
    const currentX = e.touches?.[0]?.clientX ?? 0
    const deltaX = currentX - touchStartX.current
    const nextX = Math.max(-DRAWER_WIDTH, Math.min(0, startDrawerX.current + deltaX))
    setDrawerX(nextX)
  }

  const handleTouchEnd = () => {
    if (!dragging) return
    setDragging(false)
    if (drawerX > -DRAWER_WIDTH * 0.55) openDrawer()
    else closeDrawer()
  }

  const drawerVisible = drawerOpen || dragging || drawerX > -DRAWER_WIDTH
  const overlayOpacity = Math.max(0, Math.min(0.5, ((drawerX + DRAWER_WIDTH) / DRAWER_WIDTH) * 0.5))

  const glassCard =
    'rounded-2xl border border-white/80 bg-white/94 backdrop-blur-2xl shadow-[0_10px_26px_rgba(15,23,42,0.12)]'
  const glassCardHover = `${glassCard} transition-all duration-200 hover:bg-white/97`

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-[#0f172a] flex justify-center overflow-hidden`}>
      <Style />
      <CustomScrollbarStyle />

      <div
        className='relative w-full max-w-md h-full overflow-hidden text-slate-900'
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 背景层 */}
        <div className='absolute inset-0 -z-20 bg-cover bg-center' style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none' }} />
        <div className='absolute inset-0 -z-10 bg-black/26' />
        <div className='absolute inset-0 -z-10 bg-white/14 backdrop-blur-[12px]' />
        <div
          className='absolute inset-0 -z-10'
          style={{
            background:
              'radial-gradient(circle at 18% 8%, rgba(255,255,255,0.18), transparent 34%), radial-gradient(circle at 92% 0%, rgba(59,130,246,0.16), transparent 30%)'
          }}
        />

        {/* 侧边抽屉 */}
        <div className={`absolute inset-0 z-40 ${drawerVisible ? '' : 'pointer-events-none'}`}>
          <div className='absolute inset-0 bg-black transition-opacity duration-200' style={{ opacity: overlayOpacity }} onClick={closeDrawer} />
          <aside
            className={`absolute inset-y-0 left-0 w-72 border-r border-white/70 bg-white/96 backdrop-blur-3xl shadow-2xl ${
              dragging ? '' : 'transition-transform duration-300 ease-out'
            }`}
            style={{ transform: `translateX(${drawerX}px)` }}
          >
            <div className='flex items-center justify-between p-5'>
              <div>
                <p className='text-xs font-semibold text-slate-500'>菜单</p>
                <h2 className='mt-1 text-xl font-black text-slate-800'>中缅文学习中心</h2>
              </div>
              <button type='button' onClick={closeDrawer} aria-label='关闭菜单' className='rounded-lg p-1 text-slate-500 hover:bg-slate-100'>
                <X className='h-5 w-5' />
              </button>
            </div>

            <nav className='space-y-1 px-3'>
              {SIDEBAR_LINKS.map(item => (
                <button
                  key={item.href}
                  type='button'
                  onClick={() => {
                    router.push(item.href)
                    closeDrawer()
                  }}
                  className='w-full text-left rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100'
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>

        {/* 主内容 */}
        <div className='relative z-10 h-full overflow-y-auto custom-scrollbar px-4 pb-24 pt-3'>
          <header className='mb-4 flex items-center gap-3 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]'>
            <button type='button' onClick={openDrawer} aria-label='打开菜单' className='p-0.5'>
              <Menu className='h-7 w-7' />
            </button>
            <div>
              <h1 className='text-[18px] font-black leading-none'>中缅文学习中心</h1>
              <p className='mt-1 text-[11px] text-white/90'>Chinese Learning Hub</p>
            </div>
          </header>

          <section className='grid grid-cols-4 gap-3'>
            {PINYIN_NAV.map(item => (
              <SmartLink key={item.zh} href={item.href} className={`${glassCardHover} px-1 py-4`}>
                <div className='flex flex-col items-center gap-2'>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.bg}`}>
                    <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                  </div>
                  <div className='text-center'>
                    <p className='text-[13px] font-bold leading-none text-slate-800'>{item.zh}</p>
                    <p className='mt-1 text-[10px] font-medium leading-none text-slate-500'>{item.mm}</p>
                  </div>
                </div>
              </SmartLink>
            ))}
          </section>

          <section className='mt-4'>
            <SmartLink href='/tips' className={`${glassCardHover} flex items-center justify-between px-4 py-3`}>
              <div className='flex items-center gap-3'>
                <div className='rounded-full bg-orange-100 p-1.5'>
                  <Lightbulb className='h-4 w-4 text-orange-500' />
                </div>
                <div>
                  <p className='text-[14px] font-bold text-slate-800'>发音技巧 (Tips)</p>
                  <p className='text-[11px] text-slate-500'>အသံထွက်နည်းလမ်းများ</p>
                </div>
              </div>
              <ChevronRight className='h-5 w-5 text-slate-400' />
            </SmartLink>
          </section>

          <section className='mt-4 grid grid-cols-2 gap-3'>
            {CORE_TOOLS.map(tool => (
              <SmartLink key={tool.zh} href={tool.href} className={`${glassCardHover} flex items-center gap-3 p-3.5`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tool.bg}`}>
                  <tool.icon className={`h-4 w-4 ${tool.iconColor}`} />
                </div>
                <div className='min-w-0'>
                  <p className='truncate text-[14px] font-bold text-slate-800'>{tool.zh}</p>
                  <p className='mt-0.5 truncate text-[10px] text-slate-500'>{tool.mm}</p>
                </div>
              </SmartLink>
            ))}
          </section>

          <section className='mt-8 pb-6'>
            <div className='mb-3 flex items-center gap-2 px-1'>
              <BookText className='h-4 w-4 text-slate-700' />
              <h2 className='text-[13px] font-bold tracking-wider text-slate-700'>SYSTEM COURSES (သင်ရိုး)</h2>
            </div>

            <div className='flex flex-col gap-4'>
              {SYSTEM_COURSES.map(course => (
                <SmartLink
                  key={course.title}
                  href={course.href}
                  className='group relative block overflow-hidden rounded-3xl border border-white/55 shadow-[0_12px_30px_rgba(2,6,23,0.20)]'
                >
                  <div className='absolute inset-0 bg-slate-800' />
                  <div
                    className='absolute inset-0 bg-cover bg-center opacity-86 transition-transform duration-700 group-hover:scale-105'
                    style={{ backgroundImage: `url(${course.bgImg})` }}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/88 via-black/42 to-transparent' />
                  <div className='relative flex min-h-[170px] flex-col justify-between p-4'>
                    <span className='w-fit rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-slate-800'>{course.badge}</span>
                    <div className='mt-8'>
                      <p className='mb-1 text-[11px] font-bold tracking-widest text-cyan-300'>{course.sub}</p>
                      <h3 className='mb-1.5 text-2xl font-black text-white'>{course.title}</h3>
                      <p className='truncate text-[13px] text-slate-200'>{course.mmDesc}</p>
                      <p className='truncate text-[12px] font-medium text-slate-300'>{course.zhDesc}</p>
                    </div>
                  </div>
                </SmartLink>
              ))}
            </div>
          </section>
        </div>

        {/* 底部导航 */}
        <nav className='absolute bottom-0 left-0 right-0 z-30 mx-auto flex h-14 w-full max-w-md items-center justify-between border-t border-white/80 bg-white/92 px-1 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur-2xl'>
          <a href='https://bbs.886.best/user/mei/chats' className='flex flex-1 flex-col items-center justify-center text-slate-600'>
            <MessageCircle className='h-5 w-5' />
            <span className='mt-0.5 text-[10px] font-semibold'>消息</span>
          </a>
          <a href='https://bbs.886.best' className='flex flex-1 flex-col items-center justify-center text-slate-600'>
            <Globe2 className='h-5 w-5' />
            <span className='mt-0.5 text-[10px] font-semibold'>社区</span>
          </a>
          <a href='https://bbs.886.best/partners' className='flex flex-1 flex-col items-center justify-center text-slate-600'>
            <Users className='h-5 w-5' />
            <span className='mt-0.5 text-[10px] font-semibold'>语伴</span>
          </a>
          <a href='https://bbs.886.best/category/5/%E5%8A%A8%E6%80%81' className='flex flex-1 flex-col items-center justify-center text-slate-600'>
            <Compass className='h-5 w-5' />
            <span className='mt-0.5 text-[10px] font-semibold'>动态</span>
          </a>
          <SmartLink href='/' className='flex flex-1 flex-col items-center justify-center text-indigo-600'>
            <div className='rounded-lg bg-indigo-50 p-1'>
              <BookOpen className='h-5 w-5' />
            </div>
            <span className='mt-0.5 text-[10px] font-semibold'>学习</span>
          </SmartLink>
        </nav>
      </div>
    </div>
  )
}

// =================================================================================
// ====================== 其他页面布局（保持原主题） ========================
// =================================================================================

const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  if (router.route === '/') return <LayoutIndex {...props} />

  const headerSlot = (
    <div className='max-w-md mx-auto w-full'>
      {fullWidth ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </div>
  )

  useEffect(() => {
    loadWowJS()
  }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#0f172a] min-h-screen flex justify-center`}>
      <Style />
      <CustomScrollbarStyle />

      <div className='w-full max-w-md bg-[#f7f9fe] dark:bg-[#18171d] shadow-2xl flex flex-col min-h-screen relative overflow-hidden'>
        {headerSlot}
        <main className={`flex-grow w-full relative px-4 pb-10`}>
          <div className='w-full mx-auto relative z-10'>
            <div className={`w-full h-auto ${className || ''}`}>
              {slotTop}
              {children}
            </div>
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
      {!currentSearch ? (
        <SearchNav {...props} />
      ) : (
        <div id='posts-wrapper'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>
      )}
    </div>
  )
}

const LayoutArchive = props => (
  <div className='p-4 rounded-2xl border dark:border-gray-600 w-full bg-white dark:bg-[#1e1e1e]'>
    <CategoryBar {...props} border={false} />
    <div className='px-1'>
      {Object.keys(props.archivePosts).map(title => (
        <BlogPostArchive key={title} posts={props.archivePosts[title]} archiveTitle={title} />
      ))}
    </div>
  </div>
)

const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const commentEnable = siteConfig('COMMENT_TWIKOO_ENV_ID') || siteConfig('COMMENT_WALINE_SERVER_URL')

  return (
    <>
      <div className='w-full bg-white dark:bg-[#18171d] dark:border-gray-600 rounded-2xl'>
        {lock ? (
          <PostLock validPassword={validPassword} />
        ) : (
          post && (
            <div className='px-4 py-2'>
              <article>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <NotionPage post={post} />
                <ShareBar post={post} />
                <PostCopyright {...props} />
                <PostRecommend {...props} />
                <PostAdjacent {...props} />
              </article>
              {commentEnable && (
                <div className='px-2'>
                  <hr className='my-4 border-dashed' />
                  <Comment frontMatter={post} />
                </div>
              )}
            </div>
          )
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
    <SmartLink href='/'>
      <button className='bg-blue-500 py-2 px-4 text-white rounded-lg mt-4'>回到主页</button>
    </SmartLink>
  </div>
)

const LayoutCategoryIndex = props => (
  <div className='mt-8 px-2'>
    <div className='text-2xl font-extrabold mb-5'>分类</div>
    <div className='flex flex-wrap justify-start'>
      {props.categoryOptions?.map(c => (
        <SmartLink key={c.name} href={`/category/${c.name}`} className='group mr-2 mb-2 flex items-center border bg-white rounded-xl px-3 py-2 text-sm hover:bg-indigo-600 hover:text-white transition-all'>
          <HashTag className='w-4 h-4' />
          {c.name}
          <div className='ml-1 px-1.5 rounded-lg bg-gray-100 group-hover:text-indigo-600 text-xs'>{c.count}</div>
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
          <HashTag className='w-4 h-4' />
          {t.name}
          <div className='ml-1 px-1.5 rounded-lg bg-gray-100 group-hover:text-indigo-600 text-xs'>{t.count}</div>
        </SmartLink>
      ))}
    </div>
  </div>
)

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
