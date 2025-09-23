import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton';
// 【已移除】 PronunciationChecker 子组件

const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
  // 移除了用不到的 correct/incorrect 声音
  flipSoundUrl = '/sounds/flip.mp3',
  changeCardSoundUrl = '/sounds/fanshu.mp3'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 【已移除】 发音检查相关的 state
  
  const flipAudioRef = useRef(null);
  const changeCardAudioRef = useRef(null);

  // 初始化卡片数据
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

  // 初始化背景图片
  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try { images = JSON.parse(backgroundImagesProp); } catch (e) { console.error("Error parsing images", e); images = []; }
    } else if (Array.isArray(backgroundImagesProp)) { images = backgroundImagesProp; }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);

  // 初始化是否乱序
  useEffect(() => {
    setInternalIsShuffle(String(isShuffleProp) === 'true');
  }, [isShuffleProp]);
  
  // 【已简化】 useEffect，只初始化所需的声音文件
  useEffect(() => {
    if (typeof window !== 'undefined') {
      flipAudioRef.current = new Audio(flipSoundUrl);
      changeCardAudioRef.current = new Audio(changeCardSoundUrl);
    }
  }, [flipSoundUrl, changeCardSoundUrl]);


  const handleToggleBack = useCallback((e) => {
    e.stopPropagation();
    if (!showBack) {
      flipAudioRef.current?.play();
      setShowBack(true);
    }
  }, [showBack]);

  const changeCard = (newIndex) => {
    if (isTransitioning || displayFlashcards.length === 0) return;
    changeCardAudioRef.current?.play();
    setIsTransitioning(true);
    setShowBack(false);
    // 【已移除】 发音检查相关的状态重置
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 300);
  };

  const handleNext = useCallback((e) => {
    e?.stopPropagation();
    changeCard((currentIndex + 1) % displayFlashcards.length);
  }, [currentIndex, displayFlashcards.length, changeCard]);

  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    changeCard((currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length);
  }, [currentIndex, displayFlashcards.length, changeCard]);
  
  // 【已移除】 handleListen 函数
  
  const handleJump = useCallback((index) => {
    changeCard(index);
    setIsModalOpen(false);
  }, [changeCard]);

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
        className={`relative w-full overflow-hidden rounded-3xl shadow-2xl my-4 transition-all duration-500`} // 【已简化】 移除了 cardFeedbackClass
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
          <div className={`absolute inset-0 w-full h-full p-6 flex flex-col items-center justify-center text-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-grow"></div>
            <p className="text-6xl sm:text-8xl font-bold text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              {/* 朗读按钮被保留 */}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 w-12 h-12 text-3xl" />
            </p>
            <div className="h-8 mt-4"></div>
            <div className="flex-grow"></div>
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            <div className="w-full h-full max-h-full p-6 bg-black/30 rounded-2xl border border-white/10 backdrop-blur-sm overflow-y-auto">
              <div className="w-full max-w-sm mx-auto text-left">
                <div className="space-y-3">
                  <h4 className="text-4xl font-bold flex items-center">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="ml-3 w-9 h-9 text-2xl" /></h4>
                  {currentCard.pinyin && <p className="text-xl text-yellow-300">{currentCard.pinyin}</p>}
                  {currentCard.meaning && <p className="text-xl font-semibold">{currentCard.meaning}</p>}
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
        
        {/* 【已移除】 麦克风按钮 */}
      </div>
      
      {/* 【已移除】 发音分析器 */}
    </div>
  );
};

export default BeiDanCi;
