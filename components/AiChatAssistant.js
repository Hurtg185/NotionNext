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
  constructor(dbName = 'AiChatDB', version = 2) { // 升级版本号以防万一，虽非必须
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
          // 新增 isPinned 索引用于置顶排序
          sessionStore.createIndex('isPinned', 'isPinned', { unique: false });
        } else {
          // 如果是升级，确保有索引
          const store = request.transaction.objectStore('sessions');
          if (!store.indexNames.contains('isPinned')) {
            store.createIndex('isPinned', 'isPinned', { unique: false });
          }
        }
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('sessionId', 'sessionId', { unique: false });
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
    const session = { id: Date.now().toString(), title, updatedAt: Date.now(), isPinned: 0 };
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
    await this.transaction('sessions', 'readwrite', store => store.delete(id));
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
    return this.transaction('sessions', 'readonly', store => store.getAll());
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

  transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);
      if (request instanceof IDBRequest) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        tx.oncomplete = () => resolve(request); 
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

    @keyframes ripple {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(3); opacity: 0; }
    }

    .message-bubble-enter { opacity: 0; transform: translateY(10px); }
    .message-bubble-enter-active { opacity: 1; transform: translateY(0); transition: all 300ms; }
  `}</style>
);

// ----------------- Helpers -----------------
const safeLocalStorageGet = (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); };
const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const cx = (...arr) => arr.filter(Boolean).join(' ');

// 图片压缩
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // 压缩质量 0.6
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
    };
  });
};

const fileToBase64 = (file) => new Promise(r => {
  const reader = new FileReader();
  reader.onload = e => r(e.target.result);
  reader.readAsDataURL(file);
});

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
  { id: 'm1', providerId: 'p1', name: 'DeepSeek V3.2', value: 'deepseek-v3.2' },
  { id: 'm2', providerId: 'p1', name: 'Qwen3 Max', value: 'qwen3-max' },
  { id: 'm3', providerId: 'p1', name: 'Gemini-2.5-Flash-Lite', value: 'Gemini-2.5-Flash-Lite' }
];

const BASE_SYSTEM_INSTRUCTION = `你是一位翻译专家。将用户文本或图片中的文字翻译成目标语言。
要求：
1. 输出4种风格：贴近原文、自然直译、自然意译、口语化。
2. 即使源文本简短，也要凑齐4种略有不同的表达。
3. 回译 (back_translation) 必须翻译回【源语言】，用于核对意思。
4. 译文和回译不要包含"翻译："或"回译："等前缀。
5. 图片处理：如果用户提供了图片，请先识别图片中的所有文字（OCR），然后对识别出的文字进行翻译。如果图片没有文字，请用目标语言描述图片内容。
6. 必须返回严格的 JSON 格式: { "data": [ { "style": "...", "translation": "...", "back_translation": "..." }, ... ] }`;

const REPLY_SYSTEM_INSTRUCTION = `你是一个聊天助手。根据用户输入的【原文】，生成 3 到 8 个简短、自然的【回复建议】（我该怎么回）。
要求：
1. 回复建议使用【目标语言】。
2. 场景为日常聊天，回复要口语化。
3. 只返回 JSON 数组字符串，格式：["回复1", "回复2", ...]，不要 markdown 标记。`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,
  
  mainModelId: 'm1',      
  secondModelId: null, // 第二个模型 ID (用于对比)
  followUpModelId: 'm1', 
  
  ttsConfig: {}, 
  ttsSpeed: 1.0,

  backgroundOverlay: 0.9, 
  chatBackgroundUrl: '', // URL 或 Base64

  useCustomPrompt: false,
  customPromptText: '', 

  enableFollowUp: true, // 新增：是否启用追问
};

// ----------------- TTS Engine -----------------
const ttsCache = new Map();
const AVAILABLE_VOICES = {
  'zh-CN': [{ id: 'zh-CN-XiaoyouNeural', name: '小悠' }, { id: 'zh-CN-YunxiNeural', name: '云希' }],
  'en-US': [{ id: 'en-US-JennyNeural', name: 'Jenny' }, { id: 'en-US-GuyNeural', name: 'Guy' }],
  // ... 其他语言简化，保留结构
};

const getVoiceForLang = (lang, config) => {
  if (config && config[lang]) return config[lang];
  // 简单回退
  if (lang.startsWith('en')) return 'en-US-JennyNeural';
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
    return [{ style: '错误', translation: '解析返回数据失败', back_translation: '' }];
  }
  const validData = data.filter(x => x && x.translation);
  if (validData.length === 0) return [{ style: '结果', translation: typeof raw === 'string' ? raw : '无有效译文', back_translation: '' }];
  return validData.slice(0, 4); 
};

const getLangName = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.flag || '';

// ----------------- Components -----------------

// 1. 结果卡片容器 (支持滑动切换双模型)
const TranslationResultContainer = memo(({ item, targetLang, onPlay }) => {
  // 如果有 modelResults (双模型)，则支持滑动切换
  // 如果只有 results (单模型)，则直接显示
  const hasDual = !!(item.modelResults && item.modelResults.length > 1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStart = useRef(null);

  // 确保索引有效
  const effectiveIndex = hasDual ? currentIndex : 0;
  const currentData = hasDual ? item.modelResults[effectiveIndex].data : item.results;
  const currentModelName = hasDual ? item.modelResults[effectiveIndex].modelName : null;

  const onTouchStart = (e) => {
    if (!hasDual) return;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (!hasDual || touchStart.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const diff = touchStart.current - endX;
    
    // 左滑 (下一页)
    if (diff > 50) {
      setCurrentIndex(prev => (prev + 1) % item.modelResults.length);
    }
    // 右滑 (上一页)
    if (diff < -50) {
      setCurrentIndex(prev => (prev - 1 + item.modelResults.length) % item.modelResults.length);
    }
    touchStart.current = null;
  };

  return (
    <div 
      className="relative group"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {hasDual && (
        <div className="flex justify-center mb-1 gap-1">
           {item.modelResults.map((_, idx) => (
             <div key={idx} className={`h-1 rounded-full transition-all ${idx === effectiveIndex ? 'w-4 bg-pink-400' : 'w-1.5 bg-gray-200'}`} />
           ))}
        </div>
      )}
      
      {currentModelName && (
        <div className="text-[10px] text-center text-gray-400 mb-1 font-mono">{currentModelName}</div>
      )}

      {currentData.map((res, i) => (
        <TranslationCard key={i} data={res} onPlay={() => onPlay(res.translation)} />
      ))}
    </div>
  );
});

const TranslationCard = memo(({ data, onPlay }) => {
  const [copied, setCopied] = useState(false);
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(data.translation);
      if (navigator.vibrate) navigator.vibrate(50);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch {}
  };

  return (
    <div 
      onClick={handleClick}
      className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group mb-3 text-center"
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
      <div className="absolute top-2 left-2 text-[10px] text-pink-200 font-bold border border-pink-50 px-1 rounded">{data.style}</div>
    </div>
  );
});

// 2. 追问气泡
const ReplyChips = ({ suggestions, onClick }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] text-gray-400 text-center mb-2">回复建议</div>
      <div className="chip-scroll-container no-scrollbar">
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

// 3. 模型选择器 (支持多选)
const ModelSelectorModal = ({ settings, onClose, onSave }) => {
  const [activeProvId, setActiveProvId] = useState(settings.providers[0]?.id);
  const [mode, setMode] = useState('main'); // main, second, followup
  
  // 临时状态，点保存才生效
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
     // 初始化 activeProvId
     const currentModel = settings.models.find(m => m.id === settings.mainModelId);
     if(currentModel) setActiveProvId(currentModel.providerId);
  }, []);

  const handleSelect = (modelId) => {
    if (mode === 'main') {
      setLocalSettings(s => ({ ...s, mainModelId: modelId }));
    } else if (mode === 'second') {
      // 如果点击已选中的，则取消选择
      if (localSettings.secondModelId === modelId) {
        setLocalSettings(s => ({ ...s, secondModelId: null }));
      } else {
        setLocalSettings(s => ({ ...s, secondModelId: modelId }));
      }
    } else {
      setLocalSettings(s => ({ ...s, followUpModelId: modelId }));
    }
  };

  const getModelsByProv = (pid) => settings.models.filter(m => m.providerId === pid);
  const currentModels = getModelsByProv(activeProvId);

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10005]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden h-[550px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
             <div className="font-bold text-gray-800">模型选择</div>
             <button onClick={onClose}><i className="fas fa-times text-gray-400"/></button>
          </div>
          
          <div className="flex p-2 gap-2 border-b border-gray-100 bg-gray-50">
            <button onClick={() => setMode('main')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${mode==='main' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>主翻译</button>
            <button onClick={() => setMode('second')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${mode==='second' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>对比模型</button>
            <button onClick={() => setMode('followup')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${mode==='followup' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>追问建议</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
             {/* 供应商列表 */}
             <div className="w-1/3 bg-gray-50 border-r border-gray-100 overflow-y-auto slim-scrollbar p-2">
               {settings.providers.map(p => (
                 <button key={p.id} onClick={() => setActiveProvId(p.id)} className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold mb-1 transition-all ${activeProvId === p.id ? 'bg-white shadow-sm text-gray-900 border-l-4 border-pink-500' : 'text-gray-500 hover:bg-gray-200'}`}>{p.name}</button>
               ))}
             </div>
             
             {/* 模型列表 */}
             <div className="flex-1 overflow-y-auto slim-scrollbar p-3">
               <div className="text-[10px] text-gray-400 mb-2 px-2">
                 {mode === 'main' && '选择用于主要翻译的模型'}
                 {mode === 'second' && '选择第二个模型进行对比 (再次点击取消)'}
                 {mode === 'followup' && '选择生成追问建议的模型'}
               </div>
               {currentModels.map(m => {
                 let isSelected = false;
                 let colorClass = '';
                 if (mode === 'main' && localSettings.mainModelId === m.id) { isSelected = true; colorClass = 'border-pink-500 bg-pink-50 text-pink-700'; }
                 if (mode === 'second' && localSettings.secondModelId === m.id) { isSelected = true; colorClass = 'border-purple-500 bg-purple-50 text-purple-700'; }
                 if (mode === 'followup' && localSettings.followUpModelId === m.id) { isSelected = true; colorClass = 'border-blue-500 bg-blue-50 text-blue-700'; }

                 return (
                   <button key={m.id} onClick={() => handleSelect(m.id)} className={`w-full text-left px-4 py-3 rounded-xl border mb-2 transition-all flex items-center justify-between group ${isSelected ? colorClass : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                     <div><div className="font-bold text-sm">{m.name}</div><div className="text-[10px] opacity-60 font-mono">{m.value}</div></div>
                     {isSelected && <i className="fas fa-check" />}
                   </button>
                 );
               })}
             </div>
          </div>
          
          <div className="p-4 border-t border-gray-100 flex justify-end">
             <button onClick={() => { onSave(localSettings); onClose(); }} className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-200">完成设置</button>
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
  const fileInputRef = useRef(null);

  // 供应商/模型 CRUD 略，保持与原逻辑一致
  const updateProvider = (idx, f, v) => { const arr=[...data.providers]; arr[idx]={...arr[idx],[f]:v}; setData({...data,providers:arr}); };
  const addProvider = () => setData(prev=>({...prev,providers:[...prev.providers,{id:nowId(),name:'新供应商',url:'',key:''}]}));
  const delProvider = (id) => { if(data.providers.length>1) setData(prev=>({...prev,providers:prev.providers.filter(p=>p.id!==id)})); };
  const getModelsByProv = (pid) => data.models.filter(m=>m.providerId===pid);
  const addModel = (pid) => setData(prev=>({...prev,models:[...prev.models,{id:nowId(),providerId:pid,name:'新模型',value:''}]}));
  const updateModel = (mid,f,v) => setData(prev=>({...prev,models:prev.models.map(m=>m.id===mid?{...m,[f]:v}:m)}));
  const delModel = (mid) => setData(prev=>({...prev,models:prev.models.filter(m=>m.id!==mid)}));

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if(file) {
      const base64 = await compressImage(file); // 复用压缩，虽然是背景
      setData({...data, chatBackgroundUrl: base64});
    }
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
            {[{id:'common',label:'通用'}, {id:'provider',label:'供应商与模型'}, {id:'voice',label:'发音人'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t.id ? 'bg-pink-50 text-pink-600':'text-gray-500 hover:bg-gray-50'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto slim-scrollbar p-5 bg-white">
            {tab === 'common' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">启用追问建议</div>
                    <div className="text-xs text-gray-400">翻译后自动生成回复建议</div>
                  </div>
                  <input type="checkbox" checked={data.enableFollowUp} onChange={e => setData({...data, enableFollowUp: e.target.checked})} className="w-5 h-5 accent-pink-500"/>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-bold text-gray-700 mb-2">背景设置</div>
                  <div className="flex items-center gap-3 mb-2">
                     <button onClick={() => fileInputRef.current.click()} className="px-3 py-1.5 bg-white border rounded-lg text-xs shadow-sm">上传图片</button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
                     <button onClick={() => setData({...data, chatBackgroundUrl: ''})} className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-lg text-xs">清除</button>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">遮罩浓度 (0.5 - 1.0)</div>
                  <input type="range" min="0.5" max="1.0" step="0.05" value={data.backgroundOverlay} onChange={e=>setData({...data, backgroundOverlay: parseFloat(e.target.value)})} className="w-full accent-pink-500"/>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="text-sm font-bold text-gray-700 mb-2">自定义提示词</div>
                    <textarea className="w-full text-xs p-2 rounded border bg-white" rows={3} placeholder="例如：翻译要更正式一点..." value={data.customPromptText} onChange={e=>setData({...data, customPromptText: e.target.value, useCustomPrompt: !!e.target.value})} />
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
                      <div className="flex justify-between mb-2"><span className="text-[10px] font-bold text-gray-400">模型列表</span><button onClick={()=>addModel(p.id)} className="text-[10px] bg-blue-50 text-blue-600 px-2 rounded">+ 添加</button></div>
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
                 {/* 简单的 TTS 设置 */}
                 <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="text-sm font-bold text-gray-700">朗读语速</div>
                    <input type="range" min="0.5" max="2.0" step="0.1" className="w-full accent-pink-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" value={data.ttsSpeed} onChange={e=>setData({...data,ttsSpeed:parseFloat(e.target.value)})}/>
                    <div className="text-right text-xs text-gray-500">{data.ttsSpeed}x</div>
                 </div>
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

// 5. 左侧侧边栏 (移除搜索，增加置顶)
const Sidebar = ({ isOpen, onClose, currentSessionId, onSelectSession, onNewSession }) => {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) loadSessions();
  }, [isOpen]);

  const loadSessions = async () => {
    const list = await db.getSessions();
    // 排序：置顶的(isPinned=1)在前，然后按 updatedAt 倒序
    list.sort((a, b) => {
      if ((b.isPinned || 0) !== (a.isPinned || 0)) return (b.isPinned || 0) - (a.isPinned || 0);
      return b.updatedAt - a.updatedAt;
    });
    setSessions(list);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('确认删除此对话？')) {
      await db.deleteSession(id);
      loadSessions();
      if (id === currentSessionId) onNewSession();
    }
  };

  const handleTogglePin = async (e, sess) => {
    e.stopPropagation();
    await db.updateSession(sess.id, { isPinned: sess.isPinned ? 0 : 1 });
    loadSessions();
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (editingId && editName.trim()) {
      await db.updateSession(editingId, { title: editName });
      setEditingId(null);
      loadSessions();
    }
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
                  <i className="fas fa-plus"/> 新建会话
                </button>
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
                        <div className="flex items-center gap-2 flex-1 overflow-hidden">
                           {!!sess.isPinned && <i className="fas fa-thumbtack text-[10px] text-pink-400 rotate-45"/>}
                           <div className="truncate text-sm text-gray-700 font-medium">{sess.title}</div>
                        </div>
                        <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e)=>handleTogglePin(e, sess)} className={`${sess.isPinned ? 'text-pink-500':'text-gray-300 hover:text-gray-500'}`} title={sess.isPinned?"取消置顶":"置顶"}><i className="fas fa-thumbtack text-xs"/></button>
                          <button onClick={(e)=>{e.stopPropagation();setEditingId(sess.id);setEditName(sess.title);}} className="text-gray-300 hover:text-blue-500"><i className="fas fa-edit text-xs"/></button>
                          <button onClick={(e)=>handleDelete(e, sess.id)} className="text-gray-300 hover:text-red-500"><i className="fas fa-trash text-xs"/></button>
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
  const [inputImage, setInputImage] = useState(null); // Base64 image
  const fileInputRef = useRef(null);

  const [history, setHistory] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  
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
    (async () => {
      const sessList = await db.getSessions();
      if (sessList.length > 0) {
        // 加载最新的
        sessList.sort((a,b)=>b.updatedAt-a.updatedAt);
        loadSession(sessList[0].id);
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

  // Session
  const createNewSession = async () => {
    const sess = await db.createSession();
    setCurrentSessionId(sess.id);
    setHistory([]);
    setSuggestions([]);
  };

  const loadSession = async (id) => {
    setCurrentSessionId(id);
    const msgs = await db.getMessages(id);
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

  // 发送请求，支持图片 (Vision)
  const fetchAi = async (messages, modelId, jsonMode = true) => {
    const pm = getProviderAndModel(modelId);
    if (!pm) throw new Error(`未配置模型 ${modelId}`);
    if (!pm.provider.key) throw new Error(`${pm.provider.name} 缺少 Key`);

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
    if (!data.choices?.length) throw new Error('API返回数据异常');
    return { content: data.choices[0].message.content, modelName: pm.model.name };
  };

  const handleTranslate = async (textOverride = null) => {
    const text = (textOverride || inputVal).trim();
    // 允许仅图片
    if (!text && !inputImage) return;
    
    if (!currentSessionId) await createNewSession();

    setIsLoading(true);
    setSuggestions([]); 
    
    // 构建 User Message 内容
    // 如果有图片，转为 Content Array 格式 (OpenAI Standard)
    let userContent = text;
    if (inputImage) {
        userContent = [
            { type: "text", text: text || "Check this image" },
            { type: "image_url", image_url: { url: inputImage } }
        ];
    }

    const userMsg = { id: nowId(), sessionId: currentSessionId, role: 'user', text, image: inputImage, ts: Date.now(), results: [] };
    
    setHistory(prev => [...prev, userMsg]);
    setInputVal('');
    setInputImage(null); // Clear image
    scrollToResult();
    await db.addMessage(userMsg);
    
    // 更新标题
    if (history.length === 0) {
      await db.updateSession(currentSessionId, { title: text ? text.slice(0, 20) : '[图片]' });
    } else {
      await db.updateSession(currentSessionId, {}); 
    }

    // 提示词
    let sysPrompt = BASE_SYSTEM_INSTRUCTION;
    if (settings.useCustomPrompt && settings.customPromptText) {
      sysPrompt += `\n额外要求: ${settings.customPromptText}`;
    }
    sysPrompt += `\nback_translation 必须翻译回: ${getLangName(sourceLang)}`;

    const userPromptText = `Source: ${getLangName(sourceLang)}\nTarget: ${getLangName(targetLang)}\nContent:\n${text || '[Image Content]'}`;

    // 如果有图片，用户消息需要包含 userPromptText 和 image
    let finalUserMessage;
    if (inputImage) {
        finalUserMessage = {
            role: 'user',
            content: [
                { type: "text", text: userPromptText },
                { type: "image_url", image_url: { url: inputImage } }
            ]
        };
    } else {
        finalUserMessage = { role: 'user', content: userPromptText };
    }

    // 移除上下文，仅保留当前
    const messages = [
      { role: 'system', content: sysPrompt },
      finalUserMessage
    ];

    try {
      // 字典匹配 (仅纯文本)
      let dictHit = null;
      if (!inputImage && text) {
         const dict = await loadCheatDict(sourceLang);
         dictHit = matchCheatLoose(dict, text, targetLang);
      }
      
      let aiMsg = { id: nowId(), sessionId: currentSessionId, role: 'ai', results: [], modelResults: [], from: 'ai', ts: Date.now() };

      if (dictHit) {
        aiMsg.results = normalizeTranslations(dictHit);
        aiMsg.from = 'dict';
      } else {
        // 双模型请求
        const tasks = [];
        // 主模型
        tasks.push(fetchAi(messages, settings.mainModelId, true).then(r => ({ ...r, isMain: true })).catch(e => ({ error: e.message, isMain: true })));
        
        // 如果有第二模型
        if (settings.secondModelId && settings.secondModelId !== settings.mainModelId) {
           tasks.push(fetchAi(messages, settings.secondModelId, true).then(r => ({ ...r, isMain: false })).catch(e => ({ error: e.message, isMain: false })));
        }

        const responses = await Promise.all(tasks);
        
        // 处理结果
        const modelResults = responses.map(res => {
            if (res.error) return { modelName: 'Error', data: [{ style: '错误', translation: res.error, back_translation: '' }] };
            return { modelName: res.modelName, data: normalizeTranslations(res.content) };
        });

        aiMsg.modelResults = modelResults; // 存储结构: [{ modelName, data: [] }, ...]
        aiMsg.results = modelResults[0].data; // 兼容旧结构默认显示第一个
      }

      setHistory(prev => [...prev, aiMsg]);
      await db.addMessage(aiMsg);
      scrollToResult();
      
      // 追问建议
      if (settings.enableFollowUp && text) {
          fetchSuggestions(text);
      }

    } catch (e) {
      const errorMsg = { id: nowId(), sessionId: currentSessionId, role: 'error', text: e.message || '未知错误', ts: Date.now(), results: [] };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async (originalText) => {
    setIsSuggesting(true);
    try {
      const { content } = await fetchAi([
        { role: 'system', content: REPLY_SYSTEM_INSTRUCTION },
        { role: 'user', content: `原文: ${originalText}` }
      ], settings.followUpModelId, true); 
      const list = JSON.parse(content);
      if (Array.isArray(list)) setSuggestions(list);
    } catch (e) {
      console.log('Suggestion failed:', e);
    } finally {
      setIsSuggesting(false);
    }
  };

  // --- Image Input ---
  const handleImageSelect = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
          const base64 = await compressImage(file);
          setInputImage(base64);
          // 选择图片后不立即发送，显示在输入框上方让用户确认或添加文字
      } catch (err) {
          alert('图片处理失败');
      }
  };

  // --- Voice Logic ---
  const stopAndSend = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setIsRecording(false);
    setTimeout(() => {
        setInputVal(current => {
            if (current && current.trim()) { handleTranslate(current); }
            return ''; 
        });
    }, 200);
  }, []); 

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('当前浏览器不支持语音识别');
    if (isRecording) { stopAndSend(); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang; 
    recognition.interimResults = true;
    recognition.continuous = true; 
    recognition.onstart = () => { setIsRecording(true); if (navigator.vibrate) navigator.vibrate(50); setInputVal(''); if(silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInputVal(t);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => { if (recognitionRef.current) stopAndSend(); }, 1500);
    };
    recognition.onerror = () => { stopAndSend(); };
    recognition.onend = () => { if(isRecording) setIsRecording(false); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const swapLangs = () => { const t = sourceLang; setSourceLang(targetLang); setTargetLang(t); };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#FFF0F5] relative text-gray-800">
      <GlobalStyles />
      {/* 背景图 */}
      {settings.chatBackgroundUrl && (
         <div className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-500 pointer-events-none" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, opacity: 1 - settings.backgroundOverlay }} />
      )}

      {/* Header */}
      <div className="relative z-20 pt-safe-top bg-white/60 backdrop-blur-md shadow-sm border-b border-pink-100/50">
        <div className="flex items-center justify-between h-12 relative px-4">
          <button onClick={() => setShowSidebar(true)} className="text-gray-600 hover:text-pink-500 w-10 text-left">
            <i className="fas fa-bars text-lg"/>
          </button>
          
          <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
            <i className="fas fa-link text-pink-500" />
            <span className="font-extrabold text-gray-800 text-lg tracking-tight">886.best</span>
          </div>

          <div className="flex items-center gap-3 w-10 justify-end">
            <button onClick={() => setShowSettings(true)} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-200 transition-colors text-gray-600">
              <i className="fas fa-cog" />
            </button>
          </div>
        </div>
      </div>

      {/* 录音指示器 */}
      <Transition show={isRecording} as={Fragment} enter="transition-opacity duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="absolute top-16 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-pink-500/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 animate-pulse">
            <i className="fas fa-microphone text-xl animate-bounce"/>
            <span className="font-bold">正在倾听...</span>
          </div>
        </div>
      </Transition>

      {/* Main Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-4 pt-4 pb-32 scroll-smooth">
        <div className="w-full max-w-[600px] mx-auto min-h-full flex flex-col justify-end">
           {history.length === 0 && !isLoading && (
             <div className="text-center text-gray-400 mb-20 opacity-60">
                <div className="text-4xl mb-2">👋</div>
                <div className="text-sm">支持双模型对比 & 图片翻译</div>
             </div>
           )}

           {history.map((item, idx) => {
             if (item.role === 'user') {
               return (
                 <div key={item.id} className="flex justify-end mb-6 opacity-80 origin-right">
                   <div className="flex flex-col items-end max-w-[85%]">
                       {item.image && <img src={item.image} className="w-32 h-auto rounded-lg mb-2 border border-gray-200" alt="input" />}
                       {item.text && <div className="bg-gray-200 text-gray-700 px-4 py-2 rounded-2xl rounded-tr-sm text-sm break-words shadow-inner">{item.text}</div>}
                   </div>
                 </div>
               );
             }
             if (item.role === 'error') {
               return <div key={item.id} className="bg-red-50 text-red-500 text-xs p-3 rounded-xl text-center mb-6">{item.text}</div>;
             }
             return (
               <div key={item.id} className="mb-6 animate-in slide-in-from-bottom-4 duration-500">
                  <TranslationResultContainer item={item} targetLang={targetLang} onPlay={(text) => playTTS(text, targetLang, settings)} />
                  {item.from === 'dict' && <div className="text-center text-[10px] text-green-600/50 mb-2">- 字典匹配 -</div>}
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
           {isLoading && <div className="flex justify-center mb-8"><div className="bg-white/80 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-sm text-pink-500 animate-pulse"><i className="fas fa-spinner fa-spin" /><span>处理中...</span></div></div>}
        </div>
      </div>

      {/* Input Area */}
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
               className={`absolute right-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${settings.secondModelId ? 'text-purple-500 bg-purple-50' : 'text-pink-400 hover:text-pink-600'}`}
               title="切换模型"
            >
              <i className="fas fa-robot" />
              {settings.secondModelId && <span className="absolute top-0 right-0 w-2 h-2 bg-purple-500 rounded-full"/>}
            </button>
          </div>

          <div className={`relative flex items-end gap-2 bg-white border rounded-[28px] p-1.5 shadow-sm transition-all duration-200 ${isRecording ? 'border-pink-300 ring-2 ring-pink-100' : 'border-pink-100'}`}>
            {/* Camera / Image Button */}
            <button onClick={() => fileInputRef.current?.click()} className="w-10 h-11 flex items-center justify-center text-gray-400 hover:text-pink-500">
               <i className="fas fa-camera" />
            </button>
            <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />

            <div className="flex-1 flex flex-col justify-center min-h-[44px]">
                {inputImage && (
                    <div className="relative inline-block w-fit mb-1 ml-2">
                        <img src={inputImage} alt="preview" className="h-12 rounded border border-gray-200" />
                        <button onClick={() => setInputImage(null)} className="absolute -top-2 -right-2 bg-black/50 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"><i className="fas fa-times"/></button>
                    </div>
                )}
                <textarea
                  className="w-full bg-transparent border-none outline-none resize-none px-2 py-2 max-h-32 text-[16px] leading-6 no-scrollbar placeholder-gray-400 text-gray-800"
                  placeholder={isRecording ? "" : "输入内容..."}
                  rows={1}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate(); } }}
                />
            </div>
            
            <div className="w-11 h-11 flex items-center justify-center shrink-0 mb-0.5">
               {isRecording ? (
                 <button onClick={stopAndSend} className="w-10 h-10 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center animate-pulse">
                   <i className="fas fa-stop" />
                 </button>
               ) : ((inputVal.trim().length > 0 || inputImage) ? (
                 <button onClick={() => handleTranslate()} className="w-10 h-10 rounded-full bg-pink-500 text-white shadow-md flex items-center justify-center active:scale-90 transition-transform">
                   <i className="fas fa-arrow-up" />
                 </button>
               ) : (
                 <button onClick={startRecording} className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-pink-50 hover:text-pink-500 transition-colors flex items-center justify-center">
                   <i className="fas fa-microphone text-lg" />
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pickers */}
      <Dialog open={showSrcPicker} onClose={() => setShowSrcPicker(false)} className="relative z-[10003]">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl max-h-[70vh] overflow-y-auto slim-scrollbar">
            <div className="grid grid-cols-2 gap-2">{SUPPORTED_LANGUAGES.map(l => <button key={l.code} onClick={() => { setSourceLang(l.code); setShowSrcPicker(false); }} className={`p-3 rounded-xl border text-left ${sourceLang===l.code?'border-pink-500 bg-pink-50':'border-gray-100'}`}><span className="mr-2">{l.flag}</span>{l.name}</button>)}</div>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      <Dialog open={showTgtPicker} onClose={() => setShowTgtPicker(false)} className="relative z-[10003]">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl max-h-[70vh] overflow-y-auto slim-scrollbar">
            <div className="grid grid-cols-2 gap-2">{SUPPORTED_LANGUAGES.map(l => <button key={l.code} onClick={() => { setTargetLang(l.code); setShowTgtPicker(false); }} className={`p-3 rounded-xl border text-left ${targetLang===l.code?'border-pink-500 bg-pink-50':'border-gray-100'}`}><span className="mr-2">{l.flag}</span>{l.name}</button>)}</div>
          </Dialog.Panel>
        </div>
      </Dialog>

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
          onSave={setSettings}
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
