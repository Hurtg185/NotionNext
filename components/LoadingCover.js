// components/ElegantLoadingCover.js (命名保持 LoadingCover.js 即可)
'use client'
import { useGlobal } from '@/lib/global'
import { useEffect, useState, useMemo, useCallback } from 'react'

/**
 * 网页加载动画 (已根据您的要求修改)
 * @returns
 */
const LoadingCover = ({ banners }) => {
  const { onLoading, setOnLoading } = useGlobal()
  const [show, setShow] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const [countdown, setCountdown] = useState(4) // 倒计时从4秒开始
  const [progress, setProgress] = useState(0)

  // 使用 useMemo 确保随机图片只在组件挂载时计算一次
  const randomBanner = useMemo(() => {
    if (banners && banners.length > 0) {
      return banners[Math.floor(Math.random() * banners.length)]
    }
    return null
  }, [banners])

  // 处理隐藏逻辑
  const handleHide = useCallback(() => {
    setFadeOut(true)
    setTimeout(() => {
      setShow(false)
      setOnLoading(false)
    }, 1000)
  }, [setOnLoading])

  // 倒计时效果和进度模拟
  useEffect(() => {
    if (!onLoading) {
      // 模拟加载进度
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const increment = Math.random() * 15
          const newProgress = prev + increment
          return newProgress > 100 ? 100 : newProgress
        })
      }, 300)
      
      // 倒计时
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            clearInterval(progressInterval)
            handleHide()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => {
        clearInterval(countdownInterval)
        clearInterval(progressInterval)
      }
    }
  }, [onLoading, handleHide])

  const loadingCoverStyle = {
    backgroundImage: randomBanner ? `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url("${randomBanner}")` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }

  if (!show) {
    return null
  }

  return (
    <div
      id='elegant-loading-cover'
      style={loadingCoverStyle}
      className={`
        fixed top-0 left-0 w-full h-full z-50 flex flex-col justify-center items-center
        ${!randomBanner && 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-700'}
        transition-all duration-1000
        ${fadeOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}
      `}
    >
      {/* 磨砂玻璃效果层 */}
      <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-md"></div>
      
      {/* 固定的跳过按钮 */}
      <button 
        onClick={handleHide}
        className="absolute top-6 right-6 z-20 px-4 py-2 bg-black bg-opacity-40 text-white text-sm rounded-full hover:bg-opacity-60 transition-all duration-200"
      >
        Skip {countdown > 0 && `(${countdown}s)`}
      </button>

      {/* 主内容容器 */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-6 text-center">
        
        {/* 品牌标识 (请将内容替换为您自己的) */}
        <div className="mb-8 transform transition-transform duration-700 hover:scale-105">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 p-1 shadow-xl">
            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">中</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-wide">中文培训中心</h1>
          <p className="text-lg text-white opacity-90 font-light">高效学习，连接未来</p>
        </div>
        
        {/* 环形进度条 */}
        <div className="relative w-32 h-32 mb-8">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              className="text-white opacity-20 stroke-current"
              strokeWidth="8"
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
            />
            <circle
              className="text-purple-400 stroke-current"
              strokeWidth="8"
              strokeLinecap="round"
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (progress / 100) * 251.2}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
          </div>
        </div>
        
        {/* 加载提示 */}
        <div className="w-full mb-8">
          <p className="text-white text-sm opacity-80 mb-3">正在加载精选内容...</p>
          
          {/* 点状加载动画 */}
          <div className="flex justify-center space-x-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 页脚品牌信息 (请将内容替换为您自己的) */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-white opacity-60">© {new Date().getFullYear()} 中文培训中心. 版权所有</p>
      </div>

      {/* 装饰性元素 */}
      <div className="absolute top-1/4 left-1/4 w-16 h-16 rounded-full bg-blue-400 opacity-20 blur-xl"></div>
      <div className="absolute bottom-1/3 right-1/4 w-20 h-20 rounded-full bg-purple-500 opacity-20 blur-xl"></div>
    </div>
  )
}

export default LoadingCover
