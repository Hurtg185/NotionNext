// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频流（上下文整页切换）+ 边播边缓存

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';

// 默认 API 列表
const DEFAULT_APIS = [
  'http://api.xingchenfu.xyz/API/hssp.php', 'http://api.xingchenfu.xyz/API/wmsc.php',
  'http://api.xingchenfu.xyz/API/xgg.php', 'http://api.xingchenfu.xyz/API/ommn.php',
  'http://api.xingchenfu.xyz/API/tianmei.php', 'http://api.xingchenfu.xyz/API/cdxl.php',
  'http://api.xingchenfu.xyz/API/yzxl.php', 'http://api.xingchenfu.xyz/API/rwsp.php',
  'http://api.xingchenfu.xyz/API/nvda.php', 'http://api.xingchenfu.xyz/API/bsxl.php',
  'http://api.xingchenfu.xyz/API/zzxjj.php', 'http://api.xingchenfu.xyz/API/qttj.php',
  'http://api.xingchenfu.xyz/API/xqtj.php', 'http://api.xingchenfu.xyz/API/sktj.php',
  'http://api.xingchenfu.xyz/API/cossp.php', 'http://api.xingchenfu.xyz/API/xiaohulu.php',
  'http://api.xingchenfu.xyz/API/manhuay.php', 'http://api.xingchenfu.xyz/API/bianzhuang.php',
  'http://api.xingchenfu.xyz/API/jk.php', 'https://v2.xxapi.cn/api/meinv?return=302',
  'https://api.jkyai.top/API/jxhssp.php', 'https://api.jkyai.top/API/jxbssp.php',
  'https://api.jkyai.top/API/rmtmsp/api.php', 'https://api.jkyai.top/API/qcndxl.php',
  'https://www.hhlqilongzhu.cn/api/MP4_xiaojiejie.php'
];

// 主组件
export default function VerticalShortVideoPlayer({
  apiList = DEFAULT_APIS,
  cacheSize = 3,
  preloadThreshold = 1,
  useProxy = false,
  proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
  const [videos, setVideos] = useState([]);
  const [index, setIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRefs = useRef([]);

  const getRandomAPI = useCallback(() => {
    const raw = apiList[Math.floor(Math.random() * apiList.length)];
    return `${raw}${raw.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, [apiList]);

  const buildSrc = useCallback((url) => {
    if (!useProxy) return url;
    return `${proxyPath}?url=${encodeURIComponent(url)}`;
  }, [useProxy, proxyPath]);

  const fillVideoQueue = useCallback(async () => {
    const newVideos = [];
    for (let i = 0; i < cacheSize; i++) {
      newVideos.push({ id: Date.now() + i, url: getRandomAPI() });
    }
    setVideos(prev => [...prev, ...newVideos]);
  }, [cacheSize, getRandomAPI]);

  useEffect(() => {
    fillVideoQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (video) {
        if (i === index) {
          setIsLoading(true);
          video.play().catch(e => console.warn('自动播放被阻止:', e));
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
    if (videos.length > 0 && videos.length - index <= preloadThreshold) {
      fillVideoQueue();
    }
  }, [index, videos, fillVideoQueue, preloadThreshold]);

  const bind = useDrag(({ last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
    if (!last) return;
    if (my < -80 || (vy > 0.6 && dy < 0)) {
      setIndex(i => Math.min(i + 1, videos.length - 1));
    } else if (my > 80 || (vy > 0.6 && dy > 0)) {
      setIndex(i => Math.max(0, i - 1));
    }
  }, { axis: 'y', pointer: { touch: true } });

  return (
    // 【核心修复】使用 h-[100vh] 来确保在移动端也能占满全屏
    <div className="w-full h-[100vh] bg-black relative overflow-hidden touch-action-pan-y" {...bind()}>
      <AnimatePresence initial={false}>
        {/* 【核心修复】将 motion.div 作为滚动容器，而不是 key={index} 的切换容器 */}
        <motion.div
          className="w-full h-full"
          animate={{ y: `-${index * 100}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {videos.map((video, i) => (
            <div key={video.id} className="w-full h-full absolute flex items-center justify-center" style={{ top: `${i * 100}%` }}>
              <video
                ref={el => videoRefs.current[i] = el}
                src={buildSrc(video.url)}
                // 【核心修复】确保视频本身也占满容器，并使用 object-cover
                className="w-full h-full object-cover bg-black"
                playsInline
                muted={isMuted}
                controls={false}
                loop
                onCanPlay={() => { if (i === index) setIsLoading(false); }}
                onWaiting={() => { if (i === index) setIsLoading(true); }}
                onEnded={() => { if (autoPlayNext) setIndex(i => i + 1); }}
              />
              {/* UI 覆盖层 */}
              {index === i && (
                <div className="absolute inset-0 flex flex-col justify-between p-4 z-10 pointer-events-none">
                  <div className="text-white/80 text-sm">
                    {isLoading && '加载中...'}
                  </div>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* 全局控制按钮 */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4">
        <button onClick={() => setIsMuted(m => !m)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm">
          {isMuted ? '静音' : '取消静音'}
        </button>
        <button onClick={() => setAutoPlayNext(p => !p)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm">
          {autoPlayNext ? '连播: 开' : '连播: 关'}
        </button>
      </div>

      {/* 页面指示器 */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        {videos.slice(0, 10).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === i ? 'bg-white scale-150' : 'bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}
