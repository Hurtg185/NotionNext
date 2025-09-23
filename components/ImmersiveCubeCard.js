// components/ImmersiveCubeCard.js

import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// --- 常量配置 ---
const CUBE_SIZE = 300; // 立方体的大小 (px)
const DRAG_BUFFER = 50; // 拖拽超过多少距离就算切换

// --- 复用之前的图标和功能 ---
const SpeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
);
const MicIcon = ({ isListening }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
);

// 卡片控制按钮 (TTS 和语音识别)
const CardControls = ({ word, onMicClick, isListening, recognitionSupported }) => {
  const playTTS = (text) => {
    const params = new URLSearchParams({ t: text, v: 'zh-CN-XiaochenMultilingualNeural', r: '-10%', p: '0%' });
    const url = `https://t.leftsite.cn/tts?${params.toString()}`;
    new Audio(url).play().catch(e => console.error("音频播放失败:", e));
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-20">
      <button className="cube-control-btn" onClick={(e) => { e.stopPropagation(); playTTS(word); }}>
        <SpeakerIcon />
      </button>
      <button className="cube-control-btn" onClick={(e) => { e.stopPropagation(); onMicClick(); }} disabled={!recognitionSupported || isListening}>
        <MicIcon isListening={isListening} />
      </button>
    </div>
  );
};

// 单个卡片的面 (包含翻转逻辑)
const CardFace = ({ wordData, isVisible }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  
  // 当卡片切换时，重置翻转状态
  useEffect(() => {
    if (isVisible) {
      setIsFlipped(false);
    }
  }, [isVisible]);

  if (!wordData) return null; // 如果没有单词数据，不渲染

  return (
    <div className="card-flipper-3d" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div className="card-face-3d front" style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
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

  // 使用 useMotionValue 来驱动动画，避免不必要的组件重渲染
  const rotateY = useMotionValue(0);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setRecognition(() => SpeechRecognition);
  }, []);
  
  // 手势处理逻辑
  const bind = useDrag(
    ({ down, movement: [mx], direction: [xDir], velocity: [vx] }) => {
      if (down) {
        // 拖拽时，实时更新立方体的旋转角度
        rotateY.set(index * -90 + mx);
      } else {
        // 拖拽结束
        const direction = mx > 0 ? -1 : 1; // -1 向右滑 (看上一张), 1 向左滑 (看下一张)
        
        // 判断是否满足切换条件：拖拽距离够远 或 快速滑动
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.5) {
          let newIndex = index + direction;
          // 循环切换
          if (newIndex < 0) newIndex = flashcards.length - 1;
          if (newIndex >= flashcards.length) newIndex = 0;
          setIndex(newIndex);
          // 使用 animate 函数以弹簧效果动画到新的角度
          animate(rotateY, newIndex * -90, { type: 'spring', stiffness: 200, damping: 30 });
        } else {
          // 如果不满足条件，弹回原来的角度
          animate(rotateY, index * -90, { type: 'spring', stiffness: 200, damping: 30 });
        }
      }
    }
  );

  const handleMicClick = () => {
    if (isListening || !Recognition) return;
    
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    setIsListening(true);
    setFeedback('请说...');

    recognition.start();

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript.replace(/[，。？！,.]/g, '');
      if (result === flashcards[index].word) {
        setFeedback('正确！');
      } else {
        setFeedback(`你说了: ${result}`);
      }
      setTimeout(() => setFeedback(''), 2000);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      console.error(e);
      setFeedback('识别出错');
      setTimeout(() => setFeedback(''), 2000);
      setIsListening(false);
    };
  };

  return (
    <div className="immersive-container" {...bind()}>
      <div className="scene-container" style={{ perspective: '1000px' }}>
        <motion.div
          className="cube"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            transformStyle: 'preserve-3d',
            rotateY: rotateY, // 绑定旋转角度
          }}
        >
          {flashcards.map((card, i) => {
            // 我们只渲染当前、上一个和下一个卡片以优化性能
            const diff = i - index;
            if (Math.abs(diff) > 2 && flashcards.length > 5) {
                 if (i !== 0 && i !== flashcards.length - 1) return null;
            }

            return (
              <div
                key={i}
                className="cube-face"
                style={{
                  transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)`,
                }}
              >
                <CardFace wordData={card} isVisible={i === index} />
              </div>
            );
          })}
        </motion.div>
      </div>
      
      {/* 控制按钮和反馈信息 */}
      <CardControls
        word={flashcards[index].word}
        onMicClick={handleMicClick}
        isListening={isListening}
        recognitionSupported={!!Recognition}
      />
      {feedback && <div className="feedback-toast-3d">{feedback}</div>}
    </div>
  );
}
