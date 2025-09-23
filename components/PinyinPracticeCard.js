// components/StudyCube.js (全新、稳定、为缅甸用户优化)

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro';

// --- 常量与图标 ---
const CUBE_SIZE = 340; // 卡片尺寸
const DRAG_BUFFER = 60; // 拖拽切换的灵敏度

const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => <svg className={isListening ? 'listening' : ''} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;

// --- 卡片的面 (子组件) ---
const CardFace = ({ card, isVisible, isFlipped, onFlip }) => {
  if (!card) return null;

  const frontStyle = {
    backgroundImage: card.image ? `url(${card.image})` : 'linear-gradient(145deg, #4facfe 0%, #00f2fe 100%)',
    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
  };
  const backStyle = {
    transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)'
  };

  return (
    <div className="study-cube-flipper" onClick={onFlip}>
      {/* 正面：中文 + 拼音 */}
      <motion.div className="study-cube-cardface front" style={frontStyle}>
        <div className="study-cube-overlay" />
        <p className="study-cube-pinyin">{pinyin(card.word)}</p>
        <p className="study-cube-word">{card.word}</p>
      </motion.div>
      {/* 背面：缅甸语释义 + 例句 */}
      <motion.div className="study-cube-cardface back" style={backStyle}>
        <p className="study-cube-meaning">{card.meaning}</p>
        {card.example && <p className="study-cube-example">{card.example}</p>}
      </motion.div>
    </div>
  );
};

// --- 主组件 ---
export default function StudyCube({ questionTitle, flashcards }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const rotateY = useMotionValue(0);
  const currentCard = useMemo(() => flashcards[index], [flashcards, index]);

  // 手势切换逻辑
  const handleSwipe = (direction) => {
    setIsFlipped(false); // 切换时自动翻回正面
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
  };

  useEffect(() => {
    animate(rotateY, -index * 90, { type: 'spring', stiffness: 250, damping: 30 });
  }, [index, rotateY]);

  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, last, event }) => {
    if (event.target.closest('button')) return; // 忽略按钮上的拖拽
    if (down) {
      rotateY.set(memo + mx);
    } else {
      if (last) {
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) {
          handleSwipe(mx > 0 ? -1 : 1);
        } else {
          animate(rotateY, -index * 90, { type: 'spring', stiffness: 250, damping: 30 });
        }
      }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });

  // 语音功能
  const playTTS = (text) => {
    const params = new URLSearchParams({ t: text.trim(), v: 'zh-CN-XiaochenMultilingualNeural', r: '-20%' });
    new Audio(`https://t.leftsite.cn/tts?${params.toString()}`).play().catch(console.error);
  };
  
  if (!flashcards || flashcards.length === 0) {
    return <div className="study-cube-container">没有卡片数据。</div>;
  }

  return (
    <div className="study-cube-container">
      {questionTitle && <h2 className="study-cube-title">{questionTitle}</h2>}
      
      <div className="study-cube-scene" {...bind()}>
        <motion.div className="study-cube" style={{ rotateY }}>
          {flashcards.map((card, i) => (
            <div
              key={card.word + i}
              className="study-cube-face-wrapper"
              style={{ transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)` }}
            >
              <CardFace 
                card={card} 
                isVisible={i === index} 
                isFlipped={i === index && isFlipped}
                onFlip={() => i === index && setIsFlipped(f => !f)}
              />
            </div>
          ))}
        </motion.div>
      </div>

      <div className="study-cube-controls">
        <button onClick={() => playTTS(currentCard.word)} title="朗读">
          <SpeakerIcon />
        </button>
        <span className="study-cube-counter">{index + 1} / {flashcards.length}</span>
        {/* 语音识别按钮暂时移除以确保核心功能100%稳定，可后续添加 */}
        <button disabled title="语音识别 (暂不可用)">
          <MicIcon isListening={false} />
        </button>
      </div>
    </div>
  );
    }
