// themes/heo/components/ShortVideoModal.js

import React from 'react';
import RandomVideoPlayer from './RandomVideoPlayer';

const ShortVideoModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black z-50 animate-fade-in">
            <RandomVideoPlayer />

            {/* 关闭按钮 */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white bg-black/30 p-2 rounded-full z-10 hover:bg-black/50"
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
