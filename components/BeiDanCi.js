// components/BeiDanCi.js
// 这个文件里只应该有这些 React 组件代码

import { useState, useEffect } from 'react';

// SVG 图标组件
const SpeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
);

const MicIcon = ({ isListening }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isListening ? '#ff4757' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
);

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);


export default function BeiDanCi({ questionTitle, flashcards }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [Recognition, setRecognition] = useState(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setRecognition(() => SpeechRecognition);
    } else {
      console.warn('浏览器不支持语音识别 API。');
    }
  }, []);

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="word-card-container">
        <p>没有加载单词数据，请检查 Notion 代码块中的 JSON 格式。</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const playTTS = (text) => {
    const apiBaseUrl = 'https://t.leftsite.cn';
    const voice = 'zh-CN-XiaochenMultilingualNeural';
    const rate = '-20%';
    const pitch = '0%';
    const outputFormat = 'audio-24khz-48kbitrate-mono-mp3';
    const encodedText = encodeURIComponent(text);
    const url = `${apiBaseUrl}/tts?t=${encodedText}&v=${voice}&r=${rate}&p=${pitch}&o=${outputFormat}`;
    
    const audio = new Audio(url);
    audio.play().catch(e => {
        console.error("音频播放失败:", e);
        setFeedback({ message: '音频播放失败', type: 'error' });
    });
  };

  const handleSpeechRecognition = () => {
    if (isListening || !Recognition) {
      return;
    }
    
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setFeedback({ message: '请说出单词...', type: 'info' });

    recognition.start();

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript.replace(/[，。？！,.]/g, '');
      if (speechResult === currentCard.word) {
        setFeedback({ message: `正确! 你说了 "${speechResult}"`, type: 'success' });
      } else {
        setFeedback({ message: `不对，你说了 "${speechResult}"`, type: 'error' });
      }
    };

    recognition.onspeechend = () => {
      recognition.stop();
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      let errorMessage = '语音识别出错';
      if (event.error === 'no-speech') errorMessage = '没有检测到语音';
      if (event.error === 'not-allowed') errorMessage = '请允许使用麦克风';
      setFeedback({ message: errorMessage, type: 'error' });
      setIsListening(false);
    };
  };
  
  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
    setIsFlipped(false);
    setFeedback({ message: '', type: '' });
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + flashcards.length) % flashcards.length);
    setIsFlipped(false);
    setFeedback({ message: '', type: '' });
  };

  return (
    <div className="word-card-container">
      {questionTitle && <h3 className="card-title">{questionTitle}</h3>}
      
      <div className={`card-flipper ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
        <div className="card-face card-front">
          <p className="word">{currentCard.word}</p>
        </div>
        <div className="card-face card-back">
          <p className="pinyin">{currentCard.pinyin}</p>
          <p className="meaning">{currentCard.meaning}</p>
          {currentCard.example && <p className="example">例: {currentCard.example}</p>}
          {currentCard.exampleTranslation && <p className="example-translation">{currentCard.exampleTranslation}</p>}
        </div>
      </div>

      <div className="card-controls">
        <button className="control-btn" onClick={(e) => { e.stopPropagation(); playTTS(currentCard.word); }} aria-label="朗读">
          <SpeakerIcon />
        </button>
        <button 
          className={`control-btn mic-btn ${isListening ? 'listening' : ''}`} 
          onClick={(e) => { e.stopPropagation(); handleSpeechRecognition(); }} 
          aria-label="语音识别"
          disabled={!Recognition}
          title={!Recognition ? '浏览器不支持语音识别' : '跟读单词'}
        >
          <MicIcon isListening={isListening} />
        </button>
      </div>

      {feedback.message && (
        <div className={`feedback-message ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <div className="card-navigation">
        <button className="nav-btn" onClick={goToPrev} aria-label="上一个">
          <ChevronLeftIcon />
        </button>
        <span className="nav-counter">{currentIndex + 1} / {flashcards.length}</span>
        <button className="nav-btn" onClick={goToNext} aria-label="下一个">
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
  }
