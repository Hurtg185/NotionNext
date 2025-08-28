// components/SplashScreen.js
// 进站广告：视频版本，并添加了可点击链接

import { useState, useEffect, useRef } from 'react';
import SmartLink from '@/components/SmartLink';

const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(3); // 初始倒计时时间设为 3 秒
  const videoRef = useRef(null); // 用于控制视频播放

  // --- 在这里定义您的 Facebook 公共主页链接 ---
  const facebookPageUrl = 'https://www.facebook.com/share/16fpFsbhh2/'; // <-- 替换为您真实的 Facebook 公共主页链接
  // --- 定义结束 ---

  // 定义视频路径和闪屏持续时间
  const videoSrc = '/images/kaipingshiping.mp4'; // <-- 确保您的视频在此路径，且命名为 kaipingshiping.mp4
  const splashDuration = 3000; // 闪屏总持续时间设为 3 秒 (3000毫秒)

  // 统一的隐藏闪屏逻辑
  const hideSplash = () => {
    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');
  };

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplashScreen');
    let interval;
    let timer;

    if (!hasSeenSplash) {
      setShow(true);
      setCountdown(splashDuration / 1000); // 根据总时长设置倒计时初始值

      const videoElement = videoRef.current;

      // 确保在组件卸载时清理所有副作用
      const cleanup = () => {
        clearTimeout(timer);
        clearInterval(interval);
        if (videoElement) {
          videoElement.onended = null;
          videoElement.oncanplay = null;
        }
      };

      if (videoElement) {
        // 当视频准备好播放时，尝试播放
        const tryPlayVideo = () => {
          videoElement.play().catch(error => {
            console.warn("Video autoplay failed (onCanPlay):", error);
            // 自动播放失败，但闪屏依然会根据计时器关闭
          });
        };

        // 监听视频准备好播放的事件
        videoElement.oncanplay = tryPlayVideo;
        
        // 如果视频已经准备好 (例如，从缓存加载)，立即尝试播放
        if (videoElement.readyState >= 3) { // HTMLMediaElement.HAVE_FUTURE_DATA 或更高
          tryPlayVideo();
        }

        // 监听视频播放结束事件，如果视频比倒计时短，就提前关闭闪屏
        videoElement.onended = hideSplash;
      }

      // 倒计时逻辑
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 确保闪屏在指定时间后关闭，无论视频是否播放完毕
      timer = setTimeout(hideSplash, splashDuration);

      return cleanup; // 返回清理函数
    }
  }, []); // 空依赖数组表示只在组件首次挂载时运行一次

  if (!show) {
    return null; // 如果不显示，则不渲染任何内容
  }

  return (
    // 全屏覆盖的容器
    <div
      className={`fixed top-0 left-0 w-full h-full bg-black z-[9999] transition-opacity duration-500 ease-out ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <SmartLink href={facebookPageUrl} className="block w-full h-full">
        {/* 您的广告视频 */}
        <video
          ref={videoRef}
          src={videoSrc}
          alt="课程推广视频"
          className="w-full h-full object-cover"
          muted // 建议默认静音，避免突兀的声音
          playsInline // iOS Safari 上的重要属性，允许内联播放
          autoplay // <-- 新增：直接在标签上添加 autoplay 属性
          // loop // 视频闪屏不建议循环，除非它非常短且无缝
          preload="auto" // 预加载视频以加快播放
        />
      </SmartLink>
      
      {/* 为“跳过”按钮的 onClick 添加 e.stopPropagation() */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // 阻止点击事件冒泡到 SmartLink
          hideSplash(); // 使用统一的隐藏逻辑
        }}
        className="absolute top-4 right-4 bg-black/30 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm"
      >
        跳过 {countdown > 0 && `(${countdown}s)`} {/* 显示倒计时 */}
      </button>
    </div>
  );
};

export default SplashScreen;
