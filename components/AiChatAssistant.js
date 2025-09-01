// /components/AiChatAssistant.js - v58 (功能增强与手势优化版)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AiTtsButton from './AiTtsButton'; // 假设 AiTtsButton 内部逻辑已更新以接收新的 TTS 配置
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// --- 轻量级滑动手势Hook (无变化) ---
const useSimpleSwipe = ({ onSwipeLeft, onSwipeRight }) => {
    const touchStart = useRef({ x: 0, y: 0 }); const touchEnd = useRef({ x: 0, y: 0 }); const minSwipeDistance = 60;
    const onTouchStart = (e) => { touchEnd.current = { x: 0, y: 0 }; touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; };
    const onTouchMove = (e) => { touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; };
    const onTouchEnd = () => { if (!touchStart.current.x || !touchEnd.current.x) return; const xDistance = touchStart.current.x - touchEnd.current.x; const yDistance = touchStart.current.y - touchEnd.current.y; if (Math.abs(xDistance) < Math.abs(yDistance)) return; if (xDistance > minSwipeDistance) { if (onSwipeLeft) onSwipeLeft(); } else if (xDistance < -minSwipeDistance) { if (onSwipeRight) onSwipeRight(); } touchStart.current = { x: 0, y: 0 }; touchEnd.current = { x: 0, y: 0 }; };
    return { onTouchStart, onTouchMove, onTouchEnd };
};

// --- 辅助函数 (无变化) ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const safeLocalStorageRemove = (key) => { if (typeof window !== 'undefined') { localStorage.removeItem(key); } };

// --- 常量定义 (部分修改) ---
export const TTS_ENGINE_TYPE = { SYSTEM: 'system', GOOGLE: 'google', OPENAI: 'openai' };
const CHAT_MODELS_LIST = [ { id: 'model-1', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 8192 }, { id: 'model-2', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 8192 }, { id: 'model-3', name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', maxContextTokens: 4096 }, { id: 'model-4', name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest', maxContextTokens: 8192 }, { id: 'model-5', name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest', maxContextTokens: 8192 }, ];
const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '' }, { id: 'translate-myanmar', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '' } ];
// 新增：TTS 默认配置
const DEFAULT_TTS_CONFIGS = [ { id: 'tts-system', name: '系统内置', type: TTS_ENGINE_TYPE.SYSTEM, apiKeyId: '', url: '', model: '', voice: '' }, { id: 'tts-microsoft-default', name: '微软晓晓', type: TTS_ENGINE_TYPE.OPENAI, apiKeyId: 'YOUR_MS_TTS_KEY_ID', url: 'https://YOUR_REGION.tts.speech.microsoft.com/cognitiveservices/v1', model: 'YOUR_MS_MODEL', voice: 'zh-CN-XiaoxiaoMultilingualNeural' } ];
const DEFAULT_SETTINGS = {
    apiKeys: [], activeApiKeyId: '', chatModels: CHAT_MODELS_LIST, selectedModel: 'gemini-2.5-flash', temperature: 0.8, maxOutputTokens: 2048, disableThinkingMode: true, startWithNewChat: false, prompts: DEFAULT_PROMPTS, currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false, ttsConfigs: DEFAULT_TTS_CONFIGS, activeTtsConfigId: DEFAULT_TTS_CONFIGS[0].id, speechLanguage: 'zh-CN', chatBackgroundUrl: '/images/chat-bg-2.jpg', userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: '/images/ai-avatar.png', isFacebookApp: false,
};

// --- 子组件 (大量修改和新增) ---
const AiTtsButtonModified = ({ text, ttsSettings, allSettings }) => {
    // 假设 AiTtsButton 组件现在能处理更复杂的逻辑
    // 为了简化，我们将在这个组件的壳里处理播放逻辑
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const activeTtsConfig = allSettings.ttsConfigs.find(t => t.id === allSettings.activeTtsConfigId);
    
    const playAudio = async () => {
        if (!activeTtsConfig || !text) return;
        setIsPlaying(true);
        try {
            const modifiedText = text.replace(/[（）()]/g, ' ');

            if (activeTtsConfig.type === TTS_ENGINE_TYPE.SYSTEM) {
                const utterance = new SpeechSynthesisUtterance(modifiedText);
                // 可以根据 activeTtsConfig.voice (voiceURI) 设置声音
                window.speechSynthesis.speak(utterance);
                utterance.onend = () => setIsPlaying(false);
            } else {
                // API-based TTS logic would go here
                // This is a placeholder for a complex implementation
                console.log("Playing TTS via API:", activeTtsConfig.name, "Text:", modifiedText);
                alert(`模拟通过 ${activeTtsConfig.name} 朗读 (API调用逻辑未实现)`);
                setIsPlaying(false);
            }
        } catch (error) {
            console.error("TTS Error:", error);
            setIsPlaying(false);
        }
    };
    
    return <button onClick={playAudio} title="朗读" className={`p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 ${isPlaying ? 'text-primary animate-pulse' : ''}`}><i className="fas fa-volume-up"></i></button>;
};
const TypingEffect = ({ text, onComplete, onUpdate }) => { const [displayedText, setDisplayedText] = useState(''); useEffect(() => { if (!text) return; setDisplayedText(''); let index = 0; const intervalId = setInterval(() => { setDisplayedText(prev => prev + text.charAt(index)); index++; if (onUpdate) onUpdate(); if (index >= text.length) { clearInterval(intervalId); if (onComplete) onComplete(); } }, 30); return () => clearInterval(intervalId); }, [text, onComplete, onUpdate]); return <SimpleMarkdown text={displayedText} />; };
const SimpleMarkdown = ({ text }) => { if (!text) return null; const lines = text.split('\n').map((line, index) => { if (line.trim() === '') return <br key={index} />; if (line.match(/\*\*(.*?)\*\*/)) { const content = line.replace(/\*\*/g, ''); return <strong key={index} className="block mt-2 mb-1">{content}</strong>; } if (line.startsWith('* ') || line.startsWith('- ')) { return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>; } return <p key={index} className="my-1">{line}</p>; }); return <div>{lines}</div>; };
const MessageBubble = ({ msg, settings, allSettings, isLastAiMessage, onRegenerate, onTypingComplete, onTypingUpdate }) => { const isUser = msg.role === 'user'; const userBubbleClass = 'bg-primary text-white rounded-br-lg shadow-md'; const aiBubbleClass = 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-md'; return ( <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}> {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />} <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}> {msg.images && msg.images.length > 0 && ( <div className="flex flex-wrap gap-2 mb-2"> {msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)} </div> )} <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1"> {isLastAiMessage && msg.isTyping ? <TypingEffect text={msg.content || ''} onComplete={onTypingComplete} onUpdate={onTypingUpdate} /> : <SimpleMarkdown text={msg.content || ''} />} </div> {!isUser && msg.content && !msg.isTyping && ( <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400"> {settings.isFacebookApp && <span className="text-sm text-red-400">语音不可用</span>} {!settings.isFacebookApp && <AiTtsButtonModified text={msg.content} ttsSettings={settings} allSettings={allSettings} />} <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button> {isLastAiMessage && ( <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button> )} </div> )} </div> {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />} </div> ); };
// 新增：移动对话的子菜单
const MoveToSubMenu = ({ prompts, onSelect, currentPromptId }) => ( <div className="absolute left-full top-0 ml-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-20 max-h-48 overflow-y-auto"> {(prompts || []).filter(p => p.id !== currentPromptId).map(p => ( <button key={p.id} onClick={() => onSelect(p.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 truncate"> <img src={convertGitHubUrl(p.avatarUrl)} className="w-4 h-4 rounded-full object-cover shrink-0" alt={p.name} /> <span>{p.name}</span> </button> ))} </div> );
const ConversationMenu = ({ onRename, onDelete, onMove, prompts, currentPromptId }) => { const [showMove, setShowMove] = useState(false); return ( <div className="relative" onMouseLeave={() => setShowMove(false)}> <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-10"> <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-pen w-4"></i>重命名</button> <div className="relative" onMouseEnter={() => setShowMove(true)}> <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><i className="fas fa-folder-open w-4"></i>移动到</div><i className="fas fa-chevron-right text-xs"></i></button> {showMove && <MoveToSubMenu prompts={prompts} onSelect={onMove} currentPromptId={currentPromptId} />} </div> <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-trash w-4"></i>删除</button> </div> </div> ); };
const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onDelete, onRename, onMove, prompts, settings }) => { const [editingId, setEditingId] = useState(null); const [newName, setNewName] = useState(''); const [activeMenu, setActiveMenu] = useState(null); const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); setActiveMenu(null); }; const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); }; const handleMove = (convId, newPromptId) => { onMove(convId, newPromptId); setActiveMenu(null); }; const groupedConversations = useMemo(() => { const groups = new Map(); const uncategorized = []; (conversations || []).forEach(conv => { const promptId = conv.promptId; const prompt = (prompts || []).find(p => p.id === promptId); if (prompt) { if (!groups.has(promptId)) { groups.set(promptId, { prompt, conversations: [] }); } groups.get(promptId).conversations.push(conv); } else { uncategorized.push(conv); } }); return { sortedGroups: Array.from(groups.values()), uncategorized }; }, [conversations, prompts]); const renderConversationItem = (conv) => ( <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={(e) => { e.stopPropagation(); onSelect(conv.id); setActiveMenu(null); }}> <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}> {editingId === conv.id ? ( <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus /> ) : ( <span className="text-sm">{conv.title}</span> )} </div> <div className="relative shrink-0"> <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === conv.id ? null : conv.id); }} className={`p-1 rounded-full ${currentId === conv.id || activeMenu === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}> <i className="fas fa-ellipsis-h text-xs"></i> </button> {activeMenu === conv.id && ( <ConversationMenu onRename={() => handleRename(conv.id, conv.title)} onDelete={() => { if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); setActiveMenu(null); }} onMove={(newPromptId) => handleMove(conv.id, newPromptId)} prompts={prompts} currentPromptId={conv.promptId}/> )} </div> </div> ); return ( <div className={`h-full bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-44 p-2' : 'w-0 p-0'} overflow-hidden`}> <div className="flex-grow overflow-y-auto space-y-2 pt-2"> {groupedConversations.sortedGroups.map(({ prompt, conversations }) => ( <details key={prompt.id} className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <img src={convertGitHubUrl(prompt.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={prompt.name} className="w-5 h-5 rounded-full object-cover"/> <span className="text-xs font-semibold flex-grow">{prompt.name}</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(conversations || []).map(renderConversationItem)} </div> </details> ))} {groupedConversations.uncategorized.length > 0 && ( <details className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <i className="fas fa-folder w-5 h-5 text-gray-500"></i> <span className="text-xs font-semibold flex-grow">未分类对话</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(groupedConversations.uncategorized || []).map(renderConversationItem)} </div> </details> )} </div> </div> ); };
// ... (PromptManager, ModelManager, ApiKeyManager components remain largely the same)
// --- 新增组件：TTS引擎管理 ---
const TtsManager = ({ ttsConfigs, apiKeys, onBack, onChange, onAdd, onDelete }) => {
    return (
        <div className="fixed inset-0 bg-white dark:bg-gray-800 p-6 flex flex-col z-[9999] animate-fade-in">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left"></i></button>
                <h3 className="text-2xl font-bold">朗读引擎管理</h3>
                <div className="w-8"></div>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                {(ttsConfigs || []).map(t => (
                    <div key={t.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700 space-y-2">
                        <div className="flex items-center justify-between">
                            <input type="text" value={t.name} onChange={(e) => onChange(t.id, 'name', e.target.value)} placeholder="引擎名称" className="font-semibold bg-transparent w-full text-lg" />
                            <button onClick={() => onDelete(t.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10" disabled={t.type === 'system'}><i className="fas fa-trash"></i></button>
                        </div>
                        <select value={t.type} onChange={(e) => onChange(t.id, 'type', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-sm">
                            <option value={TTS_ENGINE_TYPE.SYSTEM}>系统内置</option>
                            <option value={TTS_ENGINE_TYPE.GOOGLE}>Google TTS</option>
                            <option value={TTS_ENGINE_TYPE.OPENAI}>OpenAI 兼容 TTS</option>
                        </select>
                        {t.type !== TTS_ENGINE_TYPE.SYSTEM && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div><label className="text-xs font-medium">API 密钥</label><select value={t.apiKeyId} onChange={(e) => onChange(t.id, 'apiKeyId', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs"><option value="">选择密钥</option>{(apiKeys || []).map(k => <option key={k.id} value={k.id}>{k.provider} Key</option>)}</select></div>
                                <div><label className="text-xs font-medium">API 地址 (URL)</label><input type="text" value={t.url} onChange={(e) => onChange(t.id, 'url', e.target.value)} placeholder="https://..." className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" /></div>
                                <div><label className="text-xs font-medium">模型 (Model)</label><input type="text" value={t.model} onChange={(e) => onChange(t.id, 'model', e.target.value)} placeholder="e.g. tts-1" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" /></div>
                                <div><label className="text-xs font-medium">发音人 (Voice)</label><input type="text" value={t.voice} onChange={(e) => onChange(t.id, 'voice', e.target.value)} placeholder="e.g. alloy" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" /></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button onClick={onAdd} className="w-full mt-4 py-2 bg-purple-500 text-white rounded-md shrink-0"><i className="fas fa-plus mr-2"></i>添加新引擎</button>
        </div>
    );
};

const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [view, setView] = useState('main'); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    // ... (All other handle functions for Prompts, Models, API Keys remain unchanged) ...
    // --- 新增：TTS引擎管理逻辑 ---
    const handleAddTtsConfig = () => { const newConfig = { id: `tts-${Date.now()}`, name: '新引擎', type: TTS_ENGINE_TYPE.OPENAI, apiKeyId: '', url: '', model: '', voice: '' }; const newConfigs = [...(tempSettings.ttsConfigs || []), newConfig]; handleChange('ttsConfigs', newConfigs); };
    const handleDeleteTtsConfig = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newConfigs = (tempSettings.ttsConfigs || []).filter(t => t.id !== idToDelete); handleChange('ttsConfigs', newConfigs); if (tempSettings.activeTtsConfigId === idToDelete) handleChange('activeTtsConfigId', newConfigs[0]?.id || ''); };
    const handleTtsConfigChange = (configId, field, value) => { const newConfigs = (tempSettings.ttsConfigs || []).map(t => t.id === configId ? { ...t, [field]: value } : t); handleChange('ttsConfigs', newConfigs); };

    return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}> <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}> 
    {view === 'main' && ( <div className="p-6 h-full flex flex-col"> <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3> <div className="space-y-4 flex-grow overflow-y-auto pr-2"> <button type="button" onClick={() => setView('apiKeys')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700"><h4>API 密钥管理</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('prompts')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700"><h4>提示词工作室</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('models')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700"><h4>模型管理</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('tts')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700"><h4>朗读引擎管理</h4><i className={`fas fa-arrow-right`}></i></button> 
    {/* ... (Other settings sections) ... */}
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4"><h4 className="text-md font-semibold">朗读设置</h4><div><label className="block text-sm font-medium mb-1">朗读引擎</label><select value={tempSettings.activeTtsConfigId} onChange={(e) => handleChange('activeTtsConfigId', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">{(tempSettings.ttsConfigs || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="flex items-center justify-between"><label className="block text-sm font-medium">AI 回复后自动朗读</label><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div></div>
     {/* ... (Other settings sections) ... */}
    </div> <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button></div> </div> )} 
    {/* ... (other views for prompts, models, apikeys) ... */}
    {view === 'tts' && (<TtsManager ttsConfigs={tempSettings.ttsConfigs} apiKeys={tempSettings.apiKeys} onBack={() => setView('main')} onChange={handleTtsConfigChange} onAdd={handleAddTtsConfig} onDelete={handleDeleteTtsConfig} />)}
    </div> </div> ); };
// ... (ModelSelector, AssistantSelector remain unchanged) ...


const AiChatAssistant = ({ onClose }) => {
    // ... (state declarations remain mostly the same) ...
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    // ...
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    useEffect(() => { const initializeApp = async () => { setIsMounted(true); let finalSettings = { ...DEFAULT_SETTINGS }; const savedSettings = safeLocalStorageGet('ai_assistant_settings_v58_final'); if (savedSettings) { try { const parsed = JSON.parse(savedSettings); finalSettings = { ...DEFAULT_SETTINGS, ...parsed, prompts: parsed.prompts || DEFAULT_PROMPTS, chatModels: parsed.chatModels || CHAT_MODELS_LIST, apiKeys: parsed.apiKeys || [], ttsConfigs: parsed.ttsConfigs || DEFAULT_TTS_CONFIGS }; } catch (e) { console.error("Failed to parse settings", e); } } if (typeof navigator !== 'undefined' && /FBAN|FBAV/i.test(navigator.userAgent)) { finalSettings.isFacebookApp = true; } setSettings(finalSettings); const savedConversations = safeLocalStorageGet('ai_assistant_conversations_v58_final'); const parsedConvs = savedConversations ? JSON.parse(savedConversations) : []; setConversations(parsedConvs); if (finalSettings.startWithNewChat || parsedConvs.length === 0) { createNewConversation(finalSettings.currentPromptId, true); } else { const firstConv = parsedConvs[0]; setCurrentConversationId(firstConv.id); lastAutoReadMessageId.current = firstConv.messages[firstConv.messages.length - 1]?.timestamp; } }; initializeApp(); }, []);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_assistant_settings_v58_final', JSON.stringify(settings)); safeLocalStorageSet('ai_assistant_conversations_v58_final', JSON.stringify(conversations)); } }, [settings, conversations, isMounted]);

    // ... (scrollToBottom, auto-read logic remain the same) ...

    const createNewConversation = (promptId, isInitial = false) => { const newId = `conv-${Date.now()}`; const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: promptId || settings.currentPromptId }; if (isInitial) { lastAutoReadMessageId.current = newConv.messages[0].timestamp; } setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { handleSelectConversation(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleMoveConversation = (convId, newPromptId) => { setConversations(prev => prev.map(c => c.id === convId ? { ...c, promptId: newPromptId } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleImageUpload = (e) => { const files = Array.from(e.target.files); if (!files.length) return; const imagePromises = files.map(file => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve({ data: reader.result.split(',')[1], previewUrl: reader.result, type: file.type }); reader.onerror = reject; reader.readAsDataURL(file); }); }); Promise.all(imagePromises).then(newImages => setSelectedImages(prev => [...prev, ...newImages])); if (fileInputRef.current) fileInputRef.current.value = ''; if (cameraInputRef.current) cameraInputRef.current.value = ''; };
    const handleRemoveImage = (indexToRemove) => { setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove)); };

    // ... (handleSubmit logic remains the same) ...
    // ... (other handlers like startListening, stopListening, handleTypingComplete) ...

    // --- 新增：手势处理 ---
    const chatAreaSwipeHandlers = useSimpleSwipe({ 
        onSwipeLeft: onClose, 
        onSwipeRight: () => setIsSidebarOpen(true) 
    });
    const sidebarSwipeHandlers = useSimpleSwipe({ onSwipeLeft: () => setIsSidebarOpen(false) });
    
    const showSendButton = userInput.trim().length > 0 || selectedImages.length > 0;
    
    return (
        // 移除了顶层div的 'dark' 类，以实现兼容性
        <div className="w-full h-full flex flex-col bg-cover bg-center text-gray-800 dark:text-gray-200" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`}}>
            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm"></div>
            {/* 隐藏的 input 用于文件上传 */}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple style={{ display: 'none' }} />
            <input type="file" ref={cameraInputRef} onChange={handleImageUpload} accept="image/*" capture="environment" style={{ display: 'none' }} />

            <div className="relative z-10 flex flex-1 min-h-0">
                <div {...sidebarSwipeHandlers}>
                    <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} onMove={handleMoveConversation} prompts={settings.prompts} settings={settings} />
                </div>
                {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-10 md:hidden"></div> )}
                
                <div className="flex-1 flex flex-col h-full min-w-0" {...chatAreaSwipeHandlers}>
                    <header className="flex items-center justify-between py-1 px-2 border-b border-white/20 dark:border-gray-700/50 shrink-0 bg-white/30 dark:bg-black/30 backdrop-blur-md">
                        <div className="w-10"> <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="切换侧边栏"><i className="fas fa-bars"></i></button> </div>
                        <div className="text-center flex-grow"> <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2> </div>
                        <div className="w-10 flex justify-end"> <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="设置"><i className="fas fa-cog"></i></button> </div>
                    </header>
                    <main className="flex-grow p-4 overflow-y-auto">
                        <div className="space-y-1">
                            {currentConversation?.messages.map((msg, index) => (
                                <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}>
                                    <MessageBubble msg={msg} settings={settings} allSettings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} onTypingComplete={handleTypingComplete} onTypingUpdate={scrollToBottom} />
                                </div>
                            ))}
                        </div>
                        <div ref={messagesEndRef} />
                    </main>
                    <footer className="flex-shrink-0 px-4 pt-2 pb-safe bg-gradient-to-t from-white/95 via-white/80 to-transparent dark:from-gray-800/95 dark:via-gray-800/80 dark:to-transparent z-10">
                        {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm" onClick={()=>setError('')}>{error} <span className='text-xs'>(点击关闭)</span></div>}
                        {selectedImages.length > 0 && ( <div className="mb-2 flex gap-2 overflow-x-auto p-1"> {selectedImages.map((image, index) => ( <div key={index} className="relative w-24 h-24 object-cover rounded-lg shrink-0"> <img src={image.previewUrl} alt={`预览 ${index + 1}`} className="w-full h-full object-cover rounded-lg" /> <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs" title="移除"><i className="fas fa-times"></i></button> </div> ))} </div> )}
                        
                        <div className="flex items-center justify-start gap-2 mb-2 max-w-2xl mx-auto flex-wrap">
                             <button onClick={() => createNewConversation()} className="flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-gray-700/50 border dark:border-gray-600 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600" title="新对话"><i className="fas fa-plus"></i></button>
                            <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-gray-700/50 border dark:border-gray-600 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600" title="上传图片"><i className="fas fa-image"></i></button>
                            <button onClick={() => cameraInputRef.current.click()} className="flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-gray-700/50 border dark:border-gray-600 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600" title="拍照上传"><i className="fas fa-camera"></i></button>
                            <button onClick={() => setShowModelSelector(true)} className="flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-gray-700/50 border dark:border-gray-600 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600" title="切换模型"><i className="fas fa-robot"></i></button>
                            <button onClick={() => setShowAssistantSelector(true)} className="flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-gray-700/50 border dark:border-gray-600 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600" title="更换助理"><i className="fas fa-user-astronaut"></i></button>
                        </div>

                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end w-full max-w-2xl mx-auto p-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700">
                            <textarea ref={textareaRef} value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); } }} placeholder="与 AI 聊天..." className="flex-1 bg-transparent focus:outline-none dark:text-gray-100 text-base resize-none overflow-hidden mx-2 py-1 leading-6 max-h-36 placeholder-gray-400 dark:placeholder-gray-500" rows="1" style={{minHeight:'2.5rem'}} />
                            <div className="flex items-center flex-shrink-0 ml-1">{!showSendButton ? (<button type="button" onClick={isListening ? stopListening : startListening} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-white bg-red-500 animate-pulse' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="语音输入"><i className="fas fa-microphone text-xl"></i></button>) : (<button type="submit" className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full shadow-md hover:bg-blue-700 disabled:opacity-50" disabled={isLoading}><i className="fas fa-arrow-up text-xl"></i></button>)}</div>
                        </form>
                    </footer>
                </div>
                {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
                {showAssistantSelector && <AssistantSelector prompts={settings.prompts} settings={settings} onSelect={(promptId) => { setSettings(s => ({...s, currentPromptId: promptId })); setShowAssistantSelector(false); createNewConversation(promptId); }} onClose={() => setShowAssistantSelector(false)} />}
                {showModelSelector && <ModelSelector settings={settings} onSelect={(modelValue) => { setSettings(s => ({...s, selectedModel: modelValue})); setShowModelSelector(false); }} onClose={() => setShowModelSelector(false)} />}
            </div>
        </div>
    );
};

export default AiChatAssistant;
