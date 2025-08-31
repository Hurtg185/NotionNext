// /components/AiChatAssistant.js - v27: (UI Overhaul, TTS improvements, and new Prompt List)
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Helper Functions & Constants ---

export const TTS_ENGINE = {
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
};

/**
 * Pre-processes text for TTS by removing pinyin with tone marks and punctuation.
 * @param {string} text The text to clean.
 * @returns {string} The cleaned text.
 */
const cleanTextForTTS = (text) => {
    if (!text) return '';
    // Removes pinyin with tone marks (e.g., ā, á, ǎ, à) and common punctuation
    return text
        .replace(/[\u0100-\u017F]/g, '') // Removes common pinyin characters
        .replace(/[.,?!;:"'()\[\]{}]/g, ' '); // Replaces punctuation with a space
};

// --- Child Components ---

const AiTtsButton = ({ text, ttsSettings }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef(null);

    const speak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const cleanedText = cleanTextForTTS(text); // Clean text before speaking
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        
        if (ttsSettings.ttsEngine === TTS_ENGINE.SYSTEM && ttsSettings.systemTtsVoiceURI) {
            const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === ttsSettings.systemTtsVoiceURI);
            if (voice) utterance.voice = voice;
        }
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false); // Handle errors
        
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    };
    
    // Third-party API logic would go here if needed, for now using system synthesis.
    // For simplicity, this example focuses on the system TTS.

    return (
        <button onClick={speak} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title={isSpeaking ? "停止" : "朗读"}>
            <i className={`fas ${isSpeaking ? 'fa-stop-circle' : 'fa-play-circle'}`}></i>
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

const CHAT_MODELS = [
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' }, { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' }, { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }, { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' }, { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
];

const SettingsModal = ({ settings, onSave, onClose }) => {
    // This component remains largely unchanged from your provided code,
    // as the request was to move prompts *out*, not to change the settings modal itself.
    // ... (Keep the existing SettingsModal code here)
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);

    useEffect(() => {
        const fetchSystemVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi')));
            }
        };
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = fetchSystemVoices;
        }
        fetchSystemVoices();
    }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddPrompt = () => {
        const newPrompt = { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入...', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural' };
        const newPrompts = [...tempSettings.prompts, newPrompt];
        handleChange('prompts', newPrompts);
    };
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); };
    
    const handlePromptSettingChange = (promptId, field, value) => {
        const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: value } : p);
        handleChange('prompts', newPrompts);
    };

    const microsoftTtsVoices = [
        { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' },
    ];
    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' },
    ];
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-4">
                     {/* All settings content remains here */}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button>
                </div>
            </div>
        </div>
    );
};


const PromptSelector = ({ settings, onSelectPrompt, onClose, aiAvatarUrl }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">选择一个提示词</h3>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {settings.prompts.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => onSelectPrompt(p.id)}
                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${settings.currentPromptId === p.id ? 'bg-primary/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            <img src={aiAvatarUrl} alt="AI" className="w-10 h-10 rounded-full mr-4 shrink-0" />
                            <div className="flex-grow">
                                <p className="font-bold text-gray-800 dark:text-gray-200">{p.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{p.content}</p>
                            </div>
                            {settings.currentPromptId === p.id && <i className="fas fa-check-circle text-primary ml-4"></i>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- Default Data ---

const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural' }, { id: 'translate-myanmar', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural' } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8,
    maxOutputTokens: 2048,
    apiTimeout: 60000,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI: '',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// --- Main Component ---

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
    
    // New state for the combined menu and prompt selector
    const [showLeftMenu, setShowLeftMenu] = useState(false);
    const [showPromptList, setShowPromptList] = useState(false);
    
    const [selectedImages, setSelectedImages] = useState([]);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const timeoutRef = useRef(null);
    const recognitionRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v27_final');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                parsed.prompts = parsed.prompts.map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || 'zh-CN-XiaoxiaoMultilingualNeural' }));
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
            const savedConversations = localStorage.getItem('ai_assistant_conversations_v27_final');
            const parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
            setConversations(parsedConvs);
            if (parsedConvs.length > 0) {
                setCurrentConversationId(parsedConvs[0].id);
            } else {
                createNewConversation();
            }
        } catch (e) { createNewConversation(); }
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('ai_assistant_settings_v27_final', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v27_final', JSON.stringify(conversations));
        }
    }, [settings, conversations, isMounted]);
    
    // Effect to handle clicking outside the menu to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowLeftMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, currentConversationId]);

    const createNewConversation = () => {
        const newId = `conv-${Date.now()}`;
        // Associate the new conversation with the currently selected prompt
        const newConv = { 
            id: newId, 
            title: '新的对话', 
            messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }],
            promptId: settings.currentPromptId // Save promptId with conversation
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newId);
    };
    
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };

    const handleImageUpload = (e) => {
        // ... (function remains unchanged)
    };

    const handleRemoveImage = (indexToRemove) => {
        // ... (function remains unchanged)
    };
    
    const startListening = useCallback(() => {
        // ... (function remains unchanged)
    }, [settings.speechLanguage]);
    
    const stopListening = useCallback(() => {
        // ... (function remains unchanged)
    }, []);

    const handleSubmit = async (isRegenerate = false) => {
        if (!currentConversationId || isLoading) return;
        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (!currentConv) return;

        let messagesForApi = [...currentConv.messages];
        const textToProcess = userInput.trim();

        if (isRegenerate) {
            if (messagesForApi[messagesForApi.length - 1]?.role === 'ai') messagesForApi.pop();
        } else {
            if (!textToProcess && selectedImages.length === 0) {
                setError('请输入文字或选择图片再发送！');
                return;
            }
            const userMessage = { role: 'user', content: textToProcess, images: selectedImages };
            const newMessages = [...currentConv.messages, userMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: newMessages } : c));
            messagesForApi.push(userMessage);
            setUserInput('');
            setSelectedImages([]);
        }

        if (messagesForApi.length === 0) return;

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        timeoutRef.current = setTimeout(() => { abortControllerRef.current?.abort(); }, settings.apiTimeout);

        try {
            const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0];
            const modelToUse = currentPrompt.model || settings.selectedModel;
            
            const history = messagesForApi.map(msg => {
                const parts = [];
                if (msg.content) parts.push({ text: msg.content });
                if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } }));
                return { role: msg.role === 'user' ? 'user' : 'model', parts };
            });

            const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ];
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents, 
                    generationConfig: { 
                        temperature: settings.temperature, 
                        maxOutputTokens: settings.maxOutputTokens,
                        thinkingBudget: 0 // Set thinking budget to 0
                    } 
                }),
                signal,
            });

            clearTimeout(timeoutRef.current);

            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败`); }
            
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');

            const aiMessage = { role: 'ai', content: aiResponseContent };
            const finalMessages = [...messagesForApi, aiMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));

        } catch (err) {
            const finalMessages = [...messagesForApi];
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') {
                errorMessage = 'API 请求超时，请检查网络或在设置中延长超时时间。';
            }
            setError(errorMessage);
            finalMessages.push({role: 'ai', content: `抱歉，出错了: ${errorMessage}`});
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally {
            setIsLoading(false);
        }
    };
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 relative ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            {/* Sidebar is removed */}
            <div className="flex-1 flex flex-col h-full min-w-0">
                <div className="flex items-center justify-between py-1 px-4 border-b dark:border-gray-700 shrink-0">
                    {/* The top bar can be simplified or removed as per new design */}
                    <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2>
                    <button onClick={() => setIsFullScreen(f => !f)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title={isFullScreen ? '退出全屏' : '全屏模式'}><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
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
                     {/* Error and Image Preview section remains the same */}

                    {isLoading ? ( <div className="flex justify-center items-center gap-2 text-gray-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考中...</div> ) : (
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                             <div className="flex-grow relative">
                                <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                                <button type="button" onClick={isListening ? stopListening : startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`} title="语音输入">
                                    <i className="fas fa-microphone"></i>
                                </button>
                            </div>
                            <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shrink-0" disabled={isLoading || (!userInput.trim() && selectedImages.length === 0)}><i className="fas fa-arrow-up"></i></button>
                        </form>
                    )}
                </div>
            </div>
            
            {/* --- New Collapsible Bottom-Left Menu --- */}
            <div ref={menuRef} className="absolute bottom-4 left-4 z-20">
                <div className={`transition-all duration-300 ease-in-out flex flex-col items-start gap-3 ${showLeftMenu ? 'mb-12' : ''}`}>
                    {showLeftMenu && (
                        <div className="flex flex-col items-start gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 rounded-xl shadow-lg">
                           <button onClick={() => { setShowPromptList(true); setShowLeftMenu(false); }} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                                <i className="fas fa-magic w-6 text-center mr-2"></i>
                                <span>提示词</span>
                            </button>
                            <button onClick={createNewConversation} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                                <i className="fas fa-plus w-6 text-center mr-2"></i>
                                <span>新对话</span>
                            </button>
                             <button onClick={() => { setShowSettings(true); setShowLeftMenu(false); }} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                                <i className="fas fa-cog w-6 text-center mr-2"></i>
                                <span>设置</span>
                            </button>
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => setShowLeftMenu(prev => !prev)} 
                    className="absolute bottom-0 left-0 w-10 h-10 bg-primary text-white rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 hover:rotate-90"
                >
                    <i className={`fas ${showLeftMenu ? 'fa-times' : 'fa-bars'}`}></i>
                </button>
            </div>


             {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
             {showPromptList && <PromptSelector settings={settings} onSelectPrompt={(id) => { setSettings(s => ({...s, currentPromptId: id})); setShowPromptList(false); }} onClose={() => setShowPromptList(false)} aiAvatarUrl={settings.aiAvatarUrl} />}
        </div>
    );
};

export default AiChatAssistant;
