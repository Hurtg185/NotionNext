// /components/BeiDanCi.js - 最终稳定版：区域点击交互，滑动移除动画，样式优化
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // 导入 Framer Motion
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 交互模式：左侧1/4区域点击“上一个”，右侧1/4区域点击“下一个”，中间区域点击显示/隐藏详情。
 * 动画：单词切换时有滑动移除效果，显示/隐藏详情也有平滑动画。
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
  const [showBack, setShowBack] = useState(false);
  const [direction, setDirection] = useState(0); // 动画方向：1=下一个, -1=上一个

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
  const handleToggleBack = useCallback(() => setShowBack((prev) => !prev), []);

  const paginate = (newDirection) => {
    setShowBack(false);
    setDirection(newDirection);
    if (newDirection > 0) {
      setCurrentIndex((prev) => (prev + 1) % displayFlashcards.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + displayFlashcards.length) % displayFlashcards.length);
    }
  };

  const handleNext = () => paginate(1);
  const handlePrev = () => paginate(-1);

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

  // Framer Motion 动画变体 (方案一：卡片堆叠/滑动移除)
  const cardVariants = {
    enter: (direction) => {
      return {
        x: direction > 0 ? 300 : -300, // 从侧面滑入
        opacity: 0,
        scale: 0.9,
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.6, 0.05, -0.01, 0.9],
      },
    },
    exit: (direction) => {
      return {
        zIndex: 0,
        x: direction < 0 ? 300 : -300, // 向相反方向滑出
        opacity: 0,
        scale: 0.9,
        transition: {
          duration: 0.3,
          ease: [0.6, 0.05, -0.01, 0.9],
        },
      };
    },
  };

  if (!displayFlashcards || displayFlashcards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
        <p className="text-lg font-semibold text-center">没有卡片数据。请提供 flashcards 数组。</p>
      </div>
    );
  }

  // 封装一个函数来处理朗读按钮的点击事件
  const handleTtsClick = (e) => {
    e.stopPropagation(); // 关键：阻止事件冒泡到父元素
  };

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      <div
        className="relative w-full overflow-hidden rounded-2xl shadow-2xl my-4 touch-action-pan-y"
        style={{
          height: '500px',
          maxWidth: '700px',
          margin: '0 auto',
          border: '1px solid var(--border-color-subtle, rgba(0,0,0,0.1))',
          backgroundColor: 'var(--bg-card-default, #f0f0f0)',
        }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={`bg-${currentIndex}`}
            className="absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }}
            style={{
              backgroundImage: `url('${currentBackgroundImage}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black opacity-40"></div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center z-20 text-white"
          >
            {/* 正面：大中文单词 */}
            <motion.div
              className="text-center"
              animate={{ opacity: showBack ? 0 : 1, y: showBack ? -20 : 0 }}
              transition={{ duration: 0.3 }}
              style={{ pointerEvents: showBack ? 'none' : 'auto' }}
            >
              <p className="text-5xl sm:text-7xl font-bold leading-tight select-none flex items-center drop-shadow-lg">
                {currentCard.word}
                <span onClick={handleTtsClick} className="inline-block ml-4">
                  <TextToSpeechButton text={currentCard.word} lang={lang} className="text-4xl sm:text-5xl drop-shadow-md" />
                </span>
              </p>
            </motion.div>

            {/* 背面：所有详细信息 */}
            <motion.div
              className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center items-center rounded-xl"
              initial={false}
              animate={{ opacity: showBack ? 1 : 0, y: showBack ? 0 : 20 }}
              transition={{ duration: 0.3 }}
              style={{ pointerEvents: showBack ? 'auto' : 'none' }}
            >
              <div className="w-full h-full max-h-full overflow-y-auto custom-scrollbar p-2 text-center">
                <h4 className="text-2xl sm:text-3xl font-extrabold mb-4 flex items-center justify-center leading-tight drop-shadow-md">
                  {currentCard.word}
                  <span onClick={handleTtsClick} className="inline-block ml-4">
                    <TextToSpeechButton text={currentCard.word} lang={lang} className="text-2xl sm:text-3xl drop-shadow-sm" />
                  </span>
                </h4>
                {currentCard.pinyin && <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm">
                  <span className="font-semibold mr-2">拼音:</span>{currentCard.pinyin}
                  <span onClick={handleTtsClick} className="inline-block ml-2">
                    <TextToSpeechButton text={currentCard.pinyin} lang={lang} className="text-lg" />
                  </span>
                </p>}
                {currentCard.myanmar && <p className="text-lg sm:text-xl mb-2 flex items-center justify-center font-myanmar drop-shadow-sm">
                  <span className="font-semibold mr-2">缅文:</span>{currentCard.myanmar}
                  <span onClick={handleTtsClick} className="inline-block ml-2">
                    <TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="text-lg" />
                  </span>
                </p>}
                <p className="text-lg sm:text-xl mb-2 flex items-center justify-center drop-shadow-sm">
                  <span className="font-semibold mr-2">释义:</span>{currentCard.meaning}
                  <span onClick={handleTtsClick} className="inline-block ml-2">
                    <TextToSpeechButton text={currentCard.meaning} lang={lang} className="text-lg" />
                  </span>
                </p>
                {currentCard.example1 && <div className="mt-4 text-center">
                  <p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm">
                    <span className="font-semibold not-italic mr-2">例句1:</span>{currentCard.example1}
                    <span onClick={handleTtsClick} className="inline-block ml-2 shrink-0">
                      <TextToSpeechButton text={currentCard.example1} lang={lang} className="text-base" />
                    </span>
                  </p>
                  {currentCard.example1Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80">
                    <span className="font-semibold mr-2">翻译:</span>{currentCard.example1Translation}
                    <span onClick={handleTtsClick} className="inline-block ml-2 shrink-0">
                      <TextToSpeechButton text={currentCard.example1Translation} lang={lang} className="text-sm" />
                    </span>
                  </p>}
                </div>}
                {currentCard.example2 && <div className="mt-2 text-center">
                  <p className="text-base sm:text-lg italic flex items-start justify-center drop-shadow-sm">
                    <span className="font-semibold not-italic mr-2">例句2:</span>{currentCard.example2}
                    <span onClick={handleTtsClick} className="inline-block ml-2 shrink-0">
                      <TextToSpeechButton text={currentCard.example2} lang={lang} className="text-base" />
                    </span>
                  </p>
                  {currentCard.example2Translation && <p className="text-sm sm:text-base flex items-start justify-center drop-shadow-sm opacity-80">
                    <span className="font-semibold mr-2">翻译:</span>{currentCard.example2Translation}
                    <span onClick={handleTtsClick} className="inline-block ml-2 shrink-0">
                      <TextToSpeechButton text={currentCard.example2Translation} lang={lang} className="text-sm" />
                    </span>
                  </p>}
                </div>}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* 交互覆盖层 */}
        <div className="absolute inset-0 z-30 flex">
          <div className="w-1/4 h-full cursor-pointer" onClick={handlePrev}></div>
          <div className="w-1/2 h-full cursor-pointer" onClick={handleToggleBack}></div>
          <div className="w-1/4 h-full cursor-pointer" onClick={handleNext}></div>
        </div>
      </div>

      {/* 底部导航按钮和卡片计数 */}
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
