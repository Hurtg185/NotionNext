import { Transition, Dialog } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';

// --- 【辅助函数】 ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const playKeySound = () => { try { const audio = new Audio('/sounds/typing-key.mp3'); audio.volume = 0.4; audio.play().catch(e => {}); } catch(e) {} };

// --- 【语言检测函数】 ---
const detectLanguage = (text) => {
    if (/[ \u1000-\u109F]/.test(text)) { return 'my-MM'; } // 缅甸语
    if (/[\u4e00-\u9fa5]/.test(text)) { return 'zh-CN'; } // 中文
    return 'en-US'; // 默认
};

// --- 【常量定义】---
const CHAT_MODELS_LIST = [ { id: 'model-1', name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest' }, { id: 'model-2', name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest' }, { id: 'model-3', name: 'GPT-4o', value: 'gpt-4o' }, { id: 'model-4', name: 'GPT-3.5-Turbo', value: 'gpt-3.5-turbo' } ];
const TRANSLATION_PROMPT = {
    content: `你是一位【中缅双语高保真翻译引擎】。你的任务是接收用户发送的文本，并提供多种翻译版本。你必须严格按照以下格式返回一个 JSON 对象，其 key 为 "data"，value 为一个数组。不要包含任何其他文字、解释或 \`\`\`json 标记。{"data": [{"style": "自然直译", "translation": "翻译结果", "back_translation": "从翻译结果严格回译到源语言的结果"}, {"style": "口语化", "translation": "翻译结果", "back_translation": "从翻译结果严格回译到源语言的结果"}, {"style": "原结构直译", "translation": "翻译结果", "back_translation": "从翻译结果严格回译到源语言的结果"}]}【翻译总原则】- 忠实原文，不增不减。- 回译 (back_translation) 必须严格、忠实地翻译回源语言。- 提供多种版本。【语言风格要求】- 缅甸语：使用现代日常口语。- 中文：使用自然流畅的口语。- 两种语言都避免使用过于生僻的俚语或网络流行语。现在，请等待用户的文本。`,
    openingLine: '你好，请发送你需要翻译的中文或缅甸语内容。'
};
const MICROSOFT_TTS_VOICES = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' } ];
const DEFAULT_SETTINGS = { apiConfig: { url: 'https://api.openai.com/v1', key: '' }, chatModels: CHAT_MODELS_LIST, selectedModel: 'gpt-4o', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', autoReadFirstTranslation: true, chatBackgroundUrl: '', backgroundOpacity: 100, userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: 'https://raw.githubusercontent.com/BigFaceCat2023/spacetrans/main/public/images/translator-avatar.png' };
const SUPPORTED_LANGUAGES = [ { code: 'auto', name: '自动识别', speechCode: 'zh-CN' }, { code: 'zh-CN', name: '中文', speechCode: 'zh-CN' }, { code: 'my-MM', name: '缅甸语', speechCode: 'my-MM' } ];
const SPEECH_RECOGNITION_LANGUAGES = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' } ];

// --- 【语音合成工具】 ---
const ttsCache = new Map();
let currentPlayingAudio = null;

// 根据文本内容自动选择最佳发音人
const getSmartVoice = (text, defaultVoice) => {
    const lang = detectLanguage(text);
    if (lang === 'my-MM') return 'my-MM-NilarNeural'; // 缅甸语强制使用 Nilar
    if (lang === 'zh-CN') return 'zh-CN-XiaoxiaoMultilingualNeural'; // 中文强制使用晓晓
    return defaultVoice; // 其他情况使用默认
};

const preloadTTS = async (text, voiceName) => {
    // 智能切换发音人
    const actualVoice = getSmartVoice(text, voiceName);
    const cacheKey = `${text}|${actualVoice}`;
    if (ttsCache.has(cacheKey) || !text) return;
    try {
        // r=-20 减慢语速
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${actualVoice}&r=-20`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
    } catch (e) {
        console.error(`预加载 "${text}" 失败:`, e);
    }
};

const playCachedTTS = (text, voiceName, onStart, onEnd) => {
    const actualVoice = getSmartVoice(text, voiceName);
    const cacheKey = `${text}|${actualVoice}`;
    
    const playAudio = () => {
        const audio = ttsCache.get(cacheKey);
        if (!audio) { onEnd(); return; }

        if (currentPlayingAudio) {
            currentPlayingAudio.pause();
            currentPlayingAudio.currentTime = 0;
        }
        currentPlayingAudio = audio;
        
        audio.onplay = onStart;
        audio.onended = () => { onEnd(); currentPlayingAudio = null; };
        audio.onerror = () => { onEnd(); currentPlayingAudio = null; };
        
        audio.play().catch(onEnd);
    };

    if (ttsCache.has(cacheKey)) {
        playAudio();
    } else {
        onStart();
        preloadTTS(text, voiceName).then(() => {
            if (ttsCache.has(cacheKey)) {
                playAudio();
            } else {
                onEnd();
            }
        });
    }
};

const stopCachedTTS = () => {
    if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
        if (currentPlayingAudio.onended) {
            currentPlayingAudio.onended();
        }
        currentPlayingAudio = null;
    }
};

// --- 【子组件】AiTtsButton ---
const AiTtsButton = ({ text, voiceName }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    
    const handleSpeak = (e) => {
        e.stopPropagation();
        if (isPlaying) {
            stopCachedTTS();
        } else {
            playCachedTTS(
                text,
                voiceName,
                () => setIsPlaying(true),
                () => setIsPlaying(false)
            );
        }
    };
    
    useEffect(() => {
        return () => {
            if (isPlaying) stopCachedTTS();
        };
    }, []);

    return ( <button onClick={handleSpeak} className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isPlaying ? 'text-blue-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`} title={isPlaying ? "停止朗读" : "朗读"}> <i className={`fas ${isPlaying ? 'fa-stop-circle' : 'fa-volume-up'} text-xl`}></i> </button> );
};

// --- 【翻译新组件】TranslationCard & TranslationResults ---
const TranslationCard = ({ result, voiceName }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e) => { e.stopPropagation(); navigator.clipboard.writeText(result.translation); setCopied(true); setTimeout(() => setCopied(false), 1500); };
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 shadow-md rounded-xl p-4 flex flex-col gap-2">
            <p className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed flex-grow text-center">{result.translation}</p>
            <p className="text-blue-600 dark:text-blue-400 text-sm mt-1 text-center"><i className="fas fa-undo-alt mr-2 opacity-60"></i>{result.back_translation}</p>
            <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                <button onClick={handleCopy} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600" title="复制"> <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-copy'} text-xl`}></i> </button>
                <AiTtsButton text={result.translation} voiceName={voiceName} />
            </div>
        </div>
    );
};
const TranslationResults = ({ results, voiceName }) => (<div className="flex flex-col gap-3 w-full">{(results || []).map((result, index) => <TranslationCard key={index} result={result} voiceName={voiceName} />)}</div>);

// --- 【子组件】LoadingSpinner (新样式：跳动的三点) ---
const LoadingSpinner = () => {
    return (
        <div className="flex my-6 justify-center w-full">
            <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
        </div>
    );
};

const MessageBubble = ({ msg, onRegenerate }) => {
    const isUser = msg.role === 'user';
    const hasTranslations = msg.translations && msg.translations.length > 0;

    const containerClass = isUser ? 'justify-end' : 'justify-center'; 
    const bubbleClass = isUser ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm shadow-md' : 'w-full';

    return (
        <div className={`flex my-3 ${containerClass}`}>
            <div className={`text-left flex flex-col ${isUser ? 'p-3 px-4' : ''} ${bubbleClass}`} style={{ maxWidth: isUser ? '85%' : '100%' }}>
                {hasTranslations 
                    ? <TranslationResults results={msg.translations} voiceName={msg.voiceName} /> 
                    : <div className={!isUser ? "p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700" : ""}><p className={`text-lg leading-normal ${isUser ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>{msg.content || ''}</p></div>
                }
            </div>
        </div>
    );
};


// --- 【子组件】SettingsModal (模型列表折叠) ---
const ModelManager = ({ models, onChange, onAdd, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md overflow-hidden">
             <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <span className="font-medium text-sm">已配置模型 ({models?.length || 0})</span>
                <i className={`fas fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isOpen && (
                <div className="p-2 space-y-2 animate-fade-in">
                    {(models || []).map(m => ( 
                        <div key={m.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"> 
                            <div className="flex items-center justify-between"> 
                                <input type="text" value={m.name} onChange={(e) => onChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="font-semibold bg-transparent w-full text-base outline-none focus:text-blue-500" /> 
                                <button onClick={() => onDelete(m.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> 
                            </div> 
                            <div> 
                                <label className="text-xs font-medium text-gray-500">模型值 (Value)</label> 
                                <input type="text" value={m.value} onChange={(e) => onChange(m.id, 'value', e.target.value)} placeholder="例如: gpt-4o" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs font-mono" /> 
                            </div> 
                        </div> 
                    ))} 
                    <button onClick={onAdd} className="w-full mt-2 py-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-md text-sm font-medium transition-colors"><i className="fas fa-plus mr-2"></i>添加新模型</button> 
                </div>
            )}
        </div>
    );
};

const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [isKeyVisible, setKeyVisible] = useState(false); const fileInputRef = useRef(null); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleApiChange = (field, value) => setTempSettings(p => ({ ...p, apiConfig: { ...p.apiConfig, [field]: value } })); const handleBgImageSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => handleChange('chatBackgroundUrl', e.target.result); reader.readAsDataURL(file); } event.target.value = null; }; const handleAddModel = () => handleChange('chatModels', [...(tempSettings.chatModels || []), { id: generateSimpleId('model'), name: '新模型', value: '' }]); const handleDeleteModel = (id) => { if (!window.confirm('确定删除吗？')) return; handleChange('chatModels', (tempSettings.chatModels || []).filter(m => m.id !== id)); }; const handleModelChange = (id, field, value) => handleChange('chatModels', (tempSettings.chatModels || []).map(m => m.id === id ? { ...m, [field]: value } : m)); return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4" onClick={onClose}> <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200 flex flex-col" style={{ height: 'min(700px, 90vh)' }} onClick={e => e.stopPropagation()}> <h3 className="text-2xl font-bold p-6 shrink-0 border-b dark:border-gray-700">设置</h3> <div className="space-y-6 flex-grow overflow-y-auto px-6 py-6"> <div className="space-y-3"> <h4 className="font-bold text-lg flex items-center gap-2"><i className="fas fa-key text-blue-500"></i> API 配置</h4> <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3 border dark:border-gray-700"> <div> <label className="text-xs font-medium block">接口地址</label> <input type="text" value={tempSettings.apiConfig.url} onChange={(e) => handleApiChange('url', e.target.value)} placeholder="例如: https://api.openai.com/v1" className="w-full mt-1 px-2 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md text-sm outline-none focus:border-blue-500" /> </div> <div> <label className="text-xs font-medium block">API Key</label> <div className="relative"><input type={isKeyVisible ? 'text' : 'password'} value={tempSettings.apiConfig.key} onChange={(e) => handleApiChange('key', e.target.value)} placeholder="sk-..." className="w-full mt-1 px-2 py-2 pr-8 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md text-sm outline-none focus:border-blue-500" /><button type='button' onClick={()=>setKeyVisible(p=>!p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><i className={`fas ${isKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i></button></div></div> </div> </div> <div className="space-y-3"><h4 className="font-bold text-lg flex items-center gap-2"><i className="fas fa-robot text-purple-500"></i> 模型管理</h4><ModelManager models={tempSettings.chatModels} onChange={handleModelChange} onAdd={handleAddModel} onDelete={handleDeleteModel} /></div> <div className="space-y-3"> <h4 className="font-bold text-lg flex items-center gap-2"><i className="fas fa-paint-brush text-pink-500"></i> 个性化</h4> <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4 border dark:border-gray-700"> <div><label className="block text-sm font-medium mb-1">聊天背景</label><div className="flex gap-2"><button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex-1">选择图片...</button><input type="file" ref={fileInputRef} onChange={handleBgImageSelect} accept="image/*" className="hidden" />{tempSettings.chatBackgroundUrl && <button onClick={()=>handleChange('chatBackgroundUrl', '')} className="px-3 py-2 text-red-500 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md hover:bg-red-50"><i className="fas fa-times"></i></button>}</div></div> <div className="flex items-center gap-4"><label className="text-sm shrink-0 w-24">背景透明度</label><input type="range" min="0" max="100" step="1" value={tempSettings.backgroundOpacity} onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))} className="flex-1 accent-blue-500"/> <span className="text-xs w-8 text-right">{tempSettings.backgroundOpacity}%</span></div> <div className="flex items-center justify-between pt-2 border-t dark:border-gray-600"><label className="block text-sm font-medium">自动朗读翻译</label><div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in"><input type="checkbox" checked={tempSettings.autoReadFirstTranslation} onChange={(e) => handleChange('autoReadFirstTranslation', e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400" style={{right: tempSettings.autoReadFirstTranslation ? '0' : 'auto', left: tempSettings.autoReadFirstTranslation ? 'auto' : '0'}}/><label className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${tempSettings.autoReadFirstTranslation ? 'bg-green-400' : 'bg-gray-300'}`}></label></div></div> </div> </div> </div> <div className="flex justify-end gap-3 p-4 shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"><button onClick={onClose} className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600">取消</button><button onClick={() => onSave(tempSettings)} className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition-colors font-medium">保存设置</button></div> </div> </div> ); };

// --- 【子组件】模态框 (模型/语言选择) ---
const ModalSelector = ({ title, options, selectedValue, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-center relative bg-gray-50 dark:bg-gray-900"> <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3> <button onClick={onClose} className="absolute top-1/2 -translate-y-1/2 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-times"></i></button> </div> <div className="p-2 overflow-y-auto max-h-[60vh] space-y-1"> {options.map(opt => ( <button key={opt.value} type="button" onClick={() => { onSelect(opt.value); onClose(); }} className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-colors flex items-center justify-between ${selectedValue === opt.value ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}> <span>{opt.name}</span> {selectedValue === opt.value && <i className="fas fa-check"></i>} </button> ))} </div> </div> </div> );

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
    const [showSettings, setShowSettings] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const pressTimerRef = useRef(null);
    const speechEndTimerRef = useRef(null);
    const handleSubmitRef = useRef();
    const [speechLang, setSpeechLang] = useState('zh-CN');

    useEffect(() => { setIsMounted(true); const savedSettings = safeLocalStorageGet('ai_chat_settings'); if (savedSettings) { const parsed = JSON.parse(savedSettings); setSettings({ ...DEFAULT_SETTINGS, ...parsed, chatModels: parsed.chatModels && parsed.chatModels.length > 0 ? parsed.chatModels : CHAT_MODELS_LIST }); } setMessages([{ role: 'ai', content: TRANSLATION_PROMPT.openingLine, timestamp: Date.now() }]); }, []);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings)); } }, [settings, isMounted]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
    useEffect(() => { const lang = SUPPORTED_LANGUAGES.find(l => l.code === sourceLang); if (lang) setSpeechLang(lang.speechCode); }, [sourceLang]);

    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleSwapLanguages = () => { if (sourceLang === 'auto' || sourceLang === targetLang) return; const currentSource = sourceLang; setSourceLang(targetLang); setTargetLang(currentSource); };
    const getLangName = (code) => SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;
    const getModelName = (value) => (settings.chatModels || []).find(m => m.value === value)?.name || value;

    // --- 语音识别逻辑 ---
    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; }
        if (recognitionRef.current) { recognitionRef.current.abort(); }
        
        const recognition = new SpeechRecognition();
        recognition.lang = speechLang;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognitionRef.current = recognition;

        recognition.onstart = () => { setIsListening(true); setUserInput(''); };
        recognition.onresult = (event) => {
            clearTimeout(speechEndTimerRef.current);
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            const currentFullText = finalTranscript + interimTranscript;
            setUserInput(currentFullText);

            // 只有当有最终结果，且当前没有临时结果时，才启动自动发送倒计时
            if (finalTranscript && !interimTranscript) {
                 speechEndTimerRef.current = setTimeout(() => {
                    if (recognitionRef.current) recognitionRef.current.stop();
                    // 这里直接使用闭包中的 finalTranscript 可能会有问题，重新获取最新的 userInput 状态最好
                    // 但由于 setTimeOut 执行时闭包已定，我们直接传递 finalTranscript 即可，因为它就是我们要发的内容
                    if (finalTranscript.trim()) {
                         handleSubmitRef.current(false, finalTranscript.trim());
                    }
                }, 1200); // 1.2秒无语音输入则发送
            }
        };
        recognition.onerror = (event) => { console.error("Speech error:", event.error); setError(`语音识别失败: ${event.error}`); };
        recognition.onend = () => { setIsListening(false); clearTimeout(speechEndTimerRef.current); recognitionRef.current = null; };
        recognition.start();
    }, [speechLang]);
    
    const stopListening = () => { if(recognitionRef.current) { recognitionRef.current.stop(); } };

    const handleMicPress = () => { pressTimerRef.current = setTimeout(() => { stopListening(); setShowLanguageSelector(true); }, 500); };
    const handleMicRelease = () => { clearTimeout(pressTimerRef.current); };
    
    const parseJsonResponse = (jsonString) => {
        let cleanJsonString = jsonString.trim();
        if (cleanJsonString.startsWith('```') && cleanJsonString.endsWith('```')) {
            cleanJsonString = cleanJsonString.substring(cleanJsonString.indexOf('\n') + 1, cleanJsonString.lastIndexOf('\n'));
        }
        const startIndex = cleanJsonString.indexOf('{');
        const endIndex = cleanJsonString.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            cleanJsonString = cleanJsonString.substring(startIndex, endIndex + 1);
        }
        return JSON.parse(cleanJsonString);
    };

    const fetchAiResponse = async (messagesForApi) => {
        setIsLoading(true); setError('');
        const { apiConfig, selectedModel, ttsVoice } = settings;
        try {
            if (!apiConfig || !apiConfig.key) throw new Error('请在“设置”中配置您的 API 密钥。');
            const lastUserMessage = messagesForApi[messagesForApi.length - 1];
            const systemPrompt = TRANSLATION_PROMPT.content;
            const userPrompt = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(targetLang)}]:\n\n${lastUserMessage.content}`;
            
            const response = await fetch(`${apiConfig.url}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败: ${response.status}`); }
            const data = await response.json();
            const aiResponseContent = data.choices?.[0]?.message?.content;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            
            const parsedJson = parseJsonResponse(aiResponseContent);
            const translationsArray = parsedJson.data || parsedJson;

            if (!Array.isArray(translationsArray) || translationsArray.length === 0) throw new Error("返回的JSON格式不正确或为空。");
            
            setMessages(prev => [...prev, { role: 'ai', timestamp: Date.now(), translations: translationsArray, voiceName: ttsVoice }]);
            if (settings.autoReadFirstTranslation) {
                // 使用修正后的 playCachedTTS，它内部会自动判断语言
                playCachedTTS(translationsArray[0].translation, ttsVoice, () => {}, () => {});
            }
        } catch (err) {
            const errorMessage = `请求错误: ${err.message}`;
            setMessages(prev => [...prev, { role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() }]);
            setError(errorMessage);
        } finally { setIsLoading(false); }
    };

    const handleSubmit = async (isRegenerate = false, textToSend = null) => {
        let userMessage;
        if (isRegenerate) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            if (!lastUserMsg) return;
            userMessage = lastUserMsg;
            setMessages(prev => prev.filter(m => m.role === 'user' && m.timestamp === userMessage.timestamp));
        } else {
            const textToProcess = (textToSend !== null ? textToSend : userInput).trim();
            if (!textToProcess) { setError('请输入要翻译的内容！'); return; }
            userMessage = { role: 'user', content: textToProcess, timestamp: Date.now() };
            setMessages(prev => [...prev, userMessage]);
            setUserInput('');
        }
        await fetchAiResponse([userMessage]);
    };
    handleSubmitRef.current = handleSubmit;

    if (!isMounted) return null;
    const showSendButton = userInput.trim().length > 0;
    
    const handleMainButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (showSendButton) { handleSubmit(); } 
        else { if (isListening) { stopListening(); } else { startListening(); } }
    };
    
    return (
        <div className="flex flex-col h-[100dvh] w-full bg-[#f0f2f5] dark:bg-[#121212] text-gray-800 dark:text-gray-200 overflow-hidden relative font-sans">
            {settings.chatBackgroundUrl && <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100 }}></div>}
            
            <div className="flex-1 flex flex-col h-full relative overflow-hidden z-10 pt-safe-top">
                {/* 消息列表区域 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.map((msg, index) => ( <MessageBubble key={`${msg.timestamp}-${index}`} msg={msg} onRegenerate={() => handleSubmit(true)} /> ))}
                    {isLoading && <LoadingSpinner/>}
                    <div ref={messagesEndRef} />
                </div>

                {/* 底部操作区域 */}
                <footer className="shrink-0 p-4 pb-[max(16px,env(safe-area-inset-bottom))] bg-gradient-to-t from-gray-100 via-gray-100 to-transparent dark:from-[#121212] dark:via-[#121212]">
                     {error && <div className="mb-2 p-2 bg-red-100/90 backdrop-blur text-red-800 text-center text-xs rounded-lg border border-red-200 shadow-sm animate-fade-in" onClick={()=>setError('')}>{error} (点击关闭)</div>}
                    <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
                         {/* 顶部工具栏：语言切换 + 模型选择 */}
                         <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-full p-1 shadow-sm border border-gray-200 dark:border-gray-700">
                                <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 py-1.5 pl-3 pr-1 outline-none cursor-pointer hover:text-blue-600 transition-colors appearance-none">
                                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">{l.name}</option>)}
                                </select>
                                <button onClick={handleSwapLanguages} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 transition-transform active:rotate-180 disabled:opacity-30" disabled={sourceLang === 'auto'}>
                                    <i className="fas fa-arrow-right text-xs"></i>
                                </button>
                                <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 py-1.5 pl-1 pr-3 outline-none cursor-pointer hover:text-blue-600 transition-colors appearance-none">
                                    {SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">{l.name}</option>)}
                                </select>
                            </div>
                            
                            <button onClick={() => setShowModelSelector(true)} className="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-full px-3 py-1.5 shadow-sm border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all">
                                <i className="fas fa-robot text-blue-500"></i>
                                <span className="max-w-[80px] truncate">{getModelName(settings.selectedModel)}</span>
                            </button>
                        </div>

                        {/* 输入栏：设置 + 输入框 + 麦克风/发送 */}
                        <div className="flex items-end gap-3">
                            <button onClick={() => setShowSettings(true)} className="w-10 h-10 mb-1 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm shrink-0">
                                <i className="fas fa-sliders-h"></i>
                            </button>
                            
                            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center min-h-[50px] transition-shadow focus-within:shadow-md focus-within:border-blue-400">
                                <textarea 
                                    value={userInput} 
                                    onChange={e=>setUserInput(e.target.value)} 
                                    placeholder={isListening ? "正在聆听..." : "输入要翻译的内容..."} 
                                    className="w-full bg-transparent border-none outline-none py-3 px-4 text-base resize-none max-h-32 placeholder-gray-400 dark:placeholder-gray-500 leading-normal" 
                                    rows={1}
                                    style={{ height: userInput ? 'auto' : '50px' }}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; }}
                                    onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} 
                                />
                            </div>

                            <button 
                                type="button" 
                                onClick={handleMainButtonClick} 
                                onMouseDown={handleMicPress} 
                                onMouseUp={handleMicRelease} 
                                onTouchStart={handleMicPress} 
                                onTouchEnd={handleMicRelease} 
                                className={`w-12 h-12 mb-0.5 rounded-full flex items-center justify-center shrink-0 shadow-md transition-all duration-200 ${
                                    showSendButton 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105' 
                                        : (isListening 
                                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/50' 
                                            : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600')
                                }`}
                            >
                                <i className={`fas ${showSendButton ? 'fa-paper-plane' : (isListening ? 'fa-square' : 'fa-microphone')} text-lg`}></i>
                            </button>
                        </div>
                    </div>
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
