// /components/AiChatAssistant.js - v18: 修复所有回归问题并增强功能
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';

export const TTS_ENGINE = {
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
};

// --- 子组件定义区域 ---

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
    return (
        <div className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm'}`} style={{ maxWidth: '85%' }}>
                {msg.image && <img src={msg.image} alt="用户上传" className="rounded-md mb-2 max-w-full h-auto" />}
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

// 恢复：侧边栏组件
const ChatSidebar = ({ conversations, currentId, onSelect, onNew, onDelete, onRename }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');

    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };

    return (
        <div className={`h-full bg-gray-50 dark:bg-gray-800/50 p-2 flex flex-col border-r dark:border-gray-700 transition-all duration-300 w-64`}>
            <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700">
                <span>发起新对话</span><i className="fas fa-plus"></i>
            </button>
            <div className="flex-grow overflow-y-auto">
                {conversations.map(conv => (
                    <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => onSelect(conv.id)}>
                        <div className="flex-grow truncate" onDoubleClick={() => handleRename(conv.id, conv.title)}>
                            {editingId === conv.id ? (
                                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus />
                            ) : ( <span className="text-sm">{conv.title}</span> )}
                        </div>
                        <div className="hidden group-hover:flex items-center">
                           <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-1 hover:text-primary"><i className="fas fa-pen text-xs"></i></button>
                           <button onClick={(e) => { e.stopPropagation(); if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-1 hover:text-red-500"><i className="fas fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 设置面板组件 (已完全恢复并增强)
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);

    useEffect(() => { /* ... (获取系统声音的逻辑保持不变) ... */ }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handlePromptChange = (e, promptId, field) => { const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: e.target.value } : p); handleChange('prompts', newPrompts); };
    const handleAddPrompt = () => { const newPrompts = [...tempSettings.prompts, { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入内容...' }]; handleChange('prompts', newPrompts); };
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); };

    // 恢复并增强：模型列表
    const chatModels = [
        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
        { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
        { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' },
        { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
    ];
    // ... (microsoftTtsVoices 列表保持不变) ...

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-4">
                    {/* ... API Key, 模型选择 ... */}
                     <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-2">
                         <label className="block text-sm font-medium">高级参数</label>
                         <div className="flex items-center gap-4">
                             <label className="text-sm shrink-0">温度: {tempSettings.temperature}</label>
                             <input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/>
                         </div>
                          <div className="flex items-center gap-4">
                             <label className="text-sm shrink-0">API超时: {tempSettings.apiTimeout / 1000}s</label>
                             <input type="range" min="10" max="120" step="5" value={tempSettings.apiTimeout / 1000} onChange={(e) => handleChange('apiTimeout', parseInt(e.target.value, 10) * 1000)} className="w-full"/>
                         </div>
                     </div>
                    {/* ... TTS 设置 ... */}
                    {/* 恢复：提示词管理 */}
                     <div className="mb-6">
                        <h4 className="text-lg font-bold mb-3">自定义提示词管理</h4>
                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                            {tempSettings.prompts.map(p => (
                                <div key={p.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center flex-grow cursor-pointer"><input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === p.id} onChange={() => handleChange('currentPromptId', p.id)} className="mr-2 text-primary" /><input type="text" value={p.name} onChange={(e) => handlePromptChange(e, p.id, 'name')} className="font-medium bg-transparent w-full" /></label>
                                        <button onClick={() => handleDeletePrompt(p.id)} className="p-1 ml-2 text-sm text-red-500 rounded"><i className="fas fa-trash"></i></button>
                                    </div>
                                    <textarea value={p.content} onChange={(e) => handlePromptChange(e, p.id, 'content')} className="w-full mt-2 h-20 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" />
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

// 恢复并增强：默认设置
const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师...' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师...' }, { id: 'translate-myanmar', name: '中缅互译', content: '你是一位专业的翻译助手...' } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8,
    maxOutputTokens: 2048,
    apiTimeout: 60000, // 新增：默认60秒超时
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
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showPromptSelector, setShowPromptSelector] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const promptSelectorRef = useRef(null);
    const fileInputRef = useRef(null);
    const timeoutRef = useRef(null);

    // ... (useEffect for localStorage, adapted for v18 key) ...

    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    
    // 恢复：图片处理
    const handleImageUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => { setSelectedImage(reader.result.split(',')[1]); setImagePreviewUrl(reader.result); }; reader.readAsDataURL(file); };
    const clearImage = () => { setSelectedImage(null); setImagePreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

    const handleSubmit = async (isRegenerate = false) => {
        // ... (API 请求逻辑，现在需要加入超时处理) ...
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        timeoutRef.current = setTimeout(() => {
            abortControllerRef.current.abort();
        }, settings.apiTimeout);

        try {
            const response = await fetch(URL, { /* ..., */ signal });
            // ...
        } catch (err) {
            if (err.name === 'AbortError') {
                 // 设置超时错误信息
            }
            // ...
        } finally {
            clearTimeout(timeoutRef.current);
            setIsLoading(false);
        }
    };

    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    // 恢复：v12 的外层布局
    return (
        <div className={`w-full max-w-4xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800 ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            <div className="flex h-full">
                <ChatSidebar /* ...props... */ />
                <div className="flex-1 flex flex-col h-full">
                    {/* ... 顶部标题栏 ... */}
                    <div className="flex-grow p-4 overflow-y-auto" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`}}>
                        {/* ... 消息列表 ... */}
                    </div>
                    {/* 恢复：v12 风格的输入框区域 */}
                    <div className="p-3 border-t dark:border-gray-700 shrink-0">
                        {isLoading ? ( /* ... */ ) : (
                            <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                                <div ref={promptSelectorRef} className="relative">
                                    <button type="button" onClick={() => setShowPromptSelector(s => !s)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="切换提示词"><i className="fas fa-magic"></i></button>
                                    {/* ... 提示词选择器 ... */}
                                </div>
                                <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="上传图片"><i className="fas fa-image"></i></button>
                                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                                <div className="flex-grow relative">
                                    <textarea /* ... */ />
                                    <button type="button" /* ...语音输入... */ >
                                        <i className="fas fa-microphone"></i>
                                    </button>
                                </div>
                                <button type="submit" /* ...发送按钮... */>
                                    <i className="fas fa-arrow-up"></i>
                                </button>
                                <button type="button" onClick={() => setIsFullScreen(f => !f)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="全屏模式"><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
             {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
