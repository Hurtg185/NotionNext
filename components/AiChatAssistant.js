// /components/AiChatAssistant.js - 调试 v11：恢复 MessageBubble 和美化输入框
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; // 重新导入 AiTtsButton

// --- 子组件定义区域 (在主组件外部) ---

// 简单的 Markdown 解析器
const SimpleMarkdown = ({ text, lang, apiKey, ttsSettings }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        if (line.match(/\*\*(.*?)\*\*/)) {
            const content = line.replace(/\*\*/g, '');
            return <strong key={index} className="block mt-4 mb-2 text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="flex-grow">{content}</span><AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" /></strong>;
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return <li key={index} className="ml-5 list-disc flex items-start"><span className="flex-grow">{content}</span><AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" /></li>;
        }
        const content = line;
        return <p key={index} className="my-1 flex items-center"><span className="flex-grow">{content}</span><AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" /></p>;
    });
    return <div>{lines}</div>;
};

// 消息气泡组件
const MessageBubble = ({ msg, settings }) => {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
                {msg.image && <img src={msg.image} alt="用户上传" className="rounded-md mb-2 max-w-full h-auto" />}
                <div className="prose dark:prose-invert max-w-none prose-p:my-1 prose-strong:text-current">
                    <SimpleMarkdown text={msg.content} lang="zh-CN" apiKey={settings.apiKey} ttsSettings={settings} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-3 mt-2 text-gray-500 dark:text-gray-400">
                        <AiTtsButton text={msg.content} apiKey={settings.apiKey} ttsSettings={settings} />
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button>
                    </div>
                )}
            </div>
            {isUser && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
        </div>
    );
};

// 设置面板组件
const SettingsModal = ({ settings, onSave, onClose }) => {
    // ... (内容与上个回复相同，为简洁省略，请直接复制完整代码)
};

// --- 默认设置和提示词 ---
// ... (内容与上个回复相同，为简洁省略，请直接复制完整代码)
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的中文老师...` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的中文老师...` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手...` }
];

const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: TTS_ENGINE.GOOGLE_GENAI,
    ttsVoice: 'Zephyr',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};


// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [messages, setMessages] = useState([]); // 初始消息为空
    const [userInput, setUserInput] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    
    // UI 状态
    const [inputMode, setInputMode] = useState('text');
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- 初始化和保存设置 ---
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v_debug');
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
            // 添加一条初始欢迎消息
            setMessages([{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }]);
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    }, []);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem('ai_assistant_settings_v_debug', JSON.stringify(newSettings));
        } catch (e) { console.error("Failed to save settings", e); }
        setShowSettings(false);
    }, []);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- 交互逻辑 (暂时不包含 API 调用) ---
    const handleImageUpload = (e) => {
        // ... (图片上传逻辑)
    };
    const clearImage = () => {
        // ... (清除图片逻辑)
    };
    // ... (其他交互逻辑占位符)
    
    if (!isMounted) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '700px',
                border: '5px solid red',
            }}>
                <p>正在加载组件...</p>
            </div>
        );
    }
    
    return (
        <div 
            className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border flex flex-col bg-white dark:bg-gray-800"
            style={{ 
                height: '80vh', minHeight: '600px', maxHeight: '900px',
                display: 'flex !important', // 保持强制显示
            }}
        >
            <div className="flex items-center justify-between p-4 rounded-t-2xl border-b shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold">AI 中文老师</h2>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            <div 
                className="flex-grow p-4 overflow-y-auto"
                style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover' }}
            >
                <div className="flex flex-col gap-4">
                    {messages.map((msg, index) => (
                        <MessageBubble key={index} msg={msg} settings={settings} />
                    ))}
                </div>
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t shrink-0">
                {imagePreviewUrl && (
                    <div className="relative mb-2 w-24">
                        <img src={imagePreviewUrl} alt="预览" className="rounded-lg" />
                        <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1" title="移除"><i className="fas fa-times text-xs"></i></button>
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <div className="flex gap-1">
                        <button onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200"><i className="fas fa-image"></i></button>
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </div>
                    {inputMode === 'text' ? (
                        <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="flex-grow px-4 py-2 rounded-2xl bg-gray-100" rows="1" />
                    ) : (
                        <button className="flex-grow py-2 rounded-full font-bold text-white bg-gray-500">按住说话</button>
                    )}
                    <button onClick={() => setInputMode(p => p === 'text' ? 'voice' : 'text')} className="p-3 rounded-full hover:bg-gray-200"><i className={`fas ${inputMode === 'text' ? 'fa-microphone' : 'fa-keyboard'}`}></i></button>
                    <button type="submit" className="p-3 bg-primary text-white rounded-full"><i className="fas fa-arrow-up"></i></button>
                </div>
            </div>

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);

    const handleChange = (key, value) => {
        setTempSettings(prev => ({ ...prev, [key]: value }));
    };

    const handlePromptChange = (e, promptId, field) => {
        const newPrompts = tempSettings.prompts.map(p => 
            p.id === promptId ? { ...p, [field]: e.target.value } : p
        );
        handleChange('prompts', newPrompts);
    };

    const handleAddPrompt = () => {
        const newId = `custom-${Date.now()}`;
        const newPrompts = [...tempSettings.prompts, { id: newId, name: '新提示词', content: '请输入...' }];
        handleChange('prompts', newPrompts);
    };

    const handleDeletePrompt = (idToDelete) => {
        if (window.confirm('确定删除吗？')) {
            const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete);
            let newCurrentPromptId = tempSettings.currentPromptId;
            if (newCurrentPromptId === idToDelete) {
                newCurrentPromptId = newPrompts[0]?.id || '';
            }
            handleChange('prompts', newPrompts);
            handleChange('currentPromptId', newCurrentPromptId);
        }
    };
    
    const geminiTtsVoices = [
        { name: 'Zephyr (Bright)', value: 'Zephyr' }, { name: 'Puck (Upbeat)', value: 'Puck' },
        { name: 'Charon (Informative)', value: 'Charon' }, { name: 'Kore (Firm)', value: 'Kore' },
    ];

    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' },
        { name: '缅甸语', value: 'my-MM' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="mb-4 pb-4 border-b">
                    <label className="block text-sm font-medium">你的 Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full p-2 border rounded mt-1" />
                </div>
                <div className="mb-4 pb-4 border-b">
                    <label className="block text-sm font-medium">选择 AI 模型</label>
                    <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full p-2 border rounded mt-1">
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b">
                    <label className="block text-sm font-medium">选择 TTS 引擎</label>
                    <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full p-2 border rounded mt-1">
                        <option value="gemini-tts-1">Gemini TTS (推荐)</option>
                        <option value="external_api">第三方 API (晓辰)</option>
                    </select>
                </div>
                {tempSettings.ttsEngine === 'gemini-tts-1' && (
                    <div className="mb-4 p-3 bg-gray-50 rounded">
                        <h5 className="font-bold">Gemini TTS 配置</h5>
                        <label className="block text-sm mt-2">发音人</label>
                        <select value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className="w-full p-2 border rounded">
                            {geminiTtsVoices.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="mb-4 pb-4 border-b">
                    <label className="block text-sm font-medium">语音识别语言</label>
                    <select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full p-2 border rounded mt-1">
                        {speechLanguageOptions.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}
                    </select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded">保存设置</button>
                </div>
            </div>
        </div>
    );
};
export default AiChatAssistant;
