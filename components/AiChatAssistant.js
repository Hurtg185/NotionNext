// /components/AiChatAssistant.js - v27: (集成Gemini TTS, 重构设置UI)
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- 新增：Gemini 模型和语音常量 ---
const CHAT_MODELS = [
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
    { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' },
];

const AVAILABLE_TRANSCRIPTION_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Higher Quality)' },
];

const AVAILABLE_TTS_VOICES = [
    { id: 'Zephyr', name: 'Zephyr (Bright)' }, { id: 'Puck', name: 'Puck (Upbeat)' }, { id: 'Charon', name: 'Charon (Informative)' }, { id: 'Kore', name: 'Kore (Firm)' }, { id: 'Fenrir', name: 'Fenrir (Excitable)' }, { id: 'Leda', name: 'Leda (Youthful)' }, { id: 'Orus', name: 'Orus (Firm)' }, { id: 'Aoede', name: 'Aoede (Breezy)' }, { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' }, { id: 'Autonoe', name: 'Autonoe (Bright)' }, { id: 'Enceladus', name: 'Enceladus (Breathy)' }, { id: 'Iapetus', name: 'Iapetus (Clear)' }, { id: 'Umbriel', name: 'Umbriel (Easy-going)' }, { id: 'Algieba', name: 'Algieba (Smooth)' }, { id: 'Despina', name: 'Despina (Smooth)' }, { id: 'Erinome', name: 'Erinome (Clear)' }, { id: 'Algenib', name: 'Algenib (Gravelly)' }, { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' }, { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' }, { id: 'Achernar', name: 'Achernar (Soft)' }, { id: 'Alnilam', name: 'Alnilam (Firm)' }, { id: 'Schedar', name: 'Schedar (Even)' }, { id: 'Gacrux', name: 'Gacrux (Mature)' }, { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' }, { id: 'Achird', name: 'Achird (Friendly)' }, { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' }, { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' }, { id: 'Sadachbia', name: 'Sadachbia (Lively)' }, { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' }, { id: 'Sulafat', name: 'Sulafat (Warm)' },
];


// --- 重构：使用Gemini TTS的朗读按钮 ---
const AiTtsButton = ({ text, apiKey, voice }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState('');
    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);

    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPlaying(false);
        setIsLoading(false);
    }, []);

    const handlePlay = async () => {
        if (isPlaying || isLoading) {
            stopPlayback();
            return;
        }

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-to-speech:synthesizeSpeech?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice: voice,
                    audio_config: { audio_encoding: "MP3" }
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "获取音频失败");
            }
            
            const data = await response.json();
            const audioContent = data.audioContent;
            
            const audio = new Audio("data:audio/mp3;base64," + audioContent);
            audioRef.current = audio;

            audio.oncanplaythrough = () => {
                if (!abortControllerRef.current?.signal.aborted) {
                    setIsLoading(false);
                    setIsPlaying(true);
                    audio.play();
                }
            };
            audio.onended = () => stopPlayback();
            audio.onerror = () => { setError("音频播放错误"); stopPlayback(); };

        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message);
                console.error("TTS Error:", err);
            }
            stopPlayback();
        }
    };

    useEffect(() => {
        return () => stopPlayback(); // 组件卸载时停止播放和请求
    }, [stopPlayback]);

    let iconClass = "fa-play";
    if (isLoading) iconClass = "fa-spinner fa-spin";
    else if (isPlaying) iconClass = "fa-stop";
    
    return (
        <button onClick={handlePlay} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="朗读">
            <i className={`fas ${iconClass}`}></i>
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
    
    // 获取当前对话关联的TTS语音
    const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId);
    const ttsVoiceToUse = currentPrompt?.ttsVoice || settings.selectedTtsVoice;

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
                        <AiTtsButton text={msg.content} apiKey={settings.apiKey} voice={ttsVoiceToUse} />
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

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };

    return (
        <div className={`h-full bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-48 p-2' : 'w-0 p-0'} overflow-hidden`}>
            <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                <span>新对话</span><i className="fas fa-plus"></i>
            </button>
            <div className="flex-grow overflow-y-auto">
                {conversations.map(conv => (
                    <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => onSelect(conv.id)}>
                        <div className="flex-grow truncate" onDoubleClick={() => handleRename(conv.id, conv.title)}>
                            {editingId === conv.id ? (
                                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus />
                            ) : ( <span className="text-sm">{conv.title}</span> )}
                        </div>
                        <div className="hidden group-hover:flex items-center shrink-0">
                           <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-1 hover:text-primary"><i className="fas fa-pen text-xs"></i></button>
                           <button onClick={(e) => { e.stopPropagation(); if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-1 hover:text-red-500"><i className="fas fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 重构：设置弹窗UI ---
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddPrompt = () => {
        const newPrompt = { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入...', model: settings.selectedModel, ttsVoice: settings.selectedTtsVoice };
        const newPrompts = [...tempSettings.prompts, newPrompt];
        handleChange('prompts', newPrompts);
    };
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); };
    
    const handlePromptSettingChange = (promptId, field, value) => {
        const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: value } : p);
        handleChange('prompts', newPrompts);
    };
    
    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' }, { name: 'English (US)', value: 'en-US' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-6">
                     <div>
                        <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold">模型参数 (用于新对话)</h4>
                        <div>
                            <label className="block text-sm font-medium mb-1">默认 AI 模型 (用于新对话)</label>
                            <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                {CHAT_MODELS.map(model => <option key={model.value} value={model.value}>{model.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">语音输入模型</label>
                            <select value={tempSettings.selectedTranscriptionModel} onChange={(e) => handleChange('selectedTranscriptionModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                {AVAILABLE_TRANSCRIPTION_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">TTS 语音</label>
                            <select value={tempSettings.selectedTtsVoice} onChange={(e) => handleChange('selectedTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                {AVAILABLE_TTS_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                            </select>
                        </div>
                    </div>

                     <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-2">
                         <label className="block text-sm font-medium">高级参数</label>
                         <div className="flex items-center gap-4">
                             <label className="text-sm shrink-0">温度: {Number(tempSettings.temperature).toFixed(2)}</label>
                             <input type="range" min="0" max="1" step="0.05" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/>
                         </div>
                     </div>
                     
                     <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium">AI 回复后自动朗读</label>
                        <input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" />
                    </div>

                     <div className="mb-6">
                        <h4 className="text-lg font-bold mb-3">自定义提示词管理</h4>
                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                            {tempSettings.prompts.map(p => (
                                <div key={p.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center flex-grow cursor-pointer"><input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === p.id} onChange={() => handleChange('currentPromptId', p.id)} className="mr-2 text-primary" /><input type="text" value={p.name} onChange={(e) => handlePromptSettingChange(p.id, 'name', e.target.value)} className="font-medium bg-transparent w-full" /></label>
                                        <button onClick={() => handleDeletePrompt(p.id)} className="p-1 ml-2 text-sm text-red-500 rounded"><i className="fas fa-trash"></i></button>
                                    </div>
                                    <textarea value={p.content} onChange={(e) => handlePromptSettingChange(p.id, 'content', e.target.value)} className="w-full mt-2 h-20 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" />
                                    <div className="mt-2 space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <label className="shrink-0">模型:</label>
                                            <select value={p.model || settings.selectedModel} onChange={(e) => handlePromptSettingChange(p.id, 'model', e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                                {CHAT_MODELS.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="shrink-0">声音:</label>
                                            <select value={p.ttsVoice || settings.selectedTtsVoice} onChange={(e) => handlePromptSettingChange(p.id, 'ttsVoice', e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                                {AVAILABLE_TTS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddPrompt} className="w-full py-2 bg-green-500 text-white rounded-md"><i className="fas fa-plus mr-2"></i>添加新提示词</button>
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

// --- 更新：默认设置和提示词 ---
const DEFAULT_PROMPTS = [ 
    { id: 'default-1', name: '通用助理', content: '你是一个知识渊博、乐于助人的AI助理。', model: 'gemini-2.5-flash', ttsVoice: 'Zephyr' }, 
    { id: 'default-2', name: '翻译专家', content: '你是一位专业的翻译助手，请将我发送的内容在中文和英文之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'Charon' },
];

const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    selectedTranscriptionModel: 'gemini-2.5-flash',
    selectedTtsVoice: 'Zephyr',
    temperature: 0.8,
    maxOutputTokens: 2048,
    apiTimeout: 60000,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
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
            // 使用新的存储键以避免与旧设置冲突
            const savedSettings = localStorage.getItem('ai_assistant_settings_v27_gemini_tts');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // 确保旧的自定义提示词也能获得新的 ttsVoice 字段
                parsed.prompts = parsed.prompts?.map(p => ({ ...p, ttsVoice: p.ttsVoice || DEFAULT_SETTINGS.selectedTtsVoice })) || DEFAULT_PROMPTS;
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
            localStorage.setItem('ai_assistant_settings_v27_gemini_tts', JSON.stringify(settings));
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

    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; }
        if (recognitionRef.current) recognitionRef.current.abort();

        const recognition = new SpeechRecognition();
        recognition.lang = settings.speechLanguage;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript.trim();
            setUserInput(transcript);
        };
        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setError(`语音识别失败: ${event.error}`);
            setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
        recognitionRef.current = recognition;
    }, [settings.speechLanguage]);
    
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
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
            const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId) || settings.prompts[0];
            const modelToUse = currentPrompt?.model || settings.selectedModel;
            const systemInstruction = currentPrompt?.content || "";
            
            // 构造 history，移除AI的系统提示词确认消息
            const history = messagesForApi.map(msg => {
                const parts = [];
                if (msg.content) parts.push({ text: msg.content });
                if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } }));
                return { role: msg.role === 'user' ? 'user' : 'model', parts };
            });
            
            const contents = [...history];
            
            const requestBody = {
                contents,
                generationConfig: { 
                    temperature: settings.temperature, 
                    maxOutputTokens: settings.maxOutputTokens 
                },
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

        } catch (err) {
            const finalMessages = [...messagesForApi];
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') {
                errorMessage = 'API 请求超时，请检查网络或在设置中延长“思考预算”。';
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
                    
                    {selectedImages.length > 0 && (
                        <div className="mb-2 flex gap-2 overflow-x-auto p-1">
                            {selectedImages.map((image, index) => (
                                <div key={index} className="relative w-24 h-24 object-cover rounded-lg shrink-0">
                                    <img src={image.previewUrl} alt={`预览 ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                                    <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs" title="移除"><i className="fas fa-times"></i></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {isLoading ? ( <div className="flex justify-center items-center gap-2 text-gray-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考中...</div> ) : (
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                             {showLeftButtons && (
                                <div ref={optionsContainerRef} className="relative">
                                    <button type="button" onClick={() => setShowMoreMenu(s => !s)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="更多选项">
                                        <i className="fas fa-plus-circle text-lg text-primary"></i>
                                    </button>
                                    {showMoreMenu && (
                                        <div className="absolute bottom-full mb-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                            <button type="button" onClick={() => { setShowModelSelector(true); setShowMoreMenu(false); }} className="w-full flex justify-between items-center text-left px-4 py-3 text-sm hover:bg-primary/10">
                                                <span className="flex items-center"><i className="fas fa-robot w-6 mr-2"></i>切换模型</span>
                                                <span className="text-xs text-gray-500 truncate max-w-[100px]">{CHAT_MODELS.find(m => m.value === settings.selectedModel)?.name}</span>
                                            </button>
                                            <button type="button" onClick={() => { setShowPromptSelector(true); setShowMoreMenu(false); }} className="w-full flex justify-between items-center text-left px-4 py-3 text-sm hover:bg-primary/10">
                                                <span className="flex items-center"><i className="fas fa-magic w-6 mr-2"></i>切换提示词</span>
                                                <span className="text-xs text-gray-500 truncate max-w-[100px]">{settings.prompts.find(p => p.id === settings.currentPromptId)?.name}</span>
                                            </button>
                                            <div className="border-t my-1 dark:border-gray-700"></div>
                                            <button type="button" onClick={() => { fileInputRef.current.click(); setShowMoreMenu(false); }} className="w-full flex items-center text-left px-4 py-3 text-sm hover:bg-primary/10"><i className="fas fa-image w-6 mr-2"></i>上传图片</button>
                                            <button type="button" onClick={() => { cameraInputRef.current.click(); setShowMoreMenu(false); }} className="w-full flex items-center text-left px-4 py-3 text-sm hover:bg-primary/10"><i className="fas fa-camera w-6 mr-2"></i>拍照上传</button>
                                        </div>
                                    )}
                                    {showModelSelector && (
                                        <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                            {CHAT_MODELS.map(m => ( <button key={m.value} type="button" onClick={()=>{setSettings(s=>({...s, selectedModel: m.value})); setShowModelSelector(false);}} className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${settings.selectedModel === m.value ? 'text-primary font-bold' : ''}`}>{m.name}</button>))}
                                        </div>
                                    )}
                                    {showPromptSelector && (
                                        <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                            {settings.prompts.map(p => ( <button key={p.id} type="button" onClick={()=>{setSettings(s=>({...s, currentPromptId: p.id}));setShowPromptSelector(false);}} className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${settings.currentPromptId === p.id ? 'text-primary font-bold' : ''}`}>{p.name}</button>))}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" multiple />
                            <input type="file" ref={cameraInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" capture="environment" />

                            <div className="flex-grow relative">
                                <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                                <button type="button" onClick={isListening ? stopListening : startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`} title="语音输入">
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
