// themes/heo/components/Footer.js (示例 - 确保有足够的底部内边距)
import { siteConfig } from '@/lib/config'
import React from 'react'
import { useGlobal } from '@/lib/global'

const Footer = ({ meta }) => {
  const { locale } = useGlobal()

  return (
    // 确保 pb-20 (或更大的值) 足够为 h-16 的底部导航栏腾出空间
    // `pb-safe` 也是一个好选择，通常在移动端会自动加上底部安全区
    <footer className='relative w-full bg-white dark:bg-[#18171d] pt-8 pb-20'> 
      <div className='text-center text-gray-500 dark:text-gray-400 text-sm'>
        {/* 你的页脚内容 */}
      </div>
    </footer>
  )
}

export default Footer
