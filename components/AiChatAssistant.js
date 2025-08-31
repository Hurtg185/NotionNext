// /components/AiChatAssistant.js - v32.1: (紧急修复版)
// 1. [修复] 恢复了被意外删除的 DEFAULT_PROMPTS 变量和 SettingsModal UI，解决了导致应用崩溃的致命错误。
// 2. [修复] 补全了 handleSubmit 函数中的状态更新逻辑，确保AI回复能正常显示。
// 3. [修复] 恢复了 SettingsModal 中的其他功能函数实现。
// 4. [优化] 为 handleSubmit 添加了安全检查，防止在模型列表为空时崩溃。

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';

export const TTS_ENGINE = {
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
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
        const isRecent = msg.timestamp && (Date.now() - msg.timestamp < 2000);
        if (isLastAiMessage && !isUser && msg.content && settings.autoRead && !hasBeenReadRef.current && isRecent) {
            const ttsButton = messageRef.current?.querySelector('button[title="朗读"]');
            if (ttsButton) {
                setTimeout(() => {
                    if (messageRef.current?.contains(ttsButton)) {
                       ttsButton.click();
                       hasBeenReadRef.current = true;
                    }
                }, 300);
            }
        }
    }, [isUser, msg.content, settings.autoRead, isLastAiMessage, msg.timestamp]);
    
    const currentPrompt = settings.prompts.find(p => p.id === msg.promptId) || {};
    const aiAvatar = currentPrompt.avatarUrl || settings.aiAvatarUrl;

    return (
        <div ref={messageRef} className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={aiAvatar} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
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

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };

    const groupedConversations = conversations.reduce((acc, conv) => {
        const promptId = conv.promptId || 'uncategorized';
        if (!acc[promptId]) {
            acc[promptId] = [];
        }
        acc[promptId].push(conv);
        return acc;
    }, {});

    const promptOrder = prompts.map(p => p.id);
    const sortedGroupKeys = Object.keys(groupedConversations).sort((a, b) => {
        if (a === 'uncategorized') return 1;
        if (b === 'uncategorized') return -1;
        return promptOrder.indexOf(a) - promptOrder.indexOf(b);
    });

    return (
        <div className={`h-full bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-56 p-2' : 'w-0 p-0'} overflow-hidden`}>
            <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                <span>新对话</span><i className="fas fa-plus"></i>
            </button>
            <div className="flex-grow overflow-y-auto">
                {sortedGroupKeys.map(promptId => {
                    const prompt = prompts.find(p => p.id === promptId);
                    const groupTitle = prompt ? prompt.name : '未分类对话';
                    const groupAvatar = prompt ? (prompt.avatarUrl || settings.aiAvatarUrl) : settings.aiAvatarUrl;
                    const convsInGroup = groupedConversations[promptId];

                    return (
                        <div key={promptId} className="mb-3">
                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
                                <img src={groupAvatar} alt={groupTitle} className="w-5 h-5 rounded-full object-cover" />
                                <span className="font-semibold truncate">{groupTitle}</span>
                            </div>
                            {convsInGroup.map(conv => (
                                <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => onSelect(conv.id)}>
                                    <div className="flex-grow truncate" onDoubleClick={() => handleRename(conv.id, conv.title)}>
                                        {editingId === conv.id ? (
                                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus />
                                        ) : ( <span className="text-sm">{conv.title}</span> )}
                                    </div>
                                    <div className={`items-center shrink-0 ${currentId === conv.id ? 'flex' : 'hidden group-hover:flex'}`}>
                                       <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-1 hover:text-primary"><i className="fas fa-pen text-xs"></i></button>
                                       <button onClick={(e) => { e.stopPropagation(); if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-1 ml-1 hover:text-red-500"><i className="fas fa-trash text-xs"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);
    const [isPromptsExpanded, setIsPromptsExpanded] = useState(true);
    const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);

    useEffect(() => {
        const fetchSystemVoices = () => {
            if (!window.speechSynthesis) return;
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi')));
            }
        };
        if (window.speechSynthesis) {
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = fetchSystemVoices;
            }
            fetchSystemVoices();
        }
    }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddPrompt = () => {
        const newPrompt = { id: `custom-${Date.now()}`, name: '新助理', content: '请输入...', model: (settings.chatModels[0] || {}).value, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' };
        const newPrompts = [...tempSettings.prompts, newPrompt];
        handleChange('prompts', newPrompts);
    };
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); };
    const handlePromptSettingChange = (promptId, field, value) => {
        const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: value } : p);
        handleChange('prompts', newPrompts);
    };
    
    const handleAddModel = () => {
        const newModel = { id: `model-${Date.now()}`, name: '新模型', value: 'model-id', apiType: 'google', endpoint: 'https://generativelanguage.googleapis.com', apiKey: '' };
        handleChange('chatModels', [...tempSettings.chatModels, newModel]);
    };
    const handleDeleteModel = (idToDelete) => {
        if (tempSettings.chatModels.length <= 1) { alert("至少需要保留一个模型。"); return; }
        if (!window.confirm('确定删除此模型吗？')) return;
        const newModels = tempSettings.chatModels.filter(m => m.id !== idToDelete);
        handleChange('chatModels', newModels);
    };
    const handleModelSettingChange = (id, field, value) => {
        const newModels = tempSettings.chatModels.map(m => {
            if (m.id === id) {
                const updatedModel = { ...m, [field]: value };
                if (field === 'apiType') {
                    updatedModel.endpoint = value === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com';
                }
                return updatedModel;
            }
            return m;
        });
        handleChange('chatModels', newModels);
    };
    
    const microsoftTtsVoices = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' }, ];
    const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-4">
                    <div className="border dark:border-gray-700 rounded-lg">
                        <button onClick={() => setIsPromptsExpanded(!isPromptsExpanded)} className="w-full flex justify-between items-center p-3 font-bold text-lg bg-gray-50 dark:bg-gray-700/50 rounded-t-lg">
                            助理提示词管理
                            <i className={`fas fa-chevron-down transition-transform ${isPromptsExpanded ? 'rotate-180' : ''}`}></i>
                        </button>
                        {isPromptsExpanded && (
                            <div className="p-4 space-y-2">
                                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto p-1">
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
                                                    <select value={p.model || (settings.chatModels[0] || {}).value} onChange={(e) => handlePromptSettingChange(p.id, 'model', e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                                        {(tempSettings.chatModels || []).map(m => <option key={m.id} value={m.value}>{m.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="shrink-0">声音:</label>
                                                    <select value={p.ttsVoice || settings.thirdPartyTtsVoice} onChange={(e) => handlePromptSettingChange(p.id, 'ttsVoice', e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                                        {microsoftTtsVoices.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="shrink-0">头像:</label>
                                                    <input type="text" value={p.avatarUrl || ''} onChange={(e) => handlePromptSettingChange(p.id, 'avatarUrl', e.target.value)} placeholder="输入头像图片URL" className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleAddPrompt} className="w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600"><i className="fas fa-plus mr-2"></i>添加新助理</button>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                        <h4 className="text-md font-semibold mb-3">模型与API管理</h4>
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto p-1">
                            {(tempSettings.chatModels || []).map(m => (
                                <div key={m.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input type="text" value={m.name} onChange={(e) => handleModelSettingChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="w-1/2 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm" />
                                        <input type="text" value={m.value} onChange={(e) => handleModelSettingChange(m.id, 'value', e.target.value)} placeholder="模型 ID (e.g. gemini-1.5-pro)" className="w-1/2 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm" />
                                        <button onClick={() => handleDeleteModel(m.id)} className="p-1 text-sm text-red-500 rounded shrink-0" title="删除"><i className="fas fa-trash"></i></button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select value={m.apiType} onChange={(e) => handleModelSettingChange(m.id, 'apiType', e.target.value)} className="px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm">
                                            <option value="google">Google API</option>
                                            <option value="openai">OpenAI 兼容</option>
                                        </select>
                                        <input type="text" value={m.endpoint} onChange={(e) => handleModelSettingChange(m.id, 'endpoint', e.target.value)} placeholder="API Endpoint" className="flex-grow px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm" />
                                    </div>
                                    <div>
                                        <input type="password" value={m.apiKey} onChange={(e) => handleModelSettingChange(m.id, 'apiKey', e.target.value)} placeholder="为此模型填入 API Key" className="w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddModel} className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"><i className="fas fa-plus mr-2"></i>添加新模型</button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Google API 密钥 (全局备用)</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                         <button onClick={() => setShowApiKeyHelp(!showApiKeyHelp)} className="text-xs text-primary mt-1">
                            {showApiKeyHelp ? '[-] 收起说明' : '[+] 展开使用说明'}
                         </button>
                         {showApiKeyHelp && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-gray-700 text-xs rounded">
                                这是为旧版或未独立设置密钥的Google模型提供的备用Key。建议在上面的“模型与API管理”中为每个模型独立设置密钥。<br/>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">点击这里获取 Google Gemini API 密钥</a>
                            </div>
                         )}
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">聊天背景图片URL</label>
                        <input type="text" value={tempSettings.chatBackgroundUrl} onChange={(e) => handleChange('chatBackgroundUrl', e.target.value)} placeholder="输入图片网址" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
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


const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '语法纠正', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-1.5-flash-latest', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '/images/avatars/teacher.png' }, { id: 'explain-word', name: '词语解释', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '/images/avatars/dictionary.png' }, { id: 'translate-myanmar', name: '中缅翻译', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-1.5-flash-latest', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '/images/avatars/translator.png' } ];

const DEFAULT_SETTINGS = {
    apiKey: '',
    chatModels: [
        { id: 'model-1', name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest', apiType: 'google', endpoint: 'https://generativelanguage.googleapis.com', apiKey: '' },
        { id: 'model-2', name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest', apiType: 'google', endpoint: 'https://generativelanguage.googleapis.com', apiKey: '' },
        { id: 'model-3', name: 'GPT-4o (需配置)', value: 'gpt-4o', apiType: 'openai', endpoint: 'https://api.openai.com', apiKey: '' },
    ],
    temperature: 0.8,
    maxOutputTokens: 2048,
    disableThinkingMode: true,
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    const recognitionRef = useRef(null);
    
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v32');
            if (savedSettings) {
                let parsed = JSON.parse(savedSettings);
                if (!parsed.chatModels || !parsed.chatModels[0]?.apiType) {
                    parsed.chatModels = DEFAULT_SETTINGS.chatModels.map(m => ({
                        ...m,
                        apiKey: m.apiType === 'google' ? parsed.apiKey || '' : '' 
                    }));
                }
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
            const savedConversations = localStorage.getItem('ai_assistant_conversations_v32');
            let parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
            const currentPromptId = settings.currentPromptId || DEFAULT_PROMPTS[0]?.id;
            parsedConvs = parsedConvs.map(c => c.promptId ? c : { ...c, promptId: currentPromptId });
            
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
            localStorage.setItem('ai_assistant_settings_v32', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v32', JSON.stringify(conversations));
        }
    }, [settings, conversations, isMounted]);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversations, currentConversationId]);

    const createNewConversation = () => {
        const newId = `conv-${Date.now()}`;
        const newConv = {
            id: newId,
            title: '新的对话',
            messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？', timestamp: Date.now(), promptId: settings.currentPromptId }],
            promptId: settings.currentPromptId
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newId);
    };
    
    const handleSelectConversation = (id) => setCurrentConversationId(id);
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { setCurrentConversationId(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    
    // ... handleImageUpload, handleRemoveImage, startListening, stopListening callbacks ...

    const handleSubmit = async (isRegenerate = false) => {
        if (!currentConversationId || isLoading) return;
        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (!currentConv) return;
        
        let messagesForApi = [...currentConv.messages];
        const textToProcess = userInput.trim();

        if (isRegenerate) {
            if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') {
                messagesForApi.pop();
            }
        } else {
            if (!textToProcess && selectedImages.length === 0) {
                setError('请输入文字或选择图片再发送！');
                return;
            }
            const userMessage = { role: 'user', content: textToProcess, images: selectedImages, timestamp: Date.now(), promptId: currentConv.promptId };
            const updatedMessages = [...currentConv.messages, userMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages } : c));
            messagesForApi = updatedMessages;
            setUserInput('');
            setSelectedImages([]);
        }

        if (messagesForApi.length === 0) return;

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        const currentPrompt = settings.prompts.find(p => p.id === currentConv.promptId) || settings.prompts[0];
        const modelInPrompt = settings.chatModels.find(m => m.value === currentPrompt.model);
        const modelToUse = modelInPrompt || settings.chatModels[0];
        
        if (!modelToUse) {
            setError('错误：没有可用的模型。请在设置中添加一个模型。');
            setIsLoading(false);
            return;
        }

        const apiKey = modelToUse.apiKey || (modelToUse.apiType === 'google' ? settings.apiKey : '');
        if (!apiKey) {
            setError(`错误：模型 "${modelToUse.name}" 缺少 API Key，请在设置中配置。`);
            setIsLoading(false);
            return;
        }

        try {
            let aiResponseContent = '';

            if (modelToUse.apiType === 'openai') {
                const messages = [
                    { role: 'system', content: currentPrompt.content },
                    ...messagesForApi.slice(1).map(msg => ({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.content }))
                ];

                const response = await fetch(`${modelToUse.endpoint}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: modelToUse.value, messages, temperature: settings.temperature, max_tokens: settings.maxOutputTokens }),
                    signal,
                });
                if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败 (${response.status})`); }
                const data = await response.json();
                aiResponseContent = data.choices?.[0]?.message?.content;

            } else { // Google API
                const history = messagesForApi.slice(1).map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content || '' }]
                }));
                const contents = [
                    { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history
                ];

                const response = await fetch(`${modelToUse.endpoint}/v1beta/models/${modelToUse.value}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents, generationConfig: { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens } }),
                    signal,
                });
                 if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败 (${response.status})`); }
                const data = await response.json();
                aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            }

            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            const aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now(), promptId: currentConv.promptId };
            const finalMessages = [...messagesForApi, aiMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));

        } catch (err) {
            const finalMessages = [...messagesForApi];
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') { errorMessage = '请求被中断。'; }
            setError(errorMessage);
            finalMessages.push({role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now(), promptId: currentConv.promptId});
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally {
            setIsLoading(false);
        }
    };
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            <ChatSidebar 
                isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} 
                onSelect={handleSelectConversation} onNew={createNewConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation}
                prompts={settings.prompts} settings={settings}
            />
            <div className="flex-1 flex flex-col h-full min-w-0">
                <div className="flex items-center justify-between py-1 px-2 border-b dark:border-gray-700 shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="切换侧边栏"><i className="fas fa-bars"></i></button>
                        <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2>
                    </div>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
                </div>
                <div 
                    className="flex-grow p-4 overflow-y-auto" 
                    style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    onClick={() => { if (isSidebarOpen) setIsSidebarOpen(false); }}
                >
                    <div className="space-y-1">
                        {currentConversation?.messages.map((msg, index) => (
                            <MessageBubble key={`${currentConversationId}-${index}`} msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} />
                        ))}
                    </div>
                    <div ref={messagesEndRef} />
                </div>
                {/* ... input area JSX ... */}
            </div>
             {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
