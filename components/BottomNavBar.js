// components/BottomNavBar.js
import { useRouter } from 'next/router'
import SmartLink from '@/components/SmartLink'
import { motion } from 'framer-motion' // 假设 framer-motion 存在

const BottomNavBar = ({ className, onAIAssistantClick }) => { // 接收一个点击事件
  const router = useRouter()
  const currentPath = router.pathname

  const navItems = [
    { path: '/', icon: 'fas fa-home', label: '主页' },
    // AI 助手不再是页面跳转，而是触发一个回调函数
    { path: '#ai', icon: 'fas fa-robot', label: 'AI助手', action: onAIAssistantClick }, 
    { path: '/books', icon: 'fas fa-book', label: '书籍' }
    // 暂时移除论坛
  ]

  // 定义哪些页面不显示底部导航 (例如，文章详情页)
  const hideOnRoutes = ['/posts/']
  if (hideOnRoutes.some(route => currentPath.startsWith(route))) {
    return null
  }

  return (
    <nav className={`fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex justify-around items-center z-50 md:hidden ${className || ''}`}>
      {navItems.map(item => (
        item.action ? (
          // 如果有 action，则渲染为 button
          <button key={item.path} onClick={item.action} className={`flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-indigo-400`}>
            <i className={`${item.icon} text-xl`}></i>
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ) : (
          // 否则，渲染为链接
          <SmartLink key={item.path} href={item.path} className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${currentPath === item.path ? 'text-indigo-500' : 'text-gray-500 hover:text-indigo-400'}`}>
            <i className={`${item.icon} text-xl`}></i>
            <span className="text-xs mt-1">{item.label}</span>
          </SmartLink>
        )
      ))}
    </nav>
  )
}

export default BottomNavBar
