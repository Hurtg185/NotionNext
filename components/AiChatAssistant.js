// /components/AiChatAssistant.js - 终极调试版：强制显示
import React, { useState, useEffect, useRef, useCallback } from 'react';
// 暂时移除 AiTtsButton 导入，简化依赖
// import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; 

// --- 所有子组件和常量定义 (与之前相同) ---
// ...
// ...

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState({}); // 初始为空对象
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // ... (其他所有状态和函数)

    useEffect(() => {
        setIsMounted(true);
        // ... (localStorage 读取逻辑)
    }, []);

    // --- 强制显示的关键 ---
    if (!isMounted) {
        // 服务器端渲染时，返回一个简单的 div，确保与客户端初始渲染一致
        return (
            <div style={{
                display: 'block !important',
                visibility: 'visible !important',
                opacity: '1 !important',
                border: '5px solid red', // 非常醒目的红色边框
                padding: '20px',
                color: 'black',
                backgroundColor: 'yellow',
                zIndex: 99999
            }}>
                组件正在加载中...
            </div>
        );
    }
    
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
                border: '5px solid blue', // 非常醒目的蓝色边框
                zIndex: 99999
            }}
        >
            <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">AI 中文学习助手 (调试版)</h2>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            <div className="flex-grow p-4 overflow-y-auto">
                <p className="text-center text-gray-500 dark:text-gray-400">组件内容区域</p>
                {/* 暂时简化聊天内容，只显示 "组件内容区域" */}
            </div>

            <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-b-2xl border-t dark:border-gray-700 shrink-0">
                <textarea placeholder="输入..." className="w-full p-2 border rounded" />
            </div>

            {showSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-2xl font-bold mb-4">设置面板</h3>
                        <p>这里是设置内容。</p>
                        <button onClick={() => setShowSettings(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded">关闭</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// 为了调试，暂时移除所有复杂的子组件，只导出主组件
export default AiChatAssistant;
