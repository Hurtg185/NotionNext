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
import { useAI } from '@/components/AIConfigContext'

// Icons
import {
  GraduationCap,
  UserCircle,
  BookOpen,
  LogIn,
  X,
  MessageCircle,
  MessageSquare,
  Activity
} from 'lucide-react'

// Base Components
import Comment from '@/components/Comment'
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

// SSR 安全兜底，避免 useAI() 为 undefined 时解构报错
const AI_SAFE = {
  user: null,
  isGoogleLoaded: false,
  handleGoogleCallback: async () => ({ success: false, error: 'AI not ready' }),
  handleActivate: async () => ({ success: false, error: 'AI not ready' }),
  logout: () => {}
}

const CustomScrollbarStyle = () => (
  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
    .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    #theme-heo.heo-home footer,
    #theme-heo.heo-home .footer-wrapper,
    #theme-heo.heo-home #footer,
    #theme-heo.heo-home .subscribe-box,
    #theme-heo.heo-home #subscribe-wrapper,
    #theme-heo.heo-home .busuanzi_container_site_pv,
    #theme-heo.heo-home .busuanzi_container_site_uv {
      display: none !important;
    }
  `}</style>
)

const GoogleLoginModal = ({ open, onClose }) => {
  const ai = useAI() || AI_SAFE
  const user = ai.user || null
  const isGoogleLoaded = !!ai.isGoogleLoaded
  const handleGoogleCallback = ai.handleGoogleCallback || AI_SAFE.handleGoogleCallback

  const initializedRef = useRef(false)
  const modalRef = useRef(null)
  const closeBtnRef = useRef(null)
  const lastActiveRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) setError('')
  }, [open])

  useEffect(() => {
    if (!open || !isBrowser) return

    lastActiveRef.current = document.activeElement

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        )
        if (!focusables.length) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement

        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeBtnRef.current?.focus?.(), 0)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      lastActiveRef.current?.focus?.()
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open || !isBrowser || user) return

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      setError('缺少 NEXT_PUBLIC_GOOGLE_CLIENT_ID，无法使用 Google 登录')
      return
    }

    if (!isGoogleLoaded || !window.google) return

    const container = document.getElementById('google-btn-container-modal')
    if (!container) return
    container.replaceChildren()

    try {
      if (!initializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              setError('')
              const result = await handleGoogleCallback(response)
              if (result?.success) onClose()
              else setError(result?.error || '登录失败，请重试')
            } catch (err) {
              setError('登录失败，请重试')
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
      <div className='absolute inset-0 bg-white/70 backdrop-blur-sm' onClick={onClose} />
      <div
        ref={modalRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='google-login-title'
        aria-describedby='google-login-desc'
        className='relative w-full max-w-sm rounded-3xl bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] border border-slate-100 overflow-hidden'
      >
        <div className='px-5 pt-5 pb-4 bg-gradient-to-br from-sky-50 via-white to-indigo-50'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p id='google-login-title' className='text-base font-black text-slate-900'>Google 登录</p>
              <p id='google-login-desc' className='text-[12px] text-slate-600 mt-1'>
                一键登录，同步学习进度与解锁等级。
              </p>
            </div>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              className='shrink-0 w-9 h-9 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center'
              aria-label='关闭登录弹窗'
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

const ActivationCard = () => {
  const ai = useAI() || AI_SAFE
  const user = ai.user || null
  const handleActivate = ai.handleActivate || AI_SAFE.handleActivate
  const logout = ai.logout || AI_SAFE.logout

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')

  if (!user) return null

  const onActivateClick = async () => {
    if (!code.trim()) return
    setLoading(true)
    setMsg('')
    setMsgType('')

    try {
      const result = await handleActivate(code.trim())
      if (result?.success) {
        setMsg(result.message || '激活成功')
        setMsgType('success')
        setCode('')
      } else {
        setMsg(result?.error || '验证失败')
        setMsgType('error')
      }
    } catch (e) {
      setMsg('网络异常，请稍后重试')
      setMsgType('error')
    } finally {
      setLoading(false)
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
          className='px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[12px] font-bold'
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
            className='px-4 py-2 rounded-xl bg-sky-600 text-white text-[12px] font-black disabled:opacity-60'
          >
            {loading ? '验证中' : '激活'}
          </button>
        </div>
        {msg && (
          <p className={`text-[11px] mt-2 font-bold ${msgType === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  )
}

const PriceChartDisplay = () => null

const HOME_DOCK_ITEMS = [
  { key: 'chat', label: '消息', href: 'https://bbs1.886.best/user/hurt/chats/1', icon: MessageCircle },
  { key: 'forum', label: '论坛', href: 'https://bbs1.886.best/unread', icon: MessageSquare },
  { key: 'feed', label: '动态', href: 'https://bbs1.886.best/groups/%E6%9C%8B%E5%8F%8B%E5%9C%88', icon: Activity },
  { key: 'study', label: '学习', href: 'https://886.best', icon: GraduationCap }
]

const MobileHomeDock = () => {
  return (
    <nav className='fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]'>
      <div className='grid grid-cols-4 rounded-2xl border border-slate-200/80 bg-white/92 backdrop-blur-xl shadow-[0_14px_36px_rgba(15,23,42,.16)]'>
        {HOME_DOCK_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.key === 'study'
          return (
            <a
              key={item.key}
              href={item.href}
              className={`flex min-h-[62px] flex-col items-center justify-center gap-1 ${
                active ? 'text-sky-600' : 'text-slate-500'
              }`}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span className='text-[11px] font-black'>{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}

const LayoutIndex = (props) => {
  const router = useRouter()
  const ai = useAI() || AI_SAFE
  const user = ai.user || null

  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [wordCardData, setWordCardData] = useState(null)
  const [isWordFavoritesCardOpen, setIsWordFavoritesCardOpen] = useState(false)

  useEffect(() => {
    if (!isBrowser) return
    setIsWordFavoritesCardOpen(router.asPath.includes('#favorite-words'))
  }, [router.asPath])

  const handleCloseFavorites = useCallback(() => {
    const base = router.asPath.split('#')[0]
    router.replace(base, undefined, { shallow: true })
    setIsWordFavoritesCardOpen(false)
  }, [router])

  return (
    <div
      id='theme-heo'
      className={`${siteConfig('FONT_STYLE')} heo-home min-h-screen w-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 flex justify-center overflow-hidden`}
    >
      <Style />
      <CustomScrollbarStyle />
      <GoogleLoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <div className='relative w-full max-w-md min-h-screen bg-white border-x border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.14)] overflow-hidden'>
        <div className='absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.08),transparent_42%)]' />

        <div className='relative z-10 min-h-screen overflow-y-auto overscroll-y-contain custom-scrollbar'>
          <div className='px-4 pt-6 pb-28'>
            <div className='rounded-[24px] border border-slate-100 bg-white shadow-sm'>
              <main className='p-5'>
                <div className='mb-4 flex items-center justify-between gap-3'>
                  <div>
                    <h2 className='text-lg font-black text-slate-900 flex items-center gap-2'>
                      <GraduationCap size={20} className='text-sky-600' /> HSK 标准课程
                    </h2>
                    <p className='text-[11px] text-slate-500 mt-1 font-semibold'>
                      从零基础到精通，系统化学习汉语。
                    </p>
                  </div>

                  {!user ? (
                    <button
                      onClick={() => setIsLoginOpen(true)}
                      className='shrink-0 px-3 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-black text-[12px] shadow-sm active:scale-95 transition'
                      title='登录'
                    >
                      <span className='inline-flex items-center gap-2'>
                        <LogIn size={16} /> 登录
                      </span>
                    </button>
                  ) : (
                    <div className='shrink-0 px-3 py-2 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-[12px] font-black'>
                      <span className='inline-flex items-center gap-1.5'>
                        <UserCircle size={15} /> 已登录
                      </span>
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

                <PriceChartDisplay />
              </main>
            </div>
          </div>
        </div>

        <MobileHomeDock />

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

const LayoutBase = (props) => {
  const { children, slotTop, className } = props
  const router = useRouter()

  useEffect(() => {
    loadWowJS()
  }, [])

  if (router.route === '/') return <LayoutIndex {...props} />

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] min-h-screen flex justify-center`}>
      <Style />
      <CustomScrollbarStyle />
      <div className='w-full max-w-md bg-[#f7f9fe] dark:bg-[#18171d] shadow-2xl flex flex-col min-h-screen relative overflow-hidden'>
        <Header {...props} hideAccountButtonOnHome={false} />
        <main className='flex-grow w-full relative px-4 pb-10 pt-16'>
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

const LayoutPostList = (props) => {
  return (
    <div className='pt-4'>
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page'
        ? <BlogPostListPage {...props} />
        : <BlogPostListScroll {...props} />}
    </div>
  )
}

const LayoutSearch = (props) => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s

  return (
    <div className='pt-4'>
      {!currentSearch
        ? <SearchNav {...props} />
        : (siteConfig('POST_LIST_STYLE') === 'page'
            ? <BlogPostListPage {...props} />
            : <BlogPostListScroll {...props} />)}
    </div>
  )
}

const LayoutArchive = (props) => {
  const { archivePosts } = props
  return (
    <div className='pt-4 rounded-2xl border border-slate-100 bg-white p-4'>
      {Object.keys(archivePosts || {}).map((archiveTitle) => (
        <BlogPostArchive
          key={archiveTitle}
          posts={archivePosts[archiveTitle]}
          archiveTitle={archiveTitle}
        />
      ))}
    </div>
  )
}

const LayoutSlug = (props) => {
  const { post, lock, validPassword } = props
  const router = useRouter()

  useEffect(() => {
    const waiting404 = Number(siteConfig('POST_WAITING_TIME_FOR_404', 3, CONFIG)) * 1000
    if (post) return

    const timer = setTimeout(() => {
      if (isBrowser) {
        const article = document.querySelector('#article-wrapper #notion-article')
        if (!article) {
          router.push('/404').catch(() => {})
        }
      }
    }, waiting404)

    return () => clearTimeout(timer)
  }, [post, router])

  return (
    <div className='pt-4'>
      <PostHeader {...props} />
      <div className='rounded-2xl border border-slate-100 bg-white p-3 mt-3'>
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && post && (
          <>
            <article id='article-wrapper' className='subpixel-antialiased'>
              <section className='px-2'>
                <ArticleExpirationNotice post={post} />
                <AISummary post={post} />
                <NotionPage post={post} />
              </section>
              <ShareBar post={post} />
              <PostCopyright {...props} />
              <PostRecommend {...props} />
              <PostAdjacent {...props} />
            </article>

            {post?.toc?.length > 1 && <FloatTocButton post={post} />}
            <div className='mt-4'>
              <Comment frontMatter={post} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const Layout404 = () => {
  const router = useRouter()
  const { locale } = useGlobal()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isBrowser) {
        const article = document.querySelector('#article-wrapper #notion-article')
        if (!article) {
          router.push('/').catch(() => {})
        }
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className='text-black w-full h-screen text-center justify-center content-center items-center flex flex-col'>
      <div className='dark:text-gray-200'>
        <h2 className='inline-block border-r-2 border-gray-600 mr-2 px-3 py-2 align-top'>404</h2>
        <div className='inline-block text-left h-32 leading-10 items-center'>
          <h2 className='m-0 p-0'>{locale.COMMON.NOT_FOUND}</h2>
        </div>
      </div>
    </div>
  )
}

const LayoutCategoryIndex = (props) => {
  const { categoryOptions } = props
  const { locale } = useGlobal()

  return (
    <div className='pt-4 rounded-2xl border border-slate-100 bg-white p-4'>
      <div className='mb-4 font-bold text-slate-700'>{locale.COMMON.CATEGORY}</div>
      <div className='flex flex-wrap gap-2'>
        {categoryOptions?.map((category) => (
          <SmartLink
            key={category.name}
            href={`/category/${category.name}`}
            className='px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-sm'
          >
            {category.name} ({category.count})
          </SmartLink>
        ))}
      </div>
    </div>
  )
}

const LayoutTagIndex = (props) => {
  const { tagOptions } = props
  const { locale } = useGlobal()

  return (
    <div className='pt-4 rounded-2xl border border-slate-100 bg-white p-4'>
      <div className='mb-4 font-bold text-slate-700'>{locale.COMMON.TAGS}</div>
      <div className='flex flex-wrap gap-2'>
        {tagOptions?.map((tag) => (
          <SmartLink
            key={tag.name}
            href={`/tag/${tag.name}`}
            className='px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-sm'
          >
            {tag.name} ({tag.count})
          </SmartLink>
        ))}
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
