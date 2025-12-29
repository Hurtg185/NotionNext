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
    
    /* 细滚动条 */
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

    /* 追问气泡容器 */
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

    /* 录音波纹动画 */
    @keyframes ripple {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(3); opacity: 0; }
    }
    .ripple-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(236, 72, 153, 0.4);
      animation: ripple 1.5s infinite linear;
    }
    .ripple-delay-1 { animation-delay: 0.5s; }
    .ripple-delay-2 { animation-delay: 1.0s; }
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

const BASE_SYSTEM_INSTRUCTION = `你是一位翻译专家。将用户文本翻译成目标语言。
要求：
1. 输出4种风格：贴近原文、自然直译、自然意译、口语化。
2. 即使源文本简短，也要凑齐4种略有不同的表达。
3. 回译 (back_translation) 必须翻译回【源语言】，用于核对意思。
4. 译文和回译不要包含"翻译："或"回译："等前缀。
5. 必须返回严格的 JSON 格式: { "data": [ { "style": "...", "translation": "...", "back_translation": "..." }, ... ] }`;

const REPLY_SYSTEM_INSTRUCTION = `你是一个聊天助手。根据用户输入的【原文】，生成 3 到 8 个简短、自然的【回复建议】（我该怎么回）。
要求：
1. 回复建议使用【源语言】。
2. 场景为日常聊天，回复要口语化。
3. 只返回 JSON 数组字符串，格式：["回复1", "回复2", ...]，不要 markdown 标记。`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,
  
  mainModelId: 'm1',      
  followUpModelId: 'm1', 
  
  ttsConfig: {}, 
  ttsSpeed: 1.0,

  backgroundOverlay: 0.95, 
  chatBackgroundUrl: '',

  useCustomPrompt: false,
  customPromptText: '', 
};

// ----------------- TTS Engine -----------------
const ttsCache = new Map();
const AVAILABLE_VOICES = {
  'zh-CN': [
    { id: 'zh-CN-XiaoyouNeural', name: '小悠 (女)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男)' }
  ],
  'en-US': [
    { id: 'en-US-JennyNeural', name: 'Jenny (女)' },
    { id: 'en-US-GuyNeural', name: 'Guy (男)' }
  ]
};

const getVoiceForLang = (lang, config) => {
  if (config && config[lang]) return config[lang];
  if (AVAILABLE_VOICES[lang]) return AVAILABLE_VOICES[lang][0].id;
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
    // 增强解析：去除可能存在的 Markdown 代码块标记
    let cleanRaw = typeof raw === 'string' ? raw.trim() : '';
    // 如果包含 ```json ... ```，去除
    if (cleanRaw.includes('```')) {
      cleanRaw = cleanRaw.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    
    // 尝试寻找 JSON 对象
    const start = cleanRaw.indexOf('{');
    const end = cleanRaw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      cleanRaw = cleanRaw.slice(start, end + 1);
    }

    const json = cleanRaw ? JSON.parse(cleanRaw) : raw;
    data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch (e) {
    console.warn("JSON Parse Failed", e);
    // 即使解析失败，也构建一个默认卡片，防止不显示
    return [{ style: '默认', translation: typeof raw === 'string' ? raw : '解析失败', back_translation: '' }];
  }

  // 过滤无效项并确保至少有一个
  const validData = data.filter(x => x && x.translation);
  if (validData.length === 0) {
     return [{ style: '结果', translation: typeof raw === 'string' ? raw : '（无译文）', back_translation: '' }];
  }
  return validData.slice(0, 4); 
};

const getLangName = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.flag || '';

// ----------------- Components -----------------

// 1. 结果卡片
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
      <button 
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        className="absolute bottom-2 right-2 p-2 text-gray-300 hover:text-blue-500 opacity-50 hover:opacity-100"
      >
        <i className="fas fa-volume-up" />
      </button>
    </div>
  );
});

// 2. 追问气泡
const ReplyChips = ({ suggestions, onClick }) => {
  const scrollRef = useRef(null);
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

// 3. 独立模型选择器
const ModelSelectorModal = ({ settings, onClose, onSelect }) => {
  const [activeProvId, setActiveProvId] = useState(null);
  const [tab, setTab] = useState('main'); 

  useEffect(() => {
    const currentModel = settings.models.find(m => m.id === settings.mainModelId);
    if (currentModel) setActiveProvId(currentModel.providerId);
    else if (settings.providers.length > 0) setActiveProvId(settings.providers[0].id);
  }, []);

  const currentModels = settings.models.filter(m => m.providerId === activeProvId);
  const handleSelectModel = (modelId) => onSelect(tab, modelId);

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10005]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden h-[500px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
             <div className="font-bold text-gray-800">切换模型</div>
             <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500"><i className="fas fa-times"/></button>
          </div>
          <div className="flex p-2 gap-2 border-b border-gray-100 bg-gray-50">
            <button onClick={() => setTab('main')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab==='main' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>主翻译模型</button>
            <button onClick={() => setTab('followup')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab==='followup' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>追问/建议模型</button>
          </div>
          <div className="flex flex-1 overflow-hidden">
             <div className="w-1/3 bg-gray-50 border-r border-gray-100 overflow-y-auto slim-scrollbar p-2">
               <div className="text-[10px] text-gray-400 mb-2 px-2">供应商</div>
               {settings.providers.map(p => (
                 <button key={p.id} onClick={() => setActiveProvId(p.id)} className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold mb-1 transition-all ${activeProvId === p.id ? 'bg-white shadow-sm text-gray-900 border-l-4 border-pink-500' : 'text-gray-500 hover:bg-gray-200'}`}>{p.name}</button>
               ))}
             </div>
             <div className="flex-1 overflow-y-auto slim-scrollbar p-3">
               <div className="text-[10px] text-gray-400 mb-2 px-2">{tab === 'main' ? '选择用于翻译的模型' : '选择用于生成追问的模型'}</div>
               {currentModels.length === 0 && <div className="text-center text-gray-400 text-xs mt-10">无可用模型</div>}
               {currentModels.map(m => {
                 const isSelected = (tab === 'main' ? settings.mainModelId : settings.followUpModelId) === m.id;
                 return (
                   <button key={m.id} onClick={() => handleSelectModel(m.id)} className={`w-full text-left px-4 py-3 rounded-xl border mb-2 transition-all flex items-center justify-between group ${isSelected ? (tab === 'main' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                     <div><div className="font-bold text-sm">{m.name}</div><div className="text-[10px] opacity-60 font-mono">{m.value}</div></div>
                     {isSelected && <i className="fas fa-check" />}
                   </button>
                 );
               })}
             </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// 4. 设置弹窗
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [data, setData] = useState(settings);
  const [tab, setTab] = useState('provider'); 

  // 供应商 CRUD
  const updateProvider = (idx, field, val) => {
    const arr = [...data.providers];
    arr[idx] = { ...arr[idx], [field]: val };
    setData({ ...data, providers: arr });
  };
  const addProvider = () => {
    setData(prev => ({ ...prev, providers: [...prev.providers, { id: nowId(), name: '新供应商', url: '', key: '' }] }));
  };
  const delProvider = (id) => {
    if(data.providers.length <=1) return alert('至少保留一个');
    setData(prev => ({ ...prev, providers: prev.providers.filter(p=>p.id!==id) }));
  };

  // 模型 CRUD
  const getModelsByProv = (pid) => data.models.filter(m => m.providerId === pid);
  const addModel = (pid) => {
    setData(prev => ({ ...prev, models: [...prev.models, { id: nowId(), providerId: pid, name: '新模型', value: '' }] }));
  };
  const updateModel = (mid, field, val) => {
    setData(prev => ({ ...prev, models: prev.models.map(m => m.id === mid ? { ...m, [field]: val } : m) }));
  };
  const delModel = (mid) => {
    setData(prev => ({ ...prev, models: prev.models.filter(m => m.id !== mid) }));
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10002]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="font-bold text-gray-800">设置</div>
            <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500"><i className="fas fa-times"/></button>
          </div>
          <div className="flex p-2 gap-1 border-b border-gray-100">
            {[{id:'provider',label:'供应商与模型'}, {id:'voice',label:'发音人'}, {id:'prompt',label:'提示词'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t.id ? 'bg-pink-50 text-pink-600':'text-gray-500 hover:bg-gray-50'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto slim-scrollbar p-5 bg-white">
            {tab === 'provider' && (
              <div className="space-y-6">
                {data.providers.map((p, idx) => (
                  <div key={p.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                       <input className="font-bold text-gray-800 bg-transparent outline-none" value={p.name} onChange={e=>updateProvider(idx,'name',e.target.value)} />
                       <button onClick={()=>delProvider(p.id)} className="text-red-500 text-xs">删除</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input className="bg-white text-xs p-2 rounded border" placeholder="URL" value={p.url} onChange={e=>updateProvider(idx,'url',e.target.value)} />
                      <input className="bg-white text-xs p-2 rounded border" type="password" placeholder="Key" value={p.key} onChange={e=>updateProvider(idx,'key',e.target.value)} />
                    </div>
                    {/* Nested Models */}
                    <div className="bg-white rounded-lg p-2 border border-gray-100">
                      <div className="flex justify-between mb-2"><span className="text-[10px] font-bold text-gray-400">该供应商下的模型</span><button onClick={()=>addModel(p.id)} className="text-[10px] bg-blue-50 text-blue-600 px-2 rounded">+ 模型</button></div>
                      {getModelsByProv(p.id).map(m => (
                        <div key={m.id} className="flex gap-2 items-center mb-1">
                          <input className="flex-1 text-[11px] border rounded p-1" placeholder="名称" value={m.name} onChange={e=>updateModel(m.id,'name',e.target.value)} />
                          <input className="flex-1 text-[11px] border rounded p-1 font-mono" placeholder="Value" value={m.value} onChange={e=>updateModel(m.id,'value',e.target.value)} />
                          <button onClick={()=>delModel(m.id)} className="text-gray-300 hover:text-red-500"><i className="fas fa-times"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={addProvider} className="w-full py-2 border border-dashed rounded-xl text-gray-500 text-sm hover:bg-gray-50">+ 添加供应商</button>
              </div>
            )}
            {tab === 'voice' && (
              <div className="space-y-4">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <div key={lang.code} className="flex items-center justify-between border-b border-gray-50 py-2">
                    <div className="flex items-center gap-2 text-sm"><span>{lang.flag}</span><span>{lang.name}</span></div>
                    <select className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 max-w-[140px]" value={(data.ttsConfig||{})[lang.code]||''} onChange={(e)=>{
                      const cfg={...(data.ttsConfig||{})}; cfg[lang.code]=e.target.value; setData({...data,ttsConfig:cfg});
                    }}>
                      <option value="">默认</option>
                      {(AVAILABLE_VOICES[lang.code]||[]).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                ))}
                <div className="pt-2"><label className="text-xs text-gray-500">全局语速: {data.ttsSpeed}x</label><input type="range" min="0.5" max="2.0" step="0.1" className="w-full accent-pink-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" value={data.ttsSpeed} onChange={e=>setData({...data,ttsSpeed:parseFloat(e.target.value)})}/></div>
              </div>
            )}
            {tab === 'prompt' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4"><input type="checkbox" id="useCustomPrompt" checked={data.useCustomPrompt} onChange={e=>setData({...data,useCustomPrompt:e.target.checked})} className="w-4 h-4 accent-pink-500"/><label htmlFor="useCustomPrompt" className="text-sm font-bold">启用自定义指令</label></div>
                <textarea className={`w-full flex-1 border rounded-xl p-3 text-sm resize-none focus:ring-1 focus:ring-pink-500 outline-none ${!data.useCustomPrompt?'bg-gray-100 text-gray-400':'bg-white'}`} placeholder="在此输入额外要求..." value={data.customPromptText} onChange={e=>setData({...data,customPromptText:e.target.value})} disabled={!data.useCustomPrompt}/>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
             <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gray-100 text-sm font-bold text-gray-600">取消</button>
             <button onClick={()=>{onSave(data);onClose();}} className="px-5 py-2 rounded-xl bg-pink-500 text-sm font-bold text-white shadow-lg shadow-pink-200">保存</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// ----------------- Main Chat Logic -----------------
const AiChatContent = ({ onClose }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sourceLang, setSourceLang] = useState('zh-CN');
  const [targetLang, setTargetLang] = useState('en-US');
  
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null); // 静音检测定时器
  
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const scrollRef = useRef(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showTgtPicker, setShowTgtPicker] = useState(false);

  useEffect(() => {
    const s = safeLocalStorageGet('ai886_settings');
    if (s) { try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); } catch {} }
  }, []);

  useEffect(() => {
    safeLocalStorageSet('ai886_settings', JSON.stringify(settings));
  }, [settings]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const scrollToResult = () => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const getProviderAndModel = (modelId) => {
    const model = settings.models.find(m => m.id === modelId);
    if (!model) return null;
    const provider = settings.providers.find(p => p.id === model.providerId);
    return { provider, model };
  };

  const fetchAi = async (messages, modelId, jsonMode = true) => {
    const pm = getProviderAndModel(modelId);
    if (!pm) throw new Error('未找到模型配置，请检查设置');
    if (!pm.provider.key) throw new Error('API Key 未配置');

    const body = { model: pm.model.value, messages, stream: false };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${pm.provider.url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pm.provider.key}` },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API Error: ${res.status}`);
    }
    
    const data = await res.json();
    if (!data || !data.choices || !data.choices.length) {
      throw new Error('API返回数据异常 (No Choices)，可能是模型不支持JSON模式或余额不足');
    }
    return data.choices[0].message.content;
  };

  const handleTranslate = async (textOverride = null) => {
    const text = (textOverride || inputVal).trim();
    if (!text) return;

    setIsLoading(true);
    setLoadingMsg('翻译中...');
    setSuggestions([]); 
    
    const userMsg = { id: nowId(), role: 'user', text, ts: Date.now() };
    setHistory(prev => [...prev, userMsg]);
    setInputVal('');
    scrollToResult();

    let sysPrompt = BASE_SYSTEM_INSTRUCTION;
    if (settings.useCustomPrompt && settings.customPromptText) {
      sysPrompt += `\n额外要求: ${settings.customPromptText}`;
    }
    sysPrompt += `\nback_translation 必须翻译回: ${getLangName(sourceLang)}`;

    const userPrompt = `Source: ${getLangName(sourceLang)}\nTarget: ${getLangName(targetLang)}\nContent:\n${text}`;

    try {
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

      const aiMsg = { id: nowId(), role: 'ai', results, from, ts: Date.now() };
      setHistory(prev => [...prev, aiMsg]);
      scrollToResult();
      playTTS(results[0]?.translation, targetLang, settings);
      fetchSuggestions(text);

    } catch (e) {
      setHistory(prev => [...prev, { id: nowId(), role: 'error', text: e.message || '未知错误' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async (originalText) => {
    setIsSuggesting(true);
    try {
      const raw = await fetchAi([
        { role: 'system', content: REPLY_SYSTEM_INSTRUCTION },
        { role: 'user', content: `原文: ${originalText}` }
      ], settings.followUpModelId, true); 
      const list = JSON.parse(raw);
      if (Array.isArray(list)) setSuggestions(list);
    } catch (e) {
      console.log('Suggestion failed:', e);
    } finally {
      setIsSuggesting(false);
    }
  };

  // --- Voice Logic (Click to Toggle + Auto Send on Silence) ---
  
  // 停止录音
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // 停止录音并发送 (用于自动发送)
  const stopAndSend = useCallback(() => {
    // 此时 inputVal 的状态可能不是最新的，因为在闭包中
    // 我们依赖 recognition 的 onresult 更新了 inputVal 状态
    // 但在定时器回调中直接取 inputVal 可能会旧。
    // 更好的方式是：在 onresult 中更新 ref，或者在 onend 事件中触发发送
    stopRecording();
    // 稍微延迟，确保状态同步，然后发送
    setTimeout(() => {
        // 由于闭包问题，这里用 setState 获取最新值
        setInputVal(current => {
            if (current && current.trim()) {
                handleTranslate(current);
            }
            return ''; // 清空
        });
    }, 200);
  }, [stopRecording]); // eslint-disable-line

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('当前浏览器不支持语音识别');

    // 如果正在录音，点击则停止并发送（手动打断）
    if (isRecording) {
      stopAndSend();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang; // 跟随源语言
    recognition.interimResults = true;
    recognition.continuous = true; 

    recognition.onstart = () => {
      setIsRecording(true);
      if (navigator.vibrate) navigator.vibrate(50); 
      setInputVal(''); 
      // 启动静音检测定时器
      resetSilenceTimer();
    };

    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInputVal(t);
      // 有声音输入，重置定时器
      resetSilenceTimer();
    };

    recognition.onerror = (e) => {
      console.error(e);
      stopRecording();
    };

    recognition.onend = () => {
        // 如果非手动触发的 stop (比如浏览器自动断开)，也要清理状态
        // 注意：onend 在 manual stop 时也会触发
        if (isRecording) {
            setIsRecording(false);
        }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // 1.5秒无声音则触发发送
    silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
            stopAndSend();
        }
    }, 1500);
  };

  const swapLangs = () => {
    const t = sourceLang; setSourceLang(targetLang); setTargetLang(t);
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#FFF0F5] relative text-gray-800">
      <GlobalStyles />
      {settings.chatBackgroundUrl && (
         <div className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-500 pointer-events-none" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, opacity: 1 - settings.backgroundOverlay }} />
      )}

      {/* Recording Overlay */}
      <Transition
        show={isRecording}
        as={Fragment}
        enter="transition-opacity duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <div className="ripple-circle w-20 h-20" />
            <div className="ripple-circle w-20 h-20 ripple-delay-1" />
            <div className="ripple-circle w-20 h-20 ripple-delay-2" />
            <div className="relative z-10 bg-pink-500 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl animate-pulse">
              <i className="fas fa-microphone text-3xl" />
            </div>
          </div>
          <div className="mt-8 text-white text-lg font-bold tracking-wider animate-pulse">正在倾听...</div>
          <div className="mt-2 text-white/80 text-sm">说话停止1.5秒后自动发送</div>
        </div>
      </Transition>

      {/* Header */}
      <div className="relative z-10 pt-safe-top bg-white/60 backdrop-blur-md shadow-sm border-b border-pink-100/50">
        <div className="flex items-center justify-center h-12 relative px-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="logo" className="w-5 h-5 rounded-full opacity-80" onError={(e) => e.target.style.display='none'} />
            <span className="font-extrabold text-gray-800 text-lg tracking-tight">886.best</span>
            <span className="text-[10px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded ml-1 font-medium">Ai翻译</span>
          </div>
          <button onClick={() => setShowSettings(true)} className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-200 transition-colors text-gray-600">
            <i className="fas fa-cog" />
          </button>
        </div>
      </div>

      {/* Main Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-4 pt-4 pb-32 scroll-smooth">
        <div className="w-full max-w-[600px] mx-auto min-h-full flex flex-col justify-end">
           {history.length === 0 && !isLoading && (
             <div className="text-center text-gray-400 mb-20 opacity-60">
                <div className="text-4xl mb-2">💬</div>
                <div className="text-sm">支持 100+ 种语言互译</div>
                <div className="text-xs mt-4">点击麦克风，说完自动发送</div>
             </div>
           )}

           {history.map((item, idx) => {
             if (item.role === 'user') {
               return (
                 <div key={item.id} className="flex justify-end mb-6 opacity-60 scale-90 origin-right">
                   <div className="bg-gray-200 text-gray-700 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[85%] break-words shadow-inner">{item.text}</div>
                 </div>
               );
             }
             if (item.role === 'error') {
               return (
                 <div key={item.id} className="bg-red-50 text-red-500 text-xs p-3 rounded-xl text-center mb-6">{item.text}</div>
               );
             }
             return (
               <div key={item.id} className="mb-6 animate-in slide-in-from-bottom-4 duration-500">
                  {item.results.map((res, i) => (
                    <TranslationCard key={i} data={res} onPlay={() => playTTS(res.translation, targetLang, settings)} />
                  ))}
                  {item.from === 'dict' && <div className="text-center text-[10px] text-green-600/50 mb-2">- 字典严格匹配 -</div>}
                  {idx === history.length - 1 && (
                    isSuggesting ? (
                      <div className="h-8 flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce"/><span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce delay-100"/><span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce delay-200"/></div>
                    ) : (
                      <ReplyChips suggestions={suggestions} onClick={(reply) => { setInputVal(reply); handleTranslate(reply); }} />
                    )
                  )}
               </div>
             );
           })}
           {isLoading && (
             <div className="flex justify-center mb-8"><div className="bg-white/80 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-sm text-pink-500 animate-pulse"><i className="fas fa-spinner fa-spin" /><span>{loadingMsg}</span></div></div>
           )}
        </div>
      </div>

      {/* Bottom Fixed Area */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white/95 to-white/0 pt-6 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-[600px] mx-auto px-4">
          
          {/* Controls: Center Language, Right Model */}
          <div className="flex items-center justify-center mb-2 px-1 relative">
            
            {/* Lang Switcher (Centered) */}
            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-sm rounded-full p-1 border border-white/50 shadow-sm mx-auto">
              <button onClick={() => setShowSrcPicker(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-white/50 rounded-full transition-all">
                <span className="text-lg">{getLangFlag(sourceLang)}</span>
                <span className="text-xs font-bold text-gray-700">{getLangName(sourceLang)}</span>
              </button>
              <button onClick={swapLangs} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-pink-500"><i className="fas fa-exchange-alt text-xs" /></button>
              <button onClick={() => setShowTgtPicker(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-white/50 rounded-full transition-all">
                <span className="text-lg">{getLangFlag(targetLang)}</span>
                <span className="text-xs font-bold text-gray-700">{getLangName(targetLang)}</span>
              </button>
            </div>

            {/* Model Icon (Right) */}
            <button 
               onClick={() => setShowModelSelector(true)}
               className="absolute right-0 w-8 h-8 flex items-center justify-center text-pink-400 hover:text-pink-600 hover:bg-pink-50 rounded-full transition-colors"
               title="切换模型"
            >
              <i className="fas fa-robot" />
            </button>
          </div>

          {/* Input Bar */}
          <div className={`relative flex items-end gap-2 bg-white border rounded-[28px] p-1.5 shadow-sm transition-all duration-200 ${isRecording ? 'border-pink-300 ring-2 ring-pink-100' : 'border-pink-100'}`}>
            <textarea
              className="flex-1 bg-transparent border-none outline-none resize-none px-4 py-3 max-h-32 min-h-[48px] text-[16px] leading-6 no-scrollbar placeholder-gray-400 text-gray-800"
              placeholder={isRecording ? "正在听..." : "输入内容..."}
              rows={1}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate(); } }}
              disabled={isRecording}
            />
            
            {/* Action Button */}
            <div className="w-11 h-11 flex items-center justify-center shrink-0 mb-0.5">
               {isRecording ? (
                 <button 
                   onClick={stopAndSend}
                   className="w-10 h-10 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center animate-pulse"
                 >
                   <i className="fas fa-stop" />
                 </button>
               ) : (inputVal.trim().length > 0 ? (
                 <button 
                   onClick={() => handleTranslate()} 
                   className="w-10 h-10 rounded-full bg-pink-500 text-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
                 >
                   <i className="fas fa-arrow-up" />
                 </button>
               ) : (
                 <button 
                   onClick={startRecording}
                   className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-pink-50 hover:text-pink-500 transition-colors flex items-center justify-center"
                 >
                   <i className="fas fa-microphone text-lg" />
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pickers */}
      <Dialog open={showSrcPicker} onClose={() => setShowSrcPicker(false)} className="relative z-[10003]">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl max-h-[70vh] overflow-y-auto slim-scrollbar">
            <div className="text-center font-bold mb-3 text-gray-800">选择源语言</div>
            <div className="grid grid-cols-2 gap-2">{SUPPORTED_LANGUAGES.map(l => <button key={l.code} onClick={() => { setSourceLang(l.code); setShowSrcPicker(false); }} className={`p-3 rounded-xl border text-left ${sourceLang===l.code?'border-pink-500 bg-pink-50':'border-gray-100'}`}><span className="mr-2">{l.flag}</span>{l.name}</button>)}</div>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      <Dialog open={showTgtPicker} onClose={() => setShowTgtPicker(false)} className="relative z-[10003]">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl max-h-[70vh] overflow-y-auto slim-scrollbar">
            <div className="text-center font-bold mb-3 text-gray-800">选择目标语言</div>
            <div className="grid grid-cols-2 gap-2">{SUPPORTED_LANGUAGES.map(l => <button key={l.code} onClick={() => { setTargetLang(l.code); setShowTgtPicker(false); }} className={`p-3 rounded-xl border text-left ${targetLang===l.code?'border-pink-500 bg-pink-50':'border-gray-100'}`}><span className="mr-2">{l.flag}</span>{l.name}</button>)}</div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Settings Modals */}
      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />}
      
      {/* Model Selector Modal */}
      {showModelSelector && (
        <ModelSelectorModal 
          settings={settings} 
          onClose={() => setShowModelSelector(false)} 
          onSelect={(tab, mid) => {
            if (tab === 'main') setSettings(s => ({ ...s, mainModelId: mid }));
            else setSettings(s => ({ ...s, followUpModelId: mid }));
          }}
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
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/30 backdrop-blur-sm" /></Transition.Child>
        <div className="fixed inset-0 overflow-hidden"><div className="absolute inset-0 overflow-hidden"><Transition.Child as={Fragment} enter="transform transition ease-in-out duration-300" enterFrom="translate-y-full" enterTo="translate-y-0" leave="transform transition ease-in-out duration-300" leaveFrom="translate-y-0" leaveTo="translate-y-full"><Dialog.Panel className="pointer-events-auto w-screen h-full"><AiChatContent onClose={onClose} /></Dialog.Panel></Transition.Child></div></div>
      </Dialog>
    </Transition>
  );
};

export default AIChatDrawer;
