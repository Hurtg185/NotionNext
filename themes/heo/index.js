/**
 * 中文学习平台 - 移动端优化版
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import CONFIG from './config'

import Header from './components/Header'
import Footer from './components/Footer'
import { Style } from './style'

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
   基础布局 - 简化版
========================= */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth } = useGlobal()
  const router = useRouter()

  const showSide = !(router.route === '/404' || fullWidth)

  // 在移动端隐藏侧边栏
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div
      id="theme-heo-mobile"
      className={`${siteConfig('FONT_STYLE')} min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900`}
    >
      <Style />

      <main className="flex-grow">
        {slotTop}
        {children}
      </main>

      <Footer />
      {siteConfig('HEO_LOADING_COVER', true, CONFIG) && <LoadingCover />}
    </div>
  )
}

/* =========================
   首页 - 抽屉式设计
========================= */
const LayoutIndex = () => {
  const router = useRouter()
  const [activePage, setActivePage] = useState('home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerContent, setDrawerContent] = useState(null)
  const [drawerPosition, setDrawerPosition] = useState(0)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startPosition = useRef(0)

  // 主页面内容
  const pages = {
    home: {
      title: '首页',
      content: <HomeContent openDrawer={setDrawerOpen} setDrawerContent={setDrawerContent} />
    },
    pinyin: {
      title: '拼音学习',
      content: <PinyinPage openDrawer={setDrawerOpen} setDrawerContent={setDrawerContent} />
    },
    hsk: {
      title: 'HSK课程',
      content: <HskPage openDrawer={setDrawerOpen} setDrawerContent={setDrawerContent} />
    },
    speaking: {
      title: '口语练习',
      content: <SpeakingPage openDrawer={setDrawerOpen} setDrawerContent={setDrawerContent} />
    },
    practice: {
      title: '练习题',
      content: <PracticePage openDrawer={setDrawerOpen} setDrawerContent={setDrawerContent} />
    }
  }

  // 处理触摸开始
  const handleTouchStart = (e) => {
    if (drawerOpen && drawerPosition < window.innerHeight * 0.7) {
      isDragging.current = true
      startY.current = e.touches[0].clientY
      startPosition.current = drawerPosition
      e.preventDefault()
    }
  }

  // 处理触摸移动
  const handleTouchMove = (e) => {
    if (!isDragging.current) return
    
    const currentY = e.touches[0].clientY
    const deltaY = currentY - startY.current
    let newPosition = Math.max(0, startPosition.current + deltaY)
    
    // 限制最大拖动距离
    newPosition = Math.min(window.innerHeight * 0.85, newPosition)
    
    setDrawerPosition(newPosition)
    e.preventDefault()
  }

  // 处理触摸结束
  const handleTouchEnd = () => {
    if (!isDragging.current) return
    
    isDragging.current = false
    
    // 判断是否需要关闭或完全打开
    if (drawerPosition > window.innerHeight * 0.6) {
      setDrawerOpen(false)
      setDrawerPosition(0)
    } else {
      setDrawerPosition(0) // 回到完全打开位置
    }
  }

  // 打开抽屉并设置内容
  const openDrawerWithContent = (content) => {
    setDrawerContent(content)
    setDrawerOpen(true)
    setDrawerPosition(0)
  }

  // 关闭抽屉
  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerPosition(0)
  }

  useEffect(() => {
    // 监听路由变化，切换页面
    const handleRouteChange = () => {
      const path = router.pathname
      if (path === '/pinyin') setActivePage('pinyin')
      else if (path === '/hsk') setActivePage('hsk')
      else if (path === '/speaking') setActivePage('speaking')
      else if (path === '/practice') setActivePage('practice')
      else setActivePage('home')
    }

    handleRouteChange()
    router.events.on('routeChangeComplete', handleRouteChange)
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router])

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* 抽屉遮罩层 */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black z-40 transition-opacity"
          style={{ opacity: Math.max(0.3, 0.5 - (drawerPosition / (window.innerHeight * 0.85)) * 0.5) }}
          onClick={closeDrawer}
        />
      )}

      {/* 主内容区域 */}
      <div className="h-full overflow-hidden">
        {/* 顶部状态栏 */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center">
          <button 
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">{pages[activePage].title}</h1>
          <button 
            onClick={() => openDrawerWithContent(<MenuContent />)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ≡
          </button>
        </div>

        {/* 页面内容 */}
        <div className="h-full pt-16 pb-16 overflow-y-auto">
          {pages[activePage].content}
        </div>

        {/* 底部导航栏 */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-around py-3">
            {Object.entries(pages).map(([key, page]) => (
              <button
                key={key}
                onClick={() => {
                  if (key === 'home') router.push('/')
                  else router.push(`/${key}`)
                }}
                className={`flex flex-col items-center px-3 py-2 rounded-lg ${
                  activePage === key 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <span className="text-xl mb-1">
                  {key === 'home' && '🏠'}
                  {key === 'pinyin' && '🔊'}
                  {key === 'hsk' && '📚'}
                  {key === 'speaking' && '🎤'}
                  {key === 'practice' && '✏️'}
                </span>
                <span className="text-xs">{page.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 抽屉内容 */}
      {drawerOpen && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl"
          style={{ 
            height: '85%',
            transform: `translateY(${drawerPosition}px)`,
            transition: isDragging.current ? 'none' : 'transform 0.3s ease-out'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* 拖动指示条 */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>

          {/* 抽屉标题 */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">菜单</h2>
              <button 
                onClick={closeDrawer}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 抽屉内容 */}
          <div className="h-full overflow-y-auto pb-20">
            {drawerContent || <MenuContent />}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================
   首页内容组件
========================= */
const HomeContent = ({ openDrawer, setDrawerContent }) => {
  const sections = [
    {
      title: '快速开始',
      items: [
        { title: '学习拼音', desc: '掌握中文发音基础', icon: '🔊', page: 'pinyin' },
        { title: 'HSK单词', desc: '分级学习核心词汇', icon: '📚', page: 'hsk' },
        { title: '口语练习', desc: '实战对话训练', icon: '🎤', page: 'speaking' },
        { title: '语法学习', desc: '理解句子结构', icon: '📝', page: 'hsk' },
      ]
    },
    {
      title: '今日推荐',
      items: [
        { title: '日常问候', desc: '10个常用问候语', icon: '👋', type: 'lesson' },
        { title: '数字练习', desc: '1-100发音练习', icon: '🔢', type: 'lesson' },
        { title: 'HSK 1 模拟', desc: '完整模拟考试', icon: '📊', type: 'test' },
        { title: '发音挑战', desc: '拼音发音测试', icon: '🎯', type: 'challenge' },
      ]
    },
    {
      title: '学习统计',
      items: [
        { title: '连续学习', value: '7天', progress: 100 },
        { title: '单词掌握', value: '85/100个', progress: 85 },
        { title: '发音准确', value: '92%', progress: 92 },
        { title: '语法掌握', value: '78%', progress: 78 },
      ]
    }
  ]

  return (
    <div className="p-4 space-y-6">
      {/* 欢迎区域 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">欢迎回来！</h1>
        <p className="opacity-90 mb-4">今日推荐：学习10个新单词</p>
        <button className="px-6 py-3 bg-white text-blue-600 rounded-full font-bold hover:bg-gray-100">
          开始今日学习
        </button>
      </div>

      {/* 各模块内容 */}
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <h2 className="text-lg font-bold mb-3">{section.title}</h2>
          <div className="space-y-3">
            {section.items.map((item, itemIndex) => (
              <div 
                key={itemIndex}
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => {
                  if (item.page) {
                    // 跳转到对应页面
                    window.location.href = `/${item.page}`
                  } else if (item.type === 'lesson') {
                    // 打开课程详情抽屉
                    openDrawer(true)
                    setDrawerContent(<LessonDetail lesson={item} />)
                  }
                }}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl mr-3">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{item.desc || item.value}</div>
                </div>
                {item.progress && (
                  <div className="text-right">
                    <div className="text-sm font-medium">{item.progress}%</div>
                    <div className="w-20 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 功能卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="text-xl mb-2">🎤</div>
          <div className="font-bold">口语评测</div>
          <div className="text-sm opacity-90">AI实时评分</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-4 text-white">
          <div className="text-xl mb-2">📊</div>
          <div className="font-bold">模拟考试</div>
          <div className="text-sm opacity-90">HSK全真模拟</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-4 text-white">
          <div className="text-xl mb-2">📈</div>
          <div className="font-bold">学习报告</div>
          <div className="text-sm opacity-90">每周进步分析</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-4 text-white">
          <div className="text-xl mb-2">👥</div>
          <div className="font-bold">学习社区</div>
          <div className="text-sm opacity-90">与同学交流</div>
        </div>
      </div>
    </div>
  )
}

/* =========================
   拼音页面组件
========================= */
const PinyinPage = ({ openDrawer, setDrawerContent }) => {
  const pinyinGroups = [
    {
      title: '声母',
      items: ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's']
    },
    {
      title: '韵母',
      items: ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong']
    },
    {
      title: '声调',
      items: ['ā á ǎ à', 'ō ó ǒ ò', 'ē é ě è', 'ī í ǐ ì', 'ū ú ǔ ù', 'ǖ ǘ ǚ ǜ']
    }
  ]

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">拼音学习</h1>
        <p className="opacity-90">掌握标准发音，打好中文基础</p>
      </div>

      {pinyinGroups.map((group, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <h2 className="text-lg font-bold mb-3">{group.title}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {group.items.map((item, idx) => (
              <button
                key={idx}
                className="aspect-square bg-blue-50 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl font-bold hover:bg-blue-100 dark:hover:bg-gray-600"
                onClick={() => {
                  openDrawer(true)
                  setDrawerContent(<PinyinDetail pinyin={item} />)
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* 练习区 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <h2 className="text-lg font-bold mb-3">发音练习</h2>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold mb-2">bā</div>
            <div className="text-gray-600 dark:text-gray-400">八 (eight)</div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2 bg-blue-500 text-white rounded-lg">播放</button>
              <button className="flex-1 py-2 bg-green-500 text-white rounded-lg">录音</button>
            </div>
          </div>
          
          <button className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-bold">
            开始系统练习
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================
   HSK页面组件
========================= */
const HskPage = ({ openDrawer, setDrawerContent }) => {
  const hskLevels = [
    { level: 'HSK 1', words: 150, lessons: 15, color: 'from-green-500 to-emerald-500' },
    { level: 'HSK 2', words: 300, lessons: 20, color: 'from-blue-500 to-cyan-500' },
    { level: 'HSK 3', words: 600, lessons: 25, color: 'from-purple-500 to-pink-500' },
    { level: 'HSK 4', words: 1200, lessons: 30, color: 'from-orange-500 to-red-500' },
    { level: 'HSK 5', words: 2500, lessons: 35, color: 'from-indigo-500 to-purple-500' },
    { level: 'HSK 6', words: 5000, lessons: 40, color: 'from-gray-600 to-slate-600' }
  ]

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">HSK课程</h1>
        <p className="opacity-90">国际汉语水平考试，分级学习</p>
      </div>

      {/* HSK级别列表 */}
      <div className="space-y-4">
        {hskLevels.map((hsk, index) => (
          <div 
            key={index}
            className={`bg-gradient-to-r ${hsk.color} rounded-xl p-5 text-white shadow-lg`}
            onClick={() => {
              openDrawer(true)
              setDrawerContent(<HskDetail level={hsk} />)
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold">{hsk.level}</h2>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm">
                {index + 1}级
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm opacity-90">单词数量</div>
                <div className="text-lg font-bold">{hsk.words}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">课程数量</div>
                <div className="text-lg font-bold">{hsk.lessons}</div>
              </div>
            </div>
            <button className="w-full mt-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30">
              开始学习
            </button>
          </div>
        ))}
      </div>

      {/* 单词学习模式 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <h2 className="text-lg font-bold mb-3">单词学习</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <div className="font-bold">卡片模式</div>
              <div className="text-sm text-gray-500">闪卡记忆</div>
            </div>
            <span>→</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <div className="font-bold">列表模式</div>
              <div className="text-sm text-gray-500">浏览所有单词</div>
            </div>
            <span>→</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <div className="font-bold">测试模式</div>
              <div className="text-sm text-gray-500">检测掌握程度</div>
            </div>
            <span>→</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================
   口语页面组件
========================= */
const SpeakingPage = ({ openDrawer, setDrawerContent }) => {
  const speakingTopics = [
    { title: '日常问候', sentences: 10, icon: '👋' },
    { title: '餐厅点餐', sentences: 15, icon: '🍽️' },
    { title: '购物交流', sentences: 12, icon: '🛍️' },
    { title: '问路指路', sentences: 8, icon: '🗺️' },
    { title: '旅游对话', sentences: 20, icon: '✈️' },
    { title: '商务会谈', sentences: 18, icon: '💼' }
  ]

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">口语练习</h1>
        <p className="opacity-90">AI实时评测，纠正发音</p>
      </div>

      {/* 口语练习区域 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎤</div>
          <h2 className="text-lg font-bold mb-2">实时跟读练习</h2>
          <p className="text-gray-500 dark:text-gray-400">请跟读下面的句子</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
          <div className="text-2xl font-bold mb-4 text-center">"你好，请问图书馆在哪里？"</div>
          <div className="text-gray-600 dark:text-gray-400 text-center mb-6">Hello, where is the library?</div>
          
          <div className="flex justify-center gap-4 mb-6">
            <button className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center">
              🔊
            </button>
            <button className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center text-xl">
              🎤
            </button>
            <button className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center">
              ▶
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-4 text-white">
          <div className="flex justify-between items-center">
            <span>发音评分</span>
            <span className="text-2xl font-bold">85/100</span>
          </div>
          <div className="text-sm mt-2 opacity-90">建议：注意"图书馆"的连读</div>
        </div>
      </div>

      {/* 话题列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <h2 className="text-lg font-bold mb-3">话题练习</h2>
        <div className="grid grid-cols-2 gap-3">
          {speakingTopics.map((topic, index) => (
            <div 
              key={index}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center"
              onClick={() => {
                openDrawer(true)
                setDrawerContent(<TopicDetail topic={topic} />)
              }}
            >
              <div className="text-2xl mb-2">{topic.icon}</div>
              <div className="font-bold">{topic.title}</div>
              <div className="text-sm text-gray-500">{topic.sentences}个句子</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* =========================
   练习页面组件
========================= */
const PracticePage = ({ openDrawer, setDrawerContent }) => {
  const practiceTypes = [
    { type: 'choice', title: '选择题', icon: '🔘', color: 'from-blue-500 to-cyan-500' },
    { type: 'fill', title: '填空题', icon: '📝', color: 'from-green-500 to-emerald-500' },
    { type: 'match', title: '连线题', icon: '🔗', color: 'from-purple-500 to-pink-500' },
    { type: 'listen', title: '听力题', icon: '👂', color: 'from-orange-500 to-red-500' },
    { type: 'speak', title: '口语题', icon: '🎤', color: 'from-indigo-500 to-purple-500' },
    { type: 'write', title: '书写题', icon: '✍️', color: 'from-yellow-500 to-amber-500' }
  ]

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">练习题</h1>
        <p className="opacity-90">多种题型，巩固所学知识</p>
      </div>

      {/* 练习统计 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <h2 className="text-lg font-bold mb-3">今日练习</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span>已完成</span>
            <span className="font-bold">5/10题</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className="w-1/2 h-full bg-green-500 rounded-full"></div>
          </div>
          <div className="flex justify-between items-center">
            <span>正确率</span>
            <span className="font-bold">80%</span>
          </div>
        </div>
      </div>

      {/* 练习题类型 */}
      <div className="grid grid-cols-3 gap-3">
        {practiceTypes.map((practice, index) => (
          <div 
            key={index}
            className={`bg-gradient-to-br ${practice.color} rounded-xl p-4 text-white text-center`}
            onClick={() => {
              openDrawer(true)
              setDrawerContent(<PracticeDetail type={practice.type} />)
            }}
          >
            <div className="text-2xl mb-2">{practice.icon}</div>
            <div className="font-bold text-sm">{practice.title}</div>
          </div>
        ))}
      </div>

      {/* 当前练习题 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4">选择题练习</h2>
        <div className="space-y-4">
          <div className="text-lg">我___学生。</div>
          <div className="space-y-3">
            {['A. 是', 'B. 有', 'C. 在', 'D. 要'].map((option, idx) => (
              <button
                key={idx}
                className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                {option}
              </button>
            ))}
          </div>
          <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-bold">
            提交答案
          </button>
        </div>
      </div>

      {/* 历史记录 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <h2 className="text-lg font-bold mb-3">练习记录</h2>
        <div className="space-y-3">
          {[
            { date: '今天', score: '80%', count: 10 },
            { date: '昨天', score: '75%', count: 8 },
            { date: '前天', score: '85%', count: 12 },
          ].map((record, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span>{record.date}</span>
              <div className="text-right">
                <div className="font-bold">{record.score}</div>
                <div className="text-sm text-gray-500">{record.count}题</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* =========================
   抽屉内容组件
========================= */
const MenuContent = () => {
  const menuItems = [
    { title: '个人中心', icon: '👤', href: '/profile' },
    { title: '学习报告', icon: '📊', href: '/report' },
    { title: '收藏夹', icon: '⭐', href: '/favorites' },
    { title: '设置', icon: '⚙️', href: '/settings' },
    { title: '帮助', icon: '❓', href: '/help' },
    { title: '关于我们', icon: 'ℹ️', href: '/about' },
  ]

  return (
    <div className="space-y-1">
      {menuItems.map((item, index) => (
        <a
          key={index}
          href={item.href}
          className="flex items-center p-4 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl mr-3">
            {item.icon}
          </div>
          <span className="font-medium">{item.title}</span>
        </a>
      ))}
      
      {/* 分割线 */}
      <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
      
      {/* 学习计划 */}
      <div className="p-4">
        <h3 className="font-bold mb-3">学习计划</h3>
        <div className="space-y-3">
          {[
            { plan: '免费版', price: '¥0', features: ['基础功能'] },
            { plan: '标准版', price: '¥99/月', features: ['完整课程', '发音评测'] },
            { plan: '专业版', price: '¥299/月', features: ['所有功能', '1对1辅导'] },
          ].map((plan, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{plan.plan}</span>
                <span className="text-lg font-bold">{plan.price}</span>
              </div>
              <div className="text-sm text-gray-500">
                {plan.features.join(' • ')}
              </div>
              <button className={`w-full mt-3 py-2 rounded-lg font-medium ${
                idx === 1 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
              }`}>
                {idx === 0 ? '当前使用' : '升级'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const PinyinDetail = ({ pinyin }) => {
  return (
    <div className="p-6">
      <div className="text-center">
        <div className="text-6xl font-bold mb-4">{pinyin}</div>
        <div className="text-2xl text-gray-500 mb-6">标准发音</div>
        
        <div className="flex justify-center gap-4 mb-8">
          <button className="px-6 py-3 bg-blue-500 text-white rounded-lg">播放</button>
          <button className="px-6 py-3 bg-green-500 text-white rounded-lg">录音</button>
          <button className="px-6 py-3 bg-purple-500 text-white rounded-lg">对比</button>
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-bold">相关单词</h3>
        <div className="grid grid-cols-2 gap-3">
          {['八', '爸', '吧', '巴'].map((word, idx) => (
            <div key={idx} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{word}</div>
              <div className="text-gray-500">bā</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const HskDetail = ({ level }) => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{level.level} 详情</h2>
      <div className="space-y-4">
        <div className="flex justify-between">
          <span>单词数量</span>
          <span className="font-bold">{level.words}个</span>
        </div>
        <div className="flex justify-between">
          <span>课程数量</span>
          <span className="font-bold">{level.lessons}课</span>
        </div>
        <div className="flex justify-between">
          <span>建议学习时间</span>
          <span className="font-bold">30小时</span>
        </div>
        
        <div className="pt-4">
          <h3 className="font-bold mb-3">课程大纲</h3>
          <div className="space-y-2">
            {['基础词汇', '日常对话', '语法讲解', '听力练习', '模拟考试'].map((item, idx) => (
              <div key={idx} className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm mr-3">
                  {idx + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        
        <button className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold mt-6">
          开始学习
        </button>
      </div>
    </div>
  )
}

const TopicDetail = ({ topic }) => {
  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{topic.icon}</div>
        <h2 className="text-2xl font-bold">{topic.title}</h2>
        <p className="text-gray-500">{topic.sentences}个句子</p>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-bold">示例句子</h3>
        {[
          { chinese: '你好吗？', english: 'How are you?' },
          { chinese: '我很好，谢谢。', english: "I'm fine, thank you." },
          { chinese: '你叫什么名字？', english: 'What is your name?' },
        ].map((sentence, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-lg font-bold mb-2">{sentence.chinese}</div>
            <div className="text-gray-500">{sentence.english}</div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2 bg-blue-500 text-white rounded">播放</button>
              <button className="flex-1 py-2 bg-green-500 text-white rounded">跟读</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const PracticeDetail = ({ type }) => {
  const typeNames = {
    choice: '选择题',
    fill: '填空题',
    match: '连线题',
    listen: '听力题',
    speak: '口语题',
    write: '书写题'
  }
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{typeNames[type]} 练习</h2>
      <div className="space-y-4">
        <p>专项练习，提高你的{typeNames[type]}能力</p>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="font-bold mb-3">练习设置</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>题目数量</span>
              <select className="border rounded px-2">
                <option>10题</option>
                <option>20题</option>
                <option>50题</option>
              </select>
            </div>
            <div className="flex justify-between">
              <span>难度级别</span>
              <select className="border rounded px-2">
                <option>简单</option>
                <option>中等</option>
                <option>困难</option>
              </select>
            </div>
            <div className="flex justify-between">
              <span>时间限制</span>
              <select className="border rounded px-2">
                <option>无限制</option>
                <option>10分钟</option>
                <option>30分钟</option>
              </select>
            </div>
          </div>
        </div>
        
        <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-bold">
          开始练习
        </button>
      </div>
    </div>
  )
}

const LessonDetail = ({ lesson }) => {
  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{lesson.icon}</div>
        <h2 className="text-2xl font-bold">{lesson.title}</h2>
        <p className="text-gray-500">{lesson.desc}</p>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-bold">课程内容</h3>
        <div className="space-y-2">
          {['视频讲解', '发音示范', '练习题目', '课后测试'].map((item, idx) => (
            <div key={idx} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center mr-3">
                ✓
              </span>
              {item}
            </div>
          ))}
        </div>
        
        <button className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold">
          开始学习
        </button>
      </div>
    </div>
  )
}

/* =========================
   其他页面保持不变
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

const LayoutSearch = props => {
  const router = useRouter()
  const keyword = props.keyword || router.query?.s

  return (
    <div className="px-5 md:px-0">
      {!keyword ? <SearchNav {...props} /> : <LayoutPostList {...props} />}
    </div>
  )
}

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
