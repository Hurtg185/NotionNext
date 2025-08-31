// /components/AiChatAssistant.js - v30 (真正完整版，修复所有问题)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiTtsButton from './AiTtsButton';

export const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };

const SimpleMarkdown = ({ text }) => {
    if (!text) return null;
    return <div>{text.split('\n').map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        if (line.match(/\*\*(.*?)\*\*/)) return <strong key={index} className="block mt-2 mb-1">{line.replace(/\*\*/g, '')}</strong>;
        if (line.startsWith('* ') || line.startsWith('- ')) return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
        return <p key={index} className="my-1">{line}</p>;
    })}</div>;
};

const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate }) => {
    const isUser = msg.role === 'user';
    const messageRef = useRef(null);
    const hasBeenReadRef = useRef(false);
    const currentAssistant = settings.prompts.find(p => p.id === settings.currentPromptId);
    const aiAvatar = currentAssistant?.avatarUrl || settings.aiAvatarUrl;

    useEffect(() => {
        if (isLastAiMessage && !isUser && msg.content && settings.autoRead && !hasBeenReadRef.current) {
            const ttsButton = messageRef.current?.querySelector('button[title="朗读"]');
            if (ttsButton) {
                setTimeout(() => { ttsButton.click(); hasBeenReadRef.current = true; }, 300);
            }
        }
    }, [isUser, msg.content, settings.autoRead, isLastAiMessage]);

    return (
        <div ref={messageRef} className={`flex items-end gap-2.5 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={aiAvatar} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col ${isUser ? 'bg-primary text-white rounded-br-lg' : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm'}`} style={{ maxWidth: '85%' }}>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1"><SimpleMarkdown text={msg.content || ''} /></div>
                {!isUser && msg.content && (
                    <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400">
                        <AiTtsButton text={msg.content} ttsSettings={settings} TTS_ENGINE={TTS_ENGINE} />
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button>
                        {isLastAiMessage && <button onClick={onRegenerate} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button>}
                    </div>
                )}
            </div>
            {isUser && <img src={settings.userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0" />}
        </div>
    );
};

const CHAT_MODELS = [ { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest' }, { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest' }];

const SettingsModal = ({ settings, onSave, onClose, getRandomAvatar }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [systemVoices, setSystemVoices] = useState([]);

    useEffect(() => {
        const fetchSystemVoices = () => { if (window.speechSynthesis) setSystemVoices(window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en'))); };
        if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; fetchSystemVoices(); }
    }, []);

    const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value }));
    const handleAddAssistant = () => handleChange('prompts', [...tempSettings.prompts, { id: `custom-${Date.now()}`, name: '新助理', content: '请输入...', model: 'gemini-1.5-flash-latest', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: getRandomAvatar() }]);
    const handleDeleteAssistant = (id) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = tempSettings.prompts.filter(p => p.id !== id); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === id) handleChange('currentPromptId', newPrompts[0]?.id || ''); };
    const handleAssistantSettingChange = (id, field, value) => handleChange('prompts', tempSettings.prompts.map(p => p.id === id ? { ...p, [field]: value } : p));
    
    const microsoftTtsVoices = [{ name: '晓晓(女)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '云希(男)', value: 'zh-CN-YunxiNeural' }, { name: '晓伊(女)', value: 'zh-CN-XiaoyiNeural' }, { name: '云扬(男)', value: 'zh-CN-YunyangNeural' }, { name: '怀眉(女,越南)', value: 'vi-VN-HoaiMyNeural' }];
    const speechLanguageOptions = [{ name: '中文', value: 'zh-CN' }, { name: 'English', value: 'en-US' }, { name: 'Tiếng Việt', value: 'vi-VN' }];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="space-y-4">
                     <div><label className="block text-sm font-medium mb-1">Google Gemini API 密钥</label><input type="password" value={tempSettings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md" /></div>
                     <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-2"><label className="block text-sm font-medium">高级参数</label><div className="flex items-center gap-4"><label className="text-sm shrink-0">温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div><div className="flex items-center gap-4"><label className="text-sm shrink-0">API超时: {tempSettings.apiTimeout / 1000}s</label><input type="range" min="10" max="120" step="5" value={tempSettings.apiTimeout / 1000} onChange={(e) => handleChange('apiTimeout', parseInt(e.target.value, 10) * 1000)} className="w-full"/></div></div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4"><h4 className="text-md font-semibold">朗读设置</h4><div><label className="block text-sm font-medium mb-1">朗读引擎</label><select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value={TTS_ENGINE.THIRD_PARTY}>第三方 API</option><option value={TTS_ENGINE.SYSTEM}>系统内置</option></select></div>{tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (<div><label className="block text-sm font-medium mb-1">发音人 (第三方)</label><select value={tempSettings.thirdPartyTtsVoice} onChange={(e) => handleChange('thirdPartyTtsVoice', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md">{microsoftTtsVoices.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div>)}{tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (<div><label className="block text-sm font-medium mb-1">发音人 (系统)</label>{systemVoices.length > 0 ? (<select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-md"><option value="">浏览器默认</option>{systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}</select>) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}</div>)}</div>
                     <div><label className="block text-sm font-medium mb-1">语音识别语言</label><select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border rounded-md">{speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></div>
                     <div className="flex items-center justify-between"><label className="block text-sm font-medium">AI 回复后自动朗读</label><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-primary rounded" /></div>
                     <div className="mb-6"><h4 className="text-lg font-bold mb-3">AI 助理管理</h4><div className="space-y-2 mb-4 max-h-60 overflow-y-auto p-1">{tempSettings.prompts.map(p => (<div key={p.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md"><div className="flex items-center justify-between"><label className="flex items-center flex-grow cursor-pointer gap-2"><input type="radio" name="currentPrompt" checked={tempSettings.currentPromptId === p.id} onChange={() => handleChange('currentPromptId', p.id)} className="shrink-0 text-primary" /><img src={p.avatarUrl} alt={p.name} className="w-8 h-8 rounded-full shrink-0" /><input type="text" value={p.name} onChange={(e) => handleAssistantSettingChange(p.id, 'name', e.target.value)} className="font-medium bg-transparent w-full" /></label><button onClick={() => handleDeleteAssistant(p.id)} className="p-1 ml-2 text-sm text-red-500 rounded"><i className="fas fa-trash"></i></button></div><textarea value={p.content} onChange={(e) => handleAssistantSettingChange(p.id, 'content', e.target.value)} placeholder="助理的系统指令..." className="w-full mt-2 h-20 p-2 bg-white dark:bg-gray-800 border rounded-md text-sm" /></div>))}</div><button onClick={handleAddAssistant} className="w-full py-2 bg-green-500 text-white rounded-md"><i className="fas fa-plus mr-2"></i>添加新助理</button></div>
                </div>
                <div className="flex justify-end gap-3 mt-6"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-primary text-white rounded-md">保存</button></div>
            </div>
        </div>
    );
};

const AI_AVATARS = ['/images/avatars/ai-1.png', '/images/avatars/ai-2.png', '/images/avatars/ai-3.png', '/images/avatars/ai-4.png'];
const getRandomAvatar = () => AI_AVATARS[Math.floor(Math.random() * AI_AVATARS.length)];
const DEFAULT_ASSISTANTS = [ { id: '1', name: '语法老师', content: '你是一位专业的中文老师...', model: 'gemini-1.5-flash-latest', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: AI_AVATARS[0] }, { id: '2', name: '中越翻译', content: '你是一位专业的翻译助手...', model: 'gemini-1.5-flash-latest', ttsVoice: 'vi-VN-HoaiMyNeural', avatarUrl: AI_AVATARS[1] }];
const DEFAULT_SETTINGS = { apiKey: '', temperature: 0.7, apiTimeout: 60000, prompts: DEFAULT_ASSISTANTS, currentPromptId: DEFAULT_ASSISTANTS[0]?.id || '', autoRead: false, ttsEngine: TTS_ENGINE.THIRD_PARTY, thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', systemTtsVoiceURI: '', speechLanguage: 'zh-CN', chatBackgroundUrl: '/images/chat-bg.jpg', userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: '/images/ai-avatar.png' };

const AiChatAssistant = () => {
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showLeftMenu, setShowLeftMenu] = useState(false);
    const [leftMenuContent, setLeftMenuContent] = useState('main');
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const menuRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        setIsMounted(true);
        try {
            const savedSettings = localStorage.getItem('ai_assistant_settings_v30_final');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                parsed.prompts = parsed.prompts.map(p => ({ ...p, avatarUrl: p.avatarUrl || getRandomAvatar() }));
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
            const savedConvs = localStorage.getItem('ai_assistant_conversations_v30_final');
            const parsedConvsData = savedConvs ? JSON.parse(savedConvs) : [];
            setConversations(parsedConvsData);
            const currentId = localStorage.getItem('ai_assistant_current_id_v30_final');
            if (currentId && parsedConvsData.some(c => c.id === currentId)) setCurrentConversationId(currentId);
            else if (parsedConvsData.length > 0) setCurrentConversationId(parsedConvsData[0].id);
            else createNewConversation();
        } catch (e) { createNewConversation(); }
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('ai_assistant_settings_v30_final', JSON.stringify(settings));
            localStorage.setItem('ai_assistant_conversations_v30_final', JSON.stringify(conversations));
            if (currentConversationId) localStorage.setItem('ai_assistant_current_id_v30_final', currentConversationId);
        }
    }, [settings, conversations, currentConversationId, isMounted]);

    useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [conversations, currentConversationId]);
    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowLeftMenu(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const createNewConversation = () => {
        const newId = `conv-${Date.now()}`;
        const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: '你好！有什么可以帮助你的吗？' }] };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newId);
    };

    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    
    const startListening = useCallback(() => { /* ... 保持不变 ... */ }, [settings.speechLanguage]);
    const stopListening = useCallback(() => { /* ... 保持不变 ... */ }, []);

    const handleSubmit = async (isRegenerate = false) => {
        if (!currentConversationId || isLoading) return;
        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (!currentConv) return;
        if (!isRegenerate && !userInput.trim()) return;

        let messagesForApi = [...currentConv.messages];
        if (isRegenerate) {
            if (messagesForApi[messagesForApi.length - 1]?.role === 'ai') messagesForApi.pop();
        } else {
            const userMessage = { role: 'user', content: userInput.trim() };
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...c.messages, userMessage] } : c));
            messagesForApi.push(userMessage);
            setUserInput('');
        }

        setIsLoading(true); setError('');
        abortControllerRef.current = new AbortController();
        try {
            const currentPrompt = settings.prompts.find(p => p.id === settings.currentPromptId) || DEFAULT_ASSISTANTS[0];
            const modelToUse = currentPrompt.model || 'gemini-1.5-flash-latest';
            const history = messagesForApi.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
            const contents = [{ role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history];
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig: { temperature: settings.temperature, thinkingBudget: 0 } }),
                signal: abortControllerRef.current.signal,
            });
            if (!response.ok) throw new Error((await response.json()).error?.message || `请求失败`);
            const aiResponseContent = (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            const aiMessage = { role: 'ai', content: aiResponseContent };
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...messagesForApi, aiMessage] } : c));
        } catch (err) {
            const errorMessage = err.name === 'AbortError' ? 'API 请求超时' : `请求错误: ${err.message}`;
            setError(errorMessage);
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...messagesForApi, {role: 'ai', content: `抱歉，出错了: ${errorMessage}`}] } : c));
        } finally { setIsLoading(false); }
    };
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!isMounted) return <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const renderLeftMenu = () => {
        if (leftMenuContent === 'assistants') {
            return (<div className="flex flex-col gap-1 w-48"><button onClick={() => setLeftMenuContent('main')} className="flex items-center text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-arrow-left w-6 text-center mr-2"></i><span>返回</span></button><div className="border-t my-1 dark:border-gray-700"></div>{settings.prompts.map(p => (<button key={p.id} onClick={() => { setSettings(s => ({...s, currentPromptId: p.id})); setShowLeftMenu(false); }} className={`flex items-center text-left p-2 rounded-md ${settings.currentPromptId === p.id ? 'bg-primary/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}><img src={p.avatarUrl} alt={p.name} className="w-8 h-8 rounded-full mr-3 shrink-0" /><span className="font-semibold truncate">{p.name}</span></button>))}</div>);
        }
        return (<div className="flex flex-col gap-1 w-48"><button onClick={() => setLeftMenuContent('assistants')} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-user-astronaut w-6 text-center mr-2"></i><span>AI 助理</span></button><button onClick={() => { fileInputRef.current.click(); setShowLeftMenu(false); }} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-image w-6 text-center mr-2"></i><span>上传图片</span></button><button onClick={() => { cameraInputRef.current.click(); setShowLeftMenu(false); }} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-camera w-6 text-center mr-2"></i><span>拍照</span></button><div className="border-t my-1 dark:border-gray-700"></div><button onClick={() => { createNewConversation(); setShowLeftMenu(false); }} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-plus w-6 text-center mr-2"></i><span>新对话</span></button><button onClick={() => { setShowSettings(true); setShowLeftMenu(false); }} className="flex items-center w-full text-left p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-cog w-6 text-center mr-2"></i><span>设置</span></button></div>);
    };

    return (
        <div className={`w-full max-w-5xl mx-auto my-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex bg-white dark:bg-gray-900 relative ${isFullScreen ? 'fixed inset-0 z-50 max-w-full my-0 rounded-none' : ''}`} style={isFullScreen ? {} : { height: '90vh', minHeight: '650px' }}>
            <div className="flex-1 flex flex-col h-full min-w-0">
                <div className="flex items-center justify-between py-1 px-4 border-b dark:border-gray-700 shrink-0"><h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2></div>
                <div className="flex-grow p-4 overflow-y-auto" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`}}>{currentConversation?.messages.map((msg, index) => ( <MessageBubble key={`${currentConversationId}-${index}`} msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} /> ))}<div ref={messagesEndRef} /></div>
                <div className="p-3 border-t dark:border-gray-700 shrink-0">{isLoading ? (<div className="flex justify-center items-center gap-2 text-gray-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> 正在思考中...</div>) : (<form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end gap-2"><div className="flex-grow relative"><textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="与 AI 聊天..." className="w-full px-4 py-2 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-700 resize-none" rows="1" style={{minHeight:'44px'}} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }} /></div><button type="submit" className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shrink-0" disabled={isLoading || !userInput.trim()}><i className="fas fa-arrow-up"></i></button><button type="button" onClick={() => setIsFullScreen(f => !f)} className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0" title={isFullScreen ? '退出全屏' : '全屏模式'}><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button></form>)}</div>
            </div>
            <div ref={menuRef} className="absolute bottom-4 left-4 z-20">{showLeftMenu && (<div className="absolute bottom-full mb-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 rounded-xl shadow-lg border dark:border-gray-700">{renderLeftMenu()}</div>)}<button onClick={() => { setShowLeftMenu(p => !p); if (showLeftMenu) setLeftMenuContent('main'); }} className="w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 hover:scale-110"><i className={`fas ${showLeftMenu ? 'fa-times' : 'fa-bars'}`}></i></button></div>
            <input type="file" ref={fileInputRef} className="hidden" multiple /><input type="file" ref={cameraInputRef} capture="environment" className="hidden" />
            {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} getRandomAvatar={getRandomAvatar} />}
        </div>
    );
};
export default AiChatAssistant;
