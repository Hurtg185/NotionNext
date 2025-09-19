// themes/heo/components/RandomVideoPlayer.js (最终健壮版)

import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from '@use-gesture/react';

const API_URLS = [
    'https://api.vvhan.com/api/girl',
    'https://api.vvhan.com/api/video'
    // 你可以从你的 HTML 版本中把 api.xingchenfu.xyz 的链接也加进来测试
    // 'http://api.xingchenfu.xyz/API/hssp.php',
    // 'http://api.xingchenfu.xyz/API/wmsc.php',
];

// 【新增】请求超时函数
const fetchWithTimeout = (url, options, timeout = 8000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
};

// 【新增】从 API 列表中获取一个可用的视频 URL
const getAvailableVideoUrl = async () => {
    // 打乱 API 顺序，避免每次都请求同一个
    const shuffledApis = [...API_URLS].sort(() => 0.5 - Math.random());

    for (const apiUrl of shuffledApis) {
        try {
            console.log(`尝试从 ${apiUrl} 获取视频...`);
            const response = await fetchWithTimeout(apiUrl, { method: 'GET' });
            if (response.ok && response.url && response.url.includes('.mp4')) {
                console.log(`成功获取视频: ${response.url}`);
                return response.url;
            }
        } catch (error) {
            console.warn(`从 ${apiUrl} 获取视频失败:`, error.message);
        }
    }
    // 如果所有 API 都失败了
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
                playsInline
                loop
                muted
                onCanPlay={() => { setIsLoading(false); setError(null); }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={handleVideoClick}
                onError={() => {
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
