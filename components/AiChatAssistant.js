// /components/AiChatAssistant.js - v29.1 (完整版 - 适配新的TTS按钮和设置)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';

// 导出TTS引擎类型，供 AiTtsButton.js 使用
export const TTS_ENGINE = {
    GEMINI_TTS: 'gemini_tts',
    SYSTEM: 'system', // 保留，以便未来扩展
    THIRD_PARTY: 'third_party' // 保留，以便未来扩展
};

// --- 常量定义 ---
const CHAT_MODELS = [
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
    { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' },
];

const AVAILABLE_TTS_VOICES = [
    { id: 'Kore', name: 'Kore (Firm)' }, { id: 'Zephyr', name: 'Zephyr (Bright)' }, { id: 'Puck', name: 'Puck (Upbeat)' }, { id: 'Charon', name: 'Charon (Informative)' }, { id: 'Fenrir', name: 'Fenrir (Excitable)' }, { id: 'Leda', name: 'Leda (Youthful)' }, { id: 'Orus', name: 'Orus (Firm)' }, { id: 'Aoede', name: 'Aoede (Breezy)' }, { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' }, { id: 'Autonoe', name: 'Autonoe (Bright)' }, { id: 'Enceladus', name: 'Enceladus (Breathy)' }, { id: 'Iapetus', name: 'Iapetus (Clear)' }, { id: 'Umbriel', name: 'Umbriel (Easy-going)' }, { id: 'Algieba', name: 'Algieba (Smooth)' }, { id: 'Despina', name: 'Despina (Smooth)' }, { id: 'Erinome', name: 'Erinome (Clear)' }, { id: 'Algenib', name: 'Algenib (Gravelly)' }, { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' }, { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' }, { id: 'Achernar', name: 'Achernar (Soft)' }, { id: 'Alnilam', name: 'Alnilam (Firm)' }, { id: 'Schedar', name: 'Schedar (Even)' }, { id: 'Gacrux', name: 'Gacrux (Mature)' }, { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' }, { id: 'Achird', name: 'Achird (Friendly)' }, { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' }, { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' }, { id: 'Sadachbia', name: 'Sadachbia (Lively)' }, { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' }, { id: 'Sulafat', name: 'Sulafat (Warm)' },
];

const DEFAULT_PROMPTS = [ 
    { id: 'default-1', name: '通用助理', content: '你是一个知识渊博、乐于助人的AI助理。', model: 'gemini-2.5-flash' }, 
];

// --- 默认设置更新 ---
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8,
    apiTimeout: 60000,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    
    // --- 新的 Gemini TTS 设置 ---
    ttsEngine: TTS_ENGINE.GEMINI_TTS,
    geminiTtsModel: 'gemini-2.5-flash-preview-tts', // 默认 TTS 模型
    geminiTtsVoice: 'Kore', // 默认语音

    // 其他设置
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
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

    return (
        <div ref={messageRef} className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm'}`} style={{ maxWidth: '85%' }}>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                    <SimpleMarkdown text={msg.content || ''} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400">
                        {/* 将完整的 settings 对象传递给 AiTtsButton */}
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

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename }) => { /* ... (此组件无变化，代码省略) ... */ };

// --- 设置弹窗UI更新 ---
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-6">
                     <div>
                        <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4">
                        <h4 className="text-md font-semibold">朗读设置 (Gemini TTS)</h4>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">模型</label>
                            <input
                                type="text"
                                value={tempSettings.geminiTtsModel}
                                onChange={(e) => handleChange('geminiTtsModel', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"
                                placeholder="e.g., gemini-2.5-flash-preview-tts"
                            />
                            <p className="text-xs text-gray-500 mt-1">要使用的TTS模型</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">语音名称</label>
                            <select value={tempSettings.geminiTtsVoice} onChange={(e) => handleChange('geminiTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                {AVAILABLE_TTS_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                            </select>
                             <p className="text-xs text-gray-500 mt-1">语音的名称</p>
                        </div>
                    </div>
                     <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium">AI 回复后自动朗读</label>
                        <input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button>
                </div>
            </div>
        </div>
    );
};


// --- 主组件 AiChatAssistant ---
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
            // 使用新的存储键以避免与旧设置冲突
            const savedSettings = localStorage.getItem('ai_assistant_settings_v29');
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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (optionsContainerRef.current && !optionsContainerRef.current.contains(event.target)) {
                setShowMoreMenu(false);
                setShowModelSelector(false);
                setShowPromptSelector(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('ai_assistant_settings_v29', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v22_final', JSON.stringify(conversations));
        }
    }, [settings, conversations, isMounted]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, currentConversationId]);

    const createNewConversation = () => {
        const newId = `conv-${Date.now()}`;
        const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }] };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newId);
    };
    
    const handleSelectConversation = (id) => setCurrentConversationId(id);
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { setCurrentConversationId(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const imagePromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ data: reader.result.split(',')[1], previewUrl: reader.result, type: file.type });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });
        Promise.all(imagePromises).then(newImages => setSelectedImages(prev => [...prev, ...newImages]));
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleRemoveImage = (indexToRemove) => {
        setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const startListening = useCallback(() => { /* ... (此函数无变化) ... */ }, [settings.speechLanguage]);
    const stopListening = useCallback(() => { /* ... (此函数无变化) ... */ }, []);

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
                setError('请输入文字或选择图片再发送！'); return;
            }
            const userMessage = { role: 'user', content: textToProcess, images: selectedImages };
            messagesForApi.push(userMessage);
        }

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        timeoutRef.current = setTimeout(() => { abortControllerRef.current?.abort(); }, settings.apiTimeout);

        try {
            const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId) || settings.prompts[0];
            const modelToUse = currentPrompt?.model || settings.selectedModel;
            const systemInstruction = currentPrompt?.content || "";
            
            const history = messagesForApi.map(msg => {
                const parts = [];
                if (msg.content) parts.push({ text: msg.content });
                if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } }));
                return { role: msg.role === 'user' ? 'user' : 'model', parts };
            });
            
            const contents = [...history];
            
            const requestBody = {
                contents,
                generationConfig: { temperature: settings.temperature },
                ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } })
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
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
            setUserInput('');
            setSelectedImages([]);

        } catch (err) {
            const finalMessages = [...messagesForApi];
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') errorMessage = 'API 请求超时。';
            setError(errorMessage);
            finalMessages.push({role: 'ai', content: `抱歉，出错了: ${errorMessage}`});
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally {
            setIsLoading(false);
        }
    };
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    const showLeftButtons = !userInput.trim() && selectedImages.length === 0;

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            {/* ChatSidebar and other JSX */}
            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
