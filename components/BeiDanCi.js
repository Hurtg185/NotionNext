// /components/BeiDanCi.js - 终极代码版 v26 (修复背面不显示问题，并使用官方CDN)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton';
import JumpToCardModal from './JumpToCardModal';

// --- 发音检查器子组件 (保持稳定版本，包含加载检查) ---
const PronunciationChecker = ({ correctText, studentText }) => {
  const [result, setResult] = useState(null);
  const [isPinyinLibReady, setIsPinyinLibReady] = useState(false);

  useEffect(() => {
    if (typeof window.pinyinPro !== 'undefined') {
      setIsPinyinLibReady(true);
      return;
    }
    const intervalId = setInterval(() => {
      if (typeof window.pinyinPro !== 'undefined') {
        setIsPinyinLibReady(true);
        clearInterval(intervalId);
      }
    }, 200);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isPinyinLibReady) {
      setResult({ message: '拼音库加载中，请稍候...' });
      return;
    }
    if (!studentText || !correctText) {
      setResult(null);
      return;
    }
    const correctPinyin = window.pinyinPro.pinyin(correctText, { toneType: 'symbol' });
    const studentPinyin = window.pinyinPro.pinyin(studentText, { toneType: 'symbol' });
    setResult({
      isCorrect: correctPinyin === studentPinyin,
      correctPinyin,
      studentPinyin,
    });
  }, [correctText, studentText, isPinyinLibReady]);

  if (!result) return null;

  return (
    <div className="w-full p-4 mt-4 border rounded-xl bg-white dark:bg-gray-800 shadow-inner">
      <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">发音分析</h3>
      {result.message ? (
        <p className="mt-2 text-gray-600 dark:text-gray-400">{result.message}</p>
      ) : (
        <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center">
            <span className="font-semibold w-24 inline-block">标准发音:</span>
            <span className="ml-2 font-mono text-lg tracking-wider text-green-600 dark:text-green-400">{result.correctPinyin}</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-24 inline-block">你的发音:</span>
            <span className={`ml-2 font-mono text-lg tracking-wider ${result.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {result.studentPinyin}
            </span>
          </div>
          {!result.isCorrect && (
            <p className="pt-2 text-yellow-600 dark:text-yellow-400">
              请注意红色拼音部分，尝试模仿标准发音再试一次。
            </p>
          )}
        </div>
      )}
    </div>
  );
};


const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
  correctSoundUrl = '/sounds/correct.mp3',
  incorrectSoundUrl = '/sounds/wrong.mp3'
}) => {
  // --- State 和 Refs 保持不变 ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [cardFeedbackClass, setCardFeedbackClass] = useState('');
  const autoAdvanceTimeoutRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);

  // --- Prop 解析和数据初始化 (保持不变) ---
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try { cards = JSON.parse(flashcardsProp); } catch (e) { console.error("Error parsing flashcards", e); cards = []; }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }
    if (!cards || cards.length === 0) { setDisplayFlashcards([]); return; }
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
  
  // --- 语音识别和音频初始化 (保持不变) ---
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
          if (typeof window.pinyinPro !== 'undefined') {
            const correctPinyin = window.pinyinPro.pinyin(currentWord, { toneType: 'symbol' });
            const studentPinyin = window.pinyinPro.pinyin(transcript, { toneType: 'symbol' });
            if (correctPinyin === studentPinyin) {
              correctAudioRef.current?.play();
              setCardFeedbackClass('border-green-500');
              setTimeout(() => setShowBack(true), 200);
              autoAdvanceTimeoutRef.current = setTimeout(handleNext, 4000);
            } else {
              incorrectAudioRef.current?.play();
              setCardFeedbackClass('border-red-500');
            }
          } else {
            console.error("拼音库未加载，降级为文字匹配！");
            if (transcript === currentWord) {
                correctAudioRef.current?.play();
                setCardFeedbackClass('border-green-500');
            } else {
                incorrectAudioRef.current?.play();
                setCardFeedbackClass('border-red-500');
            }
          }
          setTimeout(() => setCardFeedbackClass(''), 1500);
        };
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (e) => console.error('Speech recognition error:', e.error);
        speechRecognitionRef.current = recognition;
      }
    }
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, correctSoundUrl, incorrectSoundUrl, displayFlashcards, currentIndex]);

  // --- 交互逻辑 (保持不变) ---
  const handleToggleBack = useCallback((e) => {
    e.stopPropagation();
    if (!showBack) setShowBack(true);
  }, [showBack]);

  const changeCard = (newIndex) => {
    if (isTransitioning || displayFlashcards.length === 0) return;
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    setIsTransitioning(true);
    setShowBack(false);
    setRecognizedText('');
    setCardFeedbackClass('');
    if (speechRecognitionRef.current && isListening) speechRecognitionRef.current.stop();
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 300);
  };

  const handleNext = useCallback((e) => {
    e?.stopPropagation();
    changeCard((currentIndex + 1) % displayFlashcards.length);
  }, [currentIndex, displayFlashcards.length, isTransitioning]);

  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    changeCard((currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length);
  }, [currentIndex, displayFlashcards.length, isTransitioning]);
  
  const handleListen = useCallback((e) => {
    e.stopPropagation();
    if (isListening || !speechRecognitionRef.current) return;
    setRecognizedText('');
    speechRecognitionRef.current.start();
  }, [isListening]);
  
  const handleJump = useCallback((index) => {
    changeCard(index);
    setIsModalOpen(false);
  }, [changeCard]);

  // --- 渲染部分 (核心修正) ---
  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length] || '';

  if (!currentCard) {
    return (
      <div className="w-full mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700">
        <p className="text-lg font-semibold text-center text-gray-600 dark:text-gray-300">没有卡片数据。请检查 Notion 代码块。</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto my-8 p-4 bg-transparent">
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
        
        {/* --- 核心修正：将正面和背面作为兄弟元素 --- */}
        <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 flex flex-col items-center justify-center text-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-grow"></div>
            <p className="text-6xl sm:text-8xl font-bold text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="w-12 h-12 text-3xl" />
            </p>
            <div className="h-8 mt-4"></div>
            <div className="flex-grow"></div>
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            <div className="w-full h-full max-h-full p-6 bg-black/30 rounded-2xl border border-white/10 backdrop-blur-sm overflow-y-auto">
              <div className="w-full max-w-sm mx-auto text-left">
                <div className="space-y-3">
                  <h4 className="text-4xl font-bold flex items-center">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="w-9 h-9 text-2xl ml-3" /></h4>
                  {currentCard.pinyin && <p className="text-xl text-yellow-300">{currentCard.pinyin}</p>}
                  {currentCard.meaning && <p className="text-xl font-semibold">{currentCard.meaning}</p>}
                  {/* 你可以继续添加其他背面信息 */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 点击区域层 */}
        <div className="absolute inset-0 z-30 grid grid-cols-4 grid-rows-3 pointer-events-none">
          <div className="col-start-2 col-span-2 row-start-3 pointer-events-auto cursor-pointer" onClick={handleToggleBack}></div>
          <div className="col-start-1 row-start-3 pointer-events-auto cursor-pointer" onClick={handlePrev}></div>
          <div className="col-start-4 row-start-3 pointer-events-auto cursor-pointer" onClick={handleNext}></div>
        </div>
        
        {/* 麦克风按钮 */}
        <button onClick={handleListen} disabled={isListening} className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 text-white text-2xl shadow-lg ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500/80 hover:bg-blue-600'}`}>
            <i className="fas fa-microphone"></i>
        </button>
      </div>
      
      {/* 发音分析器 */}
      {recognizedText && <PronunciationChecker correctText={currentCard?.word} studentText={recognizedText} />}
    </div>
  );
};

export default BeiDanCi;
