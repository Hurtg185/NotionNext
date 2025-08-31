// /components/AiChatAssistant.js - v24: 修复设置中模型选择，新增快捷切换模型，所有功能已整合
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';
import { SpeechRecognitionProvider, useSpeechRecognition } from '../contexts/SpeechRecognitionContext'; 

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
    const messageRef = useRef(null);

    useEffect(() => {
        if (!isUser && msg.content && settings.autoRead && isLastAiMessage && messageRef.current) {
            const ttsButton = messageRef.current.querySelector('button[title="朗读"]');
            if (ttsButton) {
                setTimeout(() => ttsButton.click(), 300);
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

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };

    return (
        <div className={`h-full bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-48 p-2' : 'w-0 p-0'} overflow-hidden`}>
            <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
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

const SettingsModal = ({ settings, onSave, onClose }) => {
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
        const newPrompt = { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入...', model: tempSettings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural' };
        const newPrompts = [...tempSettings.prompts, newPrompt];
        handleChange('prompts', newPrompts);
    };
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); };
    
    const handlePromptSettingChange = (promptId, field, value) => {
        const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: value } : p);
        handleChange('prompts', newPrompts);
    };

    const chatModels = [
        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' }, { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' }, { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }, { name: 'Gemini 2.5 Flash-late (最快)', value: 'gemini-2.5-flash-late' }, { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro' },
    ];
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
                     <div>
                        <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                    </div>
                    {/* 修复：恢复 AI 聊天模型选择 */}
                    <div>
                        <label className="block text-sm font-medium mb-1">AI 聊天模型</label>
                        <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                            {chatModels.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                        </select>
                    </div>
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
                     <div>
                        <label className="block text-sm font-medium mb-1">语音识别语言</label>
                        <select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                           {speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}
                        </select>
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
                                                {chatModels.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="shrink-0">声音:</label>
                                            <select value={p.ttsVoice || settings.thirdPartyTtsVoice} onChange={(e) => handlePromptSettingChange(p.id, 'ttsVoice', e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                                {microsoftTtsVoices.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}
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

const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural' }, { id: 'translate-myanmar', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural' } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8,
    maxOutputTokens: 2048,
    apiTimeout: 60000,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: true,
    ttsEngine: TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI: '',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

export const useGeminiChat = () => {
    const abortControllerRef = useRef(null);
    const timeoutRef = useRef(null);
    const [chatError, setChatError] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    const callGeminiApi = useCallback(async ({ messagesForApi, currentPromptContent, settings, modelToUse }) => {
        setIsChatLoading(true);
        setChatError('');

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        timeoutRef.current = setTimeout(() => {
            abortControllerRef.current?.abort();
        }, settings.apiTimeout);

        try {
            const contents = [
                { role: 'user', parts: [{ text: currentPromptContent }] },
                { role: 'model', parts: [{ text: "好的，我明白了。" }] },
                ...messagesForApi.map(msg => {
                    const parts = [];
                    if (msg.content) parts.push({ text: msg.content });
                    if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } }));
                    return { role: msg.role === 'user' ? 'user' : 'model', parts };
                })
            ];

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig: { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens } }),
                signal,
            });

            clearTimeout(timeoutRef.current);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API请求失败`);
            }

            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');

            return { success: true, content: aiResponseContent };

        } catch (err) {
            clearTimeout(timeoutRef.current);
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') {
                errorMessage = 'API 请求超时，请检查网络或在设置中延长“思考预算”。';
            }
            setChatError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsChatLoading(false);
        }
    }, []);

    const stopGenerating = useCallback(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsChatLoading(false);
    }, []);

    return { callGeminiApi, stopGenerating, isChatLoading, chatError, setChatError };
};


// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showPromptSelector, setShowPromptSelector] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);
    
    const { isListening, recognizedText, startListening, stopListening, recognitionError, clearRecognition, setTriggerAutoSend } = useSpeechRecognition();
    const { callGeminiApi, stopGenerating, isChatLoading, chatError, setChatError } = useGeminiChat();


    const messagesEndRef = useRef(null);
    const promptSelectorRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const autoSendTimeoutRef = useRef(null);


    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v24_final'); // 更新 localStorage key
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                parsed.prompts = parsed.prompts.map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || 'zh-CN-XiaoxiaoMultilingualNeural' }));
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
            const savedConversations = localStorage.getItem('ai_assistant_conversations_v24_final'); // 更新 localStorage key
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
            localStorage.setItem('ai_assistant_settings_v24_final', JSON.stringify(settings)); // 更新 localStorage key
            localStorage.setItem('ai_assistant_conversations_v24_final', JSON.stringify(conversations)); // 更新 localStorage key
        }
    }, [settings, conversations, isMounted]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, currentConversationId]);

    // 清理自动发送定时器
    useEffect(() => {
        return () => {
            if (autoSendTimeoutRef.current) {
                clearTimeout(autoSendTimeoutRef.current);
            }
        };
    }, []);


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
        if (autoSendTimeoutRef.current) {
            clearTimeout(autoSendTimeoutRef.current);
            autoSendTimeoutRef.current = null;
        }
    };

    const handleRemoveImage = (indexToRemove) => {
        setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSpeechFinalResult = useCallback((finalText) => {
        setUserInput(finalText);
        if (selectedImages.length === 0 && finalText) {
            if (autoSendTimeoutRef.current) clearTimeout(autoSendTimeoutRef.current);
            autoSendTimeoutRef.current = setTimeout(() => {
                if (finalText === userInput && selectedImages.length === 0) {
                    handleSubmit(false, finalText);
                }
                autoSendTimeoutRef.current = null;
            }, 3000);
        }
    }, [selectedImages, userInput, handleSubmit]);
    
    const handleSubmit = useCallback(async (isRegenerate = false, textOverride = '') => {
        if (autoSendTimeoutRef.current) {
            clearTimeout(autoSendTimeoutRef.current);
            autoSendTimeoutRef.current = null;
        }
        stopListening();

        if (!currentConversationId || isChatLoading) return;
        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (!currentConv) return;

        let messagesForApi = [...currentConv.messages];
        const textToProcess = textOverride || userInput.trim();

        if (isRegenerate) {
            if (messagesForApi[messagesForApi.length - 1]?.role === 'ai') messagesForApi.pop();
        } else {
            if (!textToProcess && selectedImages.length === 0) {
                setChatError('请输入文字或选择图片再发送！');
                return;
            }
            const userMessage = { role: 'user', content: textToProcess, images: selectedImages };
            const newMessages = [...currentConv.messages, userMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: newMessages } : c));
            messagesForApi.push(userMessage);
            setUserInput('');
            setSelectedImages([]);
            clearRecognition();
        }

        if (messagesForApi.length === 0) return;

        const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0];
        const modelToUse = currentPrompt.model || settings.selectedModel;
        const ttsVoiceToUse = currentPrompt.ttsVoice || settings.thirdPartyTtsVoice;
        
        setSettings(prev => ({
            ...prev,
            selectedModel: modelToUse,
            thirdPartyTtsVoice: ttsVoiceToUse
        }));

        const result = await callGeminiApi({
            messagesForApi,
            currentPromptContent: currentPrompt.content,
            settings: settings,
            modelToUse: modelToUse
        });

        if (result.success) {
            const aiMessage = { role: 'ai', content: result.content };
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...messagesForApi, aiMessage] } : c));
        } else {
            const aiMessage = { role: 'ai', content: `抱歉，出错了: ${result.error}` };
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...messagesForApi, aiMessage] } : c));
        }
    }, [currentConversationId, conversations, userInput, selectedImages, settings, callGeminiApi, clearRecognition, stopListening, setChatError]);
    
    const handleQuickModelChange = (modelValue) => {
        setSettings(prev => ({ ...prev, selectedModel: modelValue }));
        setShowModelSelector(false); // 关闭快捷选择器
    };

    const currentConversation = conversations.find(c => c.id === currentConversationId);

    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const showLeftButtons = !userInput.trim() && selectedImages.length === 0;
    const chatModels = [ // 快捷选择器用的模型列表
        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
        { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest' },
        { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    ];
    const [showModelSelector, setShowModelSelector] = useState(false); // 控制模型选择器显示


    return (
        <SpeechRecognitionProvider language={settings.speechLanguage} onFinalResult={handleSpeechFinalResult}>
            <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onNew={createNewConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation}/>
                <div className="flex-1 flex flex-col h-full min-w-0">
                    <div className="flex items-center justify-between py-0.5 px-2 border-b dark:border-gray-700 shrink-0">
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
                        {(chatError || recognitionError) && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm" onClick={() => {setChatError(''); clearRecognition();}}>{chatError || recognitionError} <span className='text-xs'>(点击关闭)</span></div>}
                        
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

                        {isChatLoading ? ( <div className="flex justify-center items-center gap-2 text-gray-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考中...</div> ) : (
                            <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                                 {showLeftButtons ? (
                                    <>
                                        <div ref={promptSelectorRef} className="relative">
                                            <button type="button" onClick={() => setShowPromptSelector(s => !s)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="切换提示词"><i className="fas fa-magic"></i></button>
                                            {showPromptSelector && (
                                                <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                                    {settings.prompts.map(p => ( <button key={p.id} type="button" onClick={()=>{setSettings(s=>({...s, currentPromptId: p.id}));setShowPromptSelector(false);}} className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${settings.currentPromptId === p.id ? 'text-primary font-bold' : ''}`}>{p.name}</button>))}
                                                </div>
                                            )}
                                        </div>
                                        {/* NEW: 快捷切换模型按钮 */}
                                        <div className="relative">
                                            <button type="button" onClick={() => setShowModelSelector(s => !s)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="切换模型"><i className="fas fa-robot"></i></button>
                                            {showModelSelector && (
                                                <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                                    {chatModels.map(m => ( <button key={m.value} type="button" onClick={() => handleQuickModelChange(m.value)} className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${settings.selectedModel === m.value ? 'text-primary font-bold' : ''}`}>{m.name}</button>))}
                                                </div>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="上传图片"><i className="fas fa-image"></i></button>
                                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" multiple />
                                         <button type="button" onClick={() => cameraInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="拍照"><i className="fas fa-camera"></i></button>
                                        <input type="file" ref={cameraInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" capture="environment" />
                                    </>
                                ) : (
                                    <button type="button" className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="更多选项"><i className="fas fa-ellipsis-h"></i></button>
                                )}

                                <div className="flex-grow relative">
                                    <textarea value={userInput} onChange={(e) => {
                                        setUserInput(e.target.value);
                                        if (autoSendTimeoutRef.current) {
                                            clearTimeout(autoSendTimeoutRef.current);
                                            autoSendTimeoutRef.current = null;
                                        }
                                    }} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                                    <button type="button" onClick={isListening ? stopListening : startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`} title="语音输入">
                                        <i className="fas fa-microphone"></i>
                                    </button>
                                </div>
                                <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shrink-0" disabled={isChatLoading || (!userInput.trim() && selectedImages.length === 0)}><i className="fas fa-arrow-up"></i></button>
                                <button type="button" onClick={() => setIsFullScreen(f => !f)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title={isFullScreen ? '退出全屏' : '全屏模式'}><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
                            </form>
                        )}
                    </div>
                </div>
                 {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
            </div>
        </SpeechRecognitionProvider>
    );
};

export default AiChatAssistant;
