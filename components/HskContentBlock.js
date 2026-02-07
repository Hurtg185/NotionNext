
import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Mic2,
  Music4,
  Layers,
  BookText,
  Lightbulb,
  PlayCircle,
  Gem,
  MessageCircle,
  Crown,
  Star,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Volume2,
  Globe,
  X,
  Library,
  ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useSwipeable } from 'react-swipeable'

// 引入全屏 AI 助手组件
import AIChatDrawer from './AiChatAssistant'

// 引入书籍组件
import BookLibrary from '@/components/BookLibrary'

// 词卡组件（仅客户端）
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })

// 词库数据（Next 14 推荐静态导入）
import hsk1Words from '@/data/hsk/hsk1.json'
import hsk2Words from '@/data/hsk/hsk2.json'

const isBrowser = typeof window !== 'undefined'

// ==========================================
// 全局配置与数据
// ==========================================

const FB_CHAT_LINK = 'https://m.me/61575187883357'
const FAVORITES_STORAGE_KEY = 'framer-pinyin-favorites'

const getLevelPrice = (level) => {
  const prices = {
    1: '10,000 Ks',
    2: '15,000 Ks',
    3: '20,000 Ks',
    SP: '30,000 Ks'
  }
  return prices[level] || 'Contact Us'
}

const getSingleQuery = (value) => (Array.isArray(value) ? value[0] : value)

// 拼音数据
const pinyinMain = [
  { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'whole', title: '整体', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-500', bg: 'bg-amber-50' }
]

// HSK 课程数据
const hskData = [
  {
    level: 1,
    title: '入门 (Intro)',
    description: '掌握最常用词语和基本语法',
    descBurmese: 'အသုံးအများဆုံး စကားလုံးများနှင့် သဒ္ဒါ',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80',
    lessons: [
      { id: 1, title: '第 1 课 你好' },
      { id: 2, title: '第 2 课 谢谢你' },
      { id: 3, title: '第 3 课 你叫什么名字？' },
      { id: 4, title: '第 4 课 她是我的汉语老师' },
      { id: 5, title: '第 5 课 她女儿今年二十岁' },
      { id: 6, title: '第 6 课 我会说汉语' },
      { id: 7, title: '第 7 课 今天几号？' },
      { id: 8, title: '第 8 课 我想喝茶' }
    ]
  },
  {
    level: 2,
    title: '基础 (Basic)',
    description: '就熟悉的日常话题进行交流',
    descBurmese: 'နေ့စဉ်သုံး စကားပြောများ',
    imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80',
    lessons: [
      { id: 1, title: '第 1 课 九月去北京旅游最好' },
      { id: 2, title: '第 2 课 我每天六点起床' },
      { id: 3, title: '第 3 课 左边那个红色的是我的' }
    ]
  }
]

const hskWordsData = {
  1: hsk1Words || [],
  2: hsk2Words || []
}

const checkIsFree = (level, lessonId) => {
  if (level === 1) return lessonId <= 2
  return lessonId === 1
}

// ==========================================
// 核心子组件
// ==========================================

const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
  if (!isOpen) return null
  const price = getLevelPrice(targetLevel)
  const isSpoken = targetLevel === 'SP'

  return (
    <div className='fixed inset-0 z-[160] flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-slate-900/60 backdrop-blur-sm'
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className='relative w-full max-w-sm rounded-[1.8rem] bg-white p-6 shadow-2xl'
      >
        <button
          onClick={onClose}
          className='absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500'
          aria-label='关闭'
        >
          <X size={18} />
        </button>

        <div className='mt-2 text-center'>
          <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100'>
            <Crown className='text-amber-600' size={28} />
          </div>
          <h2 className='text-xl font-black text-slate-800'>
            {isSpoken ? '口语特训课程' : `HSK ${targetLevel}`}
          </h2>
          <p className='mb-5 mt-1 text-sm font-medium text-slate-500'>
            {isSpoken ? '地道场景、谐音助记与 AI 评测' : '完整视频讲解与练习题'}
            <br />
            <span className='text-xs text-slate-400'>(အတန်းစုံလင်စွာ သင်ယူနိုင်ပါသည်)</span>
          </p>
          <div className='mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4'>
            <p className='text-3xl font-black text-amber-500'>{price}</p>
          </div>
          <a
            href={FB_CHAT_LINK}
            target='_blank'
            rel='noopener noreferrer'
            className='flex w-full items-center justify-center gap-2 rounded-xl bg-[#0084FF] py-3.5 font-bold text-white shadow-lg transition-all active:scale-95'
          >
            <MessageCircle size={20} fill='currentColor' />
            ဆက်သွယ်ရန် (Contact)
          </a>
        </div>
      </motion.div>
    </div>
  )
}

const HskCard = ({ level, onVocabularyClick, onShowMembership }) => {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleLessonClick = (lesson) => {
    const isFree = checkIsFree(level.level, lesson.id)
    if (!isFree) {
      onShowMembership(level.level)
      return
    }
    router.push(`/hsk/${level.level}/lessons/${lesson.id}`)
  }

  return (
    <motion.section
      whileTap={{ scale: 0.995 }}
      className='overflow-hidden rounded-[1.6rem] border border-slate-100 bg-white shadow-sm'
    >
      <div className='relative h-40'>
        <img src={level.imageUrl} className='h-full w-full object-cover' alt={`HSK ${level.level}`} />
        <div className='absolute inset-0 bg-gradient-to-t from-black/70 to-transparent' />
        <div className='absolute bottom-4 left-5 text-white'>
          <p className='mb-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300'>{level.title}</p>
          <h2 className='text-2xl font-black'>HSK {level.level}</h2>
          <p className='mt-1 text-[10px] text-slate-200'>{level.descBurmese}</p>
        </div>
      </div>

      <div className='space-y-2 p-4'>
        {(isExpanded ? level.lessons : level.lessons.slice(0, 3)).map((lesson) => (
          <button
            key={lesson.id}
            type='button'
            onClick={() => handleLessonClick(lesson)}
            className='flex w-full items-center rounded-xl bg-slate-50 p-3 text-left transition-colors active:bg-slate-100'
          >
            <div className={`mr-3 rounded-full p-1.5 ${checkIsFree(level.level, lesson.id) ? 'bg-cyan-100 text-cyan-600' : 'bg-amber-100 text-amber-600'}`}>
              {checkIsFree(level.level, lesson.id) ? <PlayCircle size={14} fill='currentColor' /> : <Gem size={14} />}
            </div>
            <span className='flex-grow truncate text-sm font-bold text-slate-700'>{lesson.title}</span>
          </button>
        ))}
      </div>

      <div className='flex flex-col gap-3 px-4 pb-5 pt-1'>
        {level.lessons.length > 3 && (
          <button
            type='button'
            onClick={() => setIsExpanded((prev) => !prev)}
            className='flex w-full items-center justify-center gap-1 rounded-xl border border-slate-100 bg-slate-50 py-2.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 active:scale-95'
          >
            {isExpanded ? 'See Less' : `View All ${level.lessons.length} Lessons`}
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        <button
          type='button'
          onClick={() => onVocabularyClick(level)}
          className='w-full rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 py-3 text-xs font-black text-rose-500 transition-all active:scale-95'
        >
          <span className='inline-flex items-center gap-2'>
            <BookOpen size={14} />
            核心生词
            <span className='ml-1 text-[10px] font-normal opacity-70'>(ဝေါဟာရများ)</span>
          </span>
        </button>
      </div>
    </motion.section>
  )
}

const PinyinSection = ({ onOpenCollection, onOpenSpokenCollection, onOpenTranslator, onOpenBooks }) => {
  const router = useRouter()

  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-4 gap-2'>
        {pinyinMain.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center justify-center rounded-2xl py-3 transition-transform active:scale-95 ${item.bg}`}
          >
            <div className='mb-1 rounded-full bg-white p-1.5 shadow-sm'>
              <item.icon size={16} className={item.color} />
            </div>
            <span className='text-center text-[10px] font-bold leading-tight text-slate-600'>
              {item.title}
              <br />
              <span className='text-[8px] opacity-70'>{item.sub}</span>
            </span>
          </Link>
        ))}
      </div>

      <button
        type='button'
        onClick={() => router.push('/pinyin/tips')}
        className='group flex w-full items-center justify-between rounded-2xl border border-orange-100/50 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 transition-transform active:scale-95'
      >
        <div className='flex items-center gap-3'>
          <div className='shrink-0 rounded-full bg-white p-1.5 text-orange-500 shadow-sm'>
            <Lightbulb size={16} fill='currentColor' />
          </div>
          <div className='text-left'>
            <span className='block text-xs font-black text-slate-700'>发音技巧 (Tips)</span>
            <span className='block text-[10px] font-medium text-slate-500'>အသံထွက်နည်းလမ်းများ</span>
          </div>
        </div>
        <ChevronRight size={16} className='text-orange-300' />
      </button>

      <div className='grid grid-cols-2 gap-3'>
        <button
          type='button'
          onClick={onOpenTranslator}
          className='flex flex-col items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 py-3 transition-transform active:scale-95'
        >
          <div className='mb-1 flex items-center gap-1.5 text-blue-600'>
            <Globe size={16} />
            <span className='text-xs font-black'>AI 翻译</span>
          </div>
          <span className='text-[9px] text-slate-500'>AI ဘာသာပြန်</span>
        </button>

        <button
          type='button'
          onClick={onOpenBooks}
          className='flex flex-col items-center justify-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-teal-50 py-3 transition-transform active:scale-95'
        >
          <div className='mb-1 flex items-center gap-1.5 text-cyan-700'>
            <Library size={16} />
            <span className='text-xs font-black'>免费书籍</span>
          </div>
          <span className='text-[9px] text-slate-500'>စာကြည့်တိုက်</span>
        </button>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <button
          type='button'
          onClick={onOpenCollection}
          className='flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-3 shadow-sm transition-transform active:scale-95'
        >
          <div className='mb-1 flex items-center gap-1.5 text-slate-600'>
            <Star size={14} fill='currentColor' />
            <span className='text-xs font-black'>单词收藏</span>
          </div>
          <span className='text-[9px] text-slate-400'>မှတ်ထားသော စာလုံး</span>
        </button>

        <button
          type='button'
          onClick={onOpenSpokenCollection}
          className='flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-3 shadow-sm transition-transform active:scale-95'
        >
          <div className='mb-1 flex items-center gap-1.5 text-slate-600'>
            <Volume2 size={14} fill='currentColor' />
            <span className='text-xs font-black'>口语收藏</span>
          </div>
          <span className='text-[9px] text-slate-400'>မှတ်ထားသော စကားပြော</span>
        </button>
      </div>
    </div>
  )
}

// ==========================================
// 主页面入口
// ==========================================

export default function HskPageClient() {
  const router = useRouter()

  const [activeHskWords, setActiveHskWords] = useState([])
  const [activeLevelTag, setActiveLevelTag] = useState('hsk-vocab')

  // 统一 overlay：translator | books | membership | null
  const [activeOverlay, setActiveOverlay] = useState(null)
  const [membershipLevel, setMembershipLevel] = useState(null)

  const isCardViewOpen = router.asPath.includes('#hsk-vocabulary')
  const isTranslatorOpen = activeOverlay === 'translator'
  const isBookLibraryOpen = activeOverlay === 'books'
  const isMembershipOpen = activeOverlay === 'membership'

  // 打开 overlay 时 push 一条 history，让系统返回手势先关 overlay，不退站
  const openOverlay = useCallback(
    (overlayType, payload = null) => {
      if (activeOverlay === overlayType) return
      setActiveOverlay(overlayType)
      setMembershipLevel(overlayType === 'membership' ? payload : null)

      if (isBrowser) {
        window.history.pushState({ overlay: overlayType }, '', window.location.href)
      }
    },
    [activeOverlay]
  )

  // 关闭 overlay：优先走 history.back，和手势返回保持一致
  const closeOverlay = useCallback(() => {
    if (activeOverlay && isBrowser) {
      window.history.back()
      return
    }
    setActiveOverlay(null)
    setMembershipLevel(null)
  }, [activeOverlay])

  // 监听浏览器返回（含安卓返回键 / iOS 返回手势）
  useEffect(() => {
    if (!isBrowser) return

    const onPopState = () => {
      if (activeOverlay) {
        setActiveOverlay(null)
        setMembershipLevel(null)
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [activeOverlay])

  const overlaySwipeHandlers = useSwipeable({
    onSwipedRight: () => closeOverlay(),
    trackMouse: true,
    delta: 45,
    preventScrollOnSwipe: false
  })

  const handleSpokenCollectionClick = useCallback(() => {
    router.push({
      pathname: '/spoken',
      query: { filter: 'favorites' }
    })
  }, [router])

  const closeWordCard = useCallback(() => {
    const base = router.asPath.split('#')[0]
    router.replace(base, undefined, { shallow: true, scroll: false })
  }, [router])

  const getFavoriteWords = useCallback(() => {
    if (!isBrowser) return []
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
      const savedIds = raw ? JSON.parse(raw) : []
      const allWords = [...(hskWordsData[1] || []), ...(hskWordsData[2] || [])]
      return allWords.filter((word) =>
        Array.isArray(savedIds) && savedIds.some((savedId) => String(savedId) === String(word.id))
      )
    } catch (e) {
      return []
    }
  }, [])

  const handleVocabularyClick = useCallback(
    (level) => {
      const levelNum = Number(level?.level || 1)
      const words = hskWordsData[levelNum] || []

      setActiveHskWords(words)
      setActiveLevelTag(`hsk${levelNum}`)

      const nextQuery = { ...router.query, level: String(levelNum) }
      delete nextQuery.view

      router.push(
        { pathname: router.pathname, query: nextQuery, hash: 'hsk-vocabulary' },
        undefined,
        { shallow: true, scroll: false }
      )
    },
    [router]
  )

  const handleCollectionClick = useCallback(() => {
    const favoriteWords = getFavoriteWords()

    if (!favoriteWords.length) {
      alert('No saved words yet!\nမှတ်ထားသော စာလုံး မရှိသေးပါ')
      return
    }

    setActiveHskWords(favoriteWords)
    setActiveLevelTag('my-favorites-collection')

    const nextQuery = { ...router.query, view: 'favorites' }
    delete nextQuery.level

    router.push(
      { pathname: router.pathname, query: nextQuery, hash: 'hsk-vocabulary' },
      undefined,
      { shallow: true, scroll: false }
    )
  }, [getFavoriteWords, router])

  // URL 直开 / 刷新时回填词卡数据
  useEffect(() => {
    if (!router.isReady || !isCardViewOpen) return

    const levelParam = Number(getSingleQuery(router.query.level))
    const viewParam = getSingleQuery(router.query.view)

    if (Number.isFinite(levelParam) && hskWordsData[levelParam]) {
      setActiveHskWords(hskWordsData[levelParam])
      setActiveLevelTag(`hsk${levelParam}`)
      return
    }

    if (viewParam === 'favorites') {
      const favoriteWords = getFavoriteWords()
      setActiveHskWords(favoriteWords)
      setActiveLevelTag('my-favorites-collection')
    }
  }, [router.isReady, router.query.level, router.query.view, isCardViewOpen, getFavoriteWords])

  return (
    <div className='min-h-[100dvh] w-full overflow-x-hidden bg-[#f8fafc] pb-16 font-sans text-slate-900'>
      <div className='pointer-events-none absolute left-0 right-0 top-0 h-44 bg-gradient-to-b from-blue-50/70 to-transparent' />

      <header className='relative z-10 px-4 pb-1 pt-4'>
        <div className='rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50'>
          <PinyinSection
            onOpenCollection={handleCollectionClick}
            onOpenSpokenCollection={handleSpokenCollectionClick}
            onOpenTranslator={() => openOverlay('translator')}
            onOpenBooks={() => openOverlay('books')}
          />
        </div>
      </header>

      <main className='relative z-10 mt-6 space-y-4 px-4 pb-10'>
        <div className='flex items-center gap-2 px-1 opacity-70'>
          <BookText size={14} className='text-slate-500' />
          <h2 className='text-xs font-black uppercase tracking-wider text-slate-600'>
            System Courses (သင်ရိုး)
          </h2>
        </div>

        <div className='grid grid-cols-1 gap-5'>
          {hskData.map((level) => (
            <HskCard
              key={level.level}
              level={level}
              onVocabularyClick={handleVocabularyClick}
              onShowMembership={(l) => openOverlay('membership', l)}
            />
          ))}
        </div>
      </main>

      {/* 会员弹窗 */}
      <AnimatePresence>
        {isMembershipOpen && (
          <MembershipModal
            isOpen={isMembershipOpen}
            onClose={closeOverlay}
            targetLevel={membershipLevel}
          />
        )}
      </AnimatePresence>

      {/* AI 翻译：全屏 + 右滑返回 */}
      <AnimatePresence>
        {isTranslatorOpen && (
          <motion.div
            {...overlaySwipeHandlers}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[140] bg-white'
          >
            <AIChatDrawer isOpen={isTranslatorOpen} onClose={closeOverlay} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 免费书籍：全屏 + 右滑返回 */}
      <AnimatePresence>
        {isBookLibraryOpen && (
          <motion.div
            {...overlaySwipeHandlers}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[140] bg-white'
          >
            <BookLibrary isOpen={isBookLibraryOpen} onClose={closeOverlay} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 单词词卡 */}
      <WordCard
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={closeWordCard}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </div>
  )
}
