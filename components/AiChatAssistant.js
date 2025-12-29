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

// ----------------- 全局样式 (细滚动条) -----------------
const GlobalStyles = () => (
  <style>{`
    .slim-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .slim-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .slim-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 3px;
    }
    .slim-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.25);
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

// ----------------- Prompt -----------------
const DEFAULT_TRANSLATION_PROMPT = {
  content: `你是一位【多语种翻译专家】，专门处理日常聊天场景的翻译。

【核心任务】
接收用户发送的源语言文本，把它翻译成目标语言，输出4种不同版本供用户选择：
1) 贴近原文：逐句翻译尽量在保留原文意思下做必要的语法调整。
2) 自然直译：在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
3) 自然意译：保留原文完整含义，充分适应目标语言表达习惯，读起来流畅自然，像母语表达
4) 口语化：用当地人最自然流畅的社交表达方式。

【输出格式】
严格返回以下JSON，不要有任何额外文字：
{
  "data": [
    { "style": "贴近原文", "translation": "...", "back_translation": "..." },
    { "style": "自然直译", "translation": "...", "back_translation": "..." },
    { "style": "自然意译", "translation": "...", "back_translation": "..." },
    { "style": "口语化", "translation": "...", "back_translation": "..." }
  ]
}

【要求】
- 目标语言必须使用现代日常表达
- 回译(back_translation)必须忠实翻译回源语言
- 保持人称、时态、数字准确`,
  openingLine: '请发送你需要翻译的内容（支持语音输入）。'
};

// ----------------- Default Data -----------------
const DEFAULT_PROVIDERS = [
  { id: 'p1', name: '默认接口', url: 'https://apis.iflow.cn/v1', key: '' }
];

const DEFAULT_MODELS = [
  { id: 'm1', providerId: 'p1', name: 'DeepSeek V3.2', value: 'deepseek-v3.2' },
  { id: 'm2', providerId: 'p1', name: 'GLM-4.6', value: 'glm-4.6' },
  { id: 'm3', providerId: 'p1', name: 'Qwen3-Max', value: 'qwen3-max' }
];

const DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  models: DEFAULT_MODELS,
  activeProviderId: 'p1',
  activeModelId: 'm1',
  
  // TTS 设置
  ttsSpeed: 1.0, // 0.5 ~ 2.0
  ttsGenderPref: 'female', // female, male

  // 背景设置
  backgroundOverlay: 0.92, // 浅粉色底，不需要太透明，这里用高不透明度覆盖背景图
  chatBackgroundUrl: '', // 默认为空，使用纯色
  
  prompt: DEFAULT_TRANSLATION_PROMPT.content
};

// ----------------- UI Constants -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动识别' },
  { code: 'zh-CN', name: '中文' },
  { code: 'en-US', name: 'English' },
  { code: 'my-MM', name: '缅甸语' },
  { code: 'vi-VN', name: '越南语' },
  { code: 'th-TH', name: '泰语' },
  { code: 'lo-LA', name: '老挝语' },
  { code: 'ru-RU', name: '俄语' },
  { code: 'ja-JP', name: '日语' },
  { code: 'ko-KR', name: '韩语' },
  { code: 'km-KH', name: '柬埔寨语' },
  { code: 'id-ID', name: '印尼语' },
];

const SPEECH_LANGS = [
  { name: '中文', value: 'zh-CN', flag: '🇨🇳' },
  { name: 'မြန်မာ', value: 'my-MM', flag: '🇲🇲' },
  { name: 'Tiếng Việt', value: 'vi-VN', flag: '🇻🇳' },
  { name: 'ไทย', value: 'th-TH', flag: '🇹🇭' },
  { name: 'ລາວ', value: 'lo-LA', flag: '🇱🇦' },
  { name: 'English', value: 'en-US', flag: '🇺🇸' },
  { name: 'Русский', value: 'ru-RU', flag: '🇷🇺' },
  { name: '日本語', value: 'ja-JP', flag: '🇯🇵' },
  { name: '한국어', value: 'ko-KR', flag: '🇰🇷' }
];

// ----------------- TTS Implementation -----------------
const ttsCache = new Map();

const pickTtsVoice = (lang, genderPref) => {
  // 简化的映射策略，实际可扩展
  const isMale = genderPref === 'male';
  if (lang === 'my-MM') return isMale ? 'my-MM-ThihaNeural' : 'my-MM-NilarNeural';
  if (lang === 'vi-VN') return isMale ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
  if (lang === 'th-TH') return isMale ? 'th-TH-NiwatNeural' : 'th-TH-PremwadeeNeural';
  if (lang === 'ru-RU') return isMale ? 'ru-RU-DmitryNeural' : 'ru-RU-SvetlanaNeural';
  if (lang === 'en-US') return isMale ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
  if (lang === 'zh-CN') return isMale ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyouNeural';
  return isMale ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyouNeural'; // fallback
};

const preloadTTS = async (text, lang, settings) => {
  if (!text) return;
  const voice = pickTtsVoice(lang, settings.ttsGenderPref || 'female');
  const speed = settings.ttsSpeed || 1.0;
  // 转换 speed 0.5~2.0 到 API 的 rate 格式 (例如 -50% 到 +100%)
  // 这里简化处理，直接拼参数，假设后端支持 r 参数作为 rate
  // 注意：演示用API可能参数不同，这里沿用之前逻辑
  const key = `${voice}_${speed}_${text}`;
  if (ttsCache.has(key)) return;

  try {
    const rateVal = Math.floor((speed - 1) * 50); // 简单映射
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(voice)}&r=${rateVal}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('TTS API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preload = 'auto';
    ttsCache.set(key, audio);
  } catch (e) {
    console.error('TTS preload failed', e);
  }
};

const playCachedTTS = async (text, lang, settings) => {
  if (!text) return;
  const voice = pickTtsVoice(lang, settings.ttsGenderPref || 'female');
  const speed = settings.ttsSpeed || 1.0;
  const key = `${voice}_${speed}_${text}`;
  
  if (!ttsCache.has(key)) await preloadTTS(text, lang, settings);
  const audio = ttsCache.get(key);
  if (!audio) return;
  audio.currentTime = 0;
  // HTML5 Audio playbackRate
  audio.playbackRate = speed; 
  await audio.play().catch(console.error);
};

// ----------------- Parsing & Normalize -----------------
const safeParseAiJson = (raw) => {
  const s = (raw || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Invalid JSON');
  return JSON.parse(s.slice(start, end + 1));
};

const normalizeTranslations = (arr) => {
  const list = Array.isArray(arr) ? arr : [];
  const mapped = list.map((x, i) => ({
    style: x?.style || `方案 ${i + 1}`,
    translation: x?.translation || '',
    back_translation: x?.back_translation || ''
  })).filter(x => x.translation);
  
  if (!mapped.length) return [{ style: '错误', translation: '无法解析译文', back_translation: '' }];
  
  // 补齐4个
  const out = [...mapped];
  while(out.length < 4) {
    out.push({ ...out[0], style: `${out[0].style} (变体)` });
  }
  return out.slice(0, 4);
};

// ----------------- Components -----------------

// 1. 朗读按钮
const AiTtsButton = memo(({ text, lang, settings }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); playCachedTTS(text, lang, settings); }}
    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    title="朗读"
  >
    <i className="fas fa-volume-up text-sm" />
  </button>
));
AiTtsButton.displayName = 'AiTtsButton';

// 2. 翻译卡片
const TranslationCard = memo(({ result, targetLang, settings }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(result.translation || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      // fallback
    }
  };

  return (
    <div className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow mb-3">
      <div className="flex items-start gap-4">
        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-blue-600 mb-1.5 uppercase tracking-wide opacity-80">
            {result.style}
          </div>
          <div className="text-[17px] leading-relaxed text-gray-900 font-medium break-words">
            {result.translation}
          </div>
          {!!result.back_translation && (
            <div className="mt-2 text-[13px] leading-snug text-gray-500 break-words bg-gray-50 p-2 rounded-lg">
              回译: {result.back_translation}
            </div>
          )}
        </div>

        {/* 按钮区 */}
        <div className="flex flex-col gap-1 shrink-0">
          <AiTtsButton text={result.translation} lang={targetLang} settings={settings} />
          <button
            onClick={handleCopy}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${copied ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title="复制"
          >
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-sm`} />
          </button>
        </div>
      </div>
    </div>
  );
});
TranslationCard.displayName = 'TranslationCard';

// 3. 结果列表
const TranslationResults = memo(({ results, targetLang, settings }) => (
  <div className="w-full flex flex-col pb-4">
    {(results || []).map((r, i) => (
      <TranslationCard key={i} result={r} targetLang={targetLang} settings={settings} />
    ))}
  </div>
));
TranslationResults.displayName = 'TranslationResults';

// 4. 加载动画
const FancyLoading = () => (
  <div className="w-full max-w-[800px] mx-auto mt-6 px-2">
    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6 animate-pulse">
      <i className="fas fa-circle-notch fa-spin" />
      <span>AI 正在思考中...</span>
    </div>
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/60 border border-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="h-4 w-24 bg-gray-200/50 rounded mb-3" />
          <div className="h-5 w-3/4 bg-gray-200/50 rounded mb-2" />
          <div className="h-4 w-1/2 bg-gray-200/50 rounded" />
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      ))}
    </div>
    <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
  </div>
);

// ----------------- Modals -----------------

// 1. 通用全屏/弹窗外壳
const ModalWrapper = ({ children, title, onClose, className = "max-w-lg" }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
    <div className={`w-full ${className} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden`} onClick={e => e.stopPropagation()}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
        <div className="font-bold text-lg text-gray-800">{title}</div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 transition-colors">
          <i className="fas fa-times text-lg" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto slim-scrollbar bg-gray-50/50 p-2">
        {children}
      </div>
    </div>
  </div>
);

// 2. 供应商 & 模型选择器 (双栏布局)
const ProviderModelModal = ({ settings, onSelect, onClose }) => {
  const [activeProvId, setActiveProvId] = useState(settings.activeProviderId);
  const providers = settings.providers || [];
  const models = (settings.models || []).filter(m => m.providerId === activeProvId);

  return (
    <ModalWrapper title="切换模型" onClose={onClose} className="max-w-2xl h-[600px]">
      <div className="flex h-full gap-2">
        {/* 左侧：供应商 */}
        <div className="w-1/3 border-r border-gray-200 pr-2 overflow-y-auto slim-scrollbar">
          <div className="text-xs text-gray-400 font-bold px-2 py-1 mb-1">供应商</div>
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProvId(p.id)}
              className={cx(
                "w-full text-left px-3 py-3 rounded-xl text-sm font-medium mb-1 transition-all",
                activeProvId === p.id ? "bg-blue-600 text-white shadow-md" : "hover:bg-gray-200 text-gray-700"
              )}
            >
              <div className="truncate">{p.name}</div>
            </button>
          ))}
        </div>
        
        {/* 右侧：模型 */}
        <div className="flex-1 pl-2 overflow-y-auto slim-scrollbar">
          <div className="text-xs text-gray-400 font-bold px-2 py-1 mb-1">可用模型</div>
          {models.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-10">该供应商下暂无模型配置</div>
          ) : (
            models.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  onSelect(activeProvId, m.id);
                  onClose();
                }}
                className={cx(
                  "w-full text-left px-4 py-3 rounded-xl border mb-2 transition-all group",
                  settings.activeModelId === m.id && settings.activeProviderId === activeProvId
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white hover:border-blue-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-800 text-sm">{m.name}</div>
                  {(settings.activeModelId === m.id && settings.activeProviderId === activeProvId) && <i className="fas fa-check text-blue-600" />}
                </div>
                <div className="text-xs text-gray-500 mt-1 opacity-70 group-hover:opacity-100">{m.value}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

// 3. 复杂设置面板 (包含供应商管理、Prompt、TTS、背景)
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(settings)));
  const [tab, setTab] = useState('provider'); // provider, prompt, style

  // 供应商 CRUD
  const updateProvider = (idx, field, val) => {
    const arr = [...formData.providers];
    arr[idx] = { ...arr[idx], [field]: val };
    setFormData({ ...formData, providers: arr });
  };
  const addProvider = () => {
    const newId = nowId();
    setFormData(prev => ({
      ...prev,
      providers: [...prev.providers, { id: newId, name: '新供应商', url: '', key: '' }]
    }));
  };
  const delProvider = (id) => {
    if (formData.providers.length <= 1) return alert('至少保留一个供应商');
    setFormData(prev => ({
      ...prev,
      providers: prev.providers.filter(p => p.id !== id),
      // 如果删除了当前选中的，重置选中
      activeProviderId: prev.activeProviderId === id ? prev.providers.find(p => p.id !== id).id : prev.activeProviderId
    }));
  };

  // 模型 CRUD
  const getModelsByProv = (pid) => formData.models.filter(m => m.providerId === pid);
  const addModel = (pid) => {
    setFormData(prev => ({
      ...prev,
      models: [...prev.models, { id: nowId(), providerId: pid, name: '新模型', value: '' }]
    }));
  };
  const updateModel = (mid, field, val) => {
    setFormData(prev => ({
      ...prev,
      models: prev.models.map(m => m.id === mid ? { ...m, [field]: val } : m)
    }));
  };
  const delModel = (mid) => {
    setFormData(prev => ({
      ...prev,
      models: prev.models.filter(m => m.id !== mid)
    }));
  };

  return (
    <ModalWrapper title="全局设置" onClose={onClose} className="max-w-3xl h-[80vh]">
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex gap-2 px-2 pb-2 border-b border-gray-100">
          {[
            { id: 'provider', label: '供应商管理' },
            { id: 'style', label: '样式与语音' },
            { id: 'prompt', label: '系统提示词' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                tab === t.id ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto slim-scrollbar p-4 bg-gray-50">
          
          {tab === 'provider' && (
            <div className="space-y-6">
              {formData.providers.map((p, idx) => (
                <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      className="font-bold text-gray-900 border-none focus:ring-0 bg-transparent text-lg p-0"
                      value={p.name}
                      onChange={e => updateProvider(idx, 'name', e.target.value)}
                    />
                    <button onClick={() => delProvider(p.id)} className="text-red-500 text-xs px-2 py-1 bg-red-50 rounded">删除供应商</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">API URL (Base URL)</label>
                      <input className="w-full text-xs p-2 border rounded bg-gray-50" value={p.url} onChange={e => updateProvider(idx, 'url', e.target.value)} placeholder="https://..." />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">API Key</label>
                      <input className="w-full text-xs p-2 border rounded bg-gray-50" type="password" value={p.key} onChange={e => updateProvider(idx, 'key', e.target.value)} placeholder="sk-..." />
                    </div>
                  </div>

                  {/* 模型列表 */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-500">关联模型列表</span>
                      <button onClick={() => addModel(p.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">+ 添加模型</button>
                    </div>
                    <div className="space-y-2">
                      {getModelsByProv(p.id).map(m => (
                        <div key={m.id} className="flex gap-2 items-center">
                          <input className="flex-1 text-xs p-1.5 border rounded" placeholder="显示名" value={m.name} onChange={e => updateModel(m.id, 'name', e.target.value)} />
                          <input className="flex-1 text-xs p-1.5 border rounded font-mono" placeholder="模型Value (如 gpt-4)" value={m.value} onChange={e => updateModel(m.id, 'value', e.target.value)} />
                          <button onClick={() => delModel(m.id)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addProvider} className="w-full py-3 bg-white border border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50">
                + 添加新供应商
              </button>
            </div>
          )}

          {tab === 'style' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <div className="font-bold text-gray-800 mb-4">TTS 语音设置</div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">默认音色偏好</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    {['male', 'female'].map(g => (
                      <button
                        key={g}
                        onClick={() => setFormData({...formData, ttsGenderPref: g})}
                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.ttsGenderPref === g ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}
                      >
                        {g === 'male' ? '男声' : '女声'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>语速调节</span>
                    <span>{formData.ttsSpeed}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="2.0" step="0.1"
                    className="w-full accent-blue-600"
                    value={formData.ttsSpeed}
                    onChange={e => setFormData({...formData, ttsSpeed: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm">
                <div className="font-bold text-gray-800 mb-4">背景设置</div>
                <label className="block text-xs text-gray-500 mb-1">背景图 URL (留空则纯色)</label>
                <input
                  className="w-full text-sm p-2 border rounded mb-3"
                  value={formData.chatBackgroundUrl}
                  onChange={e => setFormData({...formData, chatBackgroundUrl: e.target.value})}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {tab === 'prompt' && (
            <div className="bg-white p-4 rounded-xl shadow-sm h-full flex flex-col">
              <div className="text-sm text-gray-500 mb-2">如果不清楚请勿随意修改，必须保持 JSON 输出约束。</div>
              <textarea
                className="flex-1 w-full border border-gray-200 rounded-lg p-3 text-sm font-mono leading-relaxed resize-none focus:ring-1 focus:ring-blue-500 outline-none"
                value={formData.prompt}
                onChange={e => setFormData({...formData, prompt: e.target.value})}
              />
            </div>
          )}

        </div>

        <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">取消</button>
          <button onClick={() => { onSave(formData); onClose(); }} className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">保存设置</button>
        </div>
      </div>
    </ModalWrapper>
  );
};

// ----------------- Main Chat Logic -----------------
const AiChatContent = ({ onClose }) => {
  // --- States ---
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isMounted, setIsMounted] = useState(false);
  
  // 语言 & 输入
  const [speechLang, setSpeechLang] = useState('zh-CN');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my-MM');
  
  const [userInput, setUserInput] = useState('');
  const [currentMessage, setCurrentMessage] = useState(null); // 单轮对话：仅存最新一条 { text, translations, error, ... }
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 语音识别状态
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // 弹窗控制
  const [modalState, setModalState] = useState({ type: null }); // type: 'providerModel', 'settings', 'speechLang', 'sourceLang', 'targetLang'

  // --- Effects ---
  useEffect(() => {
    setIsMounted(true);
    // 加载设置
    const saved = safeLocalStorageGet('ai_886_settings');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        // Merge to ensure new fields exist
        setSettings(prev => ({ ...prev, ...p }));
      } catch (e) { console.error(e); }
    }
    
    // 加载上次语言偏好
    const lastLangs = safeLocalStorageGet('ai_886_langs');
    if (lastLangs) {
      try {
        const { s, t, sp } = JSON.parse(lastLangs);
        if (s) setSourceLang(s);
        if (t) setTargetLang(t);
        if (sp) setSpeechLang(sp);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    safeLocalStorageSet('ai_886_settings', JSON.stringify(settings));
  }, [settings, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    safeLocalStorageSet('ai_886_langs', JSON.stringify({ s: sourceLang, t: targetLang, sp: speechLang }));
  }, [sourceLang, targetLang, speechLang, isMounted]);

  // --- Logic: Fetch AI ---
  const fetchTranslation = async (text) => {
    const { activeProviderId, activeModelId, providers, models, prompt } = settings;
    const provider = providers.find(p => p.id === activeProviderId);
    const model = models.find(m => m.id === activeModelId);

    if (!provider || !provider.key) throw new Error('请先在设置中配置有效的 API Key');
    if (!model) throw new Error('未选择有效模型');

    const systemPrompt = prompt || DEFAULT_TRANSLATION_PROMPT.content;
    const userPrompt = `Source: ${sourceLang}\nTarget: ${targetLang}\nContent:\n${text}`;

    const res = await fetch(`${provider.url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: model.value,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 请求失败 ${res.status}`);
    }
    
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    const parsed = safeParseAiJson(raw);
    return normalizeTranslations(parsed.data || parsed);
  };

  const handleSubmit = async (overrideText = null) => {
    const text = (overrideText || userInput).trim();
    if (!text) return;

    // 清空历史，开始新的一轮
    setCurrentMessage({ role: 'user', text, ts: Date.now() }); 
    setErrorMsg('');
    setIsLoading(true);
    setUserInput(''); // 清空输入框

    try {
      // 1. 查字典
      const dict = await loadCheatDict(sourceLang);
      const hit = matchCheatLoose(dict, text, targetLang);
      
      if (hit) {
        const trans = normalizeTranslations(hit);
        setCurrentMessage(prev => ({ ...prev, role: 'ai', translations: trans, from: 'dict' }));
        preloadTTS(trans[0].translation, targetLang, settings);
      } else {
        // 2. AI 请求
        const trans = await fetchTranslation(text);
        setCurrentMessage(prev => ({ ...prev, role: 'ai', translations: trans, from: 'ai' }));
        preloadTTS(trans[0].translation, targetLang, settings);
      }
    } catch (e) {
      setErrorMsg(e.message);
      setCurrentMessage(prev => ({ ...prev, error: true }));
    } finally {
      setIsLoading(false);
    }
  };

  // --- Logic: Speech ---
  const toggleSpeech = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别，请尝试使用 Chrome 或 Safari。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMsg('');
    };
    recognition.onresult = (e) => {
      const trans = Array.from(e.results).map(r => r[0].transcript).join('');
      setUserInput(trans);
      if (e.results[0].isFinal && trans.trim()) {
        handleSubmit(trans);
      }
    };
    recognition.onerror = (e) => {
      console.error(e);
      if (e.error === 'not-allowed') alert('请允许麦克风权限');
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, speechLang, settings]); // eslint-disable-line

  // --- Helpers for Display ---
  const activeModelName = settings.models.find(m => m.id === settings.activeModelId)?.name || '选择模型';
  const getLangName = c => SUPPORTED_LANGUAGES.find(l => l.code === c)?.name || c;

  if (!isMounted) return null;

  return (
    <div className="flex flex-col w-full h-[100dvh] text-gray-900 relative overflow-hidden bg-[#FFF0F5]">
      <GlobalStyles />
      
      {/* Background Image Layer (Optional) */}
      {settings.chatBackgroundUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-500"
          style={{ backgroundImage: `url('${settings.chatBackgroundUrl}')`, opacity: 1 - settings.backgroundOverlay }}
        />
      )}
      
      {/* Top Bar */}
      <div className="relative z-10 bg-white/80 backdrop-blur-md border-b border-pink-100 pt-safe-top shadow-sm">
        <div className="w-full max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              <i className="fas fa-language" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-gray-900 text-[15px] leading-tight">886.best</span>
              <span className="text-[10px] text-pink-600 font-medium">Ai翻译支持100多种语言</span>
            </div>
          </div>
          
          <button 
            onClick={() => setModalState({ type: 'settings' })}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <i className="fas fa-cog" />
          </button>
        </div>
      </div>

      {/* Main Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto slim-scrollbar relative z-10 px-4 py-6">
        <div className="w-full max-w-[800px] mx-auto min-h-full flex flex-col justify-end pb-40">
          
          {/* Default Welcome */}
          {!currentMessage && !isLoading && (
            <div className="flex flex-col items-center justify-center opacity-40 mt-20">
              <i className="fas fa-comments text-6xl mb-4 text-pink-300" />
              <p className="text-gray-500">开始新的对话...</p>
            </div>
          )}

          {/* User Message Bubble */}
          {currentMessage && (
            <div className="flex justify-center mb-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white border-2 border-pink-100 px-6 py-4 rounded-[24px] shadow-sm max-w-full text-center">
                 <div className="text-lg md:text-xl font-medium text-gray-800 break-words">{currentMessage.text}</div>
              </div>
            </div>
          )}

          {/* AI Results */}
          {isLoading && <FancyLoading />}
          
          {currentMessage?.translations && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
               <TranslationResults results={currentMessage.translations} targetLang={targetLang} settings={settings} />
               
               {/* Regenerate Button */}
               <div className="flex justify-center mt-4">
                 <button 
                   onClick={() => handleSubmit(currentMessage.text)}
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                 >
                   <i className="fas fa-sync-alt" />
                   重新生成
                 </button>
               </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm border border-red-100 shadow-sm mx-auto w-full max-w-md mt-4">
              <div className="font-bold mb-1">出错了</div>
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Fixed Area */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white to-white/90 backdrop-blur-lg pt-2 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <div className="w-full max-w-[800px] mx-auto px-4">
          
          {/* Tool Bar */}
          <div className="flex items-center justify-between mb-3 px-1">
            {/* 语音语言选择 */}
            <button
              onClick={() => setModalState({ type: 'speechLang' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <i className="fas fa-microphone" />
              <span>{SPEECH_LANGS.find(s => s.value === speechLang)?.name || speechLang}</span>
            </button>

            {/* 翻译方向 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              <button onClick={() => setModalState({ type: 'sourceLang' })} className="px-3 py-1 rounded-md text-xs font-bold text-gray-700 hover:bg-white shadow-sm transition-all">
                {getLangName(sourceLang)}
              </button>
              <i className="fas fa-arrow-right text-[10px] text-gray-400" />
              <button onClick={() => setModalState({ type: 'targetLang' })} className="px-3 py-1 rounded-md text-xs font-bold text-gray-700 hover:bg-white shadow-sm transition-all">
                {getLangName(targetLang)}
              </button>
            </div>

            {/* 模型切换 */}
            <button 
              onClick={() => setModalState({ type: 'providerModel' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <i className="fas fa-robot" />
              <span className="max-w-[80px] truncate">{activeModelName}</span>
            </button>
          </div>

          {/* Input Bar */}
          <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-[24px] p-2 focus-within:ring-2 focus-within:ring-pink-200 focus-within:border-pink-300 transition-all shadow-inner">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入文字或语音..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none py-3 px-3 min-h-[48px] max-h-32 text-[16px] leading-6"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            
            {userInput.trim() ? (
              <button
                onClick={() => handleSubmit()}
                className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all mb-0.5"
              >
                <i className="fas fa-arrow-up text-lg" />
              </button>
            ) : (
              <button
                onClick={toggleSpeech}
                className={cx(
                  "w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all mb-0.5",
                  isListening ? "bg-red-500 text-white animate-pulse scale-110" : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                <i className={`fas ${isListening ? 'fa-square' : 'fa-microphone'} text-lg`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Render Modals */}
      {modalState.type === 'settings' && (
        <SettingsModal settings={settings} onSave={setSettings} onClose={() => setModalState({ type: null })} />
      )}
      
      {modalState.type === 'providerModel' && (
        <ProviderModelModal 
          settings={settings} 
          onSelect={(pid, mid) => setSettings(p => ({ ...p, activeProviderId: pid, activeModelId: mid }))} 
          onClose={() => setModalState({ type: null })} 
        />
      )}

      {(['sourceLang', 'targetLang'].includes(modalState.type)) && (
        <ModalWrapper title={modalState.type === 'sourceLang' ? '源语言' : '目标语言'} onClose={() => setModalState({ type: null })}>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => {
                  if (modalState.type === 'sourceLang') setSourceLang(l.code);
                  else setTargetLang(l.code);
                  setModalState({ type: null });
                }}
                className={`p-3 rounded-xl text-left border ${
                  (modalState.type === 'sourceLang' ? sourceLang : targetLang) === l.code 
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' 
                  : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="text-sm">{l.name}</div>
                <div className="text-[10px] opacity-50">{l.code}</div>
              </button>
            ))}
          </div>
        </ModalWrapper>
      )}

      {modalState.type === 'speechLang' && (
        <ModalWrapper title="语音识别语言" onClose={() => setModalState({ type: null })}>
          <div className="grid grid-cols-2 gap-2">
            {SPEECH_LANGS.map(l => (
              <button
                key={l.value}
                onClick={() => {
                  setSpeechLang(l.value);
                  setModalState({ type: null });
                }}
                className={`p-3 rounded-xl text-left border flex items-center gap-2 ${
                  speechLang === l.value ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <div>
                  <div className="text-sm font-bold text-gray-800">{l.name}</div>
                  <div className="text-[10px] text-gray-500">{l.value}</div>
                </div>
              </button>
            ))}
          </div>
        </ModalWrapper>
      )}

      <button onClick={onClose} className="fixed top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 text-white md:hidden">
        <i className="fas fa-times" />
      </button>
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
