// themes/heo/components/RandomVideoPlayer.js (修正版)

import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from '@use-gesture/react';

const API_URLS = [
    'https://api.vvhan.com/api/video',
    'https://api.vvhan.com/api/girl'
    // 还可以加其他接口，比如:
    // 'http://api.xingchenfu.xyz/API/hssp.php',
    // 'http://api.xingchenfu.xyz/API/wmsc.php',
   // ‘http://api.xingchenfu.xyz/API/xgg.php’,
    
];

// --- 请求超时函数 ---
const fetchWithTimeout = (url, options, timeout = 8000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
};

// --- 从 API 中解析出真正的 mp4 链接 ---
const extractVideoUrl = async (response, apiUrl) => {
    try {
        // 1. 如果是 JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`来自 ${apiUrl} 的 JSON 数据:`, data);

            // vvhan 接口返回格式 { "success": true, "url": "xxx.mp4" }
            if (data.url && data.url.includes('.mp4')) {
                return data.url;
            }
        }

        // 2. 如果是直接重定向到 mp4
        if (response.url && response.url.includes('.mp4')) {
            return response.url;
        }

        // 3. 如果是纯文本（有的接口直接返回视频地址字符串）
        const text = await response.text();
        if (text && text.includes('.mp4')) {
            return text.trim();
        }
    } catch (err) {
        console.warn(`解析 ${apiUrl} 的返回内容失败:`, err.message);
    }
    return null;
};

// --- 获取一个可用的视频 URL ---
const getAvailableVideoUrl = async () => {
    const shuffledApis = [...API_URLS].sort(() => 0.5 - Math.random());

    for (const apiUrl of shuffledApis) {
        try {
            console.log(`尝试从 ${apiUrl} 获取视频...`);
            const response = await fetchWithTimeout(apiUrl, { method: 'GET' });
            if (response.ok) {
                const videoUrl = await extractVideoUrl(response, apiUrl);
                if (videoUrl) {
                    console.log(`成功获取视频: ${videoUrl}`);
                    return videoUrl;
                }
            }
        } catch (error) {
            console.warn(`从 ${apiUrl} 获取视频失败:`, error.message);
        }
    }
    return null;
};

const RandomVideoPlayer = () => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(true);

    const loadVideo = async (url) => {
        setIsLoading(true);
        setError(null);
        if (videoRef.current) {
            videoRef.current.src = url;
            try {
                await videoRef.current.play();
            } catch (err) {
                console.warn("自动播放失败，用户可能需要手动点击播放:", err.message);
                setIsPlaying(false);
            }
        }
    };

    const nextVideo = async () => {
        setIsLoading(true);
        const url = await getAvailableVideoUrl();
        if (url) {
            loadVideo(url);
        } else {
            setError('视频加载失败，请稍后重试');
            setIsLoading(false);
        }
    };

    useEffect(() => {
        nextVideo(); // 初始加载
    }, []);

    const bind = useDrag(({ swipe: [, swipeY], down }) => {
        if (!down && swipeY === -1) { // 上滑切换
             nextVideo();
        }
    }, { swipe: { distance: 50, velocity: 0.3 } });

    const handleVideoClick = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
        }
    };

    return (
        <div {...bind()} className="w-full h-full bg-black flex items-center justify-center relative touch-none select-none">
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
                            <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                            <p className="text-white text-center px-4">{error}</p>
                            <button 
                                onClick={nextVideo}
                                className="mt-6 bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-semibold hover:bg-white/30"
                            >
                                点击重试
                            </button>
                        </>
                    )}
                </div>
            )}
            
            <video
                ref={videoRef}
                className={`w-full h-full object-contain transition-opacity duration-300 ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
                autoPlay
                playsInline
                loop
                muted
                onCanPlay={() => { setIsLoading(false); setError(null); }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={handleVideoClick}
                onError={(e) => {
                    console.error('Video error:', e);
                    setError('视频播放失败，可能已失效');
                    setIsLoading(false);
                }}
            />

            {!isPlaying && !isLoading && !error && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <i className="fas fa-play text-white text-6xl bg-black/30 p-4 rounded-full"></i>
                 </div>
            )}
        </div>
    );
};

export default RandomVideoPlayer;
