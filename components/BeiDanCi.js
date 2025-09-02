// /components/BeiDanCi.js - 终极整合版 v15 (基于v5，集成所有功能)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
  correctSoundUrl = '/sounds/correct.mp3', // 添加默认音效
  incorrectSoundUrl = '/sounds/wrong.mp3'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);

  // --- 新增：语音识别 State ---
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' });
  
  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);

  // --- Prop 解析和数据初始化 (来自 v5) ---
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try { cards = JSON.parse(flashcardsProp); } catch (e) { console.error("Error parsing flashcards JSON string:", e); cards = []; }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }

    if (!cards || cards.length === 0) {
      setDisplayFlashcards([]);
      return;
    }

    setDisplayFlashcards(internalIsShuffle ? [...cards].sort(() => Math.random() - 0.5) : [...cards]);
    setCurrentIndex(0);
    setShowBack(false);
  }, [flashcardsProp, internalIsShuffle]);

  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try { images = JSON.parse(backgroundImagesProp); } catch (e) { console.error("Error parsing backgroundImages JSON string:", e); images = []; }
    } else if (Array.isArray(backgroundImagesProp)) { images = backgroundImagesProp; }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);

  useEffect(() => {
    setInternalIsShuffle(String(isShuffleProp) === 'true');
  }, [isShuffleProp]);

  // --- 新增：语音识别和音频初始化 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 初始化音频
      correctAudioRef.current = new Audio(correctSoundUrl);
      incorrectAudioRef.current = new Audio(incorrectSoundUrl);

      // 初始化语音识别
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = lang;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
          setIsListening(true);
          setFeedback({ status: 'listening', message: '请说话...' });
        };
        recognition.onend = () => {
          setIsListening(false);
          setFeedback(prev => (prev.status === 'listening' ? { status: 'idle', message: '' } : prev));
        };
        recognition.onerror = (event) => {
           console.error('Speech recognition error:', event.error);
           setIsListening(false);
           setFeedback({ status: 'error', message: '识别出错' });
        };
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
          setRecognizedText(transcript);
          const currentWord = displayFlashcards[currentIndex]?.word.trim();
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '回答正确！' });
            correctAudioRef.current?.play();
            setTimeout(() => setShowBack(true), 200);
          } else {
            setFeedback({ status: 'incorrect', message: '再试一次' });
            incorrectAudioRef.current?.play();
          }
        };
        speechRecognitionRef.current = recognition;
      } else { console.warn("此浏览器不支持语音识别功能。"); }
    }
  }, [lang, correctSoundUrl, incorrectSoundUrl, displayFlashcards, currentIndex]);


  // --- 交互逻辑 (来自 v5，并增加了语音状态重置) ---
  const handleToggleBack = useCallback(() => setShowBack((prev) => !prev), []);

  const changeCard = (newIndex) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setShowBack(false);
    // 新增：切换卡片时重置语音状态
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
    }
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 200);
  };

  const handleNext = useCallback(() => changeCard((currentIndex + 1) % displayFlashcards.length), [currentIndex, displayFlashcards.length, isTransitioning]);
  const handlePrev = useCallback(() => changeCard((currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length), [currentIndex, displayFlashcards.length, isTransitioning]);

  // 新增：处理语音识别按钮点击
  const handleListen = useCallback(() => {
    if (isListening || !speechRecognitionRef.current) return;
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    speechRecognitionRef.current.start();
  }, [isListening]);

  // 键盘事件监听 (增加了语音快捷键 'm')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggleBack();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleListen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleToggleBack, handleListen, displayFlashcards.length]);

  // --- 渲染部分 ---
  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length] || '';

  const feedbackBorderColor = () => {
    switch (feedback.status) {
      case 'correct': return 'border-green-500';
      case 'incorrect': return 'border-red-500';
      case 'listening': return 'border-blue-500';
      default: return 'border-gray-300 dark:border-gray-600';
    }
  };

  if (!currentCard) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700">
        <p className="text-lg font-semibold text-center text-gray-600 dark:text-gray-300">没有卡片数据。请检查 Notion 代码块。 </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800 dark:text-gray-100 text-center">
        {questionTitle}
      </h3>

      <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl my-4 touch-action-pan-y" style={{ height: '550px', maxWidth: '700px', margin: '0 auto' }}>
        {/* 背景图层 (来自 v5，确保能工作) */}
        <div
          className="absolute inset-0 z-0 transition-opacity duration-500"
          style={{
            backgroundImage: `url('${currentBackgroundImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: isTransitioning ? 0 : 1,
          }}
        >
          <div className="absolute inset-0 bg-black opacity-40"></div>
        </div>
        
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 sm:p-8 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-grow-[1]"></div>
            <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 w-12 h-12" />
            </p>
            <div className="flex-grow-[1.5]"></div>
          </div>

          {/* 背面 (已添加新字段) */}
          <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            <div onClick={e => e.stopPropagation()} className="w-full h-full max-h-full overflow-y-auto custom-scrollbar p-4 text-center bg-black bg-opacity-30 rounded-lg backdrop-blur-md border border-white/20">
              <div className="space-y-3">
                <h4 className="text-2xl sm:text-3xl font-extrabold flex items-center justify-center leading-tight drop-shadow-md">
                  {currentCard.word}
                  <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-3 w-8 h-8" />
                </h4>
                
                {currentCard.pinyin && <p className="text-lg sm:text-xl flex items-center justify-center drop-shadow-sm text-yellow-300"><span className="font-semibold mr-2 text-white">拼音:</span>{currentCard.pinyin}<TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 w-6 h-6" /></p>}
                {currentCard.partOfSpeech && <p className="text-base sm:text-lg flex items-center justify-center drop-shadow-sm text-green-300"><span className="font-semibold mr-2 text-white">词性:</span>{currentCard.partOfSpeech}</p>}
                {currentCard.homophone && <p className="text-base sm:text-lg flex items-center justify-center drop-shadow-sm text-cyan-300"><span className="font-semibold mr-2 text-white">谐音:</span>{currentCard.homophone}</p>}
                <p className="text-lg sm:text-xl flex items-center justify-center drop-shadow-sm"><span className="font-semibold mr-2">释义:</span>{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 w-6 h-6" /></p>
                
                {currentCard.example1 && <div className="mt-4 pt-3 border-t border-white/20 text-left"><p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2 shrink-0">例句1:</span>{currentCard.example1}<TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 shrink-0 w-5 h-5" /></p>{currentCard.example1Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80 mt-1"><span className="font-semibold mr-2 shrink-0">翻译:</span>{currentCard.example1Translation}</p>}</div>}
                {currentCard.example2 && <div className="mt-2 text-left"><p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2 shrink-0">例句2:</span>{currentCard.example2}<TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 shrink-0 w-5 h-5" /></p>{currentCard.example2Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80 mt-1"><span className="font-semibold mr-2 shrink-0">翻译:</span>{currentCard.example2Translation}</p>}</div>}
              </div>
            </div>
          </div>
        </div>
        
        {/* 交互覆盖层 (来自 v5) */}
        <div className="absolute inset-0 z-30 grid grid-cols-4 grid-rows-3 pointer-events-none">
          <div className="col-start-2 col-span-2 row-start-3 pointer-events-auto cursor-pointer" onClick={handleToggleBack}></div>
          <div className="col-start-1 row-start-3 pointer-events-auto cursor-pointer" onClick={handlePrev}></div>
          <div className="col-start-4 row-start-3 pointer-events-auto cursor-pointer" onClick={handleNext}></div>
        </div>
      </div>
      
      {/* 新增：语音识别模块 */}
      <div className="flex justify-center items-center w-full max-w-4xl mx-auto mt-6 sm:mt-8 px-4 gap-3 sm:gap-5">
        <div className={`flex-grow h-14 bg-white dark:bg-gray-700 rounded-lg border-2 shadow-md transition-colors duration-300 ${feedbackBorderColor()}`}>
          <input type="text" readOnly value={recognizedText || feedback.message} placeholder="点击麦克风，说出单词 (或按 M 键)" className="w-full h-full bg-transparent text-gray-800 dark:text-gray-200 text-center text-lg placeholder-gray-400 dark:placeholder-gray-500 outline-none"/>
        </div>
        <button onClick={handleListen} disabled={isListening} className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'} text-white text-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`} aria-label="开始语音识别">
          <i className="fas fa-microphone"></i>
        </button>
        <span className="text-gray-600 dark:text-gray-300 text-xl sm:text-2xl font-medium self-center w-20 text-center">{currentIndex + 1} / {displayFlashcards.length}</span>
      </div>
    </div>
  );
};

export default BeiDanCi;
