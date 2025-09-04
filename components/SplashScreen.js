// components/SplashScreen.js
// 进站广告：视频版本（修复视频结束不关闭问题）

import { useState, useEffect, useRef, useCallback } from 'react';
import SmartLink from '@/components/SmartLink';

// --- 配置区域 ---
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/16fpFsbhh2/';
const VIDEO_SRC = '/images/kaipingshiping.mp4';
const SPLASH_DURATION_MS = 3000; // 闪屏总持续时间（毫秒）
const SKIP_BUTTON_DELAY_MS = 3000; // 跳过按钮延迟显示时间（毫秒）
// -----------------

const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(SPLASH_DURATION_MS / 1000);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const skipButtonTimerRef = useRef(null);
  const videoEndTimerRef = useRef(null); // 视频结束检测定时器
  const isHidingRef = useRef(false);

  // 统一的关闭逻辑
  const hideSplash = useCallback(() => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;
    
    clearTimeout(hideTimerRef.current);
    cancelAnimationFrame(animationFrameRef.current);
    clearTimeout(skipButtonTimerRef.current);
    clearTimeout(videoEndTimerRef.current);
    
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
    });

    // 视频播放结束事件处理
    const handleVideoEnd = () => {
      console.log("视频播放结束事件触发");
      hideSplash();
    };

    // 视频加载失败处理
    const handleVideoError = () => {
      console.error("视频加载失败");
      hideSplash();
    };

    // 视频元数据加载完成 - 获取视频时长
    const handleLoadedMetadata = () => {
      console.log("视频元数据加载完成，时长:", videoElement.duration);
      
      // 设置一个比视频时长稍长的定时器作为备用
      const videoDuration = videoElement.duration * 1000; // 转换为毫秒
      const bufferTime = 500; // 缓冲时间500ms
      
      videoEndTimerRef.current = setTimeout(() => {
        console.log("视频结束备用定时器触发");
        hideSplash();
      }, videoDuration + bufferTime);
    };

    // 添加事件监听
    videoElement.addEventListener('ended', handleVideoEnd);
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 精确倒计时
    const startTime = Date.now();
    
    const updateCountdown = () => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, SPLASH_DURATION_MS - elapsedTime);
      const remainingSeconds = Math.ceil(remainingTime / 1000);
      
      setCountdown(remainingSeconds);
      
      if (remainingTime > 0) {
        animationFrameRef.current = requestAnimationFrame(updateCountdown);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(updateCountdown);

    // 保险定时器
    hideTimerRef.current = setTimeout(() => {
      console.log("超时关闭闪屏");
      hideSplash();
    }, SPLASH_DURATION_MS);

    // 清理函数
    return () => {
      videoElement.removeEventListener('ended', handleVideoEnd);
      videoElement.removeEventListener('error', handleVideoError);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clearTimeout(hideTimerRef.current);
      cancelAnimationFrame(animationFrameRef.current);
      clearTimeout(skipButtonTimerRef.current);
      clearTimeout(videoEndTimerRef.current);
    };
  }, [hideSplash]);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[9999] transition-opacity duration-500 ease-out">
      {/* 视频区域可点击跳转Facebook */}
      <SmartLink href={FACEBOOK_PAGE_URL} className="block w-full h-full cursor-pointer">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          preload="auto"
        />
      </SmartLink>
      
      {/* 跳过按钮 - 3秒后才显示 */}
      {showSkipButton && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // 阻止事件冒泡，避免触发视频区域的跳转
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
