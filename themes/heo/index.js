/**
 * HEO Theme - Chinese Learning Platform Layout
 * Modified for Chinese Learning Website
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'
import CONFIG from './config'

import Header from './components/Header'
import Footer from './components/Footer'
import SideRight from './components/SideRight'
import { NoticeBar } from './components/NoticeBar'
import { Style } from './style'

import LoadingCover from '@/components/LoadingCover'
import SmartLink from '@/components/SmartLink'

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
      id="theme-heo-chinese"
      className={`${siteConfig('FONT_STYLE')} min-h-screen flex flex-col`}
    >
      <Style />
      
      <Header {...props} />
      {router.route === '/' && <NoticeBar />}

      <main className="flex-grow">
        {slotTop}
        
        <div className="w-full max-w-[96rem] mx-auto px-5">
          <div className="flex">
            <div className={`flex-1 ${className || ''}`}>
              {children}
            </div>

            {showSide && (
              <aside className="hidden xl:block w-[320px] ml-4">
                <SideRight {...props} />
              </aside>
            )}
          </div>
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
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  
  const hskWords = [
    { 
      chinese: '你好', 
      pinyin: 'nǐ hǎo', 
      meaning: 'Hello', 
      example: '你好，我是小明。', 
      level: 'HSK 1',
      audio: '/audio/ni3hao3.mp3'
    },
    { 
      chinese: '谢谢', 
      pinyin: 'xiè xie', 
      meaning: 'Thank you', 
      example: '谢谢你的帮助。', 
      level: 'HSK 1',
      audio: '/audio/xie4xie.mp3'
    },
    { 
      chinese: '学习', 
      pinyin: 'xué xí', 
      meaning: 'Study/Learn', 
      example: '我正在学习中文。', 
      level: 'HSK 2',
      audio: '/audio/xue2xi2.mp3'
    },
  ]

  const pinyinCards = [
    { pinyin: 'bā', char: '八', meaning: 'eight', initial: 'b', final: 'a', tone: 1 },
    { pinyin: 'mā', char: '妈', meaning: 'mother', initial: 'm', final: 'a', tone: 1 },
    { pinyin: 'dà', char: '大', meaning: 'big', initial: 'd', final: 'a', tone: 4 },
    { pinyin: 'zhōng', char: '中', meaning: 'middle', initial: 'zh', final: 'ong', tone: 1 },
  ]

  // 模拟音频播放
  const playAudio = (audioSrc) => {
    const audio = new Audio(audioSrc)
    audio.play()
  }

  // 切换单词（抖音风格）
  const nextWord = () => {
    setCurrentWordIndex((prev) => (prev + 1) % hskWords.length)
  }

  // 模拟价格/功能上拉覆盖
  const [showPriceOverlay, setShowPriceOverlay] = useState(false)

  return (
    <div className="chinese-platform">
      {/* Hero 区域 */}
      <section className="relative bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative container mx-auto px-5 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 wow fadeInUp">
            轻松学中文
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90 wow fadeInUp" data-wow-delay="0.2s">
            拼音 · HSK · 语法 · 口语 · 全方位学习系统
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4 wow fadeInUp" data-wow-delay="0.4s">
            <button 
              onClick={() => setShowPriceOverlay(true)}
              className="px-8 py-4 bg-white text-red-600 rounded-full text-lg font-bold hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              免费开始学习
            </button>
            <button className="px-8 py-4 border-2 border-white rounded-full text-lg font-bold hover:bg-white hover:text-red-600 transition-all">
              查看课程介绍
            </button>
          </div>
        </div>
        
        {/* 波浪装饰 */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </section>

      {/* 功能导航标签 */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-5">
          <div className="flex overflow-x-auto space-x-1 py-3 scrollbar-hide">
            {[
              { id: 'pinyin', label: '拼音学习', icon: '🎵' },
              { id: 'hsk-words', label: 'HSK单词', icon: '📚' },
              { id: 'grammar', label: '语法讲解', icon: '📝' },
              { id: 'practice', label: '练习题', icon: '✏️' },
              { id: 'speaking', label: '口语练习', icon: '🎤' },
              { id: 'hsk-test', label: '模拟考试', icon: '📊' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`flex items-center px-6 py-3 rounded-full whitespace-nowrap transition-all ${
                  activeTab === tab.id 
                    ? 'bg-red-500 text-white shadow-lg' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="container mx-auto px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左侧主要功能区 */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 拼音学习卡片区 */}
            {activeTab === 'pinyin' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 wow fadeIn">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center">
                      <span className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full flex items-center justify-center mr-3">
                        🎵
                      </span>
                      拼音发音练习
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">点击卡片听标准发音</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
                      声母
                    </button>
                    <button className="px-4 py-2 bg-red-500 text-white rounded-full text-sm">
                      韵母
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {pinyinCards.map((card, index) => (
                    <div 
                      key={index}
                      className="group relative bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 text-center cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 wow fadeInUp"
                      onClick={() => playAudio(card.audio)}
                      data-wow-delay={`${index * 0.1}s`}
                    >
                      <div className="text-5xl font-bold text-red-600 dark:text-red-400 mb-3">{card.char}</div>
                      <div className="text-3xl font-mono text-gray-800 dark:text-white mb-2">{card.pinyin}</div>
                      <div className="text-lg text-gray-600 dark:text-gray-300">{card.meaning}</div>
                      <div className="mt-4 text-sm text-gray-500">
                        声母: {card.initial} | 韵母: {card.final}
                      </div>
                      <div className="absolute bottom-4 right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-lg">▶</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HSK单词浏览区 */}
            {activeTab === 'hsk-words' && (
              <div className="relative h-[600px] overflow-hidden rounded-2xl shadow-xl wow fadeIn">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>
                
                {/* 当前单词卡片 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8">
                  <div className="text-8xl font-bold mb-8 wow flipInX">{hskWords[currentWordIndex].chinese}</div>
                  <div className="text-4xl text-yellow-300 font-mono mb-4 wow fadeIn" data-wow-delay="0.2s">
                    {hskWords[currentWordIndex].pinyin}
                  </div>
                  <div className="text-3xl mb-6 wow fadeIn" data-wow-delay="0.3s">
                    {hskWords[currentWordIndex].meaning}
                  </div>
                  <div className="text-xl opacity-90 text-center mb-8 wow fadeIn" data-wow-delay="0.4s">
                    "{hskWords[currentWordIndex].example}"
                  </div>
                  <div className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full wow fadeIn" data-wow-delay="0.5s">
                    {hskWords[currentWordIndex].level}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-4 mt-12 wow fadeInUp" data-wow-delay="0.6s">
                    <button 
                      onClick={() => playAudio(hskWords[currentWordIndex].audio)}
                      className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30"
                    >
                      <span className="text-2xl">🔊</span>
                    </button>
                    <button className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30">
                      <span className="text-2xl">⭐</span>
                    </button>
                    <button className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30">
                      <span className="text-2xl">💬</span>
                    </button>
                  </div>
                </div>
                
                {/* 滑动提示 */}
                <div className="absolute bottom-10 left-0 right-0 text-center wow fadeInUp" data-wow-delay="0.8s">
                  <button 
                    onClick={nextWord}
                    className="w-16 h-16 rounded-full bg-white text-purple-600 flex items-center justify-center mx-auto shadow-lg hover:shadow-xl hover:scale-110 transition-all"
                  >
                    <span className="text-3xl">↓</span>
                  </button>
                  <p className="text-white/80 mt-4">向上滑动浏览下一个单词</p>
                </div>
              </div>
            )}

            {/* 语法讲解区 */}
            {activeTab === 'grammar' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 wow fadeIn">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <span className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full flex items-center justify-center mr-3">
                    📝
                  </span>
                  HSK语法详解
                </h2>
                
                <div className="grid gap-4">
                  {[
                    {
                      title: '是...的 结构',
                      level: 'HSK 3',
                      desc: '用于强调动作发生的时间、地点、方式等细节',
                      example: '我是昨天来的。',
                      explanation: '强调"来"的时间是"昨天"'
                    },
                    {
                      title: '把 字句',
                      level: 'HSK 4',
                      desc: '表示对宾语进行处置或影响',
                      example: '请把书放在桌子上。',
                      explanation: '强调"书"被放在"桌子上"这个处置结果'
                    },
                    {
                      title: '被 字句',
                      level: 'HSK 4',
                      desc: '表示被动意义，主语是动作的接受者',
                      example: '书被他拿走了。',
                      explanation: '主语"书"被动接受"拿走"这个动作'
                    }
                  ].map((grammar, index) => (
                    <div 
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-red-300 dark:hover:border-red-500 transition-colors wow fadeInUp"
                      data-wow-delay={`${index * 0.1}s`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold">{grammar.title}</h3>
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full text-sm">
                          {grammar.level}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">{grammar.desc}</p>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3">
                        <div className="text-lg font-medium text-gray-800 dark:text-white">
                          {grammar.example}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 mt-1">
                          {grammar.explanation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 练习区 */}
            {activeTab === 'practice' && (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-8 text-white wow fadeIn">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <span className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mr-3">
                    ✏️
                  </span>
                  每日练习
                </h2>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                  <h3 className="text-xl font-bold mb-4">选择题</h3>
                  <p className="mb-6 text-lg">我___学生。</p>
                  <div className="grid gap-3">
                    {['A. 是', 'B. 有', 'C. 在', 'D. 要'].map((option, idx) => (
                      <button 
                        key={idx}
                        className="w-full p-4 bg-white/20 hover:bg-white/30 rounded-lg text-left transition-all hover:translate-x-2"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm opacity-90">今日进度</p>
                    <div className="w-48 h-2 bg-white/30 rounded-full mt-2">
                      <div className="w-3/4 h-full bg-yellow-400 rounded-full"></div>
                    </div>
                    <p className="text-sm mt-1">5/7 完成</p>
                  </div>
                  <button className="px-6 py-3 bg-white text-green-600 rounded-full font-bold hover:bg-gray-100">
                    提交答案
                  </button>
                </div>
              </div>
            )}

            {/* 口语练习区 */}
            {activeTab === 'speaking' && (
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl p-8 text-white wow fadeIn">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <span className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mr-3">
                    🎤
                  </span>
                  口语跟读练习
                </h2>
                
                <div className="mb-8">
                  <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 mb-6">
                    <p className="text-2xl mb-4">"请问，去火车站怎么走？"</p>
                    <p className="opacity-90">Excuse me, how do I get to the train station?</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-8">
                    <button className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30">
                      <span className="text-3xl">🔊</span>
                    </button>
                    <button className="w-20 h-20 rounded-full bg-white text-purple-600 flex items-center justify-center shadow-lg hover:shadow-xl">
                      <span className="text-4xl">🎤</span>
                    </button>
                    <button className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30">
                      <span className="text-3xl">▶</span>
                    </button>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span>发音评分</span>
                    <span className="text-2xl font-bold">85/100</span>
                  </div>
                  <div className="text-sm opacity-90">
                    建议：注意"火车站"的连读发音
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* 右侧功能组件 - 原SideRight */}
          {/* 这里可以保持原有的SideRight组件，但我们要修改其内容为学习相关内容 */}
        </div>
      </div>

      {/* 价格/解释上拉覆盖层 */}
      {showPriceOverlay && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowPriceOverlay(false)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-h-[80vh] overflow-y-auto animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">学习计划与价格</h2>
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
                    className={`border rounded-2xl p-6 ${plan.popular ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200'}`}
                  >
                    {plan.popular && (
                      <div className="bg-red-500 text-white text-sm font-bold px-4 py-1 rounded-full inline-block mb-4">
                        最受欢迎
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold mb-4">{plan.price}</div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center">
                          <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 text-sm">
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full py-3 rounded-full font-bold ${
                      plan.popular 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                    }`}>
                      立即开始
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
   列表页 - 改为课程列表
========================= */
const LayoutPostList = props => {
  // 重写为课程列表展示
  return (
    <div className="px-5 md:px-0 py-8">
      <h1 className="text-3xl font-bold mb-8">中文学习课程</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'HSK 1 基础课程', lessons: 20, progress: 65, color: 'from-blue-500 to-cyan-500' },
          { title: '拼音发音大全', lessons: 15, progress: 30, color: 'from-green-500 to-emerald-500' },
          { title: '日常口语对话', lessons: 25, progress: 80, color: 'from-purple-500 to-pink-500' },
          { title: '汉字书写练习', lessons: 30, progress: 45, color: 'from-orange-500 to-red-500' },
          { title: '语法精讲', lessons: 18, progress: 90, color: 'from-indigo-500 to-purple-500' },
          { title: '商务中文', lessons: 22, progress: 10, color: 'from-teal-500 to-blue-500' },
        ].map((course, index) => (
          <div 
            key={index}
            className={`bg-gradient-to-br ${course.color} text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer`}
          >
            <h3 className="text-xl font-bold mb-4">{course.title}</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>进度</span>
                <span>{course.progress}%</span>
              </div>
              <div className="w-full h-2 bg-white/30 rounded-full">
                <div 
                  className="h-full bg-white rounded-full"
                  style={{ width: `${course.progress}%` }}
                ></div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>{course.lessons} 节课</span>
              <button className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30">
                继续学习 →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================
   搜索页 - 改为课程搜索
========================= */
const LayoutSearch = props => {
  const router = useRouter()
  const keyword = props.keyword || router.query?.s

  return (
    <div className="px-5 md:px-0 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索课程、单词、语法..."
            className="w-full p-4 pl-12 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            🔍
          </span>
        </div>
      </div>
      
      {!keyword ? (
        <div>
          <h2 className="text-2xl font-bold mb-6">热门搜索</h2>
          <div className="flex flex-wrap gap-3">
            {['拼音发音', 'HSK考试', '语法学习', '口语练习', '汉字书写', '听力训练'].map(tag => (
              <button
                key={tag}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <LayoutPostList {...props} />
      )}
    </div>
  )
}

/* =========================
   归档页 - 改为学习记录
========================= */
const LayoutArchive = props => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6">
      <h2 className="text-2xl font-bold mb-6">学习记录</h2>
      <div className="space-y-6">
        {[
          { month: '2024年1月', words: 150, hours: 45, level: 'HSK 3' },
          { month: '2023年12月', words: 120, hours: 40, level: 'HSK 2' },
          { month: '2023年11月', words: 100, hours: 35, level: 'HSK 2' },
        ].map((record, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-red-300 transition-colors">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold">{record.month}</h3>
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full">
                {record.level}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">学习单词</div>
                <div className="text-xl font-bold">{record.words}个</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">学习时长</div>
                <div className="text-xl font-bold">{record.hours}小时</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================
   文章页 - 改为课程详情页
========================= */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { fullWidth } = useGlobal()

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 xl:max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
              课
            </div>
            <div>
              <h1 className="text-3xl font-bold">HSK 1 课程介绍</h1>
              <div className="flex items-center text-gray-500 mt-2">
                <span className="mr-4">⏱️ 预计学习时间: 30小时</span>
                <span>📚 包含 150个单词</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">课程内容</h2>
            <div className="space-y-4">
              {[
                '基础拼音发音',
                '日常问候语',
                '数字和时间表达',
                '基本句型结构',
                '150个HSK 1核心词汇'
              ].map((item, index) => (
                <div key={index} className="flex items-center">
                  <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center mr-3 text-sm">
                    {index + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 原有NotionPage内容可以保留，作为课程详细内容 */}
        {!lock && post && (
          <>
            <NotionPage post={post} />
            <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <h3 className="text-xl font-bold mb-4">课程练习</h3>
              <button className="px-6 py-3 bg-red-500 text-white rounded-full font-bold hover:bg-red-600">
                开始本章练习 →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* =========================
   404 - 保持原样，添加中文
========================= */
const Layout404 = () => (
  <div className="h-[70vh] flex flex-col items-center justify-center">
    <h1 className="text-7xl font-black">404</h1>
    <p className="mt-4 text-gray-500">页面未找到 | Page Not Found</p>
    <SmartLink
      href="/"
      className="mt-6 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600"
    >
      返回首页
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
