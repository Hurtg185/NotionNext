// components/PinyinPracticeCard.js (V3.5 - 完整代码，已添加语速控制)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量配置 ---
const DRAG_BUFFER = 80;

// --- 图标 ---
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const StopIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>;

// --- 拼音对比核心逻辑 ---
const PinyinComparer = ({ standardWord, userPinyin }) => {
  const standardPinyinText = pinyin(standardWord);
  if (!userPinyin) {
    return <p className="pinyin-display-top standard">{standardPinyinText}</p>;
  }

  const standardSyllables = pinyin(standardWord, { type: 'array', toneType: 'none' });
  const userSyllables = pinyin(userPinyin, { type: 'array', toneType: 'none' });

  const splitSyllable = (syllable) => {
    const pinyinResult = pinyin(syllable, { segment: 'beta', type: 'array' });
    if (!pinyinResult || pinyinResult.length === 0) return ['', ''];
    return pinyinResult.length > 1 ? [pinyinResult[0], pinyinResult.slice(1).join('')] : ['', pinyinResult[0]];
  };

  return (
    <div className="pinyin-comparison-top">
      {standardSyllables.map((stdSyllable, i) => {
        const userSyllable = userSyllables[i] || '';
        const [stdInitial, stdFinal] = splitSyllable(stdSyllable);
        const [userInitial, userFinal] = splitSyllable(userSyllable);
        return (
          <span key={i} className="syllable-top">
            <span className={stdInitial !== userInitial ? 'error' : 'correct'}>{stdInitial}</span>
            <span className={stdFinal !== userFinal ? 'error' : 'correct'}>{stdFinal}</span>
          </span>
        );
      })}
    </div>
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

  const handleSwipe = (direction) => {
    setIsFlipped(false);
    setUserPinyin('');
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
    animate(rotateY, newIndex * -90, { type: 'spring', stiffness: 250, damping: 30 });
  };
  
  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, event }) => {
    if (event.target.closest('button')) return;
    if (down) { rotateY.set(memo + mx); } 
    else {
      if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.5) { handleSwipe(mx > 0 ? -1 : 1); } 
      else { animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 }); }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });
  
  // ==========================================================
  // [核心修复] 使用带有语速控制的 playTTS 函数
  // ==========================================================
  const playTTS = (textToSpeak) => {
    const text = textToSpeak?.trim();
    if (!text) {
      console.warn("朗读文本为空，已取消。");
      return;
    }
    
    const params = new URLSearchParams({
      t: text,
      v: 'zh-CN-XiaoxiaoMultilingualNeural',
      r: '-30', // <-- 在这里修改语速！'-20%' 表示慢 20%
      p: '0'
    });
    
    const url = `https://t.leftsite.cn/tts?${params.toString()}`;
    
    new Audio(url).play().catch(e => console.error("音频播放失败:", e));
  };
  // ==========================================================

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
    recognition.onerror = (e) => console.error('语音识别错误:', e);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.replace(/[^\u4e00-\u9fa5]/g, '');
      const pinyinResult = pinyin(transcript, { toneType: 'none' }).replace(/\s/g, '');
      setUserPinyin(pinyinResult);
    };
    recognition.start();
  };

  const getCardBackgroundImage = (cardIndex) => {
    if (backgroundImages && backgroundImages.length > 0) {
      return `url(${backgroundImages[cardIndex % backgroundImages.length]})`;
    }
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };
  
  return (
    <div ref={containerRef} className="immersive-container-full">
      <div className="pinyin-feedback-area-top">
        <PinyinComparer standardWord={currentCard.word} userPinyin={userPinyin} />
      </div>

      <div className="scene-container-full" {...bind()}>
        <motion.div className="cube-full" style={{ rotateY }}>
          {flashcards.map((card, i) => {
            const cardWidth = containerRef.current?.offsetWidth * 0.9 || 340;
            return (
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
                    <p className="immersive-pinyin">{pinyin(card.word)}</p>
                    <p className="immersive-word">{card.word}</p>
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
