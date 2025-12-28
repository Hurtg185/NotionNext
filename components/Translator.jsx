// components/Translator.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ArrowRightLeft, Copy, Check, Volume2, 
  Loader2, ChevronDown, Settings, Send, X, 
  Sparkles, Plus, Trash2, Edit3, Save, Key
} from 'lucide-react';

// 样式工具函数
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// 全局样式
const globalStyles = `
  .hide-scrollbar::-webkit-scrollbar { width: 0px; height: 0px; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  textarea { border: none; outline: none; resize: none; }
  .safe-pb { padding-bottom: env(safe-area-inset-bottom); }
  input:focus, textarea:focus { outline: none; }
`;

// 语言配置
const LANGUAGES = {
  zh: { code: 'zh', name: '中文', flag: '🇨🇳' },
  en: { code: 'en', name: 'English', flag: '🇺🇸' },
  ja: { code: 'ja', name: '日本語', flag: '🇯🇵' },
  ko: { code: 'ko', name: '한국어', flag: '🇰🇷' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
  ru: { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  ar: { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  pt: { code: 'pt', name: 'Português', flag: '🇧🇷' },
};

// 预设 API 模板
const API_TEMPLATES = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    bodyBuilder: (model, messages) => ({
      model,
      messages,
      temperature: 0.3
    }),
    responseParser: (data) => data.choices[0].message.content
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }),
    bodyBuilder: (model, messages) => ({
      model,
      max_tokens: 4096,
      messages: messages.filter(m => m.role !== 'system'),
      system: messages.find(m => m.role === 'system')?.content || ''
    }),
    responseParser: (data) => data.content[0].text
  },
  custom: {
    name: '自定义 API',
    baseUrl: '',
    models: [],
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    bodyBuilder: (model, messages) => ({
      model,
      messages,
      temperature: 0.3
    }),
    responseParser: (data) => data.choices?.[0]?.message?.content || data.content?.[0]?.text || ''
  }
};

// 默认配置存储键
const STORAGE_KEY = 'ai-translator-config';

// 加载保存的配置
const loadConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {
    apis: [],
    activeApiId: null
  };
};

// 保存配置
const saveConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
};

// ============ API 配置管理组件 ============
function ApiConfigModal({ isOpen, onClose, apis, onSave, editingApi }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    template: 'openai',
    baseUrl: '',
    apiKey: '',
    model: '',
    customModels: ''
  });

  useEffect(() => {
    if (editingApi) {
      setFormData({
        ...editingApi,
        customModels: editingApi.customModels?.join(', ') || ''
      });
    } else {
      setFormData({
        id: Date.now().toString(),
        name: '',
        template: 'openai',
        baseUrl: API_TEMPLATES.openai.baseUrl,
        apiKey: '',
        model: API_TEMPLATES.openai.models[0],
        customModels: ''
      });
    }
  }, [editingApi, isOpen]);

  const handleTemplateChange = (template) => {
    const tmpl = API_TEMPLATES[template];
    setFormData(prev => ({
      ...prev,
      template,
      baseUrl: tmpl.baseUrl,
      model: tmpl.models[0] || '',
      customModels: ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const apiConfig = {
      ...formData,
      customModels: formData.customModels 
        ? formData.customModels.split(',').map(m => m.trim()).filter(Boolean)
        : []
    };
    onSave(apiConfig);
    onClose();
  };

  const availableModels = formData.template === 'custom' 
    ? formData.customModels.split(',').map(m => m.trim()).filter(Boolean)
    : API_TEMPLATES[formData.template]?.models || [];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto hide-scrollbar border border-zinc-700"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              {editingApi ? '编辑 API 配置' : '添加 API 配置'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 配置名称 */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">配置名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：我的 GPT-4"
                className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500"
                required
              />
            </div>

            {/* API 模板选择 */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">API 类型</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(API_TEMPLATES).map(([key, tmpl]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTemplateChange(key)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                      formData.template === key
                        ? "bg-blue-500 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* API Base URL */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">API 地址</label>
              <input
                type="url"
                value={formData.baseUrl}
                onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.example.com/v1/chat/completions"
                className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 font-mono text-sm"
                required
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">API Key</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 font-mono text-sm"
                required
              />
            </div>

            {/* 模型选择 */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">模型</label>
              {formData.template === 'custom' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formData.customModels}
                    onChange={e => setFormData(prev => ({ ...prev, customModels: e.target.value }))}
                    placeholder="模型名称，用逗号分隔"
                    className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm"
                  />
                  <input
                    type="text"
                    value={formData.model}
                    onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="当前使用的模型"
                    className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm"
                    required
                  />
                </div>
              ) : (
                <select
                  value={formData.model}
                  onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white"
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 提交按钮 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 font-medium transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ 语言选择器组件 ============
function LanguageSelector({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const lang = LANGUAGES[value];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all"
      >
        <span className="text-lg">{lang.flag}</span>
        <span className="text-white font-medium">{lang.name}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-zinc-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-48 bg-zinc-800 rounded-xl shadow-xl border border-zinc-700 overflow-hidden z-50 max-h-64 overflow-y-auto hide-scrollbar"
            >
              {Object.values(LANGUAGES).map(lang => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onChange(lang.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-colors",
                    value === lang.code && "bg-blue-500/20"
                  )}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-white">{lang.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ 主翻译器组件 ============
export default function Translator() {
  // 配置状态
  const [config, setConfig] = useState(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [editingApi, setEditingApi] = useState(null);

  // 翻译状态
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef(null);

  // 获取当前活跃的 API 配置
  const activeApi = config.apis.find(api => api.id === config.activeApiId);

  // 保存配置到 localStorage
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // 添加/更新 API 配置
  const handleSaveApi = (apiData) => {
    setConfig(prev => {
      const existingIndex = prev.apis.findIndex(api => api.id === apiData.id);
      let newApis;
      if (existingIndex >= 0) {
        newApis = [...prev.apis];
        newApis[existingIndex] = apiData;
      } else {
        newApis = [...prev.apis, apiData];
      }
      return {
        apis: newApis,
        activeApiId: prev.activeApiId || apiData.id
      };
    });
    setEditingApi(null);
  };

  // 删除 API 配置
  const handleDeleteApi = (apiId) => {
    setConfig(prev => ({
      apis: prev.apis.filter(api => api.id !== apiId),
      activeApiId: prev.activeApiId === apiId 
        ? (prev.apis[0]?.id || null) 
        : prev.activeApiId
    }));
  };

  // 设置活跃 API
  const handleSetActiveApi = (apiId) => {
    setConfig(prev => ({ ...prev, activeApiId: apiId }));
  };

  // 交换语言
  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  // 复制翻译结果
  const copyToClipboard = async () => {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 执行翻译
  const translate = useCallback(async () => {
    if (!sourceText.trim()) {
      setTranslatedText('');
      return;
    }

    if (!activeApi) {
      setError('请先配置 API');
      return;
    }

    setIsTranslating(true);
    setError(null);

    const template = API_TEMPLATES[activeApi.template] || API_TEMPLATES.custom;
    const sourceLangName = LANGUAGES[sourceLang].name;
    const targetLangName = LANGUAGES[targetLang].name;

    const systemPrompt = `你是一个专业的翻译专家。请将用户输入的${sourceLangName}文本翻译成${targetLangName}。
要求：
1. 只输出翻译结果，不要任何解释或额外内容
2. 保持原文的语气、风格和格式
3. 专业术语要准确
4. 如果是口语化表达，翻译也要自然流畅`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sourceText }
    ];

    try {
      const response = await fetch(activeApi.baseUrl, {
        method: 'POST',
        headers: template.headers(activeApi.apiKey),
        body: JSON.stringify(template.bodyBuilder(activeApi.model, messages))
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const result = template.responseParser(data);
      setTranslatedText(result);
    } catch (err) {
      console.error('Translation error:', err);
      setError(err.message || '翻译失败，请检查 API 配置');
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang, activeApi]);

  // 回车发送
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      translate();
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        {/* 头部 */}
        <header className="sticky top-0 z-30 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">AI 翻译</h1>
                {activeApi && (
                  <p className="text-xs text-zinc-500">{activeApi.name} · {activeApi.model}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                showSettings 
                  ? "bg-blue-500 text-white" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* 设置面板 */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <Key className="w-4 h-4 text-blue-400" />
                      API 配置管理
                    </h3>
                    <button
                      onClick={() => {
                        setEditingApi(null);
                        setShowApiModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      添加
                    </button>
                  </div>

                  {config.apis.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>还没有配置 API</p>
                      <p className="text-sm mt-1">点击上方按钮添加你的 AI API</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {config.apis.map(api => (
                        <div
                          key={api.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer",
                            config.activeApiId === api.id
                              ? "bg-blue-500/20 border border-blue-500/50"
                              : "bg-zinc-700/50 hover:bg-zinc-700 border border-transparent"
                          )}
                          onClick={() => handleSetActiveApi(api.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              config.activeApiId === api.id 
                                ? "bg-blue-500" 
                                : "bg-zinc-600"
                            )}>
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{api.name}</p>
                              <p className="text-xs text-zinc-400">{api.model}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingApi(api);
                                setShowApiModal(true);
                              }}
                              className="p-2 hover:bg-zinc-600 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4 text-zinc-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('确定要删除这个配置吗？')) {
                                  handleDeleteApi(api.id);
                                }
                              }}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 语言选择栏 */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <LanguageSelector 
              value={sourceLang} 
              onChange={setSourceLang}
              label="源语言"
            />
            
            <button
              onClick={swapLanguages}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              <ArrowRightLeft className="w-5 h-5 text-zinc-400" />
            </button>
            
            <LanguageSelector 
              value={targetLang} 
              onChange={setTargetLang}
              label="目标语言"
            />
          </div>

          {/* 输入区域 */}
          <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700 mb-4 overflow-hidden">
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入要翻译的文本..."
                className="w-full h-32 bg-transparent text-white placeholder-zinc-500 text-lg resize-none hide-scrollbar"
              />
            </div>
            
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700">
              <div className="text-sm text-zinc-500">
                {sourceText.length} 字符
              </div>
              
              <button
                onClick={translate}
                disabled={!sourceText.trim() || isTranslating || !activeApi}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
                  sourceText.trim() && activeApi
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                )}
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    翻译中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    翻译
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 翻译结果 */}
          <AnimatePresence>
            {(translatedText || isTranslating) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 overflow-hidden"
              >
                <div className="p-4">
                  {isTranslating ? (
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>正在翻译...</span>
                    </div>
                  ) : (
                    <p className="text-white text-lg whitespace-pre-wrap">
                      {translatedText}
                    </p>
                  )}
                </div>
                
                {translatedText && !isTranslating && (
                  <div className="flex items-center gap-2 px-4 py-3 border
