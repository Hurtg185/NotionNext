import { Transition, Dialog, Menu } from '@headlessui/react';
import React, {
  useState,
  useEffect,
  useRef,
  Fragment,
  memo
} from 'react';

// 假设这些库文件存在，如果没有请自行处理引用
// 如果没有这个文件，handleTranslate 中的 dict 逻辑会自动跳过
import { loadCheatDict, matchCheatLoose } from '@/lib/cheatDict';

// ----------------- IndexedDB Helper -----------------
class ChatDB {
  constructor(dbName = 'AiChatDB', version = 2) {
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
          sessionStore.createIndex('isPinned', 'isPinned', { unique: false });
        } else {
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

  async createSession(title = 'New Chat') {
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

// ----------------- Global Styles -----------------
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
    
    /* 打字机光标效果 */
    .typing-cursor::after {
      content: '|';
      animation: blink 1s step-start infinite;
    }
    @keyframes blink { 50% { opacity: 0; } }
  `}</style>
);

// ----------------- Helpers -----------------
const safeLocalStorageGet = (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); };
const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Image Compression
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
        // Compress quality 0.6
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
    };
  });
};

// Script detection
const detectScript = (text) => {
  if (!text) return null;
  if (/[\u1000-\u109F\uAA60-\uAA7F]+/.test(text)) return 'my-MM';
  if (/[\u4e00-\u9fa5]+/.test(text)) return 'zh-CN';
  if (/[\uac00-\ud7af]+/.test(text)) return 'ko-KR';
  if (/[\u3040-\u30ff\u31f0-\u31ff]+/.test(text)) return 'ja-JP';
  if (/[\u0E00-\u0E7F]+/.test(text)) return 'th-TH';
  if (/[\u0400-\u04FF]+/.test(text)) return 'ru-RU';
  if (/^[a-zA-Z\s,.?!]+$/.test(text)) return 'en-US';
  return null;
};

// ----------------- Data & Config -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'my-MM', name: '缅甸语', flag: '🇲🇲' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
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

// Expanded Providers (More options as requested)
const DEFAULT_PROVIDERS = [
  { id: 'p1', name: '默认接口 (Iflow)', url: 'https://apis.iflow.cn/v1', key: '' },
  { id: 'p2', name: '硅基流动 (SiliconFlow)', url: 'https://api.siliconflow.cn/v1', key: '' },
  { id: 'p3', name: 'OpenAI', url: 'https://api.openai.com/v1', key: '' },
  { id: 'p4', name: 'DeepSeek Official', url: 'https://api.deepseek.com', key: '' },
  { id: 'p5', name: 'Groq', url: 'https://api.groq.com/openai/v1', key: '' }
];

// Expanded Models
const DEFAULT_MODELS = [
  { id: 'm1', providerId: 'p1', name: 'DeepSeek V3 (Iflow)', value: 'deepseek-chat' },
  { id: 'm2', providerId: 'p2', name: 'DeepSeek V3 (Silicon)', value: 'deepseek-ai/DeepSeek-V3' },
  { id: 'm3', providerId: 'p2', name: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
  { id: 'm4', providerId: 'p3', name: 'GPT-4o', value: 'gpt-4o' },
  { id: 'm5', providerId: 'p3', name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { id: 'm6', providerId: 'p1', name: 'Qwen Max', value: 'qwen-max' },
  { id: 'm7', providerId: 'p5', name: 'Llama3 70B', value: 'llama3-70b-8192' }
];

// 核心修改：强制要求4种风格的 Prompt
const BASE_SYSTEM_INSTRUCTION = `You are a professional translation engine.
Translate the user's content into the Target Language.

You MUST provide **exactly 4 distinct translation versions** covering these specific styles:

1. **Literal** (直译): Preserves original sentence structure and grammar strictly.
2. **Natural** (意译): Fluent, native-sounding, focuses on meaning over structure.
3. **Colloquial** (口语): Casual, spoken style, suitable for chat/daily life.
4. **Formal** (书面/专业): Polite, business-appropriate, elegant phrasing.

Back Translation Requirement:
Each version MUST include a back_translation to the Source Language for verification.

Strict JSON Output Format:
{
  "data": [
    { "style": "Literal", "translation": "...", "back_translation": "..." },
    { "style": "Natural", "translation": "...", "back_translation": "..." },
    { "style": "Colloquial", "translation": "...", "back_translation": "..." },
    { "style": "Formal", "translation": "...", "back_translation": "..." }
  ]
}

- Do NOT omit any style.
- Do NOT output Markdown code blocks.
- Only output the raw JSON string.`;

// Reply suggestion prompt
const REPLY_SYSTEM_INSTRUCTION = `You are a chat assistant. 
The user translated text from [Source Language] to [Target Language]. 
Generate 4-6 short, natural follow-up replies in [Target Language].
Return ONLY a JSON array of strings: ["Reply1", "Reply2", ...]`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,

  mainModelId: 'm1',
  secondModelId: 'm3', // Default: Enable dual model
  followUpModelId: 'm1',

  ttsConfig: {},
  ttsSpeed: 1.0,

  backgroundOverlay: 0.9,
  chatBackgroundUrl: '',

  useCustomPrompt: false,
  customPromptText: '',

  filterThinking: true,
  enableFollowUp: true,

  lastSourceLang: 'zh-CN',
  lastTargetLang: 'en-US'
};

// ----------------- TTS Engine -----------------
const ttsCache = new Map();
const AVAILABLE_VOICES = {
  'zh-CN': [
    { id: 'zh-CN-XiaoyouNeural', name: '小悠 (女)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男)' },
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女)' },
    { id: 'zh-CN-YunyangNeural', name: '云野 (男)' }
  ],
  'en-US': [
    { id: 'en-US-JennyNeural', name: 'Jenny (F)' },
    { id: 'en-US-GuyNeural', name: 'Guy (M)' },
    { id: 'en-US-AriaNeural', name: 'Aria (F)' }
  ],
  'my-MM': [
    { id: 'my-MM-NilarNeural', name: 'Nilar (F)' },
    { id: 'my-MM-ThihaNeural', name: 'Thiha (M)' }
  ],
  'ja-JP': [{ id: 'ja-JP-NanamiNeural', name: 'Nanami' }, { id: 'ja-JP-KeitaNeural', name: 'Keita' }],
  'ko-KR': [{ id: 'ko-KR-SunHiNeural', name: 'SunHi' }, { id: 'ko-KR-InJoonNeural', name: 'InJoon' }],
  'vi-VN': [{ id: 'vi-VN-HoaiMyNeural', name: 'HoaiMy' }, { id: 'vi-VN-NamMinhNeural', name: 'NamMinh' }],
  'th-TH': [{ id: 'th-TH-PremwadeeNeural', name: 'Premwadee' }, { id: 'th-TH-NiwatNeural', name: 'Niwat' }],
  'ru-RU': [{ id: 'ru-RU-SvetlanaNeural', name: 'Svetlana' }, { id: 'ru-RU-DmitryNeural', name: 'Dmitry' }],
};

const getVoiceForLang = (lang, config) => {
  if (config && config[lang]) return config[lang];
  if (AVAILABLE_VOICES[lang]) return AVAILABLE_VOICES[lang][0].id;
  if (lang === 'lo-LA') return 'lo-LA-KeomanyNeural';
  if (lang === 'km-KH') return 'km-KH-PisethNeural';
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
    // Remove markdown code blocks
    if (cleanRaw.includes('```')) { 
        cleanRaw = cleanRaw.replace(/```json/gi, '').replace(/```/g, '').trim(); 
    }
    const start = cleanRaw.indexOf('{');
    const end = cleanRaw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      cleanRaw = cleanRaw.slice(start, end + 1);
    }
    const json = cleanRaw ? JSON.parse(cleanRaw) : raw;
    data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch (e) {
    return [{ translation: typeof raw === 'string' ? raw : 'Parse Error', back_translation: '', style: 'Error' }];
  }
  const validData = data.filter(x => x && x.translation);
  if (validData.length === 0) return [{ translation: typeof raw === 'string' ? raw : 'No valid translation', back_translation: '', style: 'Raw' }];
  
  // Return all items (Prompt demands 4, so we take all valid ones)
  return validData;
};

const getLangName = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.flag || '';

// ----------------- Components -----------------

// 1. Result Container
const TranslationResultContainer = memo(({ item, targetLang, onPlay }) => {
  const hasDual = !!(item.modelResults && item.modelResults.length > 1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStart = useRef(null);

  const effectiveIndex = hasDual ? currentIndex : 0;
  const currentModelResult = hasDual ? item.modelResults[effectiveIndex] : { data: item.results, modelName: null };
  const currentData = currentModelResult.data || [];
  const currentModelName = currentModelResult.modelName;

  const onTouchStart = (e) => { if (!hasDual) return; touchStart.current = e.targetTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (!hasDual || touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (diff > 50) setCurrentIndex(prev => (prev + 1) % item.modelResults.length);
    if (diff < -50) setCurrentIndex(prev => (prev - 1 + item.modelResults.length) % item.modelResults.length);
    touchStart.current = null;
  };

  return (
    <div className="relative group" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {hasDual && (
        <div className="flex justify-center mb-2 gap-1.5">
          {item.modelResults.map((_, idx) => (
            <button 
                key={idx} 
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === effectiveIndex ? 'w-6 bg-pink-400' : 'w-2 bg-gray-200'}`} 
            />
          ))}
        </div>
      )}
      {currentModelName && (
        <div className="text-[11px] text-center text-gray-400 mb-2 font-mono tracking-wide flex items-center justify-center gap-1">
             <i className="fas fa-microchip text-[9px]"/> {currentModelName}
        </div>
      )}
      <div className="space-y-3">
        {currentData.map((res, i) => (
            <TranslationCard key={i} data={res} onPlay={() => onPlay(res.translation)} index={i} />
        ))}
      </div>
    </div>
  );
});

// 核心修改：卡片增加了 Style 标签显示
const TranslationCard = memo(({ data, onPlay, index }) => {
  const [copied, setCopied] = useState(false);
  
  // 风格标签的样式映射
  const getStyleBadge = (styleName) => {
     if(!styleName) return { label: `Style ${index+1}`, color: 'text-gray-400 bg-gray-50' };
     const s = styleName.toLowerCase();
     if(s.includes('literal') || s.includes('直译')) return { label: '🧩 Literal / 直译', color: 'text-blue-600 bg-blue-50' };
     if(s.includes('natural') || s.includes('意译')) return { label: '✨ Natural / 意译', color: 'text-green-600 bg-green-50' };
     if(s.includes('colloquial') || s.includes('口语')) return { label: '💬 Colloquial / 口语', color: 'text-pink-600 bg-pink-50' };
     if(s.includes('formal') || s.includes('书面')) return { label: '👔 Formal / 书面', color: 'text-purple-600 bg-purple-50' };
     return { label: styleName, color: 'text-gray-600 bg-gray-50' };
  };

  const styleInfo = getStyleBadge(data.style);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(data.translation);
      if (navigator.vibrate) navigator.vibrate(50);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch {}
  };

  return (
    <div onClick={handleClick} className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden group hover:shadow-md">
      {copied && (
        <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10">
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md">Copied</span>
        </div>
      )}
      
      {/* 风格标签 */}
      <div className={`absolute top-0 left-0 px-3 py-1 text-[10px] font-bold rounded-br-xl ${styleInfo.color}`}>
        {styleInfo.label}
      </div>

      <div className="mt-5 text-[17px] leading-relaxed font-medium text-gray-800 break-words select-none whitespace-pre-wrap">{data.translation}</div>
      {!!data.back_translation && (
        <div className="mt-2 text-[12px] text-gray-400 break-words leading-snug whitespace-pre-wrap border-t border-gray-100 pt-2 flex items-start gap-1">
            <span className="opacity-50">↩️</span> {data.back_translation}
        </div>
      )}
      <button onClick={(e) => { e.stopPropagation(); onPlay(); }} className="absolute bottom-2 right-2 p-2 text-gray-300 hover:text-blue-500 opacity-50 hover:opacity-100">
        <i className="fas fa-volume-up" />
      </button>
    </div>
  );
});

// 2. Reply Chips
const ReplyChips = ({ suggestions, onClick }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] text-gray-400 text-center mb-2">Suggested Replies</div>
      <div className="chip-scroll-container no-scrollbar">
        {suggestions.map((text, i) => (
          <button key={i} onClick={() => onClick(text)} className="shrink-0 bg-white border border-pink-100 text-gray-600 px-3 py-1.5 rounded-full text-sm shadow-sm hover:bg-pink-50 active:scale-95 transition-transform">
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};

// 3. Model Selector (Optimized)
const ModelSelectorModal = ({ settings, onClose, onSave }) => {
  const [mode, setMode] = useState('main');
  const [localSettings, setLocalSettings] = useState(settings);

  let currentActiveModelId = null;
  if (mode === 'main') currentActiveModelId = localSettings.mainModelId;
  else if (mode === 'second') currentActiveModelId = localSettings.secondModelId;
  else currentActiveModelId = localSettings.followUpModelId;

  const activeModelObj = settings.models.find(m => m.id === currentActiveModelId);
  const activeProviderId = activeModelObj ? activeModelObj.providerId : null;

  const [selectedProvId, setSelectedProvId] = useState(activeProviderId || settings.providers[0]?.id);

  useEffect(() => {
    let mid = null;
    if (mode === 'main') mid = localSettings.mainModelId;
    else if (mode === 'second') mid = localSettings.secondModelId;
    else mid = localSettings.followUpModelId;

    const m = settings.models.find(x => x.id === mid);
    if (m) setSelectedProvId(m.providerId);
  }, [mode, localSettings]);

  const handleSelect = (modelId) => {
    if (mode === 'main') setLocalSettings(s => ({ ...s, mainModelId: modelId }));
    else if (mode === 'second') setLocalSettings(s => ({ ...s, secondModelId: (s.secondModelId === modelId ? null : modelId) }));
    else setLocalSettings(s => ({ ...s, followUpModelId: modelId }));
  };

  const currentModels = settings.models.filter(m => m.providerId === selectedProvId);

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10005]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden h-[550px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="font-bold text-gray-800">Select Model</div>
            <button onClick={onClose}><i className="fas fa-times text-gray-400"/></button>
          </div>

          <div className="flex p-2 gap-2 border-b border-gray-100 bg-gray-50">
            <button onClick={() => setMode('main')} className={`flex-1 py-2 text-xs font-bold rounded-lg relative flex items-center justify-center gap-1 ${mode==='main'?'bg-white shadow text-pink-600':'text-gray-500'}`}>
                Main
                {localSettings.mainModelId && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"/>}
            </button>
            <button onClick={() => setMode('second')} className={`flex-1 py-2 text-xs font-bold rounded-lg relative flex items-center justify-center gap-1 ${mode==='second'?'bg-white shadow text-purple-600':'text-gray-500'}`}>
                Contrast
                {localSettings.secondModelId && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"/>}
            </button>
            <button onClick={() => setMode('followup')} className={`flex-1 py-2 text-xs font-bold rounded-lg relative flex items-center justify-center gap-1 ${mode==='followup'?'bg-white shadow text-blue-600':'text-gray-500'}`}>
                Suggestions
                {localSettings.followUpModelId && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"/>}
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
             <div className="w-1/3 bg-gray-50 border-r border-gray-100 overflow-y-auto slim-scrollbar p-2">
               {settings.providers.map(p => {
                 const isActiveProvider = (p.id === selectedProvId);
                 const containsActiveModel = (p.id === activeProviderId);
                 return (
                   <button key={p.id} onClick={() => setSelectedProvId(p.id)} className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold mb-1 relative transition-colors ${isActiveProvider ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                     {containsActiveModel && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-pink-500 rounded-r-full"/>}
                     {p.name}
                   </button>
                 );
               })}
             </div>
             
             <div className="flex-1 overflow-y-auto slim-scrollbar p-3">
               {currentModels.map(m => {
                 const isSelected = (m.id === currentActiveModelId);
                 let activeClass = isSelected 
                    ? (mode === 'main' ? 'border-pink-500 bg-pink-50 text-pink-700' : (mode === 'second' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-blue-500 bg-blue-50 text-blue-700'))
                    : 'border-gray-100';

                 return (
                   <button key={m.id} onClick={() => handleSelect(m.id)} className={`w-full text-left px-4 py-3 rounded-xl border mb-2 flex justify-between ${activeClass}`}>
                     <div><div className="font-bold text-sm">{m.name}</div><div className="text-[10px] opacity-60 font-mono">{m.value}</div></div>
                     {isSelected && <i className="fas fa-check" />}
                   </button>
                 );
               })}
             </div>
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end">
             <button onClick={() => { onSave(localSettings); onClose(); }} className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-200">Done</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// 4. Settings Modal
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [data, setData] = useState(settings);
  const [tab, setTab] = useState('common');
  const fileInputRef = useRef(null);

  const updateProvider = (idx, f, v) => { const arr=[...data.providers]; arr[idx]={...arr[idx],[f]:v}; setData({...data,providers:arr}); };
  const addProvider = () => setData(prev=>({...prev,providers:[...prev.providers,{id:nowId(),name:'New Provider',url:'',key:''}]}));
  const delProvider = (id) => { if(data.providers.length>1) setData(prev=>({...prev,providers:prev.providers.filter(p=>p.id!==id)})); };
  const getModelsByProv = (pid) => data.models.filter(m=>m.providerId===pid);
  const addModel = (pid) => setData(prev=>({...prev,models:[...prev.models,{id:nowId(),providerId:pid,name:'New Model',value:''}]}));
  const updateModel = (mid,f,v) => setData(prev=>({...prev,models:prev.models.map(m=>m.id===mid?{...m,[f]:v}:m)}));
  const delModel = (mid) => setData(prev=>({...prev,models:prev.models.filter(m=>m.id!==mid)}));

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if(file) {
      const base64 = await compressImage(file);
      setData({...data, chatBackgroundUrl: base64});
    }
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10002]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="font-bold text-gray-800">Settings</div>
            <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500"><i className="fas fa-times"/></button>
          </div>
          <div className="flex p-2 gap-1 border-b border-gray-100">
            {[{id:'common',label:'General'}, {id:'provider',label:'Providers & Models'}, {id:'voice',label:'Voice'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t.id ? 'bg-pink-50 text-pink-600':'text-gray-500 hover:bg-gray-50'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto slim-scrollbar p-5 bg-white">
            {tab === 'common' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">Filter Chain of Thought</div>
                    <div className="text-xs text-gray-400">Hide &lt;think&gt; tags from DeepSeek/R1 models</div>
                  </div>
                  <input type="checkbox" checked={data.filterThinking} onChange={e => setData({...data, filterThinking: e.target.checked})} className="w-5 h-5 accent-pink-500"/>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">Enable Suggestions</div>
                  </div>
                  <input type="checkbox" checked={data.enableFollowUp} onChange={e => setData({...data, enableFollowUp: e.target.checked})} className="w-5 h-5 accent-pink-500"/>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-bold text-gray-700 mb-2">Background Image</div>
                  <div className="flex items-center gap-3 mb-2">
                     <button onClick={() => fileInputRef.current.click()} className="px-3 py-1.5 bg-white border rounded-lg text-xs shadow-sm">Upload</button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
                     <button onClick={() => setData({...data, chatBackgroundUrl: ''})} className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-lg text-xs">Clear</button>
                  </div>
                  <input type="range" min="0.5" max="1.0" step="0.05" value={data.backgroundOverlay} onChange={e=>setData({...data, backgroundOverlay: parseFloat(e.target.value)})} className="w-full accent-pink-500"/>
                </div>
                 <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-bold text-gray-700">Custom System Prompt</div>
                        <input type="checkbox" checked={data.useCustomPrompt} onChange={e=>setData({...data, useCustomPrompt: e.target.checked})} className="w-4 h-4 accent-pink-500"/>
                    </div>
                    {data.useCustomPrompt && (
                        <textarea className="w-full p-2 text-xs border rounded-lg h-20" placeholder="Extra instructions..." value={data.customPromptText} onChange={e=>setData({...data, customPromptText: e.target.value})}/>
                    )}
                 </div>
              </div>
            )}
            {tab === 'provider' && (
              <div className="space-y-6">
                {data.providers.map((p, idx) => (
                  <div key={p.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                       <input className="font-bold text-gray-800 bg-transparent outline-none" value={p.name} onChange={e=>updateProvider(idx,'name',e.target.value)} />
                       <button onClick={()=>delProvider(p.id)} className="text-red-500 text-xs">Delete</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input className="bg-white text-xs p-2 rounded border" placeholder="URL" value={p.url} onChange={e=>updateProvider(idx,'url',e.target.value)} />
                      <input className="bg-white text-xs p-2 rounded border" type="password" placeholder="Key" value={p.key} onChange={e=>updateProvider(idx,'key',e.target.value)} />
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-gray-100">
                      <div className="flex justify-between mb-2"><span className="text-[10px] font-bold text-gray-400">Models</span><button onClick={()=>addModel(p.id)} className="text-[10px] bg-blue-50 text-blue-600 px-2 rounded">+ Add</button></div>
                      {getModelsByProv(p.id).map(m => (
                        <div key={m.id} className="flex gap-2 items-center mb-1">
                          <input className="flex-1 text-[11px] border rounded p-1" placeholder="Name" value={m.name} onChange={e=>updateModel(m.id,'name',e.target.value)} />
                          <input className="flex-1 text-[11px] border rounded p-1 font-mono" placeholder="Value (ID)" value={m.value} onChange={e=>updateModel(m.id,'value',e.target.value)} />
                          <button onClick={()=>delModel(m.id)} className="text-gray-300 hover:text-red-500"><i className="fas fa-times"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={addProvider} className="w-full py-2 border border-dashed rounded-xl text-gray-500 text-sm hover:bg-gray-50">+ Add Provider</button>
              </div>
            )}
            {tab === 'voice' && (
              <div className="space-y-4">
                 <div className="text-sm font-bold text-gray-700 px-1">Language Specific Voices</div>
                 {SUPPORTED_LANGUAGES.map(lang => (
                   AVAILABLE_VOICES[lang.code] && (
                     <div key={lang.code} className="flex items-center justify-between border-b border-gray-50 py-2">
                       <div className="flex items-center gap-2 text-sm"><span>{lang.flag}</span><span>{lang.name}</span></div>
                       <select className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 max-w-[140px]" value={(data.ttsConfig||{})[lang.code]||''} onChange={(e)=>{
                         const cfg={...(data.ttsConfig||{})}; cfg[lang.code]=e.target.value; setData({...data,ttsConfig:cfg});
                       }}>
                         <option value="">Default</option>
                         {AVAILABLE_VOICES[lang.code].map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                       </select>
                     </div>
                   )
                 ))}
                 <div className="p-3 bg-gray-50 rounded-xl mt-4">
                    <div className="text-sm font-bold text-gray-700">TTS Speed: {data.ttsSpeed}x</div>
                    <input type="range" min="0.5" max="2.0" step="0.1" className="w-full accent-pink-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" value={data.ttsSpeed} onChange={e=>setData({...data,ttsSpeed:parseFloat(e.target.value)})}/>
                 </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
             <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gray-100 text-sm font-bold text-gray-600">Cancel</button>
             <button onClick={()=>{onSave(data);onClose();}} className="px-5 py-2 rounded-xl bg-pink-500 text-sm font-bold text-white shadow-lg shadow-pink-200">Save</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// 5. Sidebar
const Sidebar = ({ isOpen, onClose, currentSessionId, onSelectSession, onNewSession }) => {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { if (isOpen) loadSessions(); }, [isOpen]);

  const loadSessions = async () => {
    const list = await db.getSessions();
    list.sort((a, b) => {
      if ((b.isPinned || 0) !== (a.isPinned || 0)) return (b.isPinned || 0) - (a.isPinned || 0);
      return b.updatedAt - a.updatedAt;
    });
    setSessions(list);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
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
                <span className="font-bold text-lg text-gray-800">History</span>
                <button onClick={onClose}><i className="fas fa-times text-gray-400"/></button>
              </div>
              <div className="p-3">
                <button onClick={() => { onNewSession(); onClose(); }} className="w-full py-2.5 bg-pink-500 text-white rounded-xl font-bold shadow-md shadow-pink-200 flex items-center justify-center gap-2 mb-3">
                  <i className="fas fa-plus"/> New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto slim-scrollbar p-2">
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
                          <button onClick={(e)=>handleTogglePin(e, sess)} className={`${sess.isPinned ? 'text-pink-500':'text-gray-300 hover:text-gray-500'}`}><i className="fas fa-thumbtack text-xs"/></button>
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
  const [targetLang, setTargetLang] = useState('my-MM');

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [inputImages, setInputImages] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const scrollRef = useRef(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showTgtPicker, setShowTgtPicker] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    const s = safeLocalStorageGet('ai886_settings');
    if (s) {
      const parsed = JSON.parse(s);
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      if (parsed.lastSourceLang) setSourceLang(parsed.lastSourceLang);
      if (parsed.lastTargetLang) setTargetLang(parsed.lastTargetLang);
    }
    (async () => {
      const sessList = await db.getSessions();
      if (sessList.length > 0) {
        sessList.sort((a,b)=>b.updatedAt-a.updatedAt);
        loadSession(sessList[0].id);
      } else {
        createNewSession();
      }
    })();
  }, []);

  useEffect(() => {
    const toSave = { ...settings, lastSourceLang: sourceLang, lastTargetLang: targetLang };
    safeLocalStorageSet('ai886_settings', JSON.stringify(toSave));
  }, [settings, sourceLang, targetLang]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const scrollToResult = () => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

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

  const fetchAi = async (messages, modelId, jsonMode = true) => {
    const pm = getProviderAndModel(modelId);
    if (!pm) throw new Error(`Model ${modelId} not configured.`);
    if (!pm.provider.key) throw new Error(`${pm.provider.name} missing API Key.`);

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
    if (!data.choices?.length) throw new Error('API returned no choices.');

    let content = data.choices[0].message.content;

    if (settings.filterThinking) {
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    return { content, modelName: pm.model.name };
  };

  const handleTranslate = async (textOverride = null) => {
    let text = (textOverride || inputVal).trim();
    if (!text && inputImages.length === 0) return;

    if (!currentSessionId) await createNewSession();

    let currentSource = sourceLang;
    let currentTarget = targetLang;

    // Logic to detect language and swap if needed
    if (text) {
        const detected = detectScript(text);
        if (detected && detected !== currentSource && detected === currentTarget) {
            const temp = currentSource;
            currentSource = currentTarget;
            currentTarget = temp;
            setSourceLang(currentSource);
            setTargetLang(currentTarget);
        } else if (detected && detected !== currentSource && detected !== 'en-US') {
            setSourceLang(detected);
            currentSource = detected;
        }
    }

    setIsLoading(true);
    setSuggestions([]); 

    const userMsg = { 
        id: nowId(), 
        sessionId: currentSessionId, 
        role: 'user', 
        text, 
        images: inputImages, 
        ts: Date.now(), 
        results: [] 
    };
    setHistory(prev => [...prev, userMsg]);
    setInputVal('');
    setInputImages([]);
    scrollToResult();

    db.addMessage(userMsg);
    if (history.length === 0) db.updateSession(currentSessionId, { title: text ? text.slice(0, 20) : '[Image]' });
    else db.updateSession(currentSessionId, {}); 

    // Build Prompt with English instructions
    let sysPrompt = BASE_SYSTEM_INSTRUCTION;
    if (settings.useCustomPrompt && settings.customPromptText) {
      sysPrompt += `\nAdditional Rules: ${settings.customPromptText}`;
    }
    sysPrompt += `\nIMPORTANT: The back_translation MUST be in: ${getLangName(currentSource)}`;

    const userPromptText = `Source Language: ${getLangName(currentSource)}\nTarget Language: ${getLangName(currentTarget)}\nInput Text:\n${text || '[Image Content]'}`;

    let finalUserMessage;
    if (inputImages.length > 0) {
        const content = [{ type: "text", text: userPromptText }];
        inputImages.forEach(img => {
            content.push({ type: "image_url", image_url: { url: img } });
        });
        finalUserMessage = { role: 'user', content };
    } else {
        finalUserMessage = { role: 'user', content: userPromptText };
    }

    const messages = [
      { role: 'system', content: sysPrompt },
      finalUserMessage
    ];

    try {
      let dictHit = null;
      // Local dictionary lookup (if function exists)
      if (inputImages.length === 0 && text && typeof loadCheatDict !== 'undefined') {
         try {
            const dict = await loadCheatDict(currentSource);
            dictHit = matchCheatLoose(dict, text, currentTarget);
         } catch(e) { console.warn('Dict error', e); }
      }
      
      let aiMsg = { id: nowId(), sessionId: currentSessionId, role: 'ai', results: [], modelResults: [], from: 'ai', ts: Date.now() };

      if (dictHit) {
        aiMsg.results = normalizeTranslations(dictHit);
        aiMsg.from = 'dict';
      } else {
        const tasks = [];
        // Primary Model
        tasks.push(fetchAi(messages, settings.mainModelId, true)
            .then(r => ({ ...r, isMain: true }))
            .catch(e => ({ error: e.message, isMain: true, modelName: 'Main Model' }))
        );

        // Secondary Model (if selected and different)
        if (settings.secondModelId && settings.secondModelId !== settings.mainModelId) {
           tasks.push(fetchAi(messages, settings.secondModelId, true)
               .then(r => ({ ...r, isMain: false }))
               .catch(e => ({ error: e.message, isMain: false, modelName: 'Contrast Model' }))
           );
        }

        const responses = await Promise.all(tasks);
        
        const modelResults = responses.map(res => {
            if (res.error) {
                return { 
                    modelName: res.modelName + ' (Failed)', 
                    data: [{ translation: `Error: ${res.error}`, back_translation: '', style: 'Error' }] 
                };
            }
            return { modelName: res.modelName, data: normalizeTranslations(res.content) };
        });

        aiMsg.modelResults = modelResults;
        aiMsg.results = modelResults[0].data; // Fallback for single view
      }

      setHistory(prev => [...prev, aiMsg]);
      await db.addMessage(aiMsg);
      scrollToResult();
      
      if (settings.enableFollowUp && text) {
          fetchSuggestions(text, currentSource, currentTarget);
      }

    } catch (e) {
      const errorMsg = { id: nowId(), sessionId: currentSessionId, role: 'error', text: e.message || 'Unknown Error', ts: Date.now(), results: [] };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async (originalText, src, tgt) => {
    setIsSuggesting(true);
    try {
      const prompt = `Source Text (${getLangName(src)}): ${originalText}\nTranslated to: ${getLangName(tgt)}`;
      const { content } = await fetchAi([
        { role: 'system', content: REPLY_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ], settings.followUpModelId, true);
      const list = JSON.parse(content);
      if (Array.isArray(list)) setSuggestions(list);
    } catch (e) {
      console.log('Suggestion failed:', e);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImages = [];
    for (const file of files) {
        try {
            const base64 = await compressImage(file);
            newImages.push(base64);
        } catch (err) { console.error(err); }
    }
    setInputImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const stopAndSend = (isManual = false) => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch(e) { console.error(e); }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Browser does not support Speech Recognition');
      return;
    }

    if (isRecording) {
      stopAndSend(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognitionRef.current = recognition;
    setInputVal('');
    setIsRecording(true);
    if (navigator.vibrate) navigator.vibrate(50);

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      setInputVal(transcript);

      const isFinal = results.some(r => r.isFinal);
      if (isFinal && transcript.trim()) {
        try { recognition.stop(); } catch {}
        setIsRecording(false);
        handleTranslate(transcript);
        setInputVal('');
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const swapLangs = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#FFF0F5] relative text-gray-800">
      <GlobalStyles />
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

      {/* Rec Status */}
      <Transition show={isRecording} as={Fragment} enter="transition-opacity duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed top-24 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="bg-pink-500/90 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-pulse pointer-events-auto backdrop-blur-sm">
            <i className="fas fa-microphone text-xl animate-bounce"/>
            <span className="font-bold">Listening ({getLangName(sourceLang)})...</span>
          </div>
        </div>
      </Transition>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-4 pt-4 pb-32 scroll-smooth">
        <div className="w-full max-w-[600px] mx-auto min-h-full flex flex-col justify-end">
           {history.length === 0 && !isLoading && (
             <div className="text-center text-gray-400 mb-20 opacity-60">
                <div className="text-4xl mb-2">👋</div>
                <div className="text-sm">4-Style Translation & Dual Model</div>
             </div>
           )}

           {history.map((item, idx) => {
             if (item.role === 'user') {
               return (
                 <div key={item.id} className="flex justify-end mb-6 opacity-80 origin-right">
                   <div className="flex flex-col items-end max-w-[85%]">
                       {item.images && item.images.length > 0 && (
                           <div className="flex gap-1 mb-2 flex-wrap justify-end">
                               {item.images.map((img, i) => (
                                   <img key={i} src={img} className="w-24 h-24 object-cover rounded-lg border border-gray-200" alt="input" />
                               ))}
                           </div>
                       )}
                       {item.image && !item.images && <img src={item.image} className="w-32 h-auto rounded-lg mb-2 border border-gray-200" alt="input" />}
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
                  {item.modelResults && item.modelResults.length > 1 && (
                      <div className="text-center text-[9px] text-gray-300 mt-1">Multi-Model Comparison</div>
                  )}
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
           {isLoading && <div className="flex justify-center mb-8"><div className="bg-white/80 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-sm text-pink-500 animate-pulse"><i className="fas fa-spinner fa-spin" /><span>Translating 4 Styles...</span></div></div>}
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
            >
              <i className="fas fa-robot" />
              {settings.secondModelId && <span className="absolute top-0 right-0 w-2 h-2 bg-purple-500 rounded-full"/>}
            </button>
          </div>

          <div className={`relative flex items-end gap-2 bg-white border rounded-[28px] p-1.5 shadow-sm transition-all duration-200 ${isRecording ? 'border-pink-300 ring-2 ring-pink-100' : 'border-pink-100'}`}>
            {/* Camera/Image Button */}
            <Menu as="div" className="relative">
                <Menu.Button className="w-10 h-11 flex items-center justify-center text-gray-400 hover:text-pink-500">
                    <i className="fas fa-camera" />
                </Menu.Button>
                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Menu.Items className="absolute bottom-full left-0 mb-2 w-32 origin-bottom-left rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
                        <div className="p-1">
                            <Menu.Item>
                                {({ active }) => (
                                    <button onClick={() => cameraInputRef.current?.click()} className={`${active ? 'bg-pink-50 text-pink-600' : 'text-gray-700'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                        <i className="fas fa-camera mr-2"/> Camera
                                    </button>
                                )}
                            </Menu.Item>
                            <Menu.Item>
                                {({ active }) => (
                                    <button onClick={() => fileInputRef.current?.click()} className={`${active ? 'bg-pink-50 text-pink-600' : 'text-gray-700'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                        <i className="fas fa-image mr-2"/> Gallery
                                    </button>
                                )}
                            </Menu.Item>
                        </div>
                    </Menu.Items>
                </Transition>
            </Menu>
            
            <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />

            <div className="flex-1 flex flex-col justify-center min-h-[44px]">
                {inputImages.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mb-1 ml-2 py-1 no-scrollbar">
                        {inputImages.map((img, idx) => (
                            <div key={idx} className="relative shrink-0">
                                <img src={img} alt="preview" className="h-12 w-12 object-cover rounded border border-gray-200" />
                                <button onClick={() => setInputImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"><i className="fas fa-times"/></button>
                            </div>
                        ))}
                    </div>
                )}
                <textarea
                  className="w-full bg-transparent border-none outline-none resize-none px-2 py-2 max-h-32 text-[16px] leading-6 no-scrollbar placeholder-gray-400 text-gray-800"
                  placeholder={isRecording ? "" : "Type something..."}
                  rows={1}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate(); } }}
                />
            </div>
            
            <div className="w-11 h-11 flex items-center justify-center shrink-0 mb-0.5">
               {isRecording ? (
                 <button onClick={() => stopAndSend(true)} className="w-10 h-10 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center animate-pulse">
                   <i className="fas fa-stop" />
                 </button>
               ) : ((inputVal.trim().length > 0 || inputImages.length > 0) ? (
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
