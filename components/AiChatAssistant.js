// /components/AiChatAssistant.js - 终极版 v11：增加全屏模式，分离TTS模型，优化UI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; // 导入 AI 专用的 TTS 按钮

// --- 子组件定义区域 (在主组件外部) ---

// 简单的 Markdown 解析器
const SimpleMarkdown = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        if (line.match(/\*\*(.*?)\*\*/)) {
            const content = line.replace(/\*\*/g, '');
            return <strong key={index} className="block mt-2 mb-1">{content}</strong>;
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return <li key={index} className="ml-5 list-disc">{content}</li>;
        }
        return <p key={index} className="my-1">{line}</p>;
    });
    return <div>{lines}</div>;
};

// 消息气泡组件
const MessageBubble = ({ msg, settings }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);

    // 自动朗读逻辑
    useEffect(() => {
        if (!isUser && msg.content && settings.autoRead && messageRef.current) {
            const ttsButton = messageRef.current.querySelector('.tts-button');
            if (ttsButton) {
                setTimeout(() => ttsButton.click(), 300);
            }
        }
    }, [isUser, msg.content, settings.autoRead]);

    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div ref={messageRef} className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
                {msg.image && <img src={msg.image} alt="用户上传" className="rounded-md mb-2 max-w-full h-auto" />}
                <div className="prose dark:prose-invert max-w-none prose-p:my-1 prose-strong:text-current">
                    <SimpleMarkdown text={msg.content} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-3 mt-2 text-gray-500 dark:text-gray-400">
                        {/* 将完整的 ttsSettings 传递给按钮 */}
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
    const [tempSettings, setTempSettings] = useState(settings);

    const handleChange = (key, value) => {
        setTempSettings(prev => ({ ...prev, [key]: value }));
    };

    const handlePromptChange = (e, promptId, field) => {
        const newPrompts = tempSettings.prompts.map(p =>
            p.id === promptId ? { ...p, [field]: e.target.value } : p
        );
        handleChange('prompts', newPrompts);
    };

    const handleAddPrompt = () => {
        const newId = `custom-${Date.now()}`;
        const newPrompts = [...tempSettings.prompts, { id: newId, name: '新提示词', content: '请输入提示词内容...' }];
        handleChange('prompts', newPrompts);
    };

    const handleDeletePrompt = (idToDelete) => {
        if (window.confirm('确定删除此提示词吗？')) {
            const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete);
            let newCurrentPromptId = tempSettings.currentPromptId;
            if (newCurrentPromptId === idToDelete) {
                newCurrentPromptId = newPrompts[0]?.id || '';
            }
            handleChange('prompts', newPrompts);
            handleChange('currentPromptId', newCurrentPromptId);
        }
    };

    const chatModels = [
        { name: 'Gemini 2.5 Flash (最快)', value: 'gemini-2.5-flash' },
        { name: 'Gemini 2.5 Pro (最强)', value: 'gemini-2.5-pro' },
        { name: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
        { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    ];
    
    const ttsModels = [
        { name: 'Flash TTS (推荐)', value: 'gemini-2.5-flash-preview-tts' },
        { name: 'Pro TTS', value: 'gemini-2.5-pro-preview-tts' },
        { name: 'Flash 001 TTS', value: 'gemini-2.0-flash-001' },
    ];

    const geminiTtsVoices = [
        { name: 'Zephyr (明亮)', value: 'Zephyr' }, { name: 'Puck (欢快)', value: 'Puck' },
        { name: 'Charon (信息丰富)', value: 'Charon' }, { name: 'Kore (坚定)', value: 'Kore' },
        { name: 'Fenrir (兴奋)', value: 'Fenrir' }, { name: 'Leda (年轻)', value: 'Leda' }
    ];

    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' },
        { name: '缅甸语', value: 'my-MM' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">设置</h3>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">你的 Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="在此粘贴你的 API 密钥" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" />
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 聊天模型</label>
                    <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        {chatModels.map(model => <option key={model.value} value={model.value}>{model.name}</option>)}
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 TTS 引擎</label>
                    <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value={TTS_ENGINE.GEMINI_TTS}>Gemini TTS (推荐, 需API Key)</option>
                        <option value="external_api">第三方 API (无需API Key)</option>
                    </select>
                </div>
                {tempSettings.ttsEngine === TTS_ENGINE.GEMINI_TTS && (
                    <div className="mb-4 pb-4 border-b dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <h5 className="text-md font-bold mb-2 text-gray-800 dark:text-white">Gemini TTS 配置</h5>
                         <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TTS 模型</label>
                                <select value={tempSettings.ttsModel} onChange={(e) => handleChange('ttsModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                    {ttsModels.map(model => <option key={model.value} value={model.value}>{model.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">发音人</label>
                                <select value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                    {geminiTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">语音识别语言</label>
                    <select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        {speechLanguageOptions.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI 回复后自动朗读</label>
                    <input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary" />
                </div>
                <div className="mb-6">
                    <h4 className="text-lg font-bold mb-3 text-gray-800 dark:text-white">自定义提示词管理</h4>
                    <div className="space-y-2 mb-4">
                        {tempSettings.prompts.map(prompt => (
                            <div key={prompt.id} className="flex flex-col p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center flex-grow cursor-pointer">
                                        <input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === prompt.id} onChange={() => handleChange('currentPromptId', prompt.id)} className="mr-2 text-primary" />
                                        <input type="text" value={prompt.name} onChange={(e) => handlePromptChange(e, prompt.id, 'name')} className="font-medium bg-transparent w-full border-b border-dashed" placeholder="提示词名称" />
                                    </label>
                                    <button onClick={() => handleDeletePrompt(prompt.id)} className="p-1 ml-2 text-sm bg-red-500 text-white rounded"><i className="fas fa-times"></i></button>
                                </div>
                                <textarea value={prompt.content} onChange={(e) => handlePromptChange(e, prompt.id, 'content')} className="w-full mt-2 h-24 p-2 bg-gray-50 dark:bg-gray-800 border rounded-md text-sm" placeholder="提示词内容..."></textarea>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddPrompt} className="w-full py-2 bg-green-500 text-white rounded-md"><i className="fas fa-plus mr-2"></i>添加新提示词</button>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存设置</button>
                </div>
            </div>
        </div>
    );
};

// 默认提示词和设置
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的、耐心的中文老师...` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的中文老师...` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手...` }
];

const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: TTS_ENGINE.GEMINI_TTS,
    ttsModel: 'gemini-2.5-flash-preview-tts', // 新增：默认TTS模型
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
    const [isMounted, setIsMounted] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');
    const [isFullScreen, setIsFullScreen] = useState(false); // 新增：全屏状态

    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    
    // --- 初始化和保存设置 ---
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v5_fullscreen'); // 使用新Key避免冲突
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    useEffect(() => {
        if (isMounted) {
            try {
                localStorage.setItem('ai_assistant_settings_v5_fullscreen', JSON.stringify(settings));
            } catch (e) { console.error("Failed to save settings", e); }
        }
    }, [settings, isMounted]);

    // --- 全屏模式副作用 ---
    useEffect(() => {
        if (isFullScreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        // 组件卸载时恢复滚动
        return () => {
            document.body.style.overflow = '';
        };
    }, [isFullScreen]);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        setShowSettings(false);
    }, []);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 组件挂载时添加初始欢迎消息
    useEffect(() => {
        if (isMounted && messages.length === 0) {
            setMessages([{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }]);
        }
    }, [isMounted]);

    // --- 交互逻辑 ---
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result.split(',')[1]);
                setImagePreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechRecognitionError('您的浏览器不支持语音输入功能。');
            return;
        }
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = settings.speechLanguage;
        recognitionRef.current.onstart = () => { setIsListening(true); setSpeechRecognitionError(''); };
        recognitionRef.current.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setUserInput(transcript.trim());
        };
        recognitionRef.current.onerror = (e) => {
            if (e.error !== 'no-speech') {
                setSpeechRecognitionError(`语音输入错误: ${e.error}`);
            }
            setIsListening(false);
        };
        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.start();
    }, [settings.speechLanguage]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const textToProcess = userInput.trim();
        if ((!textToProcess && !selectedImage) || isLoading) return;
        if (!settings.apiKey.trim()) {
            setError('请先在设置中输入您的 Google Gemini API 密钥！');
            setShowSettings(true);
            return;
        }

        const userMessageContent = [];
        if (textToProcess) userMessageContent.push({ text: textToProcess });
        if (selectedImage) userMessageContent.push({ inlineData: { mimeType: 'image/jpeg', data: selectedImage } });

        setMessages(prev => [...prev, { role: 'user', content: textToProcess || '[图片]', image: imagePreviewUrl }]);
        setUserInput('');
        clearImage();

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId)?.content || DEFAULT_PROMPTS[0].content;
        const history = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
        const contents = [
            { role: 'user', parts: [{ text: currentPrompt }] },
            { role: 'model', parts: [{ text: "好的，我明白了。我将扮演一名专业的中文老师。请开始提问吧。" }] },
            ...history,
            { role: 'user', parts: userMessageContent }
        ];

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${settings.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents, generationConfig: { temperature: 0.5, maxOutputTokens: 1024 } }),
                    signal: abortControllerRef.current.signal,
                }
            );
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error Response:', errorData); // 增加详细日志
                throw new Error(errorData.error?.message || `请求失败, 状态码: ${response.status}`);
            }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI 未能返回有效内容。');
            
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);
        } catch (err) {
            if (err.name !== 'AbortError') {
                const errorMessage = `API 请求失败: ${err.message}`;
                setError(errorMessage);
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

    if (!isMounted) {
        return (
            <div className="w-full h-[80vh] min-h-[600px] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }
    
    // 动态计算全屏和非全屏的样式
    const containerClasses = isFullScreen
        ? 'fixed inset-0 z-50 w-screen h-screen rounded-none'
        : 'relative w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700';

    const containerStyle = isFullScreen
        ? { height: '100vh', minHeight: '100vh', maxHeight: '100vh' }
        : { height: '90vh', minHeight: '650px', maxHeight: '900px' };

    return (
        <div className={`flex flex-col bg-white dark:bg-gray-800 ${containerClasses}`} style={containerStyle}>
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between py-1 px-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">AI 中文老师</h2>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title={isFullScreen ? "退出全屏" : "全屏模式"}>
                        <i className={`fas ${isFullScreen ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'}`}></i>
                    </button>
                    <button onClick={() => setShowSettings(true)} className="p-2 w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
                </div>
            </div>

            {/* 聊天消息显示区域 */}
            <div 
                className="flex-grow p-4 overflow-y-auto custom-scrollbar relative"
                style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                <div className="flex flex-col gap-4 pb-4">
                    {messages.map((msg, index) => (
                        <MessageBubble key={index} msg={msg} settings={settings} />
                    ))}
                </div>
                <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-b-2xl border-t dark:border-gray-700 shrink-0">
                {imagePreviewUrl && (
                    <div className="relative mb-2 w-24">
                        <img src={imagePreviewUrl} alt="预览" className="rounded-lg" />
                        <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none" title="移除"><i className="fas fa-times text-xs"></i></button>
                    </div>
                )}
                {speechRecognitionError && <p className="text-red-500 text-sm mb-2 text-center">{speechRecognitionError}</p>}
                
                {isLoading ? (
                    <div className="flex justify-center">
                        <button type="button" onClick={handleStopGenerating} className="w-full px-6 py-3 bg-red-500 text-white font-bold text-xl rounded-lg shadow-md hover:bg-red-600 flex items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-4 border-white border-t-transparent mr-2"></div>
                            停止生成
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex items-end gap-2">
                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-image"></i></button>
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

                        <div className="flex-grow relative">
                            <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                            <button
                                type="button"
                                onClick={isListening ? stopListening : startListening}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`}
                                title={isListening ? "停止录音" : "语音输入"}
                            >
                                <i className="fas fa-microphone"></i>
                            </button>
                        </div>
                        
                        <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-dark disabled:opacity-50" disabled={!userInput.trim() && !selectedImage}><i className="fas fa-arrow-up"></i></button>
                    </form>
                )}
            </div>

            {error && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-11/12 p-2 bg-red-100 text-red-700 rounded-lg text-center shadow-lg z-10">{error}</div>}

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
