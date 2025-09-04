// components/SplashScreen.js
// 进站广告：视频版本（主题化最终版：根据业务随机展示匹配的视频和文字）

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
      if (charIndex >= textLength) clearInterval(typingTimer);
    }, interval);
    return () => clearInterval(typingTimer);
  }, [text, duration]);
  return displayedText;
};

// =================================================================
// --- 配置中心：所有广告内容在这里修改 ---
// =================================================================

const AD_THEMES = {
  // --- 主题一：中文教学 ---
  language_learning: {
    videos: [
      '/images/kaipingshiping1.mp4', 
      '/images/kaipingshiping2.mp4'
    ],
    link: 'https://www.facebook.com/your-language-page', // 可为每个主题设置不同链接
    title: "开启您的语言学习之旅",
    subtitle: "专业课程，量身定制，助您轻松掌握新技能。",
    content: {
      type: 'courses', // 内容类型，用于渲染不同布局
      items: [
        { name: "HSK 专业考级", online: "600", offline: "800", overseas: "1200" },
        { name: "AI 智能口语", online: "600", offline: "800", overseas: "1200" },
        { name: "语法强化班", online: "600", offline: "800", overseas: "1200" },
        { name: "单词速配营", online: "600", offline: "800", overseas: "1200" },
      ],
      footer: "教学中心地址：仰光 · 城市之心广场 A 座"
    }
  },

  // --- 主题二：人力资源 ---
  human_resources: {
    videos: [
      '/images/zhaoping1.mp4', 
      '/images/zhaoping2.mp4'
    ],
    link: 'https://www.facebook.com/your-hr-page',
    title: "精英之选 · 职等你来",
    subtitle: "我们为您精准匹配最佳人才与机遇。",
    content: {
      type: 'recruitment',
      items: [
        { icon: '🏢', title: '企业招聘', description: '高效、精准的批量招聘服务' },
        { icon: '🧑‍💼', title: '劳务派遣', description: '灵活、可靠的人力解决方案' },
        { icon: '🌏', title: '海外就业', description: '拓展您的国际职业生涯' },
        { icon: '📄', title: '简历优化', description: '专业指导，助您脱颖而出' },
      ],
      footer: "值得信赖的人力资源合作伙伴"
    }
  },

  // --- 主题三：证件服务 ---
  document_services: {
    videos: [
      '/images/banzheng1.mp4'
    ],
    link: 'https://www.facebook.com/your-services-page',
    title: "专业证件代办 · 高效无忧",
    subtitle: "省时省力，为您处理繁琐流程。",
    content: {
      type: 'services',
      items: [
        { icon: '✈️', name: '签证办理' },
        { icon: '🎓', name: '学历认证' },
        { icon: '💼', name: '工作许可' },
        { icon: '📜', name: '各类公证' },
      ],
      footer: "联系我们，即刻开启便捷服务"
    }
  }
};

// --- 其他通用配置 ---
const SKIP_BUTTON_DELAY_MS = 3000;
const TEXT_APPEAR_DELAY_MS = 1000;
const TYPING_DURATION_MS = 2500;
const ABSOLUTE_TIMEOUT_MS = 15000;
// =================================================================

// --- 动态内容渲染组件 ---
const ThemeContent = ({ content }) => {
  if (!content) return null;

  switch (content.type) {
    case 'courses':
      return (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5 text-white">
            {content.items.map((course, index) => (
              <div key={index} className="text-center bg-white/10 p-3 rounded-lg">
                <h3 className="font-semibold text-base md:text-lg">{course.name}</h3>
                <div className="text-xs md:text-sm mt-2 space-y-1 text-gray-300">
                  <p>线上: ${course.online}</p>
                  <p>线下: ${course.offline}</p>
                  <p>海外: ${course.overseas}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-300 mt-6 tracking-wider">{content.footer}</p>
        </>
      );

    case 'recruitment':
      return (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
            {content.items.map((item, index) => (
              <div key={index} className="text-center bg-white/10 p-4 rounded-lg">
                <p className="text-3xl">{item.icon}</p>
                <h3 className="font-semibold text-base mt-2">{item.title}</h3>
                <p className="text-xs text-gray-300 mt-1">{item.description}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-semibold text-gray-200 mt-6 tracking-wider">{content.footer}</p>
        </>
      );

    case 'services':
      return (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
            {content.items.map((item, index) => (
              <div key={index} className="text-center bg-white/10 p-4 rounded-lg flex flex-col justify-center items-center h-full">
                <p className="text-3xl">{item.icon}</p>
                <h3 className="font-semibold text-base mt-2">{item.name}</h3>
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-semibold text-gray-200 mt-6 tracking-wider">{content.footer}</p>
        </>
      );

    default:
      return null;
  }
};


const SplashScreen = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [showAdText, setShowAdText] = useState(false);
  
  // 随机选择一个主题，并获取其所有配置
  const theme = useMemo(() => {
    const themeKeys = Object.keys(AD_THEMES);
    const randomThemeKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    const selectedTheme = AD_THEMES[randomThemeKey];
    
    // 从选定主题的视频列表中再随机选一个视频
    const randomVideoIndex = Math.floor(Math.random() * selectedTheme.videos.length);
    const videoSrc = selectedTheme.videos[randomVideoIndex];

    return { ...selectedTheme, videoSrc };
  }, []);

  const videoRef = useRef(null);
  const isHidingRef = useRef(false);
  const animationFrameRef = useRef(null);

  const animatedSubtitle = useTypingEffect(showAdText ? theme.subtitle : '', TYPING_DURATION_MS);

  // 关闭逻辑保持不变
  const hideSplash = useCallback(() => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;
    setShow(false);
    sessionStorage.setItem('hasSeenSplashScreen', 'true');
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }, []);

  // useEffect 逻辑保持不变
  useEffect(() => {
    if (sessionStorage.getItem('hasSeenSplashScreen')) return;
    setShow(true);
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const timers = [];
    timers.push(setTimeout(hideSplash, ABSOLUTE_TIMEOUT_MS));
    const handleVideoEnd = () => hideSplash();
    const handleVideoError = () => hideSplash();
    const handleLoadedMetadata = () => {
      const duration = videoElement.duration;
      if (isNaN(duration)) return;
      timers.push(setTimeout(hideSplash, (duration * 1000) + 1000));
      timers.push(setTimeout(() => setShowSkipButton(true), SKIP_BUTTON_DELAY_MS));
      timers.push(setTimeout(() => setShowAdText(true), TEXT_APPEAR_DELAY_MS));
      const startTime = performance.now();
      const tick = () => {
        const elapsedTime = performance.now() - startTime;
        const remainingTime = Math.max(0, (duration * 1000) - elapsedTime);
        setCountdown(Math.ceil(remainingTime / 1000));
        if (remainingTime > 0) animationFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    };
    videoElement.addEventListener('ended', handleVideoEnd);
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.play().catch(handleVideoError);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(animationFrameRef.current);
      if (videoElement) {
        videoElement.removeEventListener('ended', handleVideoEnd);
        videoElement.removeEventListener('error', handleVideoError);
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [hideSplash, show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black z-[9999]">
      <SmartLink href={theme.link} className="block w-full h-full cursor-pointer">
        <video
          ref={videoRef}
          src={theme.videoSrc}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          preload="auto"
        />
      </SmartLink>

      {/* 文字浮层 */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        {showAdText && (
          <div className="w-full max-w-2xl bg-black/50 p-6 md:p-8 rounded-2xl shadow-2xl backdrop-blur-lg border border-white/10 animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold text-white text-center drop-shadow-lg">
              {theme.title}
            </h1>
            <p className="text-sm md:text-base text-gray-200 text-center mt-2 mb-6 min-h-[40px] drop-shadow-md">
              {animatedSubtitle}
              <span className="inline-block w-0.5 h-5 ml-1 bg-white animate-blink" />
            </p>
            
            <ThemeContent content={theme.content} />

          </div>
        )}
      </div>
      
      {/* 跳过按钮 */}
      {showSkipButton && (
        <button
          onClick={(e) => { e.stopPropagation(); hideSplash(); }}
          className="absolute top-5 right-5 bg-black/50 text-white text-sm px-4 py-2 rounded-full backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:scale-105 active:scale-95"
        >
          跳过 {countdown > 0 ? `(${countdown})` : ''}
        </button>
      )}
    </div>
  );
};

export default SplashScreen;
