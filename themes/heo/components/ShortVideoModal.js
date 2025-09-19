// themes/heo/components/ShortVideoModal.js

import React from 'react';
import FullFeaturedVideoPlayer from './FullFeaturedVideoPlayer'; // 【核心修改】引入新的播放器组件

const ShortVideoModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black z-50 animate-fade-in">
            <FullFeaturedVideoPlayer /> {/* 【核心修改】使用新的播放器 */}
            
            {/* 关闭按钮 */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white bg-black/30 p-2 rounded-full z-30 hover:bg-black/50" // 提高 z-index
            >
                <i className="fas fa-times text-xl"></i>
            </button>

            <style jsx global>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ShortVideoModal;
