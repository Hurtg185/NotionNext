/**
 * 中文学习平台 - 主页布局
 */

import { useState } from 'react'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import CONFIG from './config'

import Header from './components/Header'
import Footer from './components/Footer'
import SideRight from './components/SideRight'
import { NoticeBar } from './components/NoticeBar'
import { Style } from './style'

import LoadingCover from '@/components/LoadingCover'

/* =========================
   基础布局
========================= */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth } = useGlobal()
  const router = useRouter()

  const showSide = !(router.route === '/404' || fullWidth)

  return (
    <div
      id="theme-heo-chinese"
      className={`${siteConfig('FONT_STYLE')} min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800`}
    >
      <Style />
      
      {/* 简化Header */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">中</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  ChineseMaster
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">智能中文学习平台</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 语言切换 */}
              <div className="hidden md:block">
                <select className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="en">🇺🇸 English</option>
                  <option value="zh">🇨🇳 中文</option>
                  <option value="ja">🇯🇵 日本語</option>
                  <option value="ko">🇰🇷 한국어</option>
                </select>
              </div>
              
              {/* 登录/注册 */}
              <div className="flex items-center space-x-3">
                <button className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400">
                  登录
                </button>
                <button className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full font-medium hover:shadow-lg hover:scale-105 transition-all">
                  免费试用
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 通知栏（可选） */}
      {router.route === '/' && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <div className="container mx-auto px-4 py-2 text-center text-sm">
            🎉 新用户首月免费！立即开始你的中文学习之旅 →
          </div>
        </div>
      )}

      <main className="flex-grow">
        {slotTop}
        
        <div className="w-full max-w-[96rem] mx-auto px-4 py-8">
          <div className="flex">
            <div className={`flex-1 ${className || ''}`}>
              {children}
            </div>

            {showSide && (
              <aside className="hidden xl:block w-[320px] ml-6">
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
const LayoutIndex = () => {
  const [activeTab, setActiveTab] = useState('pinyin')
  const [showPriceOverlay, setShowPriceOverlay] = useState(false)

  // 静态数据 - 占位用
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
    <div className="chinese-platform">
      {/* Hero 区域 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="relative container mx-auto px-4 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            轻松学习中文
            <br />
            <span className="text-yellow-200">从零开始到流利掌握</span>
          </h1>
          
          <p className="text-xl text-white/90 mb-10 max-w-3xl mx-auto">
            智能拼音学习 • HSK分级课程 • 语法精讲 • 口语练习 • 实时评测
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <button 
              onClick={() => setShowPriceOverlay(true)}
              className="px-8 py-4 bg-white text-red-600 rounded-full text-lg font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              🚀 立即免费开始
            </button>
            <button className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full text-lg font-bold hover:bg-white/10 transition-all">
              📚 查看课程介绍
            </button>
          </div>
          
          {/* 统计数据 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { label: '活跃学员', value: '10,000+' },
              { label: '课程数量', value: '200+' },
              { label: '单词总数', value: '5,000+' },
              { label: '平均进步', value: '85%' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* 波浪装饰 */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-auto">
            <path fill="#ffffff" fillOpacity="1" d="M0,64L80,58.7C160,53,320,43,480,48C640,53,800,75,960,74.7C1120,75,1280,53,1360,42.7L1440,32L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"></path>
          </svg>
        </div>
      </section>

      {/* 功能导航 */}
      <div className="sticky top-16 z-40 bg-white dark:bg-gray-900 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto py-4 space-x-1 scrollbar-hide">
            {[
              { id: 'pinyin', label: '拼音学习', icon: '🔊' },
              { id: 'hsk-words', label: 'HSK单词', icon: '📚' },
              { id: 'grammar', label: '语法讲解', icon: '📝' },
              { id: 'practice', label: '练习题库', icon: '✏️' },
              { id: 'speaking', label: '口语练习', icon: '🎤' },
              { id: 'hsk-test', label: '模拟考试', icon: '📊' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-5 py-3 rounded-full whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="mr-2 text-lg">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左侧主要功能区 */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 拼音学习卡片区 */}
            {activeTab === 'pinyin' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center">
                        <span className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full flex items-center justify-center mr-3">
                          🔊
                        </span>
                        拼音发音练习
                      </h2>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">点击卡片听标准发音，学习正确读法</p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">声母</button>
                      <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm">韵母</button>
                      <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">声调</button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pinyinCards.map(card => (
                      <div 
                        key={card.id}
                        className="group relative bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 text-center cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-500 transition-all duration-300"
                      >
                        <div className="text-5xl font-bold text-gray-800 dark:text-white mb-3">{card.char}</div>
                        <div className="text-2xl font-mono text-red-600 dark:text-red-400 mb-2">{card.pinyin}</div>
                        <div className="text-gray-600 dark:text-gray-300">{card.meaning}</div>
                        <div className="absolute bottom-3 right-3 w-8 h-8 bg-white dark:bg-gray-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          ▶
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* HSK单词浏览区 */}
            {activeTab === 'hsk-words' && (
              <div className="relative h-[500px] overflow-hidden rounded-2xl shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8">
                  <div className="text-center">
                    <div className="text-7xl md:text-8xl font-bold mb-6">{hskWords[0].chinese}</div>
                    <div className="text-3xl md:text-4xl text-yellow-200 font-mono mb-4">{hskWords[0].pinyin}</div>
                    <div className="text-2xl md:text-3xl mb-6">{hskWords[0].meaning}</div>
                    <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full inline-block">
                      {hskWords[0].level}
                    </div>
                  </div>
                </div>
                
                {/* 操作按钮 */}
                <div className="absolute bottom-8 left-0 right-0">
                  <div className="flex justify-center space-x-4">
                    <button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30">
                      🔊
                    </button>
                    <button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30">
                      ⭐
                    </button>
                    <button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30">
                      💬
                    </button>
                  </div>
                  
                  <div className="text-center mt-6">
                    <button className="w-14 h-14 bg-white text-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg hover:shadow-xl">
                      ↓
                    </button>
                    <p className="text-white/80 mt-2 text-sm">向上滑动浏览下一个单词</p>
                  </div>
                </div>
              </div>
            )}

            {/* 语法讲解区 */}
            {activeTab === 'grammar' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold flex items-center">
                    <span className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full flex items-center justify-center mr-3">
                      📝
                    </span>
                    HSK语法详解
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-6">
                    {grammarPoints.map(point => (
                      <div 
                        key={point.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-red-300 dark:hover:border-red-500 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-bold">{point.title}</h3>
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full text-sm">
                            {point.level}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{point.description}</p>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                          <div className="text-gray-800 dark:text-white">
                            例句: 我是昨天<strong>的</strong>。
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 练习题库 */}
            {activeTab === 'practice' && (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 text-white">
                  <h2 className="text-2xl font-bold flex items-center mb-6">
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
                          className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-lg text-left transition-all hover:translate-x-2"
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
                    </div>
                    <button className="px-6 py-3 bg-white text-green-600 rounded-full font-bold">
                      提交答案
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 口语练习 */}
            {activeTab === 'speaking' && (
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 text-white">
                  <h2 className="text-2xl font-bold flex items-center mb-6">
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
                    
                    <div className="flex items-center justify-center space-x-8">
                      <button className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30">
                        🔊
                      </button>
                      <button className="w-16 h-16 bg-white text-purple-600 rounded-full flex items-center justify-center shadow-lg">
                        🎤
                      </button>
                      <button className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30">
                        ▶
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
              </div>
            )}

            {/* 模拟考试 */}
            {activeTab === 'hsk-test' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <span className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full flex items-center justify-center mr-3">
                    📊
                  </span>
                  HSK模拟考试
                </h2>
                
                <div className="space-y-6">
                  {[
                    { level: 'HSK 1', questions: 40, time: '40分钟', completed: true },
                    { level: 'HSK 2', questions: 60, time: '55分钟', completed: true },
                    { level: 'HSK 3', questions: 80, time: '90分钟', completed: false },
                    { level: 'HSK 4', questions: 100, time: '100分钟', completed: false },
                  ].map((test, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-red-300 transition-colors">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{test.level}</h3>
                          <p className="text-gray-500 dark:text-gray-400">
                            {test.questions} 道题 • {test.time}
                          </p>
                        </div>
                        {test.completed ? (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full text-sm">
                            已完成
                          </span>
                        ) : (
                          <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                            开始考试
                          </button>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        包含：听力、阅读、写作
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* 右侧侧边栏 - 使用原SideRight组件但修改内容 */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* 学习统计 */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <span className="w-8 h-8 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full flex items-center justify-center mr-2">
                    📈
                  </span>
                  学习统计
                </h3>
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
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>语法进度</span>
                      <span>65%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="w-2/3 h-full bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 今日目标 */}
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-xl p-6 text-white">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <span className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mr-2">
                    🎯
                  </span>
                  今日目标
                </h3>
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

              {/* 热门课程 */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <span className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center mr-2">
                    🔥
                  </span>
                  热门课程
                </h3>
                <div className="space-y-3">
                  {[
                    { title: 'HSK 1 速成班', students: '2.5k' },
                    { title: '拼音发音精讲', students: '1.8k' },
                    { title: '日常口语对话', students: '3.2k' },
                    { title: '商务中文', students: '890' },
                  ].map((course, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <span className="font-medium">{course.title}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{course.students}人学习</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 价格上拉覆盖层 */}
      {showPriceOverlay && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl w-full max-h-[80vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">选择学习计划</h2>
                <button 
                  onClick={() => setShowPriceOverlay(false)}
                  className="text-2xl hover:text-red-600"
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
                    color: 'from-gray-400 to-gray-600',
                    features: ['每日10个单词', '基础拼音练习', 'HSK 1-2语法', '社区交流']
                  },
                  {
                    name: '标准版',
                    price: '¥99/月',
                    color: 'from-red-500 to-orange-500',
                    popular: true,
                    features: ['无限单词学习', '完整拼音系统', 'HSK 1-4全套', '发音评测', '每日练习']
                  },
                  {
                    name: '专业版',
                    price: '¥299/月',
                    color: 'from-purple-500 to-pink-500',
                    features: ['所有标准版功能', '1对1口语辅导', 'HSK 5-6高级内容', '定制学习计划', '证书认证']
                  }
                ].map((plan, idx) => (
                  <div 
                    key={idx}
                    className={`border rounded-2xl p-6 ${plan.popular ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    {plan.popular && (
                      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold px-4 py-1 rounded-full inline-block mb-4">
                        最受欢迎
                      </div>
                    )}
                    <div className={`w-16 h-16 ${plan.color} rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-4`}>
                      {plan.name.charAt(0)}
                    </div>
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold mb-4">{plan.price}</div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center">
                          <span className="w-5 h-5 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center mr-3 text-sm">
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full py-3 rounded-full font-bold transition-all ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg' 
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
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

// 其他布局组件暂时保持原样
const LayoutPostList = props => <div>...</div>
const LayoutSearch = props => <div>...</div>
const LayoutArchive = props => <div>...</div>
const LayoutSlug = props => <div>...</div>
const Layout404 = () => <div>...</div>

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
