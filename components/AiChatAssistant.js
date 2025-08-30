// /components/AiChatAssistant.js - 最终修复版：简化状态管理，修复设置保存问题
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

// 简单的 Markdown 解析器
const SimpleMarkdown = ({ text, lang, ttsProps }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        if (line.match(/\*\*(.*?)\*\*/)) {
            const content = line.replace(/\*\*/g, '');
            return <strong key={index} className="block mt-4 mb-2 text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="flex-grow">{content}</span><TextToSpeechButton text={content} lang={lang} {...ttsProps} className="ml-2 shrink-0 text-gray-500" /></strong>;
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return <li key={index} className="ml-5 list-disc flex items-start"><span className="flex-grow">{content}</span><TextToSpeechButton text={content} lang={lang} {...ttsProps} className="ml-2 shrink-0 text-gray-500" /></li>;
        }
        const content = line;
        return <p key={index} className="my-1 flex items-center"><span className="flex-grow">{content}</span><TextToSpeechButton text={content} lang={lang} {...ttsProps} className="ml-2 shrink-0 text-gray-500" /></p>;
    });
    return <div>{lines}</div>;
};

// 默认提示词
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的、耐心的中文老师，你的学生是缅甸人。你的任务是帮助他们学习中文，纠正语法，解释词语，提供例句，并始终保持友好和鼓励。请根据学生的提问，给出清晰、简洁、实用的回答，必要时提供中文和缅甸语双语解释。你的回答应遵循以下格式：1. 如果需要纠正句子，请先写出“**纠正后的句子：**”\n2. 如果需要解释词语或语法，请先写出“**解释：**”，并提供中缅双语。\n3. 最后，提供 1-2 个使用正确语法的额外例句，并用列表符号“-”开头，标题为“**更多例句：**”。\n4. 你的回答要简洁、友好、鼓励学生。` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的、耐心的中文老师，你的学生是缅甸人。请用中文和缅甸语双语，详细解释学生提供的中文词语的含义、用法，并给出2-3个例句。` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手，你的学生是缅甸人。请将学生提供的中文句子翻译成缅甸语，或将缅甸语句子翻译成中文。` }
];

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id,
    autoRead: false,
    selectedTtsEngine: 'google_genai',
    googleVoiceName: 'cmn-CN-Wavenet-A',
    googlePitch: 0,
    googleRate: 1,
    externalVoice: 'zh-CN-XiaochenMultilingualNeural',
    externalRate: '-20%',
    externalPitch: '0%'
};

const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);

    // 多模态和语音输入状态
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');

    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // --- 初始化和保存设置 ---
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings');
            if (savedSettings) {
                // 合并保存的设置和默认设置，以防未来新增设置项
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            } else {
                setSettings(DEFAULT_SETTINGS);
            }
        } catch (e) {
            console.error("Failed to load settings from localStorage", e);
            setSettings(DEFAULT_SETTINGS);
        }
    }, []);

    const handleSettingsChange = (newSettings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem('ai_assistant_settings', JSON.stringify(newSettings));
        } catch (e) {
            console.error("Failed to save settings to localStorage", e);
        }
    };

    // 自动滚动到底部
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
    // --- 交互逻辑 (图片、摄像头、语音、提交) ---
    // (这部分逻辑与之前版本相同，为了简洁省略，请直接复制完整代码)
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result.split(',')[1]);
                setImagePreviewUrl(reader.result);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const startCamera = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('您的浏览器不支持摄像头功能！');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setIsCameraActive(true);
                clearImage();
            }
        } catch (err) {
            setError('无法访问摄像头，请检查浏览器权限。');
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsCameraActive(false);
        }
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageDataUrl = canvasRef.current.toDataURL('image/jpeg');
            setSelectedImage(imageDataUrl.split(',')[1]);
            setImagePreviewUrl(imageDataUrl);
            stopCamera();
        }
    };
    
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechRecognitionError('您的浏览器不支持语音输入功能！');
            return;
        }
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'zh-CN';
        recognitionRef.current.onstart = () => { setIsListening(true); setSpeechRecognitionError(''); };
        recognitionRef.current.onresult = (e) => setUserInput(p => p + e.results[0][0].transcript);
        recognitionRef.current.onerror = (e) => setSpeechRecognitionError(`语音输入错误: ${e.error}`);
        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.start();
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim() && !selectedImage || isLoading) return;
        if (!settings.apiKey.trim()) {
            setError('请先在设置中输入您的 Google Gemini API 密钥！');
            setShowSettings(true);
            return;
        }

        const userMessageContent = [];
        if (userInput.trim()) userMessageContent.push({ text: userInput.trim() });
        if (selectedImage) userMessageContent.push({ inlineData: { mimeType: 'image/jpeg', data: selectedImage } });

        setMessages(prev => [...prev, { role: 'user', content: userInput.trim() || '[图片]', image: imagePreviewUrl }]);
        setUserInput('');
        clearImage();

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId)?.content || DEFAULT_PROMPTS[0].content;
        const history = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${settings.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: currentPrompt }] }, ...history, { role: 'user', parts: userMessageContent }],
                        generationConfig: { temperature: 0.5, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
                    }),
                    signal: abortControllerRef.current.signal,
                }
            );
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || '请求失败');
            }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI 未能返回有效内容。');
            
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);

            if (settings.autoRead && aiResponseContent) {
                if (window.speechSynthesis) {
                    const utterance = new SpeechSynthesisUtterterance(aiResponseContent);
                    utterance.lang = 'zh-CN';
                    window.speechSynthesis.speak(utterance);
                }
            }
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

    const currentPromptName = settings.prompts.find(p => p.id === settings.currentPromptId)?.name || '未选择';
    
    // 准备传递给朗读按钮的 props
    const ttsProps = {
        apiKey: settings.apiKey,
        selectedTtsEngine: settings.selectedTtsEngine,
        googleVoiceName: settings.googleVoiceName,
        googlePitch: settings.googlePitch,
        googleRate: settings.googleRate,
        externalVoice: settings.externalVoice,
        externalRate: settings.externalRate,
        externalPitch: settings.externalPitch
    };

    return (
        <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-white">AI 中文学习助手</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">你的专属中文老师！</p>

            {/* 聊天消息显示区域 */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg h-96 overflow-y-auto custom-scrollbar mb-4 border border-gray-200 dark:border-gray-600">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">输入你的问题或上传图片，AI 老师将为你解答。</p>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`mb-4 p-3 rounded-lg shadow-sm flex flex-col ${
                                msg.role === 'user'
                                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100 self-end ml-auto max-w-[80%] items-end'
                                    : 'bg-green-100 dark:bg-green-800 text-green-900 dark:text-green-100 mr-auto max-w-[80%] items-start'
                            }`}
                        >
                            <strong className="block text-sm mb-1">{msg.role === 'user' ? '你' : 'AI 老师'}</strong>
                            {msg.image && <img src={msg.image} alt="用户上传图片" className="max-w-full h-auto rounded-md mb-2" />}
                            <SimpleMarkdown text={msg.content} lang="zh-CN" ttsProps={ttsProps} />
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 输入和操作按钮 */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                {imagePreviewUrl && (
                    <div className="relative mb-2 self-center">
                        <img src={imagePreviewUrl} alt="图片预览" className="max-h-24 rounded-lg border border-gray-300 dark:border-gray-600" />
                        <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs leading-none" title="移除图片"><i className="fas fa-times"></i></button>
                    </div>
                )}
                <div className="flex gap-2 mb-2 relative">
                    <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" title="上传图片" disabled={isCameraActive || isLoading}><i className="fas fa-image text-gray-700 dark:text-gray-200 text-lg"></i></button>
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isCameraActive || isLoading} />
                    <button type="button" onClick={isCameraActive ? takePhoto : startCamera} className={`p-2 rounded-lg transition-colors ${isCameraActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'}`} title={isCameraActive ? "拍照" : "打开摄像头"} disabled={isLoading}><i className={`fas ${isCameraActive ? 'fa-camera' : 'fa-video'} text-lg`}></i></button>
                    <button type="button" onClick={isListening ? stopListening : startListening} className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'}`} title={isListening ? "停止语音输入" : "语音输入"} disabled={isLoading}><i className={`fas ${isListening ? 'fa-microphone-alt-slash' : 'fa-microphone'} text-lg`}></i></button>
                    <span className="flex-grow flex items-center justify-center text-sm text-gray-600 dark:text-gray-300 px-2 truncate">{currentPromptName}</span>
                    <button type="button" onClick={() => setShowSettings(true)} className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" title="设置" disabled={isLoading}><i className="fas fa-cog text-gray-700 dark:text-gray-200 text-lg"></i></button>
                </div>
                {isCameraActive && (
                    <div className="relative mb-2">
                        <video ref={videoRef} className="w-full rounded-lg border border-gray-300 dark:border-gray-600"></video>
                        <canvas ref={canvasRef} className="hidden"></canvas>
                        <button type="button" onClick={stopCamera} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs leading-none" title="关闭摄像头"><i className="fas fa-times"></i></button>
                    </div>
                )}
                {speechRecognitionError && <p className="text-red-500 text-sm mb-2 text-center">{speechRecognitionError}</p>}
                <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="输入你的中文问题或句子..." className="w-full h-20 px-4 py-3 text-lg text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none" disabled={isLoading} />
                <button type="submit" className="w-full mt-4 px-6 py-3 bg-primary text-white font-bold text-xl rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading || (!userInput.trim() && !selectedImage)}>
                    {isLoading ? (<div className="flex items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-t-transparent mr-2"></div>停止生成</div>) : '发送问题'}
                </button>
            </form>

            {error && <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

            {showSettings && <SettingsModal settings={settings} onSave={handleSettingsChange} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

// --- 设置面板组件 ---
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings);

    const handleChange = (key, value) => {
        const newSettings = { ...tempSettings, [key]: value };
        setTempSettings(newSettings);
    };

    const handlePromptChange = (e, promptId, field) => {
        const newPrompts = tempSettings.prompts.map(p => 
            p.id === promptId ? { ...p, [field]: e.target.value } : p
        );
        setTempSettings({ ...tempSettings, prompts: newPrompts });
    };

    const handleAddPrompt = () => {
        const newId = `custom-${Date.now()}`;
        const newPrompts = [...tempSettings.prompts, { id: newId, name: '新提示词', content: '请输入提示词内容...' }];
        setTempSettings({ ...tempSettings, prompts: newPrompts });
    };

    const handleDeletePrompt = (idToDelete) => {
        if (window.confirm('确定删除此提示词吗？')) {
            const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete);
            let newCurrentPromptId = tempSettings.currentPromptId;
            if (newCurrentPromptId === idToDelete) {
                newCurrentPromptId = newPrompts[0]?.id || '';
            }
            setTempSettings({ ...tempSettings, prompts: newPrompts, currentPromptId: newCurrentPromptId });
        }
    };
    
    const googleVoiceOptions = [
        { name: '标准男声 A', value: 'cmn-CN-Standard-A' }, { name: '标准女声 B', value: 'cmn-CN-Standard-B' },
        { name: 'Wavenet 男声 A (推荐)', value: 'cmn-CN-Wavenet-A' }, { name: 'Wavenet 女声 B', value: 'cmn-CN-Wavenet-B' },
        { name: '缅甸语女声', value: 'my-MM-Standard-A' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">设置</h3>

                {/* API 密钥设置 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">你的 Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="在此粘贴你的 API 密钥" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" />
                </div>

                {/* AI 模型选择 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 模型</label>
                    <select value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (推荐)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                </div>

                {/* TTS 引擎选择 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 TTS 引擎</label>
                    <select value={tempSettings.selectedTtsEngine} onChange={(e) => handleChange('selectedTtsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">
                        <option value="google_genai">Google GenAI TTS (推荐)</option>
                        <option value="external_api">第三方 API (晓辰)</option>
                        <option value="system_tts">浏览器系统 TTS</option>
                    </select>
                </div>

                {/* Google TTS 设置 */}
                {tempSettings.selectedTtsEngine === 'google_genai' && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <h5 className="text-md font-bold mb-2">Google TTS 配置</h5>
                        <div className="mb-3">
                            <label className="block text-sm mb-1">发音人</label>
                            <select value={tempSettings.googleVoiceName} onChange={(e) => handleChange('googleVoiceName', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                                {googleVoiceOptions.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}
                            </select>
                        </div>
                        <div className="mb-3">
                            <label className="block text-sm mb-1">语速: {tempSettings.googleRate.toFixed(2)}</label>
                            <input type="range" min="0.5" max="2.0" step="0.05" value={tempSettings.googleRate} onChange={(e) => handleChange('googleRate', parseFloat(e.target.value))} className="w-full" />
                        </div>
                        <div className="mb-3">
                            <label className="block text-sm mb-1">语调: {tempSettings.googlePitch.toFixed(2)}</label>
                            <input type="range" min="-10" max="10" step="0.5" value={tempSettings.googlePitch} onChange={(e) => handleChange('googlePitch', parseFloat(e.target.value))} className="w-full" />
                        </div>
                    </div>
                )}
                
                {/* 自动朗读开关 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label className="block text-sm font-medium">AI 回复后自动朗读</label>
                    <input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" />
                </div>
                
                {/* 提示词管理 */}
                <div className="mb-6">
                    <h4 className="text-lg font-bold mb-3">自定义提示词管理</h4>
                    <div className="space-y-2 mb-4">
                        {tempSettings.prompts.map(prompt => (
                            <div key={prompt.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center flex-grow cursor-pointer">
                                        <input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === prompt.id} onChange={() => handleChange('currentPromptId', prompt.id)} className="mr-2 text-primary" />
                                        <input type="text" value={prompt.name} onChange={(e) => handlePromptChange(e, prompt.id, 'name')} className="font-medium bg-transparent w-full"/>
                                    </label>
                                    <button type="button" onClick={() => handleDeletePrompt(prompt.id)} className="p-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">删除</button>
                                </div>
                                <textarea value={prompt.content} onChange={(e) => handlePromptChange(e, prompt.id, 'content')} className="w-full mt-2 h-24 p-2 bg-gray-50 dark:bg-gray-800 border rounded-md resize-y"></textarea>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddPrompt} className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"><i className="fas fa-plus mr-2"></i>添加新提示词</button>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300">关闭</button>
                    <button type="button" onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-dark">保存并关闭</button>
                </div>
            </div>
        </div>
    );
};
