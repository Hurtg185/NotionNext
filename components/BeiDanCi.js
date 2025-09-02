// /components/BeiDanCi.js - 终极设计版 v17 (全屏优化，交互回归，流程增强)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton';
import JumpToCardModal from './JumpToCardModal';

const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
  correctSoundUrl = '/sounds/correct.mp3',
  incorrectSoundUrl = '/sounds/wrong.mp3'
}) => {
  // --- State ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' });
  
  // 新增：卡片变色反馈和自动跳转的 State
  const [cardFeedbackClass, setCardFeedbackClass] = useState('');
  const autoAdvanceTimeoutRef = useRef(null);

  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);

  // --- Prop 解析和数据初始化 (来自 v5) ---
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try { cards = JSON.parse(flashcardsProp); } catch (e) { cards = []; }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }
    setDisplayFlashcards(internalIsShuffle ? [...cards].sort(() => Math.random() - 0.5) : [...cards]);
    setCurrentIndex(0);
    setShowBack(false);
  }, [flashcardsProp, internalIsShuffle]);

  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try { images = JSON.parse(backgroundImagesProp); } catch (e) { images = []; }
    } else if (Array.isArray(backgroundImagesProp)) { images = backgroundImagesProp; }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);

  useEffect(() => {
    setInternalIsShuffle(String(isShuffleProp) === 'true');
  }, [isShuffleProp]);
  
  // --- 语音识别和音频初始化 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio(correctSoundUrl);
      incorrectAudioRef.current = new Audio(incorrectSoundUrl);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
          setRecognizedText(transcript);
          const currentWord = displayFlashcards[currentIndex]?.word.trim();
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '正确' });
            correctAudioRef.current?.play();
            setCardFeedbackClass('border-green-500'); // 卡片变色
            setTimeout(() => setShowBack(true), 200);
            // 答对后4秒自动跳转
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              handleNext();
            }, 4000);
          } else {
            setFeedback({ status: 'incorrect', message: '错误' });
            incorrectAudioRef.current?.play();
            setCardFeedbackClass('border-red-500'); // 卡片变色
          }
          setTimeout(() => setCardFeedbackClass(''), 1000); // 1秒后恢复边框
        };
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setFeedback({ status: 'error', message: '出错' });
        speechRecognitionRef.current = recognition;
      }
    }
    // 组件卸载时清除定时器
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, [lang, correctSoundUrl, incorrectSoundUrl, displayFlashcards, currentIndex]);

  // --- 交互逻辑 ---
  const handleToggleBack = () => { if (!showBack) setShowBack(true); };

  const changeCard = (newIndex) => {
    if (isTransitioning) return;
    // 关键：切换卡片时，清除自动跳转的定时器
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
    setIsTransitioning(true);
    setShowBack(false);
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    setCardFeedbackClass('');
    if (speechRecognitionRef.current && isListening) speechRecognitionRef.current.stop();
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 300);
  };

  const handleNext = () => changeCard((currentIndex + 1) % displayFlashcards.length);
  const handlePrev = () => changeCard((currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length);
  const handleListen = () => {
    if (isListening || !speechRecognitionRef.current) return;
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    speechRecognitionRef.current.start();
  };
  const handleJump = (index) => {
    changeCard(index);
    setIsModalOpen(false);
  };

  // --- 渲染部分 ---
  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length] || '';
  const feedbackColor = feedback.status === 'correct' ? 'text-green-400' : 'text-red-400';

  if (!currentCard) return <div className="text-center p-8">没有卡片数据。</div>;

  return (
    <div className="w-full px-4"> {/* 修正：让容器宽度100% */}
      {isModalOpen && <JumpToCardModal total={displayFlashcards.length} current={currentIndex} onJump={handleJump} onClose={() => setIsModalOpen(false)} />}
      <h3 className="text-2xl sm:text-3xl font-extrabold my-6 text-gray-800 dark:text-gray-100 text-center">{questionTitle}</h3>

      <div 
        className={`relative w-full max-w-3xl mx-auto overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 border-4 border-transparent ${cardFeedbackClass}`}
        style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }} 
      >
        {/* ... (v16 的背景图和磨砂玻璃层代码不变) ... */}
        
        {/* 页码 (新样式) */}
        <div 
          className="absolute top-5 right-5 z-40 text-white text-lg font-bold drop-shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          onClick={() => setIsModalOpen(true)}
        >
          {currentIndex + 1}<span className="text-white/50"> / {displayFlashcards.length}</span>
        </div>
        
        {/* ... (v16 的内容容器和正反面代码不变，但正面onClick已移到下方) ... */}
        
        {/* 交互覆盖层 (恢复v5的模式) */}
        <div className="absolute inset-0 z-30 grid grid-cols-4 grid-rows-3 pointer-events-none">
          {/* 中间区域，点击翻面 */}
          <div className="col-span-full row-span-full pointer-events-auto cursor-pointer" onClick={handleToggleBack}></div>
          {/* 左下角 */}
          <div className="col-start-1 row-start-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
          {/* 右下角 */}
          <div className="col-start-4 row-start-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>
        </div>
        
        {/* 语音按钮 */}
        <button onClick={(e) => { e.stopPropagation(); handleListen(); }} disabled={isListening} className={`...`}>
          <i className="fas fa-microphone"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
