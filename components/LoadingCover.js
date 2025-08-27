// components/LoadingCover.js (最终版 - 随机背景图 + 粒子动画 + 自动消失 + 跳过按钮 + 背景点击跳转)

'use client' // 确保这是一个客户端组件
import { useGlobal } from '@/lib/global'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Script from 'next/script' // 引入 Script 组件来加载外部 JS
import SmartLink from '@/components/SmartLink' // 引入 SmartLink 组件

/**
 * 网页加载动画 (带随机背景图、粒子动画、自动消失和跳过按钮)
 * @returns
 */
const LoadingCover = ({ banners }) => {
  const { onLoading, setOnLoading } = useGlobal()
  const [show, setShow] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const [countdown, setCountdown] = useState(4) // 倒计时从4秒开始
  const [particlesLoaded, setParticlesLoaded] = useState(false) // 跟踪粒子JS是否加载

  const AUTO_HIDE_DELAY = 4 // 自动消失的计时器（秒）

  // 您的 Facebook 公共主页链接
  const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/19i8LuEVXu' 

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
  
  // 监听 onLoading 状态，当网站加载完成后，开始倒计时
  useEffect(() => {
    if (!onLoading) {
      const timer = setTimeout(handleHide, AUTO_HIDE_DELAY * 1000)
      return () => clearTimeout(timer)
    }
  }, [onLoading, handleHide])

  // 当 particles.js 脚本加载完成后，初始化粒子效果
  const handleParticlesLoad = useCallback(() => {
    if (window.particlesJS && !particlesLoaded) { // 确保只初始化一次
      window.particlesJS('particles-js', {
        "particles": {
          "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
          "color": { "value": "#ffffff" },
          "shape": { "type": "circle", "stroke": { "width": 0, "color": "#000000" }, "polygon": { "nb_sides": 5 } },
          "opacity": { "value": 0.5, "random": false, "anim": { "enable": false, "speed": 1, "opacity_min": 0.1, "sync": false } },
          "size": { "value": 3, "random": true, "anim": { "enable": false, "speed": 40, "size_min": 0.1, "sync": false } },
          "line_linked": { "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.4, "width": 1 },
          "move": { "enable": true, "speed": 2, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false, "attract": { "enable": false, "rotateX": 600, "rotateY": 1200 } }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
          "modes": { "grab": { "distance": 400, "line_linked": { "opacity": 1 } }, "bubble": { "distance": 400, "size": 40, "duration": 2, "opacity": 8, "speed": 3 }, "repulse": { "distance": 200, "duration": 0.4 }, "push": { "particles_nb": 4 }, "remove": { "particles_nb": 2 } }
        },
        "retina_detect": true
      });
      setParticlesLoaded(true);
    }
  }, [particlesLoaded]);


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
    <>
      {/* 引入 particles.js 库 */}
      <Script
        src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"
        onLoad={handleParticlesLoad}
      />

      <SmartLink href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" 
        className={`
          fixed top-0 left-0 w-full h-full z-50 flex justify-center items-center
          ${!randomBanner && 'bg-white dark:bg-black'}
          transition-opacity duration-1000
          ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          cursor-pointer
        `}
        style={loadingCoverStyle}
        onClick={(e) => {
          e.stopPropagation(); // 阻止 SmartLink 默认的路由跳转，以便手动处理
          handleHide(); // 关闭 LoadingCover
          // 实际的跳转由 SmartLink 自动处理
        }}
      >
        {/* 粒子动画的容器 */}
        <div id="particles-js" className="absolute top-0 left-0 w-full h-full"></div>

        {/* 右上角跳过按钮 */}
        <button 
          onClick={(e) => {
            e.stopPropagation(); // 阻止事件冒泡
            handleHide(); // 仅关闭 LoadingCover，不触发外部链接
          }}
          className="absolute top-6 right-6 z-20 px-4 py-2 bg-black bg-opacity-40 text-white text-sm rounded-full hover:bg-opacity-60 transition-all duration-200"
        >
          Skip {countdown > 0 && `(${countdown}s)`}
        </button>

        <div className="relative mx-auto pointer-events-none z-10"> {/* 让加载动画不响应点击，并确保在粒子上方 */}
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
      </SmartLink>
    </>
  )
}

export default LoadingCover
