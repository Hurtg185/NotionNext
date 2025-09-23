// components/ImmersiveCubeCard.js (V3.3 - 终极修复朗读功能)

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// --- 常量与图标 (保持不变) ---
const CUBE_SIZE = 320;
const DRAG_BUFFER = 50;
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const FullscreenEnterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>;
const FullscreenExitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0-2-2h-3M3 16h3a2 2 0 0 0 2-2v-3"></path></svg>;

// --- 子组件 (保持不变) ---
const FullscreenToggle = () => { /* ... */ };
const CardFace = ({ wordData, isVisible }) => { /* ... */ };


// --- 主组件 ---
export default function ImmersiveCubeCard({ flashcards }) {
  // ... (其他 state 保持不变) ...
  const [index, setIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [Recognition, setRecognition] = useState(null);

  const rotateY = useMotionValue(0);
  const audioRef = useRef(null); // [核心修复] 用于持久化 Audio 对象

  useEffect(() => {
    document.body.classList.add('immersive-mode-active');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setRecognition(() => SpeechRecognition);

    // 组件卸载时，确保停止并清理音频
    return () => {
      document.body.classList.remove('immersive-mode-active');
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src?.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, []);

  const handleSwipe = (direction) => { /* ... 保持不变 ... */ };
  const bind = useDrag(({ down, movement: [mx], velocity: [vx] }) => { /* ... 保持不变 ... */ });
  const handleMicClick = () => { /* ... 保持不变 ... */ };

  // ==========================================================
  // [核心修复] 使用最健壮的 fetch + blob 播放逻辑
  // ==========================================================
  const playTTS = async (textToSpeak) => {
    // 停止当前可能正在播放的音频
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const text = textToSpeak?.trim();
    if (!text) {
      console.warn("朗读文本为空，已取消。");
      return;
    }
    
    try {
      const params = new URLSearchParams({
        t: text,
        v: 'zh-CN-XiaochenMultilingualNeural', // 指定发音人
        r: '-10%', // 指定语速
        p: '0%'   // 指定语调
      });
      const url = `https://t.leftsite.cn/tts?${params.toString()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API 请求失败, 状态码: ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      // 如果之前有音频 URL，先释放掉
      if (audioRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // 播放结束后自动释放 URL，防止内存泄漏
      audio.onended = () => {
        if (audio.src?.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      };

      await audio.play();

    } catch (err) {
      console.error("语音合成或播放失败:", err);
      alert(`朗读失败: ${err.message}`);
    }
  };
  // ==========================================================
  
  if (!flashcards || flashcards.length === 0) {
    return <div className="immersive-container"><p>没有单词数据。</p></div>;
  }

  // --- JSX return 部分 (保持不变) ---
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

// 再次折叠未改动的子组件和函数，你只需整体替换文件内容即可
const FullscreenToggleFolded = () => {/* ... */};
const CardFaceFolded = ({ wordData, isVisible }) => {/* ... */};
