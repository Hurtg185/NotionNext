// /components/AiChatAssistant.js - 终极版 v9：修复 Gemini TTS，放弃长按语音，优化 UI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton';

// 简单的 Markdown 解析器 (不再包含 TTS 按钮)
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
                setTimeout(() => ttsButton.click(), 300); // 延迟播放
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
                        <AiTtsButton text={msg.content} apiKey={settings.apiKey} ttsSettings={settings} />
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button>
                    </div>
                )}
            </div>
            {isUser && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
        </div>
    );
};

// 默认提示词
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的、耐心的中文老师...` }, // 省略长文本
    // ... 其他默认提示词
];

// 默认设置
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
    const recognitionRef = useRef(null);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- 初始化和保存设置 ---
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v4'); // 使用新 key
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    useEffect(() => {
        if (isMounted) {
            try {
                localStorage.setItem('ai_assistant_settings_v4', JSON.stringify(settings));
            } catch (e) { console.error("Failed to save settings", e); }
        }
    }, [settings, isMounted]);

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
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = settings.speechLanguage;
        recognitionRef.current.onstart = () => { setIsListening(true); setSpeechRecognitionError(''); };
        recognitionRef.current.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setUserInput(prev => prev + transcript);
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
            if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || '请求失败'); }
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

    if (!isMounted) {
        return (
            <div className="w-full h-[80vh] min-h-[600px] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800" style={{ height: '85vh', minHeight: '650px', maxHeight: '900px' }}>
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">AI 中文老师</h2>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            {/* 聊天消息显示区域 */}
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
                    <div className="flex items-end gap-2">
                        <button onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-image"></i></button>
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

                        <div className="flex-grow relative">
                            <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                            <button
                                type="button"
                                onClick={isListening ? stopListening : startListening}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
                                    isListening ? 'text-red-500' : 'text-gray-500 hover:text-primary'
                                }`}
                                title={isListening ? "停止录音" : "语音输入"}
                            >
                                <i className={`fas ${isListening ? 'fa-microphone-alt-slash' : 'fa-microphone'}`}></i>
                            </button>
                        </div>
                        
                        <button type="submit" onClick={handleSubmit} className="p-3 bg-primary text-white rounded-full hover:bg-blue-dark disabled:opacity-50" disabled={!userInput.trim() && !selectedImage}><i className="fas fa-arrow-up"></i></button>
                    </div>
                )}
            </div>

            {error && <div className="p-2 m-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

// --- SettingsModal 组件 (与之前版本相同) ---
const SettingsModal = ({ settings, onSave, onClose }) => {
    // ...
};

export default AiChatAssistant;
