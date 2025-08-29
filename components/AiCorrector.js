// /components/AiCorrector.js - 更新模型名称，增加“停止生成”功能
import React, { useState, useEffect, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

// 优化的 Markdown 解析器，渲染朗读按钮
const SimpleMarkdown = ({ text, lang }) => {
    if (!text) return null;

    const lines = text.split('\n').map((line, index) => {
        // 跳过空行
        if (line.trim() === '') {
            return <br key={index} />;
        }

        // 匹配 **...：** 格式的标题
        if (line.match(/\*\*(.*?)\*\*/)) {
            const title = line.replace(/\*\*/g, '');
            return <strong key={index} className="block mt-4 mb-2 text-lg text-gray-800 dark:text-gray-200">{title}</strong>;
        }

        // 匹配 * 列表项 或 - 列表项
        if (line.startsWith('* ') || line.startsWith('- ')) {
            const content = line.substring(2);
            return (
                <li key={index} className="ml-5 list-disc flex items-start">
                    <span className="flex-grow">{content}</span>
                    <TextToSpeechButton text={content} lang={lang} className="ml-2 shrink-0 text-gray-500" />
                </li>
            );
        }

        // 匹配普通段落
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

const AiCorrector = () => {
    const [userInput, setUserInput] = useState('');
    const [correction, setCorrection] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash'); // 默认使用 gemini-1.5-flash
    
    // useRef 来存储 AbortController，用于停止 fetch 请求
    const abortControllerRef = useRef(null); 

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;
        if (!apiKey.trim()) {
            setError('请输入您的 Google Gemini API 密钥！');
            return;
        }

        setIsLoading(true);
        setError('');
        setCorrection('');
        abortControllerRef.current = new AbortController(); // 初始化 AbortController

        const systemPrompt = `你是一位专业的、耐心的中文老师，你的学生是缅甸人。你的任务是纠正他们写的中文句子。
    请遵循以下规则：
    1.  首先，用中文写出“**纠正后的句子：**”。
    2.  然后，另起一行，用中文和缅甸语双语，简单清晰地解释错误的原因。缅甸语翻译用括号括起来。例如：“**错误分析：** 在中文里，表示地点的词（比如“在食堂”）通常要放在动词（比如“吃饭”）的前面。(မြန်မာဘာသာဖြင့်၊ နေရာပြစကားလုံးများ (ဥပမာ "食堂မှာ") သည် ကြိယာ ("စားသည်") ၏ ရှေ့တွင် လာလေ့ရှိသည်။)”
    3.  最后，另起一行，提供 1-2 个使用正确语法的额外例句，并用列表符号“-”开头。例如：“**更多例句：**\n- 我在学校学习中文。\n- 他在公园跑步。”
    4.  你的回答要简洁、友好、鼓励学生。`;

        const fullPrompt = `${systemPrompt}\n\n请纠正以下句子：\n"${userInput}"`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }],
                        generationConfig: {
                            temperature: 0.5,
                            maxOutputTokens: 1024,
                        }
                    }),
                    signal: abortControllerRef.current.signal, // 绑定 AbortController 的 signal
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
            
            const aiResponse = data.candidates[0].content.parts[0].text;
            setCorrection(aiResponse);

        } catch (err) {
            // 检查是否是用户取消了请求
            if (err.name === 'AbortError') {
                setError('AI 停止生成。');
            } else {
                setError(err.message);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null; // 清除 AbortController
        }
    };

    // 停止生成函数
    const handleStopGenerating = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort(); // 中止 fetch 请求
            setIsLoading(false);
            setError('AI 生成已停止。');
        }
    };


    return (
        <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-white">AI 中文语法助手</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">输入一个中文句子，AI 老师帮你纠正！</p>

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
                    {/* 根据你的要求，这里添加你指定的模型。如果报错，可能需要确认它们的可用性。 */}
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Gemini 1.5 Flash 稳定且有免费额度。其他模型可能需要特定权限或付费。
                </p>
            </div>


            {/* 输入表单 */}
            <form onSubmit={handleSubmit}>
                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="例如：我吃饭了在食堂"
                    className="w-full h-24 px-4 py-3 text-lg text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
                    disabled={isLoading}
                />
                {isLoading ? (
                    <button
                        type="button" // 类型改为 button，阻止表单默认提交
                        onClick={handleStopGenerating}
                        className="w-full mt-4 px-6 py-3 bg-red-500 text-white font-bold text-xl rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                    >
                        <div className="flex items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-t-transparent mr-2"></div>
                            停止生成
                        </div>
                    </button>
                ) : (
                    <button
                        type="submit"
                        className="w-full mt-4 px-6 py-3 bg-primary text-white font-bold text-xl rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!userInput.trim()}
                    >
                        纠正语法
                    </button>
                )}
            </form>

            {error && <div className="mt-6 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

            {correction && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg prose dark:prose-invert max-w-none text-left">
                    <SimpleMarkdown text={correction} lang="zh-CN" />
                </div>
            )}
        </div>
    );
};

export default AiCorrector;
