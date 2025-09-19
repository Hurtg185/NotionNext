import React, { useState, useEffect } from 'react';
import FullFeaturedVideoPlayer from './FullFeaturedVideoPlayer';

const VIDEO_SOURCES = [
    { key: 'default', name: '默认随机', url: null },
    { key: 'xjj', name: '随机姐姐', url: 'http://119.91.196.247:7778/xjj' },
    { key: 'xxgeek', name: '极客美女', url: 'https://t.xxgeek.com/tools/mmvod/m.php' },
    { key: 'cnmcom', name: '随机美女', url: 'https://api.cnmcom.com/dsp/' },
    { key: 'vvhan_girl', name: 'Vvhan-小姐姐', url: 'https://api.vvhan.com/api/girl' },
    { key: 'vvhan_video', name: 'Vvhan-视频', url: 'https://api.vvhan.com/api/video' },
    { key: 'tianmei', name: '天美', url: 'http://api.xingchenfu.xyz/API/tianmei.php' },
    { key: 'hssp', name: '火烧视频', url: 'http://api.xingchenfu.xyz/API/hssp.php' },
];

const ShortVideoModal = ({ onClose }) => {
    const [currentSourceKey, setCurrentSourceKey] = useState('default');
    const [customSourceUrl, setCustomSourceUrl] = useState('');
    const [showSourceSelector, setShowSourceSelector] = useState(false);

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
        setShowSourceSelector(false);

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
        <div className="fixed inset-0 bg-black z-50">
            <FullFeaturedVideoPlayer sourceKey={currentSourceKey} customSourceUrl={customSourceUrl} />
            <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/30 p-2 rounded-full z-30">
                <i className="fas fa-times"></i>
            </button>
            <button onClick={() => setShowSourceSelector(true)} className="absolute top-4 left-4 text-white bg-black/30 p-2 rounded-full z-30">
                <i className="fas fa-cog"></i>
            </button>
            {showSourceSelector && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40" onClick={() => setShowSourceSelector(false)}>
                    <div className="bg-white p-6 rounded-lg w-11/12 max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">选择视频源</h3>
                        <div className="space-y-2">
                            {VIDEO_SOURCES.map(source => (
                                <button key={source.key} onClick={() => handleSourceChange(source.key, source.url)}
                                    className={`w-full p-2 rounded ${currentSourceKey === source.key ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                    {source.name}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={handleCustomUrlSubmit} className="mt-4">
                            <input type="url" value={customSourceUrl} onChange={(e) => setCustomSourceUrl(e.target.value)} placeholder="自定义地址" className="w-full p-2 border rounded" />
                            <button type="submit" className="w-full mt-2 bg-green-500 text-white p-2 rounded">使用此地址</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShortVideoModal;
