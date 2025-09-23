// components/PinyinPracticeCard.js (V1.1 - 支持 Notion JSON 配置)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量配置 ---
const CARD_WIDTH = 340;
const DRAG_BUFFER = 60;

// --- 图标 ---
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => {
  const baseClass = "w-8 h-8 transition-colors duration-200";
  const colorClass = isListening ? "text-red-500" : "text-gray-600";
  return (
    <div className={`relative w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-md ${isListening ? 'animate-pulse-mic' : ''}`}>
      <svg className={`${baseClass} ${colorClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
    </div>
  );
};

// --- 拼音对比核心逻辑 ---
const PinyinComparer = ({ standardPinyin, userPinyin }) => {
  if (!userPinyin) {
    return <p className="pinyin-display standard">{pinyin(standardPinyin)}</p>;
  }
  const standardSyllables = pinyin(standardPinyin, { type: 'array', toneType: 'none' });
  const userSyllables = pinyin(userPinyin, { type: 'array', toneType: 'none' });
  const splitSyllable = (syllable) => {
    const pinyinResult = pinyin(syllable, { segment: 'beta', type: 'array' });
    return pinyinResult.length > 1 ? [pinyinResult[0], pinyinResult.slice(1).join('')] : ['', pinyinResult[0]];
  };
  return (
    <div className="pinyin-comparison">
      {standardSyllables.map((stdSyllable, i) => {
        const userSyllable = userSyllables[i] || '';
        const [stdInitial, stdFinal] = splitSyllable(stdSyllable);
        const [userInitial, userFinal] = splitSyllable(userSyllable);
        return (
          <span key={i} className="syllable">
            <span className={stdInitial !== userInitial ? 'error' : 'correct'}>{stdSyllable}</span>
          </span>
        );
      })}
    </div>
  );
};


// --- 主组件 ---
export default function PinyinPracticeCard({
  questionTitle,
  flashcards,
  backgroundImages = []
}) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userPinyin, setUserPinyin] = useState('');
  
  const recognitionRef = useRef(null);
  const x = useMotionValue(0);

  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  const handleSwipe = (direction) => {
    setIsFlipped(false);
    setUserPinyin('');
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
  };
  
  useEffect(() => { animate(x, -index * CARD_WIDTH, { type: 'spring', stiffness: 300, damping: 30 }); }, [index, x]);
  const bind = useDrag(({ down, movement: [mx], velocity: [vx] }) => {
    if (down) { x.set(-index * CARD_WIDTH + mx); } 
    else {
      if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.5) { handleSwipe(mx > 0 ? -1 : 1); } 
      else { animate(x, -index * CARD_WIDTH, { type: 'spring', stiffness: 300, damping: 30 }); }
    }
  });
  
  const playTTS = (text) => new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural`).play();

  const handleMicClick = () => { /* ... 语音识别逻辑保持不变 ... */ };

  const getCardBackgroundImage = (cardIndex) => {
    if (backgroundImages && backgroundImages.length > 0) {
      // 循环使用背景图片
      return `url(${backgroundImages[cardIndex % backgroundImages.length]})`;
    }
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  if (!flashcards || flashcards.length === 0) {
    return <div className="practice-card-container"><p>卡片数据加载失败。</p></div>;
  }

  return (
    <div className="practice-card-container">
      {questionTitle && <h2 className="flashcard-pro-title">{questionTitle}</h2>}
      
      <div className="practice-card-drag-area" {...bind()}>
        <motion.div className="practice-card-track" style={{ x, '--card-width': `${CARD_WIDTH}px` }}>
          {flashcards.map((card, i) => (
            <motion.div key={card.word + i} className="practice-card-wrapper">
              <div 
                className="practice-card"
                onClick={() => setIsFlipped(prev => (i === index ? !prev : prev))}
                style={{ backgroundImage: getCardBackgroundImage(i) }}
              >
                <div className="practice-card-overlay" />
                <motion.div 
                  className="practice-card-content"
                  animate={{ rotateY: (i === index && isFlipped) ? 180 : 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="practice-card-face front">
                    <p className="practice-word">{card.word}</p>
                    <p className="practice-pinyin">{pinyin(card.word)}</p>
                  </div>
                  <div className="practice-card-face back">
                    <p className="practice-meaning">{card.meaning}</p>
                    {card.example && <p className="practice-example">例: {card.example}</p>}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
      
      <div className="pinyin-feedback-area">
        <PinyinComparer standardPinyin={currentCard.word} userPinyin={userPinyin} />
      </div>

      <div className="practice-card-controls">
        <button onClick={() => playTTS(currentCard.word)} className="control-btn-small"><SpeakerIcon /></button>
        <button onClick={handleMicClick}><MicIcon isListening={isListening} /></button>
      </div>
    </div>
  );
  }
