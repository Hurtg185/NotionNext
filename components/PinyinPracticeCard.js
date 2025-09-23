// components/PinyinPracticeCard.js (V4.3 - 最终 Flexbox 布局修复版)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// ... (所有图标和 PinyinComparer 子组件都保持不变) ...
const SpeakerIcon = () => {/*...*/};
const MicIcon = () => {/*...*/};
const StopIcon = () => {/*...*/};
const PinyinComparer = ({ standardWord, userPinyin, isVisible }) => {/*...*/};

// --- 主组件 ---
export default function PinyinPracticeCard({ flashcards, backgroundImages = [] }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userPinyin, setUserPinyin] = useState('');
  const [cardWidth, setCardWidth] = useState(340); 

  const recognitionRef = useRef(null);
  const rotateY = useMotionValue(0);
  const containerRef = useRef(null);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  useEffect(() => {
    document.documentElement.classList.add('flashcard-mode-active');
    if (containerRef.current) { setCardWidth(containerRef.current.offsetWidth * 0.9); }
    return () => { document.documentElement.classList.remove('flashcard-mode-active'); };
  }, []);

  const handleSwipe = (direction) => {/*...*/};
  useEffect(() => { animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 }); }, [index, rotateY]);
  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, event, last }) => {/*...*/});
  const playTTS = (text) => {/*...*/};
  const handleMicClick = () => {/*...*/};
  const getCardBackgroundImage = (cardIndex) => {/*...*/};
  
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
                {/* [核心修复] 重构 JSX 结构以适配 Flexbox */}
                <div className="immersive-card-face front" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(true); }}>
                  {/* 空白占位符，用于将内容向下推 */}
                  <div className="top-spacer"></div>
                  
                  <div className="main-content">
                    <p className="immersive-pinyin">{pinyin(card.word)}</p>
                    <p className="immersive-word">{card.word}</p>
                  </div>

                  <PinyinComparer standardWord={card.word} userPinyin={userPinyin} isVisible={!!userPinyin && !isFlipped && i === index} />
                  
                  <div className="immersive-card-controls">
                      <button onClick={(e) => { e.stopPropagation(); playTTS(card.word); }}><SpeakerIcon /></button>
                      <button className={isListening ? 'listening' : ''} onClick={(e) => { e.stopPropagation(); handleMicClick(); }}>
                          {isListening ? <StopIcon /> : <MicIcon />}
                      </button>
                  </div>
                </div>

                <div className="immersive-card-face back" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(false); }}>
                  <p className="immersive-meaning">{card.meaning}</p>
                </div>
              </motion.div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
              }
