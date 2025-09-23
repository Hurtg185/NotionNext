// components/ImmersiveCubeCard.js (V2.1 - 已修复朗读功能)

import { useState, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// --- 常量配置 ---
const CUBE_SIZE = 320;
const DRAG_BUFFER = 50;
const AD_FREQUENCY = 5;

// --- 图标 (保持不变) ---
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const FullscreenEnterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>;
const FullscreenExitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0-2-2h-3M3 16h3a2 2 0 0 0 2-2v-3"></path></svg>;

// --- 子组件 (保持不变) ---
const AdInterstitial = ({ onClose }) => (/* ... */);
const FullscreenToggle = () => {/* ... */};
const CardFace = ({ wordData, isVisible }) => {/* ... */};


// --- 主组件 ---
export default function ImmersiveCubeCard({ flashcards }) {
  // ... (useState, useEffect 等 Hooks 保持不变) ...
  const [index, setIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [isAdVisible, setIsAdVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [Recognition, setRecognition] = useState(null);
  const rotateY = useMotionValue(0);

  useEffect(() => { /* ... 沉浸式和语音识别初始化逻辑保持不变 ... */ });

  // ... (handleSwipe, bind, handleMicClick 等手势和识别逻辑保持不变) ...
  
  // ==========================================================
  // [核心修复] 使用功能更完整的 TTS 函数
  // ==========================================================
  const playTTS = (textToSpeak) => {
    const text = textToSpeak?.trim();
    if (!text) {
      console.warn("朗读文本为空，已取消。");
      return;
    }
    
    const params = new URLSearchParams({
      t: text,
      v: 'zh-CN-XiaochenMultilingualNeural', // 指定发音人
      r: '-10%', // 指定语速
      p: '0%'   // 指定语调
    });
    const url = `https://t.leftsite.cn/tts?${params.toString()}`;
    
    const audio = new Audio(url);
    audio.play().catch(e => {
      console.error("音频播放失败:", e);
      alert('音频播放失败，请检查网络或浏览器控制台。');
    });
  };
  // ==========================================================

  if (!flashcards || flashcards.length === 0) {
    return <div className="immersive-container"><p>没有单词数据。</p></div>;
  }
  
  // --- JSX return 部分 (保持不变) ---
  return (
    <div className="immersive-container" {...bind()}>
      <FullscreenToggle />
      {isAdVisible && <AdInterstitial onClose={() => setIsAdVisible(false)} />}
      <div className="scene-container" style={{ perspective: '1000px', opacity: isAdVisible ? 0 : 1 }}>
        <motion.div className="cube" style={{ width: CUBE_SIZE, height: CUBE_SIZE, transformStyle: 'preserve-d', rotateY }}>
          {flashcards.map((card, i) => (
            <div key={i} className="cube-face" style={{ transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)` }}>
              <CardFace wordData={card} isVisible={i === index} />
            </div>
          ))}
        </motion.div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-20" style={{ opacity: isAdVisible ? 0 : 1, pointerEvents: isAdVisible ? 'none' : 'auto' }}>
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
