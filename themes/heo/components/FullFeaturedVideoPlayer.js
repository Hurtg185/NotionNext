import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';

const fetchVideoUrlFromServer = async (sourceUrl = null) => {
    try {
        let requestUrl = '/api/getVideo';
        if (sourceUrl) requestUrl += `?url=${encodeURIComponent(sourceUrl)}`;
        
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

const FullFeaturedVideoPlayer = ({ sourceKey, customSourceUrl }) => {
    const videoPlayerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(false);
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);

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
        }, 5000);
    }, [clearControlsTimeout]);

    const handleVideoClick = useCallback(() => {
        if (!videoPlayerRef.current) return;
        if (isPlaying) {
            videoPlayerRef.current.pause();
        } else {
            videoPlayerRef.current.play().catch(e => {
                console.warn("点击播放失败:", e);
                setError("播放失败，请重试");
            });
        }
        showControls();
    }, [isPlaying, showControls]);

    const loadNextVideo = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        clearControlsTimeout();

        if (videoPlayerRef.current) {
            videoPlayerRef.current.pause();
            videoPlayerRef.current.removeAttribute('src');
            videoPlayerRef.current.load();
        }

        let urlToFetch = null;
        if (sourceKey === 'custom' && customSourceUrl) {
            urlToFetch = customSourceUrl;
        } else if (sourceKey === 'default' || !sourceKey) {
            urlToFetch = null;
        } else {
            urlToFetch = customSourceUrl;
        }

        try {
            const videoUrl = await fetchVideoUrlFromServer(urlToFetch);
            if (!videoUrl) throw new Error('未获取到有效视频 URL');

            if (videoPlayerRef.current) {
                videoPlayerRef.current.src = videoUrl;
                videoPlayerRef.current.muted = true;

                const onLoaded = async () => {
                    try {
                        await videoPlayerRef.current.play();
                        setIsPlaying(true);
                        setIsLoading(false);
                    } catch (e) {
                        console.warn("自动播放失败:", e);
                        setIsPlaying(false);
                        setIsLoading(false);
                        setError("请点击播放按钮");
                    }
                    videoPlayerRef.current.removeEventListener('loadedmetadata', onLoaded);
                };

                const onError = () => {
                    console.error("视频加载错误");
                    setError("视频播放失败，尝试下一个...");
                    setIsLoading(false);
                    setTimeout(loadNextVideo, 3000); // 延迟切下一个
                    videoPlayerRef.current.removeEventListener('error', onError);
                };

                videoPlayerRef.current.addEventListener('loadedmetadata', onLoaded);
                videoPlayerRef.current.addEventListener('error', onError);
                videoPlayerRef.current.load();
            }
        } catch (err) {
            console.error("获取视频失败:", err.message);
            setError(`获取失败: ${err.message}`);
            setIsLoading(false);
        }
    }, [clearControlsTimeout, sourceKey, customSourceUrl]);

    useEffect(() => {
        loadNextVideo();
        const handleSourceChange = () => loadNextVideo();
        window.addEventListener('short-video-source-change', handleSourceChange);
        return () => {
            clearControlsTimeout();
            if (videoPlayerRef.current) {
                videoPlayerRef.current.pause();
                videoPlayerRef.current.removeAttribute('src');
            }
            window.removeEventListener('short-video-source-change', handleSourceChange);
        };
    }, [loadNextVideo, clearControlsTimeout]);

    useEffect(() => {
        const player = videoPlayerRef.current;
        if (!player) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => autoPlayEnabled ? loadNextVideo() : showControls();

        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);
        return () => {
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
        };
    }, [autoPlayEnabled, loadNextVideo, showControls]);

    const bind = useDrag(({ swipe: [, swipeY], down }) => {
        if (!down && swipeY === -1 && !isLoading) loadNextVideo();
    }, { swipe: { distance: 50, velocity: 0.3 } });

    return (
        <div {...bind()} className="w-full h-full bg-black flex items-center justify-center relative select-none">
            {(isLoading || error) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                    {isLoading && !error && (
                        <>
                            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <p className="mt-4 text-white">加载中...</p>
                        </>
                    )}
                    {error && (
                        <>
                            <p className="text-white">{error}</p>
                            <button onClick={loadNextVideo} className="mt-4 bg-white/20 text-white px-4 py-2 rounded">
                                重试 / 下一个
                            </button>
                        </>
                    )}
                </div>
            )}
            <video
                ref={videoPlayerRef}
                className={`w-full h-full object-contain ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
                playsInline
                muted={isMuted}
                onClick={handleVideoClick}
            />
            {!isPlaying && !isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <i className="fas fa-play text-white text-6xl bg-black/30 p-4 rounded-full"></i>
                </div>
            )}
        </div>
    );
};

export default FullFeaturedVideoPlayer;
