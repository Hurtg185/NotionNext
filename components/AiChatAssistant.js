// /components/AiChatAssistant.js - v66.0 (Feature Update & Logic Fix)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// --- 辅助函数 (有修改) ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const safeLocalStorageRemove = (key) => { if (typeof window !== 'undefined') { localStorage.removeItem(key); } };
// 新增：替代 uuid 的简单 ID 生成器
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- 常量定义 (有修改) ---
export const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };
const CHAT_MODELS_LIST = [ { id: 'model-1', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 8192 }, { id: 'model-2', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 8192 }, { id: 'model-3', name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', maxContextTokens: 4096 }, { id: 'model-4', name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest', maxContextTokens: 8192 }, { id: 'model-5', name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest', maxContextTokens: 8192 }, ];
const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', openingLine: '你好，请发送你需要我纠正的中文句子。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', openingLine: '你好，请问你想了解哪个中文词语？', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '' }, { id: 'translate-myanmar', name: '中缅互译', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', openingLine: '你好！请发送中文或缅甸语内容以进行翻译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '' } ];
// 移除 searchMode, ttsConfig中的rate和pitch, 新增 activeKnowledgeBases, backgroundOpacity
const DEFAULT_SETTINGS = { apiKey: '', apiKeys: [], activeApiKeyId: '', chatModels: CHAT_MODELS_LIST, selectedModel: 'gemini-2.5-flash', temperature: 0.8, maxOutputTokens: 2048, disableThinkingMode: true, startWithNewChat: false, prompts: DEFAULT_PROMPTS, currentPromptId: DEFAULT_PROMPTS[0]?.id || '', autoRead: false, ttsEngine: TTS_ENGINE.THIRD_PARTY, thirdPartyTtsConfig: { provider: 'microsoft', microsoftVoice: 'zh-CN-XiaoxiaoMultilingualNeural', apiUrl: '', apiKey: '', model: 'tts-1', voice: 'alloy', }, systemTtsVoiceURI: '', speechLanguage: 'zh-CN', chatBackgroundUrl: '/images/chat-bg-light.jpg', backgroundOpacity: 50, userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: '/images/ai-avatar.png', isFacebookApp: false, activeKnowledgeBases: [], };

// --- 内部 TTS 组件 (新增) ---
// 遵照要求，废弃外部TTS组件，创建基于“晓辰专用版”逻辑的新组件
const AiTtsButton = ({ text, ttsSettings }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);

    const cleanTextForSpeech = (rawText) => {
        if (!rawText) return '';
        let cleaned = rawText.replace(/【.*?】|\[.*?\]/g, ''); // 移除方括号内容
        const pinyinRegex = /\b[a-zA-ZüÜ]+[1-5]\b\s*/g;
        cleaned = cleaned.replace(pinyinRegex, ''); // 移除非正式拼音
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        cleaned = cleaned.replace(emojiRegex, ''); // 移除 Emoji
        return cleaned.trim();
    };
    
    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsPlaying(false);
    }, []);

    const startPlayback = async () => {
        if (isPlaying) {
            stopPlayback();
            return;
        }
        
        const cleanedText = cleanTextForSpeech(text);
        if (!cleanedText) return;

        setIsPlaying(true);
        abortControllerRef.current = new AbortController();

        try {
            // 固定使用 Microsoft Azure TTS, 这是确保稳定性的核心
            const region = 'eastus'; // 示例区域，可根据实际情况修改
            const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
            
            // 这是一个临时的、用于前端演示的Key，实际生产中强烈建议在后端处理
            const tempApiKey = 'YOUR_MICROSOFT_AZURE_TTS_API_KEY'; // 注意：此密钥应从安全的环境变量中获取
            const voice = ttsSettings.thirdPartyTtsConfig.microsoftVoice || 'zh-CN-XiaochenMultilingualNeural';
            
            // 遵照要求，固定语速为 -30%
            const rate = -30;
            const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${voice}'><prosody rate='${rate}%' pitch='0%'>${cleanedText}</prosody></voice></speak>`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': tempApiKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                    'User-Agent': 'AiChatAssistant'
                },
                body: ssml,
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`TTS API request failed with status ${response.status}`);
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            
            audioRef.current = new Audio(audioUrl);
            audioRef.current.play();
            audioRef.current.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
            };

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error playing TTS:', error);
            }
            setIsPlaying(false);
        }
    };
    
    // 清理副作用
    useEffect(() => {
        return () => stopPlayback();
    }, [stopPlayback]);

    return (
        <button onClick={startPlayback} className="p-2 rounded-full hover:bg-black/10" title="朗读">
            <i className={`fas ${isPlaying ? 'fa-stop-circle animate-pulse text-primary' : 'fa-play-circle'}`}></i>
        </button>
    );
};


// --- 子组件 (无变化) ---
const TypingEffect = ({ text, onComplete, onUpdate }) => {
    const [displayedText, setDisplayedText] = useState('');
    useEffect(() => {
        if (!text) return; setDisplayedText(''); let index = 0;
        const intervalId = setInterval(() => {
            setDisplayedText(prev => prev + text.charAt(index));
            index++;
            if (onUpdate) onUpdate();
            if (index >= text.length) { clearInterval(intervalId); if (onComplete) onComplete(); }
        }, 30);
        return () => clearInterval(intervalId);
    }, [text, onComplete, onUpdate]);
    return <SimpleMarkdown text={displayedText} />;
};
const SimpleMarkdown = ({ text }) => { if (!text) return null; const lines = text.split('\n').map((line, index) => { if (line.trim() === '') return <br key={index} />; if (line.match(/\*\*(.*?)\*\*/)) { const content = line.replace(/\*\*/g, ''); return <strong key={index} className="block mt-2 mb-1">{content}</strong>; } if (line.startsWith('* ') || line.startsWith('- ')) { return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>; } return <p key={index} className="my-1">{line}</p>; }); return <div>{lines}</div>; };
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate, onTypingComplete, onTypingUpdate }) => {
    const isUser = msg.role === 'user';
    const userBubbleClass = 'bg-blue-500 text-white rounded-br-lg shadow-[0_5px_15px_rgba(59,130,246,0.3),_0_12px_28px_rgba(59,130,246,0.2)]';
    const aiBubbleClass = 'bg-white border border-gray-200/50 shadow-[0_5px_15px_rgba(0,0,0,0.12),_0_15px_35px_rgba(0,0,0,0.08)]';
    return (
        <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0 shadow-sm" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col transition-shadow duration-300 ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}>
                {msg.images && msg.images.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)}</div>)}
                <div className={`prose prose-sm max-w-none prose-p:my-1 ${isUser ? 'prose-white' : 'text-gray-800'}`}>
                    {isLastAiMessage && msg.isTyping ? <TypingEffect text={msg.content || ''} onComplete={onTypingComplete} onUpdate={onTypingUpdate} /> : <SimpleMarkdown text={msg.content || ''} />}
                </div>
                {!isUser && msg.content && !msg.isTyping && (
                    <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500">
                        {settings.isFacebookApp && <span className="text-sm text-red-400" title="Facebook App内浏览器不支持语音功能">语音不可用</span>}
                        {!settings.isFacebookApp && <AiTtsButton text={msg.content} ttsSettings={settings} />}
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }} className="p-2 rounded-full hover:bg-black/10" title="复制"><i className="fas fa-copy"></i></button>
                        {isLastAiMessage && (<button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-2 rounded-full hover:bg-black/10" title="重新生成"><i className="fas fa-sync-alt"></i></button>)}
                    </div>
                )}
            </div>
            {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0 shadow-sm" />}
        </div>
    );
};
const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };
    const groupedConversations = useMemo(() => {
        const groups = new Map();
        const uncategorized = [];
        (conversations || []).forEach(conv => {
            const promptId = conv.promptId;
            const prompt = (prompts || []).find(p => p.id === promptId);
            if (prompt) { if (!groups.has(promptId)) { groups.set(promptId, { prompt, conversations: [] }); } groups.get(promptId).conversations.push(conv); } else { uncategorized.push(conv); }
        });
        return { sortedGroups: Array.from(groups.values()), uncategorized };
    }, [conversations, prompts]);
    const renderConversationItem = (conv) => (
        <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer transition-all duration-200 ${currentId === conv.id ? 'bg-primary/10' : 'hover:bg-gray-200/50'}`} onClick={() => onSelect(conv.id)}>
            <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}>
                {editingId === conv.id ? ( <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b border-gray-400" autoFocus /> ) : ( <span className={`text-sm ${currentId === conv.id ? 'text-primary font-semibold' : ''}`}>{conv.title}</span> )}
            </div>
            <div className={`flex items-center shrink-0 space-x-1 transition-opacity ${currentId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-2 rounded-full hover:bg-gray-300" title="重命名"><i className="fas fa-pen w-3 h-3"></i></button>
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-2 rounded-full text-red-500 hover:bg-red-500/10" title="删除"><i className="fas fa-trash w-3 h-3"></i></button>
            </div>
        </div>
    );
    return (
        <div className={`h-full bg-gray-100/90 backdrop-blur-md flex flex-col transition-all duration-300 z-30 ${isOpen ? 'w-60 p-3 shadow-[10px_0px_20px_rgba(0,0,0,0.1)]' : 'w-0 p-0'} overflow-hidden`}>
             <button onClick={onNew} className="flex items-center justify-center w-full p-2 mb-3 text-sm font-semibold text-gray-700 bg-white/70 rounded-lg hover:bg-gray-200/50 border border-gray-200/80 shadow-sm transition-all"> <i className="fas fa-plus mr-2"></i> 新对话 </button>
            <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
                {groupedConversations.sortedGroups.map(({ prompt, conversations }) => ( <details key={prompt.id} className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 list-none"> <img src={convertGitHubUrl(prompt.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={prompt.name} className="w-5 h-5 rounded-full object-cover" /> <span className="text-xs font-semibold flex-grow">{prompt.name}</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(conversations || []).map(renderConversationItem)} </div> </details> ))}
                {groupedConversations.uncategorized.length > 0 && ( <details className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 list-none"> <i className="fas fa-folder w-5 h-5 text-gray-500"></i> <span className="text-xs font-semibold flex-grow">未分类对话</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(groupedConversations.uncategorized || []).map(renderConversationItem)} </div> </details> )}
            </div>
        </div>
    );
};
const SubPageWrapper = ({ title, onBack, children }) => (
    <div className="p-6 h-full flex flex-col">
        <h3 className="text-2xl font-bold mb-4 shrink-0">{title}</h3>
        <div className="flex-grow overflow-y-auto pr-2">{children}</div>
        <button onClick={onBack} className="fixed bottom-8 right-8 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center z-10 hover:bg-gray-900 active:scale-95 transition-all">
            <i className="fas fa-arrow-left text-xl"></i>
        </button>
    </div>
);
const PromptManager = ({ prompts, onChange, onAdd, onDelete, settings, microsoftTtsVoices }) => ( <> {(prompts || []).map(p => ( <div key={p.id} className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-2"> <div className="flex items-center justify-between"> <label className="flex items-center flex-grow cursor-pointer gap-2"> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-6 h-6 rounded-full object-cover"/> <input type="text" value={p.name} onChange={(e) => onChange(p.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full text-lg" /> </label> <button onClick={() => onDelete(p.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> {p.id.startsWith('default-') ? ( <div className="w-full h-24 p-2 bg-gray-100 border rounded-md text-sm text-gray-500 italic flex items-center justify-center">[内置提示词，内容已隐藏]</div> ) : ( <textarea value={p.content} onChange={(e) => onChange(p.id, 'content', e.target.value)} placeholder="请输入系统提示词 (System Prompt)..." className="w-full h-24 p-2 bg-white border rounded-md text-sm" /> )} <textarea value={p.openingLine || ''} onChange={(e) => onChange(p.id, 'openingLine', e.target.value)} placeholder="请输入AI第一句开场白..." className="w-full p-2 bg-white border rounded-md text-sm" /> <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"> <div><label className="text-xs font-medium">模型:</label><select value={p.model || settings.selectedModel} onChange={(e) => onChange(p.id, 'model', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs">{(settings.chatModels || []).map(m => <option key={m.id} value={m.value}>{m.name}</option>)}</select></div> <div><label className="text-xs font-medium">声音 (Microsoft):</label><select value={p.ttsVoice || settings.thirdPartyTtsConfig.microsoftVoice} onChange={(e) => onChange(p.id, 'ttsVoice', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs">{(microsoftTtsVoices || []).map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div> <div><label className="text-xs font-medium">头像 URL:</label><input type="text" value={p.avatarUrl || ''} onChange={(e) => onChange(p.id, 'avatarUrl', e.target.value)} placeholder="输入头像图片URL" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /></div> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-green-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新提示词</button> </> );
const ModelManager = ({ models, onChange, onAdd, onDelete }) => ( <> {(models || []).map(m => ( <div key={m.id} className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-2"> <div className="flex items-center justify-between"> <input type="text" value={m.name} onChange={(e) => onChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="font-semibold bg-transparent w-full text-lg" /> <button onClick={() => onDelete(m.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div> <label className="text-xs font-medium">模型值 (Value)</label> <input type="text" value={m.value} onChange={(e) => onChange(m.id, 'value', e.target.value)} placeholder="例如: gemini-1.5-pro-latest" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /> </div> <div> <label className="text-xs font-medium">最大上下文 (Tokens)</label> <input type="number" value={m.maxContextTokens} onChange={(e) => onChange(m.id, 'maxContextTokens', parseInt(e.target.value, 10) || 0)} placeholder="例如: 8192" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /> </div> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-blue-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新模型</button> </> );
const ApiKeyManager = ({ apiKeys, activeApiKeyId, onChange, onAdd, onDelete, onSetActive }) => ( <> {(apiKeys || []).map(k => ( <div key={k.id} className={`p-3 rounded-md border-2 ${activeApiKeyId === k.id ? 'border-primary bg-primary/10' : 'border-gray-200 bg-gray-50'}`}> <div className="flex items-center justify-between mb-2"> <select value={k.provider} onChange={(e) => onChange(k.id, 'provider', e.target.value)} className="font-semibold bg-transparent text-lg"> <option value="gemini">Google Gemini</option> <option value="openai">OpenAI 兼容</option> </select> <div className="flex items-center gap-2"> <button onClick={() => onSetActive(k.id)} disabled={activeApiKeyId === k.id} className="px-2 py-1 text-xs bg-green-500 text-white rounded disabled:bg-gray-400">设为当前</button> <button onClick={() => onDelete(k.id)} className="p-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> </div> {k.provider === 'openai' && ( <div> <label className="text-xs font-medium">API 接口地址 (URL)</label> <input type="text" value={k.url || ''} onChange={(e) => onChange(k.id, 'url', e.target.value)} placeholder="例如: https://api.openai.com/v1" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /> </div> )} <div className="mt-2"> <label className="text-xs font-medium">API 密钥 (Key)</label> <input type="password" value={k.key} onChange={(e) => onChange(k.id, 'key', e.target.value)} placeholder="请输入密钥" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-indigo-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新密钥</button> </> );
const KnowledgeBaseManager = () => ( <div className="text-center text-gray-500 py-10"> <i className="fas fa-book text-4xl mb-4"></i> <h3 className="text-xl font-bold">知识库管理</h3> <p>此功能正在开发中，敬请期待！</p> </div> );


// --- Settings Modal Component (有修改) ---
const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [systemVoices, setSystemVoices] = useState([]); const [view, setView] = useState('main'); const fileInputRef = useRef(null); useEffect(() => { const fetchSystemVoices = () => { if (!window.speechSynthesis) return; const voices = window.speechSynthesis.getVoices(); if (voices.length > 0) { setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi'))); } }; if (window.speechSynthesis) { if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; } fetchSystemVoices(); } }, []); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleTtsConfigChange = (key, value) => { setTempSettings(prev => ({ ...prev, thirdPartyTtsConfig: { ...prev.thirdPartyTtsConfig, [key]: value } })); }; const handleBgImageSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { handleChange('chatBackgroundUrl', e.target.result); }; reader.readAsDataURL(file); } event.target.value = null; }; const handleAddPrompt = () => { const newPrompt = { id: generateSimpleId('prompt'), name: '新助理', content: '你是一个...', openingLine: '你好，我是你的新助理。', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }; const newPrompts = [...(tempSettings.prompts || []), newPrompt]; handleChange('prompts', newPrompts); }; const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = (tempSettings.prompts || []).filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); }; const handlePromptSettingChange = (promptId, field, value) => { const newPrompts = (tempSettings.prompts || []).map(p => p.id === promptId ? { ...p, [field]: value } : p); handleChange('prompts', newPrompts); }; const microsoftTtsVoices = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓晓 (女, 亲切)', value: 'zh-CN-XiaoxiaoNeural' }, { name: '晓颜 (女)', value: 'zh-CN-XiaoyanNeural'}, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '云健 (男, 沉稳)', value: 'zh-CN-YunjianNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Steffan (男, 美国, 多语言)', value: 'en-US-SteffanMultilingualNeural' }, { name: 'Vivienne (女, 法国, 多语言)', value: 'fr-FR-VivienneMultilingualNeural' }, { name: 'Remy (男, 法国, 多语言)', value: 'fr-FR-RemyMultilingualNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, { name: '怀眉 (女, 越南)', value: 'vi-VN-HoaiMyNeural' }, { name: '南明 (男, 越南)', value: 'vi-VN-NamMinhNeural' }, ]; const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ]; const handleAddModel = () => { const newModel = { id: generateSimpleId('model'), name: '新模型', value: '', maxContextTokens: 8192 }; const newModels = [...(tempSettings.chatModels || []), newModel]; handleChange('chatModels', newModels); }; const handleDeleteModel = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newModels = (tempSettings.chatModels || []).filter(m => m.id !== idToDelete); handleChange('chatModels', newModels); }; const handleModelSettingChange = (modelId, field, value) => { const newModels = (tempSettings.chatModels || []).map(m => m.id === modelId ? { ...m, [field]: value } : m); handleChange('chatModels', newModels); }; const handleAddApiKey = () => { const newKey = { id: generateSimpleId('key'), provider: 'gemini', key: '', url: 'https://generativelanguage.googleapis.com/v1beta/models/' }; const newKeys = [...(tempSettings.apiKeys || []), newKey]; handleChange('apiKeys', newKeys); }; const handleDeleteApiKey = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newKeys = (tempSettings.apiKeys || []).filter(k => k.id !== idToDelete); handleChange('apiKeys', newKeys); if (tempSettings.activeApiKeyId === idToDelete) handleChange('activeApiKeyId', newKeys[0]?.id || ''); }; const handleApiKeySettingChange = (keyId, field, value) => { const newKeys = (tempSettings.apiKeys || []).map(k => k.id === keyId ? { ...k, [field]: value } : k); handleChange('apiKeys', newKeys); }; const handleSetActiveApiKey = (keyId) => { handleChange('activeApiKeyId', keyId); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}>
                {view === 'main' && ( <div className="p-6 h-full flex flex-col"> <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3> <div className="space-y-4 flex-grow overflow-y-auto pr-2"> <button type="button" onClick={() => setView('apiKeys')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"><h4 className="text-lg font-bold">API 密钥管理</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('prompts')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"><h4 className="text-lg font-bold">助理工作室</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('models')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"><h4 className="text-lg font-bold">模型管理</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('knowledgeBases')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"><h4 className="text-lg font-bold">知识库管理</h4><i className={`fas fa-arrow-right`}></i></button> <div><label className="block text-sm font-medium mb-1">聊天背景图片</label><div className="flex gap-2"><input type="text" value={tempSettings.chatBackgroundUrl} onChange={(e) => handleChange('chatBackgroundUrl', e.target.value)} placeholder="输入URL或从本地上传" className="w-full px-3 py-2 bg-gray-100 border rounded-md" /><input type="file" ref={fileInputRef} onChange={handleBgImageSelect} accept="image/*" className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-600 text-white rounded-md shrink-0 hover:bg-gray-700">上传</button></div></div><div className="flex items-center gap-4"><label className="text-sm shrink-0">背景图透明度: {tempSettings.backgroundOpacity}%</label><input type="range" min="0" max="100" step="1" value={tempSettings.backgroundOpacity} onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))} className="w-full"/></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">始终开启新对话</label><input type="checkbox" checked={tempSettings.startWithNewChat} onChange={(e) => handleChange('startWithNewChat', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div> <div className="p-3 bg-gray-50 rounded-md space-y-3"><label className="block text-sm font-medium">高级参数</label><div className="flex items-center gap-4"><label className="text-sm shrink-0">温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div><div><div className="flex items-center justify-between"><label htmlFor="thinking-mode-toggle" className="block text-sm font-medium">关闭 2.5 系列模型思考模式</label><input id="thinking-mode-toggle" type="checkbox" checked={tempSettings.disableThinkingMode} onChange={(e) => handleChange('disableThinkingMode', e.target.checked)} className="h-5 w-5 text-primary rounded cursor-pointer" /></div><p className="text-xs text-gray-500 mt-1">开启后可大幅提升响应速度和降低成本，但可能影响复杂问题的回答质量。</p></div></div> <div className="p-3 bg-gray-50 rounded-md space-y-4"><h4 className="text-md font-semibold">朗读设置</h4><div><label className="block text-sm font-medium mb-1">朗读引擎</label><select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 border rounded-md"><option value={TTS_ENGINE.THIRD_PARTY}>第三方 API (音质更好)</option><option value={TTS_ENGINE.SYSTEM}>系统内置 (速度快)</option></select></div>{tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (<div className="space-y-2 mt-2"><div><label className="block text-sm font-medium mb-1">第三方引擎类型</label><select value={tempSettings.thirdPartyTtsConfig.provider} onChange={(e) => handleTtsConfigChange('provider', e.target.value)} className="w-full px-3 py-2 bg-gray-100 border rounded-md"><option value="microsoft">Microsoft Azure (内置)</option><option value="openai">OpenAI TTS 兼容 API</option></select></div>{tempSettings.thirdPartyTtsConfig.provider === 'microsoft' ? (<div><label className="block text-sm font-medium mb-1">发音人 (Microsoft)</label><select value={tempSettings.thirdPartyTtsConfig.microsoftVoice} onChange={(e) => handleTtsConfigChange('microsoftVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 border rounded-md">{microsoftTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div>) : (<div className="space-y-2 p-3 border rounded-md bg-gray-200/50"><div><label className="block text-xs font-medium">API 基础 URL</label><input type="text" value={tempSettings.thirdPartyTtsConfig.apiUrl} onChange={(e) => handleTtsConfigChange('apiUrl', e.target.value)} placeholder="https://api.openai.com/v1" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /></div><div><label className="block text-xs font-medium">API 密钥</label><input type="password" value={tempSettings.thirdPartyTtsConfig.apiKey} onChange={(e) => handleTtsConfigChange('apiKey', e.target.value)} placeholder="请输入密钥" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /></div><div><label className="block text-xs font-medium">模型</label><input type="text" value={tempSettings.thirdPartyTtsConfig.model} onChange={(e) => handleTtsConfigChange('model', e.target.value)} placeholder="例如: tts-1" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /></div><div><label className="block text-xs font-medium">发音人 (Voice)</label><input type="text" value={tempSettings.thirdPartyTtsConfig.voice} onChange={(e) => handleTtsConfigChange('voice', e.target.value)} placeholder="例如: alloy" className="w-full mt-1 px-2 py-1 bg-white border rounded-md text-xs" /></div></div>)}</div>)}{tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (<div><label className="block text-sm font-medium mb-1">发音人 (系统)</label>{systemVoices.length > 0 ? (<select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 border rounded-md"><option value="">浏览器默认</option>{systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}</select>) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}</div>)}</div> <div><label className="block text-sm font-medium mb-1">语音识别语言</label><select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 border rounded-md">{speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">AI 回复后自动朗读</label><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div> </div> <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button></div> </div> )}
                {view === 'prompts' && <SubPageWrapper title="助理工作室" onBack={() => setView('main')}><PromptManager prompts={tempSettings.prompts} settings={tempSettings} onChange={handlePromptSettingChange} onAdd={handleAddPrompt} onDelete={handleDeletePrompt} microsoftTtsVoices={microsoftTtsVoices} /></SubPageWrapper>}
                {view === 'models' && <SubPageWrapper title="模型管理" onBack={() => setView('main')}><ModelManager models={tempSettings.chatModels} onChange={handleModelSettingChange} onAdd={handleAddModel} onDelete={handleDeleteModel} /></SubPageWrapper>}
                {view === 'apiKeys' && <SubPageWrapper title="API 密钥管理" onBack={() => setView('main')}><ApiKeyManager apiKeys={tempSettings.apiKeys} activeApiKeyId={tempSettings.activeApiKeyId} onChange={handleApiKeySettingChange} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} onSetActive={handleSetActiveApiKey} /></SubPageWrapper>}
                {view === 'knowledgeBases' && <SubPageWrapper title="知识库管理" onBack={() => setView('main')}><KnowledgeBaseManager /></SubPageWrapper>}
            </div>
        </div>
    );
};
const ModelSelector = ({ settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 text-center relative"> <h3 className="text-lg font-bold">切换模型</h3> <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200"><i className="fas fa-times"></i></button> </div> <div className="p-2 overflow-y-auto max-h-[60vh]"> {(settings.chatModels || []).map(m => ( <button key={m.id} type="button" onClick={() => { onSelect(m.value); onClose(); }} className={`w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-primary/10 ${settings.selectedModel === m.value ? 'text-primary font-bold bg-primary/10' : ''}`}>{m.name}</button> ))} </div> </div> </div> );
const AssistantSelector = ({ prompts, settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-2xl m-auto bg-white rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 text-center relative"><h3 className="text-lg font-bold">更换助理</h3><button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200"><i className="fas fa-times"></i></button></div> <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh]"> {(prompts || []).map(p => ( <button key={p.id} onClick={() => onSelect(p.id)} className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${settings.currentPromptId === p.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-gray-100'}`}> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-16 h-16 rounded-full object-cover mb-2 shadow-md"/> <span className="text-sm font-semibold text-center">{p.name}</span> </button> ))} </div> </div> </div> );
const KnowledgeBaseSelector = ({ settings, onSave, onClose }) => { const [activeBases, setActiveBases] = useState(settings.activeKnowledgeBases || []); const allKnowledgeBases = [ { id: 'hsk1', name: 'HSK 1 词库' }, { id: 'hsk2', name: 'HSK 2 词库' }, { id: 'hsk3', name: 'HSK 3 词库' }, { id: 'hsk4', name: 'HSK 4 词库' }, { id: 'hsk5', name: 'HSK 5 词库' }, { id: 'hsk6', name: 'HSK 6 词库' }, { id: 'my_vocab', name: '我的生词本' }, ]; const handleToggle = (baseId) => { setActiveBases(prev => prev.includes(baseId) ? prev.filter(id => id !== baseId) : [...prev, baseId]); }; const handleSave = () => { onSave(activeBases); onClose(); }; return ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <h3 className="text-lg font-bold p-4 border-b">选择知识库</h3> <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]"> {allKnowledgeBases.map(kb => ( <label key={kb.id} className="flex items-center p-3 rounded-lg hover:bg-gray-100 cursor-pointer"> <input type="checkbox" checked={activeBases.includes(kb.id)} onChange={() => handleToggle(kb.id)} className="h-5 w-5 rounded text-primary focus:ring-primary" /> <span className="ml-3 text-gray-800">{kb.name}</span> </label> ))} </div> <div className="p-4 border-t flex justify-end gap-3"> <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">取消</button> <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-md">确定</button> </div> </div> </div> );};


// --- Main Chat Component (有修改) ---
const AiChatAssistant = ({ onClose }) => {
    // ... (状态和Refs无变化)
    const [activationState, setActivationState] = useState('checking');
    const [activationKey, setActivationKey] = useState('');
    const [activationError, setActivationError] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [keyType, setKeyType] = useState(null);
    const [trialExpiryInfo, setTrialExpiryInfo] = useState('');
    const [trialExpiryTimestamp, setTrialExpiryTimestamp] = useState(0);
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
    const [showKnowledgeBaseSelector, setShowKnowledgeBaseSelector] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const imageInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);
    const lastAutoReadMessageId = useRef(null);

    // --- 应用初始化和激活逻辑 (有修改) ---
    const getDeviceId = async () => { try { const fp = await FingerprintJS.load(); const result = await fp.get(); return result.visitorId; } catch (e) { console.error("FingerprintJS error:", e); return 'fallback-device-id-' + Date.now(); } };
    useEffect(() => { const initializeApp = async () => { setIsMounted(true); let finalSettings = { ...DEFAULT_SETTINGS }; const savedSettings = safeLocalStorageGet('ai_assistant_settings_v66_final'); if (savedSettings) { const parsed = JSON.parse(savedSettings); parsed.prompts = (parsed.prompts || []).map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: p.avatarUrl || '' })); if (!parsed.chatModels || parsed.chatModels.length === 0) { parsed.chatModels = CHAT_MODELS_LIST; } if (!parsed.apiKeys) { parsed.apiKeys = []; } if (parsed.thirdPartyTtsVoice && !parsed.thirdPartyTtsConfig) { parsed.thirdPartyTtsConfig = { ...DEFAULT_SETTINGS.thirdPartyTtsConfig, provider: 'microsoft', microsoftVoice: parsed.thirdPartyTtsVoice, }; delete parsed.thirdPartyTtsVoice; } finalSettings = { ...DEFAULT_SETTINGS, ...parsed }; } if (typeof navigator !== 'undefined' && /FBAN|FBAV/i.test(navigator.userAgent)) { finalSettings.isFacebookApp = true; } setSettings(finalSettings); const savedConversations = safeLocalStorageGet('ai_assistant_conversations_v66_final'); const parsedConvs = savedConversations ? JSON.parse(savedConversations) : []; setConversations(parsedConvs); setActivationState('checking'); try { const deviceId = await getDeviceId(); const storedKey = safeLocalStorageGet('ai_assistant_key'); let activated = false; if (storedKey) { const response = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: storedKey, deviceId }), }); const data = await response.json(); if (response.ok && data.success) { setActivationState('activated'); setKeyType(data.keyType); if (data.keyType === 'trial') { const expiryTime = data.activatedAt + (data.durationSeconds || 0) * 1000; setTrialExpiryTimestamp(expiryTime); } else { setTrialExpiryInfo('永久授权'); } activated = true; } else { safeLocalStorageRemove('ai_assistant_key'); setActivationError(data.message || '本地激活码已失效。'); } } if (!activated) { const trialResponse = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_trial', deviceId }), }); const trialData = await trialResponse.json(); if (trialResponse.ok && trialData.success) { safeLocalStorageSet('ai_assistant_key', trialData.key); setActivationState('activated'); setKeyType(trialData.keyType); const expiryTime = trialData.activatedAt + (trialData.durationSeconds || 0) * 1000; setTrialExpiryTimestamp(expiryTime); } else { setActivationState('unactivated'); setActivationError(trialData.message || '无法自动开始试用。'); } } } catch (error) { setActivationState('unactivated'); setActivationError('网络错误，无法连接到激活服务器。'); } if (finalSettings.startWithNewChat || parsedConvs.length === 0) { createNewConversation(finalSettings.currentPromptId, true); } else { const firstConv = parsedConvs[0]; setCurrentConversationId(firstConv.id); if (firstConv.messages.length > 0) { lastAutoReadMessageId.current = firstConv.messages[firstConv.messages.length - 1]?.timestamp; } } }; initializeApp(); }, []);
    useEffect(() => { let timer; if (keyType === 'trial' && trialExpiryTimestamp > 0) { timer = setInterval(() => { const remainingMillis = trialExpiryTimestamp - Date.now(); if (remainingMillis <= 0) { setTrialExpiryInfo('试用期已结束'); setActivationState('unactivated'); safeLocalStorageRemove('ai_assistant_key'); clearInterval(timer); } else { const totalSeconds = Math.max(0, Math.floor(remainingMillis / 1000)); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; setTrialExpiryInfo(`试用中，剩余: ${minutes}分${seconds < 10 ? '0' : ''}${seconds}秒`); } }, 1000); return () => clearInterval(timer); } else if (keyType === 'permanent') { setTrialExpiryInfo('永久授权'); } return () => { if (timer) clearInterval(timer); }; }, [keyType, trialExpiryTimestamp]);
    const handleActivate = async (e) => { e.preventDefault(); if (!activationKey.trim()) { setActivationError('请输入激活码。'); return; } setIsActivating(true); setActivationError(''); try { const deviceId = await getDeviceId(); const response = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: activationKey.trim(), deviceId }), }); const data = await response.json(); if (response.ok && data.success) { safeLocalStorageSet('ai_assistant_key', activationKey.trim()); setActivationState('activated'); setKeyType(data.keyType); if (data.keyType === 'trial') { const expiryTime = data.activatedAt + (data.durationSeconds || 0) * 1000; setTrialExpiryTimestamp(expiryTime); } else { setTrialExpiryInfo('永久授权'); } } else { throw new Error(data.message || '激活失败。'); } } catch (err) { setActivationState('unactivated'); setActivationError(err.message); } finally { setIsActivating(false); } };
    
    // --- 核心hooks和函数 (有修改) ---
    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_assistant_settings_v66_final', JSON.stringify(settings)); safeLocalStorageSet('ai_assistant_conversations_v66_final', JSON.stringify(conversations)); } }, [settings, conversations, isMounted]);
    const scrollToBottom = useCallback((behavior = 'smooth') => { messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' }); }, []);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('auto'), 100); return () => clearTimeout(timeout); }, [currentConversationId, scrollToBottom]);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('smooth'), 100); return () => clearTimeout(timeout); }, [currentConversation?.messages?.length]);
    useEffect(() => { if (!currentConversation || !settings.autoRead || !isMounted || activationState !== 'activated') return; const messages = currentConversation.messages; const lastMessage = messages[messages.length - 1]; if (lastMessage && lastMessage.role === 'ai' && lastMessage.content && !lastMessage.isTyping && lastMessage.timestamp > (lastAutoReadMessageId.current || 0)) { lastAutoReadMessageId.current = lastMessage.timestamp; setTimeout(() => { const bubble = document.getElementById(`msg-${currentConversation.id}-${messages.length - 1}`); const ttsButton = bubble?.querySelector('button[title="朗读"]'); if (bubble && document.body.contains(bubble)) { ttsButton?.click(); } }, 300); } }, [currentConversation?.messages, settings.autoRead, isMounted, activationState]);
    const adjustTextareaHeight = useCallback(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, []);
    useEffect(() => { adjustTextareaHeight(); }, [userInput, adjustTextareaHeight]);
    const createNewConversation = (promptId, isInitial = false) => { const newId = generateSimpleId('conv'); const currentPrompt = (settings.prompts || []).find(p => p.id === (promptId || settings.currentPromptId)) || DEFAULT_PROMPTS[0]; const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: currentPrompt.openingLine || '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: currentPrompt.id }; if (isInitial) { lastAutoReadMessageId.current = newConv.messages[0].timestamp; } setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleSelectConversation = (id) => { const conv = conversations.find(c => c.id === id); if (conv) { lastAutoReadMessageId.current = conv.messages[conv.messages.length - 1]?.timestamp; } setCurrentConversationId(id); };
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { handleSelectConversation(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleAssistantSelect = (promptId) => { const selectedPrompt = settings.prompts.find(p => p.id === promptId); if (!selectedPrompt) return; setSettings(s => ({ ...s, currentPromptId: promptId, selectedModel: selectedPrompt.model || s.selectedModel, })); setConversations(prevConvs => prevConvs.map(c => c.id === currentConversationId ? { ...c, promptId: promptId } : c)); setShowAssistantSelector(false); };
    const startListening = useCallback(() => { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; } if (recognitionRef.current) recognitionRef.current.abort(); const recognition = new SpeechRecognition(); recognition.lang = settings.speechLanguage; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onstart = () => setIsListening(true); recognition.onresult = (e) => { const transcript = e.results[0][0].transcript.trim(); setUserInput(transcript); }; recognition.onerror = (event) => { console.error("Speech recognition error:", event.error); setError(`语音识别失败: ${event.error}`); setIsListening(false); }; recognition.onend = () => setIsListening(false); recognition.start(); recognitionRef.current = recognition; }, [settings.speechLanguage]);
    const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } }, []);
    const handleImageSelection = (event) => { const files = Array.from(event.target.files); if (files.length === 0) return; const newImages = files.slice(0, 4 - selectedImages.length); newImages.forEach(file => { const reader = new FileReader(); reader.onload = (e) => { const base64Data = e.target.result.split(',')[1]; const newImage = { previewUrl: URL.createObjectURL(file), data: base64Data, type: file.type, name: file.name }; setSelectedImages(prev => [...prev, newImage]); }; reader.readAsDataURL(file); }); event.target.value = null; };
    const triggerImageInput = () => { if (imageInputRef.current) { imageInputRef.current.removeAttribute('capture'); imageInputRef.current.click(); } };
    const triggerCameraInput = () => { if (imageInputRef.current) { imageInputRef.current.setAttribute('capture', 'environment'); imageInputRef.current.click(); } };
    const removeSelectedImage = (index) => { const imageToRemove = selectedImages[index]; if (imageToRemove) { URL.revokeObjectURL(imageToRemove.previewUrl); } setSelectedImages(prev => prev.filter((_, i) => i !== index)); };
    
    // --- 知识库模拟查询函数 ---
    const getKnowledgeBaseContext = (userInput, activeBases) => {
        if (!activeBases || activeBases.length === 0) return '';
        
        // 模拟从 localStorage 读取知识库数据
        const mockKnowledgeBases = {
            hsk1: [{ keyword: '你好', content: '你好 (nǐ hǎo) - Hello' }, { keyword: '谢谢', content: '谢谢 (xièxiè) - Thank you' }],
            my_vocab: [{ keyword: '学习', content: '学习 (xuéxí) - To study; to learn.' }, { keyword: '电脑', content: '电脑 (diànnǎo) - Computer.' }]
        };

        let matchedEntries = [];
        activeBases.forEach(baseId => {
            const baseData = mockKnowledgeBases[baseId] || [];
            baseData.forEach(entry => {
                if (userInput.includes(entry.keyword)) {
                    matchedEntries.push(entry.content);
                }
            });
        });

        if (matchedEntries.length > 0) {
            const context = matchedEntries.slice(0, 5).join('\n- ');
            return `[请优先参考以下本地知识库信息来回答]:\n- ${context}\n\n`;
        }
        return '';
    };

    // --- 核心提交逻辑 (有修改) ---
    const handleSubmit = async (isRegenerate = false) => { if (!currentConversation || isLoading || activationState !== 'activated') return; const activeKey = (settings.apiKeys || []).find(k => k.id === settings.activeApiKeyId); if (!activeKey || !activeKey.key) { setError('请在设置中配置并激活一个有效的 API 密钥。'); return; } let messagesForApi = [...currentConversation.messages]; let textToProcess = userInput.trim(); if (isRegenerate) { if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') { messagesForApi.pop(); } } else { if (!textToProcess && selectedImages.length === 0) { setError('请输入文字或添加图片后再发送！'); return; } const knowledgeContext = getKnowledgeBaseContext(textToProcess, settings.activeKnowledgeBases); const finalUserInput = knowledgeContext + textToProcess; const userMessage = { role: 'user', content: finalUserInput, images: selectedImages, timestamp: Date.now() }; const updatedMessages = [...messagesForApi, userMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages, promptId: c.promptId || settings.currentPromptId } : c)); messagesForApi = updatedMessages; setUserInput(''); setSelectedImages([]); } if (messagesForApi.length === 0) return; setIsLoading(true); setError(''); abortControllerRef.current = new AbortController(); try { const currentPrompt = (settings.prompts || []).find(p => p.id === currentConversation.promptId) || (settings.prompts || []).find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0]; const modelInfo = (settings.chatModels || []).find(m => m.value === settings.selectedModel) || (settings.chatModels || [])[0]; const modelToUse = modelInfo.value; const contextLimit = modelInfo.maxContextTokens || 8192; const contextMessages = messagesForApi.slice(-contextLimit); let response; if (activeKey.provider === 'gemini') { const history = contextMessages.map(msg => { const parts = []; if (msg.content) parts.push({ text: msg.content }); if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } })); return { role: msg.role === 'user' ? 'user' : 'model', parts }; }); const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ]; const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens }; if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) { generationConfig.thinkingConfig = { thinkingBudget: 0 }; } const url = `${activeKey.url || 'https://generativelanguage.googleapis.com/v1beta/models/'}${modelToUse}:generateContent?key=${activeKey.key}`; response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal: abortControllerRef.current.signal }); } else if (activeKey.provider === 'openai') { const messages = [ { role: 'system', content: currentPrompt.content }, ...contextMessages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content })) ]; const url = `${activeKey.url || 'https://api.openai.com/v1'}/chat/completions`; response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey.key}` }, body: JSON.stringify({ model: modelToUse, messages, temperature: settings.temperature, max_tokens: settings.maxOutputTokens, stream: false }), signal: abortControllerRef.current.signal }); } if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败 (状态码: ${response.status})`); } const data = await response.json(); let aiResponseContent; if (activeKey.provider === 'gemini') { aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text; } else { aiResponseContent = data.choices?.[0]?.message?.content; } if (!aiResponseContent) throw new Error('AI未能返回有效内容。'); const aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now(), isTyping: true }; const finalMessages = [...messagesForApi, aiMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c)); } catch (err) { const finalMessages = [...messagesForApi]; let errorMessage = `请求错误: ${err.message}`; if (err.name === 'AbortError') errorMessage = '请求被中断，请检查网络连接。'; setError(errorMessage); finalMessages.push({ role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() }); setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c)); } finally { setIsLoading(false); } };
    const handleTypingComplete = useCallback(() => { setConversations(prev => prev.map(c => { if (c.id === currentConversationId) { const updatedMessages = c.messages.map((msg, index) => index === c.messages.length - 1 ? { ...msg, isTyping: false } : msg); return { ...c, messages: updatedMessages }; } return c; })); }, [currentConversationId]);

    // --- 渲染逻辑 (有修改) ---
    if (!isMounted || activationState === 'checking') { return <div className="w-full h-full flex items-center justify-center bg-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div><p className="ml-3 text-gray-500">正在加载并检查激活状态...</p></div>; }
    if (activationState !== 'activated') { return ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cover bg-center" style={{ backgroundImage: `url('/images/jihuomatu.jpg')` }}> <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div> <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl p-8 flex flex-col items-center"> <h2 className="text-2xl font-bold mb-2 text-center text-white shadow-text">报名中文课程</h2> <p className="text-gray-200 text-sm mb-2 text-center shadow-text">【课程介绍】结合中缅教学方案，高效学习中文，价格比大部分缅甸机构更优惠！</p> <p className="text-gray-200 text-sm mb-2 text-center shadow-text">【地址】仰光某区，欢迎线下咨询！</p> <p className="text-xl font-bold text-green-400 mb-4 text-center shadow-text">【优惠价格】AI助手套餐：$50 / 月（原价$80）</p> <p className="text-gray-200 text-sm mb-4 text-center shadow-text">请通过以下方式联系我们，获取专属学习方案：</p> <div className="space-y-3 w-full mb-6"> <a href="https://t.me/yourtelegramid" target="_blank" rel="noopener noreferrer" className="block w-full text-white bg-blue-500 hover:bg-blue-600 rounded-lg py-3 text-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"><i className="fab fa-telegram-plane"></i> <span>Telegram 联系</span></a> <a href="https://line.me/ti/p/@yourlineid" target="_blank" rel="noopener noreferrer" className="block w-full text-white bg-green-500 hover:bg-green-600 rounded-lg py-3 text-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"><i className="fab fa-line"></i> <span>Line 联系</span></a> <a href="viber://chat?number=+959XXXXXXXX" target="_blank" rel="noopener noreferrer" className="block w-full text-white bg-purple-500 hover:bg-purple-600 rounded-lg py-3 text-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"><i className="fab fa-viber"></i> <span>Viber 联系</span></a> <a href="https://www.facebook.com/share/1FSxz6cm2Z" target="_blank" rel="noopener noreferrer" className="block w-full text-white bg-blue-700 hover:bg-blue-800 rounded-lg py-3 text-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"><i className="fab fa-facebook"></i> <span>Facebook 主页</span></a> </div> {activationError && <p className="text-red-400 text-sm mb-4 animate-shake">{activationError}</p>} <form onSubmit={handleActivate} className="space-y-4 w-full"> <input type="text" value={activationKey} onChange={(e) => setActivationKey(e.target.value)} placeholder="在此输入您的激活码" className="w-full px-4 py-3 text-center bg-gray-700/50 border border-gray-500/50 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"/> <button type="submit" disabled={isActivating} className="w-full py-3 px-4 bg-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 transform hover:-translate-y-1 shadow-lg"> {isActivating ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> 验证中...</>) : "立即激活"} </button> </form> </div> </div> ); }
    const showSendButton = userInput.trim().length > 0 || selectedImages.length > 0;
    
    return (
        <div className="w-full h-full flex flex-col bg-gray-100 text-gray-800">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 50) / 100 }}></div>
            <div className="absolute inset-0 bg-gray-100/20"></div>
            <div className="relative flex flex-1 min-h-0">
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} onNew={() => createNewConversation()} prompts={settings.prompts} settings={settings} />
                {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-20 md:hidden"></div> )}
                <div className="flex-1 flex flex-col h-full min-w-0 z-10">
                    <header className="flex items-center justify-between py-1 px-2 shrink-0 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 text-gray-800">
                        <div className="w-10"> <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full hover:bg-black/10" title="切换侧边栏"><i className="fas fa-bars"></i></button> </div>
                        <div className="text-center flex-grow"> <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2> {trialExpiryInfo && <div className={`text-xs font-semibold ${keyType === 'trial' ? 'text-green-600' : 'text-yellow-600'}`}>{trialExpiryInfo}</div>} </div>
                        <div className="w-10 flex justify-end"> <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-black/10" title="设置"><i className="fas fa-cog"></i></button> </div>
                    </header>
                    <main className="flex-grow p-4 overflow-y-auto">
                        <div className="space-y-1">
                            {currentConversation?.messages.map((msg, index) => ( <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} onTypingComplete={handleTypingComplete} onTypingUpdate={scrollToBottom} /> </div> ))}
                        </div>
                        <div ref={messagesEndRef} />
                    </main>
                    <footer className="flex-shrink-0 px-4 pt-2 pb-safe bg-gradient-to-t from-gray-100 via-gray-100/80 to-transparent z-10">
                        {error && <div className="mb-2 p-2 bg-red-100 text-red-800 rounded-lg text-center text-sm" onClick={()=>setError('')}>{error} <span className='text-xs'>(点击关闭)</span></div>}
                        {selectedImages.length > 0 && (<div className="max-w-2xl mx-auto mb-2 px-2"> <div className="flex items-center gap-2 overflow-x-auto p-1 bg-gray-200/50 rounded-lg"> {selectedImages.map((img, index) => ( <div key={index} className="relative shrink-0"> <img src={img.previewUrl} alt={`preview ${index}`} className="w-16 h-16 object-cover rounded-md" /> <button onClick={() => removeSelectedImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md">&times;</button> </div> ))} </div> </div>)}
                        <div className="flex items-center justify-center gap-2 mb-2 max-w-2xl mx-auto">
                           <button onClick={() => createNewConversation()} className="flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-full text-gray-700 text-xs shadow-sm hover:bg-white" title="新对话"> <i className="fas fa-plus"></i> <span>新对话</span> </button>
                           <button type="button" onClick={() => setShowModelSelector(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-full text-gray-700 text-xs shadow-sm hover:bg-white" title="切换模型"> <i className="fas fa-brain"></i> <span>模型</span> </button>
                           <button type="button" onClick={() => setShowAssistantSelector(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-full text-gray-700 text-xs shadow-sm hover:bg-white" title="更换助理"> <i className="fas fa-user-tie"></i> <span>助理</span> </button>
                           <button type="button" onClick={() => setShowKnowledgeBaseSelector(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-full text-gray-700 text-xs shadow-sm hover:bg-white" title="切换知识库"> <i className="fas fa-book"></i> <span>知识库</span> </button>
                        </div>
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end w-full max-w-2xl mx-auto p-2 bg-white backdrop-blur-sm rounded-2xl border border-gray-200/80 transition-shadow duration-300 ease-in-out hover:shadow-2xl focus-within:shadow-2xl shadow-[0_-10px_25px_rgba(0,0,0,0.1),_0_-5px_10px_rgba(0,0,0,0.06)]">
                            <input type="file" ref={imageInputRef} onChange={handleImageSelection} accept="image/*" multiple className="hidden" />
                             <div className="flex items-center flex-shrink-0 mr-1">
                                <button type="button" onClick={triggerImageInput} className="p-2 rounded-full hover:bg-gray-200" title="选择图片"><i className="fas fa-image text-xl text-gray-500"></i></button>
                                <button type="button" onClick={triggerCameraInput} className="p-2 rounded-full hover:bg-gray-200" title="拍照"><i className="fas fa-camera text-xl text-gray-500"></i></button>
                            </div>
                            <textarea ref={textareaRef} value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); } }} placeholder="与 AI 聊天..." className="flex-1 bg-transparent focus:outline-none text-gray-800 text-base resize-none overflow-hidden mx-2 py-1 leading-6 max-h-36 placeholder-gray-500" rows="1" style={{minHeight:'2.5rem'}} />
                            <div className="flex items-center flex-shrink-0 ml-1">
                                {!showSendButton ? ( <button type="button" onClick={isListening ? stopListening : startListening} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-white bg-red-500 animate-pulse' : 'text-gray-500 hover:bg-gray-200'}`} title="语音输入"> <i className="fas fa-microphone text-xl"></i> </button> ) : ( <button type="submit" className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95" disabled={isLoading}> <i className="fas fa-arrow-up text-xl"></i> </button> )}
                            </div>
                        </form>
                    </footer>
                </div>
                {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
                {showAssistantSelector && <AssistantSelector prompts={settings. prompts} settings={settings} onSelect={handleAssistantSelect} onClose={() => setShowAssistantSelector(false)} />}
                {showModelSelector && <ModelSelector settings={settings} onSelect={(modelValue) => { setSettings(s => ({...s, selectedModel: modelValue})); setShowModelSelector(false); }} onClose={() => setShowModelSelector(false)} />}
                {showKnowledgeBaseSelector && <KnowledgeBaseSelector settings={settings} onSave={(activeBases) => setSettings(s => ({ ...s, activeKnowledgeBases: activeBases }))} onClose={() => setShowKnowledgeBaseSelector(false)} />}
            </div>
        </div>
    );
};

export default AiChatAssistant;
