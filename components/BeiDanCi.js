// /components/BeiDanCi.js - 最终完美版 v8：融合专业设计与交互逻辑
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 确保此组件存在

/**
 * 背单词卡片组件 (Flashcard)
 * 采用全新JSON传参方式，恢复三区交互，融合玻璃拟态设计，并增加自动翻卡等高级功能。
 */
const BeiDanCi = ({ data: dataProp }) => {
  // --- State 初始化 ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- 从JSON解析的配置State ---
  const [config, setConfig] = useState({
    flashcards: [],
    questionTitle: '背单词',
    lang: 'zh-CN',
    backgroundImages: [],
    isShuffle: false,
    correctSoundUrl: '',
    incorrectSoundUrl: ''
  });
  
  // --- 语音识别State ---
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' });

  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);

  // --- Prop 解析与数据初始化 (全新方式) ---
  useEffect(() => {
    try {
      const parsedData = JSON.parse(dataProp);
      const cards = parsedData.flashcards || [];
      const shuffledCards = String(parsedData.isShuffle) === 'true'
        ? [...cards].sort(() => Math.random() - 0.5)
        : cards;
      
      setConfig({
        ...parsedData,
        flashcards: shuffledCards
      });

      setCurrentIndex(0);
      setShowBack(false);

    } catch (e) {
      console.error("Error parsing component data JSON string:", e);
      setConfig(prev => ({...prev, flashcards: []}));
    }
  }, [dataProp]);

  // --- 初始化语音识别和音频对象 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { lang, correctSoundUrl, incorrectSoundUrl, flashcards } = config;

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
          if (feedback.status === 'listening') {
             setFeedback({ status: 'idle', message: '' });
          }
        };
        recognition.onerror = (event) => {
           console.error('Speech recognition error:', event.error);
           setIsListening(false);
           setFeedback({ status: 'error', message: '识别出错' });
        };
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
          setRecognizedText(transcript);
          const currentWord = flashcards[currentIndex]?.word.trim();
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '回答正确！' });
            correctAudioRef.current?.play();
            setShowBack(true); // 新增：答对自动翻面！
          } else {
            setFeedback({ status: 'incorrect', message: '再试一次' });
            incorrectAudioRef.current?.play();
          }
        };
        speechRecognitionRef.current = recognition;
      } else { console.warn("此浏览器不支持语音识别功能。"); }

      // 初始化音频
      if (correctSoundUrl) correctAudioRef.current = new Audio(correctSoundUrl);
      if (incorrectSoundUrl) incorrectAudioRef.current = new Audio(incorrectSoundUrl);
    }
  }, [config.lang, config.correctSoundUrl, config.incorrectSoundUrl, config.flashcards, currentIndex, feedback.status]);


  // --- 交互逻辑 ---
  const handleToggleBack = useCallback(() => setShowBack(prev => !prev), []);

  const changeCard = (newIndex) => {
    if (isTransitioning || config.flashcards.length === 0) return;
    setIsTransitioning(true);
    setShowBack(false);
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

  const handleNext = useCallback(() => changeCard((currentIndex + 1) % config.flashcards.length), [currentIndex, config.flashcards.length, isTransitioning]);
  const handlePrev = useCallback(() => changeCard((currentIndex - 1 + config.flashcards.length) % config.flashcards.length), [currentIndex, config.flashcards.length, isTransitioning]);
  const handleListen = useCallback(() => {
    if (isListening || !speechRecognitionRef.current) return;
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    speechRecognitionRef.current.start();
  }, [isListening]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (config.flashcards.length === 0 || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggleBack(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); handleListen(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleToggleBack, handleListen, config.flashcards.length]);
  
  // --- 渲染部分 ---
  const currentCard = config.flashcards[currentIndex];
  const currentBackgroundImage = config.backgroundImages[currentIndex % config.backgroundImages.length] || '';
  const feedbackBorderColor = () => {
    switch (feedback.status) {
      case 'correct': return 'border-green-500';
      case 'incorrect': return 'border-red-500';
      case 'listening': return 'border-blue-500';
      default: return 'border-gray-300 dark:border-gray-600';
    }
  };

  if (!currentCard) return (
    <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-lg border dark:border-dark-3"><p className="text-center">正在加载或没有卡片数据...</p></div>
  );

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">{config.questionTitle}</h3>

      <div className="relative w-full overflow-hidden rounded-2xl shadow-xl my-4 touch-action-pan-y" style={{ height: '550px', maxWidth: '700px', margin: '0 auto' }}>
        {/* 背景图层 */}
        <div className="absolute inset-0 z-0 transition-opacity duration-500" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }}>
          <div className="absolute inset-0 bg-black opacity-30"></div> {/* 降低暗度 */}
        </div>
        
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={config.lang} className="ml-4 text-4xl sm:text-5xl drop-shadow-md" />
            </p>
            {currentCard.pinyin && <p className="text-xl sm:text-2xl text-white/80 mt-2 font-light select-none drop-shadow-md">{currentCard.pinyin}</p>}
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            {/* 关键：给内容容器添加事件阻止，防止点击内容时翻卡 */}
            <div onClick={e => e.stopPropagation()} className="w-full h-full max-h-full flex flex-col justify-center overflow-y-auto custom-scrollbar p-4 text-center bg-black/25 rounded-lg backdrop-blur-md">
                <div className="space-y-4"> {/* 使用space-y来控制间距 */}
                    <h4 className="text-3xl sm:text-4xl font-extrabold flex items-center justify-center drop-shadow-md">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={config.lang} className="ml-4 text-3xl"/></h4>
                    {currentCard.pinyin && <p className="text-xl sm:text-2xl flex items-center justify-center drop-shadow-sm text-yellow-300"><span className="font-semibold mr-2 text-white">拼音:</span>{currentCard.pinyin}<TextToSpeechButton text={currentCard.pinyin} lang={config.lang} className="ml-2"/></p>}
                    {currentCard.meaning && <p className="text-xl sm:text-2xl flex items-center justify-center drop-shadow-sm"><span className="font-semibold mr-2">释义:</span>{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={config.lang} className="ml-2"/></p>}
                    {currentCard.example && <div className="mt-4 pt-4 border-t border-white/20"><p className="text-lg sm:text-xl italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句:</span>{currentCard.example}<TextToSpeechButton text={currentCard.example} lang={config.lang} className="ml-2 shrink-0"/></p>{currentCard.exampleTranslation && <p className="text-base sm:text-lg flex items-start justify-center drop-shadow-sm opacity-80 mt-2"><span className="font-semibold mr-2">翻译:</span>{currentCard.exampleTranslation}<TextToSpeechButton text={currentCard.exampleTranslation} lang={config.lang} className="ml-2 shrink-0"/></p>}</div>}
                </div>
            </div>
          </div>
        </div>
        
        {/* 恢复：交互覆盖层 (左下、右下、中下区域) */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 z-20 grid grid-cols-5 pointer-events-none">
          <div className="col-span-1 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
          <div className="col-span-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleToggleBack(); }}></div>
          <div className="col-span-1 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>
        </div>
      </div>
      
      {/* 语音识别和进度显示模块 */}
      <div className="flex justify-center items-center w-full max-w-4xl mx-auto mt-6 sm:mt-8 px-4 gap-3 sm:gap-5">
        <div className={`flex-grow h-14 bg-white dark:bg-dark-6 rounded-lg border-2 shadow-md transition-colors duration-300 ${feedbackBorderColor()}`}>
          <input type="text" readOnly value={recognizedText || feedback.message} placeholder="点击麦克风，说出单词" className="w-full h-full bg-transparent text-body-color dark:text-dark-7 text-center text-lg placeholder-gray-400 dark:placeholder-gray-500 outline-none"/>
        </div>
        <button onClick={handleListen} disabled={isListening} className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-primary hover:bg-blue-dark'} text-white text-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`} aria-label="开始语音识别">
          <i className="fas fa-microphone"></i>
        </button>
        <span className="text-body-color dark:text-dark-7 text-xl sm:text-2xl font-medium self-center w-20 text-center">{currentIndex + 1} / {config.flashcards.length}</span>
      </div>
    </div>
  );
};

export default BeiDanCi;
