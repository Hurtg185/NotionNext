// /components/AiChatAssistant.js - v15: 最终完整版
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';

// 定义 TTS 引擎类型
export const TTS_ENGINE = {
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
};

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
            return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
        }
        return <p key={index} className="my-1">{line}</p>;
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
                    <SimpleMarkdown text={msg.content} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-3 mt-2 text-gray-500 dark:text-gray-400">
                        <AiTtsButton text={msg.content} ttsSettings={settings} />
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
    const [systemVoices, setSystemVoices] = useState([]);

    useEffect(() => {
        const fetchSystemVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr')));
            }
        };
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = fetchSystemVoices;
        }
        fetchSystemVoices();
    }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handlePromptChange = (e, promptId, field) => {
        const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: e.target.value } : p);
        handleChange('prompts', newPrompts);
    };
    const handleAddPrompt = () => {
        const newPrompts = [...tempSettings.prompts, { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入内容...' }];
        handleChange('prompts', newPrompts);
    };
    const handleDeletePrompt = (idToDelete) => {
        if (!window.confirm('确定删除此提示词吗？')) return;
        const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete);
        handleChange('prompts', newPrompts);
        if (tempSettings.currentPromptId === idToDelete) {
            handleChange('currentPromptId', newPrompts[0]?.id || '');
        }
    };
    
    const chatModels = [ { name: 'Gemini 2.5 Flash (最快)', value: 'gemini-2.5-flash' }, { name: 'Gemini 2.5 Pro (最强)', value: 'gemini-2.5-pro' } ];
    
    const microsoftTtsVoices = [
        { name: '晓晓 (HD)', value: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural' },
        { name: '晓辰 (HD)', value: 'zh-CN-Xiaochen:DragonHDFlashLatestNeural' },
        { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
        { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
        { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
        { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' },
        { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' },
        { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'},
        { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' },
        { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' },
        { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' },
        { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' },
        { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' },
        { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' },
        { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' },
        { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' },
        { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' },
        { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
        { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
        { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' },
        { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' },
    ];

    const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语', value: 'my-MM' }, ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="用于 AI 聊天功能" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium mb-1">AI 聊天模型</label>
                    <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                        {chatModels.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                    <h4 className="text-lg font-semibold mb-3">朗读设置</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">选择朗读引擎</label>
                            <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                <option value={TTS_ENGINE.THIRD_PARTY}>第三方 API (音质更好)</option>
                                <option value={TTS_ENGINE.SYSTEM}>系统内置 (速度快, 免费)</option>
                            </select>
                        </div>
                        {tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (
                            <div>
                                <label className="block text-sm font-medium mb-1">选择发音人 (第三方)</label>
                                <select value={tempSettings.thirdPartyTtsVoice} onChange={(e) => handleChange('thirdPartyTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                    {microsoftTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}
                                </select>
                            </div>
                        )}
                        {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (
                             <div>
                                <label className="block text-sm font-medium mb-1">选择发音人 (系统)</label>
                                {systemVoices.length > 0 ? (
                                    <select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                        <option value="">浏览器默认</option>
                                        {systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}
                                    </select>
                                ) : (
                                    <p className="text-sm text-gray-500 mt-1">你的浏览器没有可用的内置声音。</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium mb-1">语音识别语言</label>
                     <select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                        {speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label className="block text-sm font-medium">AI 回复后自动朗读</label>
                    <input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" />
                </div>
                <div className="mb-6">
                    <h4 className="text-lg font-bold mb-3">自定义提示词管理</h4>
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                        {tempSettings.prompts.map(p => (
                            <div key={p.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center flex-grow cursor-pointer">
                                        <input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === p.id} onChange={() => handleChange('currentPromptId', p.id)} className="mr-2 text-primary" />
                                        <input type="text" value={p.name} onChange={(e) => handlePromptChange(e, p.id, 'name')} className="font-medium bg-transparent w-full" />
                                    </label>
                                    <button onClick={() => handleDeletePrompt(p.id)} className="p-1 ml-2 text-sm text-red-500 rounded"><i className="fas fa-trash"></i></button>
                                </div>
                                <textarea value={p.content} onChange={(e) => handlePromptChange(e, p.id, 'content')} className="w-full mt-2 h-20 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" />
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
    { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师...' },
    { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师...' },
    { id: 'translate-myanmar', name: '中缅互译', content: '你是一位专业的翻译助手...' }
];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural',
    systemTtsVoiceURI: '',
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
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showPromptSelector, setShowPromptSelector] = useState(false);
    
    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    const promptSelectorRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v15_final');
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('ai_assistant_settings_v15_final', JSON.stringify(settings));
        }
    }, [settings, isMounted]);

    useEffect(() => {
        const body = document.body;
        if (isFullScreen) {
            body.style.overflow = 'hidden';
        } else {
            body.style.overflow = '';
        }
        return () => { body.style.overflow = ''; };
    }, [isFullScreen]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (promptSelectorRef.current && !promptSelectorRef.current.contains(event.target)) {
                setShowPromptSelector(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [promptSelectorRef]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isMounted && messages.length === 0) {
            setMessages([{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }]);
        }
    }, [isMounted]);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        setShowSettings(false);
    }, []);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedImage(reader.result.split(',')[1]);
            setImagePreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSelectPrompt = (promptId) => {
        setSettings(prev => ({ ...prev, currentPromptId: promptId }));
        setShowPromptSelector(false);
    };

    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        if (recognitionRef.current) recognitionRef.current.abort();
        const recognition = new SpeechRecognition();
        recognition.lang = settings.speechLanguage;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (e) => setUserInput(e.results[0][0].transcript.trim());
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        recognitionRef.current = recognition;
    }, [settings.speechLanguage]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) recognitionRef.current.stop();
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
            { role: 'model', parts: [{ text: "好的，我明白了。" }] },
            ...history,
            { role: 'user', parts: userMessageContent }
        ];

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${settings.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents }),
                    signal: abortControllerRef.current.signal,
                }
            );
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `请求失败, 状态码: ${response.status}`);
            }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI 未能返回有效内容。');
            
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(`API 请求失败: ${err.message}`);
                setMessages(prev => [...prev, { role: 'ai', content: `很抱歉，出错了：${err.message}` }]);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStopGenerating = () => abortControllerRef.current?.abort();

    if (!isMounted) return <div className="w-full h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>;
    
    const containerClasses = isFullScreen
        ? 'fixed inset-0 z-50 w-full h-full rounded-none border-none'
        : 'relative w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700';
    const containerStyle = isFullScreen ? {} : { height: '90vh', minHeight: '650px', maxHeight: '900px' };
    const currentPromptName = settings.prompts.find(p => p.id === settings.currentPromptId)?.name || '默认';

    return (
        <div className={`flex flex-col bg-white dark:bg-gray-800 ${containerClasses}`} style={containerStyle}>
            <div className="flex items-center justify-between py-1 px-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold">AI 中文老师 <span className="text-xs text-gray-500 font-normal">({currentPromptName})</span></h2>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title={isFullScreen ? "退出全屏" : "全屏模式"}>
                        <i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i>
                    </button>
                    <button onClick={() => setShowSettings(true)} className="p-2 w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
                </div>
            </div>

            <div className="flex-grow p-4 overflow-y-auto" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover' }}>
                <div className="flex flex-col gap-4 pb-4">
                    {messages.map((msg, index) => <MessageBubble key={index} msg={msg} settings={settings} />)}
                </div>
                <div ref={messagesEndRef} />
            </div>

            <div className="p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t dark:border-gray-700 shrink-0">
                {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm">{error}</div>}
                {imagePreviewUrl && (
                    <div className="relative mb-2 w-24">
                        <img src={imagePreviewUrl} alt="预览" className="rounded-lg" />
                        <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs" title="移除"><i className="fas fa-times"></i></button>
                    </div>
                )}
                
                {isLoading ? (
                    <div className="flex justify-center">
                        <button type="button" onClick={handleStopGenerating} className="w-full px-6 py-3 bg-red-500 text-white font-bold rounded-lg flex items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                            停止生成
                        </button>
                    </div>
                ) : (
                    <div className="relative flex items-end gap-2">
                        <div ref={promptSelectorRef} className="relative">
                            <button type="button" onClick={() => setShowPromptSelector(s => !s)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="切换提示词"><i className="fas fa-magic"></i></button>
                            {showPromptSelector && (
                                <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                    {settings.prompts.map(p => (
                                        <button key={p.id} onClick={() => handleSelectPrompt(p.id)} className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${settings.currentPromptId === p.id ? 'text-primary font-bold' : 'dark:text-gray-200'}`}>
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="上传图片"><i className="fas fa-image"></i></button>
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

                        <div className="flex-grow relative">
                            <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                            <button type="button" onClick={isListening ? stopListening : startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`} title="语音输入">
                                <i className="fas fa-microphone"></i>
                            </button>
                        </div>
                        
                        <button type="submit" onClick={handleSubmit} className="p-3 bg-primary text-white rounded-full hover:bg-blue-dark disabled:opacity-50 shrink-0" disabled={!userInput.trim() && !selectedImage}><i className="fas fa-arrow-up"></i></button>
                    </div>
                )}
            </div>

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
