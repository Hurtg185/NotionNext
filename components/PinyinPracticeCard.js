// components/PinyinPracticeCard.js (V5 - 精细化拼音声调对比版)

"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// ... (常量与图标保持不变) ...
const CUBE_SIZE = 340;
const DRAG_BUFFER = 60;
const SpeakerIcon = () => {/*...*/};
const MicIcon = () => {/*...*/};

// --- [核心升级] 拼音对比逻辑 ---
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

// --- 主组件 ---
export default function PinyinPracticeCard({ questionTitle, flashcards, backgroundImages }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userInfo, setUserInfo] = useState([]); // [核心] 存储用户发音的详细信息

  const recognitionRef = useRef(null);
  const rotateY = useMotionValue(0);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  // [核心] 预先计算标准答案的拼音信息
  const standardInfo = useMemo(() => 
    pinyin(currentCard.word, { segment: 'beta', toneType: 'num' })
      .map(item => ({...item, initial: item.initial || ''}))
  , [currentCard]);

  // ... (手势切换逻辑 handleSwipe, useEffect, bind 保持不变) ...
  
  // --- 语音功能 ---
  const playTTS = (text) => {/*...*/};

  // [核心升级] 语音识别逻辑
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
    recognition.onstart = () => { setIsListening(true); setUserInfo([]); }; // 清空旧结果
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => { console.error(e); setIsListening(false); };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.replace(/[^\u4e00-\u9fa5]/g, '');
      // 将识别结果也转换为详细的拼音信息
      const pinyinResult = pinyin(transcript, { segment: 'beta', toneType: 'num' })
        .map(item => ({...item, initial: item.initial || ''}));
      setUserInfo(pinyinResult);
    };
    recognition.start();
  };
  
  if (!flashcards || flashcards.length === 0) { /*...*/ }

  return (
    <div className="study-cube-container">
      {/* ... (标题和场景部分保持不变) ... */}
      
      <div className="study-cube-scene" {...bind()}>
        <motion.div className="study-cube" style={{ rotateY }}>
          {flashcards.map((card, i) => (
            <div key={card.word + i} /*...*/ >
              <div className="study-cube-flipper" onClick={() => i === index && setIsFlipped(f => !f)}>
                {/* 正面 */}
                <motion.div className="study-cube-cardface front" /*...*/ >
                  <div className="study-cube-overlay" />
                  <p className="study-cube-pinyin">{pinyin(card.word)}</p>
                  <p className="study-cube-word">{card.word}</p>
                  {/* [核心] 将拼音对比结果放在正面底部 */}
                  <PinyinComparer 
                    standardInfo={standardInfo} 
                    userInfo={userInfo}
                    isVisible={userInfo.length > 0 && i === index && !isFlipped}
                  />
                </motion.div>
                {/* 背面 */}
                <motion.div className="study-cube-cardface back" /*...*/ >
                    {/* ... */}
                </motion.div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="study-cube-controls">
        {/* ... (控制按钮保持不变) ... */}
      </div>
    </div>
  );
}
