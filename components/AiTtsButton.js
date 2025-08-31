// /components/AiChatAssistant.js - v28: 集成独立的 AiTtsButton 组件并更新设置
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton'; // <-- 1. 导入你提供的独立按钮组件

// --- 2. 导出 TTS_ENGINE 常量，供 AiTtsButton.js 使用 ---
export const TTS_ENGINE = {
    GEMINI_TTS: 'gemini_tts',
    SYSTEM: 'system',
    THIRD_PARTY: 'third_party'
};

// --- 常量定义 ---
const CHAT_MODELS = [
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest' },
    { name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest' },
];
const AVAILABLE_TTS_VOICES = [ // Gemini TTS 语音列表
    { id: 'Zephyr', name: 'Zephyr (Bright)' }, { id: 'Puck', name: 'Puck (Upbeat)' }, { id: 'Charon', name: 'Charon (Informative)' }, { id: 'Kore', name: 'Kore (Firm)' }, { id: 'Fenrir', name: 'Fenrir (Excitable)' }, { id: 'Leda', name: 'Leda (Youthful)' }, { id: 'Orus', name: 'Orus (Firm)' }, { id: 'Aoede', name: 'Aoede (Breezy)' }, { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' }, { id: 'Autonoe', name: 'Autonoe (Bright)' }, { id: 'Enceladus', name: 'Enceladus (Breathy)' }, { id: 'Iapetus', name: 'Iapetus (Clear)' }, { id: 'Umbriel', name: 'Umbriel (Easy-going)' }, { id: 'Algieba', name: 'Algieba (Smooth)' }, { id: 'Despina', name: 'Despina (Smooth)' }, { id: 'Erinome', name: 'Erinome (Clear)' }, { id: 'Algenib', name: 'Algenib (Gravelly)' }, { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' }, { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' }, { id: 'Achernar', name: 'Achernar (Soft)' }, { id: 'Alnilam', name: 'Alnilam (Firm)' }, { id: 'Schedar', name: 'Schedar (Even)' }, { id: 'Gacrux', name: 'Gacrux (Mature)' }, { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' }, { id: 'Achird', name: 'Achird (Friendly)' }, { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' }, { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' }, { id: 'Sadachbia', name: 'Sadachbia (Lively)' }, { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' }, { id: 'Sulafat', name: 'Sulafat (Warm)' },
];

const SimpleMarkdown = ({ text }) => { /* ... (此组件无变化，代码省略) ... */ };

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

    return (
        <div ref={messageRef} className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm'}`} style={{ maxWidth: '85%' }}>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                    <SimpleMarkdown text={msg.content || ''} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400">
                        {/* --- 4. 使用新的 AiTtsButton 并传递完整的 settings --- */}
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

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename }) => { /* ... (此组件无变化，代码省略) ... */ };

// --- 设置弹窗UI更新 ---
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);

     useEffect(() => {
        // 获取系统内置声音列表
        const fetchSystemVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) setSystemVoices(voices);
        };
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = fetchSystemVoices;
        }
        fetchSystemVoices();
    }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddPrompt = () => { /* ... (无变化) ... */ };
    const handleDeletePrompt = (idToDelete) => { /* ... (无变化) ... */ };
    const handlePromptSettingChange = (promptId, field, value) => { /* ... (无变化) ... */ };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-6">
                     <div>
                        <label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label>
                        <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4">
                        <h4 className="text-md font-semibold">朗读设置</h4>
                        <div>
                            <label className="block text-sm font-medium mb-1">朗读引擎</label>
                            <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                <option value={TTS_ENGINE.GEMINI_TTS}>Gemini TTS (高质量)</option>
                                <option value={TTS_ENGINE.SYSTEM}>系统内置 (速度快)</option>
                                <option value={TTS_ENGINE.THIRD_PARTY}>第三方 API (备用)</option>
                            </select>
                        </div>
                        {tempSettings.ttsEngine === TTS_ENGINE.GEMINI_TTS && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Gemini 发音人</label>
                                <select value={tempSettings.geminiTtsVoice} onChange={(e) => handleChange('geminiTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                    {AVAILABLE_TTS_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                                </select>
                            </div>
                        )}
                        {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (
                             <div>
                                <label className="block text-sm font-medium mb-1">系统发音人</label>
                                {systemVoices.length > 0 ? (
                                    <select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                        <option value="">浏览器默认</option>
                                        {systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}
                                    </select>
                                ) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}
                            </div>
                        )}
                         {tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (
                            <div>
                                <label className="block text-sm font-medium mb-1">第三方发音人 (仅部分支持)</label>
                                <input type="text" value={tempSettings.thirdPartyTtsVoice} onChange={(e) => handleChange('thirdPartyTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                            </div>
                        )}
                    </div>
                    
                    {/* ... 其他设置项，如高级参数、自定义提示词等，无变化 ... */}

                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button>
                </div>
            </div>
        </div>
    );
};

// --- 3. 更新默认设置 ---
const DEFAULT_PROMPTS = [ 
    { id: 'default-1', name: '通用助理', content: '你是一个知识渊博、乐于助人的AI助理。', model: 'gemini-2.5-flash', ttsVoice: 'Zephyr' }, 
];
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8,
    apiTimeout: 60000,
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    
    // 新的TTS设置
    ttsEngine: TTS_ENGINE.GEMINI_TTS, // 默认使用Gemini TTS
    geminiTtsModel: 'text-to-speech', // 根据你之前的代码，这是 synthesizeSpeech 的模型ID
    geminiTtsVoice: 'Zephyr',        // 默认声音

    // 保留旧的设置以兼容
    thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI: '',

    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// --- 主组件 AiChatAssistant ---
const AiChatAssistant = () => {
    // ... (主组件的 state 和 hooks 定义无变化) ...
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    // ... etc ...

    // ... (所有函数 handleXXX, createNewConversation, handleSubmit 等都无变化) ...
    
    // ... (返回的 JSX 结构也无变化, 它会自动使用更新后的 MessageBubble 和 SettingsModal) ...
};

export default AiChatAssistant;
