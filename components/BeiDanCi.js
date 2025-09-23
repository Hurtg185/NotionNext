// components/BeiDanCi.js (V2.1 - 最终修复版)

import { useState, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// --- 常量配置 ---
const CARD_WIDTH = 300;
const DRAG_BUFFER = 50;

// --- SVG 图标组件 ---
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = ({ isListening }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;

// --- 卡片的面 (包含翻转逻辑) ---
const CardFace3D = ({ cardData, isVisible }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  useEffect(() => { if (isVisible) setIsFlipped(false); }, [isVisible]);
  if (!cardData) return null;

  return (
    <div className="card-flipper-flat" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div className="card-face-flat front" style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        <p className="word-flat">{cardData.word}</p>
      </motion.div>
      <motion.div className="card-face-flat back" style={{ transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)' }}>
        <p className="pinyin-flat">{cardData.pinyin}</p>
        <p className="meaning-flat">{cardData.meaning}</p>
        {cardData.example && <p className="example-flat">例: {cardData.example}</p>}
      </motion.div>
    </div>
  );
};

// --- 主组件 ---
export default function BeiDanCi({ questionTitle, flashcards }) {
  const [index, setIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [Recognition, setRecognition] = useState(null);

  const x = useMotionValue(0);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setRecognition(() => SpeechRecognition);
  }, []);

  const handleSwipe = (direction) => {
    let newIndex = index + direction;
    if (newIndex < 0) newIndex = flashcards.length - 1;
    if (newIndex >= flashcards.length) newIndex = 0;
    setIndex(newIndex);
  };
  
  useEffect(() => {
    animate(x, -index * CARD_WIDTH, { type: 'spring', stiffness: 300, damping: 30 });
  }, [index, x]);

  const bind = useDrag(({ down, movement: [mx], velocity: [vx] }) => {
    if (down) {
      x.set(-index * CARD_WIDTH + mx);
    } else {
      if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.5) {
        handleSwipe(mx > 0 ? -1 : 1);
      } else {
        animate(x, -index * CARD_WIDTH, { type: 'spring', stiffness: 300, damping: 30 });
      }
    }
  });

  const playTTS = (text) => {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%`;
    new Audio(url).play().catch(e => {
        console.error("音频播放失败:", e);
        setFeedback({ message: '音频播放失败', type: 'error' });
    });
  };

  const handleSpeechRecognition = () => {
    if (isListening || !Recognition) return;
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    setIsListening(true);
    setFeedback({ message: '请说出单词...', type: 'info' });
    recognition.start();
    recognition.onresult = (event) => {
      const speechResult = event.results.transcript.replace(/[，。？！,.]/g, '');
      if (speechResult === flashcards[index].word) {
        setFeedback({ message: `正确! 你说了 "${speechResult}"`, type: 'success' });
      } else {
        setFeedback({ message: `不对，你说了 "${speechResult}"`, type: 'error' });
      }
    };
    recognition.onspeechend = () => { recognition.stop(); setIsListening(false); };
    recognition.onerror = (event) => {
      let errorMessage = '语音识别出错';
      if (event.error === 'no-speech') errorMessage = '没有检测到语音';
      if (event.error === 'not-allowed') errorMessage = '请允许使用麦克风';
      setFeedback({ message: errorMessage, type: 'error' });
      setIsListening(false);
    };
  };

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="beidanci-container">
        <p>没有加载单词数据，请检查 Notion 代码块中的 JSON 格式。</p>
      </div>
    );
  }

  return (
    <div className="beidanci-container">
      {questionTitle && <h3 className="card-title">{questionTitle}</h3>}
      
      <div className="beidanci-drag-area" {...bind()}>
        <motion.div className="beidanci-card-track" style={{ x }}>
          {flashcards.map((card, i) => (
            <motion.div key={i} className="beidanci-card" style={{ width: CARD_WIDTH }}>
              <CardFace3D cardData={card} isVisible={i === index} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="card-controls">
        <button className="control-btn" onClick={() => playTTS(flashcards[index].word)}>
          <SpeakerIcon />
        </button>
        <button className="control-btn" onClick={handleSpeechRecognition} disabled={!Recognition || isListening}>
          <MicIcon isListening={isListening} />
        </button>
      </div>

      {feedback.message && (
        <div className={`feedback-message ${feedback.type}`}>{feedback.message}</div>
      )}
      
      <div className="beidanci-navigation">
        <span className="nav-counter">{index + 1} / {flashcards.length}</span>
      </div>
    </div>
  );
      }
