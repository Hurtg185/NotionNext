// components/LoadingCover.js (最终版 - 仅开屏动画)

'use client' // 确保这是一个客户端组件
import { useGlobal } from '@/lib/global'
import { useEffect, useState, useMemo } from 'react'

/**
 * 网页加载动画 (带随机背景图、自动消失和跳过按钮)
 * @returns
 */
const LoadingCover = ({ banners }) => {
  const { onLoading, setOnLoading } = useGlobal() // 获取 setOnLoading 来实现跳过
  const [show, setShow] = useState(true)
  const [fadeOut, setFadeOut] = useState(false) // 用于控制淡出动画

  // 自动消失的计时器（秒）
  const AUTO_HIDE_DELAY = 4 // 修改为4秒

  // 使用 useMemo 确保随机图片只在组件挂载时计算一次
  const randomBanner = useMemo(() => {
    if (banners && banners.length > 0) {
      return banners[Math.floor(Math.random() * banners.length)]
    }
    return null
  }, [banners])

  // 处理隐藏逻辑
  const handleHide = () => {
    setFadeOut(true) // 触发淡出动画
    setTimeout(() => {
      setShow(false) // 动画结束后彻底隐藏
      setOnLoading(false) // 确保全局加载状态也关闭
    }, 1000) // 淡出动画持续1秒
  }
  
  // 监听 onLoading 状态，当网站加载完成后，开始倒计时
  useEffect(() => {
    if (!onLoading) {
      // 网站内容已加载完成，等待 AUTO_HIDE_DELAY 秒后隐藏
      const timer = setTimeout(handleHide, AUTO_HIDE_DELAY * 1000)
      // 清理计时器，防止内存泄漏
      return () => clearTimeout(timer)
    }
  }, [onLoading])


  const loadingCoverStyle = {
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
      onClick={handleHide} // 给整个背景添加点击事件
      // 使用在 tailwind.config.js 中定义的动画
      className={`
        fixed top-0 left-0 w-full h-full z-50 flex justify-center items-center
        ${!randomBanner && 'bg-white dark:bg-black'}
        transition-opacity duration-1000
        ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        animate-ken-burns
        cursor-pointer
      `}
    >
      {/* 半透明遮罩层 */}
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      
      {/* 右上角跳过按钮 */}
      <button 
        onClick={(e) => {
          e.stopPropagation(); // 阻止事件冒泡，避免触发两次 handleHide
          handleHide();
        }}
        className="absolute top-6 right-6 z-10 px-4 py-2 bg-black bg-opacity-40 text-white text-sm rounded-full hover:bg-opacity-60 transition-all duration-200"
      >
        跳过 ({AUTO_HIDE_DELAY}s)
      </button>

      <div className="relative mx-auto pointer-events-none"> {/* 让加载动画不响应点击 */}
        {/* 加载动画 */}
        <style>
          {`
          .loader {
            width: 20px;
            aspect-ratio: 1;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 0 0 0 #fff4;
            animation: l2 1.5s infinite linear;
            position: relative;
          }
          .loader:before,
          .loader:after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            box-shadow: 0 0 0 0 #fff4;
            animation: inherit;
            animation-delay: -0.5s;
          }
          .loader:after {
            animation-delay: -1s;
          }
          @keyframes l2 {
            100% {
              box-shadow: 0 0 0 40px #0000;
            }
          }
          `}
        </style>
        <div className='loader'></div>
      </div>
    </div>
  )
}

export default LoadingCover
