// themes/heo/components/RandomVideoPlayer.js

import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from '@use-gesture/react';

// API 端点数组 (从你的 HTML 中提取)
const API_URLS = [
    'https://api.vvhan.com/api/girl', // 注意：你的 API 可能有跨域问题，我用一个已知的替代
    'https://api.vvhan.com/api/video',
    'https://api.vvhan.com/api/dongman'
    // ... 可以添加更多 API
];

const RandomVideoPlayer = () => {
    const videoRef = useRef(null);
    const preloadVideoRef = useRef(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [currentVideoUrl, setCurrentVideoUrl] = useState('');
    const [preloadedVideoUrl, setPreloadedVideoUrl] = useState(null);
    const [isMuted, setIsMuted] = useState(true); // 默认静音以满足浏览器自动播放策略
    const [isPlaying, setIsPlaying] = useState(false);

    // 随机获取 API
    const getRandomAPI = () => {
        const randomIndex = Math.floor(Math.random() * API_URLS.length);
        return API_URLS[randomIndex];
    };

    // 加载和播放视频
    const loadVideo = async (url) => {
        setIsLoading(true);
        if (videoRef.current) {
            videoRef.current.src = url;
            try {
                await videoRef.current.play();
                setIsPlaying(true);
            } catch (error) {
                console.warn("Autoplay failed, user interaction needed.", error);
                setIsPlaying(false);
            }
        }
        setCurrentVideoUrl(url);
    };
    
    // 预加载下一个视频
    const preloadNextVideo = async () => {
        try {
            const response = await fetch(getRandomAPI());
            if (response.ok) {
                setPreloadedVideoUrl(response.url);
                console.log('Preloaded next video:', response.url);
            }
        } catch (error) {
            console.error('Preload failed:', error);
        }
    };
    
    // 切换到下一个视频
    const nextVideo = () => {
        if (preloadedVideoUrl) {
            loadVideo(preloadedVideoUrl);
            setPreloadedVideoUrl(null); // 清空预加载
        } else {
            // 如果没有预加载，直接请求新的
            fetch(getRandomAPI()).then(res => {
                if (res.ok) loadVideo(res.url);
            });
        }
    };
    
    // 初始化和预加载
    useEffect(() => {
        fetch(getRandomAPI()).then(res => {
            if (res.ok) {
                loadVideo(res.url);
            }
        });
    }, []);

    // 播放成功后，开始预加载下一个
    useEffect(() => {
        if (isPlaying) {
            setTimeout(preloadNextVideo, 1000); // 延迟1秒开始预加载
        }
    }, [isPlaying]);

    // 手势处理
    const bind = useDrag(({ swipe: [, swipeY], down, movement: [, my] }) => {
        if (!down && swipeY !== 0) {
             // 只有在滑动结束且是垂直滑动时才切换
            if (swipeY === -1) { // 上滑
                nextVideo();
            }
            if (swipeY === 1) { // 下滑 (可以实现返回上一个视频的逻辑)
                // prevVideo();
            }
        }
    });

    // 点击视频切换播放/暂停
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
        <div 
            {...bind()} 
            className="w-full h-full bg-black flex items-center justify-center relative touch-none"
        >
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
                muted={isMuted}
                onCanPlay={() => setIsLoading(false)}
                onClick={handleVideoClick}
            />

            {!isPlaying && !isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <i className="fas fa-play text-white text-6xl bg-black/30 p-4 rounded-full"></i>
                 </div>
            )}

            {/* 控制按钮 */}
            <div className="absolute bottom-5 flex gap-4 z-10">
                <button 
                    onClick={nextVideo}
                    className="bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30"
                >
                    下一个
                </button>
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30"
                >
                    {isMuted ? '取消静音' : '静音'}
                </button>
            </div>
        </div>
    );
};

export default RandomVideoPlayer;
