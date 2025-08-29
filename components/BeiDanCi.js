// /components/BeiDanCi.js (取消全屏，优化翻转，美化样式)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton';

/**
 * 背单词卡片组件 (Flashcard)
 * 不再全屏显示，而是作为页面内容，但尺寸较大。
 * 点击卡片翻转，显示单词、拼音、缅文、释义、例句。支持左右触摸滑动切换卡片。
 * 卡片背景可使用随机图片。
 *
 * @param {Array<Object>|string} flashcards - 单词卡片数据数组，或 JSON 字符串。
 *   {
 *     id: string | number,
 *     word: string, // 中文单词 (正面显示)
 *     pinyin: string, // 拼音 (背面显示)
 *     myanmar: string, // 缅文 (背面显示)
 *     meaning: string, // 释义 (背面显示)
 *     example1: string, // 例句1 (背面显示)
 *     example1Translation: string, // 例句1翻译 (背面显示)
 *     example2: string, // 例句2 (背面显示)
 *     example2Translation: string, // 例句2翻译 (背面显示)
 *   }
 * @param {string} questionTitle - 组件标题
 * @param {string} lang - 朗读语言，默认为 'zh-CN'
 * @param {Array<string>|string} backgroundImages - 背景图片URL数组，或 JSON 字符串。
 * @param {boolean} isShuffle - 是否随机排序，控制卡片顺序 (由父组件传入)
 */
const BeiDanCi = ({
  flashcards: flashcardsProp, // 将 prop 名称改为 flashcardsProp 以避免混淆
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [], // 同样改名
  isShuffle = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false); // 卡片是否翻转，初始为false (正面)
  const [touchStartX, setTouchStartX] = useState(null);
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);


  // 处理 flashcards prop (可以接收字符串或数组)
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try {
        cards = JSON.parse(flashcardsProp);
      } catch (e) {
        console.error("Error parsing flashcards JSON string:", e);
        cards = [];
      }
    } else if (Array.isArray(flashcardsProp)) {
      cards = flashcardsProp;
    }

    if (!cards || cards.length === 0) {
      setDisplayFlashcards([]);
      setCurrentIndex(0);
      setIsFlipped(false);
      return;
    }

    if (isShuffle) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setDisplayFlashcards(shuffled);
    } else {
      setDisplayFlashcards([...cards]);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [flashcardsProp, isShuffle]);

  // 处理 backgroundImages prop (可以接收字符串或数组)
  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try {
        images = JSON.parse(backgroundImagesProp);
      } catch (e) {
        console.error("Error parsing backgroundImages JSON string:", e);
        images = [];
      }
    } else if (Array.isArray(backgroundImagesProp)) {
      images = backgroundImagesProp;
    }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);


  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
    }, 150); // 匹配翻转动画时间
  }, [displayFlashcards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex(
        (prevIndex) => (prevIndex - 1 + displayFlashcards.length) % displayFlashcards.length
      );
    }, 150); // 匹配翻转动画时间
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
    if (touchStartX === null) {
      return;
    }
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const SWIPE_THRESHOLD = 50;

    // 检查是否在卡片主体区域进行了触摸，避免点击按钮也被误判为卡片点击
    // target.closest() 方法可以帮助我们判断触摸事件是否发生在某个特定元素或其子元素上
    const isCardBodyClick = e.changedTouches[0].target.closest('.flashcard-body');

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) { // 明显的滑动
        if (deltaX > SWIPE_THRESHOLD) {
            handlePrev();
        } else {
            handleNext();
        }
    } else if (isCardBodyClick) { // 短距离触摸且在卡片主体上，视为点击翻转
        handleFlip();
    }
    setTouchStartX(null);
  };


  const currentCard = displayFlashcards[currentIndex];
  // 循环使用背景图
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length];

  if (!displayFlashcards || displayFlashcards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
        <p className="text-lg font-semibold text-center">没有卡片数据。请提供 flashcards 数组。</p>
      </div>
    );
  }

  return (
    // 不再使用 fixed inset-0，改为普通 div，并设置最大宽度和高度
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent"> {/* bg-transparent 让其不遮挡父级背景 */}
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      <div
        className="relative w-full h-[500px] sm:h-[600px] md:h-[700px] aspect-w-16 aspect-h-9 perspective-1000 my-4 touch-action-none" // 增加高度，aspect-ratio 确保比例
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        // onTouchMove={e => e.preventDefault()} // 阻止卡片区域滑动时页面滚动
      >
        <div
          className={`absolute w-full h-full preserve-3d transition-transform duration-300 rounded-xl shadow-2xl border border-stroke dark:border-dark-4
            ${isFlipped ? 'rotate-y-180' : ''}`}
        >
          {/* 卡片背景图层 */}
          {currentBackgroundImage && (
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                backgroundImage: `url(${currentBackgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* 半透明颜色叠加层，确保文本可读性 */}
              <div className="absolute inset-0 bg-black opacity-30 dark:opacity-50 rounded-xl"></div>
            </div>
          )}

          {/* 卡片正面 */}
          <div
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col items-center justify-center p-6 sm:p-8 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-dark-DEFAULT dark:text-gray-1 bg-gray-100 dark:bg-dark-3'} `}
          >
            <p className="text-5xl sm:text-7xl font-bold text-center flex items-center leading-tight"> {/* leading-tight 减少行高 */}
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl" />
            </p>
          </div>

          {/* 卡片背面 */}
          <div
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col justify-center p-6 sm:p-8 rotate-y-180 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7 bg-gray-1 dark:bg-dark-3'} `}
          >
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

      <div className="flex justify-between w-full max-w-4xl mt-4 sm:mt-8 px-4">
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
          className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
