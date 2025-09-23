// components/PinyinPracticeCard.js (V4 - 终极修重版)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量与图标 ---
const DRAG_BUFFER = 80;
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const StopIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>;

// --- [重构] 拼音对比核心逻辑 ---
const PinyinComparer = ({ standardWord, userPinyin, isVisible }) => {
  const standardSyllables = pinyin(standardWord, { type: 'array', toneType: 'none' });
  // [修复] 只有在有用户输入时才进行对比
  const userSyllables = userPinyin ? pinyin(userPinyin, { type: 'array', toneType: 'none' }) : [];

  const splitSyllable = (syllable) => {
    const pinyinResult = pinyin(syllable, { segment: 'beta', type: 'array' });
    if (!pinyinResult || pinyinResult.length === 0) return ['', ''];
    return pinyinResult.length > 1 ? [pinyinResult[0], pinyinResult.slice(1).join('')] : ['', pinyinResult[0]];
  };

  return (
    <motion.div 
      className="pinyin-comparison-inline"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 10 }}
      transition={{ duration: 0.3 }}
    >
      <p className="user-transcript">“{userPinyin || '...'}”</p>
      <div className="syllable-track">
      {standardSyllables.map((stdSyllable, i) => {
        const userSyllable = userSyllables[i] || '';
        const [stdInitial, stdFinal] = splitSyllable(stdSyllable);
        const [userInitial, userFinal] = splitSyllable(userSyllable);
        return (
          <span key={i} className="syllable-inline">
            <span className={stdInitial !== userInitial ? 'error' : 'correct'}>{stdInitial}</span>
            <span className={stdFinal !== userFinal ? 'error' : 'correct'}>{stdFinal}</span>
          </span>
        );
      })}
      </div>
    </motion.div>
  );
};

// --- 主组件 ---
export default function PinyinPracticeCard({ flashcards, backgroundImages = [] }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userPinyin, setUserPinyin] = useState('');
  
  const recognitionRef = useRef(null);
  const rotateY = useMotionValue(0);
  const containerRef = useRef(null);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  // [核心修复] 永久隐藏页面元素 + 禁止滚动
  useEffect(() => {
    document.documentElement.classList.add('flashcard-mode-active');
    return () => {
      document.documentElement.classList.remove('flashcard-mode-active');
    };
  }, []);

  const handleSwipe = (direction) => {
    setIsFlipped(false);
    setUserPinyin('');
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
  };
  
  // [核心修复] 重构手势逻辑，确保切换
  useEffect(() => {
      animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 });
  }, [index, rotateY]);
  
  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, event, initial, last }) => {
    if (event.target.closest('button')) return;
    if (down) {
      rotateY.set(memo + mx);
    } else {
      // 只有在拖拽结束时才判断切换，避免多次触发
      if (last) { 
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) {
          handleSwipe(mx > initial[0] ? -1 : 1);
        } else {
          animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 });
        }
      }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });
  
  const playTTS = (text) => new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural&r=-20`).play();

  // [核心修复] 彻底重构语音识别
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
    recognition.onstart = () => { setIsListening(true); setUserPinyin(''); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.onerror = (e) => { console.error('语音识别错误:', e); setIsListening(false); };
    recognition.onresult = (event) => {
      // [修复] 直接使用语音识别结果转拼音，而不是用标准答案的拼音
      const transcript = event.results[0][0].transcript.replace(/[^\u4e00-\u9fa5]/g, '');
      const pinyinResult = pinyin(transcript, { toneType: 'none' }).replace(/\s/g, '');
      setUserPinyin(pinyinResult || transcript); // 如果转不了拼音，显示原始识别结果
    };
    recognition.start();
  };

  const getCardBackgroundImage = (cardIndex) => { /* ... */ };
  
  return (
    <div ref={containerRef} className="immersive-container-full">
      <div className="scene-container-full" {...bind()}>
        <motion.div className="cube-full" style={{ rotateY }}>
          {flashcards.map((card, i) => {
            const cardWidth = containerRef.current?.offsetWidth * 0.9 || 340;
            return (
              <div key={card.word + i} className="cube-face-full" style={{ width: `${cardWidth}px`, transform: `rotateY(${i * 90}deg) translateZ(${cardWidth / 2}px)`, backgroundImage: getCardBackgroundImage(i) }}>
                <div className="immersive-card-overlay" />
                <motion.div className="immersive-card-content" animate={{ rotateY: (i === index && isFlipped) ? 180 : 0 }}>
                  <div className="immersive-card-face front" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(true); }}>
                    <div className="main-content">
                      <p className="immersive-pinyin">{pinyin(card.word)}</p>
                      <p className="immersive-word">{card.word}</p>
                    </div>
                    {/* [重构] 识别结果内置在正面 */}
                    <PinyinComparer standardWord={card.word} userPinyin={userPinyin} isVisible={!!userPinyin && !isFlipped && i === index} />
                  </div>
                  <div className="immersive-card-face back" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(false); }}>
                    <p className="immersive-meaning">{card.meaning}</p>
                  </div>
                </motion.div>
                 <div className="immersive-card-controls">
                    <button onClick={(e) => { e.stopPropagation(); playTTS(card.word); }}><SpeakerIcon /></button>
                    <button className={isListening ? 'listening' : ''} onClick={(e) => { e.stopPropagation(); handleMicClick(); }}>
                        {isListening ? <StopIcon /> : <MicIcon />}
                    </button>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
      }
