"use client";
import React, { useState, useEffect, useRef } from "react";
import { pinyin } from "pinyin-pro";

// 简单封装 TTS 播放
async function fetchTTS(text) {
  const api = "https://t.leftsite.cn";
  const voice = "zh-CN-XiaochenMultilingualNeural";
  const url = `${api}/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("TTS 请求失败");
  const blob = await res.blob();
  const audio = new Audio(URL.createObjectURL(blob));
  audio.play();
}

export default function PinyinPracticeCard({ word, meaning, example }) {
  const [flipped, setFlipped] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [highlighted, setHighlighted] = useState("");

  const recognitionRef = useRef(null);

  const targetPinyin = pinyin(word, { toneType: "none", type: "array" });

  // 初始化语音识别
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "zh-CN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (e) => {
        const text = e.results[0][0].transcript.trim();
        setRecognizedText(text);

        const spoken = pinyin(text, { toneType: "none", type: "array" });
        const result = targetPinyin
          .map((syllable, i) => {
            if (spoken[i] && spoken[i] !== syllable) {
              return `<span style="color:red">${spoken[i]}</span>`;
            }
            return spoken[i] || "";
          })
          .join(" ");
        setHighlighted(result);
      };

      recognition.onend = () => setRecognizing(false);
      recognitionRef.current = recognition;
    }
  }, [word]);

  const startRecognition = () => {
    if (recognitionRef.current && !recognizing) {
      setRecognizing(true);
      recognitionRef.current.start();
    }
  };

  return (
    <div className="study-cube-container">
      <div className="study-cube-title">单词练习</div>
      <div className="study-cube-scene" onClick={() => setFlipped(!flipped)}>
        <div
          className="study-cube"
          style={{
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
            transition: "transform 0.8s cubic-bezier(0.25,1,0.5,1)",
          }}
        >
          {/* 正面 */}
          <div className="study-cube-cardface front">
            <div className="study-cube-pinyin">{pinyin(word)}</div>
            <div className="study-cube-word">{word}</div>
            <div className="study-cube-overlay" />
          </div>
          {/* 背面 */}
          <div className="study-cube-cardface back">
            <div className="study-cube-meaning">{meaning}</div>
            <div className="study-cube-example">例句：{example}</div>
            <div className="study-cube-overlay" />
          </div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="study-cube-controls">
        <button onClick={() => fetchTTS(word)} title="发音">
          🔊
        </button>
        <button onClick={startRecognition} disabled={recognizing} title="跟读">
          🎤
        </button>
      </div>

      {/* 识别结果 */}
      {recognizedText && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <div>你说的是：{recognizedText}</div>
          <div
            dangerouslySetInnerHTML={{ __html: highlighted }}
            style={{ fontSize: "1.2rem", marginTop: "0.5rem" }}
          />
        </div>
      )}
    </div>
  );
}
