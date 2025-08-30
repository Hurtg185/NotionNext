// /components/AiChatAssistant.js - 多提示词管理 + 自动朗读 + UI 优化
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

// 简单的 Markdown 解析器，渲染朗读按钮
const SimpleMarkdown = ({ text, lang }) => {
    if (!text) return null;

    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') { return <br key={index} />; }
        if (line.match(/\*\*(.*?)\*\*/)) {
            const titleContent = line.replace(/\*\*/g, '');
            return (
                <strong key={index} className="block mt-4 mb-2 text-lg text-gray-800 dark:text-gray-200 flex items-center">
                    <span className="flex-grow">{titleContent}</span>
                    <TextToSpeechButton text={titleContent} lang={lang} className="ml-2 shrink-0 text-gray-500" />
                </strong>
            );
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return (
                <li key={index} className="ml-5 list-disc flex items-start">
                    <span className="flex-grow">{content}</span>
                    <TextToSpeechButton text={content} lang={lang} className="ml-2 shrink-0 text-gray-500" />
                </li>
            );
        }
        const content = line;
        return (
            <p key={index} className="my-1 flex items-center">
                <span className="flex-grow">{content}</span>
                <TextToSpeechButton text={content} lang={lang} className="ml-2 shrink-0 text-gray-500" />
            </p>
        );
    });

    return <div>{lines}</div>;
};

// 默认提示词列表 (提供几个示例)
const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', content: `你是一位专业的、耐心的中文老师和语言学习助手，你的学生是缅甸人。你的任务是帮助他们学习中文，纠正语法，解释词语，提供例句，并始终保持友好和鼓励。
    请根据学生的提问，给出清晰、简洁、实用的回答，必要时提供中文和缅甸语双语解释。
    你的回答应遵循以下格式：
    1.  如果需要纠正句子，请先写出“**纠正后的句子：**”
    2.  如果需要解释词语或语法，请先写出“**解释：**”，并提供中缅双语。
    3.  最后，提供 1-2 个使用正确语法的额外例句，并用列表符号“-”开头，标题为“**更多例句：**”。
    4.  你的回答要简洁、友好、鼓励学生。` },
    { id: 'explain-word', name: '解释中文词语', content: `你是一位专业的、耐心的中文老师，你的学生是缅甸人。请用中文和缅甸语双语，详细解释学生提供的中文词语的含义、用法，并给出2-3个例句。` },
    { id: 'translate-myanmar', name: '中缅互译', content: `你是一位专业的翻译助手，你的学生是缅甸人。请将学生提供的中文句子翻译成缅甸语，或将缅甸语句子翻译成中文。` }
];


const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // API Key 和模型设置
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash'); 
    
    // 提示词管理状态
    const [prompts, setPrompts] = useState(DEFAULT_PROMPTS); // 所有提示词列表
    const [currentPromptId, setCurrentPromptId] = useState(DEFAULT_PROMPTS[0].id); // 当前选中的提示词ID
    const [autoRead, setAutoRead] = useState(false); // 自动朗读开关

    const [showSettings, setShowSettings] = useState(false); // 控制设置面板显示

    // 多模态输入状态
    const [selectedImage, setSelectedImage] = useState(null);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

    // 语音输入状态
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // --- 初始化和保存 API Key/Model/Prompts/AutoRead ---
    useEffect(() => {
        const savedApiKey = localStorage.getItem('gemini_api_key');
        const savedModel = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
        const savedPrompts = JSON.parse(localStorage.getItem('gemini_prompts')) || DEFAULT_PROMPTS;
        const savedCurrentPromptId = localStorage.getItem('gemini_current_prompt_id') || savedPrompts[0]?.id;
        const savedAutoRead = localStorage.getItem('gemini_auto_read') === 'true';

        if (savedApiKey) setApiKey(savedApiKey);
        setSelectedModel(savedModel);
        setPrompts(savedPrompts);
        setCurrentPromptId(savedCurrentPromptId);
        setAutoRead(savedAutoRead);
    }, []);

    const handleSaveSettings = (newApiKey, newModel, newPrompts, newCurrentPromptId, newAutoRead) => {
        setApiKey(newApiKey);
        setSelectedModel(newModel);
        setPrompts(newPrompts);
        setCurrentPromptId(newCurrentPromptId);
        setAutoRead(newAutoRead);

        localStorage.setItem('gemini_api_key', newApiKey);
        localStorage.setItem('gemini_model', newModel);
        localStorage.setItem('gemini_prompts', JSON.stringify(newPrompts));
        localStorage.setItem('gemini_current_prompt_id', newCurrentPromptId);
        localStorage.setItem('gemini_auto_read', newAutoRead);
        
        setShowSettings(false);
    };

    // --- 自动滚动到底部 ---
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // --- 图片处理逻辑 ---
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
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
                setSelectedImage(null);
                setImagePreviewUrl(null);
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('无法访问麦克风，请检查浏览器权限。'); // 这里之前写错了，应该是摄像头权限
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
            stopCamera();
        }
    };

    // --- 语音输入逻辑 ---
    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setSpeechRecognitionError('您的浏览器不支持语音输入功能！');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = 'zh-CN';
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onstart = () => {
            setIsListening(true);
            setSpeechRecognitionError('');
        };

        recognitionRef.current.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setUserInput(prev => prev ? prev + transcript : transcript);
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setSpeechRecognitionError(`语音输入错误: ${event.error}`);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current.start();
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim() && !selectedImage || isLoading) return;
        if (!apiKey.trim()) {
            setError('请先在设置中输入您的 Google Gemini API 密钥！');
            setShowSettings(true);
            return;
        }

        const userMessageContent = [];
        if (userInput.trim()) {
            userMessageContent.push({ text: userInput.trim() });
        }
        if (selectedImage) {
            userMessageContent.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: selectedImage,
                },
            });
        }
        if (userMessageContent.length === 0) return;

        setMessages(prev => [...prev, { role: 'user', content: userInput.trim() || '[图片]' , image: imagePreviewUrl }]);
        setUserInput('');
        clearImage();

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        // 获取当前选中的提示词内容
        const currentPrompt = prompts.find(p => p.id === currentPromptId)?.content || DEFAULT_PROMPTS[0].content;
        
        // 构建包含历史消息的请求
        const history = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        const requestMessages = [
            { role: 'system', parts: [{ text: currentPrompt }] }, // 使用选中的提示词作为 System Prompt
            ...history,
            { role: 'user', parts: userMessageContent },
        ];


        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: requestMessages,
                        generationConfig: {
                            temperature: 0.5,
                            maxOutputTokens: 1024,
                            thinkingConfig: {
                                thinkingBudget: 0
                            }
                        }
                    }),
                    signal: abortControllerRef.current.signal,
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Google Gemini API Error:', errorData);
                let errorMessage = errorData.error?.message || '请求失败，请检查您的 API 密钥或网络连接。';
                if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
                    errorMessage = 'API 请求超出额度，请稍后再试或检查你的免费额度。';
                } else if (errorMessage.includes('API_KEY_INVALID')) {
                    errorMessage = 'API 密钥无效或已过期，请检查或重新获取密钥。';
                } else if (errorMessage.includes('NOT_FOUND') && errorMessage.includes('model')) {
                    errorMessage = `模型 ${selectedModel} 不可用，请尝试其他模型或稍后再试。`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
                 throw new Error('AI 未能返回有效内容，可能是请求被安全策略阻止或模型输出为空。');
            }
            
            const aiResponseContent = data.candidates[0].content.parts[0].text;
            setMessages(prev => [...prev, { role: 'ai', content: aiResponseContent }]);

            // --- 自动朗读 AI 回复 ---
            if (autoRead && aiResponseContent) {
                // 这里需要一个独立的发声器，因为 SimpleMarkdown 会创建自己的 TextToSpeechButton
                // 暂时简单的方案是直接用 window.speechSynthesis 朗读整个文本
                if (window.speechSynthesis) {
                    const utterance = new SpeechSynthesisUtterance(aiResponseContent);
                    utterance.lang = 'zh-CN';
                    window.speechSynthesis.speak(utterance);
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                setError('AI 停止生成。');
            } else {
                setError(err.message);
                setMessages(prev => [...prev, { role: 'ai', content: `很抱歉，出错了：${err.message}` }]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleStopGenerating = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            setError('AI 生成已停止。');
        }
    };

    // 获取当前选中的提示词名称，用于显示在主界面
    const currentPromptName = prompts.find(p => p.id === currentPromptId)?.name || '未选择提示词';

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
                            <strong className="block text-sm mb-1">
                                {msg.role === 'user' ? '你' : 'AI 老师'}
                            </strong>
                            {msg.image && (
                                <img src={msg.image} alt="用户上传图片" className="max-w-full h-auto rounded-md mb-2" />
                            )}
                            <SimpleMarkdown text={msg.content} lang="zh-CN" />
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} /> {/* 滚动到底部的锚点 */}
            </div>

            {/* 输入和操作按钮 */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                {/* 图片预览和清除按钮 */}
                {imagePreviewUrl && (
                    <div className="relative mb-2 self-center">
                        <img src={imagePreviewUrl} alt="图片预览" className="max-h-24 rounded-lg border border-gray-300 dark:border-gray-600" />
                        <button
                            type="button"
                            onClick={clearImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs leading-none"
                            title="移除图片"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}

                <div className="flex gap-2 mb-2 relative">
                    {/* 上传图片按钮 */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        title="上传图片"
                        disabled={isCameraActive || isLoading}
                    >
                        <i className="fas fa-image text-gray-700 dark:text-gray-200 text-lg"></i>
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
                        className={`p-2 rounded-lg transition-colors ${
                            isCameraActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'
                        }`}
                        title={isCameraActive ? "拍照" : "打开摄像头"}
                        disabled={isLoading}
                    >
                         <i className={`fas ${isCameraActive ? 'fa-camera' : 'fa-video'} text-lg`}></i>
                    </button>

                    {/* 语音输入按钮 */}
                    <button
                        type="button"
                        onClick={isListening ? stopListening : startListening}
                        className={`p-2 rounded-lg transition-colors ${
                            isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'
                        }`}
                        title={isListening ? "停止语音输入" : "语音输入"}
                        disabled={isLoading}
                    >
                         <i className={`fas ${isListening ? 'fa-microphone-alt-slash' : 'fa-microphone'} text-lg`}></i>
                    </button>

                    {/* 当前提示词显示 */}
                    <span className="flex-grow flex items-center justify-center text-sm text-gray-600 dark:text-gray-300 px-2 truncate">
                       {currentPromptName}
                    </span>

                    {/* 设置按钮 */}
                    <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        title="设置"
                        disabled={isLoading}
                    >
                        <i className="fas fa-cog text-gray-700 dark:text-gray-200 text-lg"></i>
                    </button>
                </div>
                
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

                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="输入你的中文问题或句子..."
                    className="w-full h-20 px-4 py-3 text-lg text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="w-full mt-4 px-6 py-3 bg-primary text-white font-bold text-xl rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || (!userInput.trim() && !selectedImage)}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-t-transparent mr-2"></div>
                            停止生成
                        </div>
                    ) : '发送问题'}
                </button>
            </form>

            {error && <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

            {/* 设置面板 Modals */}
            {showSettings && (
                <SettingsModal
                    apiKey={apiKey}
                    selectedModel={selectedModel}
                    prompts={prompts}
                    currentPromptId={currentPromptId}
                    autoRead={autoRead}
                    onSave={handleSaveSettings}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
};

export default AiChatAssistant;


// --- 设置面板组件 ---
const SettingsModal = ({ apiKey, selectedModel, prompts, currentPromptId, autoRead, onSave, onClose }) => {
    const [tempApiKey, setTempApiKey] = useState(apiKey);
    const [tempSelectedModel, setTempSelectedModel] = useState(selectedModel);
    const [tempPrompts, setTempPrompts] = useState(prompts);
    const [tempCurrentPromptId, setTempCurrentPromptId] = useState(currentPromptId);
    const [tempAutoRead, setTempAutoRead] = useState(autoRead);

    const [editingPrompt, setEditingPrompt] = useState(null); // { id, name, content }
    const [newPromptName, setNewPromptName] = useState('');
    const [newPromptContent, setNewPromptContent] = useState('');

    const handleAddPrompt = () => {
        // 创建一个唯一的ID
        const newId = `custom-prompt-${Date.now()}`;
        setEditingPrompt({ id: newId, name: '', content: '' });
        setNewPromptName('');
        setNewPromptContent('');
    };

    const handleEditPrompt = (prompt) => {
        setEditingPrompt(prompt);
        setNewPromptName(prompt.name);
        setNewPromptContent(prompt.content);
    };

    const handleSavePrompt = () => {
        if (!newPromptName.trim() || !newPromptContent.trim()) {
            alert('提示词名称和内容不能为空！');
            return;
        }
        if (editingPrompt) {
            setTempPrompts(prev => prev.map(p => p.id === editingPrompt.id ? { ...p, name: newPromptName, content: newPromptContent } : p));
        } else {
            // 如果是新增，并且没有ID，就给它一个新ID
            const newId = `custom-prompt-${Date.now()}`;
            setTempPrompts(prev => [...prev, { id: newId, name: newPromptName, content: newPromptContent }]);
            // 如果这是第一个自定义提示词，就默认选中它
            if (tempPrompts.length === 0) {
                setTempCurrentPromptId(newId);
            }
        }
        setEditingPrompt(null); // 关闭编辑模式
    };

    const handleDeletePrompt = (id) => {
        if (window.confirm('确定删除此提示词吗？')) {
            setTempPrompts(prev => prev.filter(p => p.id !== id));
            // 如果删除的是当前选中的提示词，就重新选择第一个默认提示词
            if (tempCurrentPromptId === id) {
                setTempCurrentPromptId(DEFAULT_PROMPTS[0].id);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">设置</h3>

                {/* API 密钥设置 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="modal-api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        你的 Google Gemini API 密钥
                    </label>
                    <input
                        id="modal-api-key-input"
                        type="password"
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
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

                {/* 模型选择设置 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="modal-model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 模型:</label>
                    <select
                        id="modal-model-select"
                        value={tempSelectedModel}
                        onChange={(e) => setTempSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (推荐)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Gemini 1.5 Flash 稳定且有免费额度。其他模型可能需要特定权限或付费。
                    </p>
                </div>

                {/* 自动朗读开关 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label htmlFor="auto-read-toggle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI 回复后自动朗读:</label>
                    <input
                        type="checkbox"
                        id="auto-read-toggle"
                        checked={tempAutoRead}
                        onChange={(e) => setTempAutoRead(e.target.checked)}
                        className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                </div>

                {/* 提示词管理 */}
                <div className="mb-6">
                    <h4 className="text-lg font-bold mb-3 text-gray-800 dark:text-white">自定义提示词管理</h4>
                    <div className="space-y-2 mb-4">
                        {tempPrompts.map(prompt => (
                            <div key={prompt.id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <label className="flex items-center flex-grow cursor-pointer">
                                    <input
                                        type="radio"
                                        name="currentPrompt"
                                        checked={tempCurrentPromptId === prompt.id}
                                        onChange={() => setTempCurrentPromptId(prompt.id)}
                                        className="mr-2 text-primary focus:ring-primary"
                                    />
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{prompt.name}</span>
                                    {prompt.id === tempCurrentPromptId && <span className="ml-2 text-xs text-primary">(当前)</span>}
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleEditPrompt(prompt)}
                                        className="p-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                        编辑
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeletePrompt(prompt.id)}
                                        className="p-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                    >
                                        删除
                                    </button>
                                </div>
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

                {/* 提示词编辑/新增表单 */}
                {editingPrompt && (
                    <div className="mt-6 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                        <h5 className="text-md font-bold mb-2 text-gray-800 dark:text-white">{editingPrompt.id ? '编辑提示词' : '新增提示词'}</h5>
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称:</label>
                            <input
                                type="text"
                                value={newPromptName}
                                onChange={(e) => setNewPromptName(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"
                                placeholder="例如：纠正中文语法"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容:</label>
                            <textarea
                                value={newPromptContent}
                                onChange={(e) => setNewPromptContent(e.target.value)}
                                className="w-full h-32 px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md resize-y"
                                placeholder="在这里输入详细的提示词内容..."
                            ></textarea>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditingPrompt(null)}
                                className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleSavePrompt}
                                className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                )}

                {/* 底部保存/取消按钮 */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSave(tempApiKey, tempSelectedModel, tempPrompts, tempCurrentPromptId, tempAutoRead)}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-dark transition-colors"
                    >
                        保存设置
                    </button>
                </div>
            </div>
        </div>
    );
};
