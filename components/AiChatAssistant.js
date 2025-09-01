// /components/AiChatAssistant.js - v57.1 (修复版 - 恢复激活流程并加固)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// 确保您的 AiTtsButton 组件也已更新以支持新引擎
import AiTtsButton from './AiTtsButton'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// --- 轻量级滑动手势Hook (无变化) ---
const useSimpleSwipe = ({ onSwipeLeft, onSwipeRight }) => {
    const touchStart = useRef({ x: 0, y: 0 });
    const touchEnd = useRef({ x: 0, y: 0 });
    const minSwipeDistance = 60;

    const onTouchStart = (e) => {
        touchEnd.current = { x: 0, y: 0 };
        touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
    };

    const onTouchMove = (e) => {
        touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
    };

    const onTouchEnd = () => {
        if (!touchStart.current.x || !touchEnd.current.x) return;
        const xDistance = touchStart.current.x - touchEnd.current.x;
        const yDistance = touchStart.current.y - touchEnd.current.y;
        if (Math.abs(xDistance) < Math.abs(yDistance)) return;
        if (xDistance > minSwipeDistance) {
            if (onSwipeLeft) onSwipeLeft();
        } else if (xDistance < -minSwipeDistance) {
            if (onSwipeRight) onSwipeRight(); // 从左向右滑动
        }
        touchStart.current = { x: 0, y: 0 };
        touchEnd.current = { x: 0, y: 0 };
    };
    return { onTouchStart, onTouchMove, onTouchEnd };
};

// --- 辅助函数 (无变化) ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const safeLocalStorageRemove = (key) => { if (typeof window !== 'undefined') { localStorage.removeItem(key); } };

// --- 常量定义 (更新) ---
export const TTS_ENGINE = { SYSTEM: 'system', MICROSOFT: 'microsoft', OPENAI: 'openai', GOOGLE: 'google' };
const API_TYPES = { GEMINI: 'gemini', OPENAI: 'openai' };

const CHAT_MODELS_LIST = [
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContext: 8192 },
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContext: 8192 },
    { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest', maxContext: 8192 },
    { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest', maxContext: 8192 },
    { name: 'GPT-4o (OpenAI 兼容)', value: 'gpt-4o', maxContext: 8192 },
    { name: 'GPT-3.5 Turbo (OpenAI 兼容)', value: 'gpt-3.5-turbo', maxContext: 4096 },
];
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '', isDefault: true },
    { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '', isDefault: true },
    { id: 'translate-myanmar', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '', isDefault: true }
];
const DEFAULT_SETTINGS = {
    apiKeys: [{ id: 'default-gemini', name: '默认 Gemini Key', key: '', type: API_TYPES.GEMINI }],
    selectedApiKeyId: 'default-gemini',
    openaiCompatibleEndpoint: '',
    selectedModel: 'gemini-2.5-flash',
    chatModels: CHAT_MODELS_LIST,
    temperature: 0.8,
    maxOutputTokens: 2048,
    disableThinkingMode: true,
    startWithNewChat: false,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: TTS_ENGINE.MICROSOFT,
    microsoftTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    openaiTtsSettings: { apiKey: '', model: 'tts-1', voice: 'alloy' },
    googleTtsSettings: { apiKey: '', model: 'text-to-speech', voice: 'zh-CN-Wavenet-A' },
    systemTtsVoiceURI: '',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg-2.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
    isFacebookApp: false,
};
// 注意：Local Storage 的 Key 已更新，以避免与旧的、可能不兼容的设置冲突
const SETTINGS_STORAGE_KEY = 'ai_assistant_settings_v57';
const CONVERSATIONS_STORAGE_KEY = 'ai_assistant_conversations_v57';
const ACTIVATION_KEY_STORAGE = 'ai_assistant_key_v57';

// --- 子组件 (与上一版相同，无需修改) ---
const TypingEffect = ({ text, onComplete }) => { const [displayedText, setDisplayedText] = useState(''); useEffect(() => { if (!text) return; setDisplayedText(''); let index = 0; const intervalId = setInterval(() => { setDisplayedText(prev => prev + text.charAt(index)); index++; if (index >= text.length) { clearInterval(intervalId); if (onComplete) onComplete(); } }, 30); return () => clearInterval(intervalId); }, [text, onComplete]); return <SimpleMarkdown text={displayedText} />; };
const SimpleMarkdown = ({ text }) => { if (!text) return null; const lines = text.split('\n').map((line, index) => { if (line.trim() === '') return <br key={index} />; if (line.match(/\*\*(.*?)\*\*/)) { const content = line.replace(/\*\*/g, ''); return <strong key={index} className="block mt-2 mb-1">{content}</strong>; } if (line.startsWith('* ') || line.startsWith('- ')) { return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>; } return <p key={index} className="my-1">{line}</p>; }); return <div>{lines}</div>; };
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate, onTypingComplete }) => { const isUser = msg.role === 'user'; const userBubbleClass = 'bg-primary text-white rounded-br-lg shadow-md'; const aiBubbleClass = 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-md'; return ( <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}> {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />} <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}> {msg.images && msg.images.length > 0 && ( <div className="flex flex-wrap gap-2 mb-2"> {msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)} </div> )} <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1"> {isLastAiMessage && msg.isTyping ? <TypingEffect text={msg.content || ''} onComplete={onTypingComplete} /> : <SimpleMarkdown text={msg.content || ''} />} </div> {!isUser && msg.content && !msg.isTyping && ( <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400"> {settings.isFacebookApp && <span className="text-sm text-red-400" title="Facebook App内浏览器不支持语音功能">语音不可用</span>} {!settings.isFacebookApp && <AiTtsButton text={msg.content} ttsSettings={settings} />} <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button> {isLastAiMessage && ( <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button> )} </div> )} </div> {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />} </div> ); };
const ConversationMenu = ({ onRename, onDelete }) => ( <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-10"> <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-pen w-4"></i>重命名</button> <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-trash"></i></button> </div> );
const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => { const [editingId, setEditingId] = useState(null); const [newName, setNewName] = useState(''); const [activeMenu, setActiveMenu] = useState(null); const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); setActiveMenu(null); }; const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); }; const groupedConversations = useMemo(() => { const groups = new Map(); const uncategorized = []; (conversations || []).forEach(conv => { const promptId = conv.promptId; const prompt = (prompts || []).find(p => p.id === promptId); if (prompt) { if (!groups.has(promptId)) { groups.set(promptId, { prompt, conversations: [] }); } groups.get(promptId).conversations.push(conv); } else { uncategorized.push(conv); } }); return { sortedGroups: Array.from(groups.values()), uncategorized }; }, [conversations, prompts]); const renderConversationItem = (conv) => ( <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={(e) => { e.stopPropagation(); onSelect(conv.id); setActiveMenu(null); }}> <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}> {editingId === conv.id ? ( <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus /> ) : ( <span className="text-sm">{conv.title}</span> )} </div> <div className="relative shrink-0"> <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === conv.id ? null : conv.id); }} className={`p-1 rounded-full ${currentId === conv.id || activeMenu === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}> <i className="fas fa-ellipsis-h text-xs"></i> </button> {activeMenu === conv.id && ( <ConversationMenu onRename={() => handleRename(conv.id, conv.title)} onDelete={() => { if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); setActiveMenu(null); }} /> )} </div> </div> ); return ( <div className={`h-full bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-44 p-2' : 'w-0 p-0'} overflow-hidden`}> <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"> <span>新对话</span><i className="fas fa-plus"></i> </button> <div className="flex-grow overflow-y-auto space-y-2"> {groupedConversations.sortedGroups.map(({ prompt, conversations }) => ( <details key={prompt.id} className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <img src={convertGitHubUrl(prompt.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={prompt.name} className="w-5 h-5 rounded-full object-cover"/> <span className="text-xs font-semibold flex-grow">{prompt.name}</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(conversations || []).map(renderConversationItem)} </div> </details> ))} {groupedConversations.uncategorized.length > 0 && ( <details className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <i className="fas fa-folder w-5 h-5 text-gray-500"></i> <span className="text-xs font-semibold flex-grow">未分类对话</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(groupedConversations.uncategorized || []).map(renderConversationItem)} </div> </details> )} </div> </div> ); };
const PromptManager = ({ prompts, onBack, onChange, onAdd, onDelete, settings, microsoftTtsVoices }) => { const swipeHandlers = useSimpleSwipe({ onSwipeRight: onBack }); return ( <div {...swipeHandlers} className="fixed inset-0 bg-white dark:bg-gray-800 p-6 flex flex-col z-[9999] animate-fade-in"> <div className="flex items-center justify-between mb-4 shrink-0"> <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left"></i></button> <h3 className="text-2xl font-bold">提示词工作室</h3> <div className="w-8"></div> </div> <div className="flex-grow overflow-y-auto pr-2 space-y-3"> {(prompts || []).map(p => ( <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700"> <div className="flex items-center justify-between"> <label className="flex items-center flex-grow cursor-pointer gap-2"> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-6 h-6 rounded-full object-cover"/> <input type="text" value={p.name} onChange={(e) => onChange(p.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full text-lg" /> </label> <button onClick={() => onDelete(p.id)} disabled={p.isDefault} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"><i className="fas fa-trash"></i></button> </div> <textarea value={p.isDefault ? '默认助理提示词内容已隐藏，防止被盗取。' : p.content} onChange={(e) => onChange(p.id, 'content', e.target.value)} disabled={p.isDefault} placeholder="请输入提示词内容..." className="w-full mt-2 h-24 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700/50" /> <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"> <div><label className="text-xs font-medium">模型:</label><select value={p.model || settings.selectedModel} onChange={(e) => onChange(p.id, 'model', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">{(settings.chatModels || []).map(m => <option key={m.value} value={m.value}>{m.name}</option>)}</select></div> <div><label className="text-xs font-medium">声音:</label><select value={p.ttsVoice || settings.microsoftTtsVoice} onChange={(e) => onChange(p.id, 'ttsVoice', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">{(microsoftTtsVoices || []).map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div> <div><label className="text-xs font-medium">头像 URL:</label><input type="text" value={p.avatarUrl || ''} onChange={(e) => onChange(p.id, 'avatarUrl', e.target.value)} placeholder="输入头像图片URL" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" /></div> </div> </div> ))} </div> <button onClick={onAdd} className="w-full mt-4 py-2 bg-green-500 text-white rounded-md shrink-0"><i className="fas fa-plus mr-2"></i>添加新提示词</button> </div> );}
const KeyManager = ({ keys, selectedKeyId, onBack, onKeyChange, onKeyAdd, onKeyDelete, onSelectKey }) => { const swipeHandlers = useSimpleSwipe({ onSwipeRight: onBack }); return ( <div {...swipeHandlers} className="fixed inset-0 bg-white dark:bg-gray-800 p-6 flex flex-col z-[9999] animate-fade-in"> <div className="flex items-center justify-between mb-4 shrink-0"> <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left"></i></button> <h3 className="text-2xl font-bold">API 密钥管理</h3> <div className="w-8"></div> </div> <div className="flex-grow overflow-y-auto pr-2 space-y-3"> {(keys || []).map(k => ( <div key={k.id} className={`p-3 rounded-md border ${selectedKeyId === k.id ? 'border-primary bg-primary/10' : 'bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700'}`}> <div className="flex items-center justify-between"> <input type="text" value={k.name} placeholder="密钥名称" onChange={(e) => onKeyChange(k.id, 'name', e.target.value)} className="font-semibold bg-transparent w-1/3 text-lg" /> <select value={k.type} onChange={(e) => onKeyChange(k.id, 'type', e.target.value)} className="mx-2 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm"> <option value={API_TYPES.GEMINI}>Google Gemini</option> <option value={API_TYPES.OPENAI}>OpenAI 兼容</option> </select> <div className="flex items-center"> <button onClick={() => onSelectKey(k.id)} disabled={selectedKeyId === k.id} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md disabled:bg-gray-400">设为当前</button> <button onClick={() => onKeyDelete(k.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> </div> <input type="password" value={k.key} placeholder="输入 API Key" onChange={(e) => onKeyChange(k.id, 'key', e.target.value)} className="w-full mt-2 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" /> </div> ))} </div> <button onClick={onKeyAdd} className="w-full mt-4 py-2 bg-green-500 text-white rounded-md shrink-0"><i className="fas fa-plus mr-2"></i>添加新密钥</button> </div> ); };
const ModelManager = ({ models, onBack, onModelChange, onModelAdd, onModelDelete }) => { const swipeHandlers = useSimpleSwipe({ onSwipeRight: onBack }); return ( <div {...swipeHandlers} className="fixed inset-0 bg-white dark:bg-gray-800 p-6 flex flex-col z-[9999] animate-fade-in"> <div className="flex items-center justify-between mb-4 shrink-0"> <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left"></i></button> <h3 className="text-2xl font-bold">模型管理</h3> <div className="w-8"></div> </div> <div className="flex-grow overflow-y-auto pr-2 space-y-3"> {(models || []).map((m, index) => ( <div key={index} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700 grid grid-cols-3 gap-3 items-center"> <input type="text" value={m.name} placeholder="模型显示名称" onChange={(e) => onModelChange(index, 'name', e.target.value)} className="col-span-3 md:col-span-1 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" /> <input type="text" value={m.value} placeholder="模型 API 标识" onChange={(e) => onModelChange(index, 'value', e.target.value)} className="col-span-3 md:col-span-1 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" /> <div className="col-span-3 md:col-span-1 flex items-center gap-2"> <input type="number" value={m.maxContext} placeholder="上下文" onChange={(e) => onModelChange(index, 'maxContext', parseInt(e.target.value, 10) || 0)} className="w-full p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" title="最大上下文数量" /> <button onClick={() => onModelDelete(index)} className="p-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> </div> ))} </div> <button onClick={onModelAdd} className="w-full mt-4 py-2 bg-green-500 text-white rounded-md shrink-0"><i className="fas fa-plus mr-2"></i>添加新模型</button> </div> ); };
const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [systemVoices, setSystemVoices] = useState([]); const [view, setView] = useState('main'); useEffect(() => { const fetchSystemVoices = () => { if (!window.speechSynthesis) return; const voices = window.speechSynthesis.getVoices(); if (voices.length > 0) { setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi'))); } }; if (window.speechSynthesis) { if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; } fetchSystemVoices(); } }, []); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleAddPrompt = () => { const newPrompt = { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入...', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }; handleChange('prompts', [...(tempSettings.prompts || []), newPrompt]); }; const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = (tempSettings.prompts || []).filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); }; const handlePromptSettingChange = (promptId, field, value) => { handleChange('prompts', (tempSettings.prompts || []).map(p => p.id === promptId ? { ...p, [field]: value } : p)); }; const handleKeyChange = (id, field, value) => handleChange('apiKeys', tempSettings.apiKeys.map(k => k.id === id ? { ...k, [field]: value } : k)); const handleKeyAdd = () => handleChange('apiKeys', [...tempSettings.apiKeys, { id: `key-${Date.now()}`, name: '新密钥', key: '', type: API_TYPES.GEMINI }]); const handleKeyDelete = (id) => { if (tempSettings.apiKeys.length <= 1) { alert('至少需要保留一个密钥配置。'); return; } handleChange('apiKeys', tempSettings.apiKeys.filter(k => k.id !== id)); if (tempSettings.selectedApiKeyId === id) handleChange('selectedApiKeyId', tempSettings.apiKeys[0]?.id || ''); }; const handleModelChange = (index, field, value) => handleChange('chatModels', tempSettings.chatModels.map((m, i) => i === index ? { ...m, [field]: value } : m)); const handleModelAdd = () => handleChange('chatModels', [...tempSettings.chatModels, { name: '新模型', value: 'new-model', maxContext: 4096 }]); const handleModelDelete = (index) => handleChange('chatModels', tempSettings.chatModels.filter((_, i) => i !== index)); const microsoftTtsVoices = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' }, ]; const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ]; const swipeHandlers = useSimpleSwipe({ onSwipeRight: () => view === 'main' && onClose() }); return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}> <div {...swipeHandlers} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}> {view === 'main' && ( <div className="p-6 h-full flex flex-col"> <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3> <div className="space-y-4 flex-grow overflow-y-auto pr-2"> <div><label className="block text-sm font-medium mb-1">当前 API 密钥</label><select value={tempSettings.selectedApiKeyId} onChange={(e) => handleChange('selectedApiKeyId', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">{(tempSettings.apiKeys || []).map(k => <option key={k.id} value={k.id}>{k.name} ({k.type})</option>)}</select></div> <div><button type="button" onClick={() => setView('keys')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><h4 className="font-bold">API 密钥管理</h4><i className={`fas fa-arrow-right`}></i></button></div> <div><button type="button" onClick={() => setView('models')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><h4 className="font-bold">模型管理</h4><i className={`fas fa-arrow-right`}></i></button></div> <div><button type="button" onClick={() => setView('prompts')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><h4 className="font-bold">提示词工作室</h4><i className={`fas fa-arrow-right`}></i></button></div> <div><label className="block text-sm font-medium mb-1">OpenAI 兼容接口地址</label><input type="text" value={tempSettings.openaiCompatibleEndpoint} onChange={(e) => handleChange('openaiCompatibleEndpoint', e.target.value)} placeholder="例如: https://api.openai.com/v1" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" /></div> <div><label className="block text-sm font-medium mb-1">聊天背景图片 URL</label><input type="text" value={tempSettings.chatBackgroundUrl} onChange={(e) => handleChange('chatBackgroundUrl', e.target.value)} placeholder="https://..." className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" /></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">始终开启新对话</label><input type="checkbox" checked={tempSettings.startWithNewChat} onChange={(e) => handleChange('startWithNewChat', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div> <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-3"><label className="block text-sm font-medium">高级参数</label><div className="flex items-center gap-4"><label className="text-sm shrink-0">温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div><div><div className="flex items-center justify-between"><label htmlFor="thinking-mode-toggle" className="block text-sm font-medium">关闭 2.5 系列模型思考模式</label><input id="thinking-mode-toggle" type="checkbox" checked={tempSettings.disableThinkingMode} onChange={(e) => handleChange('disableThinkingMode', e.target.checked)} className="h-5 w-5 text-primary rounded cursor-pointer" /></div><p className="text-xs text-gray-500 mt-1">开启后可大幅提升响应速度和降低成本，但可能影响复杂问题的回答质量。</p></div></div> <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4"><h4 className="text-md font-semibold">朗读设置</h4><div><label className="block text-sm font-medium mb-1">朗读引擎</label><select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value={TTS_ENGINE.MICROSOFT}>微软 TTS (推荐)</option><option value={TTS_ENGINE.OPENAI}>OpenAI TTS</option><option value={TTS_ENGINE.GOOGLE}>Google TTS (暂未实现)</option><option value={TTS_ENGINE.SYSTEM}>系统内置</option></select></div> {tempSettings.ttsEngine === TTS_ENGINE.MICROSOFT && (<div><label className="block text-sm font-medium mb-1">发音人 (微软)</label><select value={tempSettings.microsoftTtsVoice} onChange={(e) => handleChange('microsoftTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">{microsoftTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div>)} {tempSettings.ttsEngine === TTS_ENGINE.OPENAI && (<div className='space-y-2'><input type="password" placeholder="OpenAI API Key" value={tempSettings.openaiTtsSettings.apiKey} onChange={e => setTempSettings(p => ({...p, openaiTtsSettings: {...p.openaiTtsSettings, apiKey: e.target.value}}))} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md" /><select value={tempSettings.openaiTtsSettings.voice} onChange={e => setTempSettings(p => ({...p, openaiTtsSettings: {...p.openaiTtsSettings, voice: e.target.value}}))} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value="alloy">Alloy</option><option value="echo">Echo</option><option value="fable">Fable</option><option value="onyx">Onyx</option><option value="nova">Nova</option><option value="shimmer">Shimmer</option></select></div>)} {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (<div><label className="block text-sm font-medium mb-1">发音人 (系统)</label>{systemVoices.length > 0 ? (<select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value="">浏览器默认</option>{systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}</select>) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}</div>)}</div> <div><label className="block text-sm font-medium mb-1">语音识别语言</label><select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">{speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">AI 回复后自动朗读</label><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div> </div> <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button></div> </div> )} {view === 'prompts' && (<PromptManager prompts={tempSettings.prompts} settings={tempSettings} onBack={() => setView('main')} onChange={handlePromptSettingChange} onAdd={handleAddPrompt} onDelete={handleDeletePrompt} microsoftTtsVoices={microsoftTtsVoices} />)} {view === 'keys' && (<KeyManager keys={tempSettings.apiKeys} selectedKeyId={tempSettings.selectedApiKeyId} onBack={() => setView('main')} onKeyChange={handleKeyChange} onKeyAdd={handleKeyAdd} onKeyDelete={handleKeyDelete} onSelectKey={(id) => handleChange('selectedApiKeyId', id)} />)} {view === 'models' && (<ModelManager models={tempSettings.chatModels} onBack={() => setView('main')} onModelChange={handleModelChange} onModelAdd={handleModelAdd} onModelDelete={handleModelDelete} />)} </div> </div> ); };
const ModelSelector = ({ settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b dark:border-gray-700 text-center relative"> <h3 className="text-lg font-bold">切换模型</h3> <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button> </div> <div className="p-2 overflow-y-auto max-h-[60vh]"> {(settings.chatModels || []).map(m => ( <button key={m.value} type="button" onClick={() => { onSelect(m.value); onClose(); }} className={`w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-primary/10 ${settings.selectedModel === m.value ? 'text-primary font-bold bg-primary/10' : ''}`}>{m.name}</button> ))} </div> </div> </div> );
const AssistantSelector = ({ prompts, settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-2xl m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b dark:border-gray-700 text-center relative"><h3 className="text-lg font-bold">更换助理</h3><button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button></div> <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh]"> {(prompts || []).map(p => ( <button key={p.id} onClick={() => onSelect(p.id)} className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${settings.currentPromptId === p.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-16 h-16 rounded-full object-cover mb-2 shadow-md"/> <span className="text-sm font-semibold text-center">{p.name}</span> </button> ))} </div> </div> </div> );


const AiChatAssistant = ({ onClose }) => {
    // --- 状态管理 (已恢复激活相关状态) ---
    const [activationState, setActivationState] = useState('checking'); const [activationKey, setActivationKey] = useState(''); const [activationError, setActivationError] = useState(''); const [isActivating, setIsActivating] = useState(false); const [keyType, setKeyType] = useState(null); const [trialExpiryInfo, setTrialExpiryInfo] = useState(''); const [trialExpiryTimestamp, setTrialExpiryTimestamp] = useState(0);
    const [conversations, setConversations] = useState([]); const [currentConversationId, setCurrentConversationId] = useState(null); const [userInput, setUserInput] = useState(''); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState(''); const [settings, setSettings] = useState(DEFAULT_SETTINGS); const [showSettings, setShowSettings] = useState(false); const [isMounted, setIsMounted] = useState(false); const [isSidebarOpen, setIsSidebarOpen] = useState(false); const [showAssistantSelector, setShowAssistantSelector] = useState(false); const [showModelSelector, setShowModelSelector] = useState(false); const [selectedImages, setSelectedImages] = useState([]); const [isListening, setIsListening] = useState(false);
    
    const messagesEndRef = useRef(null); const abortControllerRef = useRef(null); const fileInputRef = useRef(null); const cameraInputRef = useRef(null); const recognitionRef = useRef(null); const textareaRef = useRef(null);
    
    // --- 初始化和数据持久化逻辑 (已恢复激活流程) ---
    const getDeviceId = async () => { try { const fp = await FingerprintJS.load(); const result = await fp.get(); return result.visitorId; } catch (e) { console.error("FingerprintJS error:", e); return 'fallback-device-id-' + Date.now(); } };
    
    useEffect(() => {
        const initializeApp = async () => {
            setIsMounted(true);
            let finalSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            const savedSettings = safeLocalStorageGet(SETTINGS_STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                finalSettings = { ...finalSettings, ...parsed, apiKeys: parsed.apiKeys && parsed.apiKeys.length > 0 ? parsed.apiKeys : finalSettings.apiKeys, chatModels: parsed.chatModels && parsed.chatModels.length > 0 ? parsed.chatModels : finalSettings.chatModels, prompts: (parsed.prompts || []).map(p => ({ ...p, isDefault: DEFAULT_PROMPTS.some(dp => dp.id === p.id) })), };
            }
            if (typeof navigator !== 'undefined' && /FBAN|FBAV/i.test(navigator.userAgent)) {
                finalSettings.isFacebookApp = true;
            }
            setSettings(finalSettings);

            const savedConversations = safeLocalStorageGet(CONVERSATIONS_STORAGE_KEY);
            const parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
            setConversations(parsedConvs);

            // --- [已恢复] 激活逻辑 ---
            setActivationState('checking');
            try {
                const deviceId = await getDeviceId();
                const storedKey = safeLocalStorageGet(ACTIVATION_KEY_STORAGE);
                let activated = false;
                if (storedKey) {
                    const response = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: storedKey, deviceId }), });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        setActivationState('activated');
                        setKeyType(data.keyType);
                        if (data.keyType === 'trial') {
                            const expiryTime = data.activatedAt + (data.durationSeconds || 0) * 1000;
                            setTrialExpiryTimestamp(expiryTime);
                        } else {
                            setTrialExpiryInfo('永久授权');
                        }
                        activated = true;
                    } else {
                        safeLocalStorageRemove(ACTIVATION_KEY_STORAGE);
                        setActivationError(data.message || '本地激活码已失效。');
                    }
                }
                if (!activated) {
                    const trialResponse = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_trial', deviceId }), });
                    const trialData = await trialResponse.json();
                    if (trialResponse.ok && trialData.success) {
                        safeLocalStorageSet(ACTIVATION_KEY_STORAGE, trialData.key);
                        setActivationState('activated');
                        setKeyType(trialData.keyType);
                        const expiryTime = trialData.activatedAt + (trialData.durationSeconds || 0) * 1000;
                        setTrialExpiryTimestamp(expiryTime);
                    } else {
                        setActivationState('unactivated');
                        setActivationError(trialData.message || '无法自动开始试用。');
                    }
                }
            } catch (error) {
                setActivationState('unactivated');
                setActivationError('网络错误，无法连接到激活服务器。');
            }
            // --- 激活逻辑结束 ---

            if (finalSettings.startWithNewChat || parsedConvs.length === 0) {
                createNewConversation(finalSettings.currentPromptId);
            } else {
                setCurrentConversationId(parsedConvs[0].id);
            }
        };
        initializeApp();
    }, []);

    useEffect(() => {
        let timer;
        if (keyType === 'trial' && trialExpiryTimestamp > 0) {
            timer = setInterval(() => {
                const remainingMillis = trialExpiryTimestamp - Date.now();
                if (remainingMillis <= 0) {
                    setTrialExpiryInfo('试用期已结束');
                    setActivationState('unactivated');
                    safeLocalStorageRemove(ACTIVATION_KEY_STORAGE);
                    clearInterval(timer);
                } else {
                    const totalSeconds = Math.max(0, Math.floor(remainingMillis / 1000));
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    setTrialExpiryInfo(`试用中: ${minutes}分${seconds < 10 ? '0' : ''}${seconds}秒`);
                }
            }, 1000);
        } else if (keyType === 'permanent') {
            setTrialExpiryInfo('永久授权');
        }
        return () => { if (timer) clearInterval(timer); };
    }, [keyType, trialExpiryTimestamp]);
    
    useEffect(() => { if (isMounted) { safeLocalStorageSet(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); safeLocalStorageSet(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations)); } }, [settings, conversations, isMounted]);

    const scrollToBottom = useCallback(() => { setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }, []);
    useEffect(scrollToBottom, [conversations, currentConversationId]);

    const lastAutoReadMessageId = useRef(null);
    useEffect(() => { if (!currentConversation || !settings.autoRead || !isMounted || activationState !== 'activated') return; const lastMessage = currentConversation.messages[currentConversation.messages.length - 1]; if (lastMessage && lastMessage.role === 'ai' && lastMessage.content && !lastMessage.isTyping && lastMessage.timestamp > (lastAutoReadMessageId.current || 0)) { lastAutoReadMessageId.current = lastMessage.timestamp; setTimeout(() => { const bubble = document.getElementById(`msg-${currentConversation.id}-${currentConversation.messages.length - 1}`); if (bubble && document.body.contains(bubble)) { bubble.querySelector('button[title="朗读"]')?.click(); } }, 300); } }, [currentConversation?.messages, settings.autoRead, isMounted, currentConversation?.id, activationState]);
    
    const adjustTextareaHeight = useCallback(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, []);
    useEffect(adjustTextareaHeight, [userInput]);

    const createNewConversation = (promptId) => { const newId = `conv-${Date.now()}`; const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: promptId || settings.currentPromptId }; setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleSelectConversation = (id) => setCurrentConversationId(id);
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { setCurrentConversationId(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleImageUpload = (e) => { const files = Array.from(e.target.files); if (!files.length) return; const imagePromises = files.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve({ data: reader.result.split(',')[1], previewUrl: reader.result, type: file.type }); reader.onerror = reject; reader.readAsDataURL(file); })); Promise.all(imagePromises).then(newImages => setSelectedImages(prev => [...prev, ...newImages])); e.target.value = ''; };
    const handleRemoveImage = (indexToRemove) => setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    const startListening = useCallback(() => { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; } if (recognitionRef.current) recognitionRef.current.abort(); const recognition = new SpeechRecognition(); recognition.lang = settings.speechLanguage; recognition.onstart = () => setIsListening(true); recognition.onresult = (e) => setUserInput(e.results[0][0].transcript.trim()); recognition.onerror = (event) => { console.error("Speech recognition error:", event.error); setError(`语音识别失败: ${event.error}`); setIsListening(false); }; recognition.onend = () => setIsListening(false); recognition.start(); recognitionRef.current = recognition; }, [settings.speechLanguage]);
    const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } }, []);
    
    const handleActivate = async (e) => { e.preventDefault(); if (!activationKey.trim()) { setActivationError('请输入激活码。'); return; } setIsActivating(true); setActivationError(''); try { const deviceId = await getDeviceId(); const response = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: activationKey.trim(), deviceId }), }); const data = await response.json(); if (response.ok && data.success) { safeLocalStorageSet(ACTIVATION_KEY_STORAGE, activationKey.trim()); setActivationState('activated'); setKeyType(data.keyType); if (data.keyType === 'trial') { const expiryTime = data.activatedAt + (data.durationSeconds || 0) * 1000; setTrialExpiryTimestamp(expiryTime); } else { setTrialExpiryInfo('永久授权'); } } else { throw new Error(data.message || '激活失败。'); } } catch (err) { setActivationState('unactivated'); setActivationError(err.message); } finally { setIsActivating(false); } };

    const handleSubmit = async (isRegenerate = false) => {
        if (!currentConversation || isLoading || activationState !== 'activated') return;
        
        const activeApiKey = (settings.apiKeys || []).find(k => k.id === settings.selectedApiKeyId);
        if (!activeApiKey || !activeApiKey.key) { setError('请在设置中配置并选择一个有效的 API 密钥。'); return; }

        let messagesForApi = [...currentConversation.messages];
        const textToProcess = userInput.trim();

        if (isRegenerate) {
            if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') messagesForApi.pop();
        } else {
            if (!textToProcess && selectedImages.length === 0) { setError('请输入文字或选择图片再发送！'); return; }
            const userMessage = { role: 'user', content: textToProcess, images: selectedImages, timestamp: Date.now() };
            const updatedMessages = [...messagesForApi, userMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages, promptId: c.promptId || settings.currentPromptId } : c));
            messagesForApi = updatedMessages;
            setUserInput(''); setSelectedImages([]);
        }

        if (messagesForApi.length === 0) return;
        setIsLoading(true); setError('');
        abortControllerRef.current = new AbortController();

        try {
            const currentPrompt = (settings.prompts || []).find(p => p.id === currentConversation.promptId) || (settings.prompts || []).find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0];
            const modelInfo = (settings.chatModels || []).find(m => m.value === (currentPrompt.model || settings.selectedModel));
            if (!modelInfo) { throw new Error(`当前选择的模型 "${currentPrompt.model || settings.selectedModel}" 未在模型列表中找到，请在设置中检查。`); }
            
            const modelToUse = modelInfo.value;
            const maxContext = modelInfo.maxContext || 512;
            const contextMessages = messagesForApi.slice(-maxContext);
            let response;

            if (activeApiKey.type === API_TYPES.OPENAI) {
                if (!settings.openaiCompatibleEndpoint) throw new Error("请在设置中配置 OpenAI 兼容接口地址。");
                const messages = contextMessages.map(msg => ({ role: msg.role === 'ai' ? 'assistant' : 'user', content: [{ type: "text", text: msg.content || "" }, ...(msg.images || []).map(img => ({ type: "image_url", image_url: { url: `data:${img.type};base64,${img.data}` }}))] }));
                const body = { model: modelToUse, messages: [{ role: 'system', content: currentPrompt.content }, ...messages], temperature: settings.temperature, max_tokens: settings.maxOutputTokens, };
                response = await fetch(settings.openaiCompatibleEndpoint + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeApiKey.key}` }, body: JSON.stringify(body), signal: abortControllerRef.current.signal });
            } else {
                const history = contextMessages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content || "" }, ...(msg.images || []).map(img => ({ inlineData: { mimeType: img.type, data: img.data } }))] }));
                const contents = [{ role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history];
                const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens };
                if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
                const body = { contents, generationConfig };
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${activeApiKey.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abortControllerRef.current.signal });
            }

            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败`); }
            const data = await response.json();
            const aiResponseContent = activeApiKey.type === API_TYPES.OPENAI ? data.choices?.[0]?.message?.content : data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            
            const aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now(), isTyping: true };
            const finalMessages = [...messagesForApi, aiMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } catch (err) {
            const finalMessages = [...messagesForApi];
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') errorMessage = '请求被中断。';
            setError(errorMessage);
            finalMessages.push({ role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() });
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally { setIsLoading(false); }
    };
    
    const handleTypingComplete = useCallback(() => { setConversations(prev => prev.map(c => { if (c.id === currentConversationId) { const updatedMessages = c.messages.map((msg, index) => index === c.messages.length - 1 ? { ...msg, isTyping: false } : msg); return { ...c, messages: updatedMessages }; } return c; })); }, [currentConversationId]);
    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);
    
    // --- 新增：主聊天界面右滑返回手势 ---
    const swipeHandlers = useSimpleSwipe({ onSwipeRight: onClose });

    if (!isMounted || activationState === 'checking') {
        return <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900"><div className="text-lg">正在加载应用...</div></div>;
    }

    // --- [已恢复] 激活界面 ---
    if (activationState !== 'activated') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
                <div className="w-full max-w-sm mx-auto text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">需要激活</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">请输入您的激活码以继续使用。</p>
                    <form onSubmit={handleActivate} className="space-y-4">
                        <input type="text" value={activationKey} onChange={(e) => setActivationKey(e.target.value)} placeholder="输入激活码" className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary" />
                        <button type="submit" disabled={isActivating} className="w-full bg-primary text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
                            {isActivating ? '正在激活...' : '激活'}
                        </button>
                    </form>
                    {activationError && <p className="mt-4 text-sm text-red-500">{activationError}</p>}
                </div>
            </div>
        );
    }
    
    const showSendButton = userInput.trim().length > 0 || selectedImages.length > 0;
    
    return (
        <div {...swipeHandlers} className="w-full h-full flex flex-col bg-cover bg-center" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`}}>
            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm"></div>
            <div className="relative z-10 flex flex-1 min-h-0">
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onNew={() => createNewConversation()} onDelete={handleDeleteConversation} onRename={handleRenameConversation} prompts={settings.prompts} settings={settings} />
                {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-10 md:hidden"></div> )}
                <div className="flex-1 flex flex-col h-full min-w-0">
                    <div className="flex items-center justify-between py-1 px-2 border-b border-white/20 dark:border-gray-700/50 shrink-0 bg-white/30 dark:bg-black/30 backdrop-blur-md">
                        <div className="w-10"> <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="切换侧边栏"><i className="fas fa-bars"></i></button> </div>
                        <div className="text-center flex-grow">
                            <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2>
                            {trialExpiryInfo && <div className={`text-xs font-semibold ${keyType === 'trial' ? 'text-green-500' : 'text-yellow-500'}`}>{trialExpiryInfo}</div>}
                        </div>
                        <div className="w-10 flex justify-end"> <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="设置"><i className="fas fa-cog"></i></button> </div>
                    </div>
                    <div className="flex-grow p-4 overflow-y-auto">
                        <div className="space-y-1">
                            {currentConversation?.messages.map((msg, index) => (
                                <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}>
                                    <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} onTypingComplete={handleTypingComplete} />
                                </div>
                            ))}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                    <footer className="flex-shrink-0 px-4 pt-2 pb-safe bg-gradient-to-t from-white/95 via-white/80 to-transparent dark:from-gray-800/95 dark:via-gray-800/80 dark:to-transparent z-10">
                        {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm" onClick={()=>setError('')}>{error} <span className='text-xs'>(点击关闭)</span></div>}
                        <div className="w-full max-w-2xl mx-auto">
                           {selectedImages.length > 0 && ( <div className="mb-2 flex gap-2 overflow-x-auto p-1"> {selectedImages.map((image, index) => ( <div key={index} className="relative w-24 h-24 object-cover rounded-lg shrink-0"> <img src={image.previewUrl} alt={`预览 ${index + 1}`} className="w-full h-full object-cover rounded-lg" /> <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs" title="移除"><i className="fas fa-times"></i></button> </div> ))} </div> )}
                            <div className="flex items-center gap-2 mb-2">
                                <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="上传图片"><i className="fas fa-image"></i></button>
                                <button type="button" onClick={() => cameraInputRef.current.click()} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="拍照上传"><i className="fas fa-camera"></i></button>
                                <button type="button" onClick={() => setShowModelSelector(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="切换模型"><i className="fas fa-robot"></i></button>
                                <button type="button" onClick={() => setShowAssistantSelector(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="更换助理"><i className="fas fa-user-astronaut"></i></button>
                            </div>
                            <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end w-full p-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out hover:shadow-xl focus-within:shadow-xl">
                                <button type="button" onClick={() => createNewConversation()} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="新对话">
                                    <i className="fas fa-plus text-lg"></i>
                                </button>
                                <textarea ref={textareaRef} value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="flex-1 bg-transparent focus:outline-none dark:text-gray-100 text-base resize-none overflow-hidden mx-2 py-1 leading-6 max-h-36 placeholder-gray-400 dark:placeholder-gray-500" rows="1" style={{minHeight:'2.5rem'}} />
                                <div className="flex items-center flex-shrink-0 ml-1">
                                    {!showSendButton && (<button type="button" onClick={isListening ? stopListening : startListening} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-white bg-red-500 animate-pulse' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="语音输入"><i className="fas fa-microphone text-xl"></i></button>)}
                                    {showSendButton && (<button type="submit" className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95" disabled={isLoading}><i className="fas fa-arrow-up text-xl"></i></button>)}
                                </div>
                            </form>
                        </div>
                    </footer>
                </div>
                {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
                {showAssistantSelector && <AssistantSelector prompts={settings.prompts} settings={settings} onSelect={(promptId) => { setSettings(s => ({...s, currentPromptId: promptId })); setShowAssistantSelector(false); }} onClose={() => setShowAssistantSelector(false)} />}
                {showModelSelector && <ModelSelector settings={settings} onSelect={(modelValue) => { setSettings(s => ({...s, selectedModel: modelValue})); setShowModelSelector(false); }} onClose={() => setShowModelSelector(false)} />}
            </div>
            {/* 隐藏的文件输入框 */}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple style={{ display: 'none' }} />
            <input type="file" ref={cameraInputRef} onChange={handleImageUpload} accept="image/*" capture="environment" style={{ display: 'none' }} />
        </div>
    );
};

export default AiChatAssistant;
