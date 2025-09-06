// themes/heo/components/Header.js (修改后 - 移除非固定逻辑)
import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import SlideOver from './SlideOver'
import LazyImage from '@/components/LazyImage'

/**
 * 页头：顶部导航 (简化版 - 非固定)
 * @param {*} props
 * @returns
 */
const Header = props => {
  const router = useRouter()
  const slideOverRef = useRef()

  const toggleMenuOpen = () => {
    slideOverRef?.current?.toggleSlideOvers()
  }

  // --- 在这里定义您的社交媒体按钮信息 ---
  const socialButtons = [
    { title: 'Facebook', url: 'https://www.facebook.com/share/16fpFsbhh2/', icon: 'fa-brands fa-facebook' },
    { title: 'TikTok', url: 'https://vt.tiktok.com/ZSHGDjda1hkwq-Pz4h9/', icon: 'fa-brands fa-tiktok' },
    { title: 'YouTube', url: 'https://www.youtube.com/YOUR_CHANNEL', icon: 'fa-brands fa-youtube' },
    { title: 'Telegram', url: 'https://t.me/+PVH4J-Mz5i81YzFl', icon: 'fa-brands fa-telegram' }
  ]
  // --- 定义结束 ---

  return (
    <>
      {/* 顶部导航菜单栏 */}
      <nav
        id='nav'
        className="z-20 h-16 w-full relative bg-white dark:bg-[#18171d] shadow text-black dark:text-white"
      >
        <div className='flex h-full mx-auto justify-between items-center max-w-[86rem] px-6'>
          {/* 左侧logo */}
          <Logo {...props} />

          {/* 中间菜单 (在非移动端显示) */}
          <div className='hidden lg:flex flex-grow items-center justify-center'>
            <MenuListTop {...props} />
          </div>

          {/* --- 右侧固定 --- */}
          <div className='flex flex-shrink-0 justify-end items-center space-x-1'>
            {/* 循环渲染社交按钮 */}
            {socialButtons.map(button => (
              <a
                key={button.title}
                href={button.url}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={button.title}
                className='p-2 cursor-pointer text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full w-9 h-9 flex items-center justify-center'
                title={button.title}
              >
                {button.icon && <i className={button.icon} />}
                {button.img && <LazyImage src={button.img} alt={button.title} className="w-6 h-6 object-contain" />}
              </a>
            ))}

            {/* 移动端菜单按钮 */}
            <div
              onClick={toggleMenuOpen}
              className='flex lg:hidden w-8 justify-center items-center h-8 cursor-pointer'>
              <i className='fas fa-bars' />
            </div>
          </div>
          {/* --- 修改结束 --- */}

          {/* 右边侧拉抽屉 */}
          <SlideOver cRef={slideOverRef} {...props} />
        </div>
      </nav>
    </>
  )
}

export default Header
