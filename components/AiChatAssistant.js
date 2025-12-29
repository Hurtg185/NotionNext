import { Transition, Dialog } from '@headlessui/react';
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  memo
} from 'react';
// 假设这些库文件存在，如果没有请自行处理引用
import { loadCheatDict, matchCheatLoose } from '@/lib/cheatDict';

// ----------------- IndexedDB Helper (无依赖原生实现) -----------------
class ChatDB {
  constructor(dbName = 'AiChatDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('sessionId', 'sessionId', { unique: false });
          msgStore.createIndex('text', 'text', { unique: false }); // 用于搜索
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async createSession(title = '新对话') {
    await this.open();
    const session = { id: Date.now().toString(), title, updatedAt: Date.now() };
    return this.transaction('sessions', 'readwrite', store => store.put(session)).then(() => session);
  }

  async updateSession(id, data) {
    await this.open();
    return this.transaction('sessions', 'readwrite', async store => {
      const session = await new Promise((res, rej) => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = rej;
      });
      if (session) {
        Object.assign(session, data, { updatedAt: Date.now() });
        store.put(session);
      }
    });
  }

  async deleteSession(id) {
    await this.open();
    // 删除会话
    await this.transaction('sessions', 'readwrite', store => store.delete(id));
    // 删除关联消息
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['messages'], 'readwrite');
      const store = tx.objectStore('messages');
      const index = store.index('sessionId');
      const req = index.getAllKeys(id);
      req.onsuccess = () => {
        req.result.forEach(key => store.delete(key));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSessions() {
    await this.open();
    return this.transaction('sessions', 'readonly', store => {
      const index = store.index('updatedAt');
      return index.getAll(); // 默认按时间升序，取出来后我们在前端反转
    });
  }

  async addMessage(message) {
    await this.open();
    return this.transaction('messages', 'readwrite', store => store.put(message));
  }

  async getMessages(sessionId) {
    await this.open();
    return this.transaction('messages', 'readonly', store => {
      const index = store.index('sessionId');
      return index.getAll(sessionId);
    });
  }

  async searchMessages(query) {
    await this.open();
    return new Promise((resolve, reject) => {
      const results = [];
      const tx = this.db.transaction(['messages', 'sessions'], 'readonly');
      const msgStore = tx.objectStore('messages');
      const sessionStore = tx.objectStore('sessions');
      
      msgStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const msg = cursor.value;
          // 简单搜索：匹配原文或译文
          let hit = false;
          if (msg.text && msg.text.includes(query)) hit = true;
          if (msg.results && JSON.stringify(msg.results).includes(query)) hit = true;
          
          if (hit) {
             // 异步获取 session title 会比较麻烦，这里简单处理，先存sessionId
             results.push(msg);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);
      if (request instanceof IDBRequest) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        tx.oncomplete = () => resolve(request); // For void/custom returns
        tx.onerror = () => reject(tx.error);
      }
    });
  }
}

const db = new ChatDB();

// ----------------- 全局样式 -----------------
const GlobalStyles = () => (
  <style>{`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    .slim-scrollbar::-webkit-scrollbar { width: 4px; }
    .slim-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .slim-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 4px; }

    .chip-scroll-container {
      display: flex; gap: 8px; overflow-x: auto; padding: 4px 10px;
      -webkit-overflow-scrolling: touch; cursor: grab;
    }
    .chip-scroll-container:active { cursor: grabbing; }

    @keyframes ripple {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(3); opacity: 0; }
    }
    .ripple-circle {
      position: absolute; border-radius: 50%;
      background: rgba(236, 72, 153, 0.4);
      animation: ripple 1.5s infinite linear;
    }
    .ripple-delay-1 { animation-delay: 0.5s; }
    .ripple-delay-2 { animation-delay: 1.0s; }

    /* Sidebar transitions */
    .sidebar-enter { transform: translateX(-100%); }
    .sidebar-enter-active { transform: translateX(0); transition: transform 300ms; }
    .sidebar-exit { transform: translateX(0); }
    .sidebar-exit-active { transform: translateX(-100%); transition: transform 300ms; }
  `}</style>
);

// ----------------- Helpers -----------------
const safeLocalStorageGet = (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); };
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
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
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

const REPLY_SYSTEM_INSTRUCTION = `你是一个聊天助手。根据用户输入的【原文】，生成 4到 6个简短、自然符合当地社交礼仪的【回复建议】（）。
要求：
1. 回复建议使用【目标语言】。
2. 场景为日常聊天，回复要口语化。
3. 只返回 JSON 数组字符串，格式：["回复1", "回复2", ...]，不要 markdown 标记。`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,
  
  mainModelId: 'm1',      
  followUpModelId: 'm1', 
  
  ttsConfig: {}, 
  ttsSpeed: 0.8,

  backgroundOverlay: 0.95, 
  chatBackgroundUrl: '',

  useCustomPrompt: false,
  customPromptText: '', 

  enableContext: true, // 新增：是否携带上下文
};

// ----------------- TTS Engine -----------------
const ttsCache = new Map();
const AVAILABLE_VOICES = {
  'zh-CN': [
    { id: 'zh-CN-XiaoyouNeural', name: '小悠 (女)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男)' },
    { id: 'zh-CN-XiaoxiaoMultilingualNeural', name: '晓晓 (女-微软)' },
    { id: 'zh-CN-XiaoyanNeural', name: '晓颜 (女-微软)' },
    { id: 'zh-CN-YunyangNeural', name: '云野 (男)' }
  ],
  'en-US': [
    { id: 'en-US-JennyNeural', name: 'Jenny (女)' },
    { id: 'en-US-GuyNeural', name: 'Guy (男)' },
    { id: 'en-US-AriaNeural', name: 'Aria (女)' }
  ],
  'ja-JP': [
    { id: 'ja-JP-NanamiNeural', name: 'Nanami (女)' },
    { id: 'ja-JP-KeitaNeural', name: 'Keita (男)' }
  ],
  'ko-KR': [
    { id: 'ko-KR-SunHiNeural', name: 'SunHi (女)' },
    { id: 'ko-KR-InJoonNeural', name: 'InJoon (男)' }
  ],
  'my-MM': [
    { id: 'my-MM-NilarNeural', name: 'Nilar (女)' },
    { id: 'my-MM-ThihaNeural', name: 'Thiha (男)' }
  ],
  'vi-VN': [
    { id: 'vi-VN-HoaiMyNeural', name: 'HoaiMy (女)' },
    { id: 'vi-VN-NamMinhNeural', name: 'NamMinh (男)' }
  ],
  'th-TH': [
    { id: 'th-TH-PremwadeeNeural', name: 'Premwadee (女)' },
    { id: 'th-TH-NiwatNeural', name: 'Niwat (男)' }
  ],
  'id-ID': [
    { id: 'id-ID-GadisNeural', name: 'Gadis (女)' },
    { id: 'id-ID-ArdiNeural', name: 'Ardi (男)' }
  ],
  'ru-RU': [
    { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana (女)' },
    { id: 'ru-RU-DmitryNeural', name: 'Dmitry (男)' }
  ],
  'fr-FR': [
    { id: 'fr-FR-DeniseNeural', name: 'Denise (女)' },
    { id: 'fr-FR-HenriNeural', name: 'Henri (男)' }
  ],
  'es-ES': [
    { id: 'es-ES-ElviraNeural', name: 'Elvira (女)' },
    { id: 'es-ES-AlvaroNeural', name: 'Alvaro (男)' }
  ]
};

const getVoiceForLang = (lang, config) => {
  if (config && config[lang]) return config[lang];
  // 默认发音人逻辑
  if (AVAILABLE_VOICES[lang]) return AVAILABLE_VOICES[lang][0].id;
  // Fallback 逻辑
  if (lang === 'lo-LA') return 'lo-LA-KeomanyNeural';
  if (lang === 'km-KH') return 'km-KH-PisethNeural';
  return 'en-US-AvaMultilingualNeural'; 
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
    let cleanRaw = typeof raw === 'string' ? raw.trim() : '';
    if (cleanRaw.includes('```')) {
      cleanRaw = cleanRaw.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    const start = cleanRaw.indexOf('{');
    const end = cleanRaw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      cleanRaw = cleanRaw.slice(start, end + 1);
    }
    const json = cleanRaw ? JSON.parse(cleanRaw) : raw;
    data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch (e) {
    console.warn("JSON Parse Failed", e);
    return [{ style: '默认', translation: typeof raw === 'string' ? raw : '解析失败', back_translation: '' }];
  }
  const validData = data.filter(x => x && x.translation);
  if (validData.length === 0) {
     return [{ style: '结果', translation: typeof raw === 'string' ? raw : '（无译文）', back_translation: '' }];
  }
  return validData.slice(0, 4); 
};

const getLangName = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.flag || '';

// ----------------- Components -----------------

// 1. 结果卡片 (带震动)
const TranslationCard = memo(({ data, onPlay }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(data.translation);
      if (navigator.vibrate) navigator.vibrate(50); // 震动反馈
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
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] text-gray-400 text-center mb-2">快捷回复 (点击自动填入)</div>
      <div ref={scrollRef} className="chip-scroll-container no-scrollbar">
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

// 3. 模型选择器
const ModelSelectorModal = ({ settings, onClose, onSelect }) => {
  const [activeProvId, setActiveProvId] = useState(null);
  const [tab, setTab] = useState('main'); 
  useEffect(() => {
    const currentModel = settings.models.find(m => m.id === settings.mainModelId);
    if (currentModel) setActiveProvId(currentModel.providerId);
    else if (settings.providers.length > 0) setActiveProvId(settings.providers[0].id);
  }, []);
  const currentModels = settings.models.filter(m => m.providerId === activeProvId);
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
                   <button key={m.id} onClick={() => onSelect(tab, m.id)} className={`w-full text-left px-4 py-3 rounded-xl border mb-2 transition-all flex items-center justify-between group ${isSelected ? (tab === 'main' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-100 bg-white hover:border-gray-300'}`}>
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
  const [tab, setTab] = useState('common'); 

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
            {[{id:'common',label:'通用'}, {id:'provider',label:'供应商与模型'}, {id:'voice',label:'发音人'}, {id:'prompt',label:'提示词'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t.id ? 'bg-pink-50 text-pink-600':'text-gray-500 hover:bg-gray-50'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto slim-scrollbar p-5 bg-white">
            {tab === 'common' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">附带上下文 (最后30条)</div>
                    <div className="text-xs text-gray-400">开启后AI会根据最近聊天记录进行翻译，更连贯。</div>
                  </div>
                  <input type="checkbox" checked={data.enableContext} onChange={e => setData({...data, enableContext: e.target.checked})} className="w-5 h-5 accent-pink-500"/>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">背景图遮罩浓度</div>
                    <div className="text-xs text-gray-400">调整背景图片的透明度 (0.5 - 1.0)</div>
                  </div>
                  <div className="flex items-center gap-2">
                     <input type="range" min="0.5" max="1.0" step="0.05" value={data.backgroundOverlay} onChange={e=>setData({...data, backgroundOverlay: parseFloat(e.target.value)})} className="accent-pink-500"/>
                     <span className="text-xs w-8">{data.backgroundOverlay}</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-bold text-gray-700 mb-2">聊天背景图片 URL</div>
                  <input className="w-full text-xs p-2 rounded border bg-white" placeholder="https://..." value={data.chatBackgroundUrl} onChange={e=>setData({...data, chatBackgroundUrl: e.target.value})} />
                </div>
              </div>
            )}
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

// 5. 左侧侧边栏
const Sidebar = ({ isOpen, onClose, currentSessionId, onSelectSession, onNewSession }) => {
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) loadSessions();
  }, [isOpen]);

  const loadSessions = async () => {
    const list = await db.getSessions();
    setSessions(list.reverse()); // 最新的在最前
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('确认删除此对话？')) {
      await db.deleteSession(id);
      loadSessions();
      if (id === currentSessionId) onNewSession();
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (editingId && editName.trim()) {
      await db.updateSession(editingId, { title: editName });
      setEditingId(null);
      loadSessions();
    }
  };

  const handleSearch = async (val) => {
    setSearch(val);
    if (!val.trim()) {
      loadSessions();
      return;
    }
    const results = await db.searchMessages(val);
    // 从消息反查 Session (简单去重)
    const sessionIds = [...new Set(results.map(m => m.sessionId))];
    const all = await db.getSessions();
    const filtered = all.filter(s => sessionIds.includes(s.id) || s.title.includes(val)).reverse();
    setSessions(filtered);
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10001]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/30 backdrop-blur-sm" /></Transition.Child>
        <div className="fixed inset-0 flex">
          <Transition.Child as={Fragment} enter="transform transition ease-in-out duration-300" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transform transition ease-in-out duration-300" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
            <Dialog.Panel className="relative w-[80%] max-w-xs h-full bg-white shadow-2xl flex flex-col">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="font-bold text-lg text-gray-800">历史对话</span>
                <button onClick={onClose}><i className="fas fa-times text-gray-400"/></button>
              </div>
              
              <div className="p-3">
                <button onClick={() => { onNewSession(); onClose(); }} className="w-full py-2.5 bg-pink-500 text-white rounded-xl font-bold shadow-md shadow-pink-200 flex items-center justify-center gap-2 mb-3">
                  <i className="fas fa-plus"/> 新建分组
                </button>
                <div className="relative">
                  <i className="fas fa-search absolute left-3 top-3 text-gray-400 text-xs"/>
                  <input className="w-full bg-gray-100 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-pink-300 transition-all" placeholder="搜索聊天内容..." value={search} onChange={e => handleSearch(e.target.value)} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto slim-scrollbar p-2">
                {sessions.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">暂无记录</div>}
                {sessions.map(sess => (
                  <div key={sess.id} onClick={() => { onSelectSession(sess.id); onClose(); }} className={`group flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer transition-colors ${currentSessionId === sess.id ? 'bg-pink-50 border border-pink-100' : 'hover:bg-gray-50 border border-transparent'}`}>
                    {editingId === sess.id ? (
                      <form onSubmit={handleRename} onClick={e=>e.stopPropagation()} className="flex-1 flex gap-1">
                        <input className="flex-1 text-sm border rounded px-1" autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onBlur={()=>setEditingId(null)} />
                        <button type="submit" className="text-green-500 text-xs px-2">OK</button>
                      </form>
                    ) : (
                      <>
                        <div className="flex-1 truncate text-sm text-gray-700 font-medium">{sess.title}</div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e)=>{e.stopPropagation();setEditingId(sess.id);setEditName(sess.title);}} className="text-gray-400 hover:text-blue-500"><i className="fas fa-edit text-xs"/></button>
                          <button onClick={(e)=>handleDelete(e, sess.id)} className="text-gray-400 hover:text-red-500"><i className="fas fa-trash text-xs"/></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

// ----------------- Main Chat Logic -----------------
const AiChatContent = ({ onClose }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sourceLang, setSourceLang] = useState('zh-CN');
  const [targetLang, setTargetLang] = useState('en-US');
  
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null); 
  
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const scrollRef = useRef(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showTgtPicker, setShowTgtPicker] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // 初始化加载
  useEffect(() => {
    const s = safeLocalStorageGet('ai886_settings');
    if (s) { try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); } catch {} }
    // 加载或创建初始会话
    (async () => {
      const sessList = await db.getSessions();
      if (sessList.length > 0) {
        // 加载最近的一个
        loadSession(sessList[sessList.length-1].id); // getSessions默认升序，取最后一个
      } else {
        createNewSession();
      }
    })();
  }, []);

  useEffect(() => {
    safeLocalStorageSet('ai886_settings', JSON.stringify(settings));
  }, [settings]);

  // Cleanup
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

  // Session Management
  const createNewSession = async () => {
    const sess = await db.createSession();
    setCurrentSessionId(sess.id);
    setHistory([]);
    setSuggestions([]);
  };

  const loadSession = async (id) => {
    setCurrentSessionId(id);
    const msgs = await db.getMessages(id);
    // 按时间排序
    msgs.sort((a,b) => a.ts - b.ts);
    setHistory(msgs);
    scrollToResult();
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
      throw new Error('API返回数据异常');
    }
    return data.choices[0].message.content;
  };

  const handleTranslate = async (textOverride = null) => {
    const text = (textOverride || inputVal).trim();
    if (!text) return;
    if (!currentSessionId) await createNewSession();

    setIsLoading(true);
    setLoadingMsg('翻译中...');
    setSuggestions([]); 
    
    // 构造 User Message
    const userMsg = { id: nowId(), sessionId: currentSessionId, role: 'user', text, ts: Date.now(), results: [] };
    
    // 更新 UI 和 DB
    setHistory(prev => [...prev, userMsg]);
    setInputVal('');
    scrollToResult();
    await db.addMessage(userMsg);
    // 更新会话标题（如果是第一条）
    if (history.length === 0) {
      await db.updateSession(currentSessionId, { title: text.slice(0, 20) });
    } else {
      await db.updateSession(currentSessionId, {}); // 仅更新时间
    }

    let sysPrompt = BASE_SYSTEM_INSTRUCTION;
    if (settings.useCustomPrompt && settings.customPromptText) {
      sysPrompt += `\n额外要求: ${settings.customPromptText}`;
    }
    sysPrompt += `\nback_translation 必须翻译回: ${getLangName(sourceLang)}`;

    const userPrompt = `Source: ${getLangName(sourceLang)}\nTarget: ${getLangName(targetLang)}\nContent:\n${text}`;

    // 构造上下文 (如果开启)
    let contextMessages = [];
    if (settings.enableContext) {
      // 取最近 30 条，过滤掉 error
      const validHistory = history.filter(m => m.role !== 'error').slice(-30);
      contextMessages = validHistory.map(m => {
        if (m.role === 'user') return { role: 'user', content: m.text };
        if (m.role === 'ai') return { role: 'assistant', content: JSON.stringify({ data: m.results }) }; // 模拟AI返回的JSON结构
        return null;
      }).filter(Boolean);
    }

    const messages = [
      { role: 'system', content: sysPrompt },
      ...contextMessages,
      { role: 'user', content: userPrompt }
    ];

    try {
      const dict = await loadCheatDict(sourceLang);
      const hit = matchCheatLoose(dict, text, targetLang);
      
      let results;
      let from = 'ai';

      if (hit) {
        results = normalizeTranslations(hit);
        from = 'dict';
      } else {
        const raw = await fetchAi(messages, settings.mainModelId, true);
        results = normalizeTranslations(raw);
      }

      const aiMsg = { id: nowId(), sessionId: currentSessionId, role: 'ai', results, from, ts: Date.now() };
      setHistory(prev => [...prev, aiMsg]);
      scrollToResult();
      await db.addMessage(aiMsg);
      
      playTTS(results[0]?.translation, targetLang, settings);
      fetchSuggestions(text);

    } catch (e) {
      const errorMsg = { id: nowId(), sessionId: currentSessionId, role: 'error', text: e.message || '未知错误', ts: Date.now(), results: [] };
      setHistory(prev => [...prev, errorMsg]);
      // Error 一般不存入 DB 消息流，或者存入看需求，这里暂存以便回显
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

  // --- Voice Logic ---
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

  const stopAndSend = useCallback(() => {
    stopRecording();
    setTimeout(() => {
        setInputVal(current => {
            if (current && current.trim()) {
                handleTranslate(current);
            }
            return ''; 
        });
    }, 200);
  }, [stopRecording]); 

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('当前浏览器不支持语音识别');

    if (isRecording) {
      stopAndSend();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang; 
    recognition.interimResults = true;
    recognition.continuous = true; 

    recognition.onstart = () => {
      setIsRecording(true);
      if (navigator.vibrate) navigator.vibrate(50); 
      setInputVal(''); 
      resetSilenceTimer();
    };

    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInputVal(t);
      resetSilenceTimer();
    };

    recognition.onerror = (e) => {
      console.error(e);
      stopRecording();
    };
    
    // 处理异常断开
    recognition.onend = () => {
        if(isRecording) setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // 1.5秒无声音自动发送
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

      {/* Recording Indicator (Non-blocking) */}
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
        <div className="absolute top-16 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-pink-500/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 animate-pulse">
            <div className="relative w-8 h-8 flex items-center justify-center">
               <div className="absolute inset-0 bg-white/30 rounded-full animate-ping"/>
               <i className="fas fa-microphone text-xl"/>
            </div>
            <div className="flex flex-col">
               <span className="font-bold">正在倾听...</span>
               <span className="text-[10px] opacity-80">1.5秒沉默后自动发送</span>
            </div>
          </div>
        </div>
      </Transition>

      {/* Header */}
      <div className="relative z-20 pt-safe-top bg-white/60 backdrop-blur-md shadow-sm border-b border-pink-100/50">
        <div className="flex items-center justify-between h-12 relative px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(true)} className="text-gray-600 hover:text-pink-500">
              <i className="fas fa-bars text-lg"/>
            </button>
            <div className="flex items-center gap-2">
              <img src="https://886.best/favicon.ico" alt="logo" className="w-5 h-5 rounded-full" onError={(e) => e.target.style.display='none'} />
              <span className="font-extrabold text-gray-800 text-lg tracking-tight">886.best</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowHelp(true)} className="text-gray-500 hover:text-blue-500 text-sm font-medium">帮助</button>
            <button onClick={() => setShowSettings(true)} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-200 transition-colors text-gray-600">
              <i className="fas fa-cog" />
            </button>
          </div>
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
                  {item.results && item.results.map((res, i) => (
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
          
          <div className="flex items-center justify-center mb-2 px-1 relative">
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
            <button 
               onClick={() => setShowModelSelector(true)}
               className="absolute right-0 w-8 h-8 flex items-center justify-center text-pink-400 hover:text-pink-600 hover:bg-pink-50 rounded-full transition-colors"
               title="切换模型"
            >
              <i className="fas fa-robot" />
            </button>
          </div>

          <div className={`relative flex items-end gap-2 bg-white border rounded-[28px] p-1.5 shadow-sm transition-all duration-200 ${isRecording ? 'border-pink-300 ring-2 ring-pink-100' : 'border-pink-100'}`}>
            <textarea
              className="flex-1 bg-transparent border-none outline-none resize-none px-4 py-3 max-h-32 min-h-[48px] text-[16px] leading-6 no-scrollbar placeholder-gray-400 text-gray-800"
              placeholder={isRecording ? "" : "输入内容..."}
              rows={1}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate(); } }}
            />
            
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

      {/* Help Modal */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} className="relative z-[10004]">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
           <Dialog.Panel className="w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden relative">
             <button onClick={() => setShowHelp(false)} className="absolute right-4 top-4 z-10 w-8 h-8 bg-gray-100 rounded-full"><i className="fas fa-times"/></button>
             <iframe src="https://886.best/" className="w-full h-full border-none" title="Help"></iframe>
           </Dialog.Panel>
        </div>
      </Dialog>

      {/* Sidebars & Modals */}
      <Sidebar 
        isOpen={showSidebar} 
        onClose={() => setShowSidebar(false)} 
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewSession={createNewSession}
      />

      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />}
      
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
