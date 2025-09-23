// components/PinyinPracticeCard.js (V4.2 - 完整代码，最终修复 Hydration 错误)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量与图标 ---
const DRAG_BUFFER = 80;
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const StopIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>;

// --- 拼音对比核心逻辑 ---
const PinyinComparer = ({ standardWord, userPinyin, isVisible }) => {
  const standardSyllables = pinyin(standardWord, { type: 'array', toneType: 'none' });
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
  
  // [核心修复] 使用 state 来存储只在客户端计算的宽度, 默认值与 CSS 备用值一致
  const [cardWidth, setCardWidth] = useState(340); 

  const recognitionRef = useRef(null);
  const rotateY = useMotionValue(0);
  const containerRef = useRef(null);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  // [核心修复] 将所有依赖 window/document 的代码都放入 useEffect
  useEffect(() => {
    document.documentElement.classList.add('flashcard-mode-active');
    
    // 动态计算卡片宽度
    if (containerRef.current) {
      setCardWidth(containerRef.current.offsetWidth * 0.9);
    }
    
    return () => {
      document.documentElement.classList.remove('flashcard-mode-active');
    };
  }, []); // 空依赖数组确保只在客户端首次挂载时运行

  const handleSwipe = (direction) => {
    setIsFlipped(false);
    setUserPinyin('');
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
  };
  
  useEffect(() => {
      animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 });
  }, [index, rotateY]);
  
  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, event, last }) => {
    if (event.target.closest('button')) return;
    if (down) {
      rotateY.set(memo + mx);
    } else {
      if (last) { 
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) {
          handleSwipe(mx > rotateY.get() ? -1 : 1);
        } else {
          animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 });
        }
      }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });
  
  const playTTS = (text) => {
    const params = new URLSearchParams({ t: text.trim(), v: 'zh-CN-XiaochenMultilingualNeural', r: '-20%' });
    new Audio(`https://t.leftsite.cn/tts?${params.toString()}`).play();
  }

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
      const transcript = event.results[0][0].transcript.replace(/[^\u4e00-\u9fa5]/g, '');
      const pinyinResult = pinyin(transcript, { toneType: 'none' }).replace(/\s/g, '');
      setUserPinyin(pinyinResult || transcript);
    };
    recognition.start();
  };

  const getCardBackgroundImage = (cardIndex) => {
    if (backgroundImages && backgroundImages.length > 0) {
      return `url(${backgroundImages[cardIndex % backgroundImages.length]})`;
    }
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };
  
  if (!flashcards || flashcards.length === 0) {
    return <div className="immersive-container-full"><p>没有加载到单词数据。</p></div>;
  }

  return (
    <div ref={containerRef} className="immersive-container-full">
      <div className="scene-container-full" {...bind()}>
        <motion.div className="cube-full" style={{ rotateY }}>
          {flashcards.map((card, i) => (
            <div
              key={card.word + i}
              className="cube-face-full"
              style={{ 
                width: `${cardWidth}px`,
                transform: `rotateY(${i * 90}deg) translateZ(${cardWidth / 2}px)`,
                backgroundImage: getCardBackgroundImage(i)
              }}
            >
              <div className="immersive-card-overlay" />
              <motion.div 
                className="immersive-card-content"
                animate={{ rotateY: (i === index && isFlipped) ? 180 : 0 }}
              >
                <div className="immersive-card-face front" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(true); }}>
                  <div className="main-content">
                    <p className="immersive-pinyin">{pinyin(card.word)}</p>
                    <p className="immersive-word">{card.word}</p>
                  </div>
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
          ))}
        </motion.div>
      </div>
    </div>
  );
}
