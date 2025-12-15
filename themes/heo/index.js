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
   首页 - 中文学习平台
========================= */
const LayoutIndex = props => {
  const [activeTab, setActiveTab] = useState('pinyin')
  const [showPriceOverlay, setShowPriceOverlay] = useState(false)

  // 静态数据
  const pinyinCards = [
    { id: 1, char: '八', pinyin: 'bā', meaning: 'eight' },
    { id: 2, char: '妈', pinyin: 'mā', meaning: 'mother' },
    { id: 3, char: '大', pinyin: 'dà', meaning: 'big' },
    { id: 4, char: '中', pinyin: 'zhōng', meaning: 'middle' },
    { id: 5, char: '文', pinyin: 'wén', meaning: 'language' },
    { id: 6, char: '学', pinyin: 'xué', meaning: 'study' },
  ]

  const hskWords = [
    { id: 1, chinese: '你好', pinyin: 'nǐ hǎo', meaning: 'Hello', level: 'HSK 1' },
    { id: 2, chinese: '谢谢', pinyin: 'xiè xie', meaning: 'Thank you', level: 'HSK 1' },
    { id: 3, chinese: '学习', pinyin: 'xué xí', meaning: 'Study', level: 'HSK 2' },
  ]

  const grammarPoints = [
    { id: 1, title: '是...的 结构', description: '用于强调动作细节', level: 'HSK 3' },
    { id: 2, title: '把 字句', description: '表示对宾语施加影响', level: 'HSK 4' },
    { id: 3, title: '被 字句', description: '表示被动语态', level: 'HSK 4' },
  ]

  return (
    <div className="chinese-platform-home">
      {/* Hero 区域 */}
      <section className="py-16 text-center bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 rounded-2xl mb-8">
        <div className="relative">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            轻松学习中文
          </h1>
          <p className="text-xl text-white/90 mb-8">
            拼音 • HSK • 语法 • 口语 • 全方位学习系统
          </p>

          <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
            <button 
              onClick={() => setShowPriceOverlay(true)}
              className="px-8 py-3 bg-white text-red-600 rounded-full font-bold hover:bg-gray-100 transition"
            >
              🚀 免费开始学习
            </button>
            <button className="px-8 py-3 border-2 border-white text-white rounded-full font-bold hover:bg-white/10 transition">
              📚 查看课程介绍
            </button>
          </div>
        </div>
      </section>

      {/* 功能导航 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="flex overflow-x-auto p-2">
          {['pinyin', 'hsk-words', 'grammar', 'practice', 'speaking'].map(tab => (
            <button
              key={tab}
              className={`px-5 py-3 rounded-lg whitespace-nowrap mx-1 ${
                activeTab === tab 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'pinyin' && '拼音学习'}
              {tab === 'hsk-words' && 'HSK单词'}
              {tab === 'grammar' && '语法讲解'}
              {tab === 'practice' && '练习题'}
              {tab === 'speaking' && '口语练习'}
            </button>
          ))}
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧主内容区 */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 拼音学习卡片区 */}
          {activeTab === 'pinyin' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">拼音发音练习</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {pinyinCards.map(card => (
                  <div 
                    key={card.id}
                    className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-lg p-5 text-center cursor-pointer hover:shadow-md transition"
                  >
                    <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">{card.char}</div>
                    <div className="text-2xl font-mono mb-2">{card.pinyin}</div>
                    <div className="text-gray-600 dark:text-gray-300">{card.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HSK单词浏览区 */}
          {activeTab === 'hsk-words' && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg overflow-hidden">
              <div className="p-8 text-center text-white">
                <div className="text-6xl font-bold mb-4">{hskWords[0].chinese}</div>
                <div className="text-3xl text-yellow-200 mb-3">{hskWords[0].pinyin}</div>
                <div className="text-2xl mb-4">{hskWords[0].meaning}</div>
                <div className="px-4 py-1 bg-white/20 rounded-full inline-block">
                  {hskWords[0].level}
                </div>
              </div>
            </div>
          )}

          {/* 语法讲解区 */}
          {activeTab === 'grammar' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">HSK语法详解</h2>
              <div className="space-y-6">
                {grammarPoints.map(point => (
                  <div key={point.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold">{point.title}</h3>
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full text-sm">
                        {point.level}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{point.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 练习题库 */}
          {activeTab === 'practice' && (
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-2xl font-bold mb-6">每日练习</h2>
              <div className="bg-white/10 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-bold mb-4">选择题</h3>
                <p className="mb-6 text-lg">我___学生。</p>
                <div className="grid gap-3">
                  {['A. 是', 'B. 有', 'C. 在', 'D. 要'].map((option, idx) => (
                    <button 
                      key={idx}
                      className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 口语练习 */}
          {activeTab === 'speaking' && (
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-2xl font-bold mb-6">口语跟读练习</h2>
              <div className="bg-white/10 rounded-lg p-6 mb-6">
                <p className="text-2xl mb-4">"请问，去火车站怎么走？"</p>
                <p className="opacity-90">Excuse me, how do I get to the train station?</p>
              </div>
              <div className="flex justify-center gap-4">
                <button className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  🔊
                </button>
                <button className="w-14 h-14 bg-white text-purple-600 rounded-full flex items-center justify-center">
                  🎤
                </button>
                <button className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  ▶
                </button>
              </div>
            </div>
          )}

        </div>

        {/* 右侧学习统计 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">学习统计</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>今日学习</span>
                  <span>45分钟</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className="w-3/4 h-full bg-red-500 rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>单词掌握</span>
                  <span>120/150</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className="w-4/5 h-full bg-green-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-bold mb-4">今日目标</h3>
            <div className="space-y-3">
              {[
                { task: '学习10个新词', completed: 7, total: 10 },
                { task: '完成语法练习', completed: 1, total: 1 },
                { task: '口语练习5分钟', completed: 3, total: 5 },
              ].map((goal, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{goal.task}</span>
                    <span>{goal.completed}/{goal.total}</span>
                  </div>
                  <div className="w-full h-2 bg-white/30 rounded-full">
                    <div 
                      className="h-full bg-white rounded-full"
                      style={{ width: `${(goal.completed/goal.total)*100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 价格上拉覆盖层 */}
      {showPriceOverlay && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowPriceOverlay(false)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">选择学习计划</h2>
                <button 
                  onClick={() => setShowPriceOverlay(false)}
                  className="text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    name: '免费版',
                    price: '¥0',
                    features: ['每日10个单词', '基础拼音练习', 'HSK 1-2语法', '社区交流']
                  },
                  {
                    name: '标准版',
                    price: '¥99/月',
                    popular: true,
                    features: ['无限单词学习', '完整拼音系统', 'HSK 1-4全套', '发音评测', '每日练习']
                  },
                  {
                    name: '专业版',
                    price: '¥299/月',
                    features: ['所有标准版功能', '1对1口语辅导', 'HSK 5-6高级内容', '定制学习计划', '证书认证']
                  }
                ].map((plan, idx) => (
                  <div 
                    key={idx}
                    className={`border rounded-xl p-6 ${plan.popular ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold mb-4">{plan.price}</div>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center">
                          <span className="w-5 h-5 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center mr-2 text-sm">
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full py-3 rounded-lg font-bold ${
                      plan.popular 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                    }`}>
                      {plan.name === '免费版' ? '立即开始' : '购买计划'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================
   列表页 - 保持不变
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
   搜索页 - 保持不变
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
   归档页 - 保持不变
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
   文章页 - 保持不变
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
   404 - 保持不变
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
