// components/ImmersiveCubeCard.js (在你提供的代码基础上进行美化升级)

import { useState, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { pinyin } from 'pinyin-pro'; // 引入 pinyin-pro 以便在背面显示拼音

// --- 常量配置 ---
const CUBE_SIZE = 360; // [美化] 增大卡片尺寸
const DRAG_BUFFER = 50;

// --- 图标 ---
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => <svg width="28" height="28" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;

// --- 子组件 ---
const CardControls = ({ word, onMicClick, isListening, recognitionSupported }) => {
  const playTTS = (text) => {
    const params = new URLSearchParams({ t: text, v: 'zh-CN-XiaochenMultilingualNeural', r: '-10%', p: '0%' });
    new Audio(`https://t.leftsite.cn/tts?${params.toString()}`).play().catch(e => console.error("音频播放失败:", e));
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8 z-20">
      <button className="control-btn-v2" onClick={(e) => { e.stopPropagation(); playTTS(word); }}>
        <SpeakerIcon />
      </button>
      <button className="control-btn-v2" onClick={(e) => { e.stopPropagation(); onMicClick(); }} disabled={!recognitionSupported || isListening}>
        <MicIcon isListening={isListening} />
      </button>
    </div>
  );
};

const CardFace = ({ wordData, isVisible }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  useEffect(() => { if (isVisible) setIsFlipped(false); }, [isVisible]);

  if (!wordData) return null;

  // [美化] 为正面添加图片背景或备用背景
  const frontStyle = {
    backgroundImage: wordData.image ? `url(${wordData.image})` : 'linear-gradient(145deg, #2c2c2c 0%, #1a1a1a 100%)',
    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
  };

  return (
    <div className="card-flipper-v2" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div className="card-face-v2 front" style={frontStyle}>
        <div className="card-overlay-v2" />
        <span className="pinyin-v2">{pinyin(wordData.word)}</span>
        <span className="word-v2">{wordData.word}</span>
      </motion.div>
      <motion.div className="card-face-v2 back" style={{ transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)' }}>
        <div className="meaning-v2">{wordData.meaning}</div>
      </motion.div>
    </div>
  );
};

// --- 主组件 ---
export default function ImmersiveCubeCard({ flashcards }) {
  const [index, setIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [Recognition, setRecognition] = useState(null);

  const rotateY = useMotionValue(0);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setRecognition(() => SpeechRecognition);
  }, []);
  
  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, last }) => {
      if (down) {
        rotateY.set(memo + mx);
      } else {
        if (last) {
            if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) {
                const direction = mx > 0 ? -1 : 1;
                let newIndex = index + direction;
                if (newIndex < 0) newIndex = flashcards.length - 1;
                if (newIndex >= flashcards.length) newIndex = 0;
                setIndex(newIndex);
                animate(rotateY, newIndex * -90, { type: 'spring', stiffness: 200, damping: 30 });
            } else {
                animate(rotateY, index * -90, { type: 'spring', stiffness: 200, damping: 30 });
            }
        }
      }
      return rotateY.get();
  }, { from: () => rotateY.get() });

  const handleMicClick = () => { /* ... (语音识别逻辑不变) ... */ };

  if (!flashcards || flashcards.length === 0) {
    return <div className="immersive-container-v2"><p>没有加载到单词数据。</p></div>;
  }

  return (
    <div className="immersive-container-v2" {...bind()}>
      <div className="scene-container-v2" style={{ perspective: '1500px' }}>
        <motion.div
          className="cube-v2"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            transformStyle: 'preserve-3d',
            rotateY: rotateY,
          }}
        >
          {flashcards.map((card, i) => (
            <div
              key={i}
              className="cube-face-v2"
              style={{
                transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)`,
              }}
            >
              <CardFace wordData={card} isVisible={i === index} />
            </div>
          ))}
        </motion.div>
      </div>
      
      <CardControls
        word={flashcards[index].word}
        onMicClick={handleMicClick}
        isListening={isListening}
        recognitionSupported={!!Recognition}
      />
      {feedback && <div className="feedback-toast-v2">{feedback}</div>}
    </div>
  );
}
