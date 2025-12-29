import { Transition, Dialog } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'

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
    audio.volume = 0.25
    audio.play().catch(() => {})
  } catch {}
}

/* ------------------------- Prompt ------------------------- */

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

【翻译总原则】
- ✅ 完整传达原文意思，不遗漏、不添加
- ✅ 回译(back_translation)必须忠实翻译回源语言
- ✅ 缅甸语使用现代日常口语表达；中文使用自然流畅口语
- ❌ 不要输出额外解释`,
  openingLine: '你好！请发送你需要翻译的中文或缅甸语，我会提供多种翻译版本供你选择。',
}

/* ------------------------- Constants ------------------------- */

const CHAT_MODELS_LIST = [
  { id: 'model-1', name: 'GPT-4o', value: 'gpt-4o' },
  { id: 'model-2', name: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { id: 'model-3', name: 'GPT-3.5-Turbo', value: 'gpt-3.5-turbo' },
  // 你可以保留 Gemini 作为“可添加”，但如果不是 OpenAI 模型不要选
]

const MICROSOFT_TTS_VOICES = [
  { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
  { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
  { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
]

const DEFAULT_SETTINGS = {
  apiConfig: { url: 'https://api.openai.com/v1', key: '' }, // ✅ 固定官方
  chatModels: CHAT_MODELS_LIST,
  selectedModel: 'gpt-4o',
  secondModel: 'gpt-4o-mini', // ✅ 第二模型：从 models 列表里选

  enableSecondModel: true, // ✅ 双模型左右滑开关

  // ✅ 默认晓晓多语言
  ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
  autoReadFirstTranslation: true,

  chatBackgroundUrl: '',
  backgroundOpacity: 100,
}

/* ------------------------- Languages ------------------------- */

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

  const stripped = s.startsWith('```')
    ? s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    : s

  try {
    return JSON.parse(stripped)
  } catch {}

  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = stripped.slice(start, end + 1)
    return JSON.parse(candidate)
  }

  throw new Error('无法解析模型返回的 JSON。')
}

/* ------------------------- TTS (Leftsite cache) ------------------------- */

const ttsCache = new Map()

const preloadTTS = async (text, voiceName) => {
  if (!text) return
  const key = `${voiceName}::${text}`
  if (ttsCache.has(key)) return
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(
      text,
    )}&v=${encodeURIComponent(voiceName || 'zh-CN-XiaoxiaoMultilingualNeural')}&r=-25`
    const response = await fetch(url)
    if (!response.ok) throw new Error('API Error')
    const blob = await response.blob()
    const audio = new Audio(URL.createObjectURL(blob))
    ttsCache.set(key, audio)
  } catch (e) {
    console.error(`预加载 "${text}" 失败:`, e)
  }
}

const playCachedTTS = (text, voiceName) => {
  if (!text) return
  const key = `${voiceName}::${text}`
  if (ttsCache.has(key)) {
    const a = ttsCache.get(key)
    try {
      a.pause()
      a.currentTime = 0
    } catch {}
    a.play().catch(() => {})
  } else {
    preloadTTS(text, voiceName).then(() => {
      if (ttsCache.has(key)) {
        const a = ttsCache.get(key)
        try {
          a.pause()
          a.currentTime = 0
        } catch {}
        a.play().catch(() => {})
      }
    })
  }
}

/* ------------------------- UI Components ------------------------- */

const AiTtsButton = ({ text, voiceName }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const handleSpeak = async (e) => {
    e.stopPropagation()
    if (!text) return
    setIsPlaying(true)
    try {
      await preloadTTS(text, voiceName)
      playCachedTTS(text, voiceName)
    } finally {
      setTimeout(() => setIsPlaying(false), 500)
    }
  }

  return (
    <button
      onClick={handleSpeak}
      className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
        isPlaying ? 'text-blue-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'
      }`}
      title="朗读"
    >
      <i className="fas fa-volume-up text-xl" />
    </button>
  )
}

const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 shadow-md rounded-xl p-4">
    <div className="h-4 w-4/5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
    <div className="h-4 w-3/5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
    <div className="h-4 w-2/5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
    <div className="h-3 w-1/2 bg-blue-100 dark:bg-blue-900/30 rounded animate-pulse" />
  </div>
)

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
      {/* ✅ UI 不显示风格 */}
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

const TranslationResultsWithSkeleton = ({ results, voiceName, skeletonCount = 0 }) => (
  <div className="flex flex-col gap-3 mx-auto w-full max-w-[520px] px-2">
    {(results || []).map((r, idx) => (
      <TranslationCard key={`r-${idx}`} result={r} voiceName={voiceName} />
    ))}
    {Array.from({ length: skeletonCount }).map((_, i) => (
      <SkeletonCard key={`s-${i}`} />
    ))}
  </div>
)

const ModelSwipeResults = ({ modelPages, voiceName }) => {
  const scrollerRef = useRef(null)
  const [page, setPage] = useState(0)

  const pages = Array.isArray(modelPages) ? modelPages : []
  const pageCount = pages.length

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const w = el.clientWidth || 1
    const idx = Math.round(el.scrollLeft / w)
    if (idx !== page) setPage(idx)
  }

  const scrollTo = (idx) => {
    const el = scrollerRef.current
    if (!el) return
    const w = el.clientWidth
    el.scrollTo({ left: idx * w, behavior: 'smooth' })
  }

  if (!pageCount) return null

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {pages[page]?.modelName || '模型'}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  scrollTo(i)
                }}
                className={`w-2 h-2 rounded-full ${
                  i === page ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                title={`切换到 ${pages[i]?.modelName || `模型${i + 1}`}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              scrollTo(Math.max(0, page - 1))
            }}
            className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40"
            disabled={page === 0}
            title="上一页"
          >
            <i className="fas fa-chevron-left text-sm" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              scrollTo(Math.min(pageCount - 1, page + 1))
            }}
            className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40"
            disabled={page === pageCount - 1}
            title="下一页"
          >
            <i className="fas fa-chevron-right text-sm" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="w-full overflow-x-auto flex snap-x snap-mandatory scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {pages.map((p, idx) => {
          const results = p?.translations || []
          const skeletonCount = Math.max(0, 4 - results.length)
          return (
            <div key={idx} className="w-full shrink-0 snap-center">
              <TranslationResultsWithSkeleton
                results={results}
                voiceName={voiceName}
                skeletonCount={skeletonCount}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 text-center text-[11px] text-gray-500 dark:text-gray-400">
        左右滑动切换不同模型翻译结果
      </div>
    </div>
  )
}

const LoadingSpinner = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      playKeySound()
      // ✅ 去掉震动
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex my-4 justify-start">
      <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-700 shadow-md flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.2s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.1s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" />
      </div>
    </div>
  )
}

const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user'
  const userBubbleClass = 'bg-blue-600 text-white rounded-br-none shadow-lg'

  const hasModelPages = Array.isArray(msg.modelPages) && msg.modelPages.length > 0
  const hasTranslations = Array.isArray(msg.translations) && msg.translations.length > 0

  return (
    <div className={`flex my-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`text-left flex flex-col ${isUser ? userBubbleClass : ''} ${
          isUser && 'p-3 rounded-xl'
        }`}
        style={{ maxWidth: '92%' }}
      >
        {hasModelPages ? (
          <ModelSwipeResults modelPages={msg.modelPages} voiceName={msg.voiceName} />
        ) : hasTranslations ? (
          <TranslationResultsWithSkeleton results={msg.translations} voiceName={msg.voiceName} />
        ) : (
          <p className={`text-lg ${isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
            {msg.content || ''}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------- Settings Modal ------------------------- */

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

  const modelOptions = (tempSettings.chatModels || []).filter((m) => !!m.value)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200 flex flex-col"
        style={{ height: 'min(780px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold p-6 shrink-0">设置</h3>

        <div className="space-y-6 flex-grow overflow-y-auto px-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3">
            <h4 className="font-bold text-lg">API 设置（OpenAI 官方）</h4>
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

          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3">
            <h4 className="font-bold text-lg">双模型（左右滑切换）</h4>

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">启用第二模型</label>
              <input
                type="checkbox"
                checked={!!tempSettings.enableSecondModel}
                onChange={(e) => handleChange('enableSecondModel', e.target.checked)}
                className="h-5 w-5 text-blue-500 rounded"
              />
            </div>

            <div>
              <label className="text-xs font-medium block">第二模型</label>
              <select
                value={tempSettings.secondModel}
                onChange={(e) => handleChange('secondModel', e.target.value)}
                className="w-full mt-1 px-2 py-2 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm"
              >
                {modelOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name} ({m.value})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                翻译完成后可左右滑动查看两个模型结果。
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="font-bold mb-3 text-lg">发音人选择（TTS）</h4>
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

            <div className="flex items-center justify-between mt-3">
              <label className="block text-sm font-medium">自动朗读首个翻译结果</label>
              <input
                type="checkbox"
                checked={tempSettings.autoReadFirstTranslation}
                onChange={(e) => handleChange('autoReadFirstTranslation', e.target.checked)}
                className="h-5 w-5 text-blue-500 rounded"
              />
            </div>
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
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 p-6 shrink-0 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">
            关闭
          </button>
          <button
            onClick={() => onSave(tempSettings)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------- Modal Selector (kept) ------------------------- */

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

/* ------------------------- Core Chat API ------------------------- */

async function callChatCompletions({ apiUrl, apiKey, model, systemPrompt, userPrompt, signal }) {
  const res = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    signal,
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
      max_tokens: 700,

      // ✅ 关键修复：不使用 response_format（更兼容、更接近“以前都能用”的方式）
      // response_format: { type: 'json_object' },
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

  const content =
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    payload?.output_text ??
    ''

  if (!content) {
    const snippet = payload ? JSON.stringify(payload).slice(0, 600) : '(empty json)'
    throw new Error(`AI未能返回有效数据。响应片段: ${snippet}`)
  }

  return content
}

async function translatePhase({ apiUrl, apiKey, model, systemPrompt, userPrompt, signal }) {
  const content = await callChatCompletions({
    apiUrl,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    signal,
  })
  const parsed = extractJsonObject(content)
  const translations = parsed?.data
  if (!Array.isArray(translations) || translations.length === 0) {
    throw new Error('返回的JSON格式不正确或为空。')
  }
  return translations
}

/* ------------------------- Core Chat UI ------------------------- */

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

  const pressTimerRef = useRef(null)

  const abortRef = useRef(null)

  // voice final-driven silence timer
  const finalSilenceTimerRef = useRef(null)
  const lastFinalRef = useRef('')

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
          apiConfig: { ...DEFAULT_SETTINGS.apiConfig, ...(parsed.apiConfig || {}) },
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

  useEffect(() => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)
    if (lang) setSpeechLang(lang.speechCode)
  }, [sourceLang])

  const showSendButton = useMemo(() => userInput.trim().length > 0, [userInput])

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

  // ✅ 稳定提交
  const submitText = useCallback(
    (text) => {
      const t = (text || '').trim()
      if (!t) {
        setError('请输入要翻译的内容！')
        return
      }
      const userMessage = { role: 'user', content: t, timestamp: Date.now() }
      setMessages([userMessage]) // 单轮对话
      setUserInput('')
      fetchAiResponse(t)
    },
    // fetchAiResponse declared below via useCallback; React hook requires it in deps, so we wrap with ref:
    // We'll define fetchAiResponse first? easier: useRef pattern
    // (implemented below)
    [],
  )

  // We need fetchAiResponse but submitText uses it; use a ref to avoid circular deps cleanly.
  const fetchRef = useRef(null)
  useEffect(() => {
    // set later
  }, [])

  const fetchAiResponse = useCallback(
    async (userText) => {
      setIsLoading(true)
      setError('')

      try {
        abortRef.current?.abort()
      } catch {}
      const controller = new AbortController()
      abortRef.current = controller

      const { apiConfig, selectedModel, enableSecondModel, secondModel, ttsVoice } = settings

      try {
        if (!apiConfig?.key) throw new Error('请在“设置”中配置您的 API 密钥。')

        const base = `请将以下文本从 [${getLangName(sourceLang)}] 翻译成 [${getLangName(
          targetLang,
        )}]:\n\n${userText}\n\n`

        // 初始化：先放一个“占位”AI消息（两页都 skeleton）
        const msgId = `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`
        const initialPages = [
          { modelValue: selectedModel, modelName: getModelName(selectedModel), translations: [] },
        ]
        const useSecond = !!enableSecondModel && !!secondModel && secondModel !== selectedModel
        if (useSecond) {
          initialPages.push({
            modelValue: secondModel,
            modelName: getModelName(secondModel),
            translations: [],
          })
        }

        setMessages((prev) => [
          ...prev,
          { id: msgId, role: 'ai', timestamp: Date.now(), modelPages: initialPages, voiceName: ttsVoice },
        ])

        const updatePage = (modelValue, patch) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== msgId) return m
              const pages = (m.modelPages || []).map((p) =>
                p.modelValue === modelValue ? { ...p, ...patch } : p,
              )
              return { ...m, modelPages: pages }
            }),
          )
        }

        // Phase 1: 只要第一条（自然直译）——更快
        const phase1Prompt =
          base +
          `【阶段1】只输出 JSON，且 data 数组只包含 1 个对象（自然直译）。不要输出多余文字。`

        const doModelPhase1 = async (modelValue) => {
          const t1 = await translatePhase({
            apiUrl: apiConfig.url,
            apiKey: apiConfig.key,
            model: modelValue,
            systemPrompt: TRANSLATION_PROMPT.content,
            userPrompt: phase1Prompt,
            signal: controller.signal,
          })
          // 只保留第一条
          const first = t1?.[0] ? [t1[0]] : []
          updatePage(modelValue, { translations: first })

          // auto TTS: 只对主模型读第一条
          if (settings.autoReadFirstTranslation && modelValue === selectedModel && first[0]?.translation) {
            preloadTTS(first[0].translation, ttsVoice)
            playCachedTTS(first[0].translation, ttsVoice)
          }
        }

        // Phase 2: 补齐剩余 3 条
        const phase2Prompt =
          base +
          `【阶段2】只输出 JSON，且 data 数组只包含 3 个对象，分别对应：自然意译、口语化、保留原文结构（不要再输出自然直译）。不要输出多余文字。`

        const doModelPhase2 = async (modelValue) => {
          const t2 = await translatePhase({
            apiUrl: apiConfig.url,
            apiKey: apiConfig.key,
            model: modelValue,
            systemPrompt: TRANSLATION_PROMPT.content,
            userPrompt: phase2Prompt,
            signal: controller.signal,
          })

          updatePage(modelValue, (prevPage) => prevPage)

          // 合并：把现有第一条 + 这三条凑成 4 条
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== msgId) return m
              const pages = (m.modelPages || []).map((p) => {
                if (p.modelValue !== modelValue) return p
                const first = Array.isArray(p.translations) && p.translations[0] ? [p.translations[0]] : []
                const merged = [...first, ...(Array.isArray(t2) ? t2.slice(0, 3) : [])]
                return { ...p, translations: merged }
              })
              return { ...m, modelPages: pages }
            }),
          )

          // 预加载 TTS（该模型四条）
          setTimeout(() => {
            // 从 state 取不方便，这里直接按返回合并后的文本预加载 t2
            ;(Array.isArray(t2) ? t2 : []).forEach((x) => preloadTTS(x.translation, ttsVoice))
          }, 0)
        }

        // 执行：phase1 并发，phase2 也并发（但 phase2 等 phase1 完成后开始更稳）
        const phase1Tasks = [doModelPhase1(selectedModel)]
        if (useSecond) phase1Tasks.push(doModelPhase1(secondModel))
        await Promise.all(phase1Tasks)

        const phase2Tasks = [doModelPhase2(selectedModel)]
        if (useSecond) phase2Tasks.push(doModelPhase2(secondModel))
        await Promise.all(phase2Tasks)
      } catch (err) {
        if (err?.name === 'AbortError') return
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
    [settings, getLangName, sourceLang, targetLang, getModelName],
  )

  // wire ref for submitText
  useEffect(() => {
    fetchRef.current = fetchAiResponse
  }, [fetchAiResponse])

  // redefine submitText with fetchRef (stable)
  const submitTextStable = useCallback((text) => {
    const t = (text || '').trim()
    if (!t) {
      setError('请输入要翻译的内容！')
      return
    }
    const userMessage = { role: 'user', content: t, timestamp: Date.now() }
    setMessages([userMessage])
    setUserInput('')
    fetchRef.current?.(t)
  }, [])

  function handleSubmit(isRegenerate = false, textToSend = null) {
    const text = (textToSend ?? userInput).trim()
    if (!text) {
      setError('请输入要翻译的内容！')
      return
    }
    submitTextStable(text)
  }

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入。')
      return
    }

    try {
      recognitionRef.current?.abort()
    } catch {}

    setError('')
    lastFinalRef.current = ''

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
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0]?.transcript || ''
        if (event.results[i].isFinal) finalText += t
        else interimText += t
      }

      const combined = (finalText + interimText).trim()
      setUserInput(combined)

      // ✅ 关键：只在出现 final 时启动“静默提交”
      if (finalText.trim()) {
        lastFinalRef.current = (lastFinalRef.current + ' ' + finalText).trim()

        clearTimeout(finalSilenceTimerRef.current)
        finalSilenceTimerRef.current = setTimeout(() => {
          const toSend = (latestUserInputRef.current || '').trim()
          if (!toSend) return
          stopListening()
          submitTextStable(toSend)
        }, 850)
      }
    }

    recognition.onerror = (event) => {
      setError(`语音识别失败: ${event.error}`)
    }

    recognition.onend = () => {
      setIsListening(false)
      clearTimeout(finalSilenceTimerRef.current)
      recognitionRef.current = null
    }

    recognition.start()
  }, [speechLang, stopListening, submitTextStable])

  const handleMicPress = () => {
    pressTimerRef.current = setTimeout(() => {
      stopListening()
      setShowLanguageSelector(true)
    }, 500)
  }
  const handleMicRelease = () => {
    clearTimeout(pressTimerRef.current)
  }

  if (!isMounted) return null

  const handleMainButtonClick = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (showSendButton) handleSubmit(false)
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
            <div key={msg.id || msg.timestamp}>
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
                title="交换语言"
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

              {/* ✅ 模型按钮改图标（打开设置即可改两个模型，这里只保留图标入口） */}
              <button
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-black/10 dark:border-white/10 hover:bg-white/80 dark:hover:bg-gray-600/80"
                title="模型/设置"
              >
                <i className="fas fa-sliders-h text-gray-800 dark:text-gray-200" />
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
                title="设置"
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
                    handleSubmit(false)
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
                title={showSendButton ? '发送' : isListening ? '停止录音' : '语音输入'}
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
          onSave={(newSettings) => {
            // ✅ 固定官方 URL（防止被改坏）
            const fixed = {
              ...newSettings,
              apiConfig: { ...newSettings.apiConfig, url: 'https://api.openai.com/v1' },
            }
            setSettings(fixed)
            setShowSettings(false)
          }}
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
