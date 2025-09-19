// themes/heo/components/RandomVideoPlayer.js (最终稳健版，修复 ReferenceError 和 TypeError)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';

// API 端点数组 (请自行添加或调整，建议优先使用 HTTPS 链接)
const API_URLS = [
    'https://api.vvhan.com/api/girl',
    'https://api.vvhan.com/api/video',
    'https://api.vvhan.com/api/dongman',
    // 'http://api.xingchenfu.xyz/API/tianmei.php', // 如果仍有问题，建议暂时注释掉 HTTP 链接
    // ... 其他 API
];

// 【新增】请求超时函数 - 保持不变
const fetchWithTimeout = (url, options, timeout = 8000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
};

// 【新增】从 API 列表中获取一个可用的视频 URL - 保持不变
const getAvailableVideoUrl = async () => {
    const shuffledApis = [...API_URLS].sort(() => 0.5 - Math.random());
    for (const apiUrl of shuffledApis) {
        try {
            const response = await fetchWithTimeout(apiUrl, { method: 'GET' });
            if (response.ok && response.url && (response.url.includes('.mp4') || response.url.includes('.m3u8'))) {
                return response.url;
            }
        } catch (error) {
            console.warn(`从 ${apiUrl} 获取视频失败:`, error.message);
        }
    }
    return null;
};


const RandomVideoPlayer = () => {
    const videoPlayerRef = useRef(null); // 绑定到主视频元素
    const controlsTimeoutRef = useRef(null); // 用于自动隐藏控制条的定时器
    
    // === 状态管理 ===
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMuted, setIsMuted] = useState(true); // 默认静音
    const [isPlaying, setIsPlaying] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(false); // 控制条可见性
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(false); // 自动连播

    // === 回调函数 (使用 useCallback 避免在每次渲染时重新创建) ===

    // 【核心修复】确保所有操作 videoPlayerRef.current 的函数都在其有效时才执行
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
        }, 5000); // 5秒后自动隐藏
    }, [clearControlsTimeout]);

    const handleVideoClick = useCallback(() => {
        if (videoPlayerRef.current) {
            if (isPlaying) {
                videoPlayerRef.current.pause();
            } else {
                videoPlayerRef.current.play().catch(e => {
                    // 如果自动播放被阻止，这里可以提示用户点击播放
                    console.warn("点击播放失败:", e);
                    setError("播放失败，请稍后重试或尝试下一个");
                });
            }
            showControls(); // 每次点击都显示控制条
        }
    }, [isPlaying, showControls]);

    const loadNextVideo = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        clearControlsTimeout(); // 清除控制条定时器
        
        // 【核心修复】在切换视频时，先暂停并清空 src，确保浏览器释放资源
        if (videoPlayerRef.current) {
            videoPlayerRef.current.pause();
            videoPlayerRef.current.src = '';
            videoPlayerRef.current.load(); // 强制加载，清理旧资源
        }

        const url = await getAvailableVideoUrl();
        if (url && videoPlayerRef.current) {
            videoPlayerRef.current.src = url;
            videoPlayerRef.current.muted = true; // 每次加载新视频都确保是静音
            
            // 【核心修复】onloadedmetadata 应该在视频加载开始前绑定，而不是在回调中设置
            const onLoadedMetadata = async () => {
                try {
                    await videoPlayerRef.current.play();
                    setIsPlaying(true);
                    setIsLoading(false);
                    setError(null);
                } catch (e) {
                    console.warn("自动播放被阻止，等待用户交互:", e);
                    setIsPlaying(false);
                    setIsLoading(false);
                    setError("请点击播放按钮");
                }
                // 【核心修复】播放成功后才移除这个事件监听器
                videoPlayerRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            };

            const onError = (e) => {
                console.error("视频元素加载错误:", e);
                setError('视频播放失败，尝试加载下一个...');
                setIsLoading(false);
                // 自动尝试下一个视频
                setTimeout(loadNextVideo, 2000);
                 // 【核心修复】播放失败后才移除这个事件监听器
                videoPlayerRef.current.removeEventListener('error', onError);
            };

            // 【核心修复】绑定事件
            videoPlayerRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
            videoPlayerRef.current.addEventListener('error', onError);

            videoPlayerRef.current.load(); // 触发加载
        } else {
            setError('所有视频源都加载失败，请稍后重试');
            setIsLoading(false);
        }
    }, [clearControlsTimeout]);

    // === useEffect 钩子管理 ===

    // 1. 初始化加载
    useEffect(() => {
        loadNextVideo(); // 首次挂载时加载第一个视频

        // 清理函数，组件卸载时执行
        return () => {
            clearControlsTimeout();
            if (videoPlayerRef.current) {
                videoPlayerRef.current.pause();
                videoPlayerRef.current.src = '';
                videoPlayerRef.current.load();
            }
        };
    }, [loadNextVideo, clearControlsTimeout]); // 依赖 loadNextVideo

    // 2. 视频播放事件监听
    useEffect(() => {
        const player = videoPlayerRef.current;
        if (!player) return; // 确保播放器存在

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => {
            if (autoPlayEnabled) {
                loadNextVideo();
            } else {
                showControls();
            }
        };

        // 【核心修复】只在这里绑定一次这些通用事件
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        return () => {
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
        };
    }, [autoPlayEnabled, loadNextVideo, showControls]);


    // === 手势处理 (useDrag) ===
    const bind = useDrag(({ swipe: [, swipeY], down }) => {
        if (!down && swipeY === -1 && !isLoading) { // 向上滑动
             loadNextVideo();
        }
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
                onClick={handleVideoClick} // 点击视频时显示控制条，并切换播放/暂停
            />

            {/* 播放/暂停图标覆盖层 */}
            {!isPlaying && !isLoading && !error && (
                 <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    // 这个 div 只是视觉效果，实际点击由 video 元素处理
                 >
                    <i className="fas fa-play text-white text-6xl bg-black/30 p-4 rounded-full"></i>
                 </div>
            )}

            {/* 控制条 (静音、自动连播、下一个) */}
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
                {/* 自动连播按钮暂时移除，以免与手势冲突，或需要更复杂的UI展示其状态 */}
                {/* <button 
                    onClick={(e) => { 
                        e.stopPropagation();
                        setAutoPlayEnabled(!autoPlayEnabled); 
                        showControls();
                    }}
                    className={`bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30 ${autoPlayEnabled ? 'text-green-300' : ''}`}
                >
                    {autoPlayEnabled ? '关闭连播' : '自动连播'}
                </button> */}
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

export default RandomVideoPlayer;
