/**
 * HEO Theme - Stable Full Layout Entry
 * Safe rebuild for Next.js / NotionNext
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'

import Header from './components/Header'
import Footer from './components/Footer'
import SideRight from './components/SideRight'
import { NoticeBar } from './components/NoticeBar'
import { Style } from './style'
import CONFIG from './config'

import LoadingCover from '@/components/LoadingCover'
import SmartLink from '@/components/SmartLink'
import NotionPage from '@/components/NotionPage'
import Comment from '@/components/Comment'
import ShareBar from '@/components/ShareBar'
import FloatTocButton from './components/FloatTocButton'

import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import BlogPostArchive from './components/BlogPostArchive'

import PostAdjacent from './components/PostAdjacent'
import PostRecommend from './components/PostRecommend'
import { PostLock } from './components/PostLock'
import SearchNav from './components/SearchNav'

/* =========================
   基础布局
========================= */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth } = useGlobal()
  const router = useRouter()

  useEffect(() => {
    loadWowJS()
  }, [])

  const showSide = !(router.route === '/404' || fullWidth)

  return (
    <div
      id="theme-heo"
      className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] min-h-screen flex flex-col`}
    >
      <Style />

      <Header {...props} />
      {router.route === '/' && <NoticeBar />}

      <main className="flex-grow w-full max-w-[96rem] mx-auto px-5">
        <div className="flex">
          <div className={`flex-1 ${className || ''}`}>
            {slotTop}
            {children}
          </div>

          {showSide && (
            <aside className="hidden xl:block w-[320px] ml-4">
              <SideRight {...props} />
            </aside>
          )}
        </div>
      </main>

      <Footer />
      {siteConfig('HEO_LOADING_COVER', true, CONFIG) && <LoadingCover />}
    </div>
  )
}

/* =========================
   首页
========================= */
const LayoutIndex = props => {
  return (
    <div className="px-5 md:px-0">
      <section className="py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          Learn Chinese Faster
        </h1>
        <p className="text-gray-500 dark:text-gray-300">
          Pinyin · Grammar · HSK Structured Learning
        </p>

        <div className="mt-10">
          <SmartLink
            href="/category/HSK"
            className="inline-block bg-red-500 text-white px-6 py-3 rounded-full font-bold hover:bg-red-600 transition"
          >
            Start Learning
          </SmartLink>
        </div>
      </section>

      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  )
}

/* =========================
   列表页
========================= */
const LayoutPostList = props => (
  <div className="px-5 md:px-0">
    {siteConfig('POST_LIST_STYLE') === 'page' ? (
      <BlogPostListPage {...props} />
    ) : (
      <BlogPostListScroll {...props} />
    )}
  </div>
)

/* =========================
   搜索页
========================= */
const LayoutSearch = props => {
  const router = useRouter()
  const keyword = props.keyword || router.query?.s

  return (
    <div className="px-5 md:px-0">
      {!keyword ? <SearchNav {...props} /> : <LayoutPostList {...props} />}
    </div>
  )
}

/* =========================
   归档页
========================= */
const LayoutArchive = props => {
  const { archivePosts } = props

  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-xl p-5">
      {Object.keys(archivePosts || {}).map(year => (
        <BlogPostArchive
          key={year}
          archiveTitle={year}
          posts={archivePosts[year]}
        />
      ))}
    </div>
  )
}

/* =========================
   文章页
========================= */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { fullWidth } = useGlobal()

  return (
    <>
      <div
        className={`bg-white dark:bg-[#18171d] rounded-xl p-5 ${
          fullWidth ? '' : 'xl:max-w-5xl mx-auto'
        }`}
      >
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && post && (
          <>
            <NotionPage post={post} />
            <PostAdjacent {...props} />
            <ShareBar post={post} />
            <PostRecommend {...props} />
            <Comment frontMatter={post} />
          </>
        )}
      </div>

      <FloatTocButton {...props} />
    </>
  )
}

/* =========================
   404
========================= */
const Layout404 = () => (
  <div className="h-[70vh] flex flex-col items-center justify-center">
    <h1 className="text-7xl font-black">404</h1>
    <p className="mt-4 text-gray-500">Page Not Found</p>
    <SmartLink
      href="/"
      className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-full"
    >
      Back Home
    </SmartLink>
  </div>
)

export {
  LayoutBase,
  LayoutIndex,
  LayoutPostList,
  LayoutSearch,
  LayoutArchive,
  LayoutSlug,
  Layout404,
  CONFIG as THEME_CONFIG
}
