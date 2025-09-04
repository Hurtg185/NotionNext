// components/SplashScreen.js
// 进站广告：视频版本（修复视频结束不关闭问题，并添加打字效果文字）

import { useState, useEffect, useRef, useCallback } from 'react';
import SmartLink from '@/components/SmartLink';

// --- 自定义 Hook：处理打字效果 ---
const useTypingEffect = (text, duration) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (!isTyping) return;

    const textLength = text.length;
    if (textLength === 0) {
        setIsTyping(false);
        return;
    }

    const interval = duration / textLength;
    let charIndex = 0;

    const typingTimer = setInterval(() => {
      charIndex++;
      const currentText = text.substring(0, charIndex);
      setDisplayedText(currentText);

      if (charIndex >= textLength) {
        clearInterval(typingTimer);
        setIsTyping(false);
      }
    }, interval);

    return () => clearInterval(typingTimer);
  }, [text, duration, isTyping]);

  return displayedText;
};


// --- 配置区域 ---
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/16fpFsbhh2/';
const VIDEO_SRC = '/images/kaipingshiping.mp4';
const SKIP_BUTTON_DELAY_MS = 3000; // 跳过按钮延迟显示时间（毫秒）

// --- 文字配置 ---
const AD_TEXT_LINE_1 = "投资未来，即刻启航。"; // 第一行文字
const AD_TEXT_LINE_2 = "锁定席位，尊享早鸟专属优惠。"; // 第二行文字
const TEXT_APPEAR_DELAY_MS = 1000; // 文字延迟出现时间
const TYPING_DURATION_MS = 2000; // 打字动画总时长
// -----------------


const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [showAdText, setShowAdText] = useState(false); // 控制文字显示
  const videoRef = useRef(null);
  const isHidingRef = useRef(false);

  // 使用自定义 Hook 实现打字效果
  const animatedTextLine2 = useTypingEffect(
    showAdText ? AD_TEXT_LINE_2 : '', 
    TYPING_DURATION_MS
  );

  // 统一的关闭逻辑，使用 useCallback 优化
  const hideSplash = useCallback(() => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;
    
    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');
    
    // 确保视频停止播放，防止在后台继续耗费资源
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = ''; // 强制中断加载
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('hasSeenSplashScreen')) {
      return;
    }

    setShow(true);

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // 定时器引用
    const timers = [];

    // 设置跳过按钮和广告文字的延迟显示
    timers.push(setTimeout(() => setShowSkipButton(true), SKIP_BUTTON_DELAY_MS));
    timers.push(setTimeout(() => setShowAdText(true), TEXT_APPEAR_DELAY_MS));
    
    const playPromise = videoElement.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn("视频自动播放失败:", error);
        // 如果播放失败，立即安全地关闭
        hideSplash();
      });
    }

    // --- 核心事件监听 ---
    const handleVideoEnd = () => hideSplash();
    const handleVideoError = () => hideSplash();

    const handleLoadedMetadata = () => {
      const duration = videoElement.duration;
      // 启动倒计时
      updateCountdown(duration);
      // 设置一个比视频总时长略长的“最终保险”关闭定时器
      // 这可以解决 ended 事件在极少数情况下不触发的问题
      const backupDuration = (duration * 1000) + 500; // 增加500毫秒缓冲
      timers.push(setTimeout(hideSplash, backupDuration));
    };
    
    const animationFrameRef = { id: null };
    const updateCountdown = (videoDuration) => {
        const startTime = performance.now();
        const tick = () => {
            const elapsedTime = performance.now() - startTime;
            const remainingTime = Math.max(0, (videoDuration * 1000) - elapsedTime);
            setCountdown(Math.ceil(remainingTime / 1000));
            if (remainingTime > 0) {
                animationFrameRef.id = requestAnimationFrame(tick);
            }
        };
        tick();
    };

    // 添加事件监听
    videoElement.addEventListener('ended', handleVideoEnd);
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 清理函数：组件卸载时执行所有清理工作
    return () => {
      cancelAnimationFrame(animationFrameRef.id);
      timers.forEach(clearTimeout);
      videoElement.removeEventListener('ended', handleVideoEnd);
      videoElement.removeEventListener('error', handleVideoError);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [hideSplash]);

  if (!show) return null;

  return (
    // 添加一个父容器，用于背景和动画
    <div 
      className="fixed inset-0 bg-black z-[9999] transition-opacity duration-700 ease-out"
      style={{ opacity: show ? 1 : 0 }}
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

      {/* 文字浮层容器 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center text-white p-6 rounded-lg max-w-xl md:max-w-2xl">
          {showAdText && (
            <>
              <h1 className="text-3xl md:text-5xl font-bold drop-shadow-lg animate-fade-in-down">
                {AD_TEXT_LINE_1}
              </h1>
              <p className="text-lg md:text-2xl mt-4 drop-shadow-lg animate-fade-in-up">
                {animatedTextLine2}
                {/* 光标效果 */}
                <span className="inline-block w-1 h-6 md:h-8 ml-1 bg-white animate-blink" />
              </p>
            </>
          )}
        </div>
      </div>
      
      {showSkipButton && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // 防止点击穿透到 SmartLink
            hideSplash();
          }}
          className="absolute top-5 right-5 bg-black/50 text-white text-sm px-4 py-2 rounded-full backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:scale-105 active:scale-95"
        >
          跳过 {countdown > 0 ? `(${countdown})` : ''}
        </button>
      )}
    </div>
  );
};

export default SplashScreen;
