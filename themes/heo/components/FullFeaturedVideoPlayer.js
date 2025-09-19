// themes/heo/components/FullFeaturedVideoPlayer.js (完整React组件化你的原生JS播放器)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';

// === 配置常量 ===
const config = {
    AUTO_PLAY_DEFAULT: false,
    MUTE_DEFAULT: true, // 浏览器策略，默认静音才能自动播放
    MAX_RETRIES: 5,
    CACHE_SIZE: 5, // 降低缓存大小，避免占用太多内存
    CACHE_THRESHOLD: 1, // 缓存少于1个就补充
    CONTROLS_HIDE_DELAY: 3000,
    API_URLS: [
        'http://api.xingchenfu.xyz/API/hssp.php',
        'http://api.xingchenfu.xyz/API/wmsc.php',
        'http://api.xingchenfu.xyz/API/tianmei.php',
        'http://api.xingchenfu.xyz/API/cdxl.php',
        'http://api.xingchenfu.xyz/API/yzxl.php',
        'http://api.xingchenfu.xyz/API/rwsp.php',
        'http://api.xingchenfu.xyz/API/nvda.php',
        'http://api.xingchenfu.xyz/API/bsxl.php',
        'http://api.xingchenfu.xyz/API/zzxjj.php',
        'http://api.xingchenfu.xyz/API/qttj.php',
        'http://api.xingchenfu.xyz/API/xqtj.php',
        'http://api.xingchenfu.xyz/API/sktj.php',
        'http://api.xingchenfu.xyz/API/cossp.php',
        'http://api.xingchenfu.xyz/API/xiaohulu.php',
        'http://api.xingchenfu.xyz/API/manhuay.php',
        'http://api.xingchenfu.xyz/API/bianzhuang.php',
        'http://api.xingchenfu.xyz/API/jk.php',
        'https://v2.xxapi.cn/api/meinv?return=302', // 兼容 HTTPS
        'https://api.jkyai.top/API/jxhssp.php',
        'https://api.jkyai.top/API/jxbssp.php',
        'https://api.jkyai.top/API/rmtmsp/api.php',
        'https://api.jkyai.top/API/qcndxl.php',
        'https://www.hhlqilongzhu.cn/api/MP4_xiaojiejie.php',
        'https://api.vvhan.com/api/girl', // 备用稳定 API
        'https://api.vvhan.com/api/video' // 备用稳定 API
    ]
};

// --- API 服务 (服务器端中转逻辑) ---
// 由于这是一个 React 组件，它运行在客户端。我们需要一个 Next.js API 路由作为中转。
// 假设你的 pages/api/getVideo.js 已经配置好并能正常工作
const fetchVideoUrlFromServer = async () => {
    try {
        const response = await fetch('/api/getVideo'); // 请求我们自己的 Next.js API 路由
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `服务器错误: ${response.status}`);
        }
        const data = await response.json();
        return data.videoUrl;
    } catch (error) {
        console.error("从服务器获取视频 URL 失败:", error.message);
        throw error; // 向上抛出错误
    }
};

// --- 组件开始 ---
const FullFeaturedVideoPlayer = () => {
    // === DOM 引用 ===
    const videoPlayerRef = useRef(null);
    const preloadPlayerRef = useRef(null); // 用于缓存的视频元素引用
    const controlsTimeoutRef = useRef(null);
    const retryTimerRef = useRef(null);
    const videoCacheRef = useRef([]); // 存储 { url: string, element: HTMLVideoElement }

    // === 状态管理 ===
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null); // 新增错误状态
    const [isMuted, setIsMuted] = useState(config.MUTE_DEFAULT);
    const [isPlaying, setIsPlaying] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(false);
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(config.AUTO_PLAY_DEFAULT);
    const [progress, setProgress] = useState(0); // 预加载进度

    // === 工具函数 ===
    const debounce = useCallback((func, wait) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }, []);

    // === 核心视频控制逻辑 ===

    const showLoading = useCallback(() => {
        setIsLoading(true);
        setError(null);
    }, []);

    const hideLoading = useCallback(() => {
        setIsLoading(false);
    }, []);

    const clearControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }
    }, []);

    const showControls = useCallback(() => {
        clearControlsTimeout();
        setControlsVisible(true);
        controlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
        }, config.CONTROLS_HIDE_DELAY);
    }, [clearControlsTimeout]);

    const cleanupVideoResources = useCallback(() => {
        if (videoPlayerRef.current) {
            videoPlayerRef.current.pause();
            videoPlayerRef.current.src = ''; // 清空 src
            videoPlayerRef.current.load();
        }
    }, []);

    // 【新增】更新进度条
    const updateProgressBar = useCallback((playerElement) => {
        if (!playerElement || playerElement.buffered.length === 0) return;
        const buffered = playerElement.buffered.end(0);
        const duration = playerElement.duration;
        if (duration > 0) {
            setProgress((buffered / duration) * 100);
        }
    }, []);

    // === 缓存管理 ===
    const shouldCacheMore = useCallback(() => {
        return videoCacheRef.current.length <= config.CACHE_THRESHOLD;
    }, []);

    const preloadVideoToCache = useCallback(async () => {
        // console.log("尝试预加载到缓存", videoCacheRef.current.length, config.CACHE_SIZE);
        if (videoCacheRef.current.length >= config.CACHE_SIZE) {
            // console.log("缓存已满，停止预加载");
            return;
        }

        // 避免重复缓存同一个视频
        const existingUrls = new Set(videoCacheRef.current.map(v => v.url));

        showLoading(); // 显示预加载加载
        try {
            const videoUrl = await fetchVideoUrlFromServer();
            if (videoUrl && !existingUrls.has(videoUrl)) {
                const videoElement = document.createElement('video');
                videoElement.preload = 'auto';
                videoElement.muted = true; // 静音预加载
                videoElement.src = videoUrl;
                
                // 监听预加载完成
                const loadedDataHandler = () => {
                    videoCacheRef.current.push({ url: videoUrl, element: videoElement });
                    // console.log("视频已缓存:", videoUrl, "当前缓存大小:", videoCacheRef.current.length);
                    hideLoading();
                    // 继续填充缓存
                    if (shouldCacheMore()) {
                        setTimeout(preloadVideoToCache, 500); // 延迟一点，避免请求过快
                    }
                    videoElement.removeEventListener('loadeddata', loadedDataHandler);
                };
                
                const errorHandler = () => {
                    console.error("缓存视频加载失败:", videoUrl);
                    hideLoading();
                    // 失败后也尝试补充
                    if (shouldCacheMore()) {
                        setTimeout(preloadVideoToCache, 1000);
                    }
                    videoElement.removeEventListener('error', errorHandler);
                };

                videoElement.addEventListener('loadeddata', loadedDataHandler);
                videoElement.addEventListener('error', errorHandler);
                videoElement.load(); // 触发加载
            } else {
                 // 如果获取到重复URL或无效URL，也尝试补充
                if (shouldCacheMore()) {
                    setTimeout(preloadVideoToCache, 500);
                }
                hideLoading();
            }
        } catch (err) {
            console.error("预加载视频失败:", err.message);
            setError(`预加载失败: ${err.message}`);
            hideLoading();
            if (shouldCacheMore()) {
                setTimeout(preloadVideoToCache, 1000); // 失败后也尝试补充
            }
        }
    }, [showLoading, hideLoading, shouldCacheMore]); // 依赖项

    const getVideoFromCache = useCallback(() => {
        if (videoCacheRef.current.length === 0) return null;
        
        // 随机获取一个缓存视频 (不是先进先出)
        const randomIndex = Math.floor(Math.random() * videoCacheRef.current.length);
        const cachedVideo = videoCacheRef.current.splice(randomIndex, 1)[0]; // 移除并获取
        
        // 检查是否需要补充缓存
        if (shouldCacheMore()) {
            setTimeout(preloadVideoToCache, 100);
        }
        
        return cachedVideo;
    }, [preloadVideoToCache, shouldCacheMore]);

    const loadNextVideo = useCallback(async () => {
        showLoading();
        setError(null);
        clearControlsTimeout(); // 清除控制条计时器

        // 先尝试从缓存获取
        const cachedVideo = getVideoFromCache();
        let videoUrlToLoad = null;

        if (cachedVideo && cachedVideo.url) {
            videoUrlToLoad = cachedVideo.url;
            // 确保缓存的 videoElement 已经被正确移除或处理
            if (cachedVideo.element && cachedVideo.element.parentNode) {
                cachedVideo.element.parentNode.removeChild(cachedVideo.element);
            }
        } else {
            // 如果缓存中没有，则从服务器获取新的
            try {
                videoUrlToLoad = await fetchVideoUrlFromServer();
            } catch (err) {
                console.error("从服务器获取新视频失败:", err.message);
                setError(`获取视频失败: ${err.message}`);
                hideLoading();
                return;
            }
        }

        if (videoUrlToLoad && videoPlayerRef.current) {
            cleanupVideoResources(); // 清理旧视频资源，避免中断
            videoPlayerRef.current.src = videoUrlToLoad;
            videoPlayerRef.current.muted = true; // 确保默认静音
            videoPlayerRef.current.load(); // 重新加载视频

            videoPlayerRef.current.onloadedmetadata = async () => {
                try {
                    await videoPlayerRef.current.play();
                    setIsPlaying(true);
                    hideLoading();
                    setError(null); // 播放成功清除错误
                } catch (e) {
                    console.warn("自动播放被阻止，等待用户交互:", e);
                    setIsPlaying(false); // 设为暂停状态
                    hideLoading();
                    setError("请点击播放按钮");
                }
                videoPlayerRef.current.onloadedmetadata = null; // 清理事件
            };

            videoPlayerRef.current.onerror = (e) => {
                console.error("视频元素播放错误:", e);
                setError('当前视频已失效，尝试加载下一个...');
                hideLoading();
                // 如果当前视频加载失败，直接加载下一个
                setTimeout(loadNextVideo, 1000);
                videoPlayerRef.current.onerror = null;
            };
        } else {
            setError('没有更多视频了');
            hideLoading();
        }
    }, [cleanupVideoResources, hideLoading, showLoading, clearControlsTimeout, getVideoFromCache, fetchVideoUrlFromServer]);


    // === useEffect 钩子管理 ===

    // 1. 初始化和缓存预填充
    useEffect(() => {
        // 初始加载第一个视频
        loadNextVideo();
        // 持续预填充缓存
        preloadVideoToCache(); 

        // 清理函数
        return () => {
            clearControlsTimeout();
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            // 清理缓存中的视频元素
            videoCacheRef.current.forEach(v => {
                if (v.element && v.element.parentNode) {
                    v.element.parentNode.removeChild(v.element);
                }
            });
            videoCacheRef.current = [];
            cleanupVideoResources();
        };
    }, [loadNextVideo, preloadVideoToCache, clearControlsTimeout, cleanupVideoResources]);

    // 2. 视频播放事件监听
    useEffect(() => {
        const player = videoPlayerRef.current;
        if (!player) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleError = () => {
            // 简单的错误处理，直接尝试下一个视频
            console.error("Video player error. Trying next video...");
            setError('视频加载失败，尝试下一个...');
            setTimeout(loadNextVideo, 2000);
        };
        const handleEnded = () => {
            if (autoPlayEnabled) {
                loadNextVideo();
            } else {
                showControls(); // 播放结束显示控制条
            }
        };
        const handleProgress = () => updateProgressBar(player);

        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('error', handleError);
        player.addEventListener('ended', handleEnded);
        player.addEventListener('progress', handleProgress);

        return () => {
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('error', handleError);
            player.removeEventListener('ended', handleEnded);
            player.removeEventListener('progress', handleProgress);
        };
    }, [autoPlayEnabled, showControls, loadNextVideo, updateProgressBar]);

    // 3. 页面可见性 API (当页面从后台切换回前台时，自动播放)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && videoPlayerRef.current && !isPlaying) {
                videoPlayerRef.current.play().catch(e => console.warn("Play on visibility change failed:", e));
            } else if (document.visibilityState === 'hidden' && videoPlayerRef.current && isPlaying) {
                videoPlayerRef.current.pause();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isPlaying]);

    // 4. 窗口大小调整 (防抖)
    const resizeVideoDebounced = useCallback(() => {
        // 视频适应容器大小的逻辑，可能需要调整 object-fit
        // 例如，如果 object-fit: contain，不需要特别调整
    }, []);
    useEffect(() => {
        const debouncedResize = debounce(resizeVideoDebounced, 100);
        window.addEventListener('resize', debouncedResize);
        return () => window.removeEventListener('resize', debouncedResize);
    }, [debounce, resizeVideoDebounced]);


    // === 手势处理 (useDrag) ===
    const bind = useDrag(({ swipe: [, swipeY], down }) => {
        if (!down && swipeY === -1 && !isLoading) { // 向上滑动
             loadNextVideo();
        }
        // 如果想支持向下滑动返回上一个视频，需要实现一个历史记录堆栈
    }, { swipe: { distance: 50, velocity: 0.3 }, from: () => [0, 0], bounds: { top: -Infinity, bottom: Infinity } });


    // === 渲染 ===
    return (
        <div {...bind()} className="w-full h-full bg-black flex items-center justify-center relative touch-pan-y select-none">
            {/* 加载/错误 覆盖层 */}
            {(isLoading || error) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-center px-4">
                    {isLoading && !error && (
                        <>
                            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <p className="mt-4 text-white">加载中...</p>
                        </>
                    )}
                    {error && (
                         <>
                            <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                            <p className="text-white">{error}</p>
                            <button 
                                onClick={loadNextVideo} // 点击重试，加载下一个视频
                                className="mt-6 bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30"
                            >
                                点击重试 / 下个视频
                            </button>
                        </>
                    )}
                </div>
            )}
            
            {/* 视频播放器 */}
            <video
                ref={videoPlayerRef}
                className={`w-full h-full object-contain transition-opacity duration-300 ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
                playsInline
                muted={isMuted} // 始终静音，用户交互后才能取消
                onCanPlay={() => { 
                    if (isLoading) { // 只有在加载状态才隐藏加载
                        setIsLoading(false); 
                        setError(null); 
                    }
                }}
                onClick={showControls} // 点击视频时显示控制条，并切换播放/暂停
            />

            {/* 播放/暂停图标覆盖层 */}
            {!isPlaying && !isLoading && !error && (
                 <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    onClick={handleVideoClick} // 即使不可点击，也加上事件，方便测试
                 >
                    <i className="fas fa-play text-white text-6xl bg-black/30 p-4 rounded-full"></i>
                 </div>
            )}

            {/* 控制条 (静音、自动连播等) */}
            <div className={`absolute bottom-5 left-0 right-0 flex justify-center gap-4 z-10 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); // 阻止事件冒泡到视频播放器
                        setIsMuted(!isMuted); 
                        showControls(); // 交互后显示控制条
                    }}
                    className={`bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30 ${!isMuted ? 'text-green-300' : ''}`}
                >
                    {isMuted ? '取消静音' : '静音'}
                </button>
                <button 
                    onClick={(e) => { 
                        e.stopPropagation();
                        setAutoPlayEnabled(!autoPlayEnabled); 
                        showControls();
                    }}
                    className={`bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30 ${autoPlayEnabled ? 'text-green-300' : ''}`}
                >
                    {autoPlayEnabled ? '关闭连播' : '自动连播'}
                </button>
                <button 
                    onClick={(e) => { 
                        e.stopPropagation();
                        loadNextVideo(); 
                        showControls();
                    }}
                    className="bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30"
                >
                    下一个
                </button>
            </div>
        </div>
    );
};

export default FullFeaturedVideoPlayer;
