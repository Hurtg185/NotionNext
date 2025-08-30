// /components/AiChatAssistant.js - v17: 无新依赖版，保留核心功能
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';

// 定义 TTS 引擎类型
export const TTS_ENGINE = {
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
};

// --- 子组件定义区域 ---

// 使用回 v12 的 SimpleMarkdown，因为它无依赖
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

// 消息气泡组件 (使用 SimpleMarkdown)
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3.5 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-gray-100 dark:bg-gray-700 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
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

// 设置面板组件 (已更新，增加高级参数)
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
    
    const chatModels = [
        { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' },
        { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
        { name: 'Gemini 1.0 Pro', value: 'gemini-1.0-pro' },
    ];

    const microsoftTtsVoices = [
        { name: '晓晓 (HD)', value: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural' }, { name: '晓辰 (HD)', value: 'zh-CN-Xiaochen:DragonHDFlashLatestNeural' }, { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">AI 聊天模型</label>
                        <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                            {chatModels.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                        </select>
                    </div>
                     <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-2">
                         <label className="block text-sm font-medium">高级参数</label>
                         <div className="flex items-center gap-4">
                             <label className="text-sm">温度: {tempSettings.temperature}</label>
                             <input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/>
                         </div>
                         <div className="flex items-center gap-4">
                             <label className="text-sm">最大长度: {tempSettings.maxOutputTokens}</label>
                             <input type="range" min="256" max="8192" step="256" value={tempSettings.maxOutputTokens} onChange={(e) => handleChange('maxOutputTokens', parseInt(e.target.value, 10))} className="w-full"/>
                         </div>
                     </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4">
                        <h4 className="text-md font-semibold">朗读设置</h4>
                        <div>
                            <label className="block text-sm font-medium mb-1">朗读引擎</label>
                            <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                <option value={TTS_ENGINE.THIRD_PARTY}>第三方 API (音质更好)</option>
                                <option value={TTS_ENGINE.SYSTEM}>系统内置 (速度快)</option>
                            </select>
                        </div>
                        {tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (
                            <div>
                                <label className="block text-sm font-medium mb-1">发音人 (第三方)</label>
                                <select value={tempSettings.thirdPartyTtsVoice} onChange={(e) => handleChange('thirdPartyTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                    {microsoftTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}
                                </select>
                            </div>
                        )}
                        {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (
                             <div>
                                <label className="block text-sm font-medium mb-1">发音人 (系统)</label>
                                {systemVoices.length > 0 ? (
                                    <select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                        <option value="">浏览器默认</option>
                                        {systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}
                                    </select>
                                ) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}
                            </div>
                        )}
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


// 侧边栏组件
const ChatSidebar = ({ conversations, currentId, onSelect, onNew, onDelete, onRename }) => { /* ... (与v16完全相同) ... */ };

// 默认设置
const DEFAULT_PROMPTS = [ { id: 'default', name: '默认助理', content: '你是一个乐于助人的AI助理。' } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash-latest',
    temperature: 0.8,
    maxOutputTokens: 2048,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: 'default',
    autoRead: false,
    ttsEngine: TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural',
    systemTtsVoiceURI: '',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '',
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
    
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v17_final');
            if (savedSettings) setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            
            const savedConversations = localStorage.getItem('ai_assistant_conversations_v17_final');
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
            localStorage.setItem('ai_assistant_settings_v17_final', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v17_final', JSON.stringify(conversations));
        }
    }, [settings, conversations, isMounted]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, currentConversationId]);
    
    const createNewConversation = () => {
        const newId = `conv-${Date.now()}`;
        const newConv = {
            id: newId,
            title: '新的对话',
            messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }]
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newId);
    };

    const handleSelectConversation = (id) => setCurrentConversationId(id);
    
    const handleDeleteConversation = (id) => { /* ... (与v16相同) ... */ };
    const handleRenameConversation = (id, newTitle) => { /* ... (与v16相同) ... */ };

    const currentConversation = conversations.find(c => c.id === currentConversationId);
    
    const handleSubmit = async (isRegenerate = false) => {
        if (!currentConversation || isLoading) return;
        
        const currentMessages = currentConversation.messages;
        let messagesToSend = [...currentMessages];
        
        if (isRegenerate) {
            if (messagesToSend[messagesToSend.length - 1]?.role === 'ai') messagesToSend.pop();
        } else {
            const textToProcess = userInput.trim();
            if (!textToProcess) return;
            const userMessage = { role: 'user', content: textToProcess };
            messagesToSend.push(userMessage);
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: messagesToSend } : c));
            setUserInput('');
        }
        
        if (messagesToSend.length === 0) return;

        setIsLoading(true);
        
        // ... (API 请求准备和 fetch 调用逻辑，请确保它已更新以使用高级参数)
        // 例如, 在 body 的 generationConfig 中加入:
        // "temperature": settings.temperature,
        // "maxOutputTokens": settings.maxOutputTokens,

        setIsLoading(false); // 移到 try...finally 块中
    };
    
    const handleSaveSettings = (newSettings) => {
        setSettings(newSettings);
        setShowSettings(false);
    };

    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className={`w-full bg-white dark:bg-gray-900 flex transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50' : 'relative h-full'}`}>
            <ChatSidebar conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onNew={createNewConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation}/>
            <div className="flex-1 flex flex-col h-full">
                <div className="flex items-center justify-between p-2 border-b dark:border-gray-700 shrink-0">
                    <h2 className="text-lg font-semibold truncate px-2">{currentConversation?.title || '聊天'}</h2>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {currentConversation?.messages.map((msg, index) => (
                            <MessageBubble key={index} msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} />
                        ))}
                    </div>
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t dark:border-gray-700 shrink-0">
                    {isLoading ? ( <div className="flex justify-center items-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考...</div> ) : (
                        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="flex items-center gap-2">
                            <button type="button" onClick={() => setIsFullScreen(f => !f)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="全屏模式"><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
                            <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="输入消息..." className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"/>
                            <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50" disabled={!userInput.trim()}><i className="fas fa-arrow-up"></i></button>
                        </form>
                    )}
                </div>
            </div>
             {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
