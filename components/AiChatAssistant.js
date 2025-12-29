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

// ----------------- helpers -----------------
const convertGitHubUrl = (url) => {
  if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
};

const safeLocalStorageGet = (key) =>
  (typeof window !== 'undefined' ? localStorage.getItem(key) : null);

const safeLocalStorageSet = (key, value) => {
  if (typeof window !== 'undefined') localStorage.setItem(key, value);
};

const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const cx = (...arr) => arr.filter(Boolean).join(' ');

// ----------------- prompt (YOUR prompt) -----------------
const DEFAULT_TRANSLATION_PROMPT = {
  content: `你是一位【多语种翻译专家】，专门处理日常聊天场景的翻译。

【核心任务】
接收用户发送的源语言文本，把它翻译成目标语言，输出4种不同版本供用户选择：
1) 贴近原文
2) 自然直译
3) 自然意译
4) 口语化

【翻译规则（必须严格遵守）】
1. 贴近原文
- 尽量保留原文的句式结构、语序和关键词对应
- 在确保信息完整的前提下，做必要的语法调整
- 优先保证准确性，允许适度的不自然感

2. 自然直译
- 保留原文逻辑顺序和主要结构
- 调整语序使其符合目标语言语法习惯
- 平衡准确性和自然度，译文基本流畅

3. 自然意译
- 保留原文完整含义，充分适应目标语言表达习惯
- 可以调整语序、重组句式，选择最自然的说法
- 读起来流畅自然，像母语表达

4. 口语化
- 用日常对话的方式表达原文意思
- 使用简短句式、常用词汇和口语习惯
- 可适当添加语气词，更亲切接地气

【翻译后自检（必须执行）】
逐句检查是否有：增删、改语气、改时间先后、改否定/疑问；如有立刻修正。

【输出格式】
严格返回以下JSON，不要有任何额外文字、解释或代码块标记：
{
  "data": [
    { "style": "贴近原文", "translation": "翻译结果", "back_translation": "回译结果" },
    { "style": "自然直译", "translation": "翻译结果", "back_translation": "回译结果" },
    { "style": "自然意译", "translation": "翻译结果", "back_translation": "回译结果" },
    { "style": "口语化", "translation": "翻译结果", "back_translation": "回译结果" }
  ]
}

【语言要求】
- 目标语言必须使用现代日常表达
- 回译(back_translation)必须忠实翻译回源语言
- 人称、称呼、时态、数字、时间地点必须一致
- 不使用生僻俚语或网络流行语

现在等待用户的文本输入。`,
  openingLine: '请发送你需要翻译的内容（支持语音输入）。'
};

// ----------------- models -----------------
const DEFAULT_MODELS = [
  { id: 'm1', name: 'DeepSeek V3.2', value: 'deepseek-v3.2' },
  { id: 'm2', name: 'GLM-4.6', value: 'glm-4.6' },
  { id: 'm3', name: 'Qwen3-235B', value: 'qwen3-235b' },
  { id: 'm4', name: 'Qwen3-Max', value: 'qwen3-max' }
];

const DEFAULT_SETTINGS = {
  apiConfig: { url: 'https://apis.iflow.cn/v1', key: '' },
  chatModels: DEFAULT_MODELS,
  selectedModel: 'deepseek-v3.2',
  chatBackgroundUrl: '/images/chat-bg-light.jpg',
  backgroundOverlay: 0.10, // 0~1 (white overlay)
  prompt: DEFAULT_TRANSLATION_PROMPT.content
};

// ----------------- translate langs (UI) -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动识别' },
  { code: 'zh-CN', name: '中文' },
  { code: 'my-MM', name: '缅甸语' },
  { code: 'vi-VN', name: '越南语' },
  { code: 'th-TH', name: '泰语' },
  { code: 'lo-LA', name: '老挝语' },
  { code: 'ru-RU', name: '俄语' },
  // 你说支持100+：这里仅 UI 列表。要全量就把列表扩展即可（不影响核心功能）
];

// ----------------- speech langs -----------------
const SPEECH_LANGS = [
  { name: '中文', value: 'zh-CN', flag: '🇨🇳', group: 'common' },
  { name: 'မြန်မာ', value: 'my-MM', flag: '🇲🇲', group: 'common' },
  { name: 'Tiếng Việt', value: 'vi-VN', flag: '🇻🇳', group: 'common' },
  { name: 'ไทย', value: 'th-TH', flag: '🇹🇭', group: 'common' },
  { name: 'ລາວ', value: 'lo-LA', flag: '🇱🇦', group: 'common' },
  { name: 'English', value: 'en-US', flag: '🇺🇸', group: 'common' },
  { name: 'Русский', value: 'ru-RU', flag: '🇷🇺', group: 'common' }
];

// ----------------- TTS -----------------
const ttsCache = new Map();

const pickTtsVoiceByLang = (lang) => {
  if (lang === 'my-MM') return 'my-MM-NilarNeural';
  if (lang === 'vi-VN') return 'vi-VN-HoaiMyNeural';
  if (lang === 'th-TH') return 'th-TH-PremwadeeNeural';
  if (lang === 'lo-LA') return 'lo-LA-KeomanyNeural';
  if (lang === 'ru-RU') return 'ru-RU-SvetlanaNeural';
  return 'zh-CN-XiaoyouNeural';
};

const preloadTTS = async (text, lang) => {
  if (!text) return;
  const voice = pickTtsVoiceByLang(lang);
  const key = `${voice}__${text}`;
  if (ttsCache.has(key)) return;

  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(voice)}&r=-25`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preload = 'auto';
    ttsCache.set(key, audio);
  } catch (e) {
    console.error('TTS preload failed:', e);
  }
};

const playCachedTTS = async (text, lang) => {
  if (!text) return;
  const voice = pickTtsVoiceByLang(lang);
  const key = `${voice}__${text}`;
  if (!ttsCache.has(key)) await preloadTTS(text, lang);
  const audio = ttsCache.get(key);
  if (!audio) return;
  audio.currentTime = 0;
  await audio.play().catch(() => {});
};

// ----------------- robust JSON parsing & normalize -----------------
const safeParseAiJson = (raw) => {
  const s = (raw || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  const jsonStr = start >= 0 && end > start ? s.slice(start, end + 1) : s;
  return JSON.parse(jsonStr);
};

const normalizeTranslations = (arr) => {
  const a = Array.isArray(arr) ? arr : [];
  const mapped = a
    .map((x, idx) => ({
      style: String(x?.style ?? ['贴近原文', '自然直译', '自然意译', '口语化'][idx] ?? '').trim(),
      translation: String(x?.translation ?? '').trim(),
      back_translation: String(x?.back_translation ?? '').trim()
    }))
    .filter((x) => x.translation || x.back_translation);

  const base = mapped.length ? mapped : [{ style: '（无有效译文）', translation: '（无有效译文）', back_translation: '' }];
  const out = base.slice(0, 4);
  while (out.length < 4) out.push(out[out.length - 1]);
  return out;
};

const getLangName = (code) =>
  SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code;

// speechLang -> auto set source/target
const applySpeechLangToTranslatePair = (speechLang) => {
  if (speechLang === 'zh-CN') return { source: 'zh-CN', target: 'my-MM' };
  if (speechLang === 'my-MM') return { source: 'my-MM', target: 'zh-CN' };
  if (speechLang === 'vi-VN') return { source: 'vi-VN', target: 'zh-CN' };
  if (speechLang === 'th-TH') return { source: 'th-TH', target: 'zh-CN' };
  if (speechLang === 'lo-LA') return { source: 'lo-LA', target: 'zh-CN' };
  if (speechLang === 'ru-RU') return { source: 'ru-RU', target: 'zh-CN' };
  return null;
};

// ----------------- small request cache (speed) -----------------
const aiCache = new Map();
const cacheKeyOf = ({ model, sourceLang, targetLang, text }) =>
  `${model}__${sourceLang}__${targetLang}__${text}`;

// ----------------- UI components -----------------
const AiTtsButton = memo(({ text, targetLang }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); playCachedTTS(text, targetLang); }}
    className="p-1.5 text-xs rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10"
    title="朗读"
  >
    <i className="fas fa-volume-up" />
  </button>
));
AiTtsButton.displayName = 'AiTtsButton';

const TranslationCard = memo(({ result, targetLang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(result.translation || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="w-full max-w-[860px] mx-auto bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-gray-500 mb-1">
            {result.style || '译文'}
          </div>
          <div className="text-[15px] leading-relaxed text-gray-900 break-words">
            {result.translation}
          </div>
          {!!result.back_translation && (
            <div className="mt-2 text-[12px] leading-snug text-blue-700/90 break-words">
              {result.back_translation}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0 pt-0.5">
          <AiTtsButton text={result.translation} targetLang={targetLang} />
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-xs rounded-full text-gray-500 hover:bg-black/10"
            title="复制"
          >
            <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-copy'}`} />
          </button>
        </div>
      </div>
    </div>
  );
});
TranslationCard.displayName = 'TranslationCard';

const TranslationResults = memo(({ results, targetLang }) => (
  <div className="w-full flex flex-col gap-2.5 py-3">
    {(results || []).slice(0, 4).map((r, i) => (
      <TranslationCard key={i} result={r} targetLang={targetLang} />
    ))}
  </div>
));
TranslationResults.displayName = 'TranslationResults';

const FancyLoading = () => (
  <div className="w-full max-w-[860px] mx-auto mt-4">
    <div className="text-center text-xs text-gray-600 mb-3">正在翻译…</div>
    <div className="grid gap-2.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm overflow-hidden relative"
        >
          <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-4/5 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-3/5 bg-gray-200 rounded" />
          <div
            className="absolute inset-0 -translate-x-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(59,130,246,0.12), transparent)',
              animation: 'shine 1.1s infinite'
            }}
          />
        </div>
      ))}
    </div>

    <style>{`
      @keyframes shine {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
    `}</style>
  </div>
);

// ----------------- Modals -----------------
const SpeechLangModal = ({ selectedValue, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex p-4" onClick={onClose}>
      <div className="w-full max-w-lg m-auto bg-white rounded-2xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="font-bold text-gray-900">选择语音识别语言</div>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            长按麦克风打开；点击立即生效
          </div>
        </div>

        <div className="p-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {SPEECH_LANGS.map((opt) => (
              <button
                key={opt.value + opt.name}
                type="button"
                onClick={() => { onSelect(opt.value); onClose(); }}
                className={cx(
                  'rounded-xl p-3 text-left border transition-colors',
                  selectedValue === opt.value
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{opt.flag}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{opt.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">{opt.value}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModelModal = ({ models, selectedValue, onSelect, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex p-4" onClick={onClose}>
    <div className="w-full max-w-md m-auto bg-white rounded-2xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="font-bold text-gray-900">切换模型</div>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <i className="fas fa-times" />
        </button>
      </div>
      <div className="p-2 max-h-[60vh] overflow-y-auto">
        {(models || []).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { onSelect(m.value); onClose(); }}
            className={cx(
              'w-full text-left px-4 py-3 rounded-xl text-sm',
              selectedValue === m.value
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'hover:bg-gray-50 text-gray-900'
            )}
          >
            {m.name}
            <div className="text-[11px] opacity-60 mt-0.5">{m.value}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const LanguagePickerModal = ({ title, value, options, onSelect, onClose, disableAuto = false }) => {
  const list = disableAuto ? options.filter((x) => x.code !== 'auto') : options;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex p-4" onClick={onClose}>
      <div className="w-full max-w-lg m-auto bg-white rounded-2xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">{title}</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-3 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {list.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => { onSelect(opt.code); onClose(); }}
                className={cx(
                  'rounded-xl p-3 text-left border transition-colors',
                  value === opt.code
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                )}
              >
                <div className="font-semibold text-sm text-gray-900 truncate">{opt.name}</div>
                <div className="text-[11px] text-gray-500 truncate">{opt.code}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings: API + prompt + model management + background
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [temp, setTemp] = useState(settings);
  const [isKeyVisible, setKeyVisible] = useState(false);

  const addModel = () => {
    const name = prompt('模型显示名（例如：My Model）');
    if (!name) return;
    const value = prompt('模型 value（请求时的 model 字段，例如：gpt-4o-mini）');
    if (!value) return;
    setTemp((p) => ({
      ...p,
      chatModels: [...(p.chatModels || []), { id: nowId(), name, value }]
    }));
  };

  const removeModel = (id) => {
    setTemp((p) => ({
      ...p,
      chatModels: (p.chatModels || []).filter((m) => m.id !== id)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[10002] p-4 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="text-lg font-bold text-gray-900">设置</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="font-semibold mb-2">API（OpenAI 兼容）</div>
            <label className="text-xs text-gray-500">接口地址</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-white border-gray-200"
              value={temp.apiConfig.url}
              onChange={(e) => setTemp((p) => ({ ...p, apiConfig: { ...p.apiConfig, url: e.target.value } }))}
              placeholder="https://apis.iflow.cn/v1"
            />

            <div className="mt-3">
              <label className="text-xs text-gray-500">密钥</label>
              <div className="relative">
                <input
                  className="w-full mt-1 px-3 py-2 pr-10 rounded-lg border bg-white border-gray-200"
                  type={isKeyVisible ? 'text' : 'password'}
                  value={temp.apiConfig.key}
                  onChange={(e) => setTemp((p) => ({ ...p, apiConfig: { ...p.apiConfig, key: e.target.value } }))}
                  placeholder="Bearer key"
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500"
                  title="显示/隐藏"
                >
                  <i className={`fas ${isKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold">模型管理</div>
              <button
                type="button"
                onClick={addModel}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs"
              >
                添加模型
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {(temp.chatModels || []).map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{m.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">{m.value}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeModel(m.id)}
                    className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="font-semibold mb-2">提示词（系统）</div>
            <textarea
              className="w-full min-h-[160px] p-3 rounded-xl border border-gray-200 bg-white text-sm leading-5"
              value={temp.prompt ?? DEFAULT_TRANSLATION_PROMPT.content}
              onChange={(e) => setTemp((p) => ({ ...p, prompt: e.target.value }))}
            />
            <div className="text-[11px] text-gray-500 mt-2">
              建议保持“严格 JSON 输出”的约束，否则前端解析会失败。
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="font-semibold mb-2">背景</div>
            <label className="text-xs text-gray-500">背景图 URL</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-white border-gray-200"
              value={temp.chatBackgroundUrl}
              onChange={(e) => setTemp((p) => ({ ...p, chatBackgroundUrl: e.target.value }))}
              placeholder="/images/chat-bg-light.jpg"
            />

            <label className="text-xs text-gray-500 mt-3 block">白色遮罩强度（越大越“浅色不透明”）</label>
            <input
              className="w-full mt-1"
              type="range"
              min="0"
              max="0.35"
              step="0.01"
              value={temp.backgroundOverlay ?? 0.10}
              onChange={(e) => setTemp((p) => ({ ...p, backgroundOverlay: parseFloat(e.target.value) }))}
            />
            <div className="text-xs text-gray-500 mt-1">当前：{temp.backgroundOverlay ?? 0.10}</div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200">
            关闭
          </button>
          <button
            type="button"
            onClick={() => onSave(temp)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------- Core -----------------
const AiChatContent = ({ onClose }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isMounted, setIsMounted] = useState(false);

  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]); // keep user msg + result msg

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my-MM');

  const [speechLang, setSpeechLang] = useState('zh-CN');
  const [isListening, setIsListening] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSpeechSelector, setShowSpeechSelector] = useState(false);

  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const pressTimerRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    const saved = safeLocalStorageGet('ai_chat_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          chatModels: parsed.chatModels?.length ? parsed.chatModels : DEFAULT_MODELS
        });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
    setTimeout(() => window.scrollTo(0, 1), 60);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings));
  }, [settings, isMounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto' || sourceLang === targetLang) return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入。');
      return;
    }

    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = speechLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
      setUserInput('');
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join('');
      setUserInput(transcript);

      if (event.results?.[0]?.isFinal && transcript.trim()) {
        handleSubmit(transcript);
      }
    };

    recognition.onerror = (event) => {
      setError(`语音识别失败: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [speechLang]); // eslint-disable-line

  const handleMicPress = () => {
    pressTimerRef.current = setTimeout(() => setShowSpeechSelector(true), 500);
  };
  const handleMicRelease = () => clearTimeout(pressTimerRef.current);

  const fetchAiResponse = async (text) => {
    const { apiConfig, selectedModel } = settings;
    if (!apiConfig?.key) throw new Error('请在设置中配置 API Key');

    const prompt = settings.prompt || DEFAULT_TRANSLATION_PROMPT.content;

    const userPrompt =
      `源语言: ${getLangName(sourceLang)}\n` +
      `目标语言: ${getLangName(targetLang)}\n` +
      `请翻译以下文本：\n${text}`;

    const cKey = cacheKeyOf({ model: selectedModel, sourceLang, targetLang, text });
    if (aiCache.has(cKey)) return aiCache.get(cKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(`${apiConfig.url}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.key}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `请求失败: ${response.status}`);
      }

      const data = await response.json();
      const raw = data?.choices?.[0]?.message?.content;

      let parsed;
      try {
        parsed = safeParseAiJson(raw);
      } catch {
        const fallback = normalizeTranslations([{ style: '解析失败', translation: raw || '（解析失败）', back_translation: '' }]);
        aiCache.set(cKey, fallback);
        return fallback;
      }

      const translations = normalizeTranslations(parsed?.data ?? parsed);
      aiCache.set(cKey, translations);
      return translations;
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleSubmit = async (textToSend = null) => {
    const text = (textToSend ?? userInput).trim();
    if (!text) return;

    setError('');
    setIsLoading(true);

    // keep user message
    const userMsgId = nowId();
    setMessages((p) => [...p, { id: userMsgId, role: 'user', text, ts: Date.now() }]);
    setUserInput('');

    try {
      // dict first
      const dict = await loadCheatDict(sourceLang);
      const hit = matchCheatLoose(dict, text, targetLang);
      if (hit) {
        const translations = normalizeTranslations(hit);
        setMessages((p) => [
          ...p,
          { id: nowId(), role: 'ai', from: 'dict', translations, ts: Date.now() }
        ]);
        preloadTTS(translations?.[0]?.translation, targetLang);
        return;
      }

      const translations = await fetchAiResponse(text);
      setMessages((p) => [
        ...p,
        { id: nowId(), role: 'ai', from: 'ai', translations, ts: Date.now() }
      ]);
      preloadTTS(translations?.[0]?.translation, targetLang);
    } catch (e) {
      const msg = e?.name === 'AbortError' ? '请求超时，请重试' : (e?.message || '未知错误');
      setError(msg);
      const translations = normalizeTranslations([{ style: '错误', translation: `（出错：${msg}）`, back_translation: '' }]);
      setMessages((p) => [
        ...p,
        { id: nowId(), role: 'ai', from: 'error', translations, ts: Date.now() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const showSendButton = userInput.trim().length > 0;

  const handleMainButtonClick = (e) => {
    e.preventDefault();
    if (showSendButton) {
      handleSubmit();
      return;
    }
    if (isListening) recognitionRef.current?.stop();
    else startListening();
  };

  const handleSelectSpeechLang = (val) => {
    setSpeechLang(val);
    const pair = applySpeechLangToTranslatePair(val);
    if (pair) {
      setSourceLang(pair.source);
      setTargetLang(pair.target);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col w-full text-gray-900 overflow-hidden relative" style={{ height: '100dvh' }}>
      {/* background */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')` }}
      />
      {/* light overlay to make it "浅色系、不透明" without fading text */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: `rgba(255,255,255,${settings.backgroundOverlay ?? 0.10})` }}
      />
      {/* extra base layer for readability */}
      <div className="absolute inset-0 bg-white/55 z-0" />

      {/* top bar */}
      <div className="relative z-10 pt-safe-top">
        <div className="px-4 pt-3">
          <div className="w-full max-w-[980px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <i className="fas fa-globe" />
              <span>886.best</span>
              <span className="font-normal text-gray-600">· Ai翻译支持100多种语言</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5"
              title="关闭"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* language bar */}
        <div className="px-4 pb-2 mt-2">
          <div className="w-full max-w-[980px] mx-auto flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowSourcePicker(true)}
              className="bg-white/90 rounded-full px-4 py-2 text-sm font-semibold border border-gray-200 shadow-sm"
              title="选择源语言"
            >
              {getLangName(sourceLang)}
            </button>

            <button
              type="button"
              onClick={handleSwapLanguages}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/90 border border-gray-200 shadow-sm disabled:opacity-50"
              disabled={sourceLang === 'auto'}
              title="交换"
            >
              <i className="fas fa-exchange-alt" />
            </button>

            <button
              type="button"
              onClick={() => setShowTargetPicker(true)}
              className="bg-white/90 rounded-full px-4 py-2 text-sm font-semibold border border-gray-200 shadow-sm"
              title="选择目标语言"
            >
              {getLangName(targetLang)}
            </button>

            <button
              type="button"
              onClick={() => setShowModelSelector(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/90 border border-gray-200 shadow-sm"
              title="切换模型"
            >
              <i className="fas fa-microchip" />
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/90 border border-gray-200 shadow-sm"
              title="设置"
            >
              <i className="fas fa-cog" />
            </button>
          </div>
        </div>
      </div>

      {/* messages area */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 relative z-10">
        <div className="w-full max-w-[980px] mx-auto">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-sm text-gray-700 mt-10 px-6">
              {DEFAULT_TRANSLATION_PROMPT.openingLine}
              <div className="mt-2 text-xs text-gray-500">提示：命中字典会更稳（严格匹配）</div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end mt-3">
                  <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl px-4 py-2 text-[15px] leading-relaxed shadow-sm">
                    {m.text}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="mt-3">
                <TranslationResults results={m.translations} targetLang={targetLang} />
                <div className="text-center text-[11px] text-gray-500 mt-1">
                  {m.from === 'dict' ? '命中字典输出（严格匹配）' : (m.from === 'error' ? '错误输出' : 'AI 输出')}
                </div>
              </div>
            );
          })}

          {isLoading && <FancyLoading />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* footer input: fixed */}
      <div className="fixed left-0 right-0 bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="px-4">
          <div className="w-full max-w-[980px] mx-auto">
            {error && (
              <div className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded-xl" onClick={() => setError('')}>
                {error}（点击关闭）
              </div>
            )}

            <div className="flex items-end gap-2 bg-white/95 backdrop-blur-lg p-2 rounded-[28px] shadow-lg border border-gray-200">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className={cx(
                  'flex-1 bg-transparent max-h-40 min-h-[48px] py-3 px-3 resize-none outline-none text-lg leading-6',
                  'overflow-hidden' // hide scrollbar
                )}
                rows={1}
                placeholder="" // no hint
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />

              <button
                type="button"
                onClick={handleMainButtonClick}
                onMouseDown={handleMicPress}
                onMouseUp={handleMicRelease}
                onTouchStart={handleMicPress}
                onTouchEnd={handleMicRelease}
                className={cx(
                  'w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-200',
                  'bg-blue-600 text-white',
                  isListening && !showSendButton ? 'scale-110' : ''
                )}
                title={showSendButton ? '发送' : (isListening ? '停止' : '语音')}
              >
                <i className={`fas ${showSendButton ? 'fa-arrow-up' : (isListening ? 'fa-stop' : 'fa-microphone-alt')} text-2xl`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* modals */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s) => { setSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showModelSelector && (
        <ModelModal
          models={settings.chatModels || DEFAULT_MODELS}
          selectedValue={settings.selectedModel}
          onSelect={(val) => setSettings((p) => ({ ...p, selectedModel: val }))}
          onClose={() => setShowModelSelector(false)}
        />
      )}

      {showSpeechSelector && (
        <SpeechLangModal
          selectedValue={speechLang}
          onSelect={handleSelectSpeechLang}
          onClose={() => setShowSpeechSelector(false)}
        />
      )}

      {showSourcePicker && (
        <LanguagePickerModal
          title="选择源语言"
          value={sourceLang}
          options={SUPPORTED_LANGUAGES}
          onSelect={setSourceLang}
          onClose={() => setShowSourcePicker(false)}
          disableAuto={false}
        />
      )}

      {showTargetPicker && (
        <LanguagePickerModal
          title="选择目标语言"
          value={targetLang}
          options={SUPPORTED_LANGUAGES}
          onSelect={setTargetLang}
          onClose={() => setShowTargetPicker(false)}
          disableAuto={true}
        />
      )}
    </div>
  );
};

// ----------------- Drawer wrapper -----------------
const AIChatDrawer = ({ isOpen, onClose }) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
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
