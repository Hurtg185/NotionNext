import { Transition, Dialog } from '@headlessui/react'
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
} from 'react'

/* ------------------------- Utils ------------------------- */

const convertGitHubUrl = (url) => {
  if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) {
    return url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
  }
  return url
}

const safeLocalStorageGet = (key) => {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const safeLocalStorageSet = (key, value) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

const generateSimpleId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const playKeySound = () => {
  try {
    const audio = new Audio('/sounds/typing-key.mp3')
    audio.volume = 0.4
    audio.play().catch(() => {})
  } catch {}
}
const vibrate = () => {
  try {
    if (navigator.vibrate) navigator.vibrate(50)
  } catch {}
}

/* ------------------------- Language ------------------------- */

const detectLanguage = (text) => {
  if (/[ \u1000-\u109F]/.test(text)) return 'my-MM'
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh-CN'
  return 'en-US'
}

/* ------------------------- Prompt (替换为你给的) ------------------------- */
/**
 * 注：你给的 JSON 示例存在不合法的地方（花括号/逗号），我这里修正成严格可解析版本；
 * 规则内容保持一致。
 */
const TRANSLATION_PROMPT = {
  content: `你是一位【中缅双语翻译专家】，专门处理日常聊天场景的翻译。

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
- 忠实原文语义，尽量不增不减
- 语言自然、不刻意书面化

2. **自然意译**
- 在保留原文完整含义的基础上，让译文符合目标语言的表达习惯
- 可调整语序，选择更自然的说法
- 读起来流畅，像母语者说的话

3. **口语化**
- 采用日常对话的轻松表达方式
- 使用简短句式和常用词汇
- 可适当添加语气词（如：呢、啊、吧）
- 更接地气、更亲切

4. **保留原文结构**
- 尽量保持原文的句式和词序
- 确保关键词和表达的对应关系清晰
- 译文准确但可能略显直译

【翻译总原则】
- ✅ 完整传达原文意思，不遗漏、不添加
- ✅ 根据上下文判断语气（正式/随意、礼貌/亲密等）
- ✅ 回译(back_translation)必须忠实翻译回源语言，用于验证准确性
- ✅ 缅甸语使用现代日常口语表达
- ✅ 中文使用自然流畅的口语
- ❌ 避免过度文学化或书面语
- ❌ 避免生僻俚语和过时网络用语

现在请等待用户输入需要翻译的内容。`,
  openingLine: '你好！请发送你需要翻译的中文或缅甸语，我会提供多种翻译版本供你选择。',
}

/* ------------------------- Constants ------------------------- */

const CHAT_MODELS_LIST = [
  { id: 'model-1', name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest' },
  { id: 'model-2', name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest' },
  { id: 'model-3', name: 'GPT-4o', value: 'gpt-4o' },
  { id: 'model-4', name: 'GPT-3.5-Turbo', value: 'gpt-3.5-turbo' },
]

const MICROSOFT_TTS_VOICES = [
  { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
  { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
  { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
]

const DEFAULT_SETTINGS = {
  apiConfig: { url: 'https://api.openai.com/v1', key: '' },
  chatModels: CHAT_MODELS_LIST,
  selectedModel: 'gpt-4o',
  ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
  autoReadFirstTranslation: true,
  chatBackgroundUrl: '',
  backgroundOpacity: 100,
  userAvatarUrl: '/images/user-avatar.png',
  aiAvatarUrl:
    'https://raw.githubusercontent.com/BigFaceCat2023/spacetrans/main/public/images/translator-avatar.png',
}

const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动识别', speechCode: 'zh-CN' },
  { code: 'zh-CN', name: '中文', speechCode: 'zh-CN' },
  { code: 'my-MM', name: '缅甸语', speechCode: 'my-MM' },
]

const SPEECH_RECOGNITION_LANGUAGES = [
  { name: '中文 (普通话)', value: 'zh-CN' },
  { name: '缅甸语 (မြန်မာ)', value: 'my-MM' },
  { name: 'English (US)', value: 'en-US' },
]

/* ------------------------- JSON parsing ------------------------- */

function extractJsonObject(text) {
  const s = String(text ?? '').trim()

  // remove ``` blocks if any
  const stripped = s.startsWith('```')
    ? s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    : s

  // try direct parse
  try {
    return JSON.parse(stripped)
  } catch {}

  // fallback: find first { ... last }
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = stripped.slice(start, end + 1)
    return JSON.parse(candidate)
  }

  throw new Error('无法解析模型返回的 JSON。')
}

/* ------------------------- TTS ------------------------- */

async function ensureVoicesLoaded() {
  if (!window.speechSynthesis) return []
  const voices = window.speechSynthesis.getVoices()
  if (voices && voices.length) return voices

  // wait for voiceschanged
  return await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 800)
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timer)
      resolve(window.speechSynthesis.getVoices() || [])
    }
  })
}

async function speakText(text, voiceName) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  const lang = detectLanguage(text)
  const voices = await ensureVoicesLoaded()

  const hint = voiceName?.split('-')[2]?.replace('Neural', '') // Xiaoxiao...
  const matched = voices.find((v) => (hint ? v.name.includes(hint) : false) && v.lang === lang)

  if (matched) utter.voice = matched
  else utter.lang = lang

  window.speechSynthesis.speak(utter)
}

/* ------------------------- UI Subcomponents ------------------------- */

const AiTtsButton = ({ text, voiceName }) => {
  const [isPlaying, setIsPlaying] = useState(false)

  const handleSpeak = async (e) => {
    e.stopPropagation()
    if (!window.speechSynthesis) {
      alert('您的浏览器不支持语音朗读功能')
      return
    }
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    const lang = detectLanguage(text)
    const voices = await ensureVoicesLoaded()
    const hint = voiceName?.split('-')[2]?.replace('Neural', '')
    const matched = voices.find((v) => (hint ? v.name.includes(hint) : false) && v.lang === lang)
    if (matched) utter.voice = matched
    else utter.lang = lang

    utter.onstart = () => setIsPlaying(true)
    utter.onend = () => setIsPlaying(false)
    utter.onerror = () => setIsPlaying(false)
    window.speechSynthesis.speak(utter)
  }

  return (
    <button
      onClick={handleSpeak}
      className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
        isPlaying ? 'text-blue-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'
      }`}
      title={isPlaying ? '停止朗读' : '朗读'}
    >
      <i className={`fas ${isPlaying ? 'fa-stop-circle' : 'fa-volume-up'} text-xl`} />
    </button>
  )
}

const TranslationCard = ({ result, voiceName }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(result.translation || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 shadow-md rounded-xl p-4 flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {result.style || '翻译'}
      </div>
      <p className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed flex-grow">
        {result.translation || ''}
      </p>
      <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
        <i className="fas fa-undo-alt mr-2 opacity-60" />
        {result.back_translation || ''}
      </p>
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          onClick={handleCopy}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
          title="复制"
        >
          <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-copy'} text-xl`} />
        </button>
        <AiTtsButton text={result.translation || ''} voiceName={voiceName} />
      </div>
    </div>
  )
}

const TranslationResults = ({ results, voiceName }) => (
  <div className="flex flex-col gap-3">
    {(results || []).map((r, idx) => (
      <TranslationCard key={idx} result={r} voiceName={voiceName} />
    ))}
  </div>
)

const LoadingSpinner = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      playKeySound()
      vibrate()
    }, 500)
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="flex my-4 justify-start">
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-700 shadow-md flex items-center justify-center w-20 h-14">
        <div className="w-7 h-7 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    </div>
  )
}

const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user'
  const userBubbleClass = 'bg-blue-600 text-white rounded-br-none shadow-lg'
  const hasTranslations = Array.isArray(msg.translations) && msg.translations.length > 0

  return (
    <div className={`flex my-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`text-left flex flex-col ${isUser ? userBubbleClass : ''} ${
          isUser && 'p-3 rounded-xl'
        }`}
        style={{ maxWidth: '90%' }}
      >
        {hasTranslations ? (
          <TranslationResults results={msg.translations} voiceName={msg.voiceName} />
        ) : (
          <p className={`text-lg ${isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
            {msg.content || ''}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------- Settings Modal (保留你原逻辑) ------------------------- */

const ModelManager = ({ models, onChange, onAdd, onDelete }) => (
  <>
    {(models || []).map((m) => (
      <div
        key={m.id}
        className="p-3 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"
      >
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={m.name}
            onChange={(e) => onChange(m.id, 'name', e.target.value)}
            placeholder="模型显示名称"
            className="font-semibold bg-transparent w-full text-base"
          />
          <button
            onClick={() => onDelete(m.id)}
            className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"
          >
            <i className="fas fa-trash" />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium">模型值 (Value)</label>
          <input
            type="text"
            value={m.value}
            onChange={(e) => onChange(m.id, 'value', e.target.value)}
            placeholder="例如: gpt-4o"
            className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs"
          />
        </div>
      </div>
    ))}
    <button onClick={onAdd} className="w-full mt-2 py-2 bg-blue-500 text-white rounded-md text-sm">
      <i className="fas fa-plus mr-2" />
      添加新模型
    </button>
  </>
)

const SettingsModal = ({ settings, onSave, onClose }) => {
  const [tempSettings, setTempSettings] = useState(settings)
  const [isKeyVisible, setKeyVisible] = useState(false)
  const fileInputRef = useRef(null)

  const handleChange = (key, value) => setTempSettings((p) => ({ ...p, [key]: value }))
  const handleApiChange = (field, value) =>
    setTempSettings((p) => ({ ...p, apiConfig: { ...p.apiConfig, [field]: value } }))

  const handleBgImageSelect = (event) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => handleChange('chatBackgroundUrl', e.target.result)
      reader.readAsDataURL(file)
    }
    event.target.value = null
  }

  const handleAddModel = () =>
    handleChange('chatModels', [
      ...(tempSettings.chatModels || []),
      { id: generateSimpleId('model'), name: '新模型', value: '' },
    ])
  const handleDeleteModel = (id) => {
    if (!window.confirm('确定删除吗？')) return
    handleChange(
      'chatModels',
      (tempSettings.chatModels || []).filter((m) => m.id !== id),
    )
  }
  const handleModelChange = (id, field, value) =>
    handleChange(
      'chatModels',
      (tempSettings.chatModels || []).map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    )

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200 flex flex-col"
        style={{ height: 'min(700px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold p-6 shrink-0">设置</h3>

        <div className="space-y-6 flex-grow overflow-y-auto px-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3">
            <h4 className="font-bold text-lg">API 设置 (OpenAI 兼容)</h4>
            <div>
              <label className="text-xs font-medium block">接口地址 (Endpoint)</label>
              <input
                type="text"
                value={tempSettings.apiConfig.url}
                onChange={(e) => handleApiChange('url', e.target.value)}
                placeholder="例如: https://api.openai.com/v1"
                className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium block">密钥 (Key)</label>
              <div className="relative">
                <input
                  type={isKeyVisible ? 'text' : 'password'}
                  value={tempSettings.apiConfig.key}
                  onChange={(e) => handleApiChange('key', e.target.value)}
                  placeholder="请输入密钥"
                  className="w-full mt-1 px-2 py-1 pr-8 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${isKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="font-bold mb-3 text-lg">模型管理</h4>
            <ModelManager
              models={tempSettings.chatModels}
              onChange={handleModelChange}
              onAdd={handleAddModel}
              onDelete={handleDeleteModel}
            />
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="font-bold mb-3 text-lg">发音人选择</h4>
            <select
              value={tempSettings.ttsVoice}
              onChange={(e) => handleChange('ttsVoice', e.target.value)}
              className="w-full mt-1 px-2 py-2 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm"
            >
              {MICROSOFT_TTS_VOICES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">聊天背景</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md shrink-0 hover:bg-gray-700"
              >
                上传背景图
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleBgImageSelect}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm shrink-0">
                背景图透明度: {tempSettings.backgroundOpacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={tempSettings.backgroundOpacity}
                onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">自动朗读首个翻译结果</label>
              <input
                type="checkbox"
                checked={tempSettings.autoReadFirstTranslation}
                onChange={(e) => handleChange('autoReadFirstTranslation', e.target.checked)}
                className="h-5 w-5 text-blue-500 rounded"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 p-6 shrink-0 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">
            关闭
          </button>
          <button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-blue-600 text-white rounded-md">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------- Generic Modal Selector ------------------------- */

const ModalSelector = ({ title, options, selectedValue, onSelect, onClose }) => (
  <div
    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex flex-col p-4 animate-fade-in"
    onClick={onClose}
  >
    <div
      className="w-full max-w-md m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-center relative">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <i className="fas fa-times" />
        </button>
      </div>
      <div className="p-2 overflow-y-auto max-h-[60vh]">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onSelect(opt.value)
              onClose()
            }}
            className={`w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-blue-500/10 ${
              selectedValue === opt.value
                ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10'
                : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  </div>
)

/* ------------------------- Core Chat ------------------------- */

async function callChatCompletions({ apiUrl, apiKey, model, systemPrompt, userPrompt }) {
  const res = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })

  let payload = null
  try {
    payload = await res.json()
  } catch {}

  if (!res.ok) {
    const msg = payload?.error?.message || `请求失败: ${res.status}`
    throw new Error(msg)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI未能返回有效内容。')
  return content
}

const AiChatContent = ({ onClose }) => {
  const [messages, setMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isMounted, setIsMounted] = useState(false)

  const [isListening, setIsListening] = useState(false)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('my-MM')

  const [showSettings, setShowSettings] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showLanguageSelector, setShowLanguageSelector] = useState(false)

  const [speechLang, setSpeechLang] = useState('zh-CN')

  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  // press-to-open-language modal (long press)
  const pressTimerRef = useRef(null)

  // auto-send when silence
  const speechEndTimerRef = useRef(null)
  const speechCommittedRef = useRef(false)

  const latestUserInputRef = useRef('')
  useEffect(() => {
    latestUserInputRef.current = userInput
  }, [userInput])

  const getLangName = useCallback(
    (code) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code,
    [],
  )
  const getModelName = useCallback(
    (value) => (settings.chatModels || []).find((m) => m.value === value)?.name || value,
    [settings.chatModels],
  )

  useEffect(() => {
    setIsMounted(true)

    const saved = safeLocalStorageGet('ai_chat_settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          chatModels: parsed.chatModels?.length ? parsed.chatModels : CHAT_MODELS_LIST,
        })
      } catch {
        setSettings(DEFAULT_SETTINGS)
      }
    }

    setMessages([{ role: 'ai', content: TRANSLATION_PROMPT.openingLine, timestamp: Date.now() }])
  }, [])

  useEffect(() => {
    if (!isMounted) return
    safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings))
  }, [settings, isMounted])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // set speechLang based on sourceLang selection
  useEffect(() => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)
    if (lang) setSpeechLang(lang.speechCode)
  }, [sourceLang])

  const showSendButton = useMemo(() => userInput.trim().length > 0, [userInput])

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings)
    setShowSettings(false)
  }

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto' || sourceLang === targetLang) return
    const cur = sourceLang
    setSourceLang(targetLang)
    setTargetLang(cur)
  }

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {}
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入。')
      return
    }

    try {
      recognitionRef.current?.abort()
    } catch {}

    speechCommittedRef.current = false
    setError('')

    const recognition = new SpeechRecognition()
    recognition.lang = speechLang
    recognition.interimResults = true
    recognition.continuous = true
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setIsListening(true)
      setUserInput('')
    }

    recognition.onresult = (event) => {
      // collect transcript
      clearTimeout(speechEndTimerRef.current)

      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0]?.transcript || ''
        if (event.results[i].isFinal) finalText += t
        else interimText += t
      }

      const combined = (finalText + interimText).trim()
      setUserInput(combined)

      // silence => auto send
      speechEndTimerRef.current = setTimeout(() => {
        if (speechCommittedRef.current) return
        const current = (latestUserInputRef.current || '').trim()
        if (!current) return
        speechCommittedRef.current = true
        stopListening()
        handleSubmit(false, current)
      }, 1200)
    }

    recognition.onerror = (event) => {
      setError(`语音识别失败: ${event.error}`)
    }

    recognition.onend = () => {
      setIsListening(false)
      clearTimeout(speechEndTimerRef.current)
      recognitionRef.current = null
    }

    recognition.start()
  }, [speechLang, stopListening]) // handleSubmit defined below but hoisted via function declaration

  const handleMicPress = () => {
    pressTimerRef.current = setTimeout(() => {
      stopListening()
      setShowLanguageSelector(true)
    }, 500)
  }
  const handleMicRelease = () => {
    clearTimeout(pressTimerRef.current)
  }

  const fetchAiResponse = useCallback(
    async (userText) => {
      setIsLoading(true)
      setError('')

      const { apiConfig, selectedModel, ttsVoice } = settings
      try {
        if (!apiConfig?.key) throw new Error('请在“设置”中配置您的 API 密钥。')

        const userPrompt = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(
          targetLang,
        )}]:\n\n${userText}`

        const content = await callChatCompletions({
          apiUrl: apiConfig.url,
          apiKey: apiConfig.key,
          model: selectedModel,
          systemPrompt: TRANSLATION_PROMPT.content,
          userPrompt,
        })

        const parsed = extractJsonObject(content)
        const translations = parsed?.data

        if (!Array.isArray(translations) || translations.length === 0) {
          throw new Error('返回的JSON格式不正确或为空。')
        }

        setMessages((prev) => [
          ...prev,
          { role: 'ai', timestamp: Date.now(), translations, voiceName: ttsVoice },
        ])

        if (settings.autoReadFirstTranslation && translations[0]?.translation) {
          speakText(translations[0].translation, ttsVoice)
        }
      } catch (err) {
        const errorMessage = `请求错误: ${err.message}`
        setMessages((prev) => [
          ...prev,
          { role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() },
        ])
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [settings, getLangName, sourceLang, targetLang],
  )

  function handleSubmit(isRegenerate = false, textToSend = null) {
    // regen: reuse last user
    if (isRegenerate) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
      if (!lastUserMsg?.content) return
      setMessages([lastUserMsg])
      fetchAiResponse(lastUserMsg.content)
      return
    }

    const text = (textToSend ?? userInput).trim()
    if (!text) {
      setError('请输入要翻译的内容！')
      return
    }

    const userMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages([userMessage]) // 保持你原来的“单轮对话”体验
    setUserInput('')
    fetchAiResponse(text)
  }

  if (!isMounted) return null

  const handleMainButtonClick = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (showSendButton) handleSubmit()
    else {
      if (isListening) stopListening()
      else startListening()
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f0f2f5] dark:bg-[#121212] text-gray-800 dark:text-gray-200 overflow-hidden relative">
      {settings.chatBackgroundUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`,
            opacity: (settings.backgroundOpacity ?? 70) / 100,
          }}
        />
      )}

      <div className="flex-1 flex flex-col h-full relative overflow-hidden z-10 pt-safe-top">
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {messages.map((msg) => (
            <div key={msg.timestamp}>
              <MessageBubble msg={msg} />
            </div>
          ))}
          {isLoading && <LoadingSpinner />}
          <div ref={messagesEndRef} />
        </div>

        <footer className="shrink-0 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {error && (
            <div
              className="mb-2 p-2 bg-red-100 text-red-800 text-center text-xs rounded"
              onClick={() => setError('')}
            >
              {error} (点击关闭)
            </div>
          )}

          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-2">
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-center text-gray-800 dark:text-gray-200"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800">
                    {l.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSwapLanguages}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-600/80 border border-black/10 dark:border-white/10 transition-transform active:rotate-180 disabled:opacity-50"
                disabled={sourceLang === 'auto'}
              >
                <i className="fas fa-exchange-alt text-gray-800 dark:text-gray-200" />
              </button>

              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold border-none outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-center text-gray-800 dark:text-gray-200"
              >
                {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
                  <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800">
                    {l.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowModelSelector(true)}
                className="bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
              >
                {getModelName(settings.selectedModel)}
              </button>
            </div>

            <form
              onSubmit={handleMainButtonClick}
              className="flex items-end gap-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg p-2 rounded-[28px] shadow-lg border border-black/10 dark:border-white/10"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSettings(true)
                }}
                className="w-12 h-12 flex items-center justify-center shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <i className="fas fa-cog text-gray-600 dark:text-gray-300" />
              </button>

              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={isListening ? '正在聆听...' : '输入要翻译的内容...'}
                className="flex-1 bg-transparent max-h-48 min-h-[48px] py-3 px-2 resize-none outline-none text-lg leading-6 dark:placeholder-gray-500 self-center"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
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
                className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ease-in-out ${
                  showSendButton
                    ? 'bg-blue-600 text-white'
                    : isListening
                      ? 'bg-red-500 text-white scale-110 animate-pulse'
                      : 'bg-blue-500 text-white'
                }`}
              >
                <i
                  className={`fas ${
                    showSendButton ? 'fa-arrow-up' : isListening ? 'fa-stop' : 'fa-microphone-alt'
                  } text-2xl`}
                />
              </button>
            </form>
          </div>
        </footer>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showModelSelector && (
        <ModalSelector
          title="切换模型"
          options={(settings.chatModels || []).map((m) => ({ name: m.name, value: m.value }))}
          selectedValue={settings.selectedModel}
          onSelect={(val) => setSettings((s) => ({ ...s, selectedModel: val }))}
          onClose={() => setShowModelSelector(false)}
        />
      )}

      {showLanguageSelector && (
        <ModalSelector
          title="选择语音识别语言"
          options={SPEECH_RECOGNITION_LANGUAGES}
          selectedValue={speechLang}
          onSelect={(val) => setSpeechLang(val)}
          onClose={() => setShowLanguageSelector(false)}
        />
      )}
    </div>
  )
}

/* ------------------------- Drawer Wrapper ------------------------- */

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
  )
}

export default AIChatDrawer
