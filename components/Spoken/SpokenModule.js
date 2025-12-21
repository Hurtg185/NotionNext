// SpokenModule.jsx  【完整版 · 直接用】
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronDown, Mic, StopCircle, Sparkles, Heart, Lock,
  Settings2, X, Play, Square
} from 'lucide-react'
import { pinyin } from 'pinyin-pro'
import dailyData from '@/data/spoken/daily10k'

// ======================
// AudioEngine v2（统一）
// ======================
const AudioEngine = {
  audio: null,
  stop() {
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
  },
  playUrl(url) {
    return new Promise(resolve => {
      this.stop()
      const a = new Audio(url)
      this.audio = a
      a.onended = a.onerror = () => {
        this.audio = null
        resolve()
      }
      a.play().catch(resolve)
    })
  },
  playTTS({ text, voice, rate }) {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(
      text
    )}&v=${voice}&r=${rate}`
    return this.playUrl(url)
  }
}

// ======================
// SpeechEngine（修复版）
// ======================
const SpeechEngine = {
  r: null,
  start({ onResult, onEnd }) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    let hasResult = false
    const r = new SR()
    r.lang = 'zh-CN'
    r.onresult = e => {
      hasResult = true
      onResult(e.results[0][0].transcript)
    }
    r.onend = () => onEnd(hasResult)
    r.onerror = () => onEnd(false)
    this.r = r
    r.start()
  },
  stop() {
    this.r?.stop()
    this.r = null
  }
}

// ======================
// Utils
// ======================
const diffText = (target, input = '') =>
  target.split('').map((c, i) => (
    <span
      key={i}
      className={
        input[i] === c
          ? 'text-slate-800 font-bold'
          : 'text-red-500 font-black'
      }
    >
      {c}
    </span>
  ))

// ======================
// 拼读 Modal（完整版）
// ======================
const SpellingModal = ({ item, settings, onClose }) => {
  const [idx, setIdx] = useState(-1)
  const [recording, setRecording] = useState(false)
  const [userAudio, setUserAudio] = useState(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    let alive = true
    const run = async () => {
      const chars = item.chinese.split('')
      for (let i = 0; i < chars.length; i++) {
        if (!alive) return
        setIdx(i)
        const py = pinyin(chars[i], { toneType: 'symbol' })
        await AudioEngine.playUrl(
          `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`
        )
      }
      setIdx('all')
      await AudioEngine.playTTS({
        text: item.chinese,
        voice: settings.zhVoice,
        rate: settings.zhRate
      })
      setIdx(-1)
    }
    run()
    return () => {
      alive = false
      AudioEngine.stop()
    }
  }, [item, settings])

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current.stop()
      setRecording(false)
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream)
    chunksRef.current = []
    rec.ondataavailable = e => chunksRef.current.push(e.data)
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setUserAudio(URL.createObjectURL(blob))
      stream.getTracks().forEach(t => t.stop())
    }
    recorderRef.current = rec
    rec.start()
    setRecording(true)
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ scale: .9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] p-6 w-[360px] relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4">
          <X />
        </button>

        <div className="flex flex-wrap justify-center gap-4 my-8">
          {item.chinese.split('').map((c, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-slate-400">
                {pinyin(c, { toneType: 'symbol' })}
              </div>
              <div
                className={`text-5xl font-black transition ${
                  idx === i || idx === 'all'
                    ? 'text-slate-800 scale-125'
                    : 'text-slate-300'
                }`}
              >
                {c}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-around items-center">
          <button
            onClick={toggleRecord}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              recording ? 'bg-red-500' : 'bg-blue-600'
            } text-white`}
          >
            {recording ? <Square /> : <Mic />}
          </button>

          <button
            disabled={!userAudio}
            onClick={() => new Audio(userAudio).play()}
            className="w-12 h-12 rounded-full bg-green-500 text-white disabled:opacity-30"
          >
            <Play />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ======================
// 主组件（完整版）
// ======================
export default function SpokenModule() {
  const [view, setView] = useState('catalog')
  const [cat, setCat] = useState(null)
  const [sub, setSub] = useState(null)

  const [playing, setPlaying] = useState(null)
  const [recording, setRecording] = useState(null)
  const [speech, setSpeech] = useState(null)
  const [spell, setSpell] = useState(null)
  const [favorites, setFavorites] = useState(
    () => JSON.parse(localStorage.getItem('spoken:v1:favs')) || []
  )

  const settings = {
    zhEnabled: true,
    zhVoice: 'zh-CN-YunxiaNeural',
    zhRate: -30,
    myEnabled: true,
    myVoice: 'my-MM-ThihaNeural',
    myRate: 0
  }

  useEffect(() => {
    localStorage.setItem('spoken:v1:favs', JSON.stringify(favorites))
  }, [favorites])

  const catalog = useMemo(() => {
    const m = {}
    dailyData.forEach(p => {
      m[p.category] ??= new Set()
      m[p.category].add(p.sub)
    })
    return Object.entries(m).map(([k, v]) => ({ name: k, subs: [...v] }))
  }, [])

  const list = useMemo(
    () => dailyData.filter(p => p.sub === sub),
    [sub]
  )

  const play = async item => {
    if (playing === item.id) {
      AudioEngine.stop()
      setPlaying(null)
      return
    }
    setPlaying(item.id)
    if (settings.zhEnabled)
      await AudioEngine.playTTS({ text: item.chinese, voice: settings.zhVoice, rate: settings.zhRate })
    if (settings.myEnabled)
      await AudioEngine.playTTS({ text: item.burmese, voice: settings.myVoice, rate: settings.myRate })
    setPlaying(null)
  }

  const speak = item => {
    if (recording === item.id) {
      SpeechEngine.stop()
      setRecording(null)
      return
    }
    setRecording(item.id)
    setSpeech(null)
    SpeechEngine.start({
      onResult: text => setSpeech({ id: item.id, text }),
      onEnd: () => setRecording(null)
    })
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F8F9FB]">
      {view === 'catalog' && (
        <div className="p-4 space-y-4">
          {catalog.map((c, i) => (
            <CatalogGroup
              key={i}
              cat={c}
              idx={i}
              onSelect={(cat, sub) => {
                setCat(cat)
                setSub(sub)
                setView('list')
              }}
            />
          ))}
        </div>
      )}

      {view === 'list' && (
        <div className="p-4 space-y-4">
          <button onClick={() => setView('catalog')} className="flex items-center gap-2">
            <ChevronLeft /> 返回
          </button>

          {list.map(item => (
            <div key={item.id} className="bg-white rounded-[2rem] p-6 shadow">
              <div className="text-xs text-slate-400 mb-1">
                {pinyin(item.chinese, { toneType: 'symbol' })}
              </div>
              <div className="text-2xl font-black mb-2">{item.chinese}</div>
              <div className="text-blue-600 mb-4">{item.burmese}</div>

              <div className="flex justify-between items-center">
                <button onClick={() => setSpell(item)}><Sparkles /></button>
                <button onClick={() => play(item)}>
                  {playing === item.id ? '■' : '▶'}
                </button>
                <button onClick={() => speak(item)}>
                  {recording === item.id ? <StopCircle /> : <Mic />}
                </button>
                <button
                  onClick={() =>
                    setFavorites(f =>
                      f.includes(item.id)
                        ? f.filter(i => i !== item.id)
                        : [...f, item.id]
                    )
                  }
                >
                  <Heart
                    fill={favorites.includes(item.id) ? 'currentColor' : 'none'}
                  />
                </button>
              </div>

              {speech?.id === item.id && (
                <div className="mt-3 text-center">
                  {diffText(item.chinese, speech.text)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {spell && (
        <SpellingModal
          item={spell}
          settings={settings}
          onClose={() => setSpell(null)}
        />
      )}
    </div>
  )
}

// ======================
// CatalogGroup
// ======================
const CatalogGroup = ({ cat, idx, onSelect }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="p-4 flex justify-between items-center"
      >
        <div className="font-bold">{idx + 1}. {cat.name}</div>
        <ChevronDown className={`transition ${open ? 'rotate-180' : ''}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="p-3 grid grid-cols-2 gap-2"
          >
            {cat.subs.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(cat.name, s)}
                className="bg-slate-100 rounded-xl p-3 text-sm font-bold"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
