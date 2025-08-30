// /components/AiChatAssistant.js - 终极完整版：全新 UI，Gemini TTS，长按语音，修复所有问题
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; // 导入新的 AiTtsButton

// SimpleMarkdown 组件 (定义在外部，因为它也被 MessageBubble 使用)
const SimpleMarkdown = ({ text, lang, apiKey, ttsSettings }) => {
    if (!text) return null;

    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') { return <br key={index} />; }
        if (line.match(/\*\*(.*?)\*\*/)) {
            const content = line.replace(/\*\*/g, '');
            return (
                <strong key={index} className="block mt-4 mb-2 text-lg text-gray-800 dark:text-gray-200 flex items-center">
                    <span className="flex-grow">{content}</span>
                    <AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" />
                </strong>
            );
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return (
                <li key={index} className="ml-5 list-disc flex items-start">
                    <span className="flex-grow">{content}</span>
                    <AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" />
                </li>
            );
        }
        const content = line;
        return (
            <p key={index} className="my-1 flex items-center">
                <span className="flex-grow">{content}</span>
                <AiTtsButton text={content} lang={lang} apiKey={apiKey} ttsSettings={ttsSettings} className="ml-2 shrink-0 text-gray-500" />
            </p>
        );
    });

    return <div>{lines}</div>;
};

// 默认提示词 (已缩短内容，避免代码过长)
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的中文老师。请纠正学生的中文语法错误，提供中缅双语解释和例句。` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的中文老师。请用中缅双语详细解释词语含义、用法和例句。` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手。请进行中文和缅甸语的互译。` }
];

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash',
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '', // 确保有默认值
    autoRead: false,
    ttsEngine: TTS_ENGINE_GEMINI,
    ttsVoice: 'Zephyr',
    speechLanguage: 'zh-CN', // 语音识别语言
    chatBackgroundUrl: '/images/chat-bg.jpg', // 默认聊天背景图
    userAvatarUrl: '/images/user-avatar.png', // 默认用户头像
    aiAvatarUrl: '/images/ai-avatar.png', // 默认 AI 头像
};

const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    
    // *** 关键修复：延迟渲染，解决 Hydration Error ***
    const [isMounted, setIsMounted] = useState(false);

    // UI 状态
    const [inputMode, setInputMode] = useState('text'); // 'text' or 'voice'

    // 多模态输入状态
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false); // 摄像头是否激活

    // 语音输入状态
    const [isListening, setIsListening] = useState(false);
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');
    const recognitionRef = useRef(null);

    // 长按语音状态
    const longPressTimer = useRef(null);
    const touchStartY = useRef(0);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null); // 文件输入框的引用
    const videoRef = useRef(null); // 视频流的引用
    const canvasRef = useRef(null); // 拍照的 Canvas 引用

    // --- 初始化和保存设置 ---
    useEffect(() => {
        setIsMounted(true); // 标记组件已在客户端挂载
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v3'); // 使用新的 key
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
        } catch (e) { console.error("Failed to load settings", e); }
    }, []);

    // 当 settings 改变时，写入 localStorage
    useEffect(() => {
        if (isMounted) { // 确保只在客户端且挂载后才写入
            try {
                localStorage.setItem('ai_assistant_settings_v3', JSON.stringify(settings));
            } catch (e) { console.error("Failed to save settings to localStorage", e); }
        }
    }, [settings, isMounted]);

    const handleSaveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        setShowSettings(false);
    }, []);

    // --- 自动滚动到底部 ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    // --- 图片处理逻辑 ---
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result.split(',')[1]); // 提取 Base64 部分
                setImagePreviewUrl(reader.result); // 用于显示预览
                stopCamera(); // 上传图片后关闭摄像头
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // 清空文件输入框
        }
    };

    // --- 摄像头拍照逻辑 ---
    const startCamera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError('您的浏览器不支持摄像头功能！');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setIsCameraActive(true);
                setSelectedImage(null); // 激活摄像头清空已选图片
                setImagePreviewUrl(null);
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('无法访问摄像头，请检查浏览器权限。');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
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
            stopCamera(); // 拍照后关闭摄像头
        }
    };

    // --- 语音输入逻辑 ---
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechRecognitionError('您的浏览器不支持语音输入功能！');
            return;
        }
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // 只听一次，适合长按发送
        recognitionRef.current.lang = settings.speechLanguage; // 使用设置中的语言
        recognitionRef.current.interimResults = false; // 只返回最终结果

        recognitionRef.current.onstart = () => {
            setIsListening(true);
            setSpeechRecognitionError('');
        };

        recognitionRef.current.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setUserInput(transcript.trim()); // 长按模式直接设置最终结果
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setSpeechRecognitionError(`语音输入错误: ${event.error}`);
            setIsListening(false);
            setIsLongPressing(false); // 错误时也重置长按状态
            setIsCancelling(false);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
            // 如果是长按模式且没有取消，则自动提交
            if (isLongPressing && !isCancelling && userInput.trim()) { // 确保有识别内容
                handleSubmit(null, userInput.trim()); // 触发提交
            }
            setIsLongPressing(false);
            setIsCancelling(false);
        };

        recognitionRef.current.start();
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    // --- 长按语音交互逻辑 ---
    const handleLongPressStart = (e) => {
        if (e.touches && e.touches.length > 0) { // 仅处理触摸事件，避免鼠标模拟
            touchStartY.current = e.touches[0].clientY;
        }
        // 阻止默认行为，避免页面滚动
        // e.preventDefault(); 
        
        setIsCancelling(false);
        longPressTimer.current = setTimeout(() => {
            setIsLongPressing(true);
            startListening(); // 开始录音
        }, 300); // 300ms 视为长按
    };

    const handleLongPressMove = (e) => {
        if (isLongPressing && e.touches && e.touches.length > 0) {
            const deltaY = touchStartY.current - e.touches[0].clientY;
            if (deltaY > 50) { // 上滑超过50px 视为取消
                setIsCancelling(true);
            } else {
                setIsCancelling(false);
            }
        }
    };

    const handleLongPressEnd = () => {
        clearTimeout(longPressTimer.current);
        if (isLongPressing) {
            if (isCancelling) {
                stopListening(); // 取消，并停止录音
                setUserInput(''); // 清空录音内容
            } else {
                // 停止录音，onend 事件会自动处理提交
                stopListening();
            }
        }
        setIsLongPressing(false);
        setIsCancelling(false);
    };


    const handleSubmit = async (e, voiceInput = '') => {
        if (e) e.preventDefault();
        const textToProcess = voiceInput || userInput.trim();
        if (!textToProcess && !selectedImage || isLoading) return;
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

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${settings.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'system', parts: [{ text: currentPrompt }] }, ...history, { role: 'user', parts: userMessageContent }],
                        generationConfig: { temperature: 0.5, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
                    }),
                    signal: abortControllerRef.current.signal,
                }
            );
            if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || '请求失败'); }
            const data = await response.json();
            const aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI 未能返回有效内容。');
            
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);

            if (settings.autoRead && aiResponseContent) {
                // 自动朗读 AI 回复
                // 直接使用 window.speechSynthesis 确保自动朗读功能
                if (window.speechSynthesis) { // 再次检查浏览器TTS支持
                    const utterance = new SpeechSynthesisUtterance(aiResponseContent);
                    utterance.lang = 'zh-CN'; // 假设AI回复是中文
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

    // 如果组件尚未在客户端挂载，则显示加载状态，防止 Hydration Error
    if (!isMounted) {
        return (
            <div className="w-full max-w-2xl mx-auto my-8 p-6 flex items-center justify-center h-[700px] bg-gray-100 dark:bg-gray-800 rounded-2xl">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
            </div>
        );
    }

    const currentPromptName = settings.prompts.find(p => p.id === settings.currentPromptId)?.name || '未选择';
    
    // 准备传递给朗读按钮的 props
    const ttsProps = {
        apiKey: settings.apiKey,
        ttsSettings: settings, // 直接传递 settings 对象
    };

    return (
        <div className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800" style={{ height: '80vh', minHeight: '600px', maxHeight: '900px' }}>
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-2xl border-b dark:border-gray-700 shrink-0">
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
                <div ref={messagesEndRef} /> {/* 滚动到底部的锚点 */}
            </div>

            {/* 输入区域 */}
            <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-b-2xl border-t dark:border-gray-700 shrink-0">
                {/* 图片预览和清除按钮 */}
                {imagePreviewUrl && (
                    <div className="relative mb-2 w-24">
                        <img src={imagePreviewUrl} alt="预览" className="rounded-lg" />
                        <button
                            type="button"
                            onClick={clearImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none"
                            title="移除图片"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                )}
                {/* 摄像头预览区域 */}
                {isCameraActive && (
                    <div className="relative mb-2">
                        <video ref={videoRef} className="w-full rounded-lg border border-gray-300 dark:border-gray-600"></video>
                        <canvas ref={canvasRef} className="hidden"></canvas> {/* 用于拍照的隐藏画布 */}
                        <button 
                            type="button" 
                            onClick={stopCamera} 
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs leading-none"
                            title="关闭摄像头"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}
                {speechRecognitionError && <p className="text-red-500 text-sm mb-2 text-center">{speechRecognitionError}</p>}


                <div className="flex items-end gap-2">
                    {/* 文件上传按钮 */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="上传图片"
                        disabled={isCameraActive || isLoading}
                    >
                        <i className="fas fa-image text-gray-700 dark:text-gray-200"></i>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isCameraActive || isLoading}
                    />
                    
                    {/* 拍照按钮 */}
                    <button
                        type="button"
                        onClick={isCameraActive ? takePhoto : startCamera}
                        className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        title={isCameraActive ? "拍照" : "打开摄像头"}
                        disabled={isLoading}
                    >
                        <i className={`fas ${isCameraActive ? 'fa-camera' : 'fa-video'} text-gray-700 dark:text-gray-200`}></i>
                    </button>

                    {/* 输入模式切换按钮（麦克风/键盘） */}
                    <button onClick={() => setInputMode(p => p === 'text' ? 'voice' : 'text')} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <i className={`fas ${inputMode === 'text' ? 'fa-microphone' : 'fa-keyboard'} text-gray-700 dark:text-gray-200`}></i>
                    </button>

                    {/* 主输入区：文本输入框 或 按住说话按钮 */}
                    {inputMode === 'text' ? (
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="输入消息与 AI 聊天..."
                            className="flex-grow px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none overflow-hidden" // overflow-hidden 防止出现滚动条
                            rows={1}
                            style={{minHeight:'44px'}} // 确保单行高度
                            onInput={(e) => { // 自动调整高度
                                e.target.style.height = 'auto';
                                e.target.style.height = (e.target.scrollHeight) + 'px';
                            }}
                            disabled={isLoading}
                        />
                    ) : (
                        <button
                            onTouchStart={handleLongPressStart} onTouchMove={handleLongPressMove} onTouchEnd={handleLongPressEnd}
                            onMouseDown={handleLongPressStart} onMouseUp={handleLongPressEnd}
                            className={`flex-grow py-2 rounded-full text-center font-bold text-white transition-colors duration-200 ${
                                isLongPressing ? (isCancelling ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-500 dark:bg-gray-600'
                            }`}
                            disabled={isLoading}
                        >
                            {isLongPressing ? (isCancelling ? '松开取消' : '松开发送') : '按住说话'}
                        </button>
                    )}
                    
                    {/* 发送按钮 */}
                    <button type="submit" onClick={handleSubmit} className="p-3 bg-primary text-white rounded-full hover:bg-blue-dark disabled:opacity-50" disabled={isLoading || (!userInput.trim() && !selectedImage)}>
                        <i className="fas fa-arrow-up"></i>
                    </button>
                </div>
            </div>

            {error && <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

// --- MessageBubble 组件 ---
const MessageBubble = ({ msg, settings }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null); // 用于获取消息内容

    // 自动朗读逻辑
    const autoReadMessage = useCallback(() => {
        if (!settings.autoRead || !msg.content || !messageRef.current) return;

        // 尝试通过点击第一个朗读按钮来触发
        const ttsButton = messageRef.current.querySelector('.tts-button');
        if (ttsButton && !ttsButton.disabled) {
             ttsButton.click();
        } else {
            // Fallback to system TTS if button not found or disabled
            if (window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance(msg.content);
                utterance.lang = 'zh-CN'; 
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [msg.content, settings.autoRead, settings.ttsEngine, settings.ttsVoice, settings.apiKey]);
    
    // AI 消息渲染后自动朗读
    useEffect(() => {
        if (!isUser && msg.content && settings.autoRead) {
            autoReadMessage();
        }
    }, [isUser, msg.content, settings.autoRead, autoReadMessage]);

    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />}
            <div ref={messageRef} className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '80%' }}>
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
            {isUser && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full" />}
        </div>
    );
};


// --- 设置面板组件 ---
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
        const newPrompts = [...tempSettings.prompts, { id: newId, name: '新提示词', content: '请输入提示词内容...' }];
        handleChange('prompts', newPrompts);
    };

    const handleDeletePrompt = (idToDelete) => {
        if (window.confirm('确定删除此提示词吗？')) {
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
        { name: 'Zephyr (Bright)', value: 'Zephyr' }, 
        { name: 'Puck (Upbeat)', value: 'Puck' },
        { name: 'Charon (Informative)', value: 'Charon' }, 
        { name: 'Kore (Firm)', value: 'Kore' },
        { name: 'Fenrir (Excitable)', value: 'Fenrir' },
        { name: 'Leda (Youthful)', value: 'Leda' },
        { name: 'Orus (Firm)', value: 'Orus' },
        { name: 'Aoede (Breezy)', value: 'Aoede' },
        { name: 'Callirrhoe (Easy-going)', value: 'Callirrhoe' },
        { name: 'Autonoe (Bright)', value: 'Autonoe' },
        { name: 'Enceladus (Breathy)', value: 'Enceladus' },
        { name: 'Iapetus (Clear)', value: 'Iapetus' },
    ];

    const speechLanguageOptions = [
        { name: '中文 (普通话)', value: 'zh-CN' },
        { name: '缅甸语', value: 'my-MM' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">设置</h3>

                {/* API 密钥设置 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="modal-api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        你的 Google Gemini API 密钥
                    </label>
                    <input
                        id="modal-api-key-input"
                        type="password"
                        value={tempSettings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        placeholder="在此粘贴你的 API 密钥"
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        密钥将保存在你的浏览器中，不会上传。
                        <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                            获取免费密钥
                        </a>
                    </p>
                </div>

                {/* AI 模型选择设置 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="modal-model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 模型:</label>
                    <select
                        id="modal-model-select"
                        value={tempSettings.selectedModel}
                        onChange={(e) => handleChange('selectedModel', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (推荐)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        {/* 暂不提供 2.x 模型，因为其 API 可用性不确定 */}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Gemini 1.5 Flash 稳定且有免费额度。其他模型可能需要特定权限或付费。
                    </p>
                </div>

                {/* TTS 引擎选择 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="tts-engine-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 TTS 引擎:</label>
                    <select
                        id="tts-engine-select"
                        value={tempSettings.ttsEngine}
                        onChange={(e) => handleChange('ttsEngine', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                        <option value={TTS_ENGINE_GEMINI}>Gemini TTS (推荐)</option>
                        <option value="external_api">第三方 API (晓辰)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Gemini TTS 提供高质量语音，但可能消耗 API 额度。
                    </p>
                </div>

                {/* Gemini TTS 设置 (仅当选择 Gemini TTS 时显示) */}
                {tempSettings.ttsEngine === TTS_ENGINE_GEMINI && (
                    <div className="mb-4 pb-4 border-b dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <h5 className="text-md font-bold mb-2 text-gray-800 dark:text-white">Gemini TTS 配置</h5>
                        <div className="mb-3">
                            <label htmlFor="gemini-voice-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">发音人:</label>
                            <select
                                id="gemini-voice-select"
                                value={tempSettings.ttsVoice}
                                onChange={(e) => handleChange('ttsVoice', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"
                            >
                                {geminiTtsVoices.map(voice => (
                                    <option key={voice.value} value={voice.value}>
                                        {voice.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
                
                {/* 语音识别语言 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="speech-language-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">语音识别语言:</label>
                    <select
                        id="speech-language-select"
                        value={tempSettings.speechLanguage}
                        onChange={(e) => handleChange('speechLanguage', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                        {speechLanguageOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 自动朗读开关 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label htmlFor="auto-read-toggle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI 回复后自动朗读:</label>
                    <input
                        type="checkbox"
                        id="auto-read-toggle"
                        checked={tempSettings.autoRead}
                        onChange={(e) => handleChange('autoRead', e.target.checked)}
                        className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                </div>

                {/* 提示词管理 */}
                <div className="mb-6">
                    <h4 className="text-lg font-bold mb-3 text-gray-800 dark:text-white">自定义提示词管理</h4>
                    <div className="space-y-2 mb-4">
                        {tempSettings.prompts.map(prompt => (
                            <div key={prompt.id} className="flex flex-col p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center flex-grow cursor-pointer">
                                        <input
                                            type="radio"
                                            name="currentPrompt"
                                            checked={tempSettings.currentPromptId === prompt.id}
                                            onChange={() => handleChange('currentPromptId', prompt.id)}
                                            className="mr-2 text-primary focus:ring-primary"
                                        />
                                        <input
                                            type="text"
                                            value={prompt.name}
                                            onChange={(e) => handlePromptChange(e, prompt.id, 'name')}
                                            className="font-medium bg-transparent w-full border-b border-dashed border-gray-300 dark:border-gray-600 focus:outline-none"
                                            placeholder="提示词名称"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleDeletePrompt(prompt.id)}
                                        className="p-1 ml-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <textarea
                                    value={prompt.content}
                                    onChange={(e) => handlePromptChange(e, prompt.id, 'content')}
                                    className="w-full mt-2 h-24 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md resize-y text-sm"
                                    placeholder="在这里输入详细的提示词内容..."
                                ></textarea>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleAddPrompt}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                        <i className="fas fa-plus mr-2"></i>添加新提示词
                    </button>
                </div>

                {/* 底部保存/取消按钮 */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                        关闭
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(tempSettings)}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-dark transition-colors"
                    >
                        保存设置
                    </button>
                </div>
            </div>
        </div>
    );
};
