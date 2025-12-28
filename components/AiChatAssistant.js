import { Transition, Dialog } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';

// --- 【辅助函数】 ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- 【常量定义】---
const CHAT_MODELS_LIST = [ { id: 'model-1', name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest', maxContextTokens: 8192 }, { id: 'model-2', name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest', maxContextTokens: 8192 }, { id: 'model-3', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 8192 }, { id: 'model-4', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 8192 }, ];
const TRANSLATION_PROMPT = {
    id: 'default-translator-v2', name: '中缅翻译引擎', content: `你是一位【中缅双语高保真翻译引擎】...\n(提示词内容与之前相同，此处省略以保持代码清晰)`, openingLine: '你好，请发送你需要翻译的中文或缅甸语内容。', model: 'gemini-1.5-flash-latest', avatarUrl: 'https://raw.githubusercontent.com/BigFaceCat2023/spacetrans/main/public/images/translator-avatar.png'
};
const DEFAULT_PROMPTS = [TRANSLATION_PROMPT];
const DEFAULT_SETTINGS = { apiKeys: [], activeApiKeyId: '', chatModels: CHAT_MODELS_LIST, selectedModel: 'gemini-1.5-flash-latest', temperature: 0.5, maxOutputTokens: 2048, autoReadFirstTranslation: true, chatBackgroundUrl: '/images/chat-bg-light.jpg', backgroundOpacity: 70, userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: 'https://raw.githubusercontent.com/BigFaceCat2023/spacetrans/main/public/images/translator-avatar.png' };
const SUPPORTED_LANGUAGES = [ { code: 'auto', name: '自动识别', speechCode: 'zh-CN' }, { code: 'zh-CN', name: '中文', speechCode: 'zh-CN' }, { code: 'my-MM', name: '缅甸语', speechCode: 'my-MM' } ];
const SPEECH_RECOGNITION_LANGUAGES = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, ];

// --- 【语音合成工具函数】 ---
const speakText = (text, lang) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel(); // 取消之前的朗读
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
};


// --- 【子组件】AiTtsButton ---
const AiTtsButton = ({ text, lang, size = 'normal' }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    useEffect(() => { return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); }; }, []);
    const handleSpeak = (e) => {
        e.stopPropagation();
        if (isPlaying) {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            return;
        }
        if (!window.speechSynthesis) { alert('您的浏览器不支持语音朗读功能'); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
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
const TranslationCard = ({ result, lang }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e) => { e.stopPropagation(); navigator.clipboard.writeText(result.translation); setCopied(true); setTimeout(() => setCopied(false), 1500); };
    return (
        <div className="bg-white dark:bg-gray-700 border border-gray-200/50 dark:border-gray-600/50 shadow-[0_2px_8px_rgba(0,0,0,0.06)] rounded-lg p-3 flex flex-col gap-2 transition-all duration-200 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex justify-between items-start">
                <p className="text-gray-800 dark:text-gray-100 text-base leading-relaxed flex-grow mr-2">{result.translation}</p>
                <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full shrink-0">{result.style}</span>
            </div>
            <p className="text-blue-600 dark:text-blue-400 text-xs mt-1"><i className="fas fa-undo-alt mr-1.5 opacity-60"></i>{result.back_translation}</p>
            <div className="flex items-center gap-1 -ml-1.5 mt-1">
                <AiTtsButton text={result.translation} lang={lang} size="small" />
                <button onClick={handleCopy} className="p-1.5 text-xs rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10" title="复制">
                    <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                </button>
            </div>
        </div>
    );
};
const TranslationResults = ({ results, lang }) => (
    <div className="flex flex-col gap-2.5">
        {(results || []).map((result, index) => <TranslationCard key={index} result={result} lang={lang} />)}
    </div>
);

// --- 【子组件】MessageBubble ---
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate, targetLang }) => {
    const isUser = msg.role === 'user';
    const userBubbleClass = 'bg-blue-500 text-white rounded-br-lg shadow-[0_5px_15px_rgba(59,130,246,0.3),_0_12px_28px_rgba(59,130,246,0.2)]';
    const aiBubbleClass = 'bg-transparent border-none shadow-none';
    const hasTranslations = msg.translations && msg.translations.length > 0;
    return (
        <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}>
                {hasTranslations ? <TranslationResults results={msg.translations} lang={targetLang} /> : <p className={isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}>{msg.content || ''}</p>}
                {!isUser && isLastAiMessage && hasTranslations && <button onClick={onRegenerate} className="p-2 -ml-2 mt-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 text-xs" title="重新生成"><i className="fas fa-sync-alt"></i></button>}
            </div>
            {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200" />}
        </div>
    );
};

// --- 【子组件】SettingsModal & Sub-pages ---
const SubPageWrapper = ({ title, onBack, children }) => ( <div className="p-6 h-full flex flex-col bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"> <h3 className="text-2xl font-bold mb-4 shrink-0">{title}</h3> <div className="flex-grow overflow-y-auto pr-2 -mr-2">{children}</div> <button onClick={onBack} className="fixed bottom-8 right-8 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center z-10 hover:bg-gray-900 active:scale-95 transition-all"> <i className="fas fa-arrow-left text-xl"></i> </button> </div> );
const ModelManager = ({ models, onChange, onAdd, onDelete }) => ( <> {(models || []).map(m => ( <div key={m.id} className="p-3 mb-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"> <div className="flex items-center justify-between"> <input type="text" value={m.name} onChange={(e) => onChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="font-semibold bg-transparent w-full text-lg" /> <button onClick={() => onDelete(m.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div> <label className="text-xs font-medium">模型值 (Value)</label> <input type="text" value={m.value} onChange={(e) => onChange(m.id, 'value', e.target.value)} placeholder="例如: gemini-1.5-pro-latest" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> <div> <label className="text-xs font-medium">最大上下文 (Tokens)</label> <input type="number" value={m.maxContextTokens} onChange={(e) => onChange(m.id, 'maxContextTokens', parseInt(e.target.value, 10) || 0)} placeholder="例如: 8192" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-blue-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新模型</button> </> );
const ApiKeyManager = ({ apiKeys, activeApiKeyId, onChange, onAdd, onDelete, onSetActive }) => { const [visibleKeys, setVisibleKeys] = useState({}); return <> {(apiKeys || []).map(k => ( <div key={k.id} className={`p-3 mb-3 rounded-md border-2 ${activeApiKeyId === k.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}> <div className="flex items-center justify-between mb-2"> <p className="font-semibold text-lg">API 密钥</p> <div className="flex items-center gap-2"> <button onClick={() => onSetActive(k.id)} disabled={activeApiKeyId === k.id} className="px-2 py-1 text-xs bg-green-500 text-white rounded disabled:bg-gray-400">设为当前</button> <button onClick={() => onDelete(k.id)} className="p-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> </div> <div className="mt-2 space-y-2"> <label className="text-xs font-medium block">API 接口地址 (Endpoint)</label> <input type="text" value={k.url || ''} onChange={(e) => onChange(k.id, 'url', e.target.value)} placeholder="例如: https://generativelanguage.googleapis.com/v1beta/models/" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> <label className="text-xs font-medium block">API 密钥 (Key)</label> <div className="relative"><input type={visibleKeys[k.id] ? 'text' : 'password'} value={k.key} onChange={(e) => onChange(k.id, 'key', e.target.value)} placeholder="请输入密钥" className="w-full mt-1 px-2 py-1 pr-8 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /><button type='button' onClick={()=>setVisibleKeys(p=>({...p, [k.id]: !p[k.id]}))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><i className={`fas ${visibleKeys[k.id] ? 'fa-eye-slash' : 'fa-eye'}`}></i></button></div></div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-indigo-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新密钥</button> </>};
const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [view, setView] = useState('main'); const fileInputRef = useRef(null); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleBgImageSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => handleChange('chatBackgroundUrl', e.target.result); reader.readAsDataURL(file); } event.target.value = null; }; const handleAddModel = () => { const newModel = { id: generateSimpleId('model'), name: '新模型', value: '', maxContextTokens: 8192 }; handleChange('chatModels', [...(tempSettings.chatModels || []), newModel]); }; const handleDeleteModel = (id) => { if (!window.confirm('确定删除吗？')) return; handleChange('chatModels', (tempSettings.chatModels || []).filter(m => m.id !== id)); }; const handleModelChange = (id, field, value) => { handleChange('chatModels', (tempSettings.chatModels || []).map(m => m.id === id ? { ...m, [field]: value } : m)); }; const handleAddApiKey = () => { const newKey = { id: generateSimpleId('key'), key: '', url: 'https://generativelanguage.googleapis.com/v1beta/models/' }; handleChange('apiKeys', [...(tempSettings.apiKeys || []), newKey]); }; const handleDeleteApiKey = (id) => { if (!window.confirm('确定删除吗？')) return; const newKeys = (tempSettings.apiKeys || []).filter(k => k.id !== id); handleChange('apiKeys', newKeys); if (tempSettings.activeApiKeyId === id) handleChange('activeApiKeyId', newKeys[0]?.id || ''); }; const handleApiKeyChange = (id, field, value) => { handleChange('apiKeys', (tempSettings.apiKeys || []).map(k => k.id === id ? { ...k, [field]: value } : k)); }; return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4" onClick={onClose}> <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}> {view === 'main' && ( <div className="p-6 h-full flex flex-col"> <h3 className="text-2xl font-bold mb-6 shrink-0">设置</h3> <div className="space-y-5 flex-grow overflow-y-auto pr-2 -mr-2"> <button type="button" onClick={() => setView('apiKeys')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><h4 className="text-lg font-bold">API 密钥管理</h4><i className='fas fa-arrow-right'></i></button> <button type="button" onClick={() => setView('models')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><h4 className="text-lg font-bold">模型管理</h4><i className='fas fa-arrow-right'></i></button> <div><label className="block text-sm font-medium mb-1">聊天背景</label><div className="flex gap-2"><button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-600 text-white rounded-md shrink-0 hover:bg-gray-700">上传背景图</button><input type="file" ref={fileInputRef} onChange={handleBgImageSelect} accept="image/*" className="hidden" /></div></div> <div className="flex items-center gap-4"><label className="text-sm shrink-0">背景图透明度: {tempSettings.backgroundOpacity}%</label><input type="range" min="0" max="100" step="1" value={tempSettings.backgroundOpacity} onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))} className="w-full"/></div> <div className="flex items-center gap-4"><label className="text-sm shrink-0">默认温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">自动朗读首个翻译结果</label><input type="checkbox" checked={tempSettings.autoReadFirstTranslation} onChange={(e) => handleChange('autoReadFirstTranslation', e.target.checked)} className="h-5 w-5 text-blue-500 rounded" /></div> </div> <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-blue-600 text-white rounded-md">保存</button></div> </div> )} {view === 'apiKeys' && <SubPageWrapper title="API 密钥管理" onBack={() => setView('main')}><ApiKeyManager apiKeys={tempSettings.apiKeys} activeApiKeyId={tempSettings.activeApiKeyId} onChange={handleApiKeyChange} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} onSetActive={(id) => handleChange('activeApiKeyId', id)} /></SubPageWrapper>} {view === 'models' && <SubPageWrapper title="模型管理" onBack={() => setView('main')}><ModelManager models={tempSettings.chatModels} onChange={handleModelChange} onAdd={handleAddModel} onDelete={handleDeleteModel} /></SubPageWrapper>} </div> </div> ); };

// --- 【子组件】模态框 (模型/语言选择) ---
const ModalSelector = ({ title, options, selectedValue, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-center relative"> <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3> <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button> </div> <div className="p-2 overflow-y-auto max-h-[60vh]"> {options.map(opt => ( <button key={opt.value} type="button" onClick={() => { onSelect(opt.value); onClose(); }} className={`w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-blue-500/10 ${selectedValue === opt.value ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10' : 'text-gray-800 dark:text-gray-200'}`}>{opt.name}</button> ))} </div> </div> </div> );

// --- 【核心组件】AiChatContent ---
const AiChatContent = ({ onClose }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isMounted, setIsMounted] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('my-MM');
    const [speechLang, setSpeechLang] = useState('zh-CN');
    const [showSettings, setShowSettings] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const pressTimerRef = useRef(null);
    const handleSubmitRef = useRef();

    useEffect(() => { setIsMounted(true); const savedSettings = safeLocalStorageGet('ai_chat_settings'); if (savedSettings) { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }); } setMessages([{ role: 'ai', content: TRANSLATION_PROMPT.openingLine, timestamp: Date.now() }]); }, []);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings)); } }, [settings, isMounted]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleSwapLanguages = () => { if (sourceLang === 'auto' || sourceLang === targetLang) return; const currentSource = sourceLang; setSourceLang(targetLang); setTargetLang(currentSource); };
    const getLangName = (code) => SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;

    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; }
        if (recognitionRef.current) { recognitionRef.current.abort(); }
        const recognition = new SpeechRecognition();
        recognition.lang = speechLang;
        recognition.interimResults = true;
        recognition.continuous = false;
        recognitionRef.current = recognition;
        recognition.onstart = () => { setIsListening(true); setUserInput(''); };
        recognition.onresult = (event) => { const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join(''); setUserInput(transcript); if (event.results[0].isFinal && transcript.trim()) { handleSubmitRef.current(false, transcript); } };
        recognition.onerror = (event) => { console.error("Speech error:", event.error); setError(`语音识别失败: ${event.error}`); };
        recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
        recognition.start();
    }, [speechLang]);

    const handleMicPress = () => { pressTimerRef.current = setTimeout(() => setShowLanguageSelector(true), 500); };
    const handleMicRelease = () => { clearTimeout(pressTimerRef.current); };
    const handleMicClick = () => { if (isListening) { recognitionRef.current?.stop(); } else { startListening(); } };

    const fetchAiResponse = async (messagesForApi) => {
        setIsLoading(true); setError('');
        const activeKey = (settings.apiKeys || []).find(k => k.id === settings.activeApiKeyId);
        try {
            if (!activeKey || !activeKey.key) throw new Error('请在“设置”中配置并激活一个有效的 API 密钥。');
            const lastUserMessage = messagesForApi[messagesForApi.length - 1];
            const requestPrompt = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(targetLang)}]:\n\n${lastUserMessage.content}`;
            const contents = [ { role: 'user', parts: [{ text: TRANSLATION_PROMPT.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, { role: 'user', parts: [{ text: requestPrompt }] }];
            const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens, responseMimeType: "application/json" };
            const modelToUse = settings.selectedModel;
            const url = `${activeKey.url || 'https://generativelanguage.googleapis.com/v1beta/models/'}${modelToUse}:generateContent?key=${activeKey.key}`;
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }) });

            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败: ${response.status}`); }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');

            const parsedTranslations = JSON.parse(aiResponseContent);
            if (!Array.isArray(parsedTranslations) || parsedTranslations.length === 0) throw new Error("返回的JSON格式不正确。");

            setMessages(prev => [...prev, { role: 'ai', timestamp: Date.now(), translations: parsedTranslations }]);
            if (settings.autoReadFirstTranslation) {
                speakText(parsedTranslations[0].translation, targetLang);
            }
        } catch (err) {
            const errorMessage = `请求错误: ${err.message}`;
            setError(errorMessage);
            setMessages(prev => [...prev, { role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() }]);
        } finally { setIsLoading(false); }
    };

    const handleSubmit = async (isRegenerate = false, textToSend = null) => {
        let currentMessages = [...messages];
        if (isRegenerate) {
            if (currentMessages.length > 1 && currentMessages[currentMessages.length - 1].role === 'ai') {
                currentMessages.pop();
            }
        } else {
            const textToProcess = (textToSend !== null ? textToSend : userInput).trim();
            if (!textToProcess) { setError('请输入要翻译的内容！'); return; }
            currentMessages.push({ role: 'user', content: textToProcess, timestamp: Date.now() });
            setMessages(currentMessages);
            setUserInput('');
        }
        await fetchAiResponse(currentMessages);
    };
    handleSubmitRef.current = handleSubmit;

    if (!isMounted) return null;
    const showSendButton = userInput.trim().length > 0;

    return (
        // 使用 h-[100dvh] 确保在移动端浏览器地址栏变化时也能占满屏幕
        <div className="flex flex-col h-[100dvh] w-full bg-white dark:bg-[#18171d] text-gray-800 dark:text-gray-200 overflow-hidden relative">
            <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100 }}></div>
            <div className="absolute inset-0 bg-white/30 dark:bg-black/40 z-0"></div>

            <header className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white/80 dark:bg-[#18171d]/90 backdrop-blur-md z-10 safe-top">
                <div className="w-9 h-9"></div> {/* Placeholder for balance */}
                <h3 className="font-bold text-lg">中缅翻译</h3>
                <button onClick={() => setShowSettings(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 transition-colors"><i className="fas fa-cog text-gray-600 dark:text-gray-300"></i></button>
            </header>
            
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {messages.map((msg, index) => ( <div key={index}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} targetLang={targetLang} /> </div> ))}
                    <div ref={messagesEndRef} />
                </div>

                <footer className="shrink-0 bg-white/90 dark:bg-[#18171d]/90 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3 pb-[max(12px,env(safe-area-inset-bottom))] z-20">
                    {error && <div className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded" onClick={()=>setError('')}>{error} (点击关闭)</div>}
                    
                    <div className="flex items-center justify-center gap-2 mb-2">
                       <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="bg-transparent rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 appearance-none text-center">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
                       <button onClick={handleSwapLanguages} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-transform active:rotate-180 disabled:opacity-50" disabled={sourceLang === 'auto'}><i className="fas fa-exchange-alt text-gray-600 dark:text-gray-300"></i></button>
                       <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-transparent rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 appearance-none text-center">{SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
                       <button onClick={() => setShowModelSelector(true)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-brain text-gray-600 dark:text-gray-300 text-xs"></i></button>
                    </div>

                    <form onSubmit={(e)=>{e.preventDefault();handleSubmit()}} className="flex items-end gap-2.5 bg-gray-100 dark:bg-gray-800 p-2 rounded-[28px] shadow-inner border border-transparent focus-within:border-blue-500/30 transition-all">
                        <button type="button" onClick={handleMicClick} onMouseDown={handleMicPress} onMouseUp={handleMicRelease} onTouchStart={handleMicPress} onTouchEnd={handleMicRelease} className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ease-in-out ${isListening ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}><i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone-alt'} text-2xl`}></i></button>
                        <textarea value={userInput} onChange={e=>setUserInput(e.target.value)} placeholder={isListening ? "正在聆听..." : "输入要翻译的内容..."} className="flex-1 bg-transparent max-h-48 min-h-[48px] py-3 px-2 resize-none outline-none text-base leading-6 dark:placeholder-gray-500" rows={1} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} />
                        {showSendButton && <button type="submit" disabled={isLoading} className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all"><i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-arrow-up'}`}></i></button>}
                    </form>
                </footer>
            </div>

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
            {showModelSelector && <ModalSelector title="切换模型" options={(settings.chatModels || []).map(m=>({name: m.name, value: m.value}))} selectedValue={settings.selectedModel} onSelect={(val) => setSettings(s=>({...s, selectedModel: val}))} onClose={() => setShowModelSelector(false)} />}
            {showLanguageSelector && <ModalSelector title="选择语音识别语言" options={SPEECH_RECOGNITION_LANGUAGES} selectedValue={speechLang} onSelect={(val) => setSpeechLang(val)} onClose={() => setShowLanguageSelector(false)} />}
        </div>
    );
};


// --- 【导出组件】AIChatDrawer (全屏弹窗包装器) ---
const AIChatDrawer = ({ isOpen, onClose }) => {
    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[9999]" onClose={()=>{/* No-op, disable closing by overlay click */}}>
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
