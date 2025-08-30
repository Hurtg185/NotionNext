// /components/AiChatAssistant.js - 调试 v10：恢复设置功能和状态管理
import React, { useState, useEffect, useRef } from 'react';

// --- 子组件定义区域 (在主组件外部) ---

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
        if (window.confirm('确定删除吗？')) {
            const newPrompts = tempSettings.prompts.filter(p => p.id !== idToDelete);
            let newCurrentPromptId = tempSettings.currentPromptId;
            if (newCurrentPromptId === idToDelete) {
                newCurrentPromptId = newPrompts[0]?.id || '';
            }
            handleChange('prompts', newPrompts);
            handleChange('currentPromptId', newCurrentPromptId);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">设置</h3>

                {/* API 密钥设置 */}
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">你的 Google Gemini API 密钥</label>
                    <input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder="在此粘贴你的 API 密钥" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" />
                </div>
                
                {/* 更多设置占位符... */}
                <p className="text-gray-600 dark:text-gray-400">其他设置将在这里显示...</p>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button>
                    <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存设置</button>
                </div>
            </div>
        </div>
    );
};

// --- 默认设置 ---
const DEFAULT_SETTINGS = {
    apiKey: '',
    chatBackgroundUrl: '/images/chat-bg.jpg',
    userAvatarUrl: '/images/user-avatar.png',
    aiAvatarUrl: '/images/ai-avatar.png',
};

// --- 主组件：AiChatAssistant ---
const AiChatAssistant = () => {
    // 只保留核心的 state
    const [isMounted, setIsMounted] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'ai', content: '你好！有什么可以帮助你的吗？' },
        { role: 'user', content: '我有一个问题...' }
    ]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // 组件挂载后，才从 localStorage 加载设置
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v_debug');
            if (savedSettings) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }));
            }
        } catch (e) {
            console.error("Failed to load settings from localStorage", e);
        }
    }, []);

    const handleSaveSettings = (newSettings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem('ai_assistant_settings_v_debug', JSON.stringify(newSettings));
            alert('设置已保存！'); // 给出明确的保存反馈
        } catch (e) {
            console.error("Failed to save settings to localStorage", e);
            alert('设置保存失败！');
        }
        setShowSettings(false);
    };

    if (!isMounted) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '700px',
                border: '5px solid red',
            }}>
                <p>正在加载组件...</p>
            </div>
        );
    }
    
    return (
        <div 
            className="w-full max-w-2xl mx-auto my-8 rounded-2xl shadow-xl border flex flex-col bg-white dark:bg-gray-800"
            style={{ 
                height: '80vh', minHeight: '600px', maxHeight: '900px',
                display: 'flex !important', // 保持强制显示
                visibility: 'visible !important',
                opacity: '1 !important',
            }}
        >
            <div className="flex items-center justify-between p-4 rounded-t-2xl border-b shrink-0">
                <div className="flex items-center gap-2">
                    <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />
                    <h2 className="text-lg font-bold">AI 中文老师 (调试)</h2>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full" title="设置"><i className="fas fa-cog"></i></button>
            </div>

            <div 
                className="flex-grow p-4 overflow-y-auto"
                style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                <div className="flex flex-col gap-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'ai' && <img src={settings.aiAvatarUrl} alt="AI Avatar" className="w-8 h-8 rounded-full" />}
                            <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white'}`}>
                                <p>{msg.content}</p>
                            </div>
                            {msg.role === 'user' && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full" />}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t shrink-0">
                <div className="flex items-end gap-2">
                    <div className="flex gap-1">
                        <button className="p-3 rounded-full"><i className="fas fa-image"></i></button>
                    </div>
                    <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="输入..." className="flex-grow p-2 rounded-2xl" rows="1" />
                    <button type="submit" className="p-3 bg-primary text-white rounded-full"><i className="fas fa-arrow-up"></i></button>
                </div>
            </div>

            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default AiChatAssistant;
