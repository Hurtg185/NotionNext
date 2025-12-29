import { Transition, Dialog } from '@headlessui/react';
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  memo
} from 'react';
import { loadCheatDict, matchCheatLoose } from '@/lib/cheatDict';

// ----------------- 全局样式 -----------------
const GlobalStyles = () => (
  <style>{`
    /* 隐藏滚动条但保留功能 */
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    
    /* 细滚动条 (用于设置页) */
    .slim-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .slim-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .slim-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
    }

    /* 追问气泡的横向滚动容器 */
    .chip-scroll-container {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 10px;
      -webkit-overflow-scrolling: touch;
      cursor: grab;
    }
    .chip-scroll-container:active {
      cursor: grabbing;
    }
  `}</style>
);

// ----------------- Helpers -----------------
const safeLocalStorageGet = (key) =>
  (typeof window !== 'undefined' ? localStorage.getItem(key) : null);

const safeLocalStorageSet = (key, value) => {
  if (typeof window !== 'undefined') localStorage.setItem(key, value);
};

const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const cx = (...arr) => arr.filter(Boolean).join(' ');

// ----------------- Data & Config -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'my-MM', name: '缅甸语', flag: '🇲🇲' },
  { code: 'vi-VN', name: '越南语', flag: '🇻🇳' },
  { code: 'th-TH', name: '泰语', flag: '🇹🇭' },
  { code: 'lo-LA', name: '老挝语', flag: '🇱🇦' },
  { code: 'ru-RU', name: '俄语', flag: '🇷🇺' },
  { code: 'km-KH', name: '柬埔寨语', flag: '🇰🇭' },
  { code: 'id-ID', name: '印尼语', flag: '🇮🇩' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
];

const DEFAULT_PROVIDERS = [
  { id: 'p1', name: '默认接口', url: 'https://apis.iflow.cn/v1', key: '' }
];

const DEFAULT_MODELS = [
  { id: 'm1', providerId: 'p1', name: 'DeepSeek V3', value: 'deepseek-chat' },
  { id: 'm2', providerId: 'p1', name: 'Qwen Max', value: 'qwen-max' },
  { id: 'm3', providerId: 'p1', name: 'GPT-4o', value: 'gpt-4o' }
];

// 默认提示词模板（对用户隐藏 JSON 结构，只展示核心指令）
const BASE_SYSTEM_INSTRUCTION = `你是一位翻译专家。将用户文本翻译成目标语言。
要求：
1. 输出4种风格：贴近原文、自然直译、自然意译、口语化。
2. 即使源文本简短，也要凑齐4种略有不同的表达。
3. 回译 (back_translation) 必须翻译回【源语言】，用于核对意思。
4. 译文和回译不要包含"翻译："或"回译："等前缀。`;

// 追问生成提示词
const REPLY_SYSTEM_INSTRUCTION = `你是一个聊天助手。根据用户输入的【原文】（对方发来的话），生成 3 到 8 个简短、自然的【回复建议】（我该怎么回）。
要求：
1. 回复建议使用【源语言】。
2. 场景为日常聊天，回复要口语化，覆盖：肯定、否定、忙碌、询问等不同角度。
3. 只返回 JSON 数组字符串，格式：["回复1", "回复2", ...]，不要 markdown 标记。`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,
  
  // 模型分配
  mainModelId: 'm1',      // 翻译用的模型
  followUpModelId: 'm1',  // 追问/回复建议用的模型 (通常用便宜快速的)
  
  // 语音 & 播放
  ttsConfig: {}, // { 'zh-CN': 'xiaoyou', 'en-US': 'jenny' } 映射表
  ttsSpeed: 1.0,

  // 背景
  backgroundOverlay: 0.95, 
  chatBackgroundUrl: '',

  // 提示词
  useCustomPrompt: false,
  customPromptText: '', // 用户输入的纯文本指令
};

// ----------------- TTS Engine -----------------
const ttsCache = new Map();

// 简单的发音人列表（实际应从 API 获取，这里模拟）
const AVAILABLE_VOICES = {
  'zh-CN': [
    { id: 'zh-CN-XiaoyouNeural', name: '小悠 (女)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男)' }
  ],
  'en-US': [
    { id: 'en-US-JennyNeural', name: 'Jenny (女)' },
    { id: 'en-US-GuyNeural', name: 'Guy (男)' }
  ],
  // ... 其他语言默认取第一个
};

const getVoiceForLang = (lang, config) => {
  // 1. 用户配置的
  if (config && config[lang]) return config[lang];
  // 2. 默认列表的第一个
  if (AVAILABLE_VOICES[lang]) return AVAILABLE_VOICES[lang][0].id;
  // 3. 硬编码兜底
  if (lang === 'my-MM') return 'my-MM-NilarNeural';
  if (lang === 'vi-VN') return 'vi-VN-HoaiMyNeural';
  if (lang === 'th-TH') return 'th-TH-PremwadeeNeural';
  return 'zh-CN-XiaoyouNeural'; 
};

const playTTS = async (text, lang, settings) => {
  if (!text) return;
  const voice = getVoiceForLang(lang, settings.ttsConfig);
  const speed = settings.ttsSpeed || 1.0;
  const key = `${voice}_${speed}_${text}`;

  try {
    let audio = ttsCache.get(key);
    if (!audio) {
      const rateVal = Math.floor((speed - 1) * 50);
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(voice)}&r=${rateVal}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      audio = new Audio(URL.createObjectURL(blob));
      ttsCache.set(key, audio);
    }
    audio.currentTime = 0;
    audio.playbackRate = speed;
    await audio.play();
  } catch (e) {
    console.error('TTS Play Error:', e);
  }
};

// ----------------- Logic Helpers -----------------
const normalizeTranslations = (raw) => {
  let data = [];
  try {
    // 尝试解析
    const json = typeof raw === 'string' ? JSON.parse(raw) : raw;
    data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch {
    return [{ translation: raw || '解析失败', back_translation: '' }];
  }

  // 过滤无效并在 UI 上不显示 style 字段
  return data
    .filter(x => x.translation)
    .slice(0, 4); 
    // UI上我们不渲染 "style" 名字，只渲染内容
};

const getLangName = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.flag || '';

// ----------------- Components -----------------

// 1. 结果卡片 (无 Style 标题，居中，点击复制)
const TranslationCard = memo(({ data, onPlay }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(data.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch {}
  };

  return (
    <div 
      onClick={handleClick}
      className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group mb-3 text-center"
    >
      {/* 复制成功提示遮罩 */}
      {copied && (
        <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10">
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md">已复制</span>
        </div>
      )}
      
      <div className="text-[18px] leading-relaxed font-medium text-gray-800 break-words select-none">
        {data.translation}
      </div>
      
      {!!data.back_translation && (
        <div className="mt-2.5 text-[13px] text-gray-400 break-words leading-snug">
          {data.back_translation}
        </div>
      )}

      {/* 隐藏的播放按钮，为了逻辑保留，实际通过点击卡片复制，长按或额外按钮播放? 
          需求说“翻译图标换成网址图标”，这里我们在卡片角落加个小喇叭 */}
      <button 
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        className="absolute bottom-2 right-2 p-2 text-gray-300 hover:text-blue-500 opacity-50 hover:opacity-100"
      >
        <i className="fas fa-volume-up" />
      </button>
    </div>
  );
});

// 2. 追问气泡 (Draggable Chips)
const ReplyChips = ({ suggestions, onClick }) => {
  const scrollRef = useRef(null);
  
  // 简单的鼠标拖拽模拟
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleDown = (e) => {
    setIsDown(true);
    setStartX(e.pageX || e.touches[0].pageX);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleLeave = () => setIsDown(false);
  const handleUp = () => setIsDown(false);
  const handleMove = (e) => {
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX || e.touches[0].pageX;
    const walk = (x - startX) * 2; 
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] text-gray-400 text-center mb-2">快捷回复 (点击自动填入)</div>
      <div 
        ref={scrollRef}
        className="chip-scroll-container no-scrollbar"
        onMouseDown={handleDown} onMouseLeave={handleLeave} onMouseUp={handleUp} onMouseMove={handleMove}
        onTouchStart={handleDown} onTouchEnd={handleUp} onTouchMove={handleMove}
      >
        {suggestions.map((text, i) => (
          <button
            key={i}
            onClick={() => onClick(text)}
            className="shrink-0 bg-white border border-pink-100 text-gray-600 px-3 py-1.5 rounded-full text-sm shadow-sm hover:bg-pink-50 active:scale-95 transition-transform"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};

// 3. 设置弹窗
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [data, setData] = useState(settings);
  const [tab, setTab] = useState('model'); // model, prompt, voice

  // 简易的 CRUD helper
  const updateProvider = (idx, key, val) => {
    const p = [...data.providers];
    p[idx] = { ...p[idx], [key]: val };
    setData({ ...data, providers: p });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10002] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="font-bold text-gray-800">设置</div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500"><i className="fas fa-times"/></button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-1 border-b border-gray-100">
          {[
            { id: 'model', label: '模型与接口' },
            { id: 'voice', label: '发音人管理' },
            { id: 'prompt', label: '提示词' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-colors",
                tab === t.id ? "bg-pink-50 text-pink-600" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto slim-scrollbar p-5 bg-white">
          
          {tab === 'model' && (
            <div className="space-y-6">
              {/* 供应商配置 */}
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase">API 供应商</div>
                {data.providers.map((p, i) => (
                  <div key={p.id} className="bg-gray-50 p-3 rounded-xl mb-3 border border-gray-200">
                    <input 
                      className="bg-transparent font-bold text-gray-800 w-full mb-2 outline-none" 
                      value={p.name} 
                      onChange={e => updateProvider(i, 'name', e.target.value)} 
                    />
                    <input 
                      className="bg-white text-xs w-full p-2 rounded border border-gray-200 mb-2" 
                      placeholder="Base URL" 
                      value={p.url} 
                      onChange={e => updateProvider(i, 'url', e.target.value)} 
                    />
                    <input 
                      className="bg-white text-xs w-full p-2 rounded border border-gray-200" 
                      type="password" 
                      placeholder="API Key" 
                      value={p.key} 
                      onChange={e => updateProvider(i, 'key', e.target.value)} 
                    />
                  </div>
                ))}
                <div className="text-[10px] text-gray-400 text-center">如需添加模型，请直接修改代码配置 (DEFAULT_MODELS)</div>
              </div>

              {/* 模型选择 */}
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase">默认用途</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs block mb-1">主翻译模型</label>
                    <select 
                      className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2"
                      value={data.mainModelId}
                      onChange={e => setData({...data, mainModelId: e.target.value})}
                    >
                      {data.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs block mb-1">追问/建议模型</label>
                    <select 
                      className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2"
                      value={data.followUpModelId}
                      onChange={e => setData({...data, followUpModelId: e.target.value})}
                    >
                      {data.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'voice' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500 mb-2">为不同语言指定特定的发音人 (TTS)</div>
              {SUPPORTED_LANGUAGES.map(lang => (
                <div key={lang.code} className="flex items-center justify-between border-b border-gray-50 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                  <select
                    className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 max-w-[140px]"
                    value={(data.ttsConfig || {})[lang.code] || ''}
                    onChange={(e) => {
                      const cfg = { ...(data.ttsConfig || {}) };
                      cfg[lang.code] = e.target.value;
                      setData({ ...data, ttsConfig: cfg });
                    }}
                  >
                    <option value="">默认</option>
                    {(AVAILABLE_VOICES[lang.code] || []).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="pt-2">
                 <label className="text-xs text-gray-500">全局语速: {data.ttsSpeed}x</label>
                 <input 
                   type="range" min="0.5" max="2.0" step="0.1" 
                   className="w-full accent-pink-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                   value={data.ttsSpeed}
                   onChange={e => setData({...data, ttsSpeed: parseFloat(e.target.value)})}
                 />
              </div>
            </div>
          )}

          {tab === 'prompt' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                 <input 
                   type="checkbox" 
                   id="useCustomPrompt"
                   checked={data.useCustomPrompt}
                   onChange={e => setData({...data, useCustomPrompt: e.target.checked})}
                   className="w-4 h-4 accent-pink-500"
                 />
                 <label htmlFor="useCustomPrompt" className="text-sm font-bold">启用自定义指令</label>
              </div>
              
              <textarea
                className={`w-full flex-1 border rounded-xl p-3 text-sm resize-none focus:ring-1 focus:ring-pink-500 outline-none ${!data.useCustomPrompt ? 'bg-gray-100 text-gray-400' : 'bg-white'}`}
                placeholder="在此输入您的额外要求，例如：'所有译文都要带上敬语' 或 '翻译成莎士比亚风格'。系统会自动处理 JSON 格式，您只需关注内容。"
                value={data.customPromptText}
                onChange={e => setData({...data, customPromptText: e.target.value})}
                disabled={!data.useCustomPrompt}
              />
              <div className="mt-2 text-[10px] text-gray-400">
                注意：请勿输入复杂的 JSON 代码，仅输入自然语言指令即可。
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
           <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gray-100 text-sm font-bold text-gray-600">取消</button>
           <button onClick={() => { onSave(data); onClose(); }} className="px-5 py-2 rounded-xl bg-pink-500 text-sm font-bold text-white shadow-lg shadow-pink-200">保存</button>
        </div>
      </div>
    </div>
  );
};

// ----------------- Main Chat Logic -----------------
const AiChatContent = ({ onClose }) => {
  // --- State ---
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  const [sourceLang, setSourceLang] = useState('zh-CN');
  const [targetLang, setTargetLang] = useState('en-US');
  
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState([]); // [{ type: 'user'|'ai', ... }]
  // 为了实现“只显示结果，下拉看历史”，我们其实只需要渲染最新的结果，
  // 历史记录可以放在一个折叠区域或者 ScrollView 的上方。
  // 但用户的需求是：翻译出结果后，自动滚频把用户消息滚上去不显示。
  // 这意味着所有消息都在一个列表中，只是 ScrollTop 位置调整。

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // 语音录制
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  
  // 追问建议
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const scrollRef = useRef(null);
  const settingsEndRef = useRef(null);

  // 弹窗状态
  const [showSettings, setShowSettings] = useState(false);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showTgtPicker, setShowTgtPicker] = useState(false);

  // --- Effect: Load/Save ---
  useEffect(() => {
    const s = safeLocalStorageGet('ai886_settings');
    if (s) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); } catch {}
    }
  }, []);

  useEffect(() => {
    safeLocalStorageSet('ai886_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Logic: Scroll ---
  const scrollToResult = () => {
    if (!scrollRef.current) return;
    // 简单的滚动到底部，如果内容不多，可能用户消息还在上面。
    // 如果要强制隐藏用户消息，需要计算高度。
    // 这里采用：平滑滚动到底部
    setTimeout(() => {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  };

  // --- Logic: API Calls ---
  const getProviderAndModel = (modelId) => {
    const model = settings.models.find(m => m.id === modelId);
    if (!model) return null;
    const provider = settings.providers.find(p => p.id === model.providerId);
    return { provider, model };
  };

  const fetchAi = async (messages, modelId, jsonMode = true) => {
    const pm = getProviderAndModel(modelId);
    if (!pm || !pm.provider.key) throw new Error('API Key 未配置');

    const body = {
      model: pm.model.value,
      messages,
      stream: false
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${pm.provider.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pm.provider.key}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    return data.choices[0].message.content;
  };

  const handleTranslate = async (textOverride = null) => {
    const text = (textOverride || inputVal).trim();
    if (!text) return;

    setIsLoading(true);
    setLoadingMsg('翻译中...');
    setSuggestions([]); // 清空旧建议
    
    // Optimistic UI: Add user message
    const userMsg = { id: nowId(), role: 'user', text, ts: Date.now() };
    setHistory(prev => [...prev, userMsg]);
    setInputVal('');
    scrollToResult();

    // Prepare Prompt
    let sysPrompt = BASE_SYSTEM_INSTRUCTION;
    if (settings.useCustomPrompt && settings.customPromptText) {
      sysPrompt += `\n额外要求: ${settings.customPromptText}`;
    }
    // 强制 JSON 约束
    sysPrompt += `\n必须返回严格的 JSON 格式: { "data": [ { "translation": "...", "back_translation": "..." }, ... ] }`;
    // 强制回译语言
    sysPrompt += `\nback_translation 必须翻译回: ${getLangName(sourceLang)}`;

    const userPrompt = `Source Language: ${getLangName(sourceLang)}\nTarget Language: ${getLangName(targetLang)}\nContent:\n${text}`;

    try {
      // 1. 查字典
      const dict = await loadCheatDict(sourceLang);
      const hit = matchCheatLoose(dict, text, targetLang);
      
      let results;
      let from = 'ai';

      if (hit) {
        results = normalizeTranslations(hit);
        from = 'dict';
      } else {
        const raw = await fetchAi([
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt }
        ], settings.mainModelId, true);
        results = normalizeTranslations(raw);
      }

      // Add AI Response
      const aiMsg = { id: nowId(), role: 'ai', results, from, ts: Date.now() };
      setHistory(prev => [...prev, aiMsg]);
      scrollToResult();

      // Auto Play TTS (Default Result)
      playTTS(results[0]?.translation, targetLang, settings);

      // 2. 触发追问建议 (Parallel)
      fetchSuggestions(text);

    } catch (e) {
      setHistory(prev => [...prev, { id: nowId(), role: 'error', text: e.message || '翻译失败' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async (originalText) => {
    setIsSuggesting(true);
    try {
      const pm = getProviderAndModel(settings.followUpModelId);
      if (!pm) return;

      const raw = await fetchAi([
        { role: 'system', content: REPLY_SYSTEM_INSTRUCTION },
        { role: 'user', content: `原文: ${originalText}` }
      ], settings.followUpModelId, true); // Some models might not support json_object, handled in try/catch if needed

      const list = JSON.parse(raw);
      if (Array.isArray(list)) setSuggestions(list);
    } catch (e) {
      console.log('Suggestion failed', e);
    } finally {
      setIsSuggesting(false);
    }
  };

  // --- Logic: Speech ---
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('不支持语音识别');
    
    // 停止当前
    if (recognitionRef.current) recognitionRef.current.stop();

    const recognition = new SpeechRecognition();
    // 语音识别使用源语言
    recognition.lang = sourceLang; 
    recognition.interimResults = true;
    recognition.continuous = true; // 允许长按

    recognition.onstart = () => {
      setIsRecording(true);
      setInputVal(''); // 清空开始录
    };
    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInputVal(t);
    };
    recognition.onend = () => setIsRecording(false);
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecordingAndSend = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // 稍微延迟等待最后结果填入 inputVal
      setTimeout(() => {
        handleTranslate(); 
      }, 500);
    }
  };

  // --- Logic: Language Swap ---
  const swapLangs = () => {
    const t = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(t);
  };

  // --- Render ---
  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#FFF0F5] relative text-gray-800">
      <GlobalStyles />
      
      {/* Background */}
      {settings.chatBackgroundUrl && (
         <div 
           className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-500 pointer-events-none"
           style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, opacity: 1 - settings.backgroundOverlay }}
         />
      )}

      {/* Header */}
      <div className="relative z-10 pt-safe-top bg-white/60 backdrop-blur-md shadow-sm border-b border-pink-100/50">
        <div className="flex items-center justify-center h-12 relative px-4">
          {/* Logo Title */}
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="logo" className="w-5 h-5 rounded-full opacity-80" onError={(e) => e.target.style.display='none'} />
            <span className="font-extrabold text-gray-800 text-lg tracking-tight">886.best</span>
            <span className="text-[10px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded ml-1 font-medium">Ai翻译</span>
          </div>
          
          {/* Settings Button (Right) */}
          <button 
            onClick={() => setShowSettings(true)}
            className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-200 transition-colors text-gray-600"
          >
            <i className="fas fa-cog" />
          </button>
        </div>
      </div>

      {/* Main Scroll Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-4 pt-4 pb-32 scroll-smooth"
      >
        <div className="w-full max-w-[600px] mx-auto min-h-full flex flex-col justify-end">
           {history.length === 0 && !isLoading && (
             <div className="text-center text-gray-400 mb-20 opacity-60">
                <div className="text-4xl mb-2">💬</div>
                <div className="text-sm">支持 100+ 种语言互译</div>
             </div>
           )}

           {history.map((item, idx) => {
             // User Message
             if (item.role === 'user') {
               return (
                 <div key={item.id} className="flex justify-end mb-6 opacity-60 scale-90 origin-right">
                   <div className="bg-gray-200 text-gray-700 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[85%] break-words shadow-inner">
                     {item.text}
                   </div>
                 </div>
               );
             }
             // Error
             if (item.role === 'error') {
               return (
                 <div key={item.id} className="bg-red-50 text-red-500 text-xs p-3 rounded-xl text-center mb-6">
                   {item.text}
                 </div>
               );
             }
             // AI Result
             return (
               <div key={item.id} className="mb-6 animate-in slide-in-from-bottom-4 duration-500">
                  {item.results.map((res, i) => (
                    <TranslationCard 
                      key={i} 
                      data={res} 
                      onPlay={() => playTTS(res.translation, targetLang, settings)} 
                    />
                  ))}
                  
                  {/* Dictionary Hit Indicator */}
                  {item.from === 'dict' && (
                    <div className="text-center text-[10px] text-green-600/50 mb-2">- 字典严格匹配 -</div>
                  )}

                  {/* Reply Suggestions (Only for the latest message) */}
                  {idx === history.length - 1 && (
                    isSuggesting ? (
                      <div className="h-8 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce"/>
                        <span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce delay-100"/>
                        <span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce delay-200"/>
                      </div>
                    ) : (
                      <ReplyChips 
                        suggestions={suggestions} 
                        onClick={(reply) => {
                          setInputVal(reply);
                          handleTranslate(reply);
                        }}
                      />
                    )
                  )}
               </div>
             );
           })}

           {/* Loading State */}
           {isLoading && (
             <div className="flex justify-center mb-8">
               <div className="bg-white/80 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-sm text-pink-500 animate-pulse">
                 <i className="fas fa-spinner fa-spin" />
                 <span>{loadingMsg}</span>
               </div>
             </div>
           )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white/95 to-white/0 pt-6 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-[600px] mx-auto px-4">
          
          {/* Controls */}
          <div className="flex items-center justify-between mb-2 px-1">
            {/* Lang Switcher */}
            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-sm rounded-full p-1 border border-white/50 shadow-sm">
              <button 
                onClick={() => setShowSrcPicker(true)} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-white/50 rounded-full transition-all"
              >
                <span className="text-lg">{getLangFlag(sourceLang)}</span>
                <span className="text-xs font-bold text-gray-700">{getLangName(sourceLang)}</span>
              </button>
              
              <button onClick={swapLangs} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-pink-500">
                <i className="fas fa-exchange-alt text-xs" />
              </button>

              <button 
                onClick={() => setShowTgtPicker(true)} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-white/50 rounded-full transition-all"
              >
                <span className="text-lg">{getLangFlag(targetLang)}</span>
                <span className="text-xs font-bold text-gray-700">{getLangName(targetLang)}</span>
              </button>
            </div>

            {/* Model Icon */}
            <button 
               onClick={() => setShowSettings(true)}
               className="w-8 h-8 flex items-center justify-center text-pink-400 hover:text-pink-600 hover:bg-pink-50 rounded-full transition-colors"
               title="切换模型"
            >
              <i className="fas fa-robot" />
            </button>
          </div>

          {/* Input Area */}
          <div className="relative flex items-end gap-2 bg-white border border-pink-100 rounded-[28px] p-1.5 shadow-[0_4px_20px_rgba(236,72,153,0.08)]">
            <textarea
              className="flex-1 bg-transparent border-none outline-none resize-none px-4 py-3 max-h-32 min-h-[48px] text-[16px] leading-6 no-scrollbar"
              placeholder="输入内容..."
              rows={1}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => {
                if(e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
            />

            {/* Action Button: Send or Mic */}
            {inputVal.trim() ? (
              <button 
                onClick={() => handleTranslate()}
                className="w-11 h-11 rounded-full bg-pink-500 text-white shadow-md shadow-pink-200 flex items-center justify-center mb-0.5 active:scale-90 transition-transform"
              >
                <i className="fas fa-arrow-up" />
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecordingAndSend}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecordingAndSend(); }}
                className={cx(
                  "w-11 h-11 rounded-full flex items-center justify-center mb-0.5 transition-all select-none touch-none",
                  isRecording 
                    ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-200" 
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                <i className={`fas ${isRecording ? 'fa-waveform' : 'fa-microphone'}`} />
              </button>
            )}

            {/* Recording Indicator Overlay */}
            {isRecording && (
               <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full animate-bounce">
                 松开发送...
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Language Pickers */}
      <Dialog open={showSrcPicker} onClose={() => setShowSrcPicker(false)} className="relative z-[10003]">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl max-h-[70vh] overflow-y-auto slim-scrollbar">
            <div className="text-center font-bold mb-3 text-gray-800">选择源语言</div>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_LANGUAGES.map(l => (
                <button key={l.code} onClick={() => { setSourceLang(l.code); setShowSrcPicker(false); }} className={`p-3 rounded-xl border text-left ${sourceLang===l.code ? 'border-pink-500 bg-pink-50': 'border-gray-100'}`}>
                   <span className="mr-2">{l.flag}</span>{l.name}
                </button>
              ))}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      <Dialog open={showTgtPicker} onClose={() => setShowTgtPicker(false)} className="relative z-[10003]">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl max-h-[70vh] overflow-y-auto slim-scrollbar">
            <div className="text-center font-bold mb-3 text-gray-800">选择目标语言</div>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_LANGUAGES.map(l => (
                <button key={l.code} onClick={() => { setTargetLang(l.code); setShowTgtPicker(false); }} className={`p-3 rounded-xl border text-left ${targetLang===l.code ? 'border-pink-500 bg-pink-50': 'border-gray-100'}`}>
                   <span className="mr-2">{l.flag}</span>{l.name}
                </button>
              ))}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          settings={settings} 
          onSave={setSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
};

// ----------------- Drawer Wrapper -----------------
const AIChatDrawer = ({ isOpen, onClose }) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-in-out duration-300"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="transform transition ease-in-out duration-300"
              leaveFrom="translate-y-0"
              leaveTo="translate-y-full"
            >
              <Dialog.Panel className="pointer-events-auto w-screen h-full">
                <AiChatContent onClose={onClose} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AIChatDrawer;
