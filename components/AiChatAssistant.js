import { Transition, Dialog } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';

// 1. 题型组件映射表 (此项目中未使用，保留为空)
const componentMap = {};

// --- 【辅助函数】 ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- 【数据清洗函数】(此项目中未使用，保留) ---
const sanitizeQuizData = (props) => { return props; };

// --- 【常量定义】---
const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };
const CHAT_MODELS_LIST = [ { id: 'model-1', name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest', maxContextTokens: 8192 }, { id: 'model-2', name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest', maxContextTokens: 8192 }, { id: 'model-3', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 8192 }, { id: 'model-4', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 8192 }, ];
const TRANSLATION_PROMPT = {
    id: 'default-translator-v2',
    name: '中缅翻译引擎',
    content: `你是一位【中缅双语高保真翻译引擎】。
你的任务是接收用户发送的文本，并提供多种翻译版本。
你必须严格按照以下格式返回一个 JSON 数组，不要包含任何其他文字、解释或 \`\`\`json 标记。

[
  {
    "style": "自然直译",
    "translation": "翻译结果",
    "back_translation": "从翻译结果严格回译到源语言的结果"
  },
  {
    "style": "口语化",
    "translation": "翻译结果",
    "back_translation": "从翻译结果严格回译到源语言的结果"
  },
  {
    "style": "原结构直译",
    "translation": "翻译结果",
    "back_translation": "从翻译结果严格回译到源语言的结果"
  }
]

【翻译总原则】
- 忠实原文，不增不减。
- 回译 (back_translation) 必须严格、忠实地翻译回源语言。
- 提供多种版本，例如：自然直译、口语化意译、原结构直译等。

【语言风格要求】
- 缅甸语：使用现代日常口语。
- 中文：使用自然流畅的口语。
- 两种语言都避免使用过于生僻的俚语或网络流行语。

现在，请等待用户的文本。`,
    openingLine: '你好，请发送你需要翻译的中文或缅甸语内容。',
    model: 'gemini-1.5-flash-latest',
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    avatarUrl: 'https://raw.githubusercontent.com/BigFaceCat2023/spacetrans/main/public/images/translator-avatar.png'
};
const DEFAULT_PROMPTS = [TRANSLATION_PROMPT];
const DEFAULT_SETTINGS = { apiKey: '', apiKeys: [], activeApiKeyId: '', chatModels: CHAT_MODELS_LIST, selectedModel: 'gemini-1.5-flash-latest', temperature: 0.5, maxOutputTokens: 2048, disableThinkingMode: true, startWithNewChat: false, prompts: DEFAULT_PROMPTS, currentPromptId: DEFAULT_PROMPTS[0]?.id || '', autoRead: false, ttsEngine: TTS_ENGINE.THIRD_PARTY, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', ttsRate: 0, ttsPitch: 0, systemTtsVoiceURI: '', speechLanguage: 'zh-CN', chatBackgroundUrl: '/images/chat-bg-light.jpg', backgroundOpacity: 70, userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: '/images/ai-avatar.png', isFacebookApp: false, };
const MICROSOFT_TTS_VOICES = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '晓梦 (女, 播音)', value: 'zh-CN-XiaomengNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Andrew (男, 美国, 多语言)', value: 'en-US-AndrewMultilingualNeural' }, { name: '七海 (女, 日本)', value: 'ja-JP-NanamiNeural' }, { name: '圭太 (男, 日本)', value: 'ja-JP-KeitaNeural' }, ];
const SUPPORTED_LANGUAGES = [ { code: 'auto', name: '自动识别', speechCode: 'zh-CN' }, { code: 'zh-CN', name: '中文', speechCode: 'zh-CN' }, { code: 'my-MM', name: '缅甸语', speechCode: 'my-MM' } ];

// --- 【子组件】AiTtsButton ---
const AiTtsButton = ({ text, ttsSettings, size = 'normal' }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    useEffect(() => { return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); }; }, []);
    const handleSpeak = (e) => {
        e.stopPropagation();
        if (!window.speechSynthesis) { alert('您的浏览器不支持语音朗读功能'); return; }
        if (isPlaying) { window.speechSynthesis.cancel(); setIsPlaying(false); return; }
        if (!text) return;
        const cleanText = text.replace(/[#*`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        if (ttsSettings?.systemTtsVoiceURI) {
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.voiceURI === ttsSettings.systemTtsVoiceURI);
            if (voice) utterance.voice = voice;
        } else if (ttsSettings?.speechLanguage) { utterance.lang = ttsSettings.speechLanguage; }
        const rateVal = (ttsSettings?.ttsRate || 0);
        const pitchVal = (ttsSettings?.ttsPitch || 0);
        utterance.rate = 1 + (rateVal / 200);
        utterance.pitch = 1 + (pitchVal / 200);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        setIsPlaying(true);
        window.speechSynthesis.speak(utterance);
    };
    const sizeClasses = size === 'small' ? 'p-1.5 text-xs' : 'p-2';
    return (
        <button onClick={handleSpeak} className={`${sizeClasses} rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isPlaying ? 'text-blue-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`} title={isPlaying ? "停止朗读" : "朗读"}>
            <i className={`fas ${isPlaying ? 'fa-stop-circle' : 'fa-volume-up'}`}></i>
        </button>
    );
};

// --- 【翻译新组件】TranslationCard & TranslationResults ---
const TranslationCard = ({ result, ttsSettings }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(result.translation);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="bg-white dark:bg-gray-700 border border-gray-200/50 dark:border-gray-600/50 shadow-[0_2px_8px_rgba(0,0,0,0.06)] rounded-lg p-3 flex flex-col gap-2 transition-all duration-200 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex justify-between items-start">
                <p className="text-gray-800 dark:text-gray-100 text-base leading-relaxed flex-grow mr-2">{result.translation}</p>
                <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full shrink-0">{result.style}</span>
            </div>
            <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                <i className="fas fa-undo-alt mr-1.5 opacity-60"></i>{result.back_translation}
            </p>
            <div className="flex items-center gap-1 -ml-1.5 mt-1">
                <AiTtsButton text={result.translation} ttsSettings={ttsSettings} size="small" />
                <button onClick={handleCopy} className="p-1.5 text-xs rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10" title="复制">
                    <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                </button>
            </div>
        </div>
    );
};
const TranslationResults = ({ results, settings }) => {
    return (
        <div className="flex flex-col gap-2.5">
            {(results || []).map((result, index) => (
                <TranslationCard key={index} result={result} ttsSettings={settings} />
            ))}
        </div>
    );
};

// --- 【子组件】SimpleMarkdown ---
const SimpleMarkdown = ({ text }) => { if (!text) return null; return <div><p>{text}</p></div>; };

// --- 【子组件】MessageBubble ---
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => {
    const isUser = msg.role === 'user';
    const userBubbleClass = 'bg-blue-500 text-white rounded-br-lg shadow-[0_5px_15px_rgba(59,130,246,0.3),_0_12px_28px_rgba(59,130,246,0.2)]';
    const aiBubbleClass = 'bg-transparent border-none shadow-none';
    const hasTranslations = msg.translations && msg.translations.length > 0;

    return (
        <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col transition-shadow duration-300 ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}>
                {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">{msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)}</div>
                )}
                {hasTranslations ? (
                    <TranslationResults results={msg.translations} settings={settings} />
                ) : (
                    <>
                        <div className={`prose prose-sm max-w-none prose-p:my-1 ${isUser ? 'prose-white' : 'text-gray-900 dark:text-gray-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.05)]'}`}>
                            <SimpleMarkdown text={msg.content || ''} />
                        </div>
                        {!isUser && isLastAiMessage && !msg.isTyping && (
                             <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400">
                                <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button>
                            </div>
                        )}
                    </>
                )}
            </div>
            {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200" />}
        </div>
    );
};


// --- 【子组件】ChatSidebar ---
const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };
    const renderConversationItem = (conv) => (
        <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer transition-all duration-200 ${currentId === conv.id ? 'bg-blue-500/10' : 'hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`} onClick={() => onSelect(conv.id)}>
            <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}>
                {editingId === conv.id ? ( <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b border-gray-400 dark:border-gray-500" autoFocus /> ) : ( <span className={`text-sm ${currentId === conv.id ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}>{conv.title}</span> )}
            </div>
            <div className={`flex items-center shrink-0 space-x-1 transition-opacity ${currentId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600" title="重命名"><i className="fas fa-pen w-3 h-3"></i></button>
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-2 rounded-full text-red-500 hover:bg-red-500/10" title="删除"><i className="fas fa-trash w-3 h-3"></i></button>
            </div>
        </div>
    );
    return (
        <div className={`absolute lg:relative h-full bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-md flex flex-col transition-all duration-300 z-30 ${isOpen ? 'w-60 p-3 shadow-[10px_0px_20px_rgba(0,0,0,0.1)]' : 'w-0 p-0'} overflow-hidden`}>
            <button onClick={onNew} className="flex items-center justify-center w-full px-4 py-2 mb-3 font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-full shadow-lg shadow-gray-300/20 dark:shadow-black/20 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all duration-200 border border-gray-200 dark:border-gray-700"> <i className="fas fa-plus mr-2"></i> 新翻译 </button>
            <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
                {(conversations || []).map(renderConversationItem)}
            </div>
        </div>
    );
};


// --- 【子组件】SettingsModal & Sub-pages ---
const SubPageWrapper = ({ title, onBack, children }) => ( <div className="p-6 h-full flex flex-col bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"> <h3 className="text-2xl font-bold mb-4 shrink-0">{title}</h3> <div className="flex-grow overflow-y-auto pr-2">{children}</div> <button onClick={onBack} className="fixed bottom-8 right-8 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center z-10 hover:bg-gray-900 active:scale-95 transition-all"> <i className="fas fa-arrow-left text-xl"></i> </button> </div> );
const ApiKeyManager = ({ apiKeys, activeApiKeyId, onChange, onAdd, onDelete, onSetActive }) => ( <> {(apiKeys || []).map(k => ( <div key={k.id} className={`p-3 rounded-md border-2 ${activeApiKeyId === k.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}> <div className="flex items-center justify-between mb-2"> <select value={k.provider} onChange={(e) => onChange(k.id, 'provider', e.target.value)} className="font-semibold bg-transparent text-lg"> <option value="gemini">Google Gemini</option> <option value="openai">OpenAI 兼容</option> </select> <div className="flex items-center gap-2"> <button onClick={() => onSetActive(k.id)} disabled={activeApiKeyId === k.id} className="px-2 py-1 text-xs bg-green-500 text-white rounded disabled:bg-gray-400">设为当前</button> <button onClick={() => onDelete(k.id)} className="p-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> </div> {k.provider === 'openai' && ( <div className="mt-2"> <label className="text-xs font-medium">API 接口地址 (URL)</label> <input type="text" value={k.url || ''} onChange={(e) => onChange(k.id, 'url', e.target.value)} placeholder="例如: https://api.openai.com/v1" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> )} {k.provider === 'gemini' && ( <div className="mt-2"> <label className="text-xs font-medium">API 接口地址 (官方)</label> <p className="w-full mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 border dark:border-gray-500 rounded-md text-xs text-gray-500 dark:text-gray-400 truncate">https://generativelanguage.googleapis.com</p> </div> )} <div className="mt-2"> <label className="text-xs font-medium">API 密钥 (Key)</label> <input type="password" value={k.key} onChange={(e) => onChange(k.id, 'key', e.target.value)} placeholder="请输入密钥" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-indigo-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新密钥</button> </> );
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [view, setView] = useState('main');
    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddApiKey = () => { const newKey = { id: generateSimpleId('key'), provider: 'gemini', key: '', url: 'https://generativelanguage.googleapis.com/v1beta/models/' }; const newKeys = [...(tempSettings.apiKeys || []), newKey]; handleChange('apiKeys', newKeys); };
    const handleDeleteApiKey = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newKeys = (tempSettings.apiKeys || []).filter(k => k.id !== idToDelete); handleChange('apiKeys', newKeys); if (tempSettings.activeApiKeyId === idToDelete) handleChange('activeApiKeyId', newKeys[0]?.id || ''); };
    const handleApiKeySettingChange = (keyId, field, value) => { const newKeys = (tempSettings.apiKeys || []).map(k => k.id === keyId ? { ...k, [field]: value } : k); handleChange('apiKeys', newKeys); };
    const handleSetActiveApiKey = (keyId) => { handleChange('activeApiKeyId', keyId); };
    const commonInputClasses = 'w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md';
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10002] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}>
                {view === 'main' && (
                    <div className="p-6 h-full flex flex-col">
                        <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3>
                        <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                            <button type="button" onClick={() => setView('apiKeys')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><h4 className="text-lg font-bold">API 密钥管理</h4><i className='fas fa-arrow-right'></i></button>
                             <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-3"><label className="block text-sm font-medium">高级参数</label><div className="flex items-center gap-4"><label className="text-sm shrink-0">温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div><div><div className="flex items-center justify-between"><label htmlFor="thinking-mode-toggle" className="block text-sm font-medium">关闭 2.5 系列模型思考模式</label><input id="thinking-mode-toggle" type="checkbox" checked={tempSettings.disableThinkingMode} onChange={(e) => handleChange('disableThinkingMode', e.target.checked)} className="h-5 w-5 text-blue-500 rounded cursor-pointer" /></div><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">开启后可大幅提升响应速度和降低成本，但可能影响复杂问题的回答质量。</p></div></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-blue-600 text-white rounded-md">保存</button></div>
                    </div>
                )}
                {view === 'apiKeys' && <SubPageWrapper title="API 密钥管理" onBack={() => setView('main')}><ApiKeyManager apiKeys={tempSettings.apiKeys} activeApiKeyId={tempSettings.activeApiKeyId} onChange={handleApiKeySettingChange} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} onSetActive={handleSetActiveApiKey} /></SubPageWrapper>}
            </div>
        </div>
    );
};


// --- 【核心组件】AiChatContent ---
const AiChatContent = ({ onClose }) => {
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('my-MM');

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const recognitionRef = useRef(null);
    const pressTimerRef = useRef(null);
    const handleSubmitRef = useRef();

    useEffect(() => {
        setIsMounted(true);
        let finalSettings = { ...DEFAULT_SETTINGS };
        const savedSettings = safeLocalStorageGet('ai_chat_settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            finalSettings = { ...DEFAULT_SETTINGS, ...parsed, prompts: DEFAULT_PROMPTS, currentPromptId: TRANSLATION_PROMPT.id };
        }
        setSettings(finalSettings);
        const savedConversations = safeLocalStorageGet('ai_chat_conversations');
        const parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
        setConversations(parsedConvs);
        if (finalSettings.startWithNewChat || parsedConvs.length === 0) { createNewConversation(finalSettings.currentPromptId, true); } else { setCurrentConversationId(parsedConvs[0]?.id); }
    }, []);

    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings)); safeLocalStorageSet('ai_chat_conversations', JSON.stringify(conversations)); } }, [settings, conversations, isMounted]);
    const scrollToBottom = useCallback((behavior = 'smooth') => { messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' }); }, []);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('auto'), 100); return () => clearTimeout(timeout); }, [currentConversationId, scrollToBottom]);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('smooth'), 100); return () => clearTimeout(timeout); }, [currentConversation?.messages?.length]);

    const createNewConversation = () => { const newId = generateSimpleId('conv'); const newConv = { id: newId, title: '新的翻译', messages: [{ role: 'ai', content: TRANSLATION_PROMPT.openingLine || '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: TRANSLATION_PROMPT.id }; setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleSelectConversation = (id) => { setCurrentConversationId(id); setIsSidebarOpen(false); };
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { handleSelectConversation(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };

    const handleSwapLanguages = () => { if (sourceLang === 'auto') return; setSourceLang(targetLang); setTargetLang(sourceLang); };
    const getLangName = (code) => SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;

    const startListening = useCallback((langCode) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; }
        if (recognitionRef.current) { recognitionRef.current.abort(); }
        const recognition = new SpeechRecognition();
        const speechLang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.speechCode || 'zh-CN';
        recognition.lang = speechLang;
        recognition.interimResults = true;
        recognition.continuous = false;
        recognitionRef.current = recognition;
        recognition.onstart = () => { setIsListening(true); setUserInput(''); };
        recognition.onresult = (event) => { const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join(''); setUserInput(transcript); if (event.results[0].isFinal && transcript.trim()) { handleSubmitRef.current(false, transcript); } };
        recognition.onerror = (event) => { console.error("Speech error:", event.error); setError(`语音识别失败: ${event.error}`); };
        recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
        recognition.start();
    }, []);

    const handleMicPress = () => { clearTimeout(pressTimerRef.current); pressTimerRef.current = setTimeout(() => { const newSource = sourceLang === 'zh-CN' ? 'my-MM' : 'zh-CN'; setSourceLang(newSource); alert(`语音输入已切换到: ${getLangName(newSource)}`); }, 700); };
    const handleMicRelease = () => { clearTimeout(pressTimerRef.current); };
    const handleMicClick = () => { if (isListening) { recognitionRef.current?.stop(); } else { startListening(sourceLang === 'auto' ? 'zh-CN' : sourceLang); } };

    const fetchAiResponse = async (messagesForApi) => {
        setIsLoading(true); setError('');
        abortControllerRef.current = new AbortController();
        const activeKey = (settings.apiKeys || []).find(k => k.id === settings.activeApiKeyId);
        try {
            if (!activeKey || !activeKey.key) throw new Error('请在“设置”中配置并激活一个有效的 API 密钥。');

            const systemPrompt = TRANSLATION_PROMPT.content;
            const lastUserMessage = messagesForApi[messagesForApi.length - 1];
            const userText = lastUserMessage.content;
            const requestPrompt = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(targetLang)}]:\n\n${userText}`;

            const history = messagesForApi.slice(0, -1).filter(msg => msg.content || msg.translations).map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content || "OK" }] }));
            const contents = [ { role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: "好的，我明白了。请给我需要翻译的文本和目标语言。" }] }, ...history, { role: 'user', parts: [{ text: requestPrompt }] }];

            const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens, responseMimeType: "application/json" };
            const modelToUse = settings.selectedModel;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${activeKey.key}`;
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal: abortControllerRef.current.signal });

            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败: ${response.status}`); }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');

            let aiMessage;
            try {
                const parsedTranslations = JSON.parse(aiResponseContent);
                if (Array.isArray(parsedTranslations) && parsedTranslations.length > 0 && 'translation' in parsedTranslations[0]) {
                    aiMessage = { role: 'ai', timestamp: Date.now(), translations: parsedTranslations };
                } else { throw new Error("返回的JSON格式不正确。"); }
            } catch(e) {
                aiMessage = { role: 'ai', content: `抱歉，解析翻译结果失败。原始内容: ${aiResponseContent}`, timestamp: Date.now() };
            }
            const finalMessages = [...messagesForApi, aiMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } catch (err) {
            const errorMessage = (err.name === 'AbortError') ? '请求被中断。' : `请求错误: ${err.message}`;
            setError(errorMessage);
            const finalMessages = [...messagesForApi, { role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() }];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally { setIsLoading(false); }
    };

    const handleSubmit = async (isRegenerate = false, textToSend = null) => {
        if (!currentConversation) return;
        let messagesForApi = [...currentConversation.messages];
        if (isRegenerate) {
            if (messagesForApi.length > 1 && messagesForApi[messagesForApi.length - 1].role === 'ai') {
                 messagesForApi.pop(); // remove last AI message
            }
        } else {
            const textToProcess = (textToSend !== null ? textToSend : userInput).trim();
            if (!textToProcess) { setError('请输入要翻译的内容！'); return; }
            const userMessage = { role: 'user', content: textToProcess, timestamp: Date.now() };
            messagesForApi = [...messagesForApi, userMessage];
            if (messagesForApi.length === 2 && currentConversation.title === '新的翻译') {
                 handleRenameConversation(currentConversationId, textToProcess.substring(0, 20));
            }
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: messagesForApi } : c));
            setUserInput('');
        }
        await fetchAiResponse(messagesForApi);
    };
    handleSubmitRef.current = handleSubmit;

    if (!isMounted) return null;
    const showSendButton = userInput.trim().length > 0;

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-white dark:bg-[#18171d] text-gray-800 dark:text-gray-200 overflow-hidden relative">
            <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100 }}></div>
            <div className="absolute inset-0 bg-white/30 dark:bg-black/40 z-0"></div>

            <header className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white/80 dark:bg-[#18171d]/90 backdrop-blur-md z-10 safe-top">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 transition-colors"><i className="fas fa-chevron-down text-gray-600 dark:text-gray-300"></i></button>
                    <button onClick={() => setIsSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 transition-colors"><i className="fas fa-bars text-gray-600 dark:text-gray-300"></i></button>
                </div>
                <h3 className="font-bold text-lg truncate max-w-[150px]">{currentConversation?.title || '翻译'}</h3>
                <div className="flex items-center gap-2">
                     <button onClick={() => setShowSettings(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 transition-colors"><i className="fas fa-cog text-gray-600 dark:text-gray-300"></i></button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative z-0 flex">
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} onNew={() => { createNewConversation(); setIsSidebarOpen(false); }} prompts={settings.prompts} settings={settings} />
                {isSidebarOpen && <div className="absolute inset-0 bg-black/20 z-20 lg:hidden" onClick={()=>setIsSidebarOpen(false)}></div>}

                <div className="flex-1 flex flex-col h-full relative">
                    <div className="flex-1 overflow-y-auto p-4 space-y-1">
                        {currentConversation?.messages.map((msg, index) => ( <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} /> </div> ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <footer className="shrink-0 bg-white/90 dark:bg-[#18171d]/90 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3 pb-[max(12px,env(safe-area-inset-bottom))] z-20">
                        {error && <div className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded" onClick={()=>setError('')}>{error} (点击关闭)</div>}

                        <div className="flex items-center justify-center gap-3 mb-2">
                           <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="bg-gray-200/50 dark:bg-gray-700/50 rounded-full px-4 py-1.5 text-sm font-semibold border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition outline-none">
                                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                           </select>
                           <button onClick={handleSwapLanguages} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-transform active:rotate-180 disabled:opacity-50" disabled={sourceLang === 'auto'}>
                               <i className="fas fa-exchange-alt text-gray-600 dark:text-gray-300"></i>
                           </button>
                           <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-gray-200/50 dark:bg-gray-700/50 rounded-full px-4 py-1.5 text-sm font-semibold border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition outline-none">
                                {SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                           </select>
                        </div>

                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit()}} className="flex items-end gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-[28px] shadow-inner border border-transparent focus-within:border-blue-500/30 transition-all">
                            <textarea
                                value={userInput}
                                onChange={e=>setUserInput(e.target.value)}
                                placeholder={isListening ? "正在聆听..." : "输入要翻译的内容..."}
                                className="flex-1 bg-transparent max-h-48 min-h-[48px] py-3 px-2 resize-none outline-none text-base leading-6 dark:placeholder-gray-500"
                                rows={1}
                                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                            />
                            {!showSendButton ? (
                                <button type="button"
                                    onClick={handleMicClick}
                                    onMouseDown={handleMicPress}
                                    onMouseUp={handleMicRelease}
                                    onTouchStart={handleMicPress}
                                    onTouchEnd={handleMicRelease}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                                    <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone-alt'} text-xl`}></i>
                                </button>
                            ) : (
                                <button type="submit" disabled={isLoading} className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                                    {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-arrow-up"></i>}
                                </button>
                            )}
                        </form>
                    </footer>
                </div>
            </div>

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};


// --- 【导出组件】AIChatDrawer (全屏弹窗包装器) ---
const AIChatDrawer = ({ isOpen, onClose }) => {
    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-in-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in-out duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <Transition.Child as={Fragment} enter="transform transition ease-in-out duration-300" enterFrom="translate-y-full" enterTo="translate-y-0" leave="transform transition ease-in-out duration-300" leaveFrom="translate-y-0" leaveTo="translate-y-full">
                            <Dialog.Panel className="pointer-events-auto w-screen h-full">
                                <AiChatContent onClose={onClose} />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

export default AIChatDrawer;
