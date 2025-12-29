import { Transition, Dialog } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';

// --- 【辅助函数】 ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
const DEFAULT_SETTINGS = { apiConfig: { url: 'https://api.openai.com/v1', key: '' }, chatModels: CHAT_MODELS_LIST, selectedModel: 'gpt-4o', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', autoReadFirstTranslation: true, chatBackgroundUrl: '/images/chat-bg-light.jpg', backgroundOpacity: 70, userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: 'https://raw.githubusercontent.com/BigFaceCat2023/spacetrans/main/public/images/translator-avatar.png' };
const SUPPORTED_LANGUAGES = [ { code: 'auto', name: '自动识别' }, { code: 'zh-CN', name: '中文' }, { code: 'my-MM', name: '缅甸语' } ];
const SPEECH_RECOGNITION_LANGUAGES = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, ];

// --- 【语音合成工具函数】 ---
const speakText = (text, voiceName) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name.includes(voiceName.split('-')[2].replace('Neural','')));
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    } else {
        utterance.lang = detectLanguage(text);
    }
    window.speechSynthesis.speak(utterance);
};

// --- 【子组件】AiTtsButton ---
const AiTtsButton = ({ text, voiceName }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    useEffect(() => { return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); }; }, []);
    const handleSpeak = (e) => {
        e.stopPropagation();
        if (isPlaying) { window.speechSynthesis.cancel(); setIsPlaying(false); return; }
        if (!window.speechSynthesis) { alert('您的浏览器不支持语音朗读功能'); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name.includes(voiceName.split('-')[2].replace('Neural',''))); // Heuristic match
        if (selectedVoice) { utterance.voice = selectedVoice; }
        else { utterance.lang = detectLanguage(text); }
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        setIsPlaying(true);
        window.speechSynthesis.speak(utterance);
    };
    return ( <button onClick={handleSpeak} className={`p-1.5 text-xs rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isPlaying ? 'text-blue-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`} title={isPlaying ? "停止朗读" : "朗读"}> <i className={`fas ${isPlaying ? 'fa-stop-circle' : 'fa-volume-up'}`}></i> </button> );
};

// --- 【翻译新组件】TranslationCard & TranslationResults ---
const TranslationCard = ({ result, voiceName }) => {
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
                <AiTtsButton text={result.translation} voiceName={voiceName} />
                <button onClick={handleCopy} className="p-1.5 text-xs rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10" title="复制"> <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-copy'}`}></i> </button>
            </div>
        </div>
    );
};
const TranslationResults = ({ results, voiceName }) => (<div className="flex flex-col gap-2.5">{(results || []).map((result, index) => <TranslationCard key={index} result={result} voiceName={voiceName} />)}</div>);

// --- 【子组件】MessageBubble ---
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => {
    const isUser = msg.role === 'user';
    const userBubbleClass = 'bg-blue-500 text-white rounded-br-lg shadow-[0_5px_15px_rgba(59,130,246,0.3),_0_12px_28px_rgba(59,130,246,0.2)]';
    const hasTranslations = msg.translations && msg.translations.length > 0;
    return (
        <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200" />}
            <div className={`text-left flex flex-col ${isUser ? userBubbleClass : ''} ${!isUser && 'p-0'} ${isUser && 'p-3 rounded-2xl'}`} style={{ maxWidth: '85%' }}>
                {hasTranslations ? <TranslationResults results={msg.translations} voiceName={settings.ttsVoice} /> : <p className={isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}>{msg.content || ''}</p>}
                {!isUser && isLastAiMessage && hasTranslations && <button onClick={onRegenerate} className="p-2 -ml-2 mt-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 text-xs" title="重新生成"><i className="fas fa-sync-alt"></i></button>}
            </div>
            {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200" />}
        </div>
    );
};

// --- 【子组件】SettingsModal ---
const ModelManager = ({ models, onChange, onAdd, onDelete }) => ( <> {(models || []).map(m => ( <div key={m.id} className="p-3 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"> <div className="flex items-center justify-between"> <input type="text" value={m.name} onChange={(e) => onChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="font-semibold bg-transparent w-full text-base" /> <button onClick={() => onDelete(m.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> <div> <label className="text-xs font-medium">模型值 (Value)</label> <input type="text" value={m.value} onChange={(e) => onChange(m.id, 'value', e.target.value)} placeholder="例如: gpt-4o" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> </div> ))} <button onClick={onAdd} className="w-full mt-2 py-2 bg-blue-500 text-white rounded-md text-sm"><i className="fas fa-plus mr-2"></i>添加新模型</button> </> );
const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [isKeyVisible, setKeyVisible] = useState(false); const fileInputRef = useRef(null); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleApiChange = (field, value) => setTempSettings(p => ({ ...p, apiConfig: { ...p.apiConfig, [field]: value } })); const handleBgImageSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => handleChange('chatBackgroundUrl', e.target.result); reader.readAsDataURL(file); } event.target.value = null; }; const handleAddModel = () => handleChange('chatModels', [...(tempSettings.chatModels || []), { id: generateSimpleId('model'), name: '新模型', value: '' }]); const handleDeleteModel = (id) => { if (!window.confirm('确定删除吗？')) return; handleChange('chatModels', (tempSettings.chatModels || []).filter(m => m.id !== id)); }; const handleModelChange = (id, field, value) => handleChange('chatModels', (tempSettings.chatModels || []).map(m => m.id === id ? { ...m, [field]: value } : m)); return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4" onClick={onClose}> <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200 flex flex-col" style={{ height: 'min(700px, 90vh)' }} onClick={e => e.stopPropagation()}> <h3 className="text-2xl font-bold p-6 shrink-0">设置</h3> <div className="space-y-6 flex-grow overflow-y-auto px-6"> <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3"> <h4 className="font-bold text-lg">API 设置 (OpenAI 兼容)</h4> <div> <label className="text-xs font-medium block">接口地址 (Endpoint)</label> <input type="text" value={tempSettings.apiConfig.url} onChange={(e) => handleApiChange('url', e.target.value)} placeholder="例如: https://api.openai.com/v1" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm" /> </div> <div> <label className="text-xs font-medium block">密钥 (Key)</label> <div className="relative"><input type={isKeyVisible ? 'text' : 'password'} value={tempSettings.apiConfig.key} onChange={(e) => handleApiChange('key', e.target.value)} placeholder="请输入密钥" className="w-full mt-1 px-2 py-1 pr-8 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm" /><button type='button' onClick={()=>setKeyVisible(p=>!p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><i className={`fas ${isKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i></button></div></div> </div> <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"><h4 className="font-bold mb-3 text-lg">模型管理</h4><ModelManager models={tempSettings.chatModels} onChange={handleModelChange} onAdd={handleAddModel} onDelete={handleDeleteModel} /></div> <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"> <h4 className="font-bold mb-3 text-lg">发音人选择</h4> <select value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className="w-full mt-1 px-2 py-2 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm">{MICROSOFT_TTS_VOICES.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}</select> </div> <div className="space-y-4"> <div><label className="block text-sm font-medium mb-1">聊天背景</label><button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-600 text-white rounded-md shrink-0 hover:bg-gray-700">上传背景图</button><input type="file" ref={fileInputRef} onChange={handleBgImageSelect} accept="image/*" className="hidden" /></div> <div className="flex items-center gap-4"><label className="text-sm shrink-0">背景图透明度: {tempSettings.backgroundOpacity}%</label><input type="range" min="0" max="100" step="1" value={tempSettings.backgroundOpacity} onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))} className="w-full"/></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">自动朗读首个翻译结果</label><input type="checkbox" checked={tempSettings.autoReadFirstTranslation} onChange={(e) => handleChange('autoReadFirstTranslation', e.target.checked)} className="h-5 w-5 text-blue-500 rounded" /></div> </div> </div> <div className="flex justify-end gap-3 mt-4 p-6 shrink-0 border-t border-gray-200 dark:border-gray-700"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-blue-600 text-white rounded-md">保存</button></div> </div> </div> ); };

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

    useEffect(() => { setIsMounted(true); const savedSettings = safeLocalStorageGet('ai_chat_settings'); if (savedSettings) { const parsed = JSON.parse(savedSettings); setSettings({ ...DEFAULT_SETTINGS, ...parsed, chatModels: parsed.chatModels && parsed.chatModels.length > 0 ? parsed.chatModels : CHAT_MODELS_LIST }); } setMessages([{ role: 'ai', content: TRANSLATION_PROMPT.openingLine, timestamp: Date.now() }]); }, []);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings)); } }, [settings, isMounted]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleSwapLanguages = () => { if (sourceLang === 'auto' || sourceLang === targetLang) return; const currentSource = sourceLang; setSourceLang(targetLang); setTargetLang(currentSource); };
    const getLangName = (code) => SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;
    const getModelName = (value) => (settings.chatModels || []).find(m => m.value === value)?.name || value;

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
    
    // 【核心修复】 robust JSON parsing
    const parseJsonResponse = (jsonString) => {
        let cleanJsonString = jsonString.trim();
        const startIndex = cleanJsonString.indexOf('{');
        const endIndex = cleanJsonString.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            cleanJsonString = cleanJsonString.substring(startIndex, endIndex + 1);
        }
        return JSON.parse(cleanJsonString);
    };

    const fetchAiResponse = async (messagesForApi) => {
        setIsLoading(true); setError('');
        const { apiConfig, selectedModel } = settings;
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
            
            setMessages(prev => [...prev, { role: 'ai', timestamp: Date.now(), translations: translationsArray }]);
            if (settings.autoReadFirstTranslation) {
                speakText(translationsArray[0].translation, settings.ttsVoice);
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
            const lastUserMsgIndex = currentMessages.map(m => m.role).lastIndexOf('user');
            if (lastUserMsgIndex > -1) { currentMessages = currentMessages.slice(0, lastUserMsgIndex + 1); setMessages(currentMessages); } 
            else { return; }
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
    
    const handleMainButtonClick = (e) => {
        e.preventDefault();
        if (showSendButton) { handleSubmit(); } 
        else { if (isListening) { recognitionRef.current?.stop(); } else { startListening(); } }
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-transparent text-gray-800 dark:text-gray-200 overflow-hidden relative">
            <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100 }}></div>
            <div className="absolute inset-0 bg-white/30 dark:bg-black/40 z-0"></div>

            <div className="flex-1 flex flex-col h-full relative overflow-hidden z-10 pt-safe-top">
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {messages.map((msg, index) => ( <div key={index}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} /> </div> ))}
                    <div ref={messagesEndRef} />
                </div>

                <footer className="shrink-0 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                     {error && <div className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded" onClick={()=>setError('')}>{error} (点击关闭)</div>}
                    <div className="relative">
                         <div className="flex items-center justify-center gap-2 mb-2">
                           <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="bg-gray-200/50 dark:bg-gray-700/50 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 appearance-none text-center text-gray-800 dark:text-gray-200">{SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800">{l.name}</option>)}</select>
                           <button onClick={handleSwapLanguages} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200/50 dark:bg-gray-700/50 backdrop-blur-sm hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-transform active:rotate-180 disabled:opacity-50" disabled={sourceLang === 'auto'}><i className="fas fa-exchange-alt text-gray-800 dark:text-gray-200"></i></button>
                           <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-gray-200/50 dark:bg-gray-700/50 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 appearance-none text-center text-gray-800 dark:text-gray-200">{SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800">{l.name}</option>)}</select>
                           <button onClick={() => setShowModelSelector(true)} className="bg-gray-200/50 dark:bg-gray-700/50 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 text-gray-800 dark:text-gray-200">{getModelName(settings.selectedModel)}</button>
                        </div>
                        <form onSubmit={handleMainButtonClick} className="flex items-end gap-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg p-2 rounded-[28px] shadow-lg border border-white/30 dark:border-gray-700/50">
                            <button onClick={() => setShowSettings(true)} className="w-12 h-12 flex items-center justify-center shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-cog text-gray-600 dark:text-gray-300"></i></button>
                            <textarea value={userInput} onChange={e=>setUserInput(e.target.value)} placeholder={isListening ? "正在聆听..." : "输入要翻译的内容..."} className="flex-1 bg-transparent max-h-48 min-h-[48px] py-3 px-2 resize-none outline-none text-lg leading-6 dark:placeholder-gray-500 self-center" rows={1} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} />
                            <button type="button" onClick={handleMainButtonClick} onMouseDown={handleMicPress} onMouseUp={handleMicRelease} onTouchStart={handleMicPress} onTouchEnd={handleMicRelease} className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ease-in-out ${showSendButton ? 'bg-blue-600 text-white' : (isListening ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-blue-500 text-white')}`}><i className={`fas ${showSendButton ? 'fa-arrow-up' : (isListening ? 'fa-stop' : 'fa-microphone-alt')} text-2xl`}></i></button>
                        </form>
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
