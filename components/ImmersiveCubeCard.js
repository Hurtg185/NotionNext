// components/ImmersiveCubeCard.js (V3.2 - 语法干净的无广告版)

import { useState, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// --- 常量配置 ---
const CUBE_SIZE = 320;
const DRAG_BUFFER = 50;

// --- 图标 ---
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const FullscreenEnterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>;
const FullscreenExitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0-2-2h-3M3 16h3a2 2 0 0 0 2-2v-3"></path></svg>;

// --- 子组件 ---
const FullscreenToggle = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullScreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => console.error(err)); } else { document.exitFullscreen(); } };
  useEffect(() => { const handler = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', handler); return () => document.removeEventListener('fullscreenchange', handler); }, []);
  return ( <button onClick={toggleFullScreen} className="fullscreen-toggle-btn" title={isFullscreen ? "退出全屏" : "进入全屏"}>{isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}</button> );
};

const CardFace = ({ wordData, isVisible }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  useEffect(() => { if (isVisible) setIsFlipped(false); }, [isVisible]);
  if (!wordData) return null;
  const frontStyle = { backgroundImage: wordData.image ? `url(${wordData.image})` : 'none', backgroundColor: wordData.image ? '#000' : '#fff' };
  return (
    <div className="card-flipper-3d" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div className="card-face-3d front" style={{ ...frontStyle, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {wordData.image && <div className="image-overlay"></div>}
        <span className="word-3d">{wordData.word}</span>
      </motion.div>
      <motion.div className="card-face-3d back" style={{ transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)' }}>
        <div className="pinyin-3d">{wordData.pinyin}</div>
        <div className="meaning-3d">{wordData.meaning}</div>
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
    document.body.classList.add('immersive-mode-active');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setRecognition(() => SpeechRecognition);
    return () => { document.body.classList.remove('immersive-mode-active'); };
  }, []);

  const handleSwipe = (direction) => {
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
    animate(rotateY, newIndex * -90, { type: 'spring', stiffness: 200, damping: 30 });
  };

  const bind = useDrag(({ down, movement: [mx], velocity: [vx] }) => {
    if (down) {
      rotateY.set(index * -90 + mx);
    } else {
      if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.5) {
        handleSwipe(mx > 0 ? -1 : 1);
      } else {
        animate(rotateY, index * -90, { type: 'spring', stiffness: 200, damping: 30 });
      }
    }
  });

  const playTTS = (textToSpeak) => {
    const text = textToSpeak?.trim();
    if (!text) return;
    const params = new URLSearchParams({ t: text, v: 'zh-CN-XiaochenMultilingualNeural', r: '-10%', p: '0%' });
    const url = `https://t.leftsite.cn/tts?${params.toString()}`;
    new Audio(url).play().catch(e => console.error("音频播放失败:", e));
  };
  
  const handleMicClick = () => { /* ... */ };

  if (!flashcards || flashcards.length === 0) {
    return <div className="immersive-container"><p>没有单词数据。</p></div>;
  }

  return (
    <div className="immersive-container" {...bind()}>
      <FullscreenToggle />
      <div className="scene-container" style={{ perspective: '1000px' }}>
        <motion.div className="cube" style={{ width: CUBE_SIZE, height: CUBE_SIZE, transformStyle: 'preserve-3d', rotateY }}>
          {flashcards.map((card, i) => (
            <div key={i} className="cube-face" style={{ transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)` }}>
              <CardFace wordData={card} isVisible={i === index} />
            </div>
          ))}
        </motion.div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-20">
        <button className="cube-control-btn" onClick={(e) => { e.stopPropagation(); playTTS(flashcards[index].word); }}>
          <SpeakerIcon />
        </button>
        <button className="cube-control-btn" onClick={(e) => { e.stopPropagation(); handleMicClick(); }} disabled={!Recognition || isListening}>
          <MicIcon isListening={isListening} />
        </button>
      </div>
      {feedback && <div className="feedback-toast-3d">{feedback}</div>}
    </div>
  );
                      }
