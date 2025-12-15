/**
 *   HEO 主题重置版
 *   已清空所有页面逻辑，保留基础 LayoutBase 框架供重构使用
 */

import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import SideRight from './components/SideRight'
import { NoticeBar } from './components/NoticeBar'
import { Style } from './style'
import LoadingCover from '@/components/LoadingCover'
import CONFIG from './config'

/**
 * 基础布局
 * 负责：Header, Footer, 背景, 侧边栏, 整体容器
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()

  // 加载动画依赖
  useEffect(() => {
    loadWowJS()
  }, [])

  const HEO_HERO_BODY_REVERSE = siteConfig('HEO_HERO_BODY_REVERSE', false, CONFIG)
  const HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  // 顶部区域：导航栏 + (首页Hero/通知)
  const headerSlot = (
    <header>
      <Header {...props} />
      {/* 仅在首页显示 Hero 和 通知栏 */}
      {router.route === '/' && (
        <>
          <NoticeBar />
          <Hero {...props} />
        </>
      )}
    </header>
  )

  // 右侧栏
  const slotRight = (router.route === '/404' || fullWidth) ? null : <SideRight {...props} />
  
  // 宽度控制
  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]'

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />

      {/* 顶部 */}
      {headerSlot}

      {/* 主体内容区 */}
      <main id='wrapper-outer' className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
        <div id='container-inner' className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
          
          {/* 左侧/中间 内容区 */}
          <div className={`w-full h-auto ${className || ''}`}>
            {slotTop}
            {children}
          </div>

          <div className='lg:px-2'></div>

          {/* 右侧边栏 (大屏显示) */}
          <div className='hidden xl:block'>
            {slotRight}
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <Footer />

      {/* 加载动画遮罩 */}
      {HEO_LOADING_COVER && <LoadingCover />}
    </div>
  )
}

/**
 * 首页
 * 当前状态：重置待开发
 */
const LayoutIndex = props => {
  return (
    <div className="p-10 text-center">
      <h2>Index Page (Reset)</h2>
      <p>准备重做</p>
    </div>
  )
}

/**
 * 博客列表页
 * 当前状态：重置待开发
 */
const LayoutPostList = props => {
  return (
    <div className="p-10 text-center">
      <h2>Post List Page (Reset)</h2>
    </div>
  )
}

/**
 * 搜索页
 * 当前状态：重置待开发
 */
const LayoutSearch = props => {
  const { keyword } = props
  return (
    <div className="p-10 text-center">
      <h2>Search Page (Reset)</h2>
      <p>Searching for: {keyword}</p>
    </div>
  )
}

/**
 * 归档页
 * 当前状态：重置待开发
 */
const LayoutArchive = props => {
  return (
    <div className="p-10 text-center">
      <h2>Archive Page (Reset)</h2>
    </div>
  )
}

/**
 * 文章详情页 (Slug)
 * 当前状态：重置待开发
 */
const LayoutSlug = props => {
  const { post } = props
  
  // 如果没有文章数据，通常在加载中
  if (!post) {
      return <div>Loading...</div>
  }

  return (
    <div className="p-10 bg-white dark:bg-[#18171d] rounded-xl">
       <h1 className="text-2xl font-bold mb-4">{post?.title}</h1>
       <div className="text-center py-10 border-2 border-dashed border-gray-300">
          Article Content Area (Reset)
          <br/>
          在此处重新构建文章详情组件
       </div>
    </div>
  )
}

/**
 * 404页
 * 当前状态：重置待开发
 */
const Layout404 = props => {
  return (
    <div className="flex flex-col items-center justify-center h-96">
      <h1 className="text-6xl font-bold">404</h1>
      <p>Page Not Found (Reset)</p>
    </div>
  )
}

/**
 * 分类列表页
 * 当前状态：重置待开发
 */
const LayoutCategoryIndex = props => {
  return (
    <div className="p-10 text-center">
      <h2>Category Index (Reset)</h2>
    </div>
  )
}

/**
 * 标签列表页
 * 当前状态：重置待开发
 */
const LayoutTagIndex = props => {
  return (
    <div className="p-10 text-center">
      <h2>Tag Index (Reset)</h2>
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
