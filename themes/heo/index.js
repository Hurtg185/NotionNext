// components/LoadingCover.js

import { useGlobal } from '@/lib/global'
import { useEffect, useState, useMemo } from 'react'
import Loading from './Loading'

/**
 * 网页加载动画
 * @returns
 */
const LoadingCover = ({ banners }) => {
  const { onLoading } = useGlobal()
  const [show, setShow] = useState(true)

  // 使用 useMemo 确保随机图片只在 banners 变化时重新计算一次
  const randomBanner = useMemo(() => {
    if (banners && banners.length > 0) {
      return banners[Math.floor(Math.random() * banners.length)]
    }
    return null // 如果没有 banners，则返回 null
  }, [banners])

  useEffect(() => {
    if (!onLoading) {
      // 延迟 1 秒后隐藏，让动画更平滑
      setTimeout(() => {
        setShow(false)
      }, 1000)
    }
  }, [onLoading])

  const loadingCoverStyle = {
    // 如果有随机图片，则设置为背景
    backgroundImage: randomBanner ? `url("${randomBanner}")` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }

  if (!show) {
    return null
  }

  return (
    <div
      id='loading-cover'
      style={loadingCoverStyle}
      className={`fixed top-0 left-0 w-full h-full z-50 flex justify-center items-center
      ${onLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      transition-opacity duration-1000 ${!randomBanner && 'bg-white dark:bg-black'}`}
    >
      {/* 如果有随机图片，则添加一个半透明遮罩层 */}
      {randomBanner && <div className="absolute inset-0 bg-black bg-opacity-50"></div>}
      
      <div className="relative">
        <Loading />
      </div>
    </div>
  )
}

export default LoadingCover
