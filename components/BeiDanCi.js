// /components/BeiDanCi.js - 终极设计版 v16 (基于v5，融合全新设计)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件
import JumpToCardModal from './JumpToCardModal'; // 导入跳转组件

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
  const [isModalOpen, setIsModalOpen] = useState(false); // 控制跳转弹窗

  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);
  
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
        recognition.continuous = false;
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.onstart = () => {
          setIsListening(true);
          setFeedback({ status: 'listening', message: '' });
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setFeedback({ status: 'error', message: '识别出错' });
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
          setRecognizedText(transcript);
          const currentWord = displayFlashcards[currentIndex]?.word.trim();
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '正确' });
            correctAudioRef.current?.play();
            setTimeout(() => setShowBack(true), 200);
          } else {
            setFeedback({ status: 'incorrect', message: '错误' });
            incorrectAudioRef.current?.play();
          }
        };
        speechRecognitionRef.current = recognition;
      }
    }
  }, [lang, correctSoundUrl, incorrectSoundUrl, displayFlashcards, currentIndex]);

  // --- 交互逻辑 ---
  const handleToggleBack = () => {
    // 关键：只允许从正面翻到背面 (单向)
    if (!showBack) {
      setShowBack(true);
    }
  };

  const changeCard = (newIndex) => {
    if (isTransitioning) return;
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
    }, 300); // 增加切换动画时长
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
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      {isModalOpen && <JumpToCardModal total={displayFlashcards.length} current={currentIndex} onJump={handleJump} onClose={() => setIsModalOpen(false)} />}
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800 dark:text-gray-100 text-center">{questionTitle}</h3>

      <div 
        className="relative w-full overflow-hidden rounded-3xl shadow-2xl my-4 touch-action-pan-y group"
        style={{ height: '550px', maxWidth: '700px', margin: '0 auto' }}
      >
        {/* 背景图层 */}
        <div className="absolute inset-0 z-0 transition-all duration-500 will-change-transform" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }} />
        {/* 磨砂玻璃效果层 */}
        <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-lg"></div>

        {/* 页码 */}
        <div 
          className="absolute top-4 right-4 z-40 px-3 py-1 bg-black/20 rounded-full text-white text-sm font-semibold cursor-pointer hover:bg-black/40 transition-colors"
          onClick={() => setIsModalOpen(true)}
        >
          {currentIndex + 1} / {displayFlashcards.length}
        </div>
        
        {/* 内容容器 */}
        <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div 
            className={`w-full h-full p-6 flex flex-col items-center justify-center text-center transition-opacity duration-300 cursor-pointer ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            onClick={handleToggleBack}
          >
            <div className="flex-grow"></div>
            <p className="text-6xl sm:text-8xl font-bold text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="w-12 h-12 text-3xl" />
            </p>
            {/* 语音识别结果 */}
            <div className="h-8 mt-4 text-xl font-semibold">
              {feedback.status !== 'idle' && <span className={feedbackColor}>{recognizedText || feedback.message}</span>}
            </div>
            <div className="flex-grow"></div>
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            {/* 叠加的半透明模糊层 */}
            <div className="w-full h-full max-h-full p-6 bg-black/30 rounded-2xl border border-white/10 backdrop-blur-sm overflow-y-auto custom-scrollbar">
              <div className="w-full max-w-sm mx-auto text-left">
                {/* 核心释义区 */}
                <div className="space-y-3">
                  <h4 className="text-4xl font-bold flex items-center">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="w-9 h-9 text-2xl ml-3" /></h4>
                  {currentCard.pinyin && <p className="text-xl text-yellow-300">{currentCard.pinyin}</p>}
                  {currentCard.partOfSpeech && <p className="flex items-center text-base text-gray-300"><i className="fa-solid fa-book-open w-5 text-center mr-2 text-gray-400"></i><span className="font-semibold mr-2">【词性】</span> {currentCard.partOfSpeech}</p>}
                  {currentCard.homophone && <p className="flex items-center text-base text-gray-300"><i className="fa-solid fa-ear-listen w-5 text-center mr-2 text-gray-400"></i><span className="font-semibold mr-2">【谐音】</span> {currentCard.homophone}</p>}
                  {currentCard.meaning && <p className="text-xl font-semibold flex items-center">{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="w-7 h-7 text-lg ml-3" /></p>}
                </div>

                {/* 分割线 */}
                <hr className="my-6 border-white/20" />

                {/* 例句区 */}
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

        {/* 交互按钮层 */}
        <div className="absolute inset-0 z-30 flex items-center justify-between pointer-events-none p-4">
          <button onClick={handlePrev} className="pointer-events-auto w-14 h-14 rounded-full bg-black/10 hover:bg-black/30 text-white flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"><i className="fas fa-chevron-left"></i></button>
          <button onClick={handleNext} className="pointer-events-auto w-14 h-14 rounded-full bg-black/10 hover:bg-black/30 text-white flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"><i className="fas fa-chevron-right"></i></button>
        </div>
        <button onClick={handleListen} disabled={isListening} className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 text-white text-2xl shadow-lg ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500/80 hover:bg-blue-600'}`}><i className="fas fa-microphone"></i></button>
      </div>
    </div>
  );
};

export default BeiDanCi;
