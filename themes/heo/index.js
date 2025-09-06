// themes/heo/index.js (最终修复版 - 简化 AI 逻辑)
import Comment from '@/components/Comment'
import { AdSlot } from '@/components/GoogleAdsense'
import { HashTag } from '@/components/HeroIcons'
import LazyImage from '@/components/LazyImage'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import ShareBar from '@/components/ShareBar'
import WWAds from '@/components/WWAds'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'
import { isBrowser } from '@/lib/utils'
import { Transition } from '@headlessui/react'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
import FloatTocButton from './components/FloatTocButton'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import LatestPostsGroup from './components/LatestPostsGroup'
import { NoticeBar } from './components/NoticeBar'
import PostAdjacent from './components/PostAdjacent'
import PostCopyright from './components/PostCopyright'
import PostHeader from './components/PostHeader'
import { PostLock } from './components/PostLock'
import PostRecommend from './components/PostRecommend'
import SearchNav from './components/SearchNav'
import SideRight from './components/SideRight'
import CONFIG from './config'
import { Style } from './style'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import GlosbeSearchCard from '@/components/GlosbeSearchCard'
import AiChatAssistant from '@/components/AiChatAssistant'

// --- 新增导入 ---
import BottomNavBar from '@/components/BottomNavBar'

const XUANCHUAN_BANNERS = ['/images/xuanchuan3.jpg', '/images/xuanchuan4.jpg', '/images/xuanchuan5.jpg']

// --- 使用Portal的Modal组件，确保在顶层渲染 ---
const Modal = ({ isOpen, onClose, title, intro, children }) => {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])
  if (!isOpen || !isMounted) return null
  return createPortal(
    <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1000] p-4' onClick={onClose}>
      <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto animate-modal-pop' onClick={(e) => e.stopPropagation()}>
        <h3 className='text-xl font-bold mb-2 dark:text-gray-100'>{title}</h3>
        {intro && <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>{intro}</p>}
        <div className='space-y-3'>{children}</div>
        <button onClick={onClose} className='mt-6 w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200'>
          关闭
        </button>
      </div>
    </div>,
    document.body
  )
}

// --- 最稳定可靠的Portal实现 ---
const AIAssistantPortal = ({ onClose }) => {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])
  if (!isMounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-white dark:bg-gray-900">
      <AiChatAssistant onClose={onClose} />
    </div>,
    document.body
  )
}

/**
 * 基础布局
 */
const LayoutBase = props => {
  const { children, slotTop, className, post, onAIAssistantClick } = props // 接收 onAIAssistantClick
  const { fullWidth } = useGlobal()
  const router = useRouter()
  const isIndex = router.pathname === '/'
  const isSlugPage = post && post.slug
  
  // --- 修改 headerSlot，移除 sticky 样式 ---
  const headerSlot = (
    <header> {/* 这里不再有 sticky 或 fixed 样式 */}
      <Header {...props} />
      {isIndex ? (<><NoticeBar /><Hero {...props} /></>) : null}
      {isSlugPage && !fullWidth ? <PostHeader {...props} /> : null}
    </header>
  )
  
  const slotRight = router.route === '/404' || fullWidth ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]'
  
  useEffect(() => { loadWowJS() }, [])
  
  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />
      {headerSlot}
      <main id='wrapper-outer' className={`w-full ${maxWidth} mx-auto relative md:px-5 flex-grow`}>
        <div id='container-inner' className={`${siteConfig('HEO_HERO_BODY_REVERSE', false, CONFIG) ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
          <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          <div className='lg:px-2'></div>
          <div className='hidden xl:block'>{slotRight}</div>
        </div>
      </main>
      <BottomNavBar onAIAssistantClick={onAIAssistantClick} /> {/* 新增：添加底部导航栏 */}
      <Footer />
      {/* 底部导航栏会占用空间，添加一个占位符，防止内容被遮挡 */}
      <div className='h-16 md:hidden'></div> 
    </div>
  )
}

const FunctionButton = ({ title, icon, onClick, href, img, target }) => {
    const style = img ? { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}
    const iconColorClass = img ? 'text-white' : 'text-gray-500 dark:text-gray-300 group-hover:text-indigo-500 dark:group-hover:text-yellow-500'
    const textColorClass = img ? 'text-white' : 'text-gray-700 dark:text-gray-200'
    const content = (<>{img && <div className="absolute inset-0 bg-black bg-opacity-40 rounded-xl"></div>}<div className='relative z-10 flex flex-col items-center justify-center'><div className={`text-3xl ${iconColorClass} transition-colors duration-200`}><i className={icon} /></div><div className={`mt-2 text-sm font-semibold ${textColorClass}`}>{title}</div></div></>)
    if (href) { return (<SmartLink href={href} target={target} className='group relative flex flex-col justify-center items-center w-full h-24 bg-white dark:bg-[#1e1e1e] border dark:border-gray-700 rounded-xl shadow-md transform hover:scale-105 transition-transform duration-200 overflow-hidden' style={style}>{content}</SmartLink>)}
    return (<button onClick={onClick} className='group relative flex flex-col justify-center items-center w-full h-24 bg-white dark:bg-[#1e1e1e] border dark:border-gray-700 rounded-xl shadow-md transform hover:scale-105 transition-transform duration-200 overflow-hidden' style={style}>{content}</button>)
  }
  
const AIAssistantButton = ({ onClick }) => {
  return (<div className='px-5 md:px-0 my-4'><button onClick={onClick} className='w-full flex items-center justify-center p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg transform hover:scale-105 transition-transform duration-300'><i className='fas fa-robot text-2xl mr-3'></i><span className='text-lg font-bold'>与 AI 助手对话</span></button></div>)
}
  
const QuickAccessGrid = ({ setActiveModal }) => {
  const functions = [{ title: '报名课程', icon: 'fa-solid fa-graduation-cap', modal: 'enroll' }, { title: '找工作', icon: 'fa-solid fa-briefcase', modal: 'jobs' }, { title: '试看课程', icon: 'fa-solid fa-video', modal: 'trial' }]
  return (<div className='py-2'><div className='grid grid-cols-3 gap-4'>{functions.map(func => <FunctionButton key={func.title} title={func.title} icon={func.icon} onClick={() => setActiveModal(func.modal)} />)}</div></div>)
}
const AskQuestionModule = () => {
  const facebookGroupUrl = "https://www.facebook.com/share/g/15Fh7mrpa8/";
  return (<div className='py-4'><a href={facebookGroupUrl} target="_blank" rel="noopener noreferrer" className='group flex items-center justify-between p-4 bg-white dark:bg-[#1e1e1e] border dark:border-gray-700 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200'><div className='flex items-center'><i className='fas fa-question-circle text-3xl text-indigo-500 mr-4'></i><div><h3 className='font-bold text-lg dark:text-white'>提问交流</h3><p className='text-sm text-gray-500 dark:text-gray-400'>遇到学习问题？来这里和大家一起讨论！</p></div></div><i className='fas fa-arrow-right text-gray-400 group-hover:translate-x-1 transition-transform duration-200'></i></a></div>)
}
const StudyToolsGrid = ({ setActiveModal }) => {
  const functions = [{ title: '书籍', icon: 'fa-solid fa-book', href: 'https://books.843075.xyz' }, { title: '语法', icon: 'fa-solid fa-pen-ruler', modal: 'grammar' }, { title: '练习题', icon: 'fa-solid fa-file-pen', modal: 'exercises' }, { title: '生词', icon: 'fa-solid fa-spell-check', modal: 'vocabulary' }, { 'title': '短语', 'icon': 'fas fa-comments', modal: 'phrases' }, { 'title': '拼音', 'icon': 'fas fa-font', modal: 'pinyin' }]
  return (<div className='py-2'><div className='text-2xl font-bold mb-4 text-center dark:text-white'>学习工具</div><div className='grid grid-cols-3 gap-4'>{functions.map(func => <FunctionButton key={func.title} title={func.title} icon={func.icon} href={func.href} onClick={() => setActiveModal(func.modal)} />)}</div></div>)
}
const RandomImageCard = ({ banners, linkUrl, alt }) => {
  const randomImage = useMemo(() => { if (!banners || banners.length === 0) { return '/images/default-xuanchuan.jpg'; } return banners[Math.floor(Math.random() * banners.length)]; }, [banners]);
  return (<section className='mt-4'><SmartLink href={linkUrl || '#'}><div className='rounded-xl shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300'><LazyImage src={randomImage} alt={alt} className="w-full h-auto" /></div></SmartLink></section>)
}

/**
 * 首页
 */
const LayoutIndex = props => {
  const [activeModal, setActiveModal] = useState(null)
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)

  const handleOpenAssistant = useCallback(() => setIsAiAssistantOpen(true), [])
  const handleCloseAssistant = useCallback(() => setIsAiAssistantOpen(false), [])

  // 将打开 AI 助手的函数传递给 LayoutBase，以便底部导航栏可以调用
  props = { ...props, onAIAssistantClick: handleOpenAssistant }
  
  const modalContent = {
    enroll: { title: '报名课程', intro: '结合中缅教学方案，高效学习中文，价格比大部分缅甸机构更优惠！请通过以下方式联系我们，获取专属学习方案：', children: (<><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200'><i className='fab fa-telegram-plane text-xl mr-3'></i> <span className='font-semibold'>Telegram 联系</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-green-400 text-white hover:bg-green-500 transition-all duration-200'><i className='fab fa-line text-xl mr-3'></i> <span className='font-semibold'>Line 联系</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200'><i className='fab fa-viber text-xl mr-3'></i> <span className='font-semibold'>Viber 联系</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200'><i className='fab fa-facebook-f text-xl mr-3'></i> <span className='font-semibold'>Facebook 个人主页</span></SmartLink></>) },
    jobs: { title: '找工作', intro: '我们培训机构与上百家工厂长期合作，为您提供仰光、泰国、新加坡、马来西亚、中国等地的中文相关工作岗位！', children: (<><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>仰光地区招聘</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>泰国地区招聘</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>新加坡地区招聘</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>马来西亚地区招聘</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>中国地区招聘</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-green-500 text-white hover:bg-green-600 mt-2'>发布简历/咨询</SmartLink></>) },
    trial: { title: '试看课程', intro: '免费体验我们的教学质量，即刻开始您的中文学习之旅！', children: (<><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>入门发音课</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>HSK1 体验课</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>日常对话片段</SmartLink><SmartLink href='#' className='block p-2 text-center rounded bg-indigo-500 text-white hover:bg-indigo-600 mt-2'>查看更多试看</SmartLink></>) },
    notifications: { title: '加入通知群', intro: '获取最新课程优惠、免费资料、招聘信息、直播通知，重要消息不遗漏！', children: (<><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200'><i className='fab fa-telegram-plane text-xl mr-3'></i> <span className='font-semibold'>Telegram</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-green-400 text-white hover:bg-green-500 transition-all duration-200'><i className='fab fa-line text-xl mr-3'></i> <span className='font-semibold'>Line</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200'><i className='fab fa-viber text-xl mr-3'></i> <span className='font-semibold'>Viber</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200'><i className='fab fa-facebook-f text-xl mr-3'></i> <span className='font-semibold'>Facebook 个人主页</span></SmartLink><SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-black text-white hover:bg-gray-800 transition-all duration-200'><i className='fab fa-tiktok text-xl mr-3'></i> <span className='font-semibold'>TikTok</span></SmartLink></>) },
    grammar: { title: '语法学习', intro: '掌握中文语法结构，轻松构建句子！', children: ['基础句型', '动词时态', '量词用法', '介词短语', '比较句', '被动句', '疑问句', '复杂句式', '语法练习', '语法视频教程'].map(item => <SmartLink key={item} href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>{item}</SmartLink>) },
    exercises: { title: 'HSK练习题', intro: '巩固所学知识，挑战不同难度的 HSK 练习题！', children: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'].map(item => <SmartLink key={item} href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>{`${item} 练习`}</SmartLink>) },
    vocabulary: { title: 'HSK生词', intro: '按 HSK 等级分类的词汇表，助你高效记忆！', children: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'].map(item => <SmartLink key={item} href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>{`${item} 生词`}</SmartLink>) },
    phrases: { title: '常用短语', intro: '掌握常用中文短语，轻松应对日常交流！', children: ['打招呼', '购物', '问路', '点餐', '交通', '看医生', '银行', '酒店入住', '紧急情况', '日常对话'].map(item => <SmartLink key={item} href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>{item}</SmartLink>) },
    pinyin: { title: '拼音学习', intro: '快速掌握中文发音，从零开始学拼音！', children: ['拼音基础发音', '声母韵母表', '四声调学习', '拼音易错点', '拼音发音视频', '声调练习', '拼音输入法', '拼音口诀', '拼音学习App推荐', '免费拼音课程'].map(item => <SmartLink key={item} href='#' className='block p-2 text-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'>{item}</SmartLink>) }
  }
  const currentModal = modalContent[activeModal]

  return (
    <>
      <div id='post-outer-wrapper' className='px-5 md:px-0'>
        <CategoryBar {...props} />
        <AIAssistantButton onClick={handleOpenAssistant} />
        <div className='my-4'><GlosbeSearchCard /></div>
        <QuickAccessGrid setActiveModal={setActiveModal} />
        <AskQuestionModule />
        {siteConfig('POST_LIST_STYLE') === 'page' ? (<BlogPostListPage {...props} />) : (<BlogPostListScroll {...props} />)}
        <StudyToolsGrid setActiveModal={setActiveModal} />
        <RandomImageCard banners={XUANCHUAN_BANNERS} linkUrl="#" alt="课程价格与联系信息" />
      </div>

      <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={currentModal?.title} intro={currentModal?.intro}>
        {currentModal?.children}
      </Modal>

      {isAiAssistantOpen && <AIAssistantPortal onClose={handleCloseAssistant} />}
    </>
  )
}

/**博客列表*/
const LayoutPostList = props => {
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }
  return (
    <>
    <div id='post-outer-wrapper' className='px-5  md:px-0'>
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? (<BlogPostListPage {...props} />) : (<BlogPostListScroll {...props} />)}
    </div>
    {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
    </>
  )
}

/**搜索*/
const LayoutSearch = props => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s
  useEffect(() => {
    if (currentSearch) {
      setTimeout(() => {
        replaceSearchResult({
          doms: document.getElementsByClassName('replace'),
          search: currentSearch,
          target: { element: 'span', className: 'text-red-500 border-b border-dashed' }
        })
      }, 100)
    }
  }, [currentSearch])
  
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }

  return (
    <>
    <div currentSearch={currentSearch}>
      <div id='post-outer-wrapper' className='px-5  md:px-0'>
        {!currentSearch ? (<SearchNav {...props} />) : (
          <div id='posts-wrapper'>
            {siteConfig('POST_LIST_STYLE') === 'page' ? (<BlogPostListPage {...props} />) : (<BlogPostListScroll {...props} />)}
          </div>
        )}
      </div>
    </div>
    {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
    </>
  )
}

/**归档*/
const LayoutArchive = props => {
    const { archivePosts } = props
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
    props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }
    return (
      <>
      <div className='p-5 rounded-xl border dark:border-gray-600 max-w-6xl w-full bg-white dark:bg-[#1e1e1e]'>
        <CategoryBar {...props} border={false} />
        <div className='px-3'>
          {Object.keys(archivePosts).map(archiveTitle => (
            <BlogPostArchive key={archiveTitle} posts={archivePosts[archiveTitle]} archiveTitle={archiveTitle}/>
          ))}
        </div>
      </div>
      {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
      </>
    )
  }

/**文章详情*/
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { locale, fullWidth } = useGlobal()
  const [hasCode, setHasCode] = useState(false)
  const [activeModal, setActiveModal] = useState(null)
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }
  
  useEffect(() => {
    const hasCode = document.querySelectorAll('[class^="language-"]').length > 0
    setHasCode(hasCode)
  }, [])
  const commentEnable = siteConfig('COMMENT_TWIKOO_ENV_ID') || siteConfig('COMMENT_WALINE_SERVER_URL') || siteConfig('COMMENT_VALINE_APP_ID') || siteConfig('COMMENT_GISCUS_REPO') || siteConfig('COMMENT_CUSDIS_APP_ID') || siteConfig('COMMENT_UTTERRANCES_REPO') || siteConfig('COMMENT_GITALK_CLIENT_ID') || siteConfig('COMMENT_WEBMENTION_ENABLE')
  const router = useRouter()
  const waiting404 = siteConfig('POST_WAITING_TIME_FOR_404') * 1000
  useEffect(() => {
    if (!post) {
      setTimeout(() => {
        if (isBrowser) {
          const article = document.querySelector('#article-wrapper #notion-article')
          if (!article) {
            router.push('/404').then(() => {
              console.warn('找不到页面', router.asPath)
            })
          }
        }
      }, waiting404)
    }
  }, [post])
  const modalContent = {
    appDownload: { title: '安卓APP下载', intro: '下载我们的专属学习APP，随时随地高效学习中文！请按照以下步骤安装：', children: ( <div className='text-sm text-gray-700 dark:text-gray-300'> <a href='#' target='_blank' rel='noopener noreferrer' className='block w-full text-center p-3 rounded-lg bg-blue-500 text-white font-bold mb-4 hover:bg-blue-600 transition-colors'>点击此处下载安卓APP</a> <ol className='list-decimal list-inside space-y-2 text-left'> <li>点击上方链接下载APP文件。</li> <li>下载完成后，请断开网络（Wi-Fi和移动数据）。</li> <li>找到下载的APP文件（通常在“文件管理器”或“下载”文件夹），点击安装。</li> <li>如果提示“禁止安装未知来源应用”，请前往手机设置中允许安装。</li> <li>安装成功后，重新连接网络即可使用。</li> </ol> <a href='#' target='_blank' rel='noopener noreferrer' className='block text-center mt-4 text-blue-500 hover:underline'>查看详细图文/视频教程 →</a> </div> ) },
    notifications: { title: '加入通知群', intro: '获取最新课程优惠、免费资料、招聘信息、直播通知，重要消息不遗漏！', children: ( <> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200'><i className='fab fa-telegram-plane text-xl mr-3'></i> <span className='font-semibold'>Telegram</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-green-400 text-white hover:bg-green-500 transition-all duration-200'><i className='fab fa-line text-xl mr-3'></i> <span className='font-semibold'>Line</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200'><i className='fab fa-viber text-xl mr-3'></i> <span className='font-semibold'>Viber</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200'><i className='fab fa-facebook-f text-xl mr-3'></i> <span className='font-semibold'>Facebook 个人主页</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-black text-white hover:bg-gray-800 transition-all duration-200'><i className='fab fa-tiktok text-xl mr-3'></i> <span className='font-semibold'>TikTok</span></SmartLink> </> ) },
    moreCourses: { title: '报名课程', intro: '结合中缅教学方案，高效学习中文，价格比大部分缅甸机构更优惠！请通过以下方式联系我们，获取专属学习方案：', children: ( <> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200'><i className='fab fa-telegram-plane text-xl mr-3'></i> <span className='font-semibold'>Telegram 联系</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-green-400 text-white hover:bg-green-500 transition-all duration-200'><i className='fab fa-line text-xl mr-3'></i> <span className='font-semibold'>Line 联系</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200'><i className='fab fa-viber text-xl mr-3'></i> <span className='font-semibold'>Viber 联系</span></SmartLink> <SmartLink href='#' target='_blank' rel='noopener noreferrer' className='flex items-center p-3 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200'><i className='fab fa-facebook-f text-xl mr-3'></i> <span className='font-semibold'>Facebook 个人主页</span></SmartLink> </> ) }
  }
  const currentModal = modalContent[activeModal]
  return (
    <>
      <div className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xl'} ${hasCode ? 'xl:w-[73.15vw]' : ''}  bg-white dark:bg-[#18171d] dark:border-gray-600 lg:hover:shadow lg:border rounded-2xl lg:px-2 lg:py-4`}>
        {lock && <PostLock validPassword={validPassword} />}
        {!lock && post && (
          <div className='mx-auto md:w-full md:px-5'>
            <article id='article-wrapper' itemScope itemType='https://schema.org/Movie'>
              <div className='px-5'>
                <RandomImageCard banners={XUANCHUAN_BANNERS} linkUrl="#" alt="培训班简介" />
              </div>
              <section className='wow fadeInUp p-5 justify-center mx-auto' data-wow-delay='.2s'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post?.type === 'Post' && <PostCopyright {...props} />}
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>
              <ShareBar post={post} />
              <div className='bg-white shadow-md my-2 p-4 rounded-md dark:bg-black'>
                <div className='grid grid-cols-3 gap-3'>
                  <FunctionButton title="APP下载" icon="fas fa-mobile-alt" onClick={() => setActiveModal('appDownload')} />
                  <FunctionButton title="通知群" icon="fas fa-bell" onClick={() => setActiveModal('notifications')} />
                  <FunctionButton title="更多课程" icon="fas fa-chalkboard-teacher" onClick={() => setActiveModal('moreCourses')} />
                </div>
              </div>
              {post?.type === 'Post' && (
                <div className='px-5'>
                  <RandomImageCard banners={XUANCHUAN_BANNERS} linkUrl="/jobs" alt="招聘信息" />
                </div>
              )}
            </article>
            {fullWidth ? null : (
              <div className={`${commentEnable && post ? '' : 'hidden'}`}>
                <hr className='my-4 border-dashed' />
                <div className='py-2'><AdSlot /></div>
                <div className='duration-200 overflow-x-auto px-5'>
                  <div className='text-2xl dark:text-white'><i className='fas fa-comment mr-1' />{locale.COMMON.COMMENTS}</div>
                  <Comment frontMatter={post} className='' />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={currentModal?.title} intro={currentModal?.intro}>
        {currentModal?.children}
      </Modal>
      <FloatTocButton {...props} />
      {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
    </>
  )
}

/**404*/
const Layout404 = props => {
  const { onLoading, fullWidth } = useGlobal()
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }
  return (
    <>
      <main id='wrapper-outer' className={`flex-grow ${fullWidth ? '' : 'max-w-4xl'} w-screen mx-auto px-5`}>
        <div id='error-wrapper' className={'w-full mx-auto justify-center'}>
          <Transition show={!onLoading} appear={true} enter='transition ease-in-out duration-700 transform order-first' enterFrom='opacity-0 translate-y-16' enterTo='opacity-100' leave='transition ease-in-out duration-300 transform' leaveFrom='opacity-100 translate-y-0' leaveTo='opacity-0 -translate-y-16' unmount={false}>
            <div className='error-content flex flex-col md:flex-row w-full mt-12 h-[30rem] md:h-96 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-3xl'>
              <LazyImage className='error-img h-60 md:h-full p-4' src={'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'}></LazyImage>
              <div className='error-info flex-1 flex flex-col justify-center items-center space-y-4'>
                <h1 className='error-title font-extrabold md:text-9xl text-7xl dark:text-white'>404</h1>
                <div className='dark:text-white'>请尝试站内搜索寻找文章</div>
                <SmartLink href='/'><button className='bg-blue-500 py-2 px-4 text-white shadow rounded-lg hover:bg-blue-600 hover:shadow-md duration-200 transition-all'>回到主页</button></SmartLink>
              </div>
            </div>
            <div className='mt-12'><LatestPostsGroup {...props} /></div>
          </Transition>
        </div>
      </main>
      {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
    </>
  )
}

/**分类列表*/
const LayoutCategoryIndex = props => {
  const { categoryOptions } = props
  const { locale } = useGlobal()
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }
  return (
    <>
    <div id='category-outer-wrapper' className='mt-8 px-5 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>{locale.COMMON.CATEGORY}</div>
      <div id='category-list' className='duration-200 flex flex-wrap m-10 justify-center'>
        {categoryOptions?.map(category => {
          return (
            <SmartLink key={category.name} href={`/category/${category.name}`} passHref legacyBehavior>
              <div className={'group mr-5 mb-5 flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'}>
                <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />{category.name}
                <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>{category.count}</div>
              </div>
            </SmartLink>
          )
        })}
      </div>
    </div>
    {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
    </>
  )
}

/**标签列表*/
const LayoutTagIndex = props => {
  const { tagOptions } = props
  const { locale } = useGlobal()
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  props = { ...props, onAIAssistantClick: () => setIsAiAssistantOpen(true) }
  return (
    <>
    <div id='tag-outer-wrapper' className='px-5 mt-8 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>{locale.COMMON.TAGS}</div>
      <div id='tag-list' className='duration-200 flex flex-wrap space-x-5 space-y-5 m-10 justify-center'>
        {tagOptions.map(tag => {
          return (
            <SmartLink key={tag.name} href={`/tag/${tag.name}`} passHref legacyBehavior>
              <div className={'group flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'}>
                <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />{tag.name}
                <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>{tag.count}</div>
              </div>
            </SmartLink>
          )
        })}
      </div>
    </div>
    {isAiAssistantOpen && <AIAssistantPortal onClose={() => setIsAiAssistantOpen(false)} />}
    </>
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
