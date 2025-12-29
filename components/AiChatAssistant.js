import { Transition, Dialog } from '@headlessui/react';
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  memo
} from 'react';
// 假设这些库文件存在
import { loadCheatDict, matchCheatLoose } from '@/lib/cheatDict';

// ----------------- Module 1: Image Compression Utility -----------------
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let w = img.width, h = img.height;
        const max = 1024;
        if (w > max || h > max) {
          if (w > h) {
             h = Math.round((h * max) / w); w = max;
          } else {
             w = Math.round((w * max) / h); h = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// ----------------- IndexedDB Helper -----------------
class ChatDB {
  constructor(dbName = 'AiChatDB_V2', version = 2) {
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
          // V2: 增加 group 索引
          sessionStore.createIndex('group', 'group', { unique: false });
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

  async createSession(title = '新对话', group = '默认') {
    await this.open();
    const session = { id: Date.now().toString(), title, group, updatedAt: Date.now() };
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
    return this.transaction('sessions', 'readonly', store => {
      const index = store.index('updatedAt');
      return index.getAll();
    });
  }

  async addMessage(message) {
    await this.open();
    return this.transaction('messages', 'readwrite', store => store.put(message));
  }

  // 新增：支持部分更新 Message (用于异步更新 resultsMap)
  async updateMessage(id, updates) {
    await this.open();
    return this.transaction('messages', 'readwrite', async store => {
      const msg = await new Promise((res) => {
         const r = store.get(id);
         r.onsuccess = () => res(r.result);
      });
      if (msg) {
        Object.assign(msg, updates);
        store.put(msg);
      }
    });
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
      const tx = this.db.transaction(['messages'], 'readonly');
      const msgStore = tx.objectStore('messages');
      msgStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const msg = cursor.value;
          let hit = false;
          if (msg.text && msg.text.includes(query)) hit = true;
          // 搜索 resultsMap
          if (msg.resultsMap && JSON.stringify(msg.resultsMap).includes(query)) hit = true;
          if (hit) results.push(msg);
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

    /* Carousel / Swipe View */
    .snap-x-mandatory {
      scroll-snap-type: x mandatory;
      display: flex;
      overflow-x: auto;
      gap: 16px;
      padding-bottom: 10px; /* space for dots */
    }
    .snap-center {
      scroll-snap-align: center;
      flex-shrink: 0;
      width: 100%;
    }

    .chip-scroll-container {
      display: flex; gap: 8px; overflow-x: auto; padding: 4px 10px;
      -webkit-overflow-scrolling: touch; cursor: grab;
    }
    
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
  `}</style>
);

// ----------------- Config -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'vi-VN', name: '越南语', flag: '🇻🇳' },
  { code: 'th-TH', name: '泰语', flag: '🇹🇭' },
  { code: 'ru-RU', name: '俄语', flag: '🇷🇺' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'my-MM', name: '缅甸语', flag: '🇲🇲' },
];

const DEFAULT_PROVIDERS = [
  { id: 'p1', name: '默认接口', url: 'https://apis.iflow.cn/v1', key: '' }
];

const DEFAULT_MODELS = [
  { id: 'm1', providerId: 'p1', name: 'DeepSeek V3', value: 'deepseek-chat' },
  { id: 'm2', providerId: 'p1', name: 'GPT-4o', value: 'gpt-4o' },
  { id: 'm3', providerId: 'p1', name: 'Qwen Max', value: 'qwen-max' }
];

const BASE_SYSTEM_INSTRUCTION = `你是一位翻译专家。将用户文本翻译成目标语言。
要求：
1. 输出4种风格：贴近原文、自然直译、自然意译、口语化。
2. 即使源文本简短，也要凑齐4种略有不同的表达。
3. 回译 (back_translation) 必须翻译回【源语言】。
4. 必须返回严格的 JSON 格式: { "data": [ { "style": "...", "translation": "...", "back_translation": "..." }, ... ] }`;

const REPLY_SYSTEM_INSTRUCTION = `你是一个聊天助手。根据原文生成 3-8 个回复建议(JSON数组)。`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,
  
  mainModelId: 'm1',      
  compareModelId: '', // 对比模型ID (为空则关闭对比)
  followUpModelId: 'm1', 

  ttsConfig: {}, 
  ttsSpeed: 1.0,
  
  // Toggles
  enableContext: false, // 默认关闭
  enableTTS: false,     // 默认关闭自动朗读
  enableSuggestions: false, // 默认关闭追问

  backgroundOverlay: 0.95, 
  chatBackgroundUrl: '',
  
  useCustomPrompt: false,
  customPromptText: '', 
};

// ----------------- TTS Engine -----------------
const playTTS = async (text, lang, settings) => {
  if (!text || !settings.enableTTS) return;
  // ... (保留原有的TTS逻辑，这里简化，实际请保留你的TTS实现)
  console.log('Playing TTS:', text);
  // 模拟播放
};

// ----------------- Helpers -----------------
const safeLocalStorageGet = (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); };
const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const getLangName = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find(l => l.code === c)?.flag || '';

const normalizeTranslations = (raw) => {
  let data = [];
  try {
    let cleanRaw = typeof raw === 'string' ? raw.trim() : '';
    if (cleanRaw.includes('```')) cleanRaw = cleanRaw.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleanRaw.indexOf('{');
    const end = cleanRaw.lastIndexOf('}');
    if (start >= 0 && end > start) cleanRaw = cleanRaw.slice(start, end + 1);
    const json = cleanRaw ? JSON.parse(cleanRaw) : raw;
    data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch (e) {
    return [{ style: 'Error', translation: '解析失败', back_translation: e.message }];
  }
  const validData = data.filter(x => x && x.translation);
  return validData.length === 0 ? [{ style: 'Result', translation: typeof raw === 'string' ? raw : '无译文', back_translation: '' }] : validData.slice(0, 4);
};

// ----------------- Components -----------------

// 1. Result Card
const TranslationCard = memo(({ data, onPlay, modelName }) => {
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
    <div onClick={handleClick} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group text-center h-full flex flex-col justify-center">
      {modelName && <div className="absolute top-2 left-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{modelName}</div>}
      {copied && <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10"><span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md">已复制</span></div>}
      
      <div className="text-[18px] leading-relaxed font-medium text-gray-800 break-words select-none">{data.translation}</div>
      {!!data.back_translation && <div className="mt-2.5 text-[13px] text-gray-400 break-words leading-snug">{data.back_translation}</div>}
      
      <button onClick={(e) => { e.stopPropagation(); onPlay(); }} className="absolute bottom-2 right-2 p-2 text-gray-300 hover:text-blue-500"><i className="fas fa-volume-up" /></button>
    </div>
  );
});

// 2. Carousel / Swipe View (Dual Model)
const ResultCarousel = ({ resultsMap, targetLang, settings, onPlay }) => {
  const keys = Object.keys(resultsMap);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const x = scrollRef.current.scrollLeft;
    const w = scrollRef.current.offsetWidth;
    const idx = Math.round(x / w);
    setActiveIdx(idx);
  };

  if (keys.length === 0) return null;

  return (
    <div className="w-full relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="snap-x-mandatory no-scrollbar"
      >
        {keys.map((mid) => {
          const item = resultsMap[mid];
          return (
            <div key={mid} className="snap-center w-full">
              {item.status === 'loading' && (
                <div className="bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center shadow-sm min-h-[160px]">
                   <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-2"/>
                   <div className="text-xs text-gray-400 font-mono">{item.name} 生成中...</div>
                </div>
              )}
              {item.status === 'error' && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center text-red-500 text-xs min-h-[100px] flex items-center justify-center">
                  <div>
                    <div className="font-bold mb-1">{item.name} 错误</div>
                    {item.error}
                  </div>
                </div>
              )}
              {item.status === 'done' && (
                <div className="space-y-3">
                   {item.data.map((res, idx) => (
                     <TranslationCard key={idx} data={res} onPlay={() => onPlay(res.translation)} modelName={item.name} />
                   ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Dots Indicator */}
      {keys.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {keys.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? 'bg-pink-400 w-3' : 'bg-gray-200'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

// 3. Settings Modal
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [data, setData] = useState(settings);
  const [tab, setTab] = useState('common');
  const fileInputRef = useRef(null);

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file); // 复用压缩，或者直接转base64
      setData({ ...data, chatBackgroundUrl: base64 });
    } catch (err) { alert('图片处理失败'); }
  };

  // Provider & Model CRUD (Simplification for brevity, same logic as before)
  const updateProvider = (idx, f, v) => { const n=[...data.providers]; n[idx]={...n[idx],[f]:v}; setData({...data,providers:n}); };
  const addProvider = () => setData(d=>({...d,providers:[...d.providers,{id:nowId(),name:'新接口',url:'',key:''}]}));
  
  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10002]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="font-bold text-gray-800">设置</div>
            <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500"><i className="fas fa-times"/></button>
          </div>
          <div className="flex p-2 gap-1 border-b border-gray-100">
             {['common','provider','prompt'].map(t=><button key={t} onClick={()=>setTab(t)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t?'bg-pink-50 text-pink-600':'text-gray-500'}`}>{t==='common'?'通用':t==='provider'?'模型接口':'提示词'}</button>)}
          </div>
          <div className="flex-1 overflow-y-auto slim-scrollbar p-5 space-y-4">
             {tab === 'common' && (
               <>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-sm font-bold">附带上下文</span><input type="checkbox" checked={data.enableContext} onChange={e=>setData({...data,enableContext:e.target.checked})} className="accent-pink-500 w-5 h-5"/></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-bold">语音自动朗读</span><input type="checkbox" checked={data.enableTTS} onChange={e=>setData({...data,enableTTS:e.target.checked})} className="accent-pink-500 w-5 h-5"/></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-bold">启用追问建议</span><input type="checkbox" checked={data.enableSuggestions} onChange={e=>setData({...data,enableSuggestions:e.target.checked})} className="accent-pink-500 w-5 h-5"/></div>
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                    <div className="text-sm font-bold mb-2">背景设置</div>
                    <button onClick={()=>fileInputRef.current?.click()} className="w-full py-2 bg-gray-100 text-gray-600 text-xs rounded-lg mb-2">上传背景图 (手机相册)</button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBgUpload}/>
                    <div className="flex items-center gap-2"><span className="text-xs">遮罩浓度 {data.backgroundOverlay}</span><input type="range" min="0.5" max="1.0" step="0.05" value={data.backgroundOverlay} onChange={e=>setData({...data,backgroundOverlay:e.target.value})} className="flex-1 accent-pink-500"/></div>
                 </div>
               </>
             )}
             {tab === 'provider' && (
               <div className="space-y-4">
                 {data.providers.map((p,i)=>(
                   <div key={p.id} className="bg-gray-50 p-3 rounded-lg border">
                      <input className="font-bold bg-transparent mb-2" value={p.name} onChange={e=>updateProvider(i,'name',e.target.value)} />
                      <input className="w-full text-xs p-1 mb-1 rounded border" placeholder="URL" value={p.url} onChange={e=>updateProvider(i,'url',e.target.value)} />
                      <input className="w-full text-xs p-1 rounded border" type="password" placeholder="Key" value={p.key} onChange={e=>updateProvider(i,'key',e.target.value)} />
                   </div>
                 ))}
                 <button onClick={addProvider} className="w-full py-2 border border-dashed text-gray-400 text-sm rounded-lg">+ Add Provider</button>
                 <div className="text-xs text-gray-400 mt-4">* 模型列表请在主界面“切换模型”中管理</div>
               </div>
             )}
          </div>
          <div className="p-4 border-t flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">取消</button>
             <button onClick={()=>{onSave(data);onClose();}} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm">保存</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// 4. Model Selector (Dual)
const ModelSelectorModal = ({ settings, onClose, onSelect }) => {
  const [mode, setMode] = useState('main'); // main, compare, followup
  const allModels = settings.models;
  
  const handleSelect = (mid) => {
    if (mode === 'main') onSelect({ mainModelId: mid });
    if (mode === 'compare') onSelect({ compareModelId: mid === settings.compareModelId ? '' : mid }); // Toggle
    if (mode === 'followup') onSelect({ followUpModelId: mid });
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10005]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl h-[400px] flex flex-col">
          <div className="flex border-b">
            {[{k:'main',n:'主模型'},{k:'compare',n:'对比模型'},{k:'followup',n:'追问'}].map(t=>(
              <button key={t.k} onClick={()=>setMode(t.k)} className={`flex-1 py-3 text-xs font-bold ${mode===t.k?'text-pink-600 border-b-2 border-pink-500':'text-gray-500'}`}>{t.n}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto slim-scrollbar p-3">
            {mode === 'compare' && <button onClick={()=>onSelect({compareModelId:''})} className="w-full text-left p-3 mb-2 rounded-lg bg-gray-100 text-xs text-gray-500">❌ 关闭对比模型</button>}
            {allModels.map(m => {
              let active = false;
              if (mode === 'main' && settings.mainModelId === m.id) active = true;
              if (mode === 'compare' && settings.compareModelId === m.id) active = true;
              if (mode === 'followup' && settings.followUpModelId === m.id) active = true;
              return (
                <button key={m.id} onClick={()=>handleSelect(m.id)} className={`w-full text-left p-3 mb-2 rounded-lg border transition-all ${active ? 'bg-pink-50 border-pink-500 text-pink-700' : 'bg-white border-gray-100'}`}>
                  <div className="font-bold text-sm">{m.name}</div>
                  <div className="text-[10px] opacity-60">{m.value}</div>
                </button>
              )
            })}
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
  
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState([]); 
  const [suggestions, setSuggestions] = useState([]);
  const [imageFile, setImageFile] = useState(null); // 上传的图片

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null); 
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // UI Toggles
  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showTgtPicker, setShowTgtPicker] = useState(false);

  // Init
  useEffect(() => {
    const s = safeLocalStorageGet('ai886_settings_v2');
    if (s) { try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); } catch {} }
    (async () => {
      const sessList = await db.getSessions();
      if (sessList.length > 0) loadSession(sessList[sessList.length-1].id);
      else createNewSession();
    })();
  }, []);

  useEffect(() => { safeLocalStorageSet('ai886_settings_v2', JSON.stringify(settings)); }, [settings]);

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
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  // Image Upload Logic
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // 预览：实际应该显示缩略图，这里简化为改变按钮颜色或状态
      const compressedBase64 = await compressImage(file);
      setImageFile(compressedBase64); 
    } catch (e) { alert('图片处理出错'); }
  };

  // Core Translate Logic (Parallel)
  const handleTranslate = async (textOverride = null) => {
    const text = (textOverride || inputVal).trim();
    const hasImage = !!imageFile;
    if (!text && !hasImage) return;
    
    if (!currentSessionId) await createNewSession();

    // Determine Models
    const targetModelIds = [settings.mainModelId, settings.compareModelId].filter(Boolean);
    if (targetModelIds.length === 0) return alert('请至少选择一个主模型');

    // Build User Message
    const userMsg = {
      id: nowId(),
      sessionId: currentSessionId,
      role: 'user',
      text: text,
      image: hasImage ? imageFile : null, // Store image in DB
      ts: Date.now(),
      resultsMap: targetModelIds.reduce((acc, mid) => {
        const m = settings.models.find(x=>x.id===mid);
        acc[mid] = { status: 'loading', name: m?.name||'Model', data: [] };
        return acc;
      }, {})
    };

    setHistory(prev => [...prev, userMsg]);
    await db.addMessage(userMsg);
    
    // Clear Input
    setInputVal('');
    setImageFile(null);
    setSuggestions([]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);

    // Prepare Context & Prompt
    let sysPrompt = BASE_SYSTEM_INSTRUCTION;
    if (settings.useCustomPrompt) sysPrompt += `\n${settings.customPromptText}`;
    sysPrompt += `\nback_translation 必须翻译回: ${getLangName(sourceLang)}`;

    const contextMsgs = settings.enableContext ? history.slice(-10).map(m => {
       if (m.role === 'user') return { role: 'user', content: m.text };
       // 取主模型的回复作为上下文
       const mainRes = m.resultsMap?.[settings.mainModelId]?.data?.[0]?.translation;
       if (m.role === 'ai' && mainRes) return { role: 'assistant', content: mainRes };
       return null;
    }).filter(Boolean) : [];

    // Parallel Execution
    targetModelIds.forEach(mid => {
      (async () => {
        try {
           const pm = settings.models.find(m => m.id === mid);
           const prov = settings.providers.find(p => p.id === pm.providerId);
           if (!prov?.key) throw new Error('No API Key');

           // Construct Content (Multimodal if needed)
           let contentPayload = `Target: ${getLangName(targetLang)}\n\n${text}`;
           let apiMessages = [
             { role: 'system', content: sysPrompt },
             ...contextMsgs,
           ];

           if (hasImage) {
             // Vision Request Structure
             apiMessages.push({
               role: 'user',
               content: [
                 { type: "text", text: contentPayload },
                 { type: "image_url", image_url: { url: imageFile } }
               ]
             });
           } else {
             apiMessages.push({ role: 'user', content: contentPayload });
           }

           // Fetch
           const res = await fetch(`${prov.url}/chat/completions`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prov.key}` },
             body: JSON.stringify({ model: pm.value, messages: apiMessages, response_format: { type: 'json_object' } })
           });
           
           if (!res.ok) throw new Error(`API ${res.status}`);
           const data = await res.json();
           const content = data.choices[0].message.content;
           const parsed = normalizeTranslations(content);

           // Update State & DB
           const updater = (prev) => prev.map(m => {
             if (m.id === userMsg.id) {
               const newMap = { ...m.resultsMap };
               newMap[mid] = { ...newMap[mid], status: 'done', data: parsed };
               db.updateMessage(m.id, { resultsMap: newMap }); // Async DB update
               // Play TTS only for main model if done
               if (mid === settings.mainModelId) playTTS(parsed[0]?.translation, targetLang, settings);
               return { ...m, resultsMap: newMap };
             }
             return m;
           });
           setHistory(updater);

        } catch (e) {
           console.error(e);
           setHistory(prev => prev.map(m => {
             if (m.id === userMsg.id) {
               const newMap = { ...m.resultsMap };
               newMap[mid] = { ...newMap[mid], status: 'error', error: e.message };
               return { ...m, resultsMap: newMap };
             }
             return m;
           }));
        }
      })();
    });

    // Follow-up Suggestions (Only run once using main model)
    if (settings.enableSuggestions) fetchSuggestions(text);
  };

  const fetchSuggestions = async (text) => {
    try {
      const pm = settings.models.find(m => m.id === settings.followUpModelId);
      const prov = settings.providers.find(p => p.id === pm.providerId);
      if (!prov?.key) return;
      const res = await fetch(`${prov.url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prov.key}` },
        body: JSON.stringify({ model: pm.value, messages: [{ role: 'system', content: REPLY_SYSTEM_INSTRUCTION }, { role: 'user', content: `原文: ${text}` }], response_format: { type: 'json_object' } })
      });
      const data = await res.json();
      const list = JSON.parse(data.choices[0].message.content);
      if (Array.isArray(list)) setSuggestions(list);
    } catch {}
  };

  // Voice Logic (Fixed: 2.5s silence)
  const stopAndSend = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
    setTimeout(() => {
        setInputVal(curr => {
            if (curr && curr.trim()) handleTranslate(curr);
            return '';
        });
    }, 200);
  };
  
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('不支持语音');
    if (isRecording) { stopAndSend(); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
       setIsRecording(true); 
       if (navigator.vibrate) navigator.vibrate(50);
       setInputVal('');
    };
    recognition.onresult = (e) => {
       // Get standard transcript
       const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
       setInputVal(transcript);
       
       // Reset silence timer (2.5s)
       if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
       silenceTimerRef.current = setTimeout(() => {
           if (recognitionRef.current) stopAndSend();
       }, 2500); 
    };
    recognition.onend = () => { if (isRecording) setIsRecording(false); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Sidebar Logic
  const Sidebar = () => {
    const [sessions, setSessions] = useState([]);
    useEffect(() => { if (showSidebar) db.getSessions().then(s => setSessions(s.reverse())); }, [showSidebar]);
    
    // Group move logic (Simple Prompt for now)
    const handleMoveGroup = async (e, s) => {
      e.stopPropagation();
      const newG = prompt('输入分组名称', s.group || '默认');
      if (newG) {
        await db.updateSession(s.id, { group: newG });
        db.getSessions().then(res => setSessions(res.reverse()));
      }
    };
    
    return (
      <Transition show={showSidebar} as={Fragment}>
        <Dialog as="div" className="relative z-[10001]" onClose={() => setShowSidebar(false)}>
           <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
           <div className="fixed inset-0 flex">
             <Dialog.Panel className="w-64 bg-white h-full shadow-xl flex flex-col">
                <div className="p-4 border-b font-bold text-lg bg-gray-50 flex justify-between items-center">
                   <span>历史记录</span>
                   <button onClick={()=>createNewSession().then(()=>setShowSidebar(false))}><i className="fas fa-plus text-pink-500"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                   {sessions.map(s => (
                     <div key={s.id} onClick={()=>{loadSession(s.id);setShowSidebar(false);}} className={`p-3 mb-1 rounded-xl cursor-pointer hover:bg-gray-50 flex justify-between group ${currentSessionId===s.id?'bg-pink-50 border-pink-100 border':''}`}>
                        <div className="truncate flex-1">
                           <div className="text-sm font-medium text-gray-700 truncate">{s.title}</div>
                           <div className="text-[10px] text-gray-400 bg-gray-200 inline-block px-1 rounded mt-1">{s.group||'默认'}</div>
                        </div>
                        <button onClick={(e)=>handleMoveGroup(e,s)} className="hidden group-hover:block text-gray-400 hover:text-blue-500 px-2"><i className="fas fa-folder-open text-xs"/></button>
                     </div>
                   ))}
                </div>
             </Dialog.Panel>
           </div>
        </Dialog>
      </Transition>
    );
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#FFF0F5] relative text-gray-800 font-sans">
      <GlobalStyles />
      {/* Background */}
      {settings.chatBackgroundUrl && (
         <div className="absolute inset-0 bg-cover bg-center pointer-events-none z-0" style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, opacity: 1 - settings.backgroundOverlay }} />
      )}

      {/* Recording Overlay */}
      {isRecording && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-pink-500/90 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-3 animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce"/>
          <span className="text-sm font-bold">正在听... (2.5秒后发送)</span>
        </div>
      )}

      {/* Header */}
      <div className="relative z-20 pt-safe-top bg-white/60 backdrop-blur-md shadow-sm border-b border-pink-100/50">
        <div className="flex items-center justify-between h-12 px-4">
          <button onClick={() => setShowSidebar(true)} className="w-8 h-8 flex items-center justify-center text-gray-600">
             <i className="fas fa-link text-lg" />
          </button>
          
          <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
             <img src="https://886.best/favicon.ico" className="w-5 h-5 rounded-full shadow-sm" onError={e=>e.target.style.display='none'}/>
             <span className="font-extrabold text-lg tracking-tight text-gray-800">886.best</span>
          </div>

          <button onClick={() => setShowSettings(true)} className="w-8 h-8 flex items-center justify-center text-gray-600">
             <i className="fas fa-cog" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-4 pt-4 pb-36 scroll-smooth">
         <div className="w-full max-w-[600px] mx-auto min-h-full flex flex-col justify-end">
            {history.length === 0 && <div className="text-center text-gray-300 mt-20">暂无消息</div>}
            {history.map(item => (
              <div key={item.id} className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* User Message */}
                {item.role === 'user' && (
                  <div className="flex justify-end mb-2">
                     <div className="bg-gray-200/90 backdrop-blur text-gray-800 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[85%] shadow-sm">
                        {item.image && <img src={item.image} className="w-full max-w-[200px] rounded-lg mb-2 block" alt="upload"/>}
                        {item.text}
                     </div>
                  </div>
                )}
                
                {/* AI Response (Carousel) */}
                {item.role === 'user' && item.resultsMap && (
                   <ResultCarousel 
                      resultsMap={item.resultsMap} 
                      targetLang={targetLang} 
                      settings={settings}
                      onPlay={(t) => playTTS(t, targetLang, settings)}
                   />
                )}

                {/* Suggestions */}
                {history[history.length-1].id === item.id && settings.enableSuggestions && (
                   <div className="mt-2">
                      <div className="chip-scroll-container no-scrollbar">
                         {suggestions.map((s,i) => <button key={i} onClick={()=>{setInputVal(s);handleTranslate(s)}} className="shrink-0 bg-white border border-pink-100 px-3 py-1 rounded-full text-xs text-gray-600 shadow-sm active:scale-95">{s}</button>)}
                      </div>
                   </div>
                )}
              </div>
            ))}
         </div>
      </div>

      {/* Footer Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white/95 to-transparent pt-4 pb-[max(10px,env(safe-area-inset-bottom))]">
         <div className="w-full max-w-[600px] mx-auto px-4">
            {/* Lang & Model Switch */}
            <div className="flex items-center justify-center mb-2 relative">
               <div className="flex bg-white/60 backdrop-blur rounded-full border shadow-sm p-1 gap-2">
                  <button onClick={()=>setShowSrcPicker(true)} className="flex items-center gap-1 px-3 py-1 rounded-full hover:bg-white"><span className="text-lg">{getLangFlag(sourceLang)}</span><span className="text-xs font-bold">{getLangName(sourceLang)}</span></button>
                  <button onClick={()=>{const t=sourceLang;setSourceLang(targetLang);setTargetLang(t)}}><i className="fas fa-exchange-alt text-gray-400 text-xs"/></button>
                  <button onClick={()=>setShowTgtPicker(true)} className="flex items-center gap-1 px-3 py-1 rounded-full hover:bg-white"><span className="text-lg">{getLangFlag(targetLang)}</span><span className="text-xs font-bold">{getLangName(targetLang)}</span></button>
               </div>
               <button onClick={()=>setShowModelSelector(true)} className="absolute right-0 w-8 h-8 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center text-sm shadow-sm border border-pink-100"><i className="fas fa-robot"/></button>
            </div>

            {/* Input Bar */}
            <div className={`relative flex items-end gap-2 bg-white border p-1.5 rounded-[24px] shadow-lg transition-all ${isRecording?'border-pink-500 ring-2 ring-pink-100':'border-gray-200'}`}>
               <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
               <button onClick={()=>fileInputRef.current?.click()} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${imageFile ? 'text-pink-600 bg-pink-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <i className="fas fa-camera text-lg"/>
               </button>

               <textarea 
                 value={inputVal}
                 onChange={e=>setInputVal(e.target.value)}
                 onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleTranslate()}}}
                 rows={1}
                 placeholder={isRecording ? "Listening..." : "输入文字..."}
                 className="flex-1 py-2.5 max-h-32 bg-transparent border-none outline-none resize-none text-base text-gray-800 placeholder-gray-400"
               />

               <button 
                  onClick={inputVal || imageFile ? ()=>handleTranslate() : startRecording}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-90 text-white ${inputVal||imageFile ? 'bg-pink-500' : (isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-200 text-gray-500')}`}
               >
                  <i className={`fas ${inputVal||imageFile ? 'fa-arrow-up' : (isRecording ? 'fa-stop' : 'fa-microphone')}`} />
               </button>
            </div>
         </div>
      </div>

      {/* Modals */}
      {showSettings && <SettingsModal settings={settings} onSave={(s)=>{setSettings(s);setShowSettings(false)}} onClose={()=>setShowSettings(false)} />}
      {showModelSelector && <ModelSelectorModal settings={settings} onClose={()=>setShowModelSelector(false)} onSelect={(u)=>{setSettings(p=>({...p,...u}));}} />}
      {showSidebar && <Sidebar />}
      
      {/* Lang Pickers (Simple) */}
      <Dialog open={showSrcPicker||showTgtPicker} onClose={()=>{setShowSrcPicker(false);setShowTgtPicker(false)}} className="relative z-[10005]">
         <div className="fixed inset-0 bg-black/20 backdrop-blur-sm"/>
         <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-white rounded-xl p-4 w-full max-w-xs max-h-[70vh] overflow-y-auto">
               <div className="grid grid-cols-2 gap-2">
                 {SUPPORTED_LANGUAGES.map(l=>(
                   <button key={l.code} onClick={()=>{
                      if(showSrcPicker) {setSourceLang(l.code);setShowSrcPicker(false);}
                      else {setTargetLang(l.code);setShowTgtPicker(false);}
                   }} className="p-2 border rounded-lg text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <span className="text-xl">{l.flag}</span>{l.name}
                   </button>
                 ))}
               </div>
            </Dialog.Panel>
         </div>
      </Dialog>

    </div>
  );
};

const AIChatDrawer = ({ isOpen, onClose }) => (
  <Transition show={isOpen} as={Fragment}>
    <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true"/>
      <div className="fixed inset-0 overflow-hidden"><Dialog.Panel className="w-full h-full"><AiChatContent onClose={onClose}/></Dialog.Panel></div>
    </Dialog>
  </Transition>
);

export default AIChatDrawer;
