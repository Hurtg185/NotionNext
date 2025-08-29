// /components/BeiDanCi.js (最终版本，包含全屏、随机/顺序、多信息显示、左右切换、键盘导航、z-index等)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 点击卡片翻转，显示单词、词义、例句。支持左右触摸滑动切换卡片。
 * 卡片背景可使用随机图片。
 *
 * @param {Array<Object>} flashcards - 单词卡片数据数组，每个对象应包含:
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
 * @param {Array<string>} backgroundImages - 背景图片URL数组
 * @param {boolean} isShuffle - 是否随机排序，控制卡片顺序 (由父组件传入)
 */
const BeiDanCi = ({
  flashcards,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages = [],
  isShuffle = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false); // 卡片是否翻转，初始为false (正面)
  const [touchStartX, setTouchStartX] = useState(null); // 记录触摸开始时的 X 坐标
  const [displayFlashcards, setDisplayFlashcards] = useState([]); // 实际展示的卡片顺序

  const flipAudioRef = useRef(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // flipAudioRef.current = new Audio('/sounds/flip.mp3');
    }
  }, []);

  // 根据 isShuffle 状态和 flashcards 变化来更新 displayFlashcards
  useEffect(() => {
    if (!flashcards || flashcards.length === 0) {
        setDisplayFlashcards([]);
        setCurrentIndex(0);
        setIsFlipped(false);
        return;
    }

    if (isShuffle) {
      const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
      setDisplayFlashcards(shuffled);
    } else {
      setDisplayFlashcards([...flashcards]); // 保持原始顺序
    }
    setCurrentIndex(0); // 排序或切换模式后重置到第一张卡片
    setIsFlipped(false); // 重置翻转状态到正面
  }, [flashcards, isShuffle]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    // if (flipAudioRef.current) {
    //   flipAudioRef.current.currentTime = 0;
    //   flipAudioRef.current.play().catch(e => console.error("Error playing flip sound:", e));
    // }
  }, []);

  const handleNext = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
    }, 150);
  }, [displayFlashcards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => {
      setCurrentIndex(
        (prevIndex) => (prevIndex - 1 + displayFlashcards.length) % displayFlashcards.length
      );
    }, 150);
  }, [displayFlashcards.length]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return; // 没有卡片时不响应键盘事件

      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') { // 空格键或回车键翻转
        e.preventDefault(); // 阻止页面滚动
        handleFlip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, handleFlip, displayFlashcards.length]);

  // 触摸开始事件
  const handleTouchStart = (e) => {
    // 阻止默认的触摸行为，例如页面滚动，但要小心可能阻止其他需要滚动的元素
    // e.preventDefault(); // 暂时注释，如果影响页面其他滚动再启用
    setTouchStartX(e.touches[0].clientX);
  };

  // 触摸移动事件 (可选，如果需要实时拖动效果)
  const handleTouchMove = (e) => {
    // e.preventDefault(); // 阻止滚动
  };

  // 触摸结束事件
  const handleTouchEnd = (e) => {
    if (touchStartX === null) {
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    const SWIPE_THRESHOLD = 50; // 滑动阈值

    if (deltaX > SWIPE_THRESHOLD) {
      // 右滑
      handlePrev();
    } else if (deltaX < -SWIPE_THRESHOLD) {
      // 左滑
      handleNext();
    } else if (Math.abs(deltaX) <= SWIPE_THRESHOLD && e.changedTouches[0].target.closest('.flashcard-body')) {
      // 如果滑动距离很小，则认为是点击事件，用于翻转卡片
      // 确保点击区域在卡片主体内，避免点击按钮也翻转
      handleFlip();
    }

    setTouchStartX(null); // 重置触摸起始坐标
  };


  const currentCard = displayFlashcards[currentIndex];
  const currentBackgroundImage = backgroundImages[currentIndex % backgroundImages.length];

  if (!displayFlashcards || displayFlashcards.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-day-DEFAULT dark:bg-night-DEFAULT text-body-color dark:text-dark-7 z-[9999]">
        <p className="text-lg font-semibold text-center p-4">没有卡片数据。请提供 flashcards 数组。</p>
      </div>
    );
  }

  return (
    // 全屏容器，使用高 z-index 确保覆盖其他内容
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-day-DEFAULT dark:bg-night-DEFAULT p-4 sm:p-8 overflow-hidden z-[9999]">
      <h3 className="text-3xl sm:text-4xl font-extrabold mb-4 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      <div
        className="relative w-full max-w-4xl h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)] perspective-1000 my-4"
        onTouchStart={handleTouchStart} // 监听触摸开始
        onTouchMove={handleTouchMove}   // 监听触摸移动
        onTouchEnd={handleTouchEnd}     // 监听触摸结束
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
            onClick={handleFlip} // 点击正面翻转
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col items-center justify-center p-6 sm:p-8 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-dark-DEFAULT dark:text-gray-1 bg-gray-100 dark:bg-dark-3'} `}
          >
            <p className="text-5xl sm:text-7xl font-bold text-center flex items-center">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl" />
            </p>
          </div>

          {/* 卡片背面 */}
          <div
            onClick={handleFlip} // 点击背面翻转
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col justify-center p-6 sm:p-8 rotate-y-180 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7 bg-gray-1 dark:bg-dark-3'} `}
          >
            <h4
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 flex items-center justify-center"
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
