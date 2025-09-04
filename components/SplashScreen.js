// components/SplashScreen.js
// 进站广告：视频版本（增强版：修复关闭问题，添加打字效果文字，并增加多重保障）

import { useState, useEffect, useRef, useCallback } from 'react';
import SmartLink from '@/components/SmartLink';

// --- 自定义 Hook：处理打字效果 (保持不变) ---
const useTypingEffect = (text, duration) => {
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    if (!text) return;
    const textLength = text.length;
    if (textLength === 0) return;

    const interval = duration / textLength;
    let charIndex = 0;
    const typingTimer = setInterval(() => {
      charIndex++;
      setDisplayedText(text.substring(0, charIndex));
      if (charIndex >= textLength) {
        clearInterval(typingTimer);
      }
    }, interval);
    return () => clearInterval(typingTimer);
  }, [text, duration]);
  return displayedText;
};

// --- 配置区域 ---
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/16fpFsbhh2/';
const VIDEO_SRC = '/images/kaipingshiping.mp4';
const SKIP_BUTTON_DELAY_MS = 3000; // 跳过按钮延迟显示时间
const TEXT_APPEAR_DELAY_MS = 1000; // 文字延迟出现时间
const TYPING_DURATION_MS = 2000; // 打字动画总时长
const ABSOLUTE_TIMEOUT_MS = 15000; // 终极备用方案：15秒后无论如何都关闭

// --- 文字配置 ---
const AD_TEXT_LINE_1 = "投资未来，即刻启航。";
const AD_TEXT_LINE_2 = "锁定席位，尊享早鸟专属优惠。";
// -----------------

const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [showAdText, setShowAdText] = useState(false);

  const videoRef = useRef(null);
  const isHidingRef = useRef(false);
  const animationFrameRef = useRef(null);

  const animatedTextLine2 = useTypingEffect(showAdText ? AD_TEXT_LINE_2 : '', TYPING_DURATION_MS);

  // 统一的关闭逻辑，使用 useCallback 优化
  const hideSplash = useCallback(() => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;

    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src'); // 彻底移除视频源，停止加载
      video.load();
    }
  }, []);

  useEffect(() => {
    // 1. 检查是否已经看过广告
    if (sessionStorage.getItem('hasSeenSplashScreen')) {
      return;
    }
    setShow(true);

    // 2. 安全地获取视频元素
    const videoElement = videoRef.current;
    if (!videoElement) {
      // 如果视频元素还未准备好，则稍后由React重新渲染时再执行
      return;
    }

    // 3. 设置所有定时器和事件监听
    const timers = [];
    
    // 终极备用方案：设置一个绝对超时，保证用户不会被卡住
    timers.push(setTimeout(hideSplash, ABSOLUTE_TIMEOUT_MS));

    // --- 定义事件处理函数 ---
    const handleVideoEnd = () => hideSplash();
    const handleVideoError = () => hideSplash();

    const handleLoadedMetadata = () => {
      const duration = videoElement.duration;
      if (isNaN(duration)) { // 如果时长无效，则依赖终极备用方案
        return;
      }
      
      // 视频时长有效，设置一个精确的备用关闭定时器
      const bufferMs = 1000; // 1秒缓冲
      timers.push(setTimeout(hideSplash, (duration * 1000) + bufferMs));

      // 视频已准备好，现在可以安全地设置UI元素的显示定时器
      timers.push(setTimeout(() => setShowSkipButton(true), SKIP_BUTTON_DELAY_MS));
      timers.push(setTimeout(() => setShowAdText(true), TEXT_APPEAR_DELAY_MS));

      // 启动倒计时显示
      const startTime = performance.now();
      const tick = () => {
        const elapsedTime = performance.now() - startTime;
        const remainingTime = Math.max(0, (duration * 1000) - elapsedTime);
        setCountdown(Math.ceil(remainingTime / 1000));
        if (remainingTime > 0) {
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      };
      tick();
    };

    // --- 绑定事件 ---
    videoElement.addEventListener('ended', handleVideoEnd);
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // 尝试播放视频
    videoElement.play().catch(handleVideoError);

    // --- 清理函数 ---
    return () => {
      // 组件卸载时，清除所有定时器和事件监听，防止内存泄漏
      timers.forEach(clearTimeout);
      cancelAnimationFrame(animationFrameRef.current);
      if (videoElement) {
        videoElement.removeEventListener('ended', handleVideoEnd);
        videoElement.removeEventListener('error', handleVideoError);
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [hideSplash, show]); // 添加 show 依赖，确保 videoElement 存在后能重新执行

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black z-[9999] transition-opacity duration-700 ease-out">
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

      {/* 文字浮层 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
        <div className="text-center text-white">
          {showAdText && (
            <>
              <h1 className="text-3xl md:text-5xl font-bold drop-shadow-lg animate-fade-in-down">
                {AD_TEXT_LINE_1}
              </h1>
              <p className="text-lg md:text-2xl mt-4 drop-shadow-lg animate-fade-in-up">
                {animatedTextLine2}
                <span className="inline-block w-1 h-6 md:h-8 ml-1 bg-white animate-blink" />
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* 跳过按钮 */}
      {showSkipButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
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
