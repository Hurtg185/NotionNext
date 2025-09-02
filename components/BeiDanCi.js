// /components/BeiDanCi.js - 最终完美版 v6：集成语音识别
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 新增功能：集成语音识别输入和对错判断及音效反馈。
 * 交互模式：左下角“上一个”，右下角“下一个”，中下区域“翻面”。正面新增麦克风按钮用于语音输入。
 */
const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
  correctSoundUrl = 'sounds/correct.mp3', // 新增：正确提示音URL
  incorrectSoundUrl = '/sounds/wrong.mp3', // 新增：错误提示音URL
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);

  // --- 新增：语音识别相关的State ---
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' }); // idle, listening, correct, incorrect
  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);


  // --- Prop 解析和数据初始化 ---
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
  
  useEffect(() => { setInternalIsShuffle(String(isShuffleProp) === 'true'); }, [isShuffleProp]);

  // --- 新增：初始化语音识别和音频对象 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
          // 如果在 onresult 之前就结束了，恢复 idle 状态
          setFeedback(prev => (prev.status === 'listening' ? { status: 'idle', message: '' } : prev));
        };
        
        recognition.onerror = (event) => {
           console.error('Speech recognition error:', event.error);
           setIsListening(false);
           setFeedback({ status: 'error', message: '识别出错' });
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, ''); // 移除常见标点
          setRecognizedText(transcript);
          
          const currentWord = displayFlashcards[currentIndex]?.word.trim();
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '回答正确！' });
            correctAudioRef.current?.play();
          } else {
            setFeedback({ status: 'incorrect', message: '再试一次' });
            incorrectAudioRef.current?.play();
          }
        };
        speechRecognitionRef.current = recognition;
      } else {
        console.warn("此浏览器不支持语音识别功能。");
      }

      // 初始化音频
      if (correctSoundUrl) correctAudioRef.current = new Audio(correctSoundUrl);
      if (incorrectSoundUrl) incorrectAudioRef.current = new Audio(incorrectSoundUrl);
    }
  }, [lang, currentIndex, displayFlashcards, correctSoundUrl, incorrectSoundUrl]);


  // --- 交互逻辑 ---
  const handleToggleBack = useCallback(() => setShowBack((prev) => !prev), []);

  const changeCard = (newIndex) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setShowBack(false);
    // 重置语音识别状态
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    if(speechRecognitionRef.current && isListening) {
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

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggleBack();
      } else if (e.key === 'm' || e.key === 'M') { // 按下 'M' 键开始录音
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

  // 动态计算反馈框的边框颜色
  const feedbackBorderColor = () => {
    switch (feedback.status) {
      case 'correct': return 'border-green-500';
      case 'incorrect': return 'border-red-500';
      case 'listening': return 'border-blue-500';
      default: return 'border-white/30';
    }
  };

  if (!displayFlashcards || displayFlashcards.length === 0) return (
    <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
      <p className="text-lg font-semibold text-center">没有卡片数据。请提供 flashcards 数组。</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl my-4 touch-action-pan-y" style={{ height: '550px', maxWidth: '700px', margin: '0 auto', border: '1px solid var(--border-color-subtle, rgba(0,0,0,0.1))', backgroundColor: 'var(--bg-card-default, #f0f0f0)' }}>
        {/* 背景图层 */}
        <div className="absolute inset-0 z-0 transition-opacity duration-500" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }}>
          <div className="absolute inset-0 bg-black opacity-40"></div>
        </div>
        
        {/* 内容容器 */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 sm:p-8 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-grow-[1]"></div>
            <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <span onClick={e => e.stopPropagation()}>
                <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl drop-shadow-md" />
              </span>
            </p>
            <div className="flex-grow-[1.5] w-full flex flex-col items-center justify-center pt-8">
              {/* --- 新增：语音识别输入区域 --- */}
              <div className="w-full max-w-sm flex items-center gap-3">
                <div className={`flex-grow h-14 bg-black/20 rounded-lg border-2 backdrop-blur-sm transition-colors duration-300 ${feedbackBorderColor()}`}>
                  <input
                    type="text"
                    readOnly
                    value={recognizedText || feedback.message}
                    placeholder="点击麦克风，然后说出单词"
                    className="w-full h-full bg-transparent text-white text-center text-lg placeholder-white/60 outline-none"
                  />
                </div>
                <button 
                  onClick={handleListen} 
                  disabled={isListening}
                  className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'} text-white text-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-white`}
                  aria-label="开始语音识别"
                >
                  <i className="fas fa-microphone"></i>
                </button>
              </div>
            </div>
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            {/* ... 背面代码保持不变 ... */}
            <div onClick={e => e.stopPropagation()} className="w-full h-full max-h-full overflow-y-auto custom-scrollbar p-4 text-center bg-black bg-opacity-20 rounded-lg backdrop-blur-sm">
              <h4 className="text-2xl sm:text-3xl font-extrabold mb-4 flex items-center justify-center leading-tight drop-shadow-md">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-2xl sm:text-3xl drop-shadow-sm" /></h4>
              {currentCard.pinyin && <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm text-yellow-300"><span className="font-semibold mr-2 text-white">拼音:</span>{currentCard.pinyin}<TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 text-lg" /></p>}
              {currentCard.myanmar && <p className="text-lg sm:text-xl mb-2 flex items-center justify-center font-myanmar drop-shadow-sm text-green-300"><span className="font-semibold mr-2 text-white">缅文:</span>{currentCard.myanmar}<TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="ml-2 text-lg" /></p>}
              <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm"><span className="font-semibold mr-2">释义:</span>{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 text-lg" /></p>
              {currentCard.example1 && <div className="mt-4 text-center"><p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句1:</span>{currentCard.example1}<TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 shrink-0 text-base" /></p>{currentCard.example1Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80"><span className="font-semibold mr-2">翻译:</span>{currentCard.example1Translation}<TextToTspeechButton text={currentCard.example1Translation} lang={lang} className="ml-2 shrink-0 text-sm" /></p>}</div>}
              {currentCard.example2 && <div className="mt-2 text-center"><p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句2:</span>{currentCard.example2}<TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 shrink-0 text-base" /></p>{currentCard.example2Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80"><span className="font-semibold mr-2">翻译:</span>{currentCard.example2Translation}<TextToSpeechButton text={currentCard.example2Translation} lang={lang} className="ml-2 shrink-0 text-sm" /></p>}</div>}
            </div>
          </div>
        </div>
        
        {/* 交互覆盖层 */}
        <div className="absolute inset-0 z-30 grid grid-cols-4 grid-rows-3 pointer-events-none">
          <div className="col-start-2 col-span-2 row-start-3 pointer-events-auto cursor-pointer" onClick={handleToggleBack}></div>
          <div className="col-start-1 row-start-3 pointer-events-auto cursor-pointer" onClick={handlePrev}></div>
          <div className="col-start-4 row-start-3 pointer-events-auto cursor-pointer" onClick={handleNext}></div>
        </div>
      </div>
      
      {/* 底部导航按钮 */}
      <div className="flex justify-between w-full max-w-4xl mx-auto mt-4 sm:mt-8 px-4">
        <button onClick={handlePrev} className="flex items-center px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"><i className="fas fa-arrow-left mr-2"></i> 上一个</button>
        <span className="text-body-color dark:text-dark-7 text-xl sm:text-2xl font-medium self-center">{currentIndex + 1} / {displayFlashcards.length}</span>
        <button onClick={handleNext} className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl">下一个 <i className="fas fa-arrow-right ml-2"></i></button>
      </div>
    </div>
  );
};

export default BeiDanCi;
