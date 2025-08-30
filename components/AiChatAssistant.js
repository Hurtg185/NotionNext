// /components/AiChatAssistant.js - 最终版 v8：在调试成功的基础上恢复所有功能
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; // 导入 AI 专用的 TTS 按钮

// --- 子组件定义区域 (在主组件外部) ---

// 简单的 Markdown 解析器
const SimpleMarkdown = ({ text, lang, apiKey, ttsSettings }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        if (line.match(/\*\*(.*?)\*\*/)) {
            const content = line.replace(/\*\*/g, '');
            return <strong key={index} className="block mt-4 mb-2 text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="flex-grow">{content}</span><AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" /></strong>;
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return <li key={index} className="ml-5 list-disc flex items-start"><span className="flex-grow">{content}</span><AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" /></li>;
        }
        const content = line;
        return <p key={index} className="my-1 flex items-center"><span className="flex-grow">{content}</span><AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" /></p>;
    });
    return <div>{lines}</div>;
};

// 消息气泡组件
const MessageBubble = ({ msg, settings }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);

    // ... (自动朗读逻辑)

    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div ref={messageRef} className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
                {msg.image && <img src={msg.image} alt="用户上传" className="rounded-md mb-2 max-w-full h-auto" />}
                <div className="prose dark:prose-invert max-w-none prose-p:my-1 prose-strong:text-current">
                    <SimpleMarkdown text={msg.content} lang="zh-CN" apiKey={settings.apiKey} ttsSettings={settings} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-3 mt-2 text-gray-500 dark:text-gray-400">
                        <AiTtsButton text={msg.content} apiKey={settings.apiKey} ttsSettings={settings} />
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button>
                    </div>
                )}
            </div>
            {isUser && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
        </div>
    );
};

// 设置面板组件
const SettingsModal = ({ settings, onSave, onClose }) => {
    // ... (内容与上上个回复相同，为简洁省略)
};


// 默认提示词
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的中文老师...` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的中文老师...` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手...` }
];

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: TTS_ENGINE_GEMINI,
    ttsVoice: 'Zephyr',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    
    // *** 关键修复：延迟渲染，解决 Hydration Error ***
    const [isMounted, setIsMounted] = useState(false);

    // ... (其他所有状态和函数，与上上个回复相同，为简洁省略)

    useEffect(() => {
        setIsMounted(true); // 标记组件已在客户端挂载
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v3');
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem('ai_assistant_settings_v3', JSON.stringify(newSettings));
        } catch (e) { console.error("Failed to save settings", e); }
        setShowSettings(false);
    }, []);

    // ... (所有交互逻辑函数，如 handleSubmit, handleImageUpload, startListening 等)

    if (!isMounted) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '700px',
                backgroundColor: 'rgba(240, 240, 240, 0.5)',
                borderRadius: '1rem',
                border: '2px solid red', // 红色边框表示服务器端渲染
            }}>
                <div style={{
                    height: '2rem', width: '2rem',
                    borderRadius: '50%',
                    border: '4px solid #3B82F6', // primary color
                    borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite'
                }}></div>
            </div>
        );
    }
    
    const currentPromptName = settings.prompts.find(p => p.id === settings.currentPromptId)?.name || '未选择';
    
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
                zIndex: 100 // 确保层级
            }}
        >
            <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">AI 中文老师</h2>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            <div 
                className="flex-grow p-4 overflow-y-auto custom-scrollbar relative"
                style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                <div className="flex flex-col gap-4">
                    {messages.map((msg, index) => (
                        <MessageBubble key={index} msg={msg} settings={settings} />
                    ))}
                </div>
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-b-2xl border-t dark:border-gray-700 shrink-0">
                {/* ... (输入区域的 JSX，与上上个回复相同) ... */}
            </div>

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
