// /components/BeiDanCi.js - 最终稳定版 v3：优化布局，修复交互冲突
import React, { useState, useEffect, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 交互模式：点击卡片显示详情，点击详情背景隐藏详情，点击详情内容不隐藏。
 * 动画：使用纯 CSS 过渡实现平滑的淡入淡出和位移动画。
 * 数据源：支持从 `!include` 语句中接收 JSON 字符串。
 *
 * @param {Array<Object>|string} flashcards - 单词卡片数据数组，或其 JSON 字符串表示。
 * @param {string} questionTitle - 组件标题。
 * @param {string} lang - 朗读语言，默认为 'zh-CN'。
 * @param {Array<string>|string} backgroundImages - 背景图片URL数组，或其 JSON 字符串表示。
 * @param {boolean|string} isShuffle - 是否随机排序。
 */
const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false); // 控制背面信息显示/隐藏
  const [isTransitioning, setIsTransitioning] = useState(false); // 用于卡片切换动画的状态

  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);

  // --- Prop 解析和数据初始化 ---
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try { cards = JSON.parse(flashcardsProp); } catch (e) { console.error("Error parsing flashcards JSON string:", e); cards = []; }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }

    if (!cards || cards.length === 0) {
      setDisplayFlashcards([]);
      setCurrentIndex(0);
      setShowBack(false);
      return;
    }

    if (internalIsShuffle) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setDisplayFlashcards(shuffled);
    } else {
      setDisplayFlashcards([...cards]);
    }
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

  // --- 交互逻辑 ---
  const handleShowBack = useCallback(() => {
    if (!showBack) setShowBack(true);
  }, [showBack]);

  const handleHideBack = useCallback(() => {
    if (showBack) setShowBack(false);
  }, [showBack]);
  
  const changeCard = (newIndex) => {
    if (isTransitioning) return; // 防止动画期间重复点击
    setIsTransitioning(true);
    setShowBack(false);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 200); // 匹配淡出动画时间
  };

  const handleNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % displayFlashcards.length;
    changeCard(newIndex);
  }, [currentIndex, displayFlashcards.length, isTransitioning]);

  const handlePrev = useCallback(() => {
    const newIndex = (currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length;
    changeCard(newIndex);
  }, [currentIndex, displayFlashcards.length, isTransitioning]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setShowBack(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, displayFlashcards.length]);
  
  // --- 渲染部分 ---
  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length];

  if (!displayFlashcards || displayFlashcards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
        <p className="text-lg font-semibold text-center">没有卡片数据。请提供 flashcards 数组。</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      <div
        onClick={handleShowBack} // 点击卡片任何地方都会尝试显示背面
        className="relative w-full overflow-hidden rounded-2xl shadow-2xl my-4 touch-action-pan-y cursor-pointer"
        style={{
          height: '550px',
          maxWidth: '700px',
          margin: '0 auto',
          border: '1px solid var(--border-color-subtle, rgba(0,0,0,0.1))',
          backgroundColor: 'var(--bg-card-default, #f0f0f0)',
        }}
      >
        {/* 背景图层 */}
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
        
        {/* 图钉装饰 */}
        <div className="absolute top-4 right-4 text-4xl transform -rotate-45 opacity-80 z-20">
          📌
        </div>

        {/* 内容容器 */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面：大中文单词 */}
          <div className={`w-full h-full p-6 sm:p-8 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {/* 占位符，把单词往下推 */}
            <div className="flex-grow-[1]"></div>
            <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <span onClick={e => e.stopPropagation()}>
                <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl drop-shadow-md" />
              </span>
            </p>
            {/* 占位符，与上面的对称 */}
            <div className="flex-grow-[1.5]"></div>
          </div>

          {/* 背面：所有详细信息 */}
          <div
            onClick={handleHideBack} // 点击背面背景会隐藏
            className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center transition-opacity duration-300 ease-in-out ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}
          >
            {/* 内容盒子，点击它不会隐藏 */}
            <div 
              onClick={e => e.stopPropagation()}
              className="w-full h-full max-h-full overflow-y-auto custom-scrollbar p-4 text-center bg-black bg-opacity-20 rounded-lg backdrop-blur-sm"
            >
              <h4 className="text-2xl sm:text-3xl font-extrabold mb-4 flex items-center justify-center leading-tight drop-shadow-md">
                {currentCard.word}
                <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-2xl sm:text-3xl drop-shadow-sm" />
              </h4>
              
              {currentCard.pinyin && <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm text-yellow-300">
                <span className="font-semibold mr-2 text-white">拼音:</span>{currentCard.pinyin}
                <TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 text-lg" />
              </p>}
              
              {currentCard.myanmar && <p className="text-lg sm:text-xl mb-2 flex items-center justify-center font-myanmar drop-shadow-sm text-green-300">
                <span className="font-semibold mr-2 text-white">缅文:</span>{currentCard.myanmar}
                <TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="ml-2 text-lg" />
              </p>}
              
              <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm">
                <span className="font-semibold mr-2">释义:</span>{currentCard.meaning}
                <TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 text-lg" />
              </p>
              
              {currentCard.example1 && <div className="mt-4 text-center"><p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句1:</span>{currentCard.example1}<TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 shrink-0 text-base" /></p>{currentCard.example1Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80"><span className="font-semibold mr-2">翻译:</span>{currentCard.example1Translation}<TextToSpeechButton text={currentCard.example1Translation} lang={lang} className="ml-2 shrink-0 text-sm" /></p>}</div>}
              
              {currentCard.example2 && <div className="mt-2 text-center"><p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句2:</span>{currentCard.example2}<TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 shrink-0 text-base" /></p>{currentCard.example2Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80"><span className="font-semibold mr-2">翻译:</span>{currentCard.example2Translation}<TextToSpeechButton text={currentCard.example2Translation} lang={lang} className="ml-2 shrink-0 text-sm" /></p>}</div>}
            </div>
          </div>
        </div>
      </div>
      
      {/* 底部导航按钮 */}
      <div className="flex justify-between w-full max-w-4xl mx-auto mt-4 sm:mt-8 px-4">
        <button onClick={handlePrev} className="flex items-center px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl">
          <i className="fas fa-arrow-left mr-2"></i> 上一个
        </button>
        <span className="text-body-color dark:text-dark-7 text-xl sm:text-2xl font-medium self-center">
          {currentIndex + 1} / {displayFlashcards.length}
        </span>
        <button onClick={handleNext} className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl">
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
