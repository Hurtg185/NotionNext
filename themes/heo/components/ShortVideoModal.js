// themes/heo/components/ShortVideoModal.js (完整且已修改)

import React, { useState } from 'react';
import RandomVideoPlayer from './RandomVideoPlayer';

const ShortVideoModal = ({ onClose }) => {
    const [isMuted, setIsMuted] = useState(true); // 与播放器初始状态一致

    // 这个函数现在没用了，因为 RandomVideoPlayer 自己处理了静音
    // const toggleMute = () => {
    //     // 这里需要一种方式来控制子组件的 video 元素
    //     // 更简单的方式是在 RandomVideoPlayer 内部处理
    //     setIsMuted(!isMuted);
    // };

    return (
        <div className="fixed inset-0 bg-black z-50 animate-fade-in">
            {/* 
                传递 isMuted 状态和 setIsMuted 函数给子组件，让子组件可以控制声音
                为了简化，我们暂时不在 Modal 中添加按钮，让用户点击视频交互
                如果需要全局静音按钮，需要更复杂的 state lifting
            */}
            <RandomVideoPlayer />

            {/* 关闭按钮 */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white bg-black/30 p-2 rounded-full z-10 hover:bg-black/50"
            >
                <i className="fas fa-times text-xl"></i>
            </button>
            
            {/*
                如果需要一个全局的静音/取消静音按钮，可以放在这里
                <button 
                    onClick={toggleMute}
                    className="absolute top-4 left-4 text-white bg-black/30 p-2 rounded-full z-10 hover:bg-black/50"
                >
                    {isMuted ? <i className="fas fa-volume-mute text-xl"></i> : <i className="fas fa-volume-up text-xl"></i>}
                </button>
            */}

            <style jsx global>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ShortVideoModal;
