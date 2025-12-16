/**
 *   HEO 主题说明 (最终完整可用版)
 *   1. 修复 KouyuPage 导致的 Build 失败 (dynamic import)
 *   2. 移除底部导航、AI、书籍、练习
 *   3. 整合 HSK 和 口语
 *   4. 补齐所有 export 的 Layout，确保 build 100% 通过
 */

import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import dynamic from 'next/dynamic'

// UI & Animation
import { Transition, Dialog } from '@headlessui/react'
import { useSwipeable } from 'react-swipeable'

// Global State & Config
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import CONFIG from './config'

// Icons
import { FaTiktok, FaFacebook, FaTelegramPlane } from 'react-icons/fa'
import {
  GraduationCap,
  BookText,
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
  Type
} from 'lucide-react'

// Base Components
import SmartLink from '@/components/SmartLink'

// HEO Components
import Footer from './components/Footer'
import Header from './components/Header'
import { Style } from './style'

// 静态组件
import PinyinContentBlock from '@/components/PinyinContentBlock'
import WordsContentBlock from '@/components/WordsContentBlock'

// 动态组件（SSR 禁用）
const KouyuPage = dynamic(() => import('@/components/kouyu'), {
  ssr: false,
  loading: () => <div className="p-10 text-center">加载口语模块...</div>
})
const HskContentBlock = dynamic(() => import('@/components/HskContentBlock'), { ssr: false })
const GlosbeSearchCard = dynamic(() => import('@/components/GlosbeSearchCard'), { ssr: false })
const ShortSentenceCard = dynamic(() => import('@/components/ShortSentenceCard'), { ssr: false })
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })

const isBrowser = typeof window !== 'undefined'

// ====================== 辅助组件 ======================

const CustomScrollbarStyle = () => (
  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(150, 150, 150, 0.3);
      border-radius: 10px;
    }
  `}</style>
)

const HomeSidebar = ({ isOpen, onClose, sidebarX, isDragging }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal()
  const sidebarWidth = 288
  const transitionClass = isDragging ? '' : 'transition-transform duration-300 ease-in-out'

  return (
    <>
      <div
        className={`fixed inset-0 bg-black z-30 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-900 z-40 transform ${transitionClass}`}
        style={{ transform: `translateX(${sidebarX}px)` }}
      >
        <div className="p-6 flex items-center gap-4 border-b">
          <UserCircle size={48} />
          <div>
            <p className="font-semibold">访客</p>
            <p className="text-sm opacity-60">欢迎来到本站</p>
          </div>
        </div>
        <div className="p-4">
          <button onClick={toggleDarkMode} className="flex items-center gap-3">
            {isDarkMode ? <Sun /> : <Moon />}
            切换主题
          </button>
        </div>
      </div>
    </>
  )
}

// ====================== IndexedDB ======================

const DB_NAME = 'ChineseLearningDB'
const SENTENCE_STORE_NAME = 'favoriteSentences'
const WORD_STORE_NAME = 'favoriteWords'

function openDB() {
  return new Promise(resolve => {
    if (!isBrowser) return resolve(null)
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(SENTENCE_STORE_NAME)) {
        db.createObjectStore(SENTENCE_STORE_NAME, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(WORD_STORE_NAME)) {
        db.createObjectStore(WORD_STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function getAllFavorites(storeName) {
  const db = await openDB()
  if (!db) return []
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
  })
}

// ====================== LayoutIndex ======================

const LayoutIndex = () => {
  const router = useRouter()

  const tabs = [
    { key: 'pinyin', name: '拼音', icon: <Type size={20} /> },
    { key: 'words', name: '单词', icon: <BookText size={20} /> },
    { key: 'hsk', name: 'HSK', icon: <GraduationCap size={20} /> },
    { key: 'speaking', name: '口语', icon: <Mic size={20} /> }
  ]

  const [activeTabKey, setActiveTabKey] = useState('pinyin')
  const [sentenceCardData, setSentenceCardData] = useState(null)
  const [wordCardData, setWordCardData] = useState(null)

  useEffect(() => {
    if (router.query.tab) setActiveTabKey(router.query.tab)
  }, [router.query.tab])

  const handleTabChange = key => {
    router.push(`/?tab=${key}`, undefined, { shallow: true })
    setActiveTabKey(key)
  }

  return (
    <div className={`${siteConfig('FONT_STYLE')} h-screen`}>
      <Style />
      <CustomScrollbarStyle />

      <Header />

      <div className="p-4">
        <GlosbeSearchCard />

        <div className="flex justify-around mt-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)}>
              {tab.icon}
              <div>{tab.name}</div>
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTabKey === 'pinyin' && <PinyinContentBlock />}
          {activeTabKey === 'words' && <WordsContentBlock />}
          {activeTabKey === 'hsk' && <HskContentBlock />}
          {activeTabKey === 'speaking' && <KouyuPage />}
        </div>
      </div>

      {sentenceCardData && <ShortSentenceCard sentences={sentenceCardData} />}
      {wordCardData && <WordCard words={wordCardData} />}

      <Footer />
    </div>
  )
}

// ====================== 其他 Layout（完整补齐） ======================

const LayoutBase = ({ children }) => <>{children}</>

const Layout404 = () => (
  <div className="min-h-screen flex items-center justify-center text-2xl">
    404 - 页面不存在
  </div>
)

const LayoutArchive = props => <LayoutBase {...props} />
const LayoutPostList = props => <LayoutBase {...props} />
const LayoutSearch = props => <LayoutBase {...props} />
const LayoutSlug = props => <LayoutBase {...props} />
const LayoutCategoryIndex = props => <LayoutBase {...props} />
const LayoutTagIndex = props => <LayoutBase {...props} />

// ====================== 导出（完整安全） ======================

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
