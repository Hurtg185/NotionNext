// /components/AiChatAssistant.js - v33: (美学重塑 & 交互体验终极优化)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AiTtsButton from './AiTtsButton';

// 辅助函数，自动将GitHub的网页链接转换为原始图片链接
const convertGitHubUrl = (url) => {
    if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) {
        return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return url;
};


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

// 新增：为消息气泡增加动画效果
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);
    const hasBeenReadRef = useRef(false);

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
    
    // 新增：美化用户消息气泡的样式
    const userBubbleClass = 'bg-gradient-to-br from-primary to-blue-600 text-white rounded-br-lg';
    const aiBubbleClass = 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm';

    return (
        <div ref={messageRef} className={`flex items-end gap-2.5 my-2 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}>
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
            {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
        </div>
    );
};

// 新增：聊天记录管理菜单
const ConversationMenu = ({ onRename, onDelete }) => (
    <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-10">
        <button onClick={onRename} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-pen w-4"></i>重命名</button>
        <button onClick={onDelete} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"><i className="fas fa-trash w-4"></i>删除</button>
    </div>
);

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const [activeMenu, setActiveMenu] = useState(null); // 控制哪个菜单是打开的

    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); setActiveMenu(null); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };

    const groupedConversations = useMemo(() => {
        // ... (grouping logic remains the same)
        const groups = new Map();
        const uncategorized = [];

        conversations.forEach(conv => {
            const promptId = conv.promptId;
            if (promptId && prompts.some(p => p.id === promptId)) {
                if (!groups.has(promptId)) {
                    groups.set(promptId, []);
                }
                groups.get(promptId).push(conv);
            } else {
                uncategorized.push(conv);
            }
        });
        
        const sortedGroups = Array.from(groups.entries()).map(([promptId, convs]) => ({
            prompt: prompts.find(p => p.id === promptId),
            conversations: convs,
        }));

        return { sortedGroups, uncategorized };
    }, [conversations, prompts]);

    const renderConversationItem = (conv) => (
        <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => onSelect(conv.id)}>
            <div className="flex-grow truncate" onDoubleClick={() => handleRename(conv.id, conv.title)}>
                {editingId === conv.id ? (
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b" autoFocus />
                ) : ( <span className="text-sm">{conv.title}</span> )}
            </div>
            {/* 修改：使用更明显的“...”菜单按钮 */}
            <div className="relative shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === conv.id ? null : conv.id); }} className={`p-1 rounded-full ${currentId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <i className="fas fa-ellipsis-h text-xs"></i>
                </button>
                {activeMenu === conv.id && (
                    <ConversationMenu 
                        onRename={() => handleRename(conv.id, conv.title)} 
                        onDelete={() => { if(window.confirm('确定删除此对话吗？')) onDelete(conv.id); setActiveMenu(null); }} 
                    />
                )}
            </div>
        </div>
    );

    return (
        <div className={`h-full bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-44 p-2' : 'w-0 p-0'} overflow-hidden`}>
            <button onClick={onNew} className="w-full flex items-center justify-between p-2 mb-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                <span>新对话</span><i className="fas fa-plus"></i>
            </button>
            <div className="flex-grow overflow-y-auto space-y-2">
                {groupedConversations.sortedGroups.map(({ prompt, conversations }) => (
                    <details key={prompt?.id} className="group" open>
                        <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none">
                            <img src={convertGitHubUrl(prompt?.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={prompt?.name} className="w-5 h-5 rounded-full object-cover"/>
                            <span className="text-xs font-semibold flex-grow">{prompt?.name}</span>
                            <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i>
                        </summary>
                        <div className="pl-3 mt-1 space-y-1">
                            {conversations.map(renderConversationItem)}
                        </div>
                    </details>
                ))}
                {groupedConversations.uncategorized.length > 0 && (
                     <details className="group" open>
                        <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none">
                            <i className="fas fa-folder w-5 h-5 text-gray-500"></i>
                            <span className="text-xs font-semibold flex-grow">未分类对话</span>
                            <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i>
                        </summary>
                        <div className="pl-3 mt-1 space-y-1">
                            {groupedConversations.uncategorized.map(renderConversationItem)}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
};

// 新增：提示词管理的专用界面
const PromptManager = ({ prompts, onBack, onChange, onAdd, onDelete, settings }) => (
    <div className="absolute inset-0 bg-white dark:bg-gray-800 p-6 flex flex-col animate-fade-in">
        <div className="flex items-center justify-between mb-4 shrink-0">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left"></i></button>
            <h3 className="text-2xl font-bold">提示词工作室</h3>
            <div className="w-8"></div>
        </div>
        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
            {prompts.map(p => (
                <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                     <div className="flex items-center justify-between">
                        <label className="flex items-center flex-grow cursor-pointer gap-2">
                           <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-6 h-6 rounded-full object-cover"/>
                           <input type="text" value={p.name} onChange={(e) => onChange(p.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full text-lg" />
                        </label>
                        <button onClick={() => onDelete(p.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button>
                    </div>
                    <textarea value={p.content} onChange={(e) => onChange(p.id, 'content', e.target.value)} placeholder="请输入提示词内容..." className="w-full mt-2 h-24 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" />
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div>
                            <label className="text-xs font-medium">模型:</label>
                            <select value={p.model || settings.selectedModel} onChange={(e) => onChange(p.id, 'model', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                {CHAT_MODELS.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="text-xs font-medium">声音:</label>
                            <select value={p.ttsVoice || settings.thirdPartyTtsVoice} onChange={(e) => onChange(p.id, 'ttsVoice', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs">
                                {/* Assuming microsoftTtsVoices is available in this scope */}
                            </select>
                        </div>
                         <div>
                            <label className="text-xs font-medium">头像 URL:</label>
                            <input type="text" value={p.avatarUrl || ''} onChange={(e) => onChange(p.id, 'avatarUrl', e.target.value)} placeholder="输入头像图片URL" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border rounded-md text-xs" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <button onClick={onAdd} className="w-full mt-4 py-2 bg-green-500 text-white rounded-md shrink-0"><i className="fas fa-plus mr-2"></i>添加新提示词</button>
    </div>
);


const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);
    const [view, setView] = useState('main'); // 'main' or 'prompts'

    // ... (useEffect for voices remains the same)
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
        const newPrompt = { id: `custom-${Date.now()}`, name: '新提示词', content: '请输入...', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' };
        const newPrompts = [...tempSettings.prompts, newPrompt];
        handleChange('prompts', newPrompts);
    };
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); };
    
    const handlePromptSettingChange = (promptId, field, value) => {
        const newPrompts = tempSettings.prompts.map(p => p.id === promptId ? { ...p, [field]: value } : p);
        handleChange('prompts', newPrompts);
    };
    
    const microsoftTtsVoices = [
        { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' },
    ];
    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' },
    ];


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}>
                {view === 'main' && (
                    <div className="p-6 h-full flex flex-col">
                        <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3>
                        <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                             <div>
                                <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                                <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                            </div>
                             <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-3">
                                 <label className="block text-sm font-medium">高级参数</label>
                                 <div className="flex items-center gap-4">
                                     <label className="text-sm shrink-0">温度: {tempSettings.temperature}</label>
                                     <input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/>
                                 </div>
                                 <div>
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="thinking-mode-toggle" className="block text-sm font-medium">关闭 2.5 系列模型思考模式</label>
                                        <input id="thinking-mode-toggle" type="checkbox" checked={tempSettings.disableThinkingMode} onChange={(e) => handleChange('disableThinkingMode', e.target.checked)} className="h-5 w-5 text-primary rounded cursor-pointer" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">开启后可大幅提升响应速度和降低成本，但可能影响复杂问题的回答质量。</p>
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
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setView('prompts')}
                                    className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <h4 className="text-lg font-bold">自定义提示词管理</h4>
                                    <i className={`fas fa-arrow-right`}></i>
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 shrink-0">
                            <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                            <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button>
                        </div>
                    </div>
                )}

                {view === 'prompts' && (
                    <PromptManager
                        prompts={tempSettings.prompts}
                        settings={tempSettings}
                        onBack={() => setView('main')}
                        onChange={handlePromptSettingChange}
                        onAdd={handleAddPrompt}
                        onDelete={handleDeletePrompt}
                    />
                )}
            </div>
        </div>
    );
};


const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '' }, { id: 'translate-myanmar', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '' } ];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
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
    // ... (All main component state remains the same)
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
    const recognitionRef = useRef(null);
    

    // ... (All main component useEffects and handlers remain the same)
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v22_final');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                parsed.prompts = parsed.prompts.map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: p.avatarUrl || '' }));
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
            localStorage.setItem('ai_assistant_settings_v22_final', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v22_final', JSON.stringify(conversations));
        }
    }, [settings, conversations, isMounted]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversations.find(c => c.id === currentConversationId)?.messages]);


    const createNewConversation = () => {
        const newId = `conv-${Date.now()}`;
        const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }], promptId: settings.currentPromptId };
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
        
        if (isRegenerate) {
            if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') {
                messagesForApi.pop();
            }
        } else {
            if (userInput.trim() === '' && selectedImages.length === 0) {
                setError('请输入文字或选择图片再发送！');
                return;
            }
            const userMessage = { role: 'user', content: userInput.trim(), images: selectedImages };
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

        try {
            const currentPrompt = settings.prompts.find(p => p.id === currentConv.promptId) || settings.prompts.find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0];
            const modelToUse = currentPrompt.model || settings.selectedModel;
            
            const history = messagesForApi.map(msg => {
                const parts = [];
                if (msg.content) parts.push({ text: msg.content });
                if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } }));
                return { role: msg.role === 'user' ? 'user' : 'model', parts };
            });

            const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ];
            
            const generationConfig = {
                temperature: settings.temperature,
                maxOutputTokens: settings.maxOutputTokens,
            };

            if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) {
                generationConfig.thinkingConfig = {
                    thinkingBudget: 0
                };
            }
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig }),
                signal,
            });

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
                errorMessage = '请求被中断，请检查网络连接。';
            }
            setError(errorMessage);
            finalMessages.push({role: 'ai', content: `抱歉，出错了: ${errorMessage}`});
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally {
            setIsLoading(false);
        }
    };
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId);
    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    const showLeftButtons = !userInput.trim() && selectedImages.length === 0;

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onNew={createNewConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} prompts={settings.prompts} settings={settings} />
            
            {isSidebarOpen && (
                <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-10 md:hidden"></div>
            )}

            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                <div className="flex items-center justify-between py-1 px-2 border-b dark:border-gray-700 shrink-0">
                    <div className="w-10">
                        <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="切换侧边栏"><i className="fas fa-bars"></i></button>
                    </div>
                    <h2 className="text-lg font-semibold truncate text-center flex-grow">{currentConversation?.title || '聊天'}</h2>
                    <div className="w-10 flex justify-end">
                        <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
                    </div>
                </div>

                <div className="flex-grow p-6 overflow-y-auto bg-cover bg-center animate-bg-pan" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`}}>
                    <div className="space-y-1">
                        {currentConversation?.messages.map((msg, index) => (
                            <MessageBubble key={`${currentConversationId}-${index}`} msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} />
                        ))}
                    </div>
                    <div ref={messagesEndRef} />
                </div>
                
                <div className="p-2 border-t dark:border-gray-700 shrink-0">
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
                    {isLoading ? ( <div className="flex justify-center items-center gap-2 text-gray-500 h-[44px]"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考中...</div> ) : (
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2">
                            {showLeftButtons && (
                                <div ref={optionsContainerRef} className="relative">
                                    <button type="button" onClick={() => setShowMoreMenu(s => !s)} className="flex items-center gap-2 group" title="切换助理或上传文件">
                                        <img src={convertGitHubUrl(currentPrompt?.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt="AI助理头像" className="w-9 h-9 rounded-full object-cover shadow-md group-hover:shadow-lg ring-2 ring-white/50 dark:ring-gray-900/50 transition-all" />
                                        <span className="font-semibold text-sm text-primary">{currentPrompt?.name || "Ai助理"}</span>
                                    </button>
                                    {showMoreMenu && (
                                        <div className="absolute bottom-full mb-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-20">
                                            <button type="button" onClick={() => { setShowModelSelector(true); setShowMoreMenu(false); }} className="w-full flex justify-between items-center text-left px-4 py-3 text-sm hover:bg-primary/10">
                                                <span className="flex items-center"><i className="fas fa-robot w-6 mr-2"></i>切换模型</span>
                                                <span className="text-xs text-gray-500 truncate max-w-[100px]">{CHAT_MODELS.find(m => m.value === (currentPrompt?.model || settings.selectedModel))?.name}</span>
                                            </button>
                                            <button type="button" onClick={() => { setShowPromptSelector(true); setShowMoreMenu(false); }} className="w-full flex justify-between items-center text-left px-4 py-3 text-sm hover:bg-primary/10">
                                                <span className="flex items-center"><i className="fas fa-magic w-6 mr-2"></i>切换提示词</span>
                                                <span className="text-xs text-gray-500 truncate max-w-[100px]">{currentPrompt?.name}</span>
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
