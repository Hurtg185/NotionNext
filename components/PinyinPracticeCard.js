// components/PinyinPracticeCard.js (V6 - 最终稳定版)

"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量与图标 ---
const CUBE_SIZE = 340;
const DRAG_BUFFER = 60;
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const StopIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>;

// --- 异步 TTS 播放 ---
async function fetchTTS(text) {
  const params = new URLSearchParams({ t: text.trim(), v: 'zh-CN-XiaochenMultilingualNeural', r: '-20%' });
  const url = `https://t.leftsite.cn/tts?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TTS 请求失败: ${res.status}`);
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onended = () => URL.revokeObjectURL(audio.src);
    audio.play();
  } catch (error) {
    console.error(error);
  }
}

// --- 精细化拼音对比 (子组件) ---
const PinyinComparer = ({ standardInfo, userInfo, isVisible }) => {
  if (!isVisible) return null;
  return (
    <motion.div 
      className="pinyin-comparison-inline"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="syllable-track">
      {standardInfo.map((std, i) => {
        const user = userInfo[i] || { initial: '', final: '', tone: 0 };
        return (
          <span key={i} className="syllable-inline-pro">
            <span className={std.initial !== user.initial ? 'error' : 'correct'}>{std.initial}</span>
            <span className={std.final !== user.final ? 'error' : 'correct'}>{std.final}</span>
            <span className={`tone tone-${std.tone} ${std.tone !== user.tone ? 'error' : 'correct'}`}>{std.tone}</span>
          </span>
        );
      })}
      </div>
    </motion.div>
  );
};


// --- 卡片的面 (子组件) ---
const CardFace = ({ card, isVisible, isFlipped, onFlip }) => {
  if (!card) return null;
  const frontStyle = {
    backgroundImage: `url(${card.image || '/images/flashcard-bg-1.jpg'})`,
    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
  };
  const backStyle = { transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)' };

  return (
    <div className="study-cube-flipper" onClick={onFlip}>
      <motion.div className="study-cube-cardface front" style={frontStyle}>
        <div className="study-cube-overlay" />
        <p className="study-cube-pinyin">{pinyin(card.word)}</p>
        <p className="study-cube-word">{card.word}</p>
      </motion.div>
      <motion.div className="study-cube-cardface back" style={backStyle}>
        <p className="study-cube-meaning">{card.meaning}</p>
        {card.example && <p className="study-cube-example">{card.example}</p>}
      </motion.div>
    </div>
  );
};


// --- 主组件 ---
export default function PinyinPracticeCard({ questionTitle, flashcards, backgroundImages }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userInfo, setUserInfo] = useState([]);
  
  const recognitionRef = useRef(null);
  const rotateY = useMotionValue(0);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);
  const standardInfo = useMemo(() => 
    pinyin(currentCard.word, { segment: 'beta', toneType: 'num' })
      .map(item => ({...item, initial: item.initial || ''}))
  , [currentCard]);

  const handleSwipe = (direction) => {
    setIsFlipped(false);
    setUserInfo([]);
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
  };

  useEffect(() => {
    animate(rotateY, -index * 90, { type: 'spring', stiffness: 250, damping: 30 });
  }, [index, rotateY]);

  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, last, event }) => {
    if (event.target.closest('button')) return;
    if (down) { rotateY.set(memo + mx); } 
    else {
      if (last) {
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) { handleSwipe(mx > 0 ? -1 : 1); } 
        else { animate(rotateY, -index * 90, { type: 'spring', stiffness: 250, damping: 30 }); }
      }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.lang = 'zh-CN';
    recognition.onstart = () => { setIsListening(true); setUserInfo([]); };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => { console.error(e); setIsListening(false); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.replace(/[^\u4e00-\u9fa5]/g, '');
      const pinyinResult = pinyin(transcript, { segment: 'beta', toneType: 'num' })
        .map(item => ({...item, initial: item.initial || ''}));
      setUserInfo(pinyinResult);
    };
    recognition.start();
  };

  if (!flashcards || flashcards.length === 0) {
    return <div className="study-cube-container">没有卡片数据。</div>;
  }

  return (
    <div className="study-cube-container">
      {questionTitle && <h2 className="study-cube-title">{questionTitle}</h2>}
      
      <div className="study-cube-scene" {...bind()}>
        <motion.div className="study-cube" style={{ rotateY }}>
          {flashcards.map((card, i) => {
            const image = backgroundImages?.[i % backgroundImages.length] || card.image;
            return (
              <div
                key={card.word + i}
                className="study-cube-face-wrapper"
                style={{ transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)` }}
              >
                <div className="study-cube-flipper" onClick={() => i === index && setIsFlipped(f => !f)}>
                  <motion.div className="study-cube-cardface front" style={{ backgroundImage: `url(${image || '/images/flashcard-bg-1.jpg'})`, transform: (i === index && isFlipped) ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                    <div className="study-cube-overlay" />
                    <p className="study-cube-pinyin">{pinyin(card.word)}</p>
                    <p className="study-cube-word">{card.word}</p>
                    <PinyinComparer 
                      standardInfo={standardInfo} 
                      userInfo={userInfo}
                      isVisible={userInfo.length > 0 && i === index && !isFlipped}
                    />
                  </motion.div>
                  <motion.div className="study-cube-cardface back" style={{transform: (i === index && isFlipped) ? 'rotateY(0deg)' : 'rotateY(-180deg)'}}>
                    <p className="study-cube-meaning">{card.meaning}</p>
                    {card.example && <p className="study-cube-example">{card.example}</p>}
                  </motion.div>
                </div>
              </div>
            )
          })}
        </motion.div>
      </div>

      <div className="study-cube-controls">
        <button onClick={(e) => { e.stopPropagation(); fetchTTS(currentCard.word); }} title="朗读">
          <SpeakerIcon />
        </button>
        <span className="study-cube-counter">{index + 1} / {flashcards.length}</span>
        <button onClick={(e) => { e.stopPropagation(); handleMicClick(); }} disabled={isListening} title="语音识别">
          {isListening ? <StopIcon /> : <MicIcon />}
        </button>
      </div>
    </div>
  );
      }
