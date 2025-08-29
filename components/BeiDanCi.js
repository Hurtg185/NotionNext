// /components/BeiDanCi.js - 最终版：区域点击交互，淡入淡出动画，样式优化
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // 导入 Framer Motion 以实现流畅动画
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 交互模式：左侧1/3区域点击“上一个”，右侧1/3区域点击“下一个”，中间区域点击显示/隐藏详情。
 * 动画：单词切换时有淡入淡出效果，显示/隐藏详情也有平滑动画。
 * 数据源：支持从 `!include` 语句中接收 JSON 字符串。
 *
 * @param {Array<Object>|string} flashcards - 单词卡片数据数组，或其 JSON 字符串表示。
 * @param {string} questionTitle - 组件标题。
 * @param {string} lang - 朗读语言，默认为 'zh-CN'。
 * @param {Array<string>|string} backgroundImages - 背景图片URL数组，或其 JSON 字符串表示。
 * @param {boolean|string} isShuffle - 是否随机排序。可以为布尔值或 "true"/"false" 字符串。
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
  const [direction, setDirection] = useState(0); // 动画方向：0=初始, 1=下一个, -1=上一个

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
    if (typeof isShuffleProp === 'string') {
      setInternalIsShuffle(isShuffleProp === 'true');
    } else {
      setInternalIsShuffle(!!isShuffleProp);
    }
  }, [isShuffleProp]);

  // --- 交互逻辑 ---

  const handleToggleBack = useCallback(() => {
    setShowBack((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1); // 设置动画方向为“下一个”
    setShowBack(false);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
  }, [displayFlashcards.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1); // 设置动画方向为“上一个”
    setShowBack(false);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + displayFlashcards.length) % displayFlashcards.length);
  }, [displayFlashcards.length]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleToggleBack, displayFlashcards.length]);

  // --- 渲染部分 ---

  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length];

  // Framer Motion 动画变体
  const cardVariants = {
    enter: { opacity: 1, scale: 1, x: 0 },
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: direction => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100, // 根据方向决定滑出位置
      opacity: 0,
      scale: 0.95
    }),
  };

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

      {/* 卡片主体容器 */}
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-2xl my-4"
        style={{
          height: '500px',
          maxWidth: '700px',
          margin: '0 auto',
          border: '1px solid var(--border-color-subtle, rgba(0,0,0,0.1))',
          backgroundColor: 'var(--bg-card-default, #f0f0f0)',
        }}
      >
        {/* 背景图层 */}
        <AnimatePresence initial={false}>
          <motion.div
            key={currentIndex}
            className="absolute inset-0 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.5 } }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            style={{
              backgroundImage: `url('${currentBackgroundImage}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              zIndex: 0,
            }}
          >
            <div className="absolute inset-0 bg-black opacity-30 dark:opacity-50 rounded-xl z-10"></div>
          </motion.div>
        </AnimatePresence>

        {/* 内容动画容器 */}
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8 z-20"
          >
            {/* 正面：大中文单词 - 始终可见 */}
            <div className={`text-center transition-opacity duration-300 ${showBack ? 'opacity-0' : 'opacity-100'}`}>
              <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
                {currentCard.word}
                <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl drop-shadow-md" />
              </p>
            </div>

            {/* 背面：所有详细信息 */}
            <div
              className={`absolute inset-0 p-6 sm:p-8 flex flex-col justify-center items-center rounded-xl transition-opacity duration-300 ease-in-out ${
                showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } text-white`}
            >
              <div className="w-full h-full max-h-full overflow-y-auto custom-scrollbar p-2">
                <h4 className="text-2xl sm:text-3xl font-extrabold text-center mb-4 flex items-center justify-center leading-tight drop-shadow-md">
                  {currentCard.word}
                  <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-2xl sm:text-3xl drop-shadow-sm" />
                </h4>
                {currentCard.pinyin && (
                  <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm">
                    <span className="font-semibold mr-2">拼音:</span>{currentCard.pinyin}
                    <TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 text-lg" />
                  </p>
                )}
                {/* ... 其他背面信息 ... */}
                 {currentCard.myanmar && (
                  <p className="text-lg sm:text-xl mb-2 flex items-center justify-center font-myanmar drop-shadow-sm">
                    <span className="font-semibold mr-2">缅文:</span>{currentCard.myanmar}
                    <TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="ml-2 text-lg" />
                  </p>
                )}
                <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm">
                  <span className="font-semibold mr-2">释义:</span>{currentCard.meaning}
                  <TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 text-lg" />
                </p>
                {currentCard.example1 && (
                  <div className="mt-4 text-center">
                    <p className="text-base sm:text-lg italic drop-shadow-sm">
                      <span className="font-semibold not-italic mr-2">例句1:</span>{currentCard.example1}
                      <TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 text-base" />
                    </p>
                    {currentCard.example1Translation && (
                      <p className="text-sm sm:text-base drop-shadow-sm opacity-80">
                        <span className="font-semibold mr-2">翻译:</span>{currentCard.example1Translation}
                        <TextToSpeechButton text={currentCard.example1Translation} lang={lang} className="ml-2 text-sm" />
                      </p>
                    )}
                  </div>
                )}
                {currentCard.example2 && (
                   <div className="mt-2 text-center">
                    <p className="text-base sm:text-lg italic drop-shadow-sm">
                      <span className="font-semibold not-italic mr-2">例句2:</span>{currentCard.example2}
                      <TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 text-base" />
                    </p>
                    {currentCard.example2Translation && (
                      <p className="text-sm sm:text-base drop-shadow-sm opacity-80">
                        <span className="font-semibold mr-2">翻译:</span>{currentCard.example2Translation}
                        <TextToSpeechButton text={currentCard.example2Translation} lang={lang} className="ml-2 text-sm" />
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* 交互覆盖层 */}
        <div className="absolute inset-0 z-30 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={handlePrev}></div>
          <div className="w-1/3 h-full cursor-pointer" onClick={handleToggleBack}></div>
          <div className="w-1/3 h-full cursor-pointer" onClick={handleNext}></div>
        </div>
      </div>
      
      {/* 底部导航按钮和卡片计数 */}
      <div className="flex justify-between w-full max-w-5xl mx-auto mt-4 sm:mt-8 px-4">
        <button
          onClick={handlePrev}
          className="flex items-center px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          <i className="fas fa-arrow-left mr-2"></i> 上一个
        </button>
        <span className="text-body-color dark:text-dark-7 text-xl sm:text-2xl font-medium self-center">
          {currentIndex + 1} / {displayFlashcards.length}
        </span>
        <button
          onClick={handleNext}
          className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
