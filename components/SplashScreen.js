// components/SplashScreen.js
// 进站广告：视频版本（最终修复版）

import { useState, useEffect, useRef, useCallback } from 'react';
import SmartLink from '@/components/SmartLink';

// --- 配置区域 ---
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/16fpFsbhh2/';
const VIDEO_SRC = '/images/kaipingshiping.mp4';
const SPLASH_DURATION_MS = 3000; // 闪屏总持续时间（毫秒）
// -----------------

const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(SPLASH_DURATION_MS / 1000);
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null); // Ref 来存储 setTimeout 的 ID
  const intervalRef = useRef(null); // Ref 来存储 setInterval 的 ID
  const isHidingRef = useRef(false); // Ref 来防止 hideSplash 重复执行

  // 使用 useCallback 包装 hideSplash，确保其引用稳定
  // 这是最核心的关闭逻辑
  const hideSplash = useCallback(() => {
    // 防止重复执行
    if (isHidingRef.current) return;
    isHidingRef.current = true;

    // 清理所有的定时器，确保万无一失
    clearTimeout(hideTimerRef.current);
    clearInterval(intervalRef.current);

    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');
  }, []); // 空依赖数组，因为函数不依赖外部变量

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplashScreen');
    if (hasSeenSplash) return;

    setShow(true);

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // 尝试播放视频
    videoElement.play().catch(error => {
      console.warn("视频自动播放被浏览器阻止:", error);
    });

    // 监听视频播放结束事件，一旦结束就调用 hideSplash
    videoElement.addEventListener('ended', hideSplash);

    // --- 修复倒计时不准的问题 ---
    // 记录开始时间
    const startTime = Date.now();
    
    // 启动一个每 100 毫秒检查一次的 interval，用于更新 UI
    intervalRef.current = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, SPLASH_DURATION_MS - elapsedTime);
      const remainingSeconds = Math.ceil(remainingTime / 1000);
      
      setCountdown(remainingSeconds);
    }, 100); // 检查频率更高，UI 更新更平滑

    // 设置一个最终的“保险”定时器，确保闪屏在指定时间后一定关闭
    hideTimerRef.current = setTimeout(hideSplash, SPLASH_DURATION_MS);

    // --- 清理函数 ---
    return () => {
      // 在组件卸载时，清除所有副作用
      videoElement.removeEventListener('ended', hideSplash);
      clearTimeout(hideTimerRef.current);
      clearInterval(intervalRef.current);
    };
  }, [hideSplash]); // 将 hideSplash 加入依赖数组

  if (!show) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 w-full h-full bg-black z-[9999] transition-opacity duration-500 ease-out ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
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
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          hideSplash(); // 用户点击跳过，也调用统一的关闭逻辑
        }}
        className="absolute top-5 right-5 bg-black/40 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
      >
        跳过 {countdown > 0 ? `(${countdown})` : ''}
      </button>
    </div>
  );
};

export default SplashScreen;
