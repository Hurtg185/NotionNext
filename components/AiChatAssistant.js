// /components/AiChatAssistant.js - 调试 v12：恢复 API 调用功能
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; // 重新导入 AiTtsButton

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
    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
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

// 设置面板组件 (简化版，确保稳定)
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);

    const handleChange = (key, value) => {
        setTempSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium">你的 Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="在此粘贴你的 API 密钥" className="w-full p-2 border rounded mt-1" />
                </div>
                {/* 更多设置可以逐步加回 */}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded">保存设置</button>
                </div>
            </div>
        </div>
    );
};

// --- 默认设置和提示词 ---
const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的中文老师...` } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: 'gemini-tts-1',
    ttsVoice: 'Zephyr',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    
    const [inputMode, setInputMode] = useState('text');
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    // --- 初始化和保存设置 ---
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v_debug');
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
            setMessages([{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }]);
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem('ai_assistant_settings_v_debug', JSON.stringify(newSettings));
        } catch (e) { console.error("Failed to save settings", e); }
        setShowSettings(false);
    }, []);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- 恢复的核心功能 ---
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const textToProcess = userInput.trim();
        if (!textToProcess || isLoading) return;
        if (!settings.apiKey.trim()) {
            setError('请先在设置中输入您的 Google Gemini API 密钥！');
            setShowSettings(true);
            return;
        }

        const userMessage = { role: 'user', content: textToProcess };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId)?.content || DEFAULT_PROMPTS[0].content;
        const history = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${settings.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'system', parts: [{ text: currentPrompt }] }, ...history, { role: 'user', parts: [{ text: textToProcess }] }],
                        generationConfig: { temperature: 0.5, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
                    }),
                    signal: abortControllerRef.current.signal,
                }
            );
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || '请求失败');
            }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI 未能返回有效内容。');
            
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);

        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message);
                setMessages(prev => [...prev, { role: 'ai', content: `很抱歉，出错了：${err.message}` }]);
            } else {
                setError('AI 生成已停止。');
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };
    
    const handleStopGenerating = () => {
        abortControllerRef.current?.abort();
    };

    // --- 简化的交互逻辑 ---
    const handleImageUpload = (e) => { alert('图片功能正在调试中'); };
    const clearImage = () => { setImagePreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

    if (!isMounted) {
        return <div style={{ height: '700px', border: '5px solid red' }}><p>加载中...</p></div>;
    }
    
    return (
        <div 
            className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border flex flex-col bg-white dark:bg-gray-800"
            style={{ height: '80vh', minHeight: '600px', maxHeight: '900px', display: 'flex !important' }}
        >
            <div className="flex items-center justify-between p-4 rounded-t-2xl border-b shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold">AI 中文老师</h2>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            <div 
                className="flex-grow p-4 overflow-y-auto"
                style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover' }}
            >
                <div className="flex flex-col gap-4">
                    {messages.map((msg, index) => (
                        <MessageBubble key={index} msg={msg} settings={settings} />
                    ))}
                </div>
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t shrink-0">
                {imagePreviewUrl && (
                    <div className="relative mb-2 w-24">
                        <img src={imagePreviewUrl} alt="预览" className="rounded-lg" />
                        <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1" title="移除"><i className="fas fa-times text-xs"></i></button>
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <button type="button" onClick={handleImageUpload} className="p-3 rounded-full hover:bg-gray-200"><i className="fas fa-image"></i></button>
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                    
                    <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="输入消息..." className="flex-grow px-4 py-2 rounded-2xl bg-gray-100" rows="1" />

                    <button type="submit" className="p-3 bg-primary text-white rounded-full" disabled={isLoading || !userInput.trim()}>
                        {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <i className="fas fa-arrow-up"></i>}
                    </button>
                </div>
                 {isLoading && <button type="button" onClick={handleStopGenerating} className="w-full mt-2 text-sm text-red-500">停止生成</button>}
            </form>

            {error && <div className="p-2 m-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
