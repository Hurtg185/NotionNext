// /components/BeiDanCi.js - 恢复 3D 翻转动画、优化背景图、尺寸和美观度
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 作为页面内容的一部分显示，尺寸较大，具有 3D 翻转效果和动画。
 * 点击卡片可翻转到背面，再次点击翻回正面。
 * 支持左右触摸滑动或按钮切换卡片。
 * 支持从 `!include` 语句中接收 JSON 字符串形式的 props。
 *
 * @param {Array<Object>|string} flashcards - 单词卡片数据数组，或其 JSON 字符串表示。
 * @param {string} questionTitle - 组件标题。
 * @param {string} lang - 朗读语言，默认为 'zh-CN'。
 * @param {Array<string>|string} backgroundImages - 背景图片URL数组，或其 JSON 字符串表示。
 *   图片路径应相对于 `public` 文件夹，例如 `"/images/bg.jpg"`。
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
  const [isFlipped, setIsFlipped] = useState(false); // 控制翻转状态
  const [touchStartX, setTouchStartX] = useState(null);

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
      setIsFlipped(false);
      return;
    }

    if (internalIsShuffle) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setDisplayFlashcards(shuffled);
    } else {
      setDisplayFlashcards([...cards]);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
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

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    // 可选：播放翻转音效
  }, []);

  const handleNext = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
    }, 300); // 匹配翻转动画时间 (通常为 300ms)
  }, [displayFlashcards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex(
        (prevIndex) => (prevIndex - 1 + displayFlashcards.length) % displayFlashcards.length
      );
    }, 300); // 匹配翻转动画时间
  }, [displayFlashcards.length]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return;
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, handleFlip, displayFlashcards.length]);

  // 触摸事件
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || displayFlashcards.length === 0) {
      return;
    }
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const SWIPE_THRESHOLD = 50;

    const isCardBodyClick = e.changedTouches[0].target.closest('.flashcard-body');

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > SWIPE_THRESHOLD) { handlePrev(); } else { handleNext(); }
    } else if (isCardBodyClick) {
      handleFlip();
    }
    setTouchStartX(null);
  };

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
    // 外层容器：最大宽度、居中、有垂直外边距
    <div className="max-w-5xl mx-auto my-8 p-4 bg-transparent">
      {/* 标题 */}
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      {/* 卡片包装器，提供 perspective */}
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-2xl hover:shadow-3xl transition-shadow duration-300 transform hover:scale-105 my-4 touch-action-none"
        style={{
          height: '500px', // 固定高度，确保内容不会压缩
          maxWidth: '800px', // 限制最大宽度，让卡片看起来更舒适
          margin: '0 auto', // 居中
          perspective: '1000px', // 强制透视效果
          border: '1px solid var(--border-color-subtle, #e0e0e0)', // 增加边框
          backgroundColor: currentBackgroundImage ? 'transparent' : 'var(--bg-card-default, #ffffff)' // 无背景图时，有默认卡片背景色
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 卡片翻转容器，包含正面和背面 */}
        <div
          className={`absolute w-full h-full transition-transform duration-500 ease-in-out`} // 增加 duration 和 ease-in-out
          style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }} // 直接控制 transform 属性
        >
          {/* 卡片背景图层 - 位于整个翻转容器之后，但会因为 preserve-3d 而跟随翻转 */}
          {currentBackgroundImage && (
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                backgroundImage: `url('${currentBackgroundImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.9, // 略微降低背景图透明度，提高文字可读性
              }}
            >
              {/* 半透明颜色叠加层，确保文本可读性 */}
              <div className="absolute inset-0 bg-black opacity-30 dark:opacity-50 rounded-xl"></div>
            </div>
          )}

          {/* 卡片正面：只显示大中文单词 */}
          <div
            onClick={handleFlip} // 点击正面翻转
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col items-center justify-center p-6 sm:p-8 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-dark-DEFAULT dark:text-gray-1 bg-gray-100 dark:bg-dark-3'} `}
          >
            <p className="text-5xl sm:text-7xl font-bold text-center flex items-center leading-tight">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl" />
            </p>
          </div>

          {/* 卡片背面：显示所有详细信息 */}
          <div
            onClick={handleFlip} // 点击背面翻转
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col justify-center p-6 sm:p-8 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7 bg-gray-1 dark:bg-dark-3'} `}
            style={{ transform: 'rotateY(180deg)' }} // 背面初始状态翻转
          >
            {/* 单词标题和朗读 */}
            <h4
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 flex items-center justify-center leading-tight"
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-primary)' }}
            >
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-3xl sm:text-4xl" />
            </h4>

            {currentCard.pinyin && (
              <p
                className="text-xl sm:text-2xl mb-2 flex items-center"
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
              >
                <span className="font-semibold mr-2">拼音:</span>
                {currentCard.pinyin}
                <TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 text-xl" />
              </p>
            )}

            {currentCard.myanmar && (
              <p
                className="text-xl sm:text-2xl mb-2 flex items-center font-myanmar"
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
              >
                <span className="font-semibold mr-2">缅文:</span>
                {currentCard.myanmar}
                <TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="ml-2 text-xl" />
              </p>
            )}

            {/* 释义 */}
            <p
              className="text-xl sm:text-2xl mb-2 flex items-center"
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
            >
              <span className="font-semibold mr-2">释义:</span>
              {currentCard.meaning}
              <TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 text-xl" />
            </p>

            {currentCard.example1 && (
              <>
                <p
                  className="text-lg sm:text-xl italic flex items-start mt-2"
                  style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                >
                  <span className="font-semibold not-italic mr-2">例句1:</span>
                  {currentCard.example1}
                  <TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 text-lg" />
                </p>
                {currentCard.example1Translation && (
                  <p
                    className="text-base sm:text-lg flex items-start"
                    style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                  >
                    <span className="font-semibold mr-2">翻译:</span>
                    {currentCard.example1Translation}
                    <TextToSpeechButton text={currentCard.example1Translation} lang={lang} className="ml-2 text-base" />
                  </p>
                )}
              </>
            )}

            {currentCard.example2 && (
              <>
                <p
                  className="text-lg sm:text-xl italic flex items-start mt-2"
                  style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                >
                  <span className="font-semibold not-italic mr-2">例句2:</span>
                  {currentCard.example2}
                  <TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 text-lg" />
                </p>
                {currentCard.example2Translation && (
                  <p
                    className="text-base sm:text-lg flex items-start"
                    style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                  >
                    <span className="font-semibold mr-2">翻译:</span>
                    {currentCard.example2Translation}
                    <TextToSpeechButton text={currentCard.example2Translation} lang={lang} className="ml-2 text-base" />
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 底部导航按钮和卡片计数 */}
      <div className="flex justify-between w-full max-w-5xl mt-4 sm:mt-8 px-4">
        <button
          onClick={handlePrev}
          disabled={displayFlashcards.length <= 1}
          className="flex items-center px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          <i className="fas fa-arrow-left mr-2"></i> 上一个
        </button>
        <span className="text-body-color dark:text-dark-7 text-xl sm:text-2xl font-medium self-center">
          {currentIndex + 1} / {displayFlashcards.length}
        </span>
        <button
          onClick={handleNext}
          disabled={displayFlashcards.length <= 1}
          className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus://ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
