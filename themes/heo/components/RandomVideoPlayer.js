// themes/heo/components/RandomVideoPlayer.js (完整且已修改)

import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from '@use-gesture/react';

const API_URLS = [
    'https://api.vvhan.com/api/girl',
    'https://api.vvhan.com/api/video',
    'https://api.vvhan.com/api/dongman'
];

const RandomVideoPlayer = () => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [preloadedVideoUrl, setPreloadedVideoUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(true); // 初始假设为播放状态

    const getRandomAPI = () => {
        const randomIndex = Math.floor(Math.random() * API_URLS.length);
        return API_URLS[randomIndex];
    };

    const loadVideo = async (url) => {
        setIsLoading(true);
        if (videoRef.current) {
            videoRef.current.src = url;
            try {
                // play() 返回一个 promise
                await videoRef.current.play();
                setIsPlaying(true);
            } catch (error) {
                console.warn("Autoplay was likely prevented by browser.", error);
                setIsPlaying(false); // 如果播放失败，更新状态为暂停
            }
        }
    };
    
    const preloadNextVideo = async () => {
        try {
            const response = await fetch(getRandomAPI());
            if (response.ok) {
                setPreloadedVideoUrl(response.url);
                console.log('Preloaded next video:', response.url);
            }
        } catch (error) { console.error('Preload failed:', error); }
    };
    
    const nextVideo = () => {
        if (preloadedVideoUrl) {
            loadVideo(preloadedVideoUrl);
            setPreloadedVideoUrl(null);
        } else {
            fetch(getRandomAPI()).then(res => { if (res.ok) loadVideo(res.url); });
        }
    };
    
    useEffect(() => {
        // 初始加载第一个视频
        fetch(getRandomAPI()).then(res => { if (res.ok) loadVideo(res.url); });
    }, []);

    useEffect(() => {
        // 视频加载成功并开始播放后，预加载下一个
        if (isPlaying && !isLoading) {
            setTimeout(preloadNextVideo, 1000);
        }
    }, [isPlaying, isLoading]);

    // 手势处理
    const bind = useDrag(({ swipe: [, swipeY], down }) => {
        // 只有在滑动结束且是垂直向上滑动时才切换
        if (!down && swipeY === -1) {
             nextVideo();
        }
    }, {
        // 配置手势的阈值，防止误触
        swipe: { distance: 50, velocity: 0.3 }
    });

    const handleVideoClick = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    return (
        <div {...bind()} className="w-full h-full bg-black flex items-center justify-center relative touch-none select-none">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <p className="mt-4 text-white">加载中...</p>
                </div>
            )}
            
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                loop
                muted // 【核心修复】默认静音，这是自动播放的关键
                onCanPlay={() => setIsLoading(false)} // 视频可以播放时，隐藏加载动画
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={handleVideoClick}
            />

            {/* 暂停时显示的播放图标 */}
            {!isPlaying && !isLoading && (
                 <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity"
                    // 点击视频区域也会触发播放，所以这里不需要独立的 onClick
                 >
                    <i className="fas fa-play text-white text-6xl bg-black/30 p-4 rounded-full"></i>
                 </div>
            )}

            {/* 【新增】首次进入的手势提示 */}
            <div className="absolute bottom-24 w-full text-center text-white/70 animate-pulse-fade-out z-10 pointer-events-none">
                <p>上滑切换视频</p>
                <i className="fas fa-chevron-up mt-1"></i>
            </div>

            <style jsx global>{`
                @keyframes pulse-fade-out {
                    0% { opacity: 0.8; transform: translateY(0); }
                    50% { opacity: 1; transform: translateY(-5px); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
                .animate-pulse-fade-out {
                    animation: pulse-fade-out 3s ease-in-out forwards;
                }
            `}</style>
        </div>
    );
};

export default RandomVideoPlayer;
