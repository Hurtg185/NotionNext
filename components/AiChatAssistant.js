// /components/AiChatAssistant.js - v31 (在 v26 基础上新增 Gemini TTS 和 持续语音识别)
import React, { useState, useEffect, useRef, useCallback } from 'react';
// import AiTtsButton from './AiTtsButton'; // 我们将在本文件内重新定义它

// --- 关键修改 1：新增 Gemini TTS 引擎类型 ---
export const TTS_ENGINE = {
    GEMINI_TTS: 'gemini_tts', // 新增
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
};

// --- 关键修改 2：重新定义 AiTtsButton，使其支持三种引擎 ---
const AiTtsButton = ({ text, ttsSettings = {} }) => {
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef(null);

    // 组件卸载时停止播放
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const synthesizeSpeech = useCallback(async (textToSpeak) => {
        const cleanedText = textToSpeak.replace(/\*\*/g, ''); // 简单清理
        if (!cleanedText) return;

        setIsLoading(true);

        // 确保停止之前的任何播放
        if (audioRef.current) audioRef.current.pause();
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        try {
            switch (ttsSettings.ttsEngine) {
                // --- 新增 Gemini TTS 的逻辑 ---
                case TTS_ENGINE.GEMINI_TTS:
                    if (!ttsSettings.apiKey) throw new Error("API Key 为空！");
                    
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ttsSettings.geminiTtsModel}:generateContent?key=${ttsSettings.apiKey}`;
                    const body = {
                        contents: [{ parts: [{ text: cleanedText }] }],
                        generationConfig: {
                            ttsVoice: ttsSettings.geminiTtsVoice,
                            responseMimeType: 'audio/mpeg'
                        }
                    };
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error?.message || `Gemini TTS API 错误`);
                    }

                    const data = await response.json();
                    const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                    if (!audioContent) throw new Error('Gemini TTS 未能返回音频内容。');
                    
                    const audio = new Audio("data:audio/mp3;base64," + audioContent);
                    audioRef.current = audio;
                    audio.onended = () => setIsLoading(false);
                    audio.onerror = () => { console.error('音频播放错误'); setIsLoading(false); };
                    await audio.play();
                    break;

                // --- 保留原有的 SYSTEM 逻辑 ---
                case TTS_ENGINE.SYSTEM:
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(cleanedText);
                        if (ttsSettings.systemTtsVoiceURI) {
                            const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === ttsSettings.systemTtsVoiceURI);
                            if (selectedVoice) utterance.voice = selectedVoice;
                        }
                        utterance.onend = () => setIsLoading(false);
                        utterance.onerror = (e) => { console.error('系统TTS错误:', e); setIsLoading(false); };
                        window.speechSynthesis.speak(utterance);
                    } else {
                        throw new Error("浏览器不支持系统TTS。");
                    }
                    break;

                // --- 保留原有的 THIRD_PARTY 逻辑 ---
                case TTS_ENGINE.THIRD_PARTY:
                default:
                    // 这是一个示例URL，请根据您的实际情况修改
                    const thirdPartyUrl = `https://your-third-party-tts-api.com?text=${encodeURIComponent(cleanedText)}&voice=${ttsSettings.thirdPartyTtsVoice}`;
                    const thirdPartyResponse = await fetch(thirdPartyUrl);
                    if (!thirdPartyResponse.ok) throw new Error(`第三方API错误`);
                    
                    const audioBlob = await thirdPartyResponse.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const thirdPartyAudio = new Audio(audioUrl);
                    audioRef.current = thirdPartyAudio;
                    thirdPartyAudio.onended = () => { setIsLoading(false); URL.revokeObjectURL(audioUrl); };
                    thirdPartyAudio.onerror = () => { console.error('第三方音频播放错误'); setIsLoading(false); };
                    await thirdPartyAudio.play();
                    break;
            }
        } catch (err) {
            console.error('朗读失败:', err);
            setIsLoading(false);
        }
    }, [ttsSettings]);

    return (
        <button
            onClick={(e) => { e.stopPropagation(); synthesizeSpeech(text); }}
            disabled={isLoading}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            title="朗读"
        >
            <i className={`fas fa-volume-up ${isLoading ? 'animate-pulse text-primary' : ''}`}></i>
        </button>
    );
};


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

const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);
    const hasBeenReadRef = useRef(false);

    useEffect(() => {
        if (isLastAiMessage && !isUser && msg.content && settings.autoRead && !hasBeenReadRef.current) {
            const ttsButton = messageRef.current?.querySelector('button[title="朗读"]');
            if (ttsButton) {
                setTimeout(() => {
                    ttsButton.click();
                    hasBeenReadRef.current = true;
                }, 300);
            }
        }
    }, [isUser, msg.content, settings.autoRead, isLastAiMessage]);

    return (
        <div ref={messageRef} className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm'}`} style={{ maxWidth: '85%' }}>
                {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)}
                    </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                    <SimpleMarkdown text={msg.content || ''} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400">
                        <AiTtsButton text={msg.content} ttsSettings={settings} />
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button>
                        {isLastAiMessage && (
                           <button onClick={onRegenerate} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button>
                        )}
                    </div>
                )}
            </div>
            {isUser && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
        </div>
    );
};

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename }) => { /* ... 此组件无变化 ... */ };

const CHAT_MODELS = [
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' }, { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' }, { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }, { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' }, { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
];

const AVAILABLE_TTS_VOICES = [
    { id: 'Kore', name: 'Kore (Firm)' }, { id: 'Zephyr', name: 'Zephyr (Bright)' }, { id: 'Puck', name: 'Puck (Upbeat)' }, { id: 'Charon', name: 'Charon (Informative)' }, { id: 'Fenrir', name: 'Fenrir (Excitable)' }, { id: 'Leda', name: 'Leda (Youthful)' }, { id: 'Orus', name: 'Orus (Firm)' }
];

const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);

    useEffect(() => {
        const fetchSystemVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en')));
            }
        };
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = fetchSystemVoices;
        }
        fetchSystemVoices();
    }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddPrompt = () => { /* ... 此函数无变化 ... */ };
    const handleDeletePrompt = (idToDelete) => { /* ... 此函数无变化 ... */ };
    const handlePromptSettingChange = (promptId, field, value) => { /* ... 此函数无变化 ... */ };

    const microsoftTtsVoices = [ /* ... 此数组无变化 ... */ ];
    const speechLanguageOptions = [ /* ... 此数组无变化 ... */ ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                    </div>
                     <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-2"> {/* ... 高级参数部分无变化 ... */} </div>
                    
                    {/* --- 关键修改 3：更新朗读设置UI --- */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4">
                        <h4 className="text-md font-semibold">朗读设置</h4>
                        <div>
                            <label className="block text-sm font-medium mb-1">朗读引擎</label>
                            <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                <option value={TTS_ENGINE.GEMINI_TTS}>Gemini TTS (推荐)</option>
                                <option value={TTS_ENGINE.THIRD_PARTY}>第三方 API</option>
                                <option value={TTS_ENGINE.SYSTEM}>系统内置</option>
                            </select>
                        </div>

                        {tempSettings.ttsEngine === TTS_ENGINE.GEMINI_TTS && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Gemini TTS 模型</label>
                                    <input type="text" value={tempSettings.geminiTtsModel} onChange={(e) => handleChange('geminiTtsModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Gemini TTS 语音</label>
                                    <select value={tempSettings.geminiTtsVoice} onChange={(e) => handleChange('geminiTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                        {AVAILABLE_TTS_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                        {tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && ( /* ... 此部分无变化 ... */ )}
                        {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && ( /* ... 此部分无变化 ... */ )}
                    </div>
                     <div> {/* ... 语音识别语言部分无变化 ... */} </div>
                     <div className="flex items-center justify-between"> {/* ... 自动朗读部分无变化 ... */} </div>
                     <div className="mb-6"> {/* ... 自定义提示词部分无变化 ... */} </div>
                </div>
                <div className="flex justify-end gap-3 mt-6"> {/* ... 按钮部分无变化 ... */} </div>
            </div>
        </div>
    );
};

// --- 关键修改 4：更新默认设置 ---
const DEFAULT_PROMPTS = [ { id: 'default-1', name: '通用助理', content: '你是一个乐于助人的AI。', model: 'gemini-2.5-flash' } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8,
    maxOutputTokens: 2048,
    apiTimeout: 60000,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    
    // TTS 设置
    ttsEngine: TTS_ENGINE.GEMINI_TTS, // 默认使用 Gemini
    geminiTtsModel: 'gemini-2.5-flash-preview-tts', // Gemini TTS 模型
    geminiTtsVoice: 'Kore', // Gemini TTS 语音
    thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', // 保留旧的设置
    systemTtsVoiceURI: '', // 保留旧的设置

    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};


const AiChatAssistant = () => {
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showPromptSelector, setShowPromptSelector] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const optionsContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const timeoutRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v31'); // 使用新键
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
            const savedConversations = localStorage.getItem('ai_assistant_conversations_v22_final');
            const parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
            setConversations(parsedConvs);
            if (parsedConvs.length > 0) {
                setCurrentConversationId(parsedConvs[0].id);
            } else {
                createNewConversation();
            }
        } catch (e) { createNewConversation(); }
    }, []);

    useEffect(() => { /* ... 点击外部关闭菜单的 useEffect 无变化 ... */ }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('ai_assistant_settings_v31', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v22_final', JSON.stringify(conversations));
        }
    }, [settings, conversations, isMounted]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversations, currentConversationId]);

    const createNewConversation = () => { /* ... 此函数无变化 ... */ };
    const handleSelectConversation = (id) => setCurrentConversationId(id);
    const handleDeleteConversation = (id) => { /* ... 此函数无变化 ... */ };
    const handleRenameConversation = (id, newTitle) => { /* ... 此函数无变化 ... */ };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleImageUpload = (e) => { /* ... 此函数无变化 ... */ };
    const handleRemoveImage = (indexToRemove) => { /* ... 此函数无变化 ... */ };

    // --- 关键修改 5：更新语音识别逻辑 ---
    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; }

        if (recognitionRef.current) { recognitionRef.current.stop(); }

        const recognition = new SpeechRecognition();
        recognition.lang = settings.speechLanguage;
        recognition.continuous = true; // 开启持续识别
        recognition.interimResults = true; // 开启实时结果

        recognition.onstart = () => {
            setIsListening(true);
            setUserInput('');
        };
        
        let finalTranscript = '';
        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setUserInput(finalTranscript + interimTranscript);
        };

        recognition.onerror = (event) => {
            console.error("语音识别错误:", event.error);
            setIsListening(false);
        };
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.start();
        recognitionRef.current = recognition;
    }, [settings.speechLanguage]);
    
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, []);

    const handleSubmit = async (isRegenerate = false) => { /* ... 此函数无变化 ... */ };
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    const showLeftButtons = !userInput.trim() && selectedImages.length === 0;

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onNew={createNewConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation}/>
            <div className="flex-1 flex flex-col h-full min-w-0">
                <div className="flex items-center justify-between py-1 px-2 border-b dark:border-gray-700 shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="切换侧边栏"><i className="fas fa-bars"></i></button>
                        <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2>
                    </div>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
                </div>
                <div className="flex-grow p-4 overflow-y-auto" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`}}>
                    <div className="space-y-1">
                        {currentConversation?.messages.map((msg, index) => (
                            <MessageBubble key={`${currentConversationId}-${index}`} msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} />
                        ))}
                    </div>
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t dark:border-gray-700 shrink-0">
                    {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm" onClick={()=>setError('')}>{error} <span className='text-xs'>(点击关闭)</span></div>}
                    
                    {selectedImages.length > 0 && ( /* ... 图片预览JSX无变化 ... */ )}

                    {isLoading ? ( <div className="flex justify-center items-center gap-2 text-gray-500">...</div> ) : (
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                             {showLeftButtons && ( /* ... 左侧菜单JSX无变化 ... */ )}
                            
                            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" multiple />
                            <input type="file" ref={cameraInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" capture="environment" />

                            <div className="flex-grow relative">
                                <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                                <button type="button" onClick={isListening ? stopListening : startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`} title={isListening ? '停止录音' : '开始录音'}>
                                    <i className="fas fa-microphone"></i>
                                </button>
                            </div>
                            <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shrink-0" disabled={isLoading || (!userInput.trim() && selectedImages.length === 0)}><i className="fas fa-arrow-up"></i></button>
                            <button type="button" onClick={() => setIsFullScreen(f => !f)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title={isFullScreen ? '退出全屏' : '全屏模式'}><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
                        </form>
                    )}
                </div>
            </div>
             {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
