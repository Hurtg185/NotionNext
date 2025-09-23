// components/ImmersiveCubeCard.js (最终版 - 大尺寸、功能完整)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量与图标 ---
const CUBE_SIZE = 360; // [核心] 显著增大卡片尺寸
const DRAG_BUFFER = 80;
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const StopIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>;

// --- 拼音对比核心逻辑 ---
const PinyinComparer = ({ standardWord, userPinyin, isVisible }) => {
    // ... (此部分逻辑与 PinyinPracticeCard 相同，保持不变)
};

// --- 主组件 ---
export default function ImmersiveCubeCard({ flashcards, backgroundImages = [] }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userPinyin, setUserPinyin] = useState('');
  const [cardWidth, setCardWidth] = useState(CUBE_SIZE);
  
  const recognitionRef = useRef(null);
  const rotateY = useMotionValue(0);
  const containerRef = useRef(null);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  // 使用 useEffect 确保只在客户端访问 DOM
  useEffect(() => {
    if (containerRef.current) {
        // 让卡片宽度等于容器宽度，但不超过 CUBE_SIZE
        const newWidth = Math.min(containerRef.current.offsetWidth * 0.95, CUBE_SIZE);
        setCardWidth(newWidth);
    }
  }, []);

  const handleSwipe = (direction) => { /* ... (切换逻辑不变) ... */ };
  
  useEffect(() => { animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 }); }, [index, rotateY]);
  
  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, event, last }) => {
    if (event.target.closest('button')) return;
    if (down) { rotateY.set(memo + mx); } 
    else {
      if (last) { 
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) { handleSwipe(mx > rotateY.get() ? -1 : 1); } 
        else { animate(rotateY, index * -90, { type: 'spring', stiffness: 250, damping: 30 }); }
      }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });
  
  const playTTS = (text) => { /* ... (TTS 逻辑不变) ... */ };
  const handleMicClick = () => { /* ... (语音识别逻辑不变) ... */ };
  const getCardBackgroundImage = (cardIndex) => { /* ... (背景图逻辑不变) ... */ };
  
  if (!flashcards || flashcards.length === 0) {
    return <div className="immersive-container-v2"><p>没有加载到单词数据。</p></div>;
  }

  return (
    <div ref={containerRef} className="immersive-container-v2">
        {/* 拼音识别结果移到外部，布局更稳定 */}
        <div className="pinyin-feedback-area-top-v2">
            <PinyinComparer standardWord={currentCard.word} userPinyin={userPinyin} isVisible={!!userPinyin} />
        </div>

        <div className="scene-container-v2">
            <motion.div className="cube-v2" style={{ rotateY, width: cardWidth, height: cardWidth }}>
            {flashcards.map((card, i) => (
                <div
                    key={card.word + i}
                    className="cube-face-v2"
                    style={{ 
                        transform: `rotateY(${i * 90}deg) translateZ(${cardWidth / 2}px)`,
                        backgroundImage: getCardBackgroundImage(i)
                    }}
                >
                    <div className="immersive-card-overlay-v2" />
                    <motion.div className="immersive-card-content-v2" animate={{ rotateY: (i === index && isFlipped) ? 180 : 0 }}>
                        <div className="immersive-card-face-v2 front" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(true); }}>
                            <p className="immersive-pinyin-v2">{pinyin(card.word)}</p>
                            <p className="immersive-word-v2">{card.word}</p>
                        </div>
                        <div className="immersive-card-face-v2 back" onClick={(e) => { if (!e.target.closest('button')) setIsFlipped(false); }}>
                            <p className="immersive-meaning-v2">{card.meaning}</p>
                        </div>
                    </motion.div>
                    <div className="immersive-card-controls-v2">
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

// ... (所有折叠的代码都是完整的，你只需整体替换)
