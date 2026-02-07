// React & Next.js
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

// UI & Animation
import { loadWowJS } from '@/lib/plugins/wow'

// Global State & Config
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'
import { useAI } from '@/components/AIConfigContext' // 确保路径正确

// Icons
import {
  GraduationCap,
  UserCircle,
  BookOpen,
  LogIn,
  X
} from 'lucide-react'
import { HashTag } from '@/components/HeroIcons'

// Base Components
import Comment from '@/components/Comment'
import LazyImage from '@/components/LazyImage'
import NotionPage from '@/components/NotionPage'
import SmartLink from '@/components/SmartLink'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import ShareBar from '@/components/ShareBar'

// Theme Components
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
import { Style } from './style'

// Custom Components
import HskContentBlock from '@/components/HskContentBlock'

const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })
const isBrowser = typeof window !== 'undefined'

// =================================================================================
// ======================  辅助组件 & 工具函数  =====================================
// =================================================================================

const CustomScrollbarStyle = () => (
  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
    .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    #theme-heo footer, #theme-heo .footer-wrapper, #theme-heo #footer,
    #theme-heo .subscribe-box, #theme-heo #subscribe-wrapper,
    #theme-heo .busuanzi_container_site_pv, #theme-heo .busuanzi_container_site_uv {
      display: none !important;
    }
    body { background-color: #f7f9fe; }
  `}</style>
)

const GoogleLoginModal = ({ open, onClose }) => {
  const { user, isGoogleLoaded, handleGoogleCallback } = useAI()
  const initializedRef = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) setError('')
  }, [open])

  // Escape 关闭 + 锁滚动
  useEffect(() => {
    if (!open || !isBrowser) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  // 打开弹窗时渲染 Google 按钮
  useEffect(() => {
    if (!open) return
    if (!isBrowser) return
    if (user) return
    if (!isGoogleLoaded) return
    if (!window.google) return

    const container = document.getElementById('google-btn-container-modal')
    if (!container) return

    container.innerHTML = ''

    try {
      if (!initializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setError('')
            const result = await handleGoogleCallback(response)
            if (result?.success) {
              onClose()
            } else {
              setError(result?.error || '登录失败，请重试')
            }
          }
        })
        initializedRef.current = true
      }

      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: '260',
        shape: 'pill'
      })
    } catch (e) {
      console.error('Google button render error:', e)
      setError('登录组件加载失败，请刷新页面重试')
    }
  }, [open, user, isGoogleLoaded, handleGoogleCallback, onClose])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[999] flex items-center justify-center p-5'>
      {/* 浅色遮罩：不使用暗色背景 */}
      <div
        className='absolute inset-0 bg-white/70 backdrop-blur-sm'
        onClick={onClose}
      />

      <div
        role='dialog'
        aria-modal='true'
        className='relative w-full max-w-sm rounded-3xl bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] border border-slate-100 overflow-hidden'
      >
        <div className='px-5 pt-5 pb-4 bg-gradient-to-br from-sky-50 via-white to-indigo-50'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='text-base font-black text-slate-900'>Google 登录</p>
              <p className='text-[12px] text-slate-600 mt-1'>
                一键登录，同步学习进度与解锁等级。
              </p>
            </div>
            <button
              onClick={onClose}
              className='shrink-0 w-9 h-9 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center hover:bg-white'
              aria-label='Close'
            >
              <X size={18} className='text-slate-700' />
            </button>
          </div>

          <div className='mt-4 rounded-2xl bg-white/80 border border-slate-200 p-4'>
            {!isGoogleLoaded && (
              <div className='text-center text-[12px] text-slate-500'>登录组件加载中...</div>
            )}
            <div id='google-btn-container-modal' className='flex justify-center min-h-[44px]' />
            {error && (
              <p className='mt-3 text-[11px] font-bold text-rose-600 text-center'>{error}</p>
            )}
            <p className='mt-3 text-[10px] leading-relaxed text-slate-500'>
              仅用于账号识别与同步学习进度（姓名、头像、邮箱）。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =================================================================================
// ======================  激活码卡片（在白色区里） =================================
// =================================================================================

const ActivationCard = () => {
  const { user, handleActivate, logout } = useAI()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  if (!user) return null

  const onActivateClick = async () => {
    if (!code.trim()) return
    setLoading(true)
    setMsg('')
    const result = await handleActivate(code.trim())
    setLoading(false)

    if (result.success) {
      setMsg(result.message)
      setCode('')
    } else {
      setMsg(result.error || '验证失败')
    }
  }

  return (
    <div className='mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50 p-4 shadow-sm'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-3 min-w-0'>
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt='avatar'
              className='w-9 h-9 rounded-full border border-white shadow-sm'
            />
          ) : (
            <UserCircle size={34} className='text-sky-600' />
          )}
          <div className='min-w-0'>
            <p className='text-sm font-black text-slate-900 truncate'>{user.name}</p>
            <p className='text-[11px] text-sky-700 font-semibold'>
              已解锁: {user.unlocked_levels || '无'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className='px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800'
        >
          退出
        </button>
      </div>

      <div className='mt-3'>
        <label className='text-[10px] font-black text-slate-500 uppercase'>激活码验证</label>
        <div className='mt-2 flex items-center gap-2'>
          <input
            type='text'
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder='格式: H1-JHM-XXXX'
            className='flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none uppercase'
          />
          <button
            onClick={onActivateClick}
            disabled={loading || !code.trim()}
            className='px-4 py-2 rounded-xl bg-sky-600 text-white text-[12px] font-black disabled:opacity-60 hover:bg-sky-700'
          >
            {loading ? '验证中' : '激活'}
          </button>
        </div>
        {msg && (
          <p className='text-[11px] mt-2 font-bold text-slate-700'>{msg}</p>
        )}
      </div>
    </div>
  )
}

// ... (PriceChartDisplay 组件保持不变) ...
const PriceChartDisplay = () => { /* ... */ }

// =================================================================================
// ======================  新主页布局 (手机端强制) ==================================
// =================================================================================

const LayoutIndex = (props) => {
  const router = useRouter()
  const scrollableContainerRef = useRef(null)

  const { user } = useAI()
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  const [wordCardData, setWordCardData] = useState(null)
  const [isWordFavoritesCardOpen, setIsWordFavoritesCardOpen] = useState(false)

  useEffect(() => {
    if (!isBrowser) return
    const syncHash = () => setIsWordFavoritesCardOpen(window.location.hash === '#favorite-words')
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const handleCloseFavorites = useCallback(() => {
    router.push(router.pathname, undefined, { shallow: true })
  }, [router])

  return (
    <div
      id='theme-heo'
      className={`${siteConfig('FONT_STYLE')} min-h-screen w-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 flex justify-center overflow-hidden`}
    >
      <Style />
      <CustomScrollbarStyle />

      <GoogleLoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <div className='relative w-full max-w-md min-h-screen bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)] overflow-hidden border-x border-slate-100'>
        {/* 轻量背景纹理（非暗色） */}
        <div className='absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.10),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.10),transparent_40%)]' />

        <div
          ref={scrollableContainerRef}
          className='relative z-10 min-h-screen overflow-y-auto overscroll-y-contain custom-scrollbar'
        >
          {/* 直接进入白色内容区：无顶部封面区 */}
          <div className='px-4 pt-6 pb-10'>
            <div className='rounded-[28px] bg-white border border-slate-100 shadow-sm overflow-hidden'>
              <div className='p-5 bg-gradient-to-br from-white via-white to-sky-50'>
                <p className='text-[12px] font-black text-slate-500 tracking-wide'>中缅文培训中心</p>
                <p className='mt-1 text-[11px] font-semibold text-slate-600'>专业中缅双语教学，文化与机遇的桥梁。</p>
              </div>

              <div className='px-5 pb-5'>
                <div className='mt-2 mb-4 flex items-center justify-between'>
                  <div>
                    <h2 className='text-lg font-black text-slate-900 flex items-center gap-2'>
                      <GraduationCap size={20} className='text-sky-600' /> HSK 标准课程
                    </h2>
                    <p className='text-[11px] text-slate-500 mt-1 font-semibold'>从零基础到精通，系统化学习汉语。</p>
                  </div>

                  {/* 你要的：登录在白色区标题行右侧；无私信按钮 */}
                  {!user ? (
                    <button
                      onClick={() => setIsLoginOpen(true)}
                      className='px-3 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-black text-[12px] shadow-sm hover:opacity-95 active:scale-95 transition'
                      title='登录'
                    >
                      <span className='inline-flex items-center gap-2'>
                        <LogIn size={16} /> 登录
                      </span>
                    </button>
                  ) : (
                    <div className='px-3 py-2 rounded-2xl bg-slate-100 text-slate-800 font-black text-[12px]'>
                      已登录
                    </div>
                  )}
                </div>

                <ActivationCard />

                <div className='mt-4'>
                  <HskContentBlock />
                </div>

                <div className='mt-6'>
                  <button
                    onClick={() => router.push('/spoken')}
                    className='w-full py-3 rounded-2xl bg-slate-900 text-white font-black'
                  >
                    <span className='inline-flex items-center justify-center gap-2'>
                      <BookOpen size={18} /> 进入口语课程
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {wordCardData && (
          <WordCard
            words={wordCardData}
            isOpen={isWordFavoritesCardOpen}
            onClose={handleCloseFavorites}
            progressKey='favorites-words'
          />
        )}
      </div>
    </div>
  )
}

// =================================================================================
// ====================== 其他页面布局 (保持不变) ===================================
// =================================================================================

const LayoutBase = (props) => {
  const { children, slotTop, className } = props
  const { isDarkMode } = useGlobal()
  const router = useRouter()
  if (router.route === '/') return <LayoutIndex {...props} />

  const headerSlot = (
    <div className='max-w-md mx-auto w-full'>
      <PostHeader {...props} isDarkMode={isDarkMode} />
    </div>
  )

  useEffect(() => { loadWowJS() }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] min-h-screen flex justify-center`}>
      <Style /> <CustomScrollbarStyle />
      <div className='w-full max-w-md bg-[#f7f9fe] dark:bg-[#18171d] shadow-2xl flex flex-col min-h-screen relative overflow-hidden'>
        {headerSlot}
        <main className='flex-grow w-full relative px-4 pb-10'>
          <div className='w-full mx-auto relative z-10'>
            <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}

const LayoutPostList = (props) => { /* ... */ }
const LayoutSearch = (props) => { /* ... */ }
const LayoutArchive = (props) => { /* ... */ }
const LayoutSlug = (props) => { /* ... */ }
const Layout404 = () => { /* ... */ }
const LayoutCategoryIndex = (props) => { /* ... */ }
const LayoutTagIndex = (props) => { /* ... */ }

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
