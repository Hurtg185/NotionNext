// /components/AiChatAssistant.js - 终极调试版 v9：简化 UI，逐步排查
import React, { useState, useEffect, useRef } from 'react';
// 暂时移除所有不必要的 import
// import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; 

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    // 只保留最核心的 state
    const [isMounted, setIsMounted] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'ai', content: '你好！有什么可以帮助你的吗？' },
        { role: 'user', content: '我有一个问题...' }
    ]); // 添加一些静态消息用于测试布局

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 如果组件尚未在客户端挂载，则显示加载状态
    if (!isMounted) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '700px',
                backgroundColor: 'rgba(240, 240, 240, 0.5)',
                borderRadius: '1rem',
                border: '5px solid red', // 红色边框表示服务器端渲染
            }}>
                <div style={{
                    height: '2rem', width: '2rem',
                    borderRadius: '50%',
                    border: '4px solid #3B82F6',
                    borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <style jsx global>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }
    
    // 渲染 UI 骨架
    return (
        <div 
            className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800"
            style={{ 
                height: '80vh', 
                minHeight: '600px', 
                maxHeight: '900px',
                // --- 强制显示的 CSS ---
                display: 'flex !important',
                visibility: 'visible !important',
                opacity: '1 !important',
                zIndex: 100
            }}
        >
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <img src="/images/ai-avatar.png" alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">AI 中文老师 (调试)</h2>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            {/* 聊天消息显示区域 */}
            <div 
                className="flex-grow p-4 overflow-y-auto custom-scrollbar relative"
                style={{ backgroundImage: `url('/images/chat-bg.jpg')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                <div className="flex flex-col gap-4">
                    {/* 使用静态消息渲染 */}
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'ai' && <img src="/images/ai-avatar.png" alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
                            <div className={`p-3 rounded-2xl text-left ${msg.role === 'user' ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
                                <p>{msg.content}</p>
                            </div>
                            {msg.role === 'user' && <img src="/images/user-avatar.png" alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* 输入区域 */}
            <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-b-2xl border-t dark:border-gray-700 shrink-0">
                <div className="flex items-end gap-2">
                    <div className="flex gap-1">
                        <button className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-image"></i></button>
                        <button className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-video"></i></button>
                    </div>
                    <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="输入消息..." className="flex-grow px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none max-h-32" rows="1" />
                    <button className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-microphone"></i></button>
                    <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-dark"><i className="fas fa-arrow-up"></i></button>
                </div>
            </div>
        </div>
    );
};

export default AiChatAssistant;
