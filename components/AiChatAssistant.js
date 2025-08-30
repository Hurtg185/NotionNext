// /components/AiChatAssistant.js - 终极完整版：修复组件结构问题，确保正常渲染
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton, { TTS_ENGINE } from './AiTtsButton'; // 导入 AI 专用的 TTS 按钮

// --- 子组件定义区域 (在主组件外部) ---

// 简单的 Markdown 解析器
const SimpleMarkdown = ({ text, lang, apiKey, ttsSettings }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
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

// 消息气泡组件
const MessageBubble = ({ msg, settings }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);

    const autoReadMessage = useCallback(() => {
        // ... (自动朗读逻辑)
    }, [msg.content, settings]);

    useEffect(() => {
        if (!isUser && msg.content && settings.autoRead) {
            autoReadMessage();
        }
    }, [isUser, msg.content, settings.autoRead, autoReadMessage]);

    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div ref={messageRef} className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-800 dark:text-gray-200 rounded-bl-lg'}`} style={{ maxWidth: '85%' }}>
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
        { name: 'Zephyr (Bright)', value: 'Zephyr' }, { name: 'Puck (Upbeat)', value: 'Puck' },
        { name: 'Charon (Informative)', value: 'Charon' }, { name: 'Kore (Firm)', value: 'Kore' },
        { name: 'Fenrir (Excitable)', value: 'Fenrir' }, { name: 'Leda (Youthful)', value: 'Leda' },
        { name: 'Orus (Firm)', value: 'Orus' }, { name: 'Aoede (Breezy)', value: 'Aoede' },
        { name: 'Callirrhoe (Easy-going)', value: 'Callirrhoe' }, { name: 'Autonoe (Bright)', value: 'Autonoe' },
        { name: 'Enceladus (Breathy)', value: 'Enceladus' }, { name: 'Iapetus (Clear)', value: 'Iapetus' },
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
                    <label htmlFor="modal-api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">你的 Google Gemini API 密钥</label>
                    <input id="modal-api-key-input" type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="在此粘贴你的 API 密钥" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" />
                </div>

                {/* AI 模型选择 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="modal-model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 AI 模型</label>
                    <select id="modal-model-select" value={tempSettings.selectedModel} onChange={(e) => handleChange('selectedModel', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (推荐)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                </div>

                {/* TTS 引擎选择 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="tts-engine-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择 TTS 引擎</label>
                    <select id="tts-engine-select" value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value={TTS_ENGINE_GEMINI}>Gemini TTS (推荐)</option>
                        <option value="external_api">第三方 API (晓辰)</option>
                    </select>
                </div>

                {/* Gemini TTS 设置 */}
                {tempSettings.ttsEngine === TTS_ENGINE_GEMINI && (
                    <div className="mb-4 pb-4 border-b dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <h5 className="text-md font-bold mb-2 text-gray-800 dark:text-white">Gemini TTS 配置</h5>
                        <label htmlFor="gemini-voice-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">发音人</label>
                        <select id="gemini-voice-select" value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">
                            {geminiTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}
                        </select>
                    </div>
                )}
                
                {/* 语音识别语言 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label htmlFor="speech-language-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">语音识别语言</label>
                    <select id="speech-language-select" value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        {speechLanguageOptions.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}
                    </select>
                </div>

                {/* 自动朗读开关 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <label htmlFor="auto-read-toggle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI 回复后自动朗读</label>
                    <input id="auto-read-toggle" type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary" />
                </div>

                {/* 提示词管理 */}
                <div className="mb-6">
                    <h4 className="text-lg font-bold mb-3 text-gray-800 dark:text-white">自定义提示词管理</h4>
                    <div className="space-y-2 mb-4">
                        {tempSettings.prompts.map(prompt => (
                            <div key={prompt.id} className="flex flex-col p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center flex-grow cursor-pointer">
                                        <input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === prompt.id} onChange={() => handleChange('currentPromptId', prompt.id)} className="mr-2 text-primary" />
                                        <input type="text" value={prompt.name} onChange={(e) => handlePromptChange(e, prompt.id, 'name')} className="font-medium bg-transparent w-full border-b border-dashed" placeholder="提示词名称" />
                                    </label>
                                    <button onClick={() => handleDeletePrompt(prompt.id)} className="p-1 ml-2 text-sm bg-red-500 text-white rounded"><i className="fas fa-times"></i></button>
                                </div>
                                <textarea value={prompt.content} onChange={(e) => handlePromptChange(e, prompt.id, 'content')} className="w-full mt-2 h-24 p-2 bg-gray-50 dark:bg-gray-800 border rounded-md text-sm" placeholder="提示词内容..."></textarea>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddPrompt} className="w-full py-2 bg-green-500 text-white rounded-md"><i className="fas fa-plus mr-2"></i>添加新提示词</button>
                </div>

                {/* 底部保存/关闭按钮 */}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存设置</button>
                </div>
            </div>
        </div>
    );
};

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    // ... (所有 useState, useRef, useEffect, 和函数定义，与上一个回复相同)
};

export default AiChatAssistant;
