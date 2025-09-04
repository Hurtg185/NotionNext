// components/SplashScreen.js
// 进站广告：视频版本（修复视频结束不关闭问题）

import { useState, useEffect, useRef, useCallback } from 'react';
import SmartLink from '@/components/SmartLink';

// --- 配置区域 ---
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/16fpFsbhh2/';
const VIDEO_SRC = '/images/kaipingshiping.mp4';
// 移除 SPLASH_DURATION_MS，因为时长应由视频决定
// const SPLASH_DURATION_MS = 3000; // 导致问题的配置
const SKIP_BUTTON_DELAY_MS = 3000; // 跳过按钮延迟显示时间（毫秒）
// -----------------

const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(0); // 初始倒计时设为0
  const [showSkipButton, setShowSkipButton] = useState(false);
  const videoRef = useRef(null);
  const animationFrameRef = useRef(null);
  const skipButtonTimerRef = useRef(null);
  const backupCloseTimerRef = useRef(null); // 重命名以明确其作用
  const isHidingRef = useRef(false);

  // 统一的关闭逻辑
  const hideSplash = useCallback(() => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;
    
    // 清理所有定时器和动画帧
    cancelAnimationFrame(animationFrameRef.current);
    clearTimeout(skipButtonTimerRef.current);
    clearTimeout(backupCloseTimerRef.current);
    
    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');
  }, []);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplashScreen');
    if (hasSeenSplash) return;

    setShow(true);

    // 设置跳过按钮延迟显示
    skipButtonTimerRef.current = setTimeout(() => {
      setShowSkipButton(true);
    }, SKIP_BUTTON_DELAY_MS);

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // 尝试播放视频
    videoElement.play().catch(error => {
      console.warn("视频自动播放被浏览器阻止:", error);
      // 如果播放失败，立即关闭闪屏
      hideSplash();
    });

    // 视频播放结束事件处理 (这是最主要的关闭方式)
    const handleVideoEnd = () => {
      console.log("视频播放结束事件触发，关闭闪屏");
      hideSplash();
    };

    // 视频加载失败处理
    const handleVideoError = (e) => {
      console.error("视频加载或播放失败", e);
      hideSplash();
    };

    // 视频元数据加载完成 - 获取视频时长并启动倒计时
    const handleLoadedMetadata = () => {
      const videoDuration = videoElement.duration;
      console.log("视频元数据加载完成，时长:", videoDuration);

      // 1. 设置备用关闭定时器（比视频时长稍长一点，作为保险）
      const bufferTimeMs = 500; // 500ms 缓冲
      backupCloseTimerRef.current = setTimeout(() => {
        console.log("备用关闭定时器触发");
        hideSplash();
      }, (videoDuration * 1000) + bufferTimeMs);

      // 2. 启动精确的倒计时显示
      const startTime = Date.now();
      const totalDurationMs = videoDuration * 1000;
      
      const updateCountdown = () => {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, totalDurationMs - elapsedTime);
        const remainingSeconds = Math.ceil(remainingTime / 1000);
        
        setCountdown(remainingSeconds);
        
        if (remainingTime > 0) {
          animationFrameRef.current = requestAnimationFrame(updateCountdown);
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(updateCountdown);
    };

    // 添加事件监听
    videoElement.addEventListener('ended', handleVideoEnd);
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 清理函数
    return () => {
      // 确保在组件卸载时移除监听器
      videoElement.removeEventListener('ended', handleVideoEnd);
      videoElement.removeEventListener('error', handleVideoError);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      
      // 清理所有定时器和动画帧
      cancelAnimationFrame(animationFrameRef.current);
      clearTimeout(skipButtonTimerRef.current);
      clearTimeout(backupCloseTimerRef.current);
    };
  }, [hideSplash]);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[9999] transition-opacity duration-500 ease-out">
      <SmartLink href={FACEBOOK_PAGE_URL} className="block w-full h-full cursor-pointer">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          className="w-full h-full object-cover"
          autoPlay
          muted // 自动播放通常需要静音
          playsInline // 对移动端友好
          preload="auto"
        />
      </SmartLink>
      
      {showSkipButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            hideSplash();
          }}
          className="absolute top-5 right-5 bg-black/40 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
        >
          跳过 {countdown > 0 ? `(${countdown})` : ''}
        </button>
      )}
    </div>
  );
};

export default SplashScreen;
