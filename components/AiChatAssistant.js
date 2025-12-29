import React, { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { Transition, Dialog } from "@headlessui/react";

/**
 * ---------------------------
 * 常量与默认配置
 * ---------------------------
 */

const IFLOW_BASE_URL_DEFAULT = "https://apis.iflow.cn/v1";

const CHAT_MODELS_LIST = [
  { id: "deepseek-v3.2", name: "deepseek-v3.2", value: "deepseek-v3.2" },
  { id: "glm-4.6", name: "glm-4.6", value: "glm-4.6" },
  { id: "qwen3-235b", name: "qwen3-235b", value: "qwen3-235b" },
  { id: "qwen3-max", name: "qwen3-max", value: "qwen3-max" },
];

const SUPPORTED_LANGUAGES = [
  { code: "auto", name: "自动识别", speechCode: "" },
  { code: "zh-CN", name: "中文", speechCode: "zh-CN" },
  { code: "my-MM", name: "缅甸语", speechCode: "my-MM" },

  // 你要“很多语音识别语言”，这里加一些常用的（你可继续扩充）
  { code: "en-US", name: "英语(美国)", speechCode: "en-US" },
  { code: "th-TH", name: "泰语", speechCode: "th-TH" },
  { code: "ja-JP", name: "日语", speechCode: "ja-JP" },
  { code: "ko-KR", name: "韩语", speechCode: "ko-KR" },
  { code: "vi-VN", name: "越南语", speechCode: "vi-VN" },
];

const TRANSLATION_PROMPT_CONTENT = `你是一位【中缅双语翻译专家】，专门处理日常聊天场景的翻译。

【核心任务】
接收用户发送的中文或缅甸语文本，提供4种不同翻译版本供用户选择。

【输出格式】
严格返回以下JSON格式，不要有任何额外文字、解释或代码块标记：
{
  "data": [
    {
      "style": "自然直译",
      "translation": "翻译结果",
      "back_translation": "回译结果"
    },
    {
      "style": "自然意译",
      "translation": "翻译结果",
      "back_translation": "回译结果"
    },
    {
      "style": "口语化",
      "translation": "翻译结果",
      "back_translation": "回译结果"
    },
    {
      "style": "保留原文结构",
      "translation": "翻译结果",
      "back_translation": "回译结果"
    }
  ]
}

【四种风格详解】
1. **自然直译**
   - 在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯
   - 尽量保持原文逻辑顺序，但确保读起来流畅自然，不生硬
   - 平衡准确性和自然度

2. **自然意译**
   - 在保留原文完整含义的基础上，充分适应目标语言的表达习惯
   - 可以调整语序、重组句式，选择最自然的说法
   - 读起来像母语者说的话，强调流畅度

3. **口语化**
   - 采用当地人自然流畅的日常对话表达方式
   - 使用简短句式、常用词汇和口语习惯
   - 可适当添加语气词，让表达更亲切接地气

4. **保留原文结构**
   - 尽量保持原文的句式结构和词序
   - 确保关键词和表达的对应关系清晰
   - 在保持结构的前提下，让语序尽可能自然

【翻译总原则】
- ✅ 完整传达原文意思，不遗漏、不添加
- ✅ 根据上下文判断语气（正式/随意、礼貌/亲密等）
- ✅ 回译(back_translation)必须忠实翻译回源语言，用于验证翻译准确性
- ✅ 缅甸语使用现代日常口语表达
- ✅ 中文使用自然流畅的口语
- ✅ 避免过于生僻的俚语或网络流行语
【特别注意】
- 人称代词、称呼要符合两种语言的礼貌习惯
- 时态、语气助词要准确传达
- 数字、时间、地点等关键信息必须完全一致

现在，请等待用户的文本输入。`;

const OPENING_LINE =
  "你好！请发送你需要翻译的中文或缅甸语内容，我会为你提供4种翻译版本供选择。";

const DEFAULT_SETTINGS = {
  apiKey: "",
  baseUrl: IFLOW_BASE_URL_DEFAULT,
  selectedModel: "deepseek-v3.2",
  temperature: 0.2,
  maxTokens: 2048,

  // TTS
  ttsVoice: "zh-CN-XiaoyouNeural",
  ttsRate: -25, // 固定-25（按你要求）
};

const safeLocalStorageGet = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeLocalStorageSet = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const getLangName = (code) =>
  SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code;

/**
 * ---------------------------
 * TTS：统一用接口（无系统TTS）
 * ---------------------------
 */

const ttsCache = new Map();
const buildTtsUrl = ({ text, voice, rate }) => {
  const v = voice || "zh-CN-XiaoyouNeural";
  const r = typeof rate === "number" ? rate : -25;
  return `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(
    v
  )}&r=${encodeURIComponent(String(r))}`;
};

const preloadTTS = async (text, settings) => {
  if (!text) return;
  const key = `${settings.ttsVoice}__${settings.ttsRate}__${text}`;
  if (ttsCache.has(key)) return;

  try {
    const url = buildTtsUrl({ text, voice: settings.ttsVoice, rate: settings.ttsRate });
    const res = await fetch(url);
    if (!res.ok) throw new Error("TTS API Error");
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(key, audio);
  } catch (e) {
    console.error("TTS preload failed:", e);
  }
};

const playCachedTTS = async (text, settings) => {
  if (!text) return;
  const key = `${settings.ttsVoice}__${settings.ttsRate}__${text}`;
  if (!ttsCache.has(key)) await preloadTTS(text, settings);
  const audio = ttsCache.get(key);
  if (!audio) return;
  // 重新从头播放
  audio.currentTime = 0;
  await audio.play();
};

/**
 * ---------------------------
 * UI 子组件：翻译卡片（紧凑、居中）
 * ---------------------------
 */

const TranslationCard = ({ translation, backTranslation, settings }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(translation || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const onSpeak = async () => {
    // 只读译文（按你需求）
    await playCachedTTS((translation || "").replace(/[#*`]/g, ""), settings);
  };

  return (
    <div className="w-full max-w-[720px] bg-white/85 backdrop-blur border border-gray-200 shadow-[0_8px_28px_rgba(15,23,42,0.08)] rounded-2xl px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] leading-6 text-gray-900 font-medium break-words">
            {translation}
          </div>
          <div className="mt-2 text-[12px] leading-5 text-slate-500 break-words">
            {backTranslation}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onSpeak}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center"
            title="朗读"
          >
            <i className="fas fa-volume-up" />
          </button>

          <button
            onClick={onCopy}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center"
            title="复制"
          >
            <i className={`fas ${copied ? "fa-check text-emerald-600" : "fa-copy"}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

const TranslationResults = ({ results, settings }) => {
  // results: array of {translation, back_translation, style}
  return (
    <div className="w-full flex flex-col items-center gap-2.5">
      {(results || []).slice(0, 4).map((r, idx) => (
        <TranslationCard
          key={idx}
          translation={r.translation}
          backTranslation={r.back_translation}
          settings={settings}
        />
      ))}
    </div>
  );
};

/**
 * ---------------------------
 * 核心：AiChatContent（改为单次翻译，不存聊天）
 * ---------------------------
 */

const AiChatContent = ({ onClose }) => {
  const [isMounted, setIsMounted] = useState(false);

  // settings：无面板，放到输入框区域
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // 翻译配置
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("my-MM");

  // 输入与结果
  const [userInput, setUserInput] = useState("");
  const [results, setResults] = useState(null); // array
  const [statusLine, setStatusLine] = useState(OPENING_LINE);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 语音识别
  const [isListening, setIsListening] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [micLang, setMicLang] = useState("zh-CN"); // 语音识别语言（长按选择）
  const recognitionRef = useRef(null);
  const pressTimerRef = useRef(null);

  const abortRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    const saved = safeLocalStorageGet("translator_settings_v3");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    safeLocalStorageSet("translator_settings_v3", JSON.stringify(settings));
  }, [settings, isMounted]);

  const canSend = useMemo(() => userInput.trim().length > 0 && !isLoading, [userInput, isLoading]);

  const startListening = useCallback((langCode) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("当前浏览器不支持语音识别。");
      return;
    }

    try {
      if (recognitionRef.current) recognitionRef.current.abort();

      const rec = new SpeechRecognition();
      const speechLang =
        SUPPORTED_LANGUAGES.find((l) => l.code === langCode)?.speechCode || "zh-CN";

      rec.lang = speechLang || "zh-CN";
      rec.interimResults = true;
      rec.continuous = false;

      recognitionRef.current = rec;

      rec.onstart = () => {
        setIsListening(true);
        setError("");
        setUserInput("");
      };

      rec.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0]?.transcript || "")
          .join("");

        setUserInput(transcript);

        if (event.results[0]?.isFinal && transcript.trim()) {
          // 自动发送（按你需求）
          submitTranslate(transcript.trim());
        }
      };

      rec.onerror = (event) => {
        setError(`语音识别失败: ${event.error || "unknown"}`);
      };

      rec.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      rec.start();
    } catch (e) {
      setError(`语音识别启动失败: ${e.message}`);
      setIsListening(false);
    }
  }, []);

  const handleMicPress = () => {
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      setShowLangPicker(true); // 长按出现语言选择
    }, 550);
  };
  const handleMicRelease = () => {
    clearTimeout(pressTimerRef.current);
  };
  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    startListening(micLang);
  };

  const parseModelJson = (text) => {
    // 期望：{ data: [...] }
    // 兼容：纯数组 [...]
    try {
      const obj = JSON.parse(text);
      if (obj && Array.isArray(obj.data)) return obj.data;
      if (Array.isArray(obj)) return obj;
      return null;
    } catch {
      return null;
    }
  };

  const callTranslateApi = async (inputText) => {
    setIsLoading(true);
    setError("");
    setResults(null);

    abortRef.current?.abort?.();
    abortRef.current = new AbortController();

    try {
      if (!settings.apiKey?.trim()) throw new Error("请先填写 API Key。");

      const requestPrompt = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(
        targetLang
      )}]:\n\n${inputText}`;

      const messages = [
        { role: "system", content: TRANSLATION_PROMPT_CONTENT },
        { role: "user", content: requestPrompt },
      ];

      const url = `${(settings.baseUrl || IFLOW_BASE_URL_DEFAULT).replace(/\/$/, "")}/chat/completions`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: settings.selectedModel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          messages,
          response_format: { type: "json_object" }, // iflow若兼容则更稳；不兼容也不会坏
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`请求失败: ${res.status} ${t}`);
      }

      const data = await res.json();
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        "";

      if (!content) throw new Error("模型未返回有效内容。");

      const parsed = parseModelJson(content);
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`解析失败：模型未按JSON格式输出。原始内容：${content}`);
      }

      const normalized = parsed.slice(0, 4).map((x) => ({
        style: x.style,
        translation: x.translation || "",
        back_translation: x.back_translation || "",
      }));

      setResults(normalized);
      setStatusLine("翻译完成（4种版本）");

      // 可选：预加载TTS（只预加载译文）
      normalized.forEach((r) => preloadTTS((r.translation || "").slice(0, 300), settings));
    } catch (e) {
      const msg = e?.name === "AbortError" ? "请求已取消。" : (e?.message || "未知错误");
      setError(msg);
      setStatusLine("出现错误，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const submitTranslate = async (textOverride = null) => {
    const text = (textOverride ?? userInput).trim();
    if (!text) {
      setError("请输入要翻译的内容。");
      return;
    }
    setUserInput(""); // 每次翻译当作“新对话”：清空输入
    await callTranslateApi(text);
  };

  const swapLang = () => {
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-800">
      {/* 顶栏 */}
      <header className="shrink-0 px-4 py-3 border-b border-slate-200/70 bg-white/75 backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 transition flex items-center justify-center"
            title="关闭"
          >
            <i className="fas fa-chevron-down text-slate-700" />
          </button>

          <div className="text-center">
            <div className="text-[15px] font-semibold text-slate-900">中缅翻译</div>
            <div className="text-[12px] text-slate-500 mt-0.5">{statusLine}</div>
          </div>

          <div className="w-10 h-10" />
        </div>
      </header>

      {/* 内容区（只显示本次结果） */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        {error && (
          <div className="max-w-[720px] mx-auto mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError("")}>
              关闭
            </button>
          </div>
        )}

        {!results && (
          <div className="max-w-[720px] mx-auto text-center text-slate-500 text-sm mt-10">
            {OPENING_LINE}
          </div>
        )}

        {results && (
          <div className="mt-2">
            <TranslationResults results={results} settings={settings} />
          </div>
        )}
      </main>

      {/* 语言选择浮层（长按麦克风出现；不是设置面板） */}
      {showLangPicker && (
        <div
          className="fixed inset-0 z-[10010] bg-black/20 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => setShowLangPicker(false)}
        >
          <div
            className="w-full max-w-[560px] bg-white rounded-2xl border border-slate-200 shadow-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-900 px-2 pb-2">选择语音识别语言</div>
            <div className="grid grid-cols-2 gap-2 max-h-[46vh] overflow-y-auto px-1 pb-1">
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
                <button
                  key={l.code}
                  className={`px-3 py-2 rounded-xl border text-sm text-left transition ${
                    micLang === l.code
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    setMicLang(l.code);
                    setShowLangPicker(false);
                  }}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowLangPicker(false)}
              className="mt-3 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 输入区（包含“设置”小控件） */}
      <footer className="shrink-0 border-t border-slate-200/70 bg-white/80 backdrop-blur px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {/* 输入框里的“设置”区域（按你要求：设置放到输入框里） */}
        <div className="max-w-[920px] mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <input
              value={settings.apiKey}
              onChange={(e) => setSettings((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="API Key"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-slate-100 border border-transparent focus:border-blue-300 outline-none text-sm"
              type="password"
            />

            <select
              value={settings.selectedModel}
              onChange={(e) => setSettings((p) => ({ ...p, selectedModel: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-transparent focus:border-blue-300 outline-none text-sm"
            >
              {CHAT_MODELS_LIST.map((m) => (
                <option key={m.id} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100">
              <span className="text-xs text-slate-600">温度</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.temperature}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, temperature: parseFloat(e.target.value) }))
                }
              />
              <span className="text-xs text-slate-600 w-10 text-right">
                {settings.temperature.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 源/目标语言 */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="bg-slate-100 rounded-full px-4 py-2 text-sm font-semibold border border-transparent hover:border-slate-200 transition outline-none"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>

            <button
              onClick={swapLang}
              disabled={sourceLang === "auto"}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition flex items-center justify-center"
              title="交换"
            >
              <i className="fas fa-exchange-alt text-slate-700" />
            </button>

            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-slate-100 rounded-full px-4 py-2 text-sm font-semibold border border-transparent hover:border-slate-200 transition outline-none"
            >
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* 输入 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitTranslate();
            }}
            className="flex items-end gap-2 bg-slate-100 p-2 rounded-[24px] border border-transparent focus-within:border-blue-300 transition"
          >
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isListening ? "正在聆听…（识别完成将自动发送）" : "输入要翻译的内容…"}
              className="flex-1 bg-transparent max-h-40 min-h-[48px] py-3 px-3 resize-none outline-none text-[15px] leading-6 placeholder:text-slate-400"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitTranslate();
                }
              }}
            />

            {/* 麦克风（蓝色背景，长按选语言） or 发送 */}
            {!canSend ? (
              <button
                type="button"
                onClick={handleMicClick}
                onMouseDown={handleMicPress}
                onMouseUp={handleMicRelease}
                onTouchStart={handleMicPress}
                onTouchEnd={handleMicRelease}
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition ${
                  isListening
                    ? "bg-blue-600 text-white animate-pulse"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title="语音识别（长按选择语言）"
              >
                <i className={`fas ${isListening ? "fa-stop" : "fa-microphone-alt"} text-xl`} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                title="发送"
              >
                {isLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-arrow-up" />}
              </button>
            )}
          </form>

          <div className="text-center text-[11px] text-slate-400 mt-2">
            语音识别语言：{getLangName(micLang)} · TTS：{settings.ttsVoice} · 语速：{settings.ttsRate}
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * ---------------------------
 * Drawer Wrapper
 * ---------------------------
 */

const AIChatDrawer = ({ isOpen, onClose }) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-250"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-in-out duration-300"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="transform transition ease-in-out duration-250"
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
