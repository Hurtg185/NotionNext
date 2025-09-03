// components/SplashScreen.js
// 进站广告：视频版本（优化版，最大化自动播放成功率）

import { useState, useEffect, useRef } from 'react';
import SmartLink from '@/components/SmartLink';

// --- 配置区域 ---
// 你的 Facebook 公共主页链接
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/16fpFsbhh2/';
// 视频文件路径（确保在 public 目录下）
const VIDEO_SRC = '/images/kaipingshiping.mp4';
// 闪屏总持续时间（毫秒）
const SPLASH_DURATION_MS = 3000;
// -----------------

const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(SPLASH_DURATION_MS / 1000);
  const videoRef = useRef(null);

  // 统一的隐藏闪屏逻辑，确保只执行一次
  const hideSplash = () => {
    // 使用一个 ref 来防止重复调用
    if (window.splashHasBeenHidden) return;
    window.splashHasBeenHidden = true;

    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');
  };

  useEffect(() => {
    // 重置状态，防止在开发模式下的热重载导致逻辑错误
    window.splashHasBeenHidden = false;
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplashScreen');

    if (hasSeenSplash) {
      return; // 如果已经看过，则直接退出
    }

    setShow(true);

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // --- 核心播放逻辑 ---
    // 1. 尝试使用 video.play() 方法播放，它返回一个 Promise
    const playPromise = videoElement.play();

    if (playPromise !== undefined) {
      playPromise.then(() => {
        // 自动播放成功！
        console.log("视频自动播放成功。");
      }).catch(error => {
        // 自动播放失败。这很常见。
        // 浏览器通常会阻止它，直到用户与页面交互。
        // 我们不需要在这里做什么，因为 `autoplay` 属性和用户的点击会作为后备。
        console.warn("视频自动播放被浏览器阻止:", error);
      });
    }
    // --------------------

    // 监听视频播放结束事件，如果视频比倒计时短，就提前关闭闪屏
    videoElement.addEventListener('ended', hideSplash);

    // 设置倒计时
    const interval = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    // 设置一个最终的“保险”定时器，确保闪屏在指定时间后一定关闭
    const fallbackTimer = setTimeout(hideSplash, SPLASH_DURATION_MS);

    // --- 清理函数 ---
    // 在组件卸载时，清除所有的定时器和事件监听器，防止内存泄漏
    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimer);
      if (videoElement) {
        videoElement.removeEventListener('ended', hideSplash);
      }
    };
  }, []); // 空依赖数组确保此 effect 只在组件首次挂载时运行一次

  // 跳过按钮的点击处理
  const handleSkip = (e) => {
    e.stopPropagation(); // 阻止点击事件冒泡到外层的 SmartLink，防止页面跳转
    hideSplash();
  };

  if (!show) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 w-full h-full bg-black z-[9999] transition-opacity duration-500 ease-out ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 整个区域可点击跳转 */}
      <SmartLink href={FACEBOOK_PAGE_URL} className="block w-full h-full cursor-pointer">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          className="w-full h-full object-cover"
          // --- 这是确保自动播放最关键的三个属性 ---
          autoPlay  // 尝试自动播放
          muted     // 必须静音
          playsInline // 在 iOS 上必须内联播放
          // -----------------------------------------
          preload="auto" // 建议浏览器尽快加载视频数据
        />
      </SmartLink>
      
      <button
        onClick={handleSkip}
        className="absolute top-5 right-5 bg-black/40 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
      >
        跳过 {countdown > 0 ? `(${countdown})` : ''}
      </button>
    </div>
  );
};

export default SplashScreen;
