// themes/heo/components/BottomNavigationBar.js
import { useGlobal } from '@/lib/global'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import React from 'react'

/**
 * 底部固定导航栏 (仅在移动端显示，md:hidden)
 * @param {*} handleOpenAiAssistant - 用于打开AI助手的函数
 * @returns
 */
const BottomNavigationBar = ({ handleOpenAiAssistant }) => {
  const { locale } = useGlobal()
  const router = useRouter()

  const navItems = [
    { name: '主页', icon: 'fas fa-home', path: '/' },
    { name: 'AI 助手', icon: 'fas fa-robot', action: 'openAiAssistant' }, // 特殊处理，打开 AI 助手
    { name: '论坛', icon: 'fas fa-comments', path: 'https://www.facebook.com/share/g/15Fh7mrpa8/', target: '_blank' }, // 示例论坛链接，请替换为你的实际链接
    { name: '招聘', icon: 'fas fa-briefcase', path: '/jobs' }, // 示例招聘页面链接，请替换为你的实际链接
    { name: '书柜', icon: 'fas fa-book-open', path: 'https://books.843075.xyz', target: '_blank' } // 示例书柜链接，请替换为你的实际链接
  ]

  const isActive = (path) => {
    // 检查当前路由是否与导航项的路径匹配
    if (path === '/') {
      return router.pathname === '/'
    }
    // 对于其他路径，检查当前路由是否以该路径开头
    return router.pathname.startsWith(path)
  }

  return (
    <div
      id='bottom-navigation-bar'
      className='fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1e1e1e] border-t dark:border-gray-700 shadow-lg
                 flex justify-around items-center h-16 md:hidden' // md:hidden 表示在桌面端隐藏，如果需要桌面端也显示，请移除此样式
    >
      {navItems.map((item) => (
        item.action === 'openAiAssistant' ? (
          <button
            key={item.name}
            onClick={handleOpenAiAssistant}
            className='flex flex-col items-center justify-center p-2 text-center flex-grow
                       text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-yellow-500 transition-colors duration-200'
          >
            <i className={`${item.icon} text-xl mb-1`}></i>
            <span className='text-xs font-medium'>{item.name}</span>
          </button>
        ) : (
          <SmartLink
            key={item.name}
            href={item.path}
            target={item.target || '_self'}
            className={`flex flex-col items-center justify-center p-2 text-center flex-grow
                       ${isActive(item.path) ? 'text-indigo-600 dark:text-yellow-500' : 'text-gray-600 dark:text-gray-300'}
                       hover:text-indigo-500 dark:hover:text-yellow-500 transition-colors duration-200`}
          >
            <i className={`${item.icon} text-xl mb-1`}></i>
            <span className='text-xs font-medium'>{item.name}</span>
          </SmartLink>
        )
      ))}
    </div>
  )
}

export default BottomNavigationBar
