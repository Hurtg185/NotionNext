// /components/AiChatAssistant.js - 多模态输入 (图片/语音) + 优化
import React, { useState, useEffect, useRef } from 'react';
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


const AiChatAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash'); 
    
    // 多模态输入状态
    const [selectedImage, setSelectedImage] = useState(null); // Base64 编码的图片
    const fileInputRef = useRef(null); // 文件输入框的引用
    const videoRef = useRef(null); // 视频流的引用
    const canvasRef = useRef(null); // 拍照的 Canvas 引用
    const [isCameraActive, setIsCameraActive] = useState(false); // 摄像头是否激活
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // 图片预览 URL

    // 语音输入状态
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null); // SpeechRecognition 实例
    const [speechRecognitionError, setSpeechRecognitionError] = useState('');


    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // --- 初始化和保存 API Key ---
    useEffect(() => {
        const savedApiKey = localStorage.getItem('gemini_api_key');
        if (savedApiKey) {
            setApiKey(savedApiKey);
        }
    }, []);

    const handleApiKeyChange = (e) => {
        const newApiKey = e.target.value;
        setApiKey(newApiKey);
        localStorage.setItem('gemini_api_key', newApiKey);
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
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setSpeechRecognitionError('您的浏览器不支持语音输入功能！');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // 只听一次
        recognitionRef.current.lang = 'zh-CN'; // 识别中文
        recognitionRef.current.interimResults = false; // 只返回最终结果

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
        if (!userInput.trim() && !selectedImage && !isLoading) return; // 必须有文本或图片
        if (!apiKey.trim()) {
            setError('请输入您的 Google Gemini API 密钥！');
            return;
        }

        const userMessageContent = [];
        if (userInput.trim()) {
            userMessageContent.push({ text: userInput.trim() });
        }
        if (selectedImage) {
            userMessageContent.push({
                inlineData: {
                    mimeType: 'image/jpeg', // 假设是 JPEG 格式
                    data: selectedImage,
                },
            });
        }
        if (userMessageContent.length === 0) return; // 再次检查是否有内容

        setMessages(prev => [...prev, { role: 'user', content: userInput.trim() || '[图片]' , image: imagePreviewUrl }]);
        setUserInput(''); // 清空输入框
        clearImage(); // 清空图片

        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();

        const systemPrompt = `你是一位专业的、耐心的中文老师和语言学习助手，你的学生是缅甸人。你的任务是帮助他们学习中文，纠正语法，解释词语，提供例句，并始终保持友好和鼓励。
    请根据学生的提问或提供的图片，给出清晰、简洁、实用的回答，必要时提供中文和缅甸语双语解释。
    你的回答应遵循以下格式：
    1.  如果需要纠正句子，请先写出“**纠正后的句子：**”
    2.  如果需要解释词语或语法，请先写出“**解释：**”，并提供中缅双语。
    3.  最后，提供 1-2 个使用正确语法的额外例句，并用列表符号“-”开头，标题为“**更多例句：**”。
    4.  你的回答要简洁、友好、鼓励学生。`;
        
        // 构建包含历史消息的请求
        const history = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }], // 历史消息只包含文本，不包含图片
        }));

        const requestContents = [
            { role: 'user', parts: userMessageContent } // 当前用户消息可以包含文本和图片
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
                        contents: [
                            { role: 'user', parts: [{ text: systemPrompt }] }, // System Prompt 作为第一个 user 消息
                            ...history,
                            ...requestContents, // 用户输入或图片
                        ],
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

    return (
        <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-white">AI 中文学习助手</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">你的专属中文老师！</p>

            {/* API Key 输入框 */}
            <div className="mb-4">
                <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    你的 Google Gemini API 密钥
                </label>
                <input
                    id="api-key-input"
                    type="password"
                    value={apiKey}
                    onChange={handleApiKeyChange}
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

            {/* 模型选择 */}
            <div className="mb-4">
                <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 模型:</label>
                <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
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

                <div className="flex gap-2 mb-2">
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
                {speechRecognitionError && <p className="text-red-500 text-sm mb-2">{speechRecognitionError}</p>}

                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="输入你的中文问题或句子..."
                    className="w-full h-20 px-4 py-3 text-lg text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="w-full mt-4 px-6 py-3 bg-primary text-white font-bold text-xl rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || (!userInput.trim() && !selectedImage)} // 提交按钮：有文本或图片时才启用
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
        </div>
    );
};

export default AiChatAssistant;
