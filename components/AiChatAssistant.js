import { Transition, Dialog } from '@headlessui/react';
import React, { useState, useEffect, useRef, useCallback, Fragment, memo } from 'react';
import { loadCheatDict, matchCheatStrict } from '@/lib/cheatDict';

// ----------------- helpers -----------------
const convertGitHubUrl = (url) => {
  if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
};

const safeLocalStorageGet = (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null);
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); };

const generateSimpleId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ----------------- prompt -----------------
const TRANSLATION_PROMPT = {
  content: `你是一位【中缅双语翻译专家】，专门处理日常聊天场景的翻译。

【核心任务】
接收用户发送的中文或缅甸语文本，提供4种不同翻译版本供用户选择。

【输出格式】
严格返回以下JSON格式，不要有任何额外文字、解释或代码块标记：
{
  "data": [
    { "style": "自然直译", "translation": "翻译结果", "back_translation": "回译结果" },
    { "style": "自然意译", "translation": "翻译结果", "back_translation": "回译结果" },
    { "style": "口语化", "translation": "翻译结果", "back_translation": "回译结果" },
    { "style": "保留原文结构", "translation": "翻译结果", "back_translation": "回译结果" }
  ]
}

【翻译总原则】
- ✅ 完整传达原文意思，不遗漏、不添加
- ✅ 回译(back_translation)必须忠实翻译回源语言
- ✅ 缅甸语使用现代日常口语表达
- ✅ 中文使用自然流畅的口语
- ✅ 避免过于生僻的俚语或网络流行语
- ✅ 人称、称呼、时态、数字时间地点必须一致

现在，请等待用户的文本输入。`,
  openingLine: '你好！请发送你需要翻译的内容，我会给你4种版本。'
};

// ----------------- models -----------------
const CHAT_MODELS_LIST = [
  { id: 'm1', name: 'DeepSeek V3.2', value: 'deepseek-v3.2' },
  { id: 'm2', name: 'GLM-4.6', value: 'glm-4.6' },
  { id: 'm3', name: 'Qwen3-235B', value: 'qwen3-235b' },
  { id: 'm4', name: 'Qwen3-Max', value: 'qwen3-max' }
];

const DEFAULT_SETTINGS = {
  apiConfig: { url: 'https://apis.iflow.cn/v1', key: '' },
  chatModels: CHAT_MODELS_LIST,
  selectedModel: 'deepseek-v3.2',
  temperature: 0.2,
  chatBackgroundUrl: '/images/chat-bg-light.jpg',
  backgroundOpacity: 92
};

// ----------------- translate langs (UI only) -----------------
const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动识别' },
  { code: 'zh-CN', name: '中文' },
  { code: 'my-MM', name: '缅甸语' },
  { code: 'vi-VN', name: '越南语' },
  { code: 'th-TH', name: '泰语' },
  { code: 'lo-LA', name: '老挝语' },
  { code: 'ru-RU', name: '俄语' }
];

// ----------------- speech langs (SEA + world top languages) -----------------
const SPEECH_LANGS = [
  // Common (SEA + key)
  { name: '中文', value: 'zh-CN', flag: '🇨🇳', group: 'common' },
  { name: 'မြန်မာ', value: 'my-MM', flag: '🇲🇲', group: 'common' },
  { name: 'Tiếng Việt', value: 'vi-VN', flag: '🇻🇳', group: 'common' },
  { name: 'ไทย', value: 'th-TH', flag: '🇹🇭', group: 'common' },
  { name: 'ລາວ', value: 'lo-LA', flag: '🇱🇦', group: 'common' },
  { name: 'English', value: 'en-US', flag: '🇺🇸', group: 'common' },
  { name: 'Русский', value: 'ru-RU', flag: '🇷🇺', group: 'common' },
  { name: '日本語', value: 'ja-JP', flag: '🇯🇵', group: 'common' },
  { name: '한국어', value: 'ko-KR', flag: '🇰🇷', group: 'common' },

  // More (world top-ish + SEA extras)
  { name: 'Bahasa Indonesia', value: 'id-ID', flag: '🇮🇩', group: 'more' },
  { name: 'Bahasa Melayu', value: 'ms-MY', flag: '🇲🇾', group: 'more' },
  { name: 'Filipino', value: 'fil-PH', flag: '🇵🇭', group: 'more' },
  { name: 'ភាសាខ្មែរ', value: 'km-KH', flag: '🇰🇭', group: 'more' },
  { name: 'မြန်မာ (Alt)', value: 'my-MM', flag: '🇲🇲', group: 'more' }, // keep

  { name: 'Español', value: 'es-ES', flag: '🇪🇸', group: 'more' },
  { name: 'Português', value: 'pt-BR', flag: '🇧🇷', group: 'more' },
  { name: 'Français', value: 'fr-FR', flag: '🇫🇷', group: 'more' },
  { name: 'Deutsch', value: 'de-DE', flag: '🇩🇪', group: 'more' },
  { name: 'Italiano', value: 'it-IT', flag: '🇮🇹', group: 'more' },

  { name: 'हिन्दी', value: 'hi-IN', flag: '🇮🇳', group: 'more' },
  { name: 'বাংলা', value: 'bn-IN', flag: '🇮🇳', group: 'more' },
  { name: 'اردو', value: 'ur-PK', flag: '🇵🇰', group: 'more' },
  { name: 'Türkçe', value: 'tr-TR', flag: '🇹🇷', group: 'more' },

  { name: 'العربية', value: 'ar-SA', flag: '🇸🇦', group: 'more' },
  { name: 'فارسی', value: 'fa-IR', flag: '🇮🇷', group: 'more' },
  { name: 'עברית', value: 'he-IL', flag: '🇮🇱', group: 'more' },

  { name: 'Polski', value: 'pl-PL', flag: '🇵🇱', group: 'more' },
  { name: 'Українська', value: 'uk-UA', flag: '🇺🇦', group: 'more' },
  { name: 'Nederlands', value: 'nl-NL', flag: '🇳🇱', group: 'more' },
  { name: 'Svenska', value: 'sv-SE', flag: '🇸🇪', group: 'more' }
];

// ----------------- TTS (your API) -----------------
const ttsCache = new Map();

const pickTtsVoiceByLang = (lang) => {
  // 你重点作弊语言：越南/老挝/俄/缅/泰 + 中文
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
    .map((x) => ({
      translation: String(x?.translation ?? '').trim(),
      back_translation: String(x?.back_translation ?? '').trim()
    }))
    .filter((x) => x.translation || x.back_translation);

  const base = mapped.length ? mapped : [{ translation: '（无有效译文）', back_translation: '' }];
  const out = base.slice(0, 4);
  while (out.length < 4) out.push(out[out.length - 1]);
  return out;
};

const getLangName = (code) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code;

// speechLang -> auto set source/target for main cases
const applySpeechLangToTranslatePair = (speechLang) => {
  // 你重点：中<->缅，其他语言默认 auto -> 缅(或保持)
  if (speechLang === 'zh-CN') return { source: 'zh-CN', target: 'my-MM' };
  if (speechLang === 'my-MM') return { source: 'my-MM', target: 'zh-CN' };
  if (speechLang === 'vi-VN') return { source: 'vi-VN', target: 'zh-CN' };
  if (speechLang === 'th-TH') return { source: 'th-TH', target: 'zh-CN' };
  if (speechLang === 'lo-LA') return { source: 'lo-LA', target: 'zh-CN' };
  if (speechLang === 'ru-RU') return { source: 'ru-RU', target: 'zh-CN' };
  return null;
};

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
    <div className="w-full max-w-[820px] mx-auto bg-white/90 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 break-words">
            {result.translation}
          </div>
          <div className="mt-2 text-[12px] leading-snug text-blue-700/90 dark:text-blue-300/90 break-words">
            {result.back_translation}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0 pt-0.5">
          <AiTtsButton text={result.translation} targetLang={targetLang} />
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-xs rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10"
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

// Grid modal for speech language
const SpeechLangModal = ({ selectedValue, onSelect, onClose }) => {
  const [showMore, setShowMore] = useState(false);
  const common = SPEECH_LANGS.filter((x) => x.group === 'common');
  const more = SPEECH_LANGS.filter((x) => x.group === 'more');

  const renderList = showMore ? [...common, ...more] : common;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex p-4" onClick={onClose}>
      <div className="w-full max-w-lg m-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="font-bold text-gray-900 dark:text-gray-100">选择语音识别语言</div>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              长按麦克风打开这里；点击某项立即生效
            </div>
            <button
              type="button"
              onClick={() => setShowMore((p) => !p)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showMore ? '收起' : '更多语言'}
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-2 gap-2">
            {renderList.map((opt) => (
              <button
                key={opt.value + opt.name}
                type="button"
                onClick={() => { onSelect(opt.value); onClose(); }}
                className={[
                  'rounded-xl p-3 text-left border transition-colors',
                  selectedValue === opt.value
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{opt.flag}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{opt.name}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{opt.value}</div>
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

// Model selector (simple)
const ModelModal = ({ models, selectedValue, onSelect, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex p-4" onClick={onClose}>
    <div className="w-full max-w-md m-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="font-bold text-gray-900 dark:text-gray-100">切换模型</div>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <i className="fas fa-times" />
        </button>
      </div>
      <div className="p-2 max-h-[60vh] overflow-y-auto">
        {(models || []).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { onSelect(m.value); onClose(); }}
            className={[
              'w-full text-left px-4 py-3 rounded-xl text-sm',
              selectedValue === m.value
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-100'
            ].join(' ')}
          >
            {m.name}
            <div className="text-[11px] opacity-60 mt-0.5">{m.value}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// Settings modal (only API key + bg + temp optional)
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [tempSettings, setTempSettings] = useState(settings);
  const [isKeyVisible, setKeyVisible] = useState(false);

  const handleApiChange = (field, value) =>
    setTempSettings((p) => ({ ...p, apiConfig: { ...p.apiConfig, [field]: value } }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[10002] p-4 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">设置</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="font-semibold mb-2">API（OpenAI 兼容）</div>
            <label className="text-xs opacity-70">接口地址</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-700"
              value={tempSettings.apiConfig.url}
              onChange={(e) => handleApiChange('url', e.target.value)}
              placeholder="https://apis.iflow.cn/v1"
            />

            <div className="mt-3">
              <label className="text-xs opacity-70">密钥</label>
              <div className="relative">
                <input
                  className="w-full mt-1 px-3 py-2 pr-10 rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-700"
                  type={isKeyVisible ? 'text' : 'password'}
                  value={tempSettings.apiConfig.key}
                  onChange={(e) => handleApiChange('key', e.target.value)}
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

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="font-semibold mb-2">生成参数</div>
            <label className="text-xs opacity-70">温度（默认 0.2）</label>
            <input
              className="w-full mt-1"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={tempSettings.temperature ?? 0.2}
              onChange={(e) => setTempSettings((p) => ({ ...p, temperature: parseFloat(e.target.value) }))}
            />
            <div className="text-xs opacity-70 mt-1">当前：{tempSettings.temperature ?? 0.2}</div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800">
            关闭
          </button>
          <button
            type="button"
            onClick={() => onSave(tempSettings)}
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
  const [result, setResult] = useState(null);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my-MM');

  const [speechLang, setSpeechLang] = useState('zh-CN');
  const [isListening, setIsListening] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSpeechSelector, setShowSpeechSelector] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const pressTimerRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);

    const saved = safeLocalStorageGet('ai_chat_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed, chatModels: CHAT_MODELS_LIST });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }

    // 尽量触发移动端地址栏收起（非强制）
    setTimeout(() => window.scrollTo(0, 1), 60);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings));
  }, [settings, isMounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [result, isLoading]);

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto' || sourceLang === targetLang) return;
    const s = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(s);
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
        .map((r) => r[0])
        .map((r) => r.transcript)
        .join('');

      setUserInput(transcript);

      // final: 自动提交
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
  }, [speechLang]);

  const handleMicPress = () => {
    pressTimerRef.current = setTimeout(() => setShowSpeechSelector(true), 500);
  };
  const handleMicRelease = () => clearTimeout(pressTimerRef.current);

  const fetchAiResponse = async (text) => {
    const { apiConfig, selectedModel } = settings;

    if (!apiConfig?.key) {
      throw new Error('请在设置中配置 API Key');
    }

    const userPrompt = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(targetLang)}]:\n\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

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
            { role: 'system', content: TRANSLATION_PROMPT.content },
            { role: 'user', content: userPrompt }
          ],
          temperature: settings.temperature ?? 0.2,
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
        // 兜底：如果 JSON 格式完全炸了，也必须给 4 张卡片
        return normalizeTranslations([{ translation: raw || '（解析失败）', back_translation: '' }]);
      }

      return normalizeTranslations(parsed?.data ?? parsed);
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleSubmit = async (textToSend = null) => {
    const text = (textToSend ?? userInput).trim();
    if (!text) {
      setError('请输入要翻译的内容！');
      return;
    }

    // 每次新对话：清空旧结果 & 不展示原文
    setUserInput('');
    setResult(null);
    setError('');
    setIsLoading(true);

    try {
      // 作弊字典：严格匹配优先
      const dict = await loadCheatDict(sourceLang);
      const hit = matchCheatStrict(dict, text, targetLang);
      if (hit) {
        const translations = normalizeTranslations(hit);
        setResult({ translations, from: 'dict' });
        preloadTTS(translations?.[0]?.translation, targetLang);
        return;
      }

      // 不命中字典 -> 调模型
      const translations = await fetchAiResponse(text);
      setResult({ translations, from: 'ai' });
      preloadTTS(translations?.[0]?.translation, targetLang);
    } catch (e) {
      // 失败也给 4 卡片兜底
      const msg = e?.name === 'AbortError' ? '请求超时，请重试' : (e?.message || '未知错误');
      setError(msg);
      setResult({ translations: normalizeTranslations([{ translation: `（出错：${msg}）`, back_translation: '' }]), from: 'error' });
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
    // mic mode
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
    <div className="flex flex-col w-full text-gray-800 dark:text-gray-200 overflow-hidden relative"
         style={{ height: '100dvh' }}>
      {/* background (light) */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{
          backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`,
          opacity: (settings.backgroundOpacity || 92) / 100
        }}
      />
      <div className="absolute inset-0 bg-white/50 dark:bg-black/40 z-0" />

      {/* main */}
      <div className="flex-1 flex flex-col relative z-10 pt-safe-top">
        {/* results area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!result && !isLoading && (
            <div className="text-center text-sm text-gray-700 dark:text-gray-200 mt-10 px-6">
              {TRANSLATION_PROMPT.openingLine}
              <div className="mt-2 text-xs opacity-70">
                提示：命中字典会更“稳”（严格匹配）
              </div>
            </div>
          )}

          {isLoading && (
            <div className="w-full max-w-[820px] mx-auto mt-6">
              <div className="animate-pulse bg-white/85 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-4">
                <div className="h-4 bg-gray-200/90 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200/90 dark:bg-gray-700 rounded w-5/6 mt-3" />
                <div className="h-3 bg-blue-100/80 dark:bg-blue-500/20 rounded w-2/3 mt-4" />
              </div>
              <div className="text-center text-xs text-gray-600 dark:text-gray-300 mt-2">
                正在翻译中…请稍等
              </div>
            </div>
          )}

          {result?.translations && !isLoading && (
            <div className="mt-4">
              <TranslationResults results={result.translations} targetLang={targetLang} />
              <div className="text-center text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                {result.from === 'dict' ? '命中字典输出（严格匹配）' : 'AI 输出'}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* footer: keep the language switch bar (you said you want it) */}
        <footer className="shrink-0 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {error && (
            <div
              className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded"
              onClick={() => setError('')}
            >
              {error}（点击关闭）
            </div>
          )}

          {/* language bar */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="bg-gray-200/60 dark:bg-gray-700/50 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 appearance-none text-center"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-white dark:bg-gray-900">
                  {l.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSwapLanguages}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-200/60 dark:bg-gray-700/50 backdrop-blur-sm hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-transform active:rotate-180 disabled:opacity-50"
              disabled={sourceLang === 'auto'}
              title="交换"
            >
              <i className="fas fa-exchange-alt" />
            </button>

            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-gray-200/60 dark:bg-gray-700/50 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-semibold border-none outline-none focus:ring-0 appearance-none text-center"
            >
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
                <option key={l.code} value={l.code} className="bg-white dark:bg-gray-900">
                  {l.name}
                </option>
              ))}
            </select>

            {/* model icon button */}
            <button
              type="button"
              onClick={() => setShowModelSelector(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-200/60 dark:bg-gray-700/50 backdrop-blur-sm hover:bg-gray-300/70 dark:hover:bg-gray-600/70"
              title="切换模型"
            >
              <i className="fas fa-microchip" />
            </button>
          </div>

          {/* input area (not form, prevent accidental submit/trigger) */}
          <div className="flex items-end gap-2 bg-white/85 dark:bg-gray-900/80 backdrop-blur-lg p-2 rounded-[28px] shadow-lg border border-white/30 dark:border-gray-700/50">
            {/* settings inside input bar */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-12 h-12 flex items-center justify-center shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="设置"
            >
              <i className="fas fa-cog text-gray-600 dark:text-gray-300" />
            </button>

            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isListening ? '正在聆听…' : '输入要翻译的内容…（严格匹配可命中字典）'}
              className="flex-1 bg-transparent max-h-56 min-h-[48px] py-3 px-2 resize-none outline-none text-lg leading-6 dark:placeholder-gray-500 self-center"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />

            {/* main button: blue background mic/send */}
            <button
              type="button"
              onClick={handleMainButtonClick}
              onMouseDown={handleMicPress}
              onMouseUp={handleMicRelease}
              onTouchStart={handleMicPress}
              onTouchEnd={handleMicRelease}
              className={[
                'w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ease-in-out',
                showSendButton
                  ? 'bg-blue-600 text-white'
                  : isListening
                    ? 'bg-blue-600 text-white scale-110 animate-pulse'
                    : 'bg-blue-600 text-white'
              ].join(' ')}
              title={showSendButton ? '发送' : (isListening ? '停止' : '语音')}
            >
              <i className={`fas ${showSendButton ? 'fa-arrow-up' : (isListening ? 'fa-stop' : 'fa-microphone-alt')} text-2xl`} />
            </button>
          </div>
        </footer>
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
          models={settings.chatModels || CHAT_MODELS_LIST}
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
