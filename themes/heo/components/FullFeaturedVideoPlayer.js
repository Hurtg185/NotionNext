// themes/heo/components/FullFeaturedVideoPlayer.js (完整且已修改)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';

// 【重要】将 VIDEO_SOURCES 列表定义移到 ShortVideoModal.js 中，并作为 prop 传递
// FullFeaturedVideoPlayer 只关心如何获取视频 URL，不直接维护源列表。

// --- API 服务 (服务器端中转逻辑) ---
const fetchVideoUrlFromServer = async (sourceUrl = null) => {
    try {
        let requestUrl = '/api/getVideo';
        if (sourceUrl) {
            requestUrl += `?url=${encodeURIComponent(sourceUrl)}`;
        }
        
        const response = await fetch(requestUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `服务器错误: ${response.status}`);
        }
        const data = await response.json();
        return data.videoUrl;
    } catch (error) {
        console.error("从服务器获取视频 URL 失败:", error.message);
        throw error;
    }
};

// --- 组件开始 ---
// 【核心修改】FullFeaturedVideoPlayer 接收 sourceKey 和 customSourceUrl
const FullFeaturedVideoPlayer = ({ sourceKey, customSourceUrl }) => {
    const videoPlayerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    
    // === 状态管理 ===
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMuted, setIsMuted] = useState(true); // 默认静音
    const [isPlaying, setIsPlaying] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(false);
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);

    // === 回调函数 ===

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
        clearControlsTimeout();
        
        if (videoPlayerRef.current) {
            videoPlayerRef.current.pause();
            videoPlayerRef.current.src = '';
            videoPlayerRef.current.load();
        }

        let urlToFetch = null;
        try {
            // 【核心修复】根据 sourceKey 和 customSourceUrl 获取视频
            if (sourceKey === 'custom' && customSourceUrl) { // 如果是自定义URL
                urlToFetch = customSourceUrl;
            } else if (sourceKey === 'default' || !sourceKey) { // 如果是默认随机，或者没有指定 key
                urlToFetch = null; // 传递 null 给 fetchVideoUrlFromServer，让它自己随机选择
            } else { // 如果是预设源，但不是 'default' 或 'custom'
                // 这意味着 sourceKey 就是 ShortVideoModal.js 中的某个 VIDEO_SOURCES.key
                // ShortVideoModal.js 已经把对应的 URL 作为 customSourceUrl 传递过来
                // 所以这里直接使用 customSourceUrl
                urlToFetch = customSourceUrl; // 此时 customSourceUrl 就是选定源的 URL
            }
            
            const videoUrl = await fetchVideoUrlFromServer(urlToFetch); // 传递给服务器 API
            if (!videoUrl) throw new Error('未能获取到有效的视频 URL');


            if (videoUrl && videoPlayerRef.current) {
                videoPlayerRef.current.src = videoUrl;
                videoPlayerRef.current.muted = true;
                
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
                    if (videoPlayerRef.current) videoPlayerRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
                };

                const onError = (e) => {
                    console.error("视频元素加载错误:", e);
                    setError('视频播放失败，尝试加载下一个...');
                    setIsLoading(false);
                    setTimeout(loadNextVideo, 2000);
                    if (videoPlayerRef.current) videoPlayerRef.current.removeEventListener('error', onError);
                };

                videoPlayerRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
                videoPlayerRef.current.addEventListener('error', onError);
                videoPlayerRef.current.load();
            } else {
                setError('没有更多视频了');
                setIsLoading(false);
            }
        } catch (err) {
            console.error("获取视频 URL 失败:", err.message);
            setError(`获取视频 URL 失败: ${err.message}`);
            setIsLoading(false);
        }
    }, [clearControlsTimeout, sourceKey, customSourceUrl]); // 依赖这些 props


    // === useEffect 钩子管理 ===

    // 1. 初始化加载和源切换
    useEffect(() => {
        loadNextVideo(); // 首次挂载或源切换时加载视频

        // 监听源切换事件 (由 ShortVideoModal 派发)
        const handleSourceChange = (event) => {
            if (event.detail) {
                loadNextVideo(); // 收到源切换事件，立即重新加载视频
            }
        };
        window.addEventListener('short-video-source-change', handleSourceChange);

        return () => {
            clearControlsTimeout();
            if (videoPlayerRef.current) {
                videoPlayerRef.current.pause();
                videoPlayerRef.current.src = '';
                videoPlayerRef.current.load();
            }
            window.removeEventListener('short-video-source-change', handleSourceChange);
        };
    }, [loadNextVideo, clearControlsTimeout, sourceKey, customSourceUrl]); // 依赖源切换相关的 props

    // 2. 视频播放事件监听 - 保持不变
    useEffect(() => {
        const player = videoPlayerRef.current;
        if (!player) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => {
            if (autoPlayEnabled) {
                loadNextVideo();
            } else {
                showControls();
            }
        };

        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        return () => {
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
        };
    }, [autoPlayEnabled, loadNextVideo, showControls]);

    // 3. 页面可见性 API - 保持不变
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

    // 4. 窗口大小调整 (防抖) - 保持不变
    // ...

    // === 手势处理 (useDrag) ===
    const bind = useDrag(({ swipe: [, swipeY], down }) => {
        if (!down && swipeY === -1 && !isLoading) {
             loadNextVideo();
        }
    }, { swipe: { distance: 50, velocity: 0.3 }, from: () => [0, 0], bounds: { top: -Infinity, bottom: Infinity } });


    // === 渲染 JSX ===
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
