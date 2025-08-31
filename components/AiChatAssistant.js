// /components/AiChatAssistant.js - v40: (稳定性加固 - 防御性编程修复崩溃问题)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AiTtsButton from './AiTtsButton';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
export const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };

// ... (所有子组件代码保持不变，为了简洁省略)
// 在您实际操作时，请确保这些组件的完整代码仍然存在于文件中
const SimpleMarkdown = ({ text }) => { if (!text) return null; const lines = text.split('\n').map((line, index) => { if (line.trim() === '') return <br key={index} />; if (line.match(/\*\*(.*?)\*\*/)) { const content = line.replace(/\*\*/g, ''); return <strong key={index} className="block mt-2 mb-1">{content}</strong>; } if (line.startsWith('* ') || line.startsWith('- ')) { return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>; } return <p key={index} className="my-1">{line}</p>; }); return <div>{lines}</div>; };
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => { const isUser = msg.role === 'user'; const userBubbleClass = 'bg-gradient-to-br from-primary to-blue-600 text-white rounded-br-lg'; const aiBubbleClass = 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm'; return ( <div className={`flex items-end gap-2.5 my-2 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}> {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />} <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}> {msg.images && msg.images.length > 0 && ( <div className="flex flex-wrap gap-2 mb-2"> {msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)} </div> )} <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1"> <SimpleMarkdown text={msg.content || ''} /> </div> {!isUser && msg.content && ( <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400"> <AiTtsButton text={msg.content} ttsSettings={settings} /> <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button> {isLastAiMessage && ( <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button> )} </div> )} </div> {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />} </div> ); };
const ConversationMenu = ({ onRename, onDelete }) => ( <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-10"> <button onClick={onRename} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-pen w-4"></i>重命名</button> <button onClick={onDelete} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-trash w-4"></i>删除</button> </div> );
const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => { const [editingId, setEditingId] = useState(null); const [newName, setNewName] = useState(''); const [activeMenu, setActiveMenu] = useState(null); const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); setActiveMenu(null); }; const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); }; const groupedConversations = useMemo(() => { const groups = new Map(); const uncategorized = []; (conversations || []).forEach(conv => { const promptId = conv.promptId; const prompt = (prompts || []).find(p => p.id === promptId); if (prompt) { if (!groups.has(promptId)) { groups.set(promptId, { prompt, conversations: [] }); } groups.get(promptId).conversations.push(conv); } else { uncategorized.push(conv); } }); return { sortedGroups: Array.from(groups.values()), uncategorized }; }, [conversations, prompts]); const renderConversationItem = (conv) => ( <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={(e) => { e.stopPropagation(); onSelect(conv.id); setActiveMenu(null); }}> <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}> {editingId === conv.id ? ( <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus /> ) : ( <span className="text-sm">{conv.title}</span> )} </div> <div className="relative shrink-0"> <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === conv.id ? null : conv.id); }} className={`p-1 rounded-full ${currentId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}> <i className="fas fa-ellipsis-h text-xs"></i> </button> {activeMenu === conv.id && ( <ConversationMenu onRename={() => handleRename(conv.id, conv.title)} onDelete={() => { if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); setActiveMenu(null); }} /> )} </div> </div> ); return ( <div className={`h-full bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-44 p-2' : 'w-0 p-0'} overflow-hidden`}> <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"> <span>新对话</span><i className="fas fa-plus"></i> </button> <div className="flex-grow overflow-y-auto space-y-2"> {groupedConversations.sortedGroups.map(({ prompt, conversations }) => ( <details key={prompt.id} className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <img src={convertGitHubUrl(prompt.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={prompt.name} className="w-5 h-5 rounded-full object-cover"/> <span className="text-xs font-semibold flex-grow">{prompt.name}</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {conversations.map(renderConversationItem)} </div> </details> ))} {groupedConversations.uncategorized.length > 0 && ( <details className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <i className="fas fa-folder w-5 h-5 text-gray-500"></i> <span className="text-xs font-semibold flex-grow">未分类对话</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {groupedConversations.uncategorized.map(renderConversationItem)} </div> </details> )} </div> </div> ); };
const CHAT_MODELS = [ { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' }, { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' }, { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }, { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' }, { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' }, ];
const PromptManager = ({ prompts, onBack, onChange, onAdd, onDelete, settings, microsoftTtsVoices }) => ( <div className="absolute inset-0 bg-white dark:bg-gray-800 p-6 flex flex-col animate-fade-in"> <div className="flex items-center justify-between mb-4 shrink-0"> <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left"></i></button> <h3 className="text-2xl font-bold">提示词工作室</h3> <div className="w-8"></div> </div> <div className="flex-grow overflow-y-auto pr-2 space-y-3"> {(prompts || []).map(p => ( <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700"> <div className="flex items-center justify-between"> <label className="flex items-center flex-grow cursor-pointer gap-2"> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-6 h-6 rounded-full object-cover"/> <input type="text" value={p.name} onChange={(e) => onChange(p.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full text-lg" /> </label> <button onClick={() => onDelete(p.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> <textarea value={p.content} onChange={(e) => onChange(p.id, 'content', e.target.value)} placeholder="请输入提示词内容..." className="w-full mt-2 h-24 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" /> <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"> <div><label className="text-xs font-medium">模型:</label><select value={p.model || settings.selectedModel} onChange={(e) => onChange(p.id, 'model', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">{(settings.chatModels || CHAT_MODELS).map(m => <option key={m.value} value={m.value}>{m.name}</option>)}</select></div> <div><label className="text-xs font-medium">声音:</label><select value={p.ttsVoice || settings.thirdPartyTtsVoice} onChange={(e) => onChange(p.id, 'ttsVoice', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">{(microsoftTtsVoices || []).map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div> <div><label className="text-xs font-medium">头像 URL:</label><input type="text" value={p.avatarUrl || ''} onChange={(e) => onChange(p.id, 'avatarUrl', e.target.value)} placeholder="输入头像图片URL" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" /></div> </div> </div> ))} </div> <button onClick={onAdd} className="w-full mt-4 py-2 bg-green-500 text-white rounded-md shrink-0"><i className="fas fa-plus mr-2"></i>添加新提示词</button> </div> );
const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [systemVoices, setSystemVoices] = useState([]); const [view, setView] = useState('main'); useEffect(() => { const fetchSystemVoices = () => { if (!window.speechSynthesis) return; const voices = window.speechSynthesis.getVoices(); if (voices.length > 0) { setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi'))); } }; if (window.speechSynthesis) { if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; } fetchSystemVoices(); } }, []); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleAddPrompt = () => { const newPrompt = { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入...', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }; const newPrompts = [...(tempSettings.prompts || []), newPrompt]; handleChange('prompts', newPrompts); }; const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = (tempSettings.prompts || []).filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); }; const handlePromptSettingChange = (promptId, field, value) => { const newPrompts = (tempSettings.prompts || []).map(p => p.id === promptId ? { ...p, [field]: value } : p); handleChange('prompts', newPrompts); }; const microsoftTtsVoices = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' }, ]; const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ]; return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}> <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}> {view === 'main' && ( <div className="p-6 h-full flex flex-col"> <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3> <div className="space-y-4 flex-grow overflow-y-auto pr-2"> <div><label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label><input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" /></div> <div><button type="button" onClick={() => setView('prompts')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><h4 className="text-lg font-bold">提示词工作室</h4><i className={`fas fa-arrow-right`}></i></button></div> <div><label className="block text-sm font-medium mb-1">聊天背景图片 URL</label><input type="text" value={tempSettings.chatBackgroundUrl} onChange={(e) => handleChange('chatBackgroundUrl', e.target.value)} placeholder="https://..." className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" /></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">始终开启新对话</label><input type="checkbox" checked={tempSettings.startWithNewChat} onChange={(e) => handleChange('startWithNewChat', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div> <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-3"><label className="block text-sm font-medium">高级参数</label><div className="flex items-center gap-4"><label className="text-sm shrink-0">温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div><div><div className="flex items-center justify-between"><label htmlFor="thinking-mode-toggle" className="block text-sm font-medium">关闭 2.5 系列模型思考模式</label><input id="thinking-mode-toggle" type="checkbox" checked={tempSettings.disableThinkingMode} onChange={(e) => handleChange('disableThinkingMode', e.target.checked)} className="h-5 w-5 text-primary rounded cursor-pointer" /></div><p className="text-xs text-gray-500 mt-1">开启后可大幅提升响应速度和降低成本，但可能影响复杂问题的回答质量。</p></div></div> <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4"><h4 className="text-md font-semibold">朗读设置</h4><div><label className="block text-sm font-medium mb-1">朗读引擎</label><select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value={TTS_ENGINE.THIRD_PARTY}>第三方 API (音质更好)</option><option value={TTS_ENGINE.SYSTEM}>系统内置 (速度快)</option></select></div>{tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (<div><label className="block text-sm font-medium mb-1">发音人 (第三方)</label><select value={tempSettings.thirdPartyTtsVoice} onChange={(e) => handleChange('thirdPartyTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">{microsoftTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div>)}{tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (<div><label className="block text-sm font-medium mb-1">发音人 (系统)</label>{systemVoices.length > 0 ? (<select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value="">浏览器默认</option>{systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}</select>) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}</div>)}</div> <div><label className="block text-sm font-medium mb-1">语音识别语言</label><select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">{speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">AI 回复后自动朗读</label><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div> </div> <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button></div> </div> )} {view === 'prompts' && (<PromptManager prompts={tempSettings.prompts} settings={tempSettings} onBack={() => setView('main')} onChange={handlePromptSettingChange} onAdd={handleAddPrompt} onDelete={handleDeletePrompt} microsoftTtsVoices={microsoftTtsVoices} />)} </div> </div> ); };
const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '' }, { id: 'translate-myanmar', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '' } ];
const DEFAULT_SETTINGS = { apiKey: '', selectedModel: 'gemini-2.5-flash', chatModels: CHAT_MODELS, temperature: 0.8, maxOutputTokens: 2048, disableThinkingMode: true, startWithNewChat: false, prompts: DEFAULT_PROMPTS, currentPromptId: DEFAULT_PROMPTS[0]?.id || '', autoRead: false, ttsEngine: TTS_ENGINE.THIRD_PARTY, thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', systemTtsVoiceURI: '', speechLanguage: 'zh-CN', chatBackgroundUrl: '/images/chat-bg.jpg', userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: '/images/ai-avatar.png', };
const AssistantSelector = ({ prompts, settings, onSelect, onClose }) => ( <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-2xl m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b dark:border-gray-700 text-center relative"><h3 className="text-lg font-bold">更换助理</h3><button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button></div> <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh]"> {(prompts || []).map(p => ( <button key={p.id} onClick={() => onSelect(p.id)} className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${settings.currentPromptId === p.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-16 h-16 rounded-full object-cover mb-2 shadow-md"/> <span className="text-sm font-semibold text-center">{p.name}</span> </button> ))} </div> </div> </div> );

const AiChatAssistant = ({ onClose, isFullScreenMode = false }) => {
    // --- 激活码系统状态 ---
    const [activationState, setActivationState] = useState('checking');
    const [activationKey, setActivationKey] = useState('');
    const [activationError, setActivationError] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [keyType, setKeyType] = useState(null);
    const [trialExpiryInfo, setTrialExpiryInfo] = useState('');

    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showAssistantSelector, setShowAssistantSelector] = useState(false);
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
    const conversationMessageCount = useRef({});

    const getDeviceId = async () => {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
    };

    useEffect(() => {
        const initializeApp = async () => {
            setIsMounted(true);
            let finalSettings = { ...DEFAULT_SETTINGS };
            const savedSettings = localStorage.getItem('ai_assistant_settings_v22_final');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                parsed.prompts = (parsed.prompts || []).map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: p.avatarUrl || '' }));
                if (!parsed.chatModels || parsed.chatModels.length === 0) { parsed.chatModels = CHAT_MODELS; }
                finalSettings = { ...DEFAULT_SETTINGS, ...parsed };
                setSettings(finalSettings);
            } else { setSettings(finalSettings); }

            const savedConversations = localStorage.getItem('ai_assistant_conversations_v22_final');
            const parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
            setConversations(parsedConvs);

            setActivationState('checking');
            try {
                const deviceId = await getDeviceId();
                const storedKey = localStorage.getItem('ai_assistant_key');
                let activated = false;

                if (storedKey) {
                    const response = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: storedKey, deviceId }), });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        setActivationState('activated'); setKeyType(data.keyType);
                        if (data.keyType === 'trial') { const expiry = new Date(data.activatedAt + (data.durationDays || 7) * 24 * 60 * 60 * 1000); setTrialExpiryInfo(`试用中，有效期至: ${expiry.toLocaleDateString()}`); } else { setTrialExpiryInfo('永久授权'); }
                        activated = true;
                    } else {
                        localStorage.removeItem('ai_assistant_key');
                        setActivationError(data.message || '本地激活码已失效。');
                    }
                }

                if (!activated) {
                    const trialResponse = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_trial', deviceId }), });
                    const trialData = await trialResponse.json();
                    if (trialResponse.ok && trialData.success) {
                        localStorage.setItem('ai_assistant_key', trialData.key);
                        setActivationState('activated'); setKeyType(trialData.keyType);
                        const expiry = new Date(Date.now() + (trialData.durationDays || 7) * 24 * 60 * 60 * 1000); setTrialExpiryInfo(`试用中，有效期至: ${expiry.toLocaleDateString()}`);
                    } else {
                        setActivationState('unactivated');
                        setActivationError(trialData.message || '无法自动开始试用。');
                    }
                }
            } catch (error) {
                setActivationState('unactivated'); setActivationError('网络错误，无法连接到激活服务器。');
            }

            if (finalSettings.startWithNewChat || parsedConvs.length === 0) {
                createNewConversation(finalSettings.currentPromptId);
            } else {
                setCurrentConversationId(parsedConvs[0].id);
            }
        };

        initializeApp();
    }, []);

    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);

    useEffect(() => { const handleClickOutside = (event) => { if (optionsContainerRef.current && !optionsContainerRef.current.contains(event.target)) { setShowMoreMenu(false); setShowModelSelector(false); setShowAssistantSelector(false); } }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);

    useEffect(() => { if (isMounted) { localStorage.setItem('ai_assistant_settings_v22_final', JSON.stringify(settings)); localStorage.setItem('ai_assistant_conversations_v22_final', JSON.stringify(conversations)); } }, [settings, conversations, isMounted]);

    useEffect(() => { if (messagesEndRef.current) { messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); } }, [currentConversation?.messages]);

    useEffect(() => {
        if (!currentConversation || !settings.autoRead || !isMounted || activationState !== 'activated') return;
        const messages = currentConversation.messages;
        const currentMessageCount = messages.length;
        const lastKnownCount = conversationMessageCount.current[currentConversation.id] || 0;
        const lastMessage = messages[currentMessageCount - 1];
        if (currentMessageCount > lastKnownCount && lastMessage?.role === 'ai' && lastMessage?.content && lastMessage?.timestamp && (Date.now() - lastMessage.timestamp < 3000)) {
            setTimeout(() => {
                const bubble = document.getElementById(`msg-${currentConversation.id}-${currentMessageCount - 1}`);
                const ttsButton = bubble?.querySelector('button[title="朗读"]');
                if (bubble && document.body.contains(bubble)) { ttsButton?.click(); }
            }, 300);
        }
        conversationMessageCount.current[currentConversation.id] = currentMessageCount;
    }, [currentConversation, settings.autoRead, isMounted, activationState]);

    const createNewConversation = (promptId) => { const newId = `conv-${Date.now()}`; const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: promptId || settings.currentPromptId }; setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleSelectConversation = (id) => setCurrentConversationId(id);
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { setCurrentConversationId(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleImageUpload = (e) => { const files = Array.from(e.target.files); if (!files.length) return; const imagePromises = files.map(file => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve({ data: reader.result.split(',')[1], previewUrl: reader.result, type: file.type }); reader.onerror = reject; reader.readAsDataURL(file); }); }); Promise.all(imagePromises).then(newImages => setSelectedImages(prev => [...prev, ...newImages])); if (fileInputRef.current) fileInputRef.current.value = ''; if (cameraInputRef.current) cameraInputRef.current.value = ''; };
    const handleRemoveImage = (indexToRemove) => { setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove)); };
    const startListening = useCallback(() => { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; } if (recognitionRef.current) recognitionRef.current.abort(); const recognition = new SpeechRecognition(); recognition.lang = settings.speechLanguage; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onstart = () => setIsListening(true); recognition.onresult = (e) => { const transcript = e.results[0][0].transcript.trim(); setUserInput(transcript); }; recognition.onerror = (event) => { console.error("Speech recognition error:", event.error); setError(`语音识别失败: ${event.error}`); setIsListening(false); }; recognition.onend = () => setIsListening(false); recognition.start(); recognitionRef.current = recognition; }, [settings.speechLanguage]);
    const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } }, []);
    const handleActivate = async (e) => { e.preventDefault(); if (!activationKey.trim()) { setActivationError('请输入激活码。'); return; } setIsActivating(true); setActivationError(''); try { const deviceId = await getDeviceId(); const response = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: activationKey.trim(), deviceId }), }); const data = await response.json(); if (response.ok && data.success) { localStorage.setItem('ai_assistant_key', activationKey.trim()); setActivationState('activated'); setKeyType(data.keyType); if (data.keyType === 'trial') { const expiry = new Date(data.activatedAt + (data.durationDays || 7) * 24 * 60 * 60 * 1000); setTrialExpiryInfo(`试用中，有效期至: ${expiry.toLocaleDateString()}`); } else { setTrialExpiryInfo('永久授权'); } } else { throw new Error(data.message || '激活失败。'); } } catch (err) { setActivationState('unactivated'); setActivationError(err.message); } finally { setIsActivating(false); } };
    const handleSubmit = async (isRegenerate = false) => { if (!currentConversation || isLoading || activationState !== 'activated') return; let messagesForApi = [...currentConversation.messages]; const textToProcess = userInput.trim(); if (isRegenerate) { if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') { messagesForApi.pop(); } } else { if (!textToProcess && selectedImages.length === 0) { setError('请输入文字或选择图片再发送！'); return; } const userMessage = { role: 'user', content: textToProcess, images: selectedImages, timestamp: Date.now() }; const updatedMessages = [...currentConversation.messages, userMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages, promptId: c.promptId || settings.currentPromptId } : c)); messagesForApi = updatedMessages; setUserInput(''); setSelectedImages([]); } if (messagesForApi.length === 0) return; setIsLoading(true); setError(''); abortControllerRef.current = new AbortController(); const signal = abortControllerRef.current.signal; try { const currentPrompt = settings.prompts.find(p => p.id === currentConversation.promptId) || settings.prompts.find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0]; const modelToUse = currentPrompt.model || settings.selectedModel; const history = messagesForApi.map(msg => { const parts = []; if (msg.content) parts.push({ text: msg.content }); if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } })); return { role: msg.role === 'user' ? 'user' : 'model', parts }; }); const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ]; const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens, }; if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) { generationConfig.thinkingConfig = { thinkingBudget: 0 }; } const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal, }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败`); } const data = await response.json(); const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text; if (!aiResponseContent) throw new Error('AI未能返回有效内容。'); const aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now() }; const finalMessages = [...messagesForApi, aiMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c)); } catch (err) { const finalMessages = [...messagesForApi]; let errorMessage = `请求错误: ${err.message}`; if (err.name === 'AbortError') { errorMessage = '请求被中断，请检查网络连接。'; } setError(errorMessage); finalMessages.push({role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now()}); setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c)); } finally { setIsLoading(false); } };
    
    const safeGetCurrentPrompt = useMemo(() => { return (settings.prompts || []).find(p => p.id === settings.currentPromptId) || (settings.prompts || [])[0] || { name: 'AI助理', avatarUrl: settings.aiAvatarUrl }; }, [settings.currentPromptId, settings.prompts, settings.aiAvatarUrl]);

    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    const showLeftButtons = !userInput.trim() && selectedImages.length === 0;
    
    const containerClasses = isFullScreenMode ? 'w-full h-full flex bg-white dark:bg-gray-900' : `w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900`;
    const containerStyle = isFullScreenMode ? {} : { height: '90vh', minHeight: '650px' };

    if (activationState === 'checking') {
        return (
            <div className={containerClasses} style={containerStyle}>
                <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="ml-3 text-gray-500">正在检查激活状态...</p>
                </div>
            </div>
        );
    }

    if (activationState !== 'activated') {
        return (
            <div className={containerClasses} style={containerStyle}>
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
                        <i className="fas fa-brain text-4xl text-primary mb-4"></i>
                        <h2 className="text-2xl font-bold mb-2">AI 助手需要激活</h2>
                        <p className="text-gray-500 mb-6">{activationError || '您的免费试用期已结束或尚未开始。请输入激活码以继续使用。'}</p>
                        <form onSubmit={handleActivate} className="space-y-4">
                            <input type="text" value={activationKey} onChange={(e) => setActivationKey(e.target.value)} placeholder="在此输入永久激活码" className="w-full px-4 py-2 text-center bg-gray-100 dark:bg-gray-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"/>
                            {activationError && <p className="text-red-500 text-sm">{activationError}</p>}
                            <button type="submit" disabled={isActivating} className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                                {isActivating ? ( <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> 正在验证...</> ) : "立即激活"}
                            </button>
                        </form>
                    </div>
                    {isFullScreenMode && <button onClick={onClose} className="mt-4 text-gray-500 hover:text-gray-700">返回网站</button>}
                </div>
            </div>
        );
    }

    return (
        <div className={containerClasses} style={containerStyle}>
            <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onNew={() => createNewConversation()} onDelete={handleDeleteConversation} onRename={handleRenameConversation} prompts={settings.prompts} settings={settings} />
            {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-10 md:hidden"></div> )}
            <div className="flex-1 flex flex-col h-full min-w-0 relative" data-conv-id={currentConversation?.id}>
                <div className="flex items-center justify-between py-1 px-2 border-b dark:border-gray-700 shrink-0">
                    <div className="w-10"> <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="切换侧边栏"><i className="fas fa-bars"></i></button> </div>
                    <div className="text-center flex-grow">
                        <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2>
                        {trialExpiryInfo && <div className={`text-xs font-semibold ${keyType === 'trial' ? 'text-green-500' : 'text-yellow-500'}`}>{trialExpiryInfo}</div>}
                    </div>
                    <div className="w-10 flex justify-end items-center gap-2"> <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button> {isFullScreenMode && ( <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="关闭"><i className="fas fa-times"></i></button> )} </div>
                </div>
                <div className="flex-grow p-6 overflow-y-auto bg-cover bg-center animate-bg-pan" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`}}>
                    <div className="space-y-1"> {currentConversation?.messages.map((msg, index) => ( <div id={`msg-${currentConversation.id}-${index}`} key={index}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} /> </div> ))} </div>
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-2 border-t dark:border-gray-700 shrink-0">
                    {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg text-center text-sm" onClick={()=>setError('')}>{error} <span className='text-xs'>(点击关闭)</span></div>}
                    {selectedImages.length > 0 && ( <div className="mb-2 flex gap-2 overflow-x-auto p-1"> {selectedImages.map((image, index) => ( <div key={index} className="relative w-24 h-24 object-cover rounded-lg shrink-0"> <img src={image.previewUrl} alt={`预览 ${index + 1}`} className="w-full h-full object-cover rounded-lg" /> <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs" title="移除"><i className="fas fa-times"></i></button> </div> ))} </div> )}
                    {isLoading ? ( <div className="flex justify-center items-center gap-2 text-gray-500 h-[44px]"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考中...</div> ) : (
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                            {showLeftButtons && (
                                <div ref={optionsContainerRef} className="relative">
                                    <button type="button" onClick={() => setShowMoreMenu(s => !s)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title="更多选项"> <i className="fas fa-plus-circle text-lg text-primary"></i> </button>
                                    {showMoreMenu && (
                                        <div className="absolute bottom-full mb-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                            <button type="button" onClick={() => { setShowAssistantSelector(true); setShowMoreMenu(false); }} className="w-full flex justify-between items-center text-left px-4 py-3 text-sm hover:bg-primary/10"> <span className="flex items-center"><i className="fas fa-users w-6 mr-2"></i>更换助理</span> <span className="text-xs text-gray-500 truncate max-w-[100px]">{safeGetCurrentPrompt.name}</span> </button>
                                            <button type="button" onClick={() => { setShowModelSelector(true); setShowMoreMenu(false); }} className="w-full flex justify-between items-center text-left px-4 py-3 text-sm hover:bg-primary/10"> <span className="flex items-center"><i className="fas fa-robot w-6 mr-2"></i>切换模型</span> <span className="text-xs text-gray-500 truncate max-w-[100px]">{settings.chatModels.find(m => m.value === (safeGetCurrentPrompt.model || settings.selectedModel))?.name}</span> </button>
                                            <div className="border-t my-1 dark:border-gray-700"></div>
                                            <button type="button" onClick={() => { fileInputRef.current.click(); setShowMoreMenu(false); }} className="w-full flex items-center text-left px-4 py-3 text-sm hover:bg-primary/10"><i className="fas fa-image w-6 mr-2"></i>上传图片</button>
                                            <button type="button" onClick={() => { cameraInputRef.current.click(); setShowMoreMenu(false); }} className="w-full flex items-center text-left px-4 py-3 text-sm hover:bg-primary/10"><i className="fas fa-camera w-6 mr-2"></i>拍照上传</button>
                                        </div>
                                    )}
                                    {showModelSelector && ( <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20"> {settings.chatModels.map(m => ( <button key={m.value} type="button" onClick={()=>{setSettings(s=>({...s, selectedModel: m.value})); setShowModelSelector(false);}} className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 ${settings.selectedModel === m.value ? 'text-primary font-bold' : ''}`}>{m.name}</button>))} </div> )}
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" multiple />
                            <input type="file" ref={cameraInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" capture="environment" />
                            <div className="flex-grow relative"> <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} /> <button type="button" onClick={isListening ? stopListening : startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`} title="语音输入"> <i className="fas fa-microphone"></i> </button> </div>
                            <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shrink-0" disabled={isLoading || (!userInput.trim() && selectedImages.length === 0)}><i className="fas fa-arrow-up"></i></button>
                            {!isFullScreenMode && ( <button type="button" onClick={() => console.log('This button is for non-fullscreen mode')} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title={'全屏模式'}> <i className={`fas fa-expand`}></i> </button> )}
                        </form>
                    )}
                </div>
            </div>
             {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
             {showAssistantSelector && <AssistantSelector prompts={settings.prompts} settings={settings} onSelect={(promptId) => { setSettings(s => ({...s, currentPromptId: promptId })); setShowAssistantSelector(false); }} onClose={() => setShowAssistantSelector(false)} />}
        </div>
    );
};

export default AiChatAssistant;