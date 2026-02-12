import { Transition, Dialog, Menu } from '@headlessui/react';
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  memo,
  useMemo,
} from 'react';

// 假设这些库文件存在
import { loadCheatDict, matchCheatLoose } from '@/lib/cheatDict';

// ----------------- IndexedDB Helper（保留：可用于未来做会话列表） -----------------
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
    return this.transaction('sessions', 'readwrite', (store) => store.put(session)).then(() => session);
  }

  async addMessage(message) {
    await this.open();
    return this.transaction('messages', 'readwrite', (store) => store.put(message));
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
    .chip-scroll-container { display: flex; gap: 8px; overflow-x: auto; padding: 4px 10px; -webkit-overflow-scrolling: touch; cursor: grab; }
  `}</style>
);

// ----------------- Utils -----------------
const safeLocalStorageGet = (key) => {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key, value) => {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // ignore quota / privacy mode
  }
};

const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// 提示音（尽量兼容 iOS）
const playBeep = async () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 600;
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
        ctx.close();
      } catch {}
    }, 150);
  } catch (e) {
    console.error('Audio Context Error', e);
  }
};

// 图片压缩（base64）
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => new Image();
        img.onerror = () => reject(new Error('Image load error'));
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
    } catch (e) {
      reject(e);
    }
  });
};

// 脚本检测：仅保留中文和缅文
const detectScript = (text) => {
  if (!text) return null;
  if (/[\u1000-\u109F\uAA60-\uAA7F]+/.test(text)) return 'my-MM';
  if (/[\u4E00-\u9FFF]+/.test(text)) return 'zh-CN';
  return null;
};

// 更宽松的 JSON 解析（兼容模型输出夹带说明/代码块）
const parseJsonLoose = (raw) => {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;

  let s = raw.trim();
  if (!s) return null;

  // 去掉 ```...``` 包裹
  if (s.includes('```')) {
    s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')).trim();
  }

  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  if (start > 0) s = s.slice(start);

  const lastBrace = s.lastIndexOf('}');
  const lastBracket = s.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end !== -1) s = s.slice(0, end + 1);

  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// ----------------- Data & Config -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'my-MM', name: '缅甸语', flag: '🇲🇲' },
];

const DEFAULT_PROVIDERS = [{ id: 'p1', name: '默认接口', url: 'https://apis.iflow.cn/v1', key: '' }];

const DEFAULT_MODELS = [
  { id: 'm1', providerId: 'p1', name: 'DeepSeek V3', value: 'deepseek-chat' },
  { id: 'm2', providerId: 'p1', name: 'Qwen Max', value: 'qwen-max' },
  { id: 'm3', providerId: 'p1', name: 'GPT-4o', value: 'gpt-4o' },
];

// 明确要求 back_translation，避免 UI 期望与模型输出不一致
const BASE_SYSTEM_INSTRUCTION = `你是一位精通中缅双语的“高保真社交翻译 AI”。
唯一任务：实现【口语化的精准直译】，执行双向互译。

═══════════════════════════════
【核心翻译法则】
═══════════════════════════════
1. 含义第一：必须 100% 保留原文的事实、立场、情绪。
2. 绝对互译：如果输入中文，必须翻译成缅文。如果输入缅文，必须翻译成中文。严禁翻译成英文或其他语言。

═══════════════════════════════
【特殊词汇处理】
═══════════════════════════════
- 缅甸语口语化：使用 nwa, naw, bya 等语气词还原情绪。
- 中文口语化：使用地道的中国社交口语。

═══════════════════════════════
【JSON 输出规格】
═══════════════════════════════
必须严格按此格式输出，严禁任何前言、后缀、Markdown 或解释：
{"data":[{"translation":"...","back_translation":"..."}]}
`;

const REPLY_SYSTEM_INSTRUCTION = `你是一个中缅语聊天助手。用户刚刚把一句【源语言】翻译成了【目标语言】。请用【目标语言】生成 3 到 5 个简短、自然的回复建议。
只返回 JSON 数组字符串，格式：["回复1", "回复2", ...]，不要 markdown，不要解释。`;

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,

  mainModelId: 'm1',
  secondModelId: null,
  followUpModelId: 'm1',

  ttsConfig: {},
  ttsSpeed: 1.0,
  autoPlayTTS: false,

  backgroundOverlay: 0.9,
  chatBackgroundUrl: '',

  useCustomPrompt: false,
  customPromptText: '',

  filterThinking: true,
  enableFollowUp: true,

  // 语音模式设置
  useCloudSpeech: false, // false=原生, true=云代理
  cloudSpeechUrl: '',

  lastSourceLang: 'zh-CN',
  lastTargetLang: 'my-MM',
};

const getLangName = (c) => SUPPORTED_LANGUAGES.find((l) => l.code === c)?.name || c;
const getLangFlag = (c) => SUPPORTED_LANGUAGES.find((l) => l.code === c)?.flag || '';

// ----------------- TTS Engine -----------------
const ttsCache = new Map();

const AVAILABLE_VOICES = {
  'zh-CN': [
    { id: 'zh-CN-XiaoyouNeural', name: '小悠 (女)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男)' },
  ],
  'my-MM': [
    { id: 'my-MM-NilarNeural', name: 'Nilar (女)' },
    { id: 'my-MM-ThihaNeural', name: 'Thiha (男)' },
  ],
};

const getVoiceForLang = (lang, config) => {
  if (config && config[lang]) return config[lang];
  if (AVAILABLE_VOICES[lang]) return AVAILABLE_VOICES[lang][0].id;
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
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(
        voice
      )}&r=${rateVal}`;
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

// ----------------- Translation Parsing -----------------
const normalizeTranslations = (raw) => {
  try {
    const parsed = parseJsonLoose(raw) ?? raw;

    let data = [];
    if (Array.isArray(parsed?.data)) data = parsed.data;
    else if (Array.isArray(parsed)) data = parsed;

    const valid = data
      .filter((x) => x && typeof x.translation === 'string' && x.translation.trim())
      .map((x) => ({
        style: x.style || '默认',
        translation: String(x.translation || '').trim(),
        back_translation: x.back_translation ? String(x.back_translation).trim() : '',
      }));

    if (valid.length === 0) {
      const fallback = typeof raw === 'string' ? raw : '无有效译文';
      return [{ style: '默认', translation: fallback, back_translation: '' }];
    }

    return valid.slice(0, 4);
  } catch {
    return [{ style: '错误', translation: '解析数据失败', back_translation: '' }];
  }
};

const normalizeSuggestions = (raw) => {
  const parsed = parseJsonLoose(raw) ?? raw;

  if (Array.isArray(parsed)) return parsed.filter(Boolean).map((x) => String(x)).slice(0, 8);
  if (Array.isArray(parsed?.suggestions))
    return parsed.suggestions.filter(Boolean).map((x) => String(x)).slice(0, 8);
  if (Array.isArray(parsed?.data))
    return parsed.data.filter(Boolean).map((x) => String(x)).slice(0, 8);

  return [];
};

// ----------------- UI Components -----------------
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
      className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group mb-3 text-center"
    >
      {copied && (
        <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10">
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md">已复制</span>
        </div>
      )}
      <div className="text-[18px] leading-relaxed font-medium text-gray-800 break-words select-none whitespace-pre-wrap">
        {data.translation}
      </div>
      {!!data.back_translation && (
        <div className="mt-2.5 text-[13px] text-gray-400 break-words leading-snug whitespace-pre-wrap">
          {data.back_translation}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="absolute bottom-2 right-2 p-2 text-gray-300 hover:text-blue-500 opacity-50 hover:opacity-100"
      >
        <i className="fas fa-volume-up" />
      </button>
    </div>
  );
});

const TranslationResultContainer = memo(({ item, targetLang, onPlay }) => {
  const hasDual = !!(item.modelResults && item.modelResults.length > 1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStart = useRef(null);

  const effectiveIndex = hasDual ? currentIndex : 0;
  const currentData = hasDual ? item.modelResults[effectiveIndex].data : item.results;
  const currentModelName = hasDual ? item.modelResults[effectiveIndex].modelName : null;

  const onTouchStart = (e) => {
    if (!hasDual) return;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (!hasDual || touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (diff > 50) setCurrentIndex((prev) => (prev + 1) % item.modelResults.length);
    if (diff < -50) setCurrentIndex((prev) => (prev - 1 + item.modelResults.length) % item.modelResults.length);
    touchStart.current = null;
  };

  return (
    <div className="relative group" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {hasDual && (
        <div className="flex justify-center mb-1 gap-1">
          {item.modelResults.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all ${
                idx === effectiveIndex ? 'w-4 bg-pink-400' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>
      )}
      {currentModelName && (
        <div className="text-[10px] text-center text-gray-400 mb-1 font-mono">{currentModelName}</div>
      )}

      <div key={effectiveIndex} className="animate-in fade-in slide-in-from-right-4 duration-300">
        {currentData.map((res, i) => (
          <TranslationCard key={i} data={res} onPlay={() => onPlay(res.translation)} />
        ))}
      </div>
    </div>
  );
});

const ReplyChips = ({ suggestions, onClick }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] text-gray-400 text-center mb-2">快捷回复</div>
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

// ----------------- Modal: Model Selector -----------------
const ModelSelectorModal = ({ settings, onClose, onSave }) => {
  const [mode, setMode] = useState('main');
  const [localSettings, setLocalSettings] = useState(settings);

  let currentActiveModelId = null;
  if (mode === 'main') currentActiveModelId = localSettings.mainModelId;
  else if (mode === 'second') currentActiveModelId = localSettings.secondModelId;
  else currentActiveModelId = localSettings.followUpModelId;

  const activeModelObj = settings.models.find((m) => m.id === currentActiveModelId);
  const activeProviderId = activeModelObj ? activeModelObj.providerId : null;

  const [selectedProvId, setSelectedProvId] = useState(activeProviderId || settings.providers[0]?.id);

  useEffect(() => {
    let mid = null;
    if (mode === 'main') mid = localSettings.mainModelId;
    else if (mode === 'second') mid = localSettings.secondModelId;
    else mid = localSettings.followUpModelId;

    const m = settings.models.find((x) => x.id === mid);
    if (m) setSelectedProvId(m.providerId);
  }, [mode, localSettings, settings.models]);

  const handleSelect = (modelId) => {
    if (mode === 'main') setLocalSettings((s) => ({ ...s, mainModelId: modelId }));
    else if (mode === 'second')
      setLocalSettings((s) => ({ ...s, secondModelId: s.secondModelId === modelId ? null : modelId }));
    else setLocalSettings((s) => ({ ...s, followUpModelId: modelId }));
  };

  const currentModels = settings.models.filter((m) => m.providerId === selectedProvId);

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10005]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden h-[550px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="font-bold text-gray-800">模型选择</div>
            <button onClick={onClose}>
              <i className="fas fa-times text-gray-400" />
            </button>
          </div>

          <div className="flex p-2 gap-2 border-b border-gray-100 bg-gray-50">
            <button
              onClick={() => setMode('main')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg relative flex items-center justify-center gap-1 ${
                mode === 'main' ? 'bg-white shadow text-pink-600' : 'text-gray-500'
              }`}
            >
              主翻译
              {localSettings.mainModelId && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
            </button>

            <button
              onClick={() => setMode('second')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg relative flex items-center justify-center gap-1 ${
                mode === 'second' ? 'bg-white shadow text-purple-600' : 'text-gray-500'
              }`}
            >
              对比模型
              {localSettings.secondModelId && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
            </button>

            <button
              onClick={() => setMode('followup')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg relative flex items-center justify-center gap-1 ${
                mode === 'followup' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              追问建议
              {localSettings.followUpModelId && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="w-1/3 bg-gray-50 border-r border-gray-100 overflow-y-auto slim-scrollbar p-2">
              {settings.providers.map((p) => {
                const isActiveProvider = p.id === selectedProvId;
                const containsActiveModel = p.id === activeProviderId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvId(p.id)}
                    className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold mb-1 relative transition-colors ${
                      isActiveProvider ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {containsActiveModel && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-pink-500 rounded-r-full" />
                    )}
                    {p.name}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto slim-scrollbar p-3">
              {currentModels.map((m) => {
                const isSelected = m.id === currentActiveModelId;
                const activeClass = isSelected
                  ? mode === 'main'
                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                    : mode === 'second'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-100';

                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border mb-2 flex justify-between ${activeClass}`}
                  >
                    <div>
                      <div className="font-bold text-sm">{m.name}</div>
                      <div className="text-[10px] opacity-60 font-mono">{m.value}</div>
                    </div>
                    {isSelected && <i className="fas fa-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => {
                onSave(localSettings);
                onClose();
              }}
              className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-200"
            >
              完成设置
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// ----------------- Modal: Settings -----------------
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [data, setData] = useState(settings);
  const [tab, setTab] = useState('common');
  const fileInputRef = useRef(null);

  const updateProvider = (idx, f, v) => {
    const arr = [...data.providers];
    arr[idx] = { ...arr[idx], [f]: v };
    setData({ ...data, providers: arr });
  };

  const addProvider = () =>
    setData((prev) => ({
      ...prev,
      providers: [...prev.providers, { id: nowId(), name: '新供应商', url: '', key: '' }],
    }));

  const delProvider = (id) => {
    if (data.providers.length > 1) setData((prev) => ({ ...prev, providers: prev.providers.filter((p) => p.id !== id) }));
  };

  const getModelsByProv = (pid) => data.models.filter((m) => m.providerId === pid);

  const addModel = (pid) =>
    setData((prev) => ({
      ...prev,
      models: [...prev.models, { id: nowId(), providerId: pid, name: '新模型', value: '' }],
    }));

  const updateModel = (mid, f, v) =>
    setData((prev) => ({ ...prev, models: prev.models.map((m) => (m.id === mid ? { ...m, [f]: v } : m)) }));

  const delModel = (mid) => setData((prev) => ({ ...prev, models: prev.models.filter((m) => m.id !== mid) }));

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      setData({ ...data, chatBackgroundUrl: base64 });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-[10002]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="font-bold text-gray-800">设置</div>
            <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500">
              <i className="fas fa-times" />
            </button>
          </div>

          <div className="flex p-2 gap-1 border-b border-gray-100">
            {[
              { id: 'common', label: '通用' },
              { id: 'provider', label: '供应商与模型' },
              { id: 'voice', label: '语音设置' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                  tab === t.id ? 'bg-pink-50 text-pink-600' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto slim-scrollbar p-5 bg-white">
            {tab === 'common' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">过滤模型思考过程</div>
                    <div className="text-xs text-gray-400">关闭 DeepSeek 等模型的 &lt;think&gt; 输出</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.filterThinking}
                    onChange={(e) => setData({ ...data, filterThinking: e.target.checked })}
                    className="w-5 h-5 accent-pink-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-gray-700">启用追问建议</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.enableFollowUp}
                    onChange={(e) => setData({ ...data, enableFollowUp: e.target.checked })}
                    className="w-5 h-5 accent-pink-500"
                  />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-bold text-gray-700 mb-2">背景设置</div>
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white border rounded-lg text-xs shadow-sm"
                    >
                      上传图片
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
                    <button
                      onClick={() => setData({ ...data, chatBackgroundUrl: '' })}
                      className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-lg text-xs"
                    >
                      清除
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={data.backgroundOverlay}
                    onChange={(e) => setData({ ...data, backgroundOverlay: parseFloat(e.target.value) })}
                    className="w-full accent-pink-500"
                  />
                </div>
              </div>
            )}

            {tab === 'provider' && (
              <div className="space-y-6">
                {data.providers.map((p, idx) => (
                  <div key={p.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <input
                        className="font-bold text-gray-800 bg-transparent outline-none"
                        value={p.name}
                        onChange={(e) => updateProvider(idx, 'name', e.target.value)}
                      />
                      <button onClick={() => delProvider(p.id)} className="text-red-500 text-xs">
                        删除
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input
                        className="bg-white text-xs p-2 rounded border"
                        placeholder="URL"
                        value={p.url}
                        onChange={(e) => updateProvider(idx, 'url', e.target.value)}
                      />
                      <input
                        className="bg-white text-xs p-2 rounded border"
                        type="password"
                        placeholder="Key"
                        value={p.key}
                        onChange={(e) => updateProvider(idx, 'key', e.target.value)}
                      />
                    </div>

                    <div className="bg-white rounded-lg p-2 border border-gray-100">
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400">模型列表</span>
                        <button onClick={() => addModel(p.id)} className="text-[10px] bg-blue-50 text-blue-600 px-2 rounded">
                          + 添加
                        </button>
                      </div>

                      {getModelsByProv(p.id).map((m) => (
                        <div key={m.id} className="flex gap-2 items-center mb-1">
                          <input
                            className="flex-1 text-[11px] border rounded p-1"
                            placeholder="名称"
                            value={m.name}
                            onChange={(e) => updateModel(m.id, 'name', e.target.value)}
                          />
                          <input
                            className="flex-1 text-[11px] border rounded p-1 font-mono"
                            placeholder="Value"
                            value={m.value}
                            onChange={(e) => updateModel(m.id, 'value', e.target.value)}
                          />
                          <button onClick={() => delModel(m.id)} className="text-gray-300 hover:text-red-500">
                            <i className="fas fa-times" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={addProvider} className="w-full py-2 border border-dashed rounded-xl text-gray-500 text-sm hover:bg-gray-50">
                  + 添加供应商
                </button>
              </div>
            )}

            {tab === 'voice' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-bold text-gray-800">免VPN语音识别</div>
                      <div className="text-xs text-gray-500">开启后使用Cloudflare代理 (中国可用)</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={data.useCloudSpeech}
                      onChange={(e) => setData({ ...data, useCloudSpeech: e.target.checked })}
                      className="w-5 h-5 accent-blue-500"
                    />
                  </div>
                  {data.useCloudSpeech && (
                    <input
                      className="w-full text-xs p-2 rounded border border-blue-200 mt-2"
                      placeholder="输入 Cloudflare Worker 地址 (例: https://xxx.workers.dev/speech)"
                      value={data.cloudSpeechUrl}
                      onChange={(e) => setData({ ...data, cloudSpeechUrl: e.target.value })}
                    />
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-700">自动朗读</div>
                    <div className="text-xs text-gray-400">翻译完成后自动播放第一条结果</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.autoPlayTTS}
                    onChange={(e) => setData({ ...data, autoPlayTTS: e.target.checked })}
                    className="w-5 h-5 accent-pink-500"
                  />
                </div>

                <div className="text-sm font-bold text-gray-700 px-1 mt-4">发音人设置</div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  AVAILABLE_VOICES[lang.code] && (
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
                        {AVAILABLE_VOICES[lang.code].map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ))}

                <div className="p-3 bg-gray-50 rounded-xl mt-4">
                  <div className="text-sm font-bold text-gray-700">全局语速: {data.ttsSpeed}x</div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    className="w-full accent-pink-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                    value={data.ttsSpeed}
                    onChange={(e) => setData({ ...data, ttsSpeed: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gray-100 text-sm font-bold text-gray-600">
              取消
            </button>
            <button
              onClick={() => {
                onSave(data);
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-pink-500 text-sm font-bold text-white shadow-lg shadow-pink-200"
            >
              保存
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// ----------------- Main Chat -----------------
const AiChatContent = ({ onClose }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sourceLang, setSourceLang] = useState('zh-CN');
  const [targetLang, setTargetLang] = useState('my-MM');

  const [inputVal, setInputVal] = useState('');
  const [inputImages, setInputImages] = useState([]);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const scrollRef = useRef(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // 语音相关
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const latestInputRef = useRef('');
  const manualStopRef = useRef(false);

  const runIdRef = useRef(0);
  const abortRef = useRef(null);

  const sessionIdRef = useRef(safeLocalStorageGet('ai886_sessionId') || nowId());

  // init
  useEffect(() => {
    safeLocalStorageSet('ai886_sessionId', sessionIdRef.current);

    const s = safeLocalStorageGet('ai886_settings');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        if (parsed.lastSourceLang) setSourceLang(parsed.lastSourceLang);
        if (parsed.lastTargetLang) setTargetLang(parsed.lastTargetLang);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
    setHistory([]);
  }, []);

  // persist settings
  useEffect(() => {
    const toSave = { ...settings, lastSourceLang: sourceLang, lastTargetLang: targetLang };
    safeLocalStorageSet('ai886_settings', JSON.stringify(toSave));
  }, [settings, sourceLang, targetLang]);

  // cleanup
  useEffect(() => {
    return () => {
      try {
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch {}
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      } catch {}
      try {
        if (abortRef.current) abortRef.current.abort();
      } catch {}
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      try {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      } catch {}
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history.length, isLoading, isSuggesting, scrollToBottom]);

  const getProviderAndModel = useCallback(
    (modelId) => {
      const model = settings.models.find((m) => m.id === modelId);
      if (!model) return null;
      const provider = settings.providers.find((p) => p.id === model.providerId);
      return provider ? { provider, model } : null;
    },
    [settings.models, settings.providers]
  );

  const fetchAi = useCallback(
    async ({ messages, modelId, jsonObjectMode, signal }) => {
      const pm = getProviderAndModel(modelId);
      if (!pm) throw new Error(`未配置模型 ${modelId}`);
      if (!pm.provider.key) throw new Error(`${pm.provider.name} 缺少 Key`);

      const body = { model: pm.model.value, messages, stream: false };
      if (jsonObjectMode) body.response_format = { type: 'json_object' };

      const res = await fetch(`${pm.provider.url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pm.provider.key}` },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.choices?.length) throw new Error('API返回数据异常');

      let content = data.choices[0].message.content;

      if (settings.filterThinking && typeof content === 'string') {
        content = content.replace(/>[\s\S]*?<\/think>/g, '').trim();
>      }
>      return { content, modelName: pm.model.name };
>    },
>    [getProviderAndModel, settings.filterThinking]
>  );
>  const buildTranslateMessages = useCallback(
>    ({ text, images, currentSource, currentTarget }) => {
>      let sysPrompt = BASE_SYSTEM_INSTRUCTION;
>      if (settings.useCustomPrompt && settings.customPromptText) {
>        sysPrompt += `\n额外要求: ${settings.customPromptText}`;
>      }
>      sysPrompt += `\nback_translation 必须翻译回: ${getLangName(currentSource)}`;
>      const userPromptText = `Source: ${getLangName(currentSource)}\nTarget: ${getLangName(
>        currentTarget
>      )}\nContent:\n${text || '[Image Content]'}`;
>      if (images && images.length > 0) {
>        const content = [{ type: 'text', text: userPromptText }];
>        images.forEach((img) => content.push({ type: 'image_url', image_url: { url: img } }));
>        return [{ role: 'system', content: sysPrompt }, { role: 'user', content }];
>      }
>      return [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPromptText }];
>    },
>    [settings.useCustomPrompt, settings.customPromptText]
>  );
>  const fetchSuggestions = useCallback(
>    async ({ originalText, src, tgt, runId }) => {
>      setIsSuggesting(true);
>      try {
>        const prompt = `原文(${getLangName(src)}): ${originalText}\n已翻译为: ${getLangName(tgt)}`;
>        // 这里不能用 json_object mode，因为 system 要求返回数组
>        const { content } = await fetchAi({
>          messages: [
>            { role: 'system', content: REPLY_SYSTEM_INSTRUCTION },
>            { role: 'user', content: prompt },
>          ],
>          modelId: settings.followUpModelId,
>          jsonObjectMode: false,
>          signal: abortRef.current?.signal,
>        });
>        if (runIdRef.current !== runId) return;
>        const list = normalizeSuggestions(content);
>        if (list.length) setSuggestions(list);
>      } catch (e) {
>        console.log('Suggestion failed:', e);
>      } finally {
>        if (runIdRef.current === runId) setIsSuggesting(false);
>      }
>    },
>    [fetchAi, settings.followUpModelId]
>  );
>  const handleTranslate = useCallback(
>    async (textOverride = null) => {
>      const runId = ++runIdRef.current;
>      const text = (textOverride != null ? String(textOverride) : inputVal).trim();
>      const images = inputImages;
>      if (!text && images.length === 0) return;
>      // cancel previous
>      try {
>        if (abortRef.current) abortRef.current.abort();
>      } catch {}
>      abortRef.current = new AbortController();
>      // 强制语言对：只在 CN/MM 之间切换
>      let currentSource = sourceLang;
>      let currentTarget = targetLang;
>      if (text) {
>        const detected = detectScript(text);
>        if (detected === 'zh-CN') {
>          currentSource = 'zh-CN';
>          currentTarget = 'my-MM';
>        } else if (detected === 'my-MM') {
>          currentSource = 'my-MM';
>          currentTarget = 'zh-CN';
>        }
>      }
>      setSourceLang(currentSource);
>      setTargetLang(currentTarget);
>      setIsLoading(true);
>      setSuggestions([]);
>      const userMsg = {
>        id: nowId(),
>        sessionId: sessionIdRef.current,
>        role: 'user',
>        text,
>        images,
>        ts: Date.now(),
>        results: [],
>      };
>      setHistory((prev) => [...prev, userMsg]);
>      setInputVal('');
>      setInputImages([]);
>      try {
>        // 存储（不影响主流程）
>        db.addMessage(userMsg).catch(() => {});
>      } catch {}
>      const messages = buildTranslateMessages({ text, images, currentSource, currentTarget });
>      try {
>        let dictHit = null;
>        if (images.length === 0 && text) {
>          const dict = await loadCheatDict(currentSource);
>          dictHit = matchCheatLoose(dict, text, currentTarget);
>        }
>        const aiMsg = {
>          id: nowId(),
>          sessionId: sessionIdRef.current,
>          role: 'ai',
>          results: [],
>          modelResults: [],
>          from: 'ai',
>          ts: Date.now(),
>        };
>        if (dictHit) {
>          aiMsg.results = normalizeTranslations(dictHit);
>          aiMsg.from = 'dict';
>        } else {
>          const tasks = [];
>          tasks.push(
>            fetchAi({
>              messages,
>              modelId: settings.mainModelId,
>              jsonObjectMode: true,
>              signal: abortRef.current.signal,
>            })
>              .then((r) => ({ ...r, ok: true }))
>              .catch((e) => ({ ok: false, error: e.message || String(e), modelName: 'Error' }))
>          );
>          if (settings.secondModelId && settings.secondModelId !== settings.mainModelId) {
>            tasks.push(
>              fetchAi({
>                messages,
>                modelId: settings.secondModelId,
>                jsonObjectMode: true,
>                signal: abortRef.current.signal,
>              })
>                .then((r) => ({ ...r, ok: true }))
>                .catch((e) => ({ ok: false, error: e.message || String(e), modelName: 'Error' }))
>            );
>          }
>          const responses = await Promise.all(tasks);
>          if (runIdRef.current !== runId) return;
>          const modelResults = responses.map((res) => {
>            if (!res.ok) {
>              return { modelName: 'Error', data: [{ style: '错误', translation: res.error, back_translation: '' }] };
>            }
>            return { modelName: res.modelName, data: normalizeTranslations(res.content) };
>          });
>          aiMsg.modelResults = modelResults;
>          aiMsg.results = modelResults[0]?.data || [];
>        }
>        if (runIdRef.current !== runId) return;
>        setHistory((prev) => [...prev, aiMsg]);
>        try {
>          db.addMessage(aiMsg).catch(() => {});
>        } catch {}
>        if (settings.autoPlayTTS && aiMsg.results?.length) {
>          playTTS(aiMsg.results[0].translation, currentTarget, settings);
>        }
>        if (settings.enableFollowUp && text) {
>          fetchSuggestions({ originalText: text, src: currentSource, tgt: currentTarget, runId });
>        }
>      } catch (e) {
>        if (runIdRef.current !== runId) return;
>        const errorMsg = {
>          id: nowId(),
>          sessionId: sessionIdRef.current,
>          role: 'error',
>          text: e.message || '未知错误',
>          ts: Date.now(),
>          results: [],
>        };
>        setHistory((prev) => [...prev, errorMsg]);
>        try {
>          db.addMessage(errorMsg).catch(() => {});
>        } catch {}
>      } finally {
>        if (runIdRef.current === runId) setIsLoading(false);
>      }
>    },
>    [
>      inputVal,
>      inputImages,
>      sourceLang,
>      targetLang,
>      settings.mainModelId,
>      settings.secondModelId,
>      settings.autoPlayTTS,
>      settings.enableFollowUp,
>      settings,
>      fetchAi,
>      fetchSuggestions,
>      buildTranslateMessages,
>    ]
>  );
>  const handleImageSelect = useCallback(async (e) => {
>    const files = Array.from(e.target.files || []);
>    if (files.length === 0) return;
>    const newImages = [];
>    for (const file of files) {
>      try {
>        const base64 = await compressImage(file);
>        newImages.push(base64);
>      } catch (err) {
>        console.error(err);
>      }
>    }
>    setInputImages((prev) => [...prev, ...newImages]);
>    e.target.value = '';
>  }, []);
>  // -----------------------------
>  // Voice Recognition Logic (Dual Mode)
>  // -----------------------------
>  const stopAndSend = useCallback(() => {
>    manualStopRef.current = true;
>    if (!settings.useCloudSpeech) {
>      if (recognitionRef.current) {
>        try {
>          recognitionRef.current.stop();
>        } catch {}
>      }
>    } else {
>      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
>        try {
>          mediaRecorderRef.current.stop();
>        } catch {}
>      }
>    }
>    setIsRecording(false);
>  }, [settings.useCloudSpeech]);
>  const pickBestMimeType = () => {
>    const candidates = [
>      'audio/webm;codecs=opus',
>      'audio/webm',
>      'audio/mp4',
>      'audio/aac',
>      '',
>    ];
>    for (const t of candidates) {
>      try {
>        if (!t) return '';
>        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
>      } catch {}
>    }
>    return '';
>  };
>  const startRecording = useCallback(async () => {
>    if (isRecording) {
>      stopAndSend();
>      return;
>    }
>    manualStopRef.current = false;
>    latestInputRef.current = '';
>    await playBeep();
>    setInputVal('');
>    setIsRecording(true);
>    if (navigator.vibrate) navigator.vibrate(50);
>    // 模式 A：原生
>    if (!settings.useCloudSpeech) {
>      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
>      if (!SpeechRecognition) {
>        alert('当前浏览器不支持原生语音识别，请在设置中开启“免VPN语音模式”');
>        setIsRecording(false);
>        return;
>      }
>      const recognition = new SpeechRecognition();
>      recognition.lang = sourceLang;
>      recognition.interimResults = true;
>      recognition.continuous = false;
>      recognitionRef.current = recognition;
>      recognition.onresult = (event) => {
>        const results = Array.from(event.results);
>        const transcript = results.map((r) => r[0].transcript).join('');
>        latestInputRef.current = transcript;
>        setInputVal(transcript);
>        const hasFinal = results.some((r) => r.isFinal);
>        if (hasFinal && transcript.trim()) {
>          try {
>            recognition.stop();
>          } catch {}
>          setIsRecording(false);
>          handleTranslate(transcript);
>        }
>      };
>      recognition.onerror = (e) => {
>        console.error('Speech error:', e);
>        setIsRecording(false);
>      };
>      recognition.onend = () => {
>        const t = (latestInputRef.current || '').trim();
>        const shouldSend = manualStopRef.current && t;
>        setIsRecording(false);
>        manualStopRef.current = false;
>        if (shouldSend) handleTranslate(t);
>      };
>      try {
>        recognition.start();
>      } catch (e) {
>        console.error(e);
>        setIsRecording(false);
>      }
>      return;
>    }
>    // 模式 B：Cloud Proxy
>    if (!settings.cloudSpeechUrl) {
>      alert('请先在设置-语音设置中填写 Cloudflare Worker 地址');
>      setIsRecording(false);
>      return;
>    }
>    let stream = null;
>    try {
>      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
>      const mimeType = pickBestMimeType();
>      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
>      mediaRecorderRef.current = mediaRecorder;
>      audioChunksRef.current = [];
>      mediaRecorder.ondataavailable = (event) => {
>        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
>      };
>      mediaRecorder.onstop = async () => {
>        const blobType = mimeType || 'audio/webm';
>        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
>        try {
>          const url = `${settings.cloudSpeechUrl}?lang=${encodeURIComponent(sourceLang)}`;
>          const resp = await fetch(url, {
>            method: 'POST',
>            headers: { 'Content-Type': blobType },
>            body: audioBlob,
>          });
>          const data = await resp.json().catch(() => ({}));
>          const text = (data?.text || '').trim();
>          if (text) {
>            setInputVal(text);
>            handleTranslate(text);
>          } else {
>            setInputVal('识别失败，请重试');
>          }
>        } catch (e) {
>          console.error(e);
>          setInputVal('网络错误');
>        } finally {
>          try {
>            if (stream) stream.getTracks().forEach((track) => track.stop());
>          } catch {}
>        }
>      };
>      mediaRecorder.start();
>    } catch (e) {
>      console.error(e);
>      try {
>        if (stream) stream.getTracks().forEach((track) => track.stop());
>      } catch {}
>      alert('无法访问麦克风');
>      setIsRecording(false);
>    }
>  }, [isRecording, stopAndSend, settings.useCloudSpeech, settings.cloudSpeechUrl, sourceLang, handleTranslate]);
>  const swapLangs = useCallback(() => {
>    setSourceLang((prev) => {
>      const nextSource = targetLang;
>      setTargetLang(prev);
>      return nextSource;
>    });
>  }, [targetLang]);
>  const headerTitle = useMemo(() => '汉缅通 AI', []);
>  return (
>    <div className="flex flex-col w-full h-[100dvh] bg-[#FFF0F5] relative text-gray-800">
>      <GlobalStyles />
>      {settings.chatBackgroundUrl && (
>        <div
>          className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-500 pointer-events-none"
>          style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, opacity: 1 - settings.backgroundOverlay }}
>        />
>      )}
>      {/* Header */}
>      <div className="relative z-20 pt-safe-top bg-white/60 backdrop-blur-md shadow-sm border-b border-pink-100/50">
>        <div className="flex items-center justify-between h-12 relative px-4">
>          <div className="w-10" />
>          <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
>            <i className="fas fa-link text-pink-500" />
>            <span className="font-extrabold text-gray-800 text-lg tracking-tight">{headerTitle}</span>
>          </div>
>          <div className="flex items-center gap-3 w-10 justify-end">
>            <button
>              onClick={() => setShowSettings(true)}
>              className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-200 transition-colors text-gray-600"
>            >
>              <i className="fas fa-cog" />
>            </button>
>          </div>
>        </div>
>      </div>
>      {/* 录音状态 */}
>      <Transition
>        show={isRecording}
>        as={Fragment}
>        enter="transition-opacity duration-200"
>        enterFrom="opacity-0"
>        enterTo="opacity-100"
>        leave="transition-opacity duration-200"
>        leaveFrom="opacity-100"
>        leaveTo="opacity-0"
>      >
>        <div className="fixed top-24 left-0 right-0 z-50 flex justify-center pointer-events-none">
>          <div className="bg-pink-500/90 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-pulse pointer-events-auto backdrop-blur-sm">
>            <i className="fas fa-microphone text-xl animate-bounce" />
>            <span className="font-bold">
>              {settings.useCloudSpeech ? '云端识别中...' : `正在听 (${getLangName(sourceLang)})...`}
>            </span>
>          </div>
>        </div>
>      </Transition>
>      {/* 聊天区域 */}
>      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-4 pt-4 pb-32 scroll-smooth">
>        <div className="w-full max-w-[600px] mx-auto min-h-full flex flex-col justify-end">
>          {history.length === 0 && !isLoading && (
>            <div className="text-center text-gray-400 mb-20 opacity-60">
>              <div className="text-4xl mb-2">👋</div>
>              <div className="text-sm">汉缅双语互译助手</div>
>            </div>
>          )}
>          {history.map((item, idx) => {
>            if (item.role === 'user') {
>              return (
>                <div key={item.id} className="flex justify-end mb-6 opacity-80 origin-right">
>                  <div className="flex flex-col items-end max-w-[85%]">
>                    {item.images && item.images.length > 0 && (
>                      <div className="flex gap-1 mb-2 flex-wrap justify-end">
>                        {item.images.map((img, i) => (
>                          <img
>                            key={i}
>                            src={img}
>                            className="w-24 h-24 object-cover rounded-lg border border-gray-200"
>                            alt="input"
>                          />
>                        ))}
>                      </div>
>                    )}
>                    {item.text && (
>                      <div className="bg-gray-200 text-gray-700 px-4 py-2 rounded-2xl rounded-tr-sm text-sm break-words shadow-inner">
>                        {item.text}
>                      </div>
>                    )}
>                  </div>
>                </div>
>              );
>            }
>            if (item.role === 'error') {
>              return (
>                <div key={item.id} className="bg-red-50 text-red-500 text-xs p-3 rounded-xl text-center mb-6">
>                  {item.text}
>                </div>
>              );
>            }
>            return (
>              <div key={item.id} className="mb-6 animate-in slide-in-from-bottom-4 duration-500">
>                <TranslationResultContainer
>                  item={item}
>                  targetLang={targetLang}
>                  onPlay={(text) => playTTS(text, targetLang, settings)}
>                />
>                {item.modelResults && item.modelResults.length > 1 && (
>                  <div className="text-center text-[9px] text-gray-300 mt-1">双模对比</div>
>                )}
>                {idx === history.length - 1 && (
>                  isSuggesting ? (
>                    <div className="h-8 flex items-center justify-center gap-1">
>                      <span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce" />
>                      <span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce delay-100" />
>                      <span className="w-1.5 h-1.5 bg-pink-300 rounded-full animate-bounce delay-200" />
>                    </div>
>                  ) : (
>                    <ReplyChips
>                      suggestions={suggestions}
>                      onClick={(reply) => {
>                        setInputVal(reply);
>                        handleTranslate(reply);
>                      }}
>                    />
>                  )
>                )}
>              </div>
>            );
>          })}
>          {isLoading && (
>            <div className="flex justify-center mb-8">
>              <div className="bg-white/90 px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 text-pink-500 animate-pulse border border-pink-100">
>                <i className="fas fa-circle-notch fa-spin text-2xl" />
>                <span className="font-bold text-lg">AI 正在翻译...</span>
>              </div>
>            </div>
>          )}
>        </div>
>      </div>
>      {/* 底部输入区 */}
>      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white/95 to-white/0 pt-6 pb-[max(12px,env(safe-area-inset-bottom))]">
>        <div className="w-full max-w-[600px] mx-auto px-4">
>          {/* 语言切换栏 */}
>          <div className="flex items-center justify-center mb-2 px-1 relative">
>            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-sm rounded-full p-1 border border-white/50 shadow-sm mx-auto">
>              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all">
>                <span className="text-lg">{getLangFlag(sourceLang)}</span>
>                <span className="text-xs font-bold text-gray-700">{getLangName(sourceLang)}</span>
>              </div>
>              <button onClick={swapLangs} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-pink-500">
>                <i className="fas fa-exchange-alt text-xs" />
>              </button>
>              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all">
>                <span className="text-lg">{getLangFlag(targetLang)}</span>
>                <span className="text-xs font-bold text-gray-700">{getLangName(targetLang)}</span>
>              </div>
>            </div>
>            <button
>              onClick={() => setShowModelSelector(true)}
>              className={`absolute right-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
>                settings.secondModelId ? 'text-purple-500 bg-purple-50' : 'text-pink-400 hover:text-pink-600'
>              }`}
>            >
>              <i className="fas fa-robot" />
>              {settings.secondModelId && <span className="absolute top-0 right-0 w-2 h-2 bg-purple-500 rounded-full" />}
>            </button>
>          </div>
>          <div
>            className={`relative flex items-end gap-2 bg-white border rounded-[28px] p-1.5 shadow-sm transition-all duration-200 ${
>              isRecording ? 'border-pink-300 ring-2 ring-pink-100' : 'border-pink-100'
>            }`}
>          >
>            <Menu as="div" className="relative">
>              <Menu.Button className="w-10 h-11 flex items-center justify-center text-gray-400 hover:text-pink-500">
>                <i className="fas fa-camera" />
>              </Menu.Button>
>              <Transition
>                as={Fragment}
>                enter="transition ease-out duration-100"
>                enterFrom="transform opacity-0 scale-95"
>                enterTo="transform opacity-100 scale-100"
>                leave="transition ease-in duration-75"
>                leaveFrom="transform opacity-100 scale-100"
>                leaveTo="transform opacity-0 scale-95"
>              >
>                <Menu.Items className="absolute bottom-full left-0 mb-2 w-32 origin-bottom-left rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
>                  <div className="p-1">
>                    <Menu.Item>
>                      {({ active }) => (
>                        <button
>                          onClick={() => cameraInputRef.current?.click()}
>                          className={`${
>                            active ? 'bg-pink-50 text-pink-600' : 'text-gray-700'
>                          } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
>                        >
>                          <i className="fas fa-camera mr-2" /> 拍照
>                        </button>
>                      )}
>                    </Menu.Item>
>                    <Menu.Item>
>                      {({ active }) => (
>                        <button
>                          onClick={() => fileInputRef.current?.click()}
>                          className={`${
>                            active ? 'bg-pink-50 text-pink-600' : 'text-gray-700'
>                          } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
>                        >
>                          <i className="fas fa-image mr-2" /> 相册
>                        </button>
>                      )}
>                    </Menu.Item>
>                  </div>
>                </Menu.Items>
>              </Transition>
>            </Menu>
>            <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
>            <input
>              type="file"
>              ref={cameraInputRef}
>              accept="image/*"
>              capture="environment"
>              className="hidden"
>              onChange={handleImageSelect}
>            />
>            <div className="flex-1 flex flex-col justify-center min-h-[44px]">
>              {inputImages.length > 0 && (
>                <div className="flex gap-2 overflow-x-auto mb-1 ml-2 py-1 no-scrollbar">
>                  {inputImages.map((img, idx) => (
>                    <div key={idx} className="relative shrink-0">
>                      <img src={img} alt="preview" className="h-12 w-12 object-cover rounded border border-gray-200" />
>                      <button
>                        onClick={() => setInputImages((prev) => prev.filter((_, i) => i !== idx))}
>                        className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
>                      >
>                        <i className="fas fa-times" />
>                      </button>
>                    </div>
>                  ))}
>                </div>
>              )}
>              <textarea
>                className="w-full bg-transparent border-none outline-none resize-none px-2 py-2 max-h-32 text-[16px] leading-6 no-scrollbar placeholder-gray-400 text-gray-800"
>                placeholder={isRecording ? '' : '输入内容...'}
>                rows={1}
>                value={inputVal}
>                onChange={(e) => setInputVal(e.target.value)}
>                onKeyDown={(e) => {
>                  if (e.key === 'Enter' && !e.shiftKey) {
>                    e.preventDefault();
>                    handleTranslate();
>                  }
>                }}
>              />
>            </div>
>            <div className="w-11 h-11 flex items-center justify-center shrink-0 mb-0.5">
>              {isRecording ? (
>                <button
>                  onClick={stopAndSend}
>                  className="w-10 h-10 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center animate-pulse"
>                >
>                  <i className="fas fa-stop" />
>                </button>
>              ) : inputVal.trim().length > 0 || inputImages.length > 0 ? (
>                <button
>                  onClick={() => handleTranslate()}
>                  className="w-10 h-10 rounded-full bg-pink-500 text-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
>                >
>                  <i className="fas fa-arrow-up" />
>                </button>
>              ) : (
>                <button
>                  onClick={startRecording}
>                  className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-pink-50 hover:text-pink-500 transition-colors flex items-center justify-center"
>                >
>                  <i className="fas fa-microphone text-lg" />
>                </button>
>              )}
>            </div>
>          </div>
>        </div>
>      </div>
>      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />}
>      {showModelSelector && (
>        <ModelSelectorModal settings={settings} onClose={() => setShowModelSelector(false)} onSave={setSettings} />
>      )}
>    </div>
>  );
>};
>// ----------------- Drawer Wrapper -----------------
>const AIChatDrawer = ({ isOpen, onClose }) => {
>  return (
>    <Transition show={isOpen} as={Fragment}>
>      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
>        <Transition.Child
>          as={Fragment}
>          enter="ease-out duration-300"
>          enterFrom="opacity-0"
>          enterTo="opacity-100"
>          leave="ease-in duration-200"
>          leaveFrom="opacity-100"
>          leaveTo="opacity-0"
>        >
>          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
>        </Transition.Child>
>        <div className="fixed inset-0 overflow-hidden">
>          <div className="absolute inset-0 overflow-hidden">
>            <Transition.Child
>              as={Fragment}
>              enter="transform transition ease-in-out duration-300"
>              enterFrom="translate-y-full"
>              enterTo="translate-y-0"
>              leave="transform transition ease-in-out duration-300"
>              leaveFrom="translate-y-0"
>              leaveTo="translate-y-full"
>            >
>              <Dialog.Panel className="pointer-events-auto w-screen h-full">
>                <AiChatContent onClose={onClose} />
>              </Dialog.Panel>
>            </Transition.Child>
>          </div>
>        </div>
>      </Dialog>
>    </Transition>
>  );
>};
>export default AIChatDrawer;
