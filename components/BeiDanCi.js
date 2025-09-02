// /components/BeiDanCi.js - 终极代码版 v20 (基于v5，不依赖数据库)
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
  // --- State (来自 v5) ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);

  // --- 新增 State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' });
  const [cardFeedbackClass, setCardFeedbackClass] = useState('');
  const autoAdvanceTimeoutRef = useRef(null);
  
  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);

  // --- Prop 解析和数据初始化 (严格遵循 v5 的稳定结构) ---
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try { cards = JSON.parse(flashcardsProp); } catch (e) { console.error("Error parsing flashcards", e); cards = []; }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }

    if (!cards || cards.length === 0) {
      setDisplayFlashcards([]);
      return;
    }
    
    setDisplayFlashcards(internalIsShuffle ? [...cards].sort(() => Math.random() - 0.5) : cards);
    setCurrentIndex(0);
    setShowBack(false);
  }, [flashcardsProp, internalIsShuffle]);

  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try { images = JSON.parse(backgroundImagesProp); } catch (e) { console.error("Error parsing images", e); images = []; }
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
            setCardFeedbackClass('border-green-500');
            setTimeout(() => setShowBack(true), 200);
            autoAdvanceTimeoutRef.current = setTimeout(handleNext, 4000);
          } else {
            setFeedback({ status: 'incorrect', message: '错误' });
            incorrectAudioRef.current?.play();
            setCardFeedbackClass('border-red-500');
          }
          setTimeout(() => setCardFeedbackClass(''), 1500);
        };
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setFeedback({ status: 'error', message: '出错' });
        speechRecognitionRef.current = recognition;
      }
    }
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, correctSoundUrl, incorrectSoundUrl, displayFlashcards, currentIndex]);

  // --- 交互逻辑 ---
  const handleToggleBack = useCallback(() => { if (!showBack) setShowBack(true); }, [showBack]);

  const changeCard = (newIndex) => {
    if (isTransitioning || displayFlashcards.length === 0) return;
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    
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

  const handleNext = useCallback(() => changeCard((currentIndex + 1) % displayFlashcards.length), [currentIndex, displayFlashcards, isTransitioning]);
  const handlePrev = useCallback(() => changeCard((currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length), [currentIndex, displayFlashcards, isTransitioning]);
  
  const handleListen = useCallback(() => {
    if (isListening || !speechRecognitionRef.current) return;
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    speechRecognitionRef.current.start();
  }, [isListening]);
  
  const handleJump = useCallback((index) => {
    changeCard(index);
    setIsModalOpen(false);
  }, [changeCard]);

  // --- 渲染部分 ---
  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length] || '';
  const feedbackColor = feedback.status === 'correct' ? 'text-green-400' : 'text-red-400';

  if (!currentCard) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700">
        <p className="text-lg font-semibold text-center text-gray-600 dark:text-gray-300">没有卡片数据。请检查 Notion 代码块。</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      {isModalOpen && <JumpToCardModal total={displayFlashcards.length} current={currentIndex} onJump={handleJump} onClose={() => setIsModalOpen(false)} />}
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800 dark:text-gray-100 text-center">{questionTitle}</h3>

      <div 
        className={`relative w-full overflow-hidden rounded-3xl shadow-2xl my-4 transition-all duration-500 border-4 border-transparent ${cardFeedbackClass}`}
        style={{ height: '550px' }} 
      >
        <div className="absolute inset-0 z-0 transition-all duration-500" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }} />
        <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-lg"></div>

        <div 
          className="absolute top-4 right-5 z-40 text-white text-lg font-bold drop-shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          onClick={() => setIsModalOpen(true)}
        >
          {currentIndex + 1}<span className="text-white/50"> / {displayFlashcards.length}</span>
        </div>
        
        <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 flex flex-col items-center justify-center text-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-grow"></div>
            <p className="text-6xl sm:text-8xl font-bold text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="w-12 h-12 text-3xl" />
            </p>
            <div className="h-8 mt-4 text-xl font-semibold">
              {feedback.status !== 'idle' && <span className={feedbackColor}>{recognizedText || feedback.message}</span>}
            </div>
            <div className="flex-grow"></div>
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            <div className="w-full h-full max-h-full p-6 bg-black/30 rounded-2xl border border-white/10 backdrop-blur-sm overflow-y-auto custom-scrollbar">
              <div className="w-full max-w-sm mx-auto text-left">
                <div className="space-y-3">
                  <h4 className="text-4xl font-bold flex items-center">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="w-9 h-9 text-2xl ml-3" /></h4>
                  {currentCard.pinyin && <p className="text-xl text-yellow-300">{currentCard.pinyin}</p>}
                  {currentCard.partOfSpeech && <p className="flex items-center text-base text-gray-300"><i className="fa-solid fa-book-open w-5 text-center mr-2 text-gray-400"></i><span className="font-semibold mr-2">【词性】</span> {currentCard.partOfSpeech}</p>}
                  {currentCard.homophone && <p className="flex items-center text-base text-gray-300"><i className="fa-solid fa-ear-listen w-5 text-center mr-2 text-gray-400"></i><span className="font-semibold mr-2">【谐音】</span> {currentCard.homophone}</p>}
                  {currentCard.meaning && <p className="text-xl font-semibold flex items-center">{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="w-7 h-7 text-lg ml-3" /></p>}
                </div>
                <hr className="my-6 border-white/20" />
                <div className="space-y-4">
                  <p className="flex items-center text-sm text-gray-400 font-semibold"><i className="fa-solid fa-quote-left w-5 text-center mr-2"></i> 【例句】</p>
                  {currentCard.example1 && <div>
                    <p className="text-lg flex items-start"><span className="flex-grow">{currentCard.example1}</span><TextToSpeechButton text={currentCard.example1} lang={lang} className="w-6 h-6 text-base ml-2 shrink-0" /></p>
                    {currentCard.example1Translation && <p className="text-sm text-gray-400 italic mt-1">{currentCard.example1Translation}</p>}
                  </div>}
                  {currentCard.example2 && <div>
                    <p className="text-lg flex items-start"><span className="flex-grow">{currentCard.example2}</span><TextToSpeechButton text={currentCard.example2} lang={lang} className="w-6 h-6 text-base ml-2 shrink-0" /></p>
                    {currentCard.example2Translation && <p className="text-sm text-gray-400 italic mt-1">{currentCard.example2Translation}</p>}
                  </div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 z-30 grid grid-cols-4 grid-rows-3 pointer-events-none">
          <div className="col-span-full row-span-full pointer-events-auto cursor-pointer" onClick={handleToggleBack}></div>
          <div className="col-start-1 row-start-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
          <div className="col-start-4 row-start-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>
        </div>
        
        <button onClick={(e) => { e.stopPropagation(); handleListen(); }} disabled={isListening} className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 text-white text-2xl shadow-lg ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500/80 hover:bg-blue-600'}`}>
            <i className="fas fa-microphone"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
