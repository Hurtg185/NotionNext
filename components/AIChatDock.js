import React, { useState, useRef, useEffect } from 'react'

/* =========================
   TTS（按你给的版本整合）
========================= */

const ttsVoices = {
  zh: 'zh-CN-XiaoyouNeural',
  my: 'my-MM-NilarNeural'
}

async function fetchToBlobUrl(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

function playUrl(url, { onEnd } = {}) {
  const audio = new Audio(url)
  audio.onended = onEnd || null
  audio.play()
  return audio
}

async function playTTS(t, l = 'zh', r = 0, cb = null) {
  if (!t) { cb && cb(); return }
  const v = ttsVoices[l] || ttsVoices.zh
  const u = await fetchToBlobUrl(
    `https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${v}&r=${r}`
  )
  return playUrl(u, { onEnd: cb })
}

/* =========================
   主组件
========================= */

export default function AIChatDock() {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const historyRef = useRef(null)

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [messages, loading])

  async function askAI(allMessages) {
    const systemPrompt =
      '你是一位汉缅翻译老师，正在辅导学生学习刚才这段汉语语法，请用通俗、口语化的中文解释，必要时对比缅甸语思维方式。'

    const res = await fetch(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({
          model: 'deepseek-ai/deepseek-v3.2',
          messages: [
            { role: 'system', content: systemPrompt },
            ...allMessages
          ]
        })
      }
    )

    const data = await res.json()
    return data?.choices?.[0]?.message?.content || '我刚才没想好，再问一次试试 🙂'
  }

  async function send() {
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const reply = await askAI([...messages, userMsg])
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      playTTS(reply, 'zh')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {expanded && <div className="chat-overlay" onClick={() => setExpanded(false)} />}

      <div className={`chat-box ${expanded ? 'expanded' : ''}`}>
        {expanded && (
          <div className="chat-header">
            <span>AI 汉语老师</span>
            <button onClick={() => setExpanded(false)}>⬇</button>
          </div>
        )}

        {expanded && (
          <div className="chat-history" ref={historyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="msg assistant">正在思考…</div>}
          </div>
        )}

        <div className="chat-input">
          <input
            value={input}
            onFocus={() => setExpanded(true)}
            onChange={e => setInput(e.target.value)}
            placeholder="问一句刚才的语法…"
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={send}>发送</button>
        </div>
      </div>

      {/* 样式直接内嵌，单文件可用 */}
      <style jsx>{`
        .chat-box {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 60px;
          background: #fff;
          border-top: 1px solid #ddd;
          transition: height .35s ease;
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }

        .chat-box.expanded {
          height: 75vh;
        }

        .chat-header {
          height: 44px;
          padding: 0 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #eee;
          font-size: 14px;
          background: #fafafa;
        }

        .chat-history {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background: #f9f9f9;
        }

        .msg {
          margin-bottom: 8px;
          line-height: 1.5;
          font-size: 14px;
        }

        .msg.user {
          text-align: right;
          color: #333;
        }

        .msg.assistant {
          text-align: left;
          color: #0a58ca;
        }

        .chat-input {
          display: flex;
          padding: 8px;
          border-top: 1px solid #eee;
          background: #fff;
        }

        .chat-input input {
          flex: 1;
          padding: 8px;
          font-size: 14px;
        }

        .chat-input button {
          margin-left: 8px;
        }

        .chat-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.25);
          z-index: 999;
        }
      `}</style>
    </>
  )
                          }
