// components/BottomNavBar.js
import { useRouter } from 'next/router'
import SmartLink from '@/components/SmartLink'

const BottomNavBar = ({ onAIAssistantClick }) => {
  const router = useRouter()
  const currentPath = router.pathname

  const navItems = [
    { path: '/', icon: 'fas fa-home', label: '主页' },
    // 将 AI 助手改为页面跳转
    { path: '/ai', icon: 'fas fa-robot', label: 'AI助手' }, 
    { path: '/books', icon: 'fas fa-book', label: '书籍' } // 假设书籍有独立页面
  ]

  const hideOnRoutes = ['/posts/']
  if (hideOnRoutes.some(route => currentPath.startsWith(route))) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex justify-around items-center z-50 md:hidden">
      {navItems.map(item => (
        <SmartLink key={item.path} href={item.path} className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${currentPath === item.path ? 'text-indigo-500' : 'text-gray-500 hover:text-indigo-400'}`}>
          <i className={`${item.icon} text-xl`}></i>
          <span className="text-xs mt-1">{item.label}</span>
        </SmartLink>
      ))}
    </nav>
  )
}

export default BottomNavBar
