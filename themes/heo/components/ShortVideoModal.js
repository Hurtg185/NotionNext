// themes/heo/components/ShortVideoModal.js (完整且已修改，新增视频源切换设置)

import React, { useState, useEffect } from 'react';
import FullFeaturedVideoPlayer from './FullFeaturedVideoPlayer'; // 引入完整播放器

// 【新增】视频源列表，与你 Hiker 规则和 `pages/api/getVideo.js` 中的 API_URLS 对应
const VIDEO_SOURCES = [
    { key: 'default', name: '默认随机', url: null }, // null 表示让服务器随机选择
    { key: 'xjj', name: '随机姐姐', url: 'http://119.91.196.247:7778/xjj' },
    { key: 'xxgeek', name: '极客美女', url: 'https://t.xxgeek.com/tools/mmvod/m.php' },
    { key: 'cnmcom', name: '随机美女', url: 'https://api.cnmcom.com/dsp/' },
    // ... 添加其他你希望用户直接选择的 API 源
    { key: 'vvhan_girl', name: 'Vvhan-小姐姐', url: 'https://api.vvhan.com/api/girl' },
    { key: 'vvhan_video', name: 'Vvhan-视频', url: 'https://api.vvhan.com/api/video' },
    { key: 'tianmei', name: '天美 (xingchenfu)', url: 'http://api.xingchenfu.xyz/API/tianmei.php' },
    { key: 'hssp', name: '火烧视频 (xingchenfu)', url: 'http://api.xingchenfu.xyz/API/hssp.php' },
];

const ShortVideoModal = ({ onClose }) => {
    const [currentSourceKey, setCurrentSourceKey] = useState('default');
    const [customSourceUrl, setCustomSourceUrl] = useState('');
    const [showSourceSelector, setShowSourceSelector] = useState(false);

    // 加载用户上次选择的源或自定义源
    useEffect(() => {
        const savedKey = localStorage.getItem('short_video_source_key');
        const savedCustomUrl = localStorage.getItem('short_video_custom_url');
        if (savedKey) setCurrentSourceKey(savedKey);
        if (savedCustomUrl) setCustomSourceUrl(savedCustomUrl);
    }, []);

    const handleSourceChange = (key, url = null) => {
        setCurrentSourceKey(key);
        if (url) {
            setCustomSourceUrl(url);
            localStorage.setItem('short_video_custom_url', url);
        } else {
            setCustomSourceUrl('');
            localStorage.removeItem('short_video_custom_url');
        }
        localStorage.setItem('short_video_source_key', key);
        setShowSourceSelector(false); // 切换后关闭选择器

        // 【核心修改】派发事件通知播放器，触发其刷新
        window.dispatchEvent(new CustomEvent('short-video-source-change', {
            detail: { sourceKey: key, customUrl: url }
        }));
    };

    const handleCustomUrlSubmit = (e) => {
        e.preventDefault();
        if (customSourceUrl.trim()) {
            handleSourceChange('custom', customSourceUrl.trim());
        } else {
            alert('请输入有效的视频地址！');
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-50 animate-fade-in">
            <FullFeaturedVideoPlayer 
                sourceKey={currentSourceKey} 
                customSourceUrl={customSourceUrl} 
            />
            
            {/* 关闭按钮 */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white bg-black/30 p-2 rounded-full z-30 hover:bg-black/50"
            >
                <i className="fas fa-times text-xl"></i>
            </button>

            {/* 设置按钮 (用于切换视频源) */}
            <button 
                onClick={() => setShowSourceSelector(true)}
                className="absolute top-4 left-4 text-white bg-black/30 p-2 rounded-full z-30 hover:bg-black/50"
            >
                <i className="fas fa-cog text-xl"></i>
            </button>

            {/* 视频源选择器模态框 */}
            {showSourceSelector && (
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
                    onClick={() => setShowSourceSelector(false)}
                >
                    <div 
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-11/12 max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">选择视频源</h3>
                        <div className="space-y-3 mb-4">
                            {VIDEO_SOURCES.map(source => (
                                <button 
                                    key={source.key}
                                    onClick={() => handleSourceChange(source.key, source.url)}
                                    className={`w-full text-left p-3 rounded-md transition-colors ${currentSourceKey === source.key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'} hover:bg-blue-50 dark:hover:bg-blue-800/50`}
                                >
                                    {source.name}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={handleCustomUrlSubmit} className="mt-4">
                            <input
                                type="url"
                                value={customSourceUrl}
                                onChange={(e) => setCustomSourceUrl(e.target.value)}
                                placeholder="或输入自定义视频地址 (http/https)"
                                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <button 
                                type="submit"
                                className="w-full mt-2 bg-green-500 text-white p-2 rounded-md hover:bg-green-600"
                            >
                                使用此地址
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ShortVideoModal;
