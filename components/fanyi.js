import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Volume2, Copy, Star } from 'lucide-react';

const AITranslator = () => {
  const [input, setInput] = useState('');
  const [targetLang, setTargetLang] = useState('my');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.onresult = e => setInput(e.results[0][0].transcript);
    recognitionRef.current = rec;
  }, []);

  const send = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResults([]);

    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, targetLang })
    });

    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  };

  const speak = (text, lang) => {
    const voice =
      lang === 'zh' ? 'zh-CN-XiaoxiaoNeural' :
      lang === 'my' ? 'my-MM-NilarNeural' :
      'en-US-JennyNeural';

    new Audio(
      `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`
    ).play();
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        className="w-full border rounded p-3"
      />
      <button onClick={send} className="bg-cyan-500 text-white px-4 py-2 rounded">
        <Send />
      </button>

      {loading && <p>翻译中…</p>}

      {results.map((r, i) => (
        <div key={i} className="border rounded p-3 space-y-2">
          <div className="flex justify-between">
            <b>{r.label} <Star size={14} /></b>
            <div className="flex gap-2">
              <Volume2 onClick={() => speak(r.translation, targetLang)} />
              <Copy onClick={() => navigator.clipboard.writeText(r.translation)} />
            </div>
          </div>

          <p>{r.translation}</p>

          <details>
            <summary>回译</summary>
            {r.back_translation}
          </details>
        </div>
      ))}
    </div>
  );
};

export default AITranslator;
