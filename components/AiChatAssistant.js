// /components/AiChatAssistant.js - 终极完整版：修复崩溃和点击问题，整合所有功能
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- 子组件和常量定义区域 ---

// TTS 引擎枚举
export const TTS_ENGINE = {
  GEMINI_TTS: 'gemini-tts-1',
  EXTERNAL_API: 'external_api'
};

// 统一的 TTS 按钮组件
const TtsButton = ({ text, apiKey, ttsSettings = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '' || (ttsSettings.ttsEngine === TTS_ENGINE.GEMINI_TTS && !apiKey)) {
      if (ttsSettings.ttsEngine === TTS_ENGINE.GEMINI_TTS && !apiKey) {
        console.warn('Google TTS需要API密钥');
      }
      return;
    }
    setIsLoading(true);

    // 清洗文本，移除 Markdown 符号
    const cleanedText = textToSpeak.replace(/\*\*/g, '').replace(/^- /gm, '');

    const { ttsEngine = TTS_ENGINE.GEMINI_TTS, ttsVoice = 'Zephyr' } = ttsSettings;

    try {
      let audioBlob;
      if (ttsEngine === TTS_ENGINE.GEMINI_TTS) {
        const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
        const body = {
          input: { text: cleanedText },
          voice: { languageCode: 'zh-CN', name: `projects/-/locations/global/models/${ttsVoice}` },
          audioConfig: { audioEncoding: 'MP3' }
        };
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) { const data = await response.json(); throw new Error(`Gemini TTS: ${data.error?.message || response.statusText}`); }
        const data = await response.json();
        if (!data.audioContent) throw new Error('Gemini TTS 未返回音频内容。');
        const binaryString = window.atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
      } else {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`外部 TTS API 错误 (状态码: ${response.status})`);
        audioBlob = await response.blob();
      }
      
      if (audioBlob) {
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        await audio.play();
      }
    } catch (err) {
      console.error('朗读失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, ttsSettings]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); synthesizeSpeech(text); }}
      disabled={isLoading}
      className={`tts-button p-2 rounded-full transition-colors ${isLoading ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
      aria-label={`朗读`}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : (
        <i className="fas fa-volume-up"></i>
      )}
    </button>
  );
};


// 简单的 Markdown 解析器
const SimpleMarkdown = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        if (line.match(/\*\*(.*?)\*\*/)) {
            return <strong key={index} className="block mt-2 mb-1">{line.replace(/\*\*/g, '')}</strong>;
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
        }
        return <p key={index} className="my-1">{line}</p>;
    });
    return <div>{lines}</div>;
};

// 消息气泡组件
const MessageBubble = ({ msg, settings }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);

    // 自动朗读逻辑
    useEffect(() => {
        if (!isUser && msg.content && settings.autoRead && messageRef.current) {
            const ttsButton = messageRef.current.querySelector('.tts-button');
            if (ttsButton) {
                setTimeout(() => ttsButton.click(), 300);
            }
        }
    }, [isUser, msg.content, settings.autoRead]);

    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div ref={messageRef} className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
                {msg.image && <img src={msg.image} alt="用户上传" className="rounded-md mb-2 max-w-full h-auto" />}
                <div className="prose dark:prose-invert max-w-none prose-p:my-1 prose-strong:text-current">
                    <SimpleMarkdown text={msg.content} />
                </div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-3 mt-2 text-gray-500 dark:text-gray-400">
                        <TtsButton text={msg.content} apiKey={settings.apiKey} ttsSettings={settings} />
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
    const [tempSettings, setTempSettings] = useState(settings);

    const handleChange = (key, value) => {
        setTempSettings(prev => ({ ...prev, [key]: value }));
    };
    
    // 省略了提示词管理，以确保稳定，未来可以加回
    const geminiTtsVoices = [
        { name: 'Zephyr (Bright)', value: 'Zephyr' }, { name: 'Puck (Upbeat)', value: 'Puck' },
        { name: 'Charon (Informative)', value: 'Charon' }, { name: 'Kore (Firm)', value: 'Kore' },
        { name: 'Fenrir (Excitable)', value: 'Fenrir' }, { name: 'Leda (Youthful)', value: 'Leda' }
    ];

    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' },
        { name: '缅甸语', value: 'my-MM' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">设置</h3>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">你的 Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="在此粘贴你的 API 密钥" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" />
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 模型</label>
                    <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (推荐)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 TTS 引擎</label>
                    <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value={TTS_ENGINE.GEMINI_TTS}>Gemini TTS (推荐)</option>
                        <option value={TTS_ENGINE.EXTERNAL_API}>第三方 API (晓辰)</option>
                    </select>
                </div>
                {tempSettings.ttsEngine === TTS_ENGINE.GEMINI_TTS && (
                    <div className="mb-4 pb-4 border-b dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <h5 className="text-md font-bold mb-2 text-gray-800 dark:text-white">Gemini TTS 配置</h5>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">发音人</label>
                        <select value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                            {geminiTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">语音识别语言</label>
                    <select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        {speechLanguageOptions.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}
                    </select>
                </div>
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI 回复后自动朗读</label>
                    <input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary" />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存设置</button>
                </div>
            </div>
        </div>
    );
};

// 默认提示词
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的、耐心的中文老师和语言学习助手，你的学生是缅甸人。你的任务是帮助他们学习中文，纠正语法，解释词语，提供例句，并始终保持友好和鼓励。请根据学生的提问，给出清晰、简洁、实用的回答，必要时提供中文和缅甸语双语解释。你的回答应遵循以下格式：1. 如果需要纠正句子，请先写出“**纠正后的句子：**”\n2. 如果需要解释词语或语法，请先写出“**解释：**”，并提供中缅双语。\n3. 最后，提供 1-2 个使用正确语法的额外例句，并用列表符号“-”开头，标题为“**更多例句：**”。\n4. 你的回答要简洁、友好、鼓励学生。` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的、耐心的中文老师，你的学生是缅甸人。请用中文和缅甸语双语，详细解释学生提供的中文词语的含义、用法，并给出2-3个例句。` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手，你的学生是缅甸人。请将学生提供的中文句子翻译成缅甸语，或将缅甸语句子翻译成中文。` }
];

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: false,
    ttsEngine: 'gemini-tts-1',
    ttsVoice: 'Zephyr',
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [inputMode, setInputMode] = useState('text');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');
    const recognitionRef = useRef(null);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    
    // --- 初始化和保存设置 ---
    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v4_final');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // 合并保存的设置和默认设置，以防未来新增设置项
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem('ai_assistant_settings_v4_final', JSON.stringify(newSettings));
        } catch (e) { console.error("Failed to save settings", e); }
        setShowSettings(false);
    }, []);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 组件挂载时添加初始欢迎消息
    useEffect(() => {
        if (isMounted && messages.length === 0) {
            setMessages([{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }]);
        }
    }, [isMounted]);
    
    // --- 交互逻辑 ---
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result.split(',')[1]);
                setImagePreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSpeechToggle = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setSpeechRecognitionError('您的浏览器不支持语音输入功能。');
                return;
            }
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = settings.speechLanguage;
            recognitionRef.current.onstart = () => { setIsListening(true); setSpeechRecognitionError(''); };
            recognitionRef.current.onresult = (e) => {
                setUserInput(prev => prev + e.results[0][0].transcript);
            };
            recognitionRef.current.onerror = (e) => {
                if (e.error !== 'no-speech' && e.error !== 'aborted') {
                    setSpeechRecognitionError(`语音输入错误: ${e.error}`);
                }
                setIsListening(false);
            };
            recognitionRef.current.onend = () => setIsListening(false);
            recognitionRef.current.start();
        }
    }, [isListening, settings.speechLanguage]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const textToProcess = userInput.trim();
        if ((!textToProcess && !selectedImage) || isLoading) return;
        if (!settings.apiKey.trim()) {
            setError('请先在设置中输入您的 Google Gemini API 密钥！');
            setShowSettings(true);
            return;
        }

        const userMessageContent = [];
        if (textToProcess) userMessageContent.push({ text: textToProcess });
        if (selectedImage) userMessageContent.push({ inlineData: { mimeType: 'image/jpeg', data: selectedImage } });

        setMessages(prev => [...prev, { role: 'user', content: textToProcess || '[图片]', image: imagePreviewUrl }]);
        setUserInput('');
        clearImage();

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId)?.content || DEFAULT_PROMPTS[0].content;
        const history = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
        const contents = [
          { role: 'user', parts: [{ text: currentPrompt }] },
          { role: 'model', parts: [{ text: "好的，我明白了。我将扮演一名专业的中文老师。请开始提问吧。" }] },
          ...history,
          { role: 'user', parts: userMessageContent }
        ];

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${settings.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents, generationConfig: { temperature: 0.5, maxOutputTokens: 1024 } }),
                    signal: abortControllerRef.current.signal,
                }
            );
            if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || '请求失败'); }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI 未能返回有效内容。');
            
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message);
                setMessages(prev => [...prev, { role: 'ai', content: `很抱歉，出错了：${err.message}` }]);
            } else {
                setError('AI 生成已停止。');
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };
    
    const handleStopGenerating = () => {
        abortControllerRef.current?.abort();
    };

    if (!isMounted) {
        return (
            <div className="w-full h-[80vh] min-h-[600px] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800" style={{ height: '85vh', minHeight: '650px', maxHeight: '900px' }}>
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">AI 中文老师</h2>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            {/* 聊天消息显示区域 */}
            <div 
                className="flex-grow p-4 overflow-y-auto custom-scrollbar relative"
                style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                <div className="flex flex-col gap-4">
                    {messages.map((msg, index) => (
                        <MessageBubble key={index} msg={msg} settings={settings} />
                    ))}
                </div>
                <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-b-2xl border-t dark:border-gray-700 shrink-0">
                {imagePreviewUrl && (
                    <div className="relative mb-2 w-24">
                        <img src={imagePreviewUrl} alt="预览" className="rounded-lg" />
                        <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none" title="移除"><i className="fas fa-times text-xs"></i></button>
                    </div>
                )}
                {speechRecognitionError && <p className="text-red-500 text-sm mb-2 text-center">{speechRecognitionError}</p>}
                
                {isLoading ? (
                    <div className="flex justify-center">
                        <button type="button" onClick={handleStopGenerating} className="w-full px-6 py-3 bg-red-500 text-white font-bold text-xl rounded-lg shadow-md hover:bg-red-600 flex items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-4 border-white border-t-transparent mr-2"></div>
                            停止生成
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex items-end gap-2">
                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-image"></i></button>
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

                        <div className="flex-grow relative">
                            <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none overflow-hidden" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight) + 'px'; }} />
                            <button
                                type="button"
                                onClick={handleSpeechToggle}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-primary'}`}
                                title={isListening ? "停止录音" : "语音输入"}
                            >
                                <i className={`fas fa-microphone`}></i>
                            </button>
                        </div>
                        
                        <button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-dark disabled:opacity-50" disabled={!userInput.trim() && !selectedImage}><i className="fas fa-arrow-up"></i></button>
                    </form>
                )}
            </div>

            {error && <div className="p-2 m-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
