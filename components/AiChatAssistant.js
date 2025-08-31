// /components/AiChatAssistant.js - v29: 引入对话分组与移动功能 (无依赖版)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton'; // 假设 AiTtsButton.js 在同级目录

export const TTS_ENGINE = {
    GEMINI_TTS: 'gemini_tts',
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

// NEW: 拖拽功能的 Hook (简化版，无需外部库)
const useDraggable = ({ onDrop }) => {
    const [dragItem, setDragItem] = useState(null);
    const [dragOverItem, setDragOverItem] = useState(null);

    const handleDragStart = (e, item) => {
        setDragItem(item);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(item));
    };
    const handleDragEnter = (e, item) => {
        setDragOverItem(item);
    };
    const handleDragLeave = (e) => {
        setDragOverItem(null);
    };
    const handleDragEnd = (e) => {
        if (dragItem && dragOverItem) {
            onDrop(dragItem, dragOverItem);
        }
        setDragItem(null);
        setDragOverItem(null);
    };

    return {
        dragItem,
        dragOverItem,
        handleDragStart,
        handleDragEnter,
        handleDragLeave,
        handleDragEnd
    };
};

const ChatSidebar = ({ isOpen, conversationGroups, currentId, onSelect, onNew, onDelete, onRename, onNewGroup, onMoveConversation }) => {
    const { dragItem, dragOverItem, handleDragStart, handleDragEnter, handleDragLeave, handleDragEnd } = useDraggable({ onDrop: onMoveConversation });

    return (
        <div className={`h-full bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r dark:border-gray-700 transition-all duration-300 ${isOpen ? 'w-64 p-2' : 'w-0 p-0'} overflow-hidden`}>
            <div className="flex gap-2 mb-2">
                <button onClick={onNew} className="flex-1 flex items-center justify-center p-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                    <i className="fas fa-plus mr-2"></i> 新对话
                </button>
                <button onClick={onNewGroup} className="flex-1 flex items-center justify-center p-2 rounded-md border border-dashed hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                    <i className="fas fa-folder-plus mr-2"></i> 新分组
                </button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {conversationGroups.map((group, groupIndex) => (
                    <div key={group.id} onDragEnter={(e) => handleDragEnter(e, { type: 'group', id: group.id, index: groupIndex })}>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mt-2 px-2">{group.name}</h4>
                        {group.conversations.map((conv, convIndex) => (
                            <div
                                key={conv.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, { type: 'conversation', id: conv.id, fromGroupIndex: groupIndex, fromConvIndex: convIndex })}
                                onDragEnter={(e) => handleDragEnter(e, { type: 'conversation', id: conv.id, toGroupIndex: groupIndex, toConvIndex: convIndex })}
                                onDragEnd={handleDragEnd}
                                onDragLeave={handleDragLeave}
                                className={`group flex items-center p-2 rounded-md cursor-pointer ${currentId === conv.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} ${dragOverItem?.id === conv.id ? 'border-t-2 border-primary' : ''}`}
                                onClick={() => onSelect(conv.id)}
                            >
                                {/* ... (对话项的UI，与 v27 相同) ... */}
                            </div>
                        ))}
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
        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' }, { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' }, { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }, { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' }, { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
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
                                <option value={TTS_ENGINE.GEMINI_TTS}>Gemini TTS (推荐, 免费)</option>
                                <option value={TTS_ENGINE.THIRD_PARTY}>第三方 API</option>
                                <option value={TTS_ENGINE.SYSTEM}>系统内置</option>
                            </select>
                        </div>
                        {/* ... (其他 TTS 设置保持不变) ... */}
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
    autoRead: false,
    ttsEngine: TTS_ENGINE.GEMINI_TTS, // 默认使用 Gemini TTS
    geminiTtsModel: 'gemini-2.5-flash-preview-tts',
    geminiTtsVoice: 'Zephyr',
    thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI: '',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// ... (useGeminiChat Hook 保持不变) ...

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [conversationGroups, setConversationGroups] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    // ... (其他 state 保持不变)

    const handleDragEnd = (result) => {
        const { source, destination } = result;
        if (!destination) return;

        setConversationGroups(prevGroups => {
            const newGroups = JSON.parse(JSON.stringify(prevGroups));
            const sourceGroup = newGroups.find(g => g.id === source.droppableId);
            const destGroup = newGroups.find(g => g.id === destination.droppableId);
            const [movedConversation] = sourceGroup.conversations.splice(source.index, 1);
            destGroup.conversations.splice(destination.index, 0, movedConversation);
            return newGroups;
        });
    };
    
    // ... (其他 handlers 需要适配新的 conversationGroups 数据结构)

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl ...`}>
            <ChatSidebar
                isOpen={isSidebarOpen}
                conversationGroups={conversationGroups}
                // ... (其他 props)
                onDragEnd={handleDragEnd}
            />
            {/* ... (其他 JSX 结构) */}
        </div>
    );
};

export default AiChatAssistant;
