import { Transition, Dialog } from '@headlessui/react';
import React, { useState, useEffect, useRef, useCallback, Fragment, memo } from 'react';
import { loadCheatDict, matchCheatLoose } from '@/lib/cheatDict';

const LS_SETTINGS = 'ai_translate_settings_v3';
const LS_TOKEN_KEY = 'trial_token_v1';
const LS_PAIR = 'ai_translate_lang_pair_v1';
const LS_SPEECH = 'ai_translate_speech_lang_v1';

const DEFAULT_TRANSLATION_PROMPT = `你是一位【多语种翻译专家】，专门处理日常聊天场景的翻译。

【核心任务】把用户源语言翻译成目标语言，输出4种不同版本供用户选择：
1) 贴近原文 2) 自然直译 3) 自然意译 4) 口语化

【输出格式】严格返回JSON，不要额外文字：
{
  "data": [
    { "style": "贴近原文", "translation": "...", "back_translation": "..." },
    { "style": "自然直译", "translation": "...", "back_translation": "..." },
    { "style": "自然意译", "translation": "...", "back_translation": "..." },
    { "style": "口语化", "translation": "...", "back_translation": "..." }
  ]
}

【翻译后自检】逐句检查是否有增删、改语气、改时间先后、改否定/疑问；如有立刻修正。`;

const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动识别' },
  { code: 'zh-CN', name: '中文' },
  { code: 'my-MM', name: '缅甸语' },
  { code: 'vi-VN', name: '越南语' },
  { code: 'th-TH', name: '泰语' },
  { code: 'lo-LA', name: '老挝语' },
  { code: 'ru-RU', name: '俄语' }
];

const SPEECH_LANGS = [
  { name: '中文', value: 'zh-CN' },
  { name: 'မြန်မာ', value: 'my-MM' },
  { name: 'Tiếng Việt', value: 'vi-VN' },
  { name: 'ไทย', value: 'th-TH' },
  { name: 'ລາວ', value: 'lo-LA' },
  { name: 'English', value: 'en-US' },
  { name: 'Русский', value: 'ru-RU' }
];

const DEFAULT_SETTINGS = {
  // providers: user-managed
  providers: [
    {
      id: 'p1',
      name: 'iflow',
      baseUrl: 'https://apis.iflow.cn/v1',
      apiKey: '',
      models: [
        { id: 'm1', name: 'DeepSeek V3.2', value: 'deepseek-v3.2' },
        { id: 'm2', name: 'GLM-4.6', value: 'glm-4.6' }
      ]
    }
  ],
  selectedProviderId: 'p1',
  selectedModelValue: 'deepseek-v3.2',
  // TTS
  ttsMode: 'auto', // 'auto' | 'manual'
  manualVoice: 'zh-CN-XiaoyouNeural'
};

const cx = (...arr) => arr.filter(Boolean).join(' ');
const safeGet = (k) => (typeof window !== 'undefined' ? localStorage.getItem(k) : null);
const safeSet = (k, v) => { if (typeof window !== 'undefined') localStorage.setItem(k, v); };

const getLangName = (code) => SUPPORTED_LANGUAGES.find((x) => x.code === code)?.name || code;

const safeParseAiJson = (raw) => {
  const s = (raw || '').trim();
  // try direct
  try { return JSON.parse(s); } catch {}
  // try extract {...}
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
  // throw
  return JSON.parse(s);
};

const normalizeTranslations = (arr) => {
  const a = Array.isArray(arr) ? arr : [];
  const names = ['贴近原文', '自然直译', '自然意译', '口语化'];
  const mapped = a.map((x, i) => ({
    style: String(x?.style ?? names[i] ?? '').trim(),
    translation: String(x?.translation ?? '').trim(),
    back_translation: String(x?.back_translation ?? '').trim()
  })).filter((x) => x.translation || x.back_translation);

  const base = mapped.length ? mapped : [{ style: '错误', translation: '（无有效译文）', back_translation: '' }];
  const out = base.slice(0, 4);
  while (out.length < 4) out.push(out[out.length - 1]);
  return out;
};

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

const preloadTTS = async (text, voice) => {
  if (!text || !voice) return;
  const key = `${voice}__${text}`;
  if (ttsCache.has(key)) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(voice)}&r=-25`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('TTS API error');
    const blob = await resp.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preload = 'auto';
    ttsCache.set(key, audio);
  } catch (e) {
    console.error('TTS preload failed', e);
  }
};

const playCachedTTS = async (text, voice) => {
  if (!text || !voice) return;
  const key = `${voice}__${text}`;
  if (!ttsCache.has(key)) await preloadTTS(text, voice);
  const audio = ttsCache.get(key);
  if (!audio) return;
  audio.currentTime = 0;
  await audio.play().catch(() => {});
};

const AiTtsButton = memo(({ text, voice }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); playCachedTTS(text, voice); }}
    className="w-10 h-10 rounded-full text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
    title="朗读"
  >
    <i className="fas fa-volume-up text-lg" />
  </button>
));
AiTtsButton.displayName = 'AiTtsButton';

const CopyButton = memo(({ text }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="w-10 h-10 rounded-full text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
      title="复制"
    >
      <i className={`fas ${copied ? 'fa-check text-green-600' : 'fa-copy'} text-lg`} />
    </button>
  );
});
CopyButton.displayName = 'CopyButton';

const TranslationCard = memo(({ result, voice }) => {
  return (
    <div className="w-full max-w-[820px] mx-auto bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
      <div className="text-center">
        <div className="text-[12px] font-bold text-gray-500">{result.style}</div>

        <div className="mt-2 text-[18px] leading-relaxed text-gray-900 break-words text-center">
          {result.translation}
        </div>

        {!!result.back_translation && (
          <div className="mt-2 text-[13px] leading-snug text-blue-700/90 break-words text-center">
            {result.back_translation}
          </div>
        )}

        <div className="mt-3 flex justify-center gap-3">
          <AiTtsButton text={result.translation} voice={voice} />
          <CopyButton text={result.translation} />
        </div>
      </div>
    </div>
  );
});
TranslationCard.displayName = 'TranslationCard';

const TranslationResults = memo(({ results, voice }) => (
  <div className="w-full flex flex-col gap-2.5 py-3">
    {(results || []).slice(0, 4).map((r, i) => (
      <TranslationCard key={i} result={r} voice={voice} />
    ))}
  </div>
));
TranslationResults.displayName = 'TranslationResults';

const FancyLoading = () => (
  <div className="w-full max-w-[820px] mx-auto mt-3">
    <div className="grid gap-2.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm relative overflow-hidden">
          <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
          <div className="h-5 w-4/5 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-3/5 bg-gray-200 rounded" />
          <div className="absolute inset-0 -translate-x-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.10), transparent)',
              animation: 'shine 1.1s infinite'
            }}
          />
        </div>
      ))}
    </div>
    <style>{`
      @keyframes shine { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
    `}</style>
  </div>
);

// ---------- Settings Modal (providers + tts voice strategy) ----------
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [temp, setTemp] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  const addProvider = () => {
    const name = prompt('供应商名称（例如 iflow / openai / myhost）');
    if (!name) return;
    const baseUrl = prompt('Base URL（例如 https://apis.iflow.cn/v1）');
    if (!baseUrl) return;
    setTemp((p) => ({
      ...p,
      providers: [...p.providers, { id: `p-${Date.now()}`, name, baseUrl, apiKey: '', models: [] }]
    }));
  };

  const delProvider = (pid) => {
    setTemp((p) => ({ ...p, providers: p.providers.filter((x) => x.id !== pid) }));
  };

  const updateProvider = (pid, patch) => {
    setTemp((p) => ({
      ...p,
      providers: p.providers.map((x) => (x.id === pid ? { ...x, ...patch } : x))
    }));
  };

  const addModel = (pid) => {
    const name = prompt('模型显示名');
    if (!name) return;
    const value = prompt('模型 value（请求时 model 字段）');
    if (!value) return;
    const prov = temp.providers.find((x) => x.id === pid);
    updateProvider(pid, { models: [...(prov?.models || []), { id: `m-${Date.now()}`, name, value }] });
  };

  const delModel = (pid, mid) => {
    const prov = temp.providers.find((x) => x.id === pid);
    updateProvider(pid, { models: (prov?.models || []).filter((m) => m.id !== mid) });
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-black/50 flex p-4" onClick={onClose}>
      <div className="m-auto w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">设置</div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-gray-100">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto thin-scrollbar space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">供应商</div>
            <button className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm" onClick={addProvider}>
              新增供应商
            </button>
          </div>

          {temp.providers.map((p) => (
            <div key={p.id} className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-gray-900">{p.name}</div>
                <button className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm" onClick={() => delProvider(p.id)}>
                  删除
                </button>
              </div>

              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500">Base URL</div>
                  <input
                    className="w-full mt-1 px-3 py-2 rounded-xl border bg-white"
                    value={p.baseUrl}
                    onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                  />
                </div>

                <div>
                  <div className="text-xs text-gray-500">API Key</div>
                  <div className="relative">
                    <input
                      className="w-full mt-1 px-3 py-2 pr-10 rounded-xl border bg-white"
                      type={showKey ? 'text' : 'password'}
                      value={p.apiKey}
                      onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-gray-100 text-gray-600"
                      onClick={() => setShowKey((v) => !v)}
                      type="button"
                      title="显示/隐藏"
                    >
                      <i className={`fas ${showKey ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="font-semibold text-sm text-gray-900">模型列表</div>
                <button className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm" onClick={() => addModel(p.id)}>
                  添加模型
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {(p.models || []).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 p-2 bg-white border rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{m.name}</div>
                      <div className="text-[11px] text-gray-500 truncate">{m.value}</div>
                    </div>
                    <button className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200" onClick={() => delModel(p.id, m.id)}>
                      删除
                    </button>
                  </div>
                ))}
                {(!p.models || p.models.length === 0) && (
                  <div className="text-xs text-gray-500">暂无模型</div>
                )}
              </div>
            </div>
          ))}

          <div className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
            <div className="font-semibold text-gray-900">朗读（TTS）</div>
            <div className="mt-2 flex gap-2 items-center">
              <select
                className="px-3 py-2 rounded-xl border bg-white"
                value={temp.ttsMode}
                onChange={(e) => setTemp((p) => ({ ...p, ttsMode: e.target.value }))}
              >
                <option value="auto">自动按译文语言选择</option>
                <option value="manual">手动选择发音人</option>
              </select>

              {temp.ttsMode === 'manual' && (
                <select
                  className="px-3 py-2 rounded-xl border bg-white flex-1"
                  value={temp.manualVoice}
                  onChange={(e) => setTemp((p) => ({ ...p, manualVoice: e.target.value }))}
                >
                  <option value="zh-CN-XiaoyouNeural">中文-晓优</option>
                  <option value="my-MM-NilarNeural">缅甸-Nilar</option>
                  <option value="vi-VN-HoaiMyNeural">越南-HoaiMy</option>
                  <option value="th-TH-PremwadeeNeural">泰语-Premwadee</option>
                  <option value="lo-LA-KeomanyNeural">老挝-Keomany</option>
                  <option value="ru-RU-SvetlanaNeural">俄语-Svetlana</option>
                </select>
              )}
            </div>
          </div>

          <div className="text-[11px] text-gray-500">
            提示：供应商 Key 只保存在本机浏览器 localStorage（你要求的“保存在手机浏览器里”）。
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button className="px-4 py-2 rounded-xl bg-gray-100" onClick={onClose}>关闭</button>
          <button className="px-4 py-2 rounded-xl bg-purple-600 text-white" onClick={() => onSave(temp)}>保存</button>
        </div>
      </div>
    </div>
  );
};

// ----------------- Core -----------------
const AiChatContent = () => {
  const [isMounted, setIsMounted] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('my-MM');
  const [speechLang, setSpeechLang] = useState('zh-CN');

  const [userInput, setUserInput] = useState('');
  const [translations, setTranslations] = useState(null);
  const [lastText, setLastText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const pressTimerRef = useRef(null);

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // restore settings
    const saved = safeGet(LS_SETTINGS);
    if (saved) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) }); } catch {}
    }

    // restore lang pair
    const pair = safeGet(LS_PAIR);
    if (pair) {
      try {
        const p = JSON.parse(pair);
        if (p.source) setSourceLang(p.source);
        if (p.target) setTargetLang(p.target);
      } catch {}
    }

    const sl = safeGet(LS_SPEECH);
    if (sl) setSpeechLang(sl);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    safeSet(LS_SETTINGS, JSON.stringify(settings));
  }, [settings, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    safeSet(LS_PAIR, JSON.stringify({ source: sourceLang, target: targetLang }));
  }, [sourceLang, targetLang, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    safeSet(LS_SPEECH, speechLang);
  }, [speechLang, isMounted]);

  const selectedProvider = settings.providers.find((p) => p.id === settings.selectedProviderId) || settings.providers[0];
  const providerModels = selectedProvider?.models || [];
  const selectedModel = settings.selectedModelValue || providerModels?.[0]?.value;

  const currentVoice =
    settings.ttsMode === 'manual'
      ? settings.manualVoice
      : pickTtsVoiceByLang(targetLang);

  const startRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('当前浏览器不支持语音识别（建议 Chrome/Edge Android 或桌面 Chrome）。');
      return;
    }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('语音识别需要 HTTPS 才能使用。');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = speechLang;
    rec.interimResults = false;     // ✅更稳：不用 interim，减少空提交
    rec.continuous = false;

    rec.onstart = () => {
      setIsListening(true);
      setError('');
    };

    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0]?.transcript || '').join('').trim();
      // ✅防止空/太短造成误触发
      if (t.length >= 1) {
        setUserInput(t);
      }
    };

    rec.onerror = (e) => {
      // 常见：not-allowed / service-not-allowed / network / no-speech
      setError(`语音识别失败：${e.error || 'unknown'}`);
    };

    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      rec.start();
    } catch (err) {
      setError('语音识别启动失败（可能被浏览器限制或权限未开启）。');
    }
  }, [speechLang]);

  // 按住说话：按下开始，松开停止
  const handleMicDown = () => {
    pressTimerRef.current = setTimeout(() => {
      // 长按：切换语音语言
      const next = prompt(
        `选择语音语言：\n${SPEECH_LANGS.map((x) => `${x.value}  ${x.name}`).join('\n')}\n\n请输入 value：`,
        speechLang
      );
      if (next) setSpeechLang(next);
    }, 500);

    startRecognition();
  };

  const handleMicUp = () => {
    clearTimeout(pressTimerRef.current);
    try { recognitionRef.current?.stop?.(); } catch {}
  };

  const callTranslateViaWorker = async (text) => {
    const token = safeGet(LS_TOKEN_KEY);
    if (!token) throw new Error('未激活，请先输入激活码');

    if (!selectedProvider?.baseUrl || !selectedProvider?.apiKey) {
      throw new Error('请在设置中配置供应商 BaseURL 和 Key');
    }

    const resp = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        provider: {
          baseUrl: selectedProvider.baseUrl,
          apiKey: selectedProvider.apiKey
        },
        model: selectedModel,
        sourceLang,
        targetLang,
        text,
        systemPrompt: DEFAULT_TRANSLATION_PROMPT
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || '翻译失败');
    return data; // { data: [...] }
  };

  const submit = async (text0 = null) => {
    const text = (text0 ?? userInput).trim();
    if (!text) return;

    // ✅你要求：每次新对话清除历史
    setTranslations(null);
    setLastText(text);
    setError('');
    setIsLoading(true);

    try {
      // 字典优先
      const dict = await loadCheatDict(sourceLang);
      const hit = matchCheatLoose(dict, text, targetLang);
      if (hit) {
        const t = normalizeTranslations(hit);
        setTranslations(t);
        preloadTTS(t?.[0]?.translation, currentVoice);
        return;
      }

      const out = await callTranslateViaWorker(text);
      const t = normalizeTranslations(out?.data ?? out);
      setTranslations(t);
      preloadTTS(t?.[0]?.translation, currentVoice);
    } catch (e) {
      setError(e.message || '未知错误');
      setTranslations(normalizeTranslations([{ style: '错误', translation: `（出错：${e.message || '未知错误'}）`, back_translation: '' }]));
    } finally {
      setIsLoading(false);
    }
  };

  const onReAnswer = async () => {
    if (!lastText) return;
    await submit(lastText);
  };

  const swap = () => {
    if (sourceLang === 'auto' || sourceLang === targetLang) return;
    const s = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(s);
  };

  if (!isMounted) return null;

  return (
    <div className="w-full h-[100dvh] bg-gray-100 text-gray-900 relative overflow-hidden">
      {/* thin scrollbar global-ish (scoped) */}
      <style>{`
        .thin-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 999px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* content */}
      <div className="flex flex-col h-full">
        {/* scrollable result area */}
        <div className="flex-1 overflow-y-auto thin-scrollbar px-4 pt-4 pb-40">
          {!translations && !isLoading && (
            <div className="text-center text-sm text-gray-600 mt-10">
              发送要翻译的内容，支持语音输入
            </div>
          )}

          {isLoading && <FancyLoading />}

          {translations && !isLoading && (
            <div className="mt-2">
              <TranslationResults results={translations} voice={currentVoice} />

              <div className="flex justify-center mt-3">
                <button
                  className="px-5 py-3 rounded-2xl bg-purple-600 text-white text-sm shadow"
                  onClick={onReAnswer}
                  type="button"
                >
                  重新回答
                </button>
              </div>
            </div>
          )}
        </div>

        {/* fixed control bar above input */}
        <div className="fixed left-0 right-0 bottom-[92px] z-20 px-4">
          <div className="max-w-[980px] mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* speech lang */}
              <select
                className="px-3 py-2 rounded-full bg-white border border-gray-200"
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value)}
                title="语音识别语言"
              >
                {SPEECH_LANGS.map((x) => (
                  <option key={x.value} value={x.value}>{x.name}</option>
                ))}
              </select>

              {/* source / target */}
              <select
                className="px-3 py-2 rounded-full bg-white border border-gray-200"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                title="源语言"
              >
                {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>

              <button
                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center"
                onClick={swap}
                disabled={sourceLang === 'auto'}
                title="交换"
                type="button"
              >
                <i className="fas fa-exchange-alt" />
              </button>

              <select
                className="px-3 py-2 rounded-full bg-white border border-gray-200"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                title="目标语言"
              >
                {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>

              {/* provider + model (left provider, right model) */}
              <select
                className="px-3 py-2 rounded-full bg-white border border-gray-200"
                value={settings.selectedProviderId}
                onChange={(e) => {
                  const pid = e.target.value;
                  const p = settings.providers.find((x) => x.id === pid);
                  setSettings((s) => ({
                    ...s,
                    selectedProviderId: pid,
                    selectedModelValue: p?.models?.[0]?.value || ''
                  }));
                }}
                title="供应商"
              >
                {settings.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 rounded-full bg-white border border-gray-200"
                value={settings.selectedModelValue}
                onChange={(e) => setSettings((s) => ({ ...s, selectedModelValue: e.target.value }))}
                title="模型"
              >
                {(providerModels.length ? providerModels : [{ value: '', name: '无模型' }]).map((m) => (
                  <option key={m.value} value={m.value}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* fixed input */}
        <div className="fixed left-0 right-0 bottom-0 z-30 bg-gray-100 px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="max-w-[980px] mx-auto">
            {error && (
              <div className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded-xl" onClick={() => setError('')}>
                {error}（点击关闭）
              </div>
            )}

            <div className="flex items-end gap-2 bg-white border border-gray-200 p-2 rounded-[28px] shadow">
              {/* settings button inside input */}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="w-12 h-12 rounded-full hover:bg-gray-100 flex items-center justify-center"
                title="设置"
              >
                <i className="fas fa-cog text-xl text-gray-700" />
              </button>

              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="flex-1 bg-transparent min-h-[52px] max-h-40 py-3 px-2 resize-none outline-none text-[18px] leading-6 overflow-hidden"
                rows={1}
                placeholder=""
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />

              {/* mic / send */}
              <button
                type="button"
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onTouchStart={handleMicDown}
                onTouchEnd={handleMicUp}
                onClick={() => { if (userInput.trim()) submit(); }}
                className={cx(
                  'w-16 h-16 rounded-full flex items-center justify-center shrink-0',
                  userInput.trim() ? 'bg-purple-600 text-white' : (isListening ? 'bg-purple-600 text-white animate-pulse' : 'bg-purple-600 text-white')
                )}
                title={userInput.trim() ? '发送' : '按住说话'}
              >
                <i className={cx('fas text-2xl', userInput.trim() ? 'fa-arrow-up' : (isListening ? 'fa-stop' : 'fa-microphone-alt'))} />
              </button>
            </div>

            <div className="text-[11px] text-gray-500 text-center mt-2">
              供应商：{selectedProvider?.name || '-'} ｜ 模型：{selectedModel || '-'} ｜ {getLangName(sourceLang)} → {getLangName(targetLang)}
            </div>
          </div>
        </div>

        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={(s) => { setSettings(s); setShowSettings(false); }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
};

// Drawer wrapper
const AIChatDrawer = ({ isOpen, onClose }) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-in-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in-out duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <Transition.Child as={Fragment} enter="transform transition ease-in-out duration-300"
              enterFrom="translate-y-full" enterTo="translate-y-0"
              leave="transform transition ease-in-out duration-300" leaveFrom="translate-y-0" leaveTo="translate-y-full">
              <Dialog.Panel className="pointer-events-auto w-screen h-full">
                <AiChatContent />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AIChatDrawer;
