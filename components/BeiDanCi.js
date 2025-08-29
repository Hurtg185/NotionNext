// /components/BeiDanCi.js - 最终版本：无 3D 翻转，点击显示/隐藏背面信息
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 作为页面内容的一部分显示，尺寸较大。
 * 点击卡片（非按钮区域）可显示/隐藏背面详细信息。
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
  const [showBack, setShowBack] = useState(false); // 控制背面信息显示/隐藏
  const [touchStartX, setTouchStartX] = useState(null);

  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);

  // --- Prop 解析和数据初始化 ---
  // 处理 flashcards prop (可以接收 JSON 字符串或数组)
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
    setShowBack(false); // 重置为只显示正面单词
  }, [flashcardsProp, internalIsShuffle]);

  // 处理 backgroundImages prop (可以接收 JSON 字符串或数组)
  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try { images = JSON.parse(backgroundImagesProp); } catch (e) { console.error("Error parsing backgroundImages JSON string:", e); images = []; }
    } else if (Array.isArray(backgroundImagesProp)) { images = backgroundImagesProp; }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);

  // 处理 isShuffle prop (可以接收布尔值或 "true"/"false" 字符串)
  useEffect(() => {
    if (typeof isShuffleProp === 'string') {
      setInternalIsShuffle(isShuffleProp === 'true');
    } else {
      setInternalIsShuffle(!!isShuffleProp);
    }
  }, [isShuffleProp]);

  // --- 交互逻辑 ---

  // 切换背面信息显示/隐藏
  const handleToggleBack = useCallback(() => {
    setShowBack((prev) => !prev);
  }, []);

  // 切换到下一张卡片
  const handleNext = useCallback(() => {
    setShowBack(false); // 切换前先隐藏背面
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
  }, [displayFlashcards.length]);

  // 切换到上一张卡片
  const handlePrev = useCallback(() => {
    setShowBack(false); // 切换前先隐藏背面
    setCurrentIndex((prevIndex) => (prevIndex - 1 + displayFlashcards.length) % displayFlashcards.length);
  }, [displayFlashcards.length]);

  // 键盘事件监听：左右箭头切换，空格/回车显示/隐藏背面
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return;

      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, handleToggleBack, displayFlashcards.length]);

  // 触摸事件：滑动切换，点击显示/隐藏背面
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

    // 判断触摸是否发生在卡片主体区域
    const isCardBodyClick = e.changedTouches[0].target.closest('.flashcard-body');

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) { // 明显的左右滑动
      if (deltaX > SWIPE_THRESHOLD) { // 右滑
        handlePrev();
      } else { // 左滑
        handleNext();
      }
    } else if (isCardBodyClick) { // 短距离触摸且在卡片主体上，视为点击显示/隐藏背面
      handleToggleBack();
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

      {/* 卡片容器：不再有3D透视，只控制尺寸和阴影 */}
      <div
        className="relative w-full aspect-video md:aspect-w-16 md:aspect-h-9 overflow-hidden rounded-xl shadow-2xl hover:shadow-3xl transition-shadow duration-300 transform hover:scale-105 my-4 touch-action-none" // aspect-video/aspect-w-16/h-9 保持宽高比
        style={{ minHeight: '300px', height: 'auto' }} // 确保有最小高度，但自适应
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 卡片背景图层 */}
        {currentBackgroundImage && (
          <div
            className="absolute inset-0 rounded-xl"
            style={{
              backgroundImage: `url('${currentBackgroundImage}')`, // 确认背景图路径
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* 半透明颜色叠加层，确保文本可读性 */}
            <div className="absolute inset-0 bg-black opacity-30 dark:opacity-50 rounded-xl"></div>
          </div>
        )}

        {/* 卡片内容区域，现在是点击显示/隐藏 */}
        <div
          onClick={handleToggleBack} // 点击卡片切换背面信息
          className={`flashcard-body absolute inset-0 rounded-xl flex flex-col items-center justify-center p-6 sm:p-8 cursor-pointer text-white z-10 transition-all duration-300
                      ${currentBackgroundImage ? 'text-white' : 'text-dark-DEFAULT dark:text-gray-1 bg-gray-100 dark:bg-dark-3'}`}
        >
          {/* 正面：大中文单词 */}
          <p className="text-5xl sm:text-7xl font-bold text-center flex items-center leading-tight mb-4 select-none">
            {currentCard.word}
            <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl" />
          </p>

          {/* 背面：所有详细信息，根据 showBack 状态显示/隐藏 */}
          <div
            className={`w-full max-h-[70%] overflow-y-auto transition-all duration-300 ease-in-out ${
              showBack ? 'opacity-100 scale-100 pt-4' : 'opacity-0 scale-95 h-0'
            } ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7'}
             ${!currentBackgroundImage && showBack ? 'dark:bg-dark-2 bg-gray-50 bg-opacity-80 dark:bg-opacity-80 rounded-lg p-4' : ''}
            `}
            style={{ pointerEvents: showBack ? 'auto' : 'none' }} // 隐藏时禁用事件
            onClick={e => e.stopPropagation()} // 阻止背面内容的点击事件冒泡到卡片主体
          >
             {/* 单词标题和朗读 (背面重复显示，以便和详情一起阅读) */}
            <h4
              className="text-2xl sm:text-3xl font-extrabold text-center mb-4 flex items-center justify-center leading-tight"
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-primary)' }}
            >
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-2xl sm:text-3xl" />
            </h4>


            {currentCard.pinyin && (
              <p
                className="text-lg sm:text-xl mb-2 flex items-center"
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
              >
                <span className="font-semibold mr-2">拼音:</span>
                {currentCard.pinyin}
                <TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 text-lg" />
              </p>
            )}

            {currentCard.myanmar && (
              <p
                className="text-lg sm:text-xl mb-2 flex items-center font-myanmar" // 注意：font-myanmar 需要在全局CSS中定义
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
              >
                <span className="font-semibold mr-2">缅文:</span>
                {currentCard.myanmar}
                <TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="ml-2 text-lg" />
              </p>
            )}

            {/* 释义 */}
            <p
              className="text-lg sm:text-xl mb-2 flex items-center"
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
            >
              <span className="font-semibold mr-2">释义:</span>
              {currentCard.meaning}
              <TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 text-lg" />
            </p>

            {/* 例句1及其翻译 */}
            {currentCard.example1 && (
              <>
                <p
                  className="text-base sm:text-lg italic flex items-start mt-2"
                  style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                >
                  <span className="font-semibold not-italic mr-2">例句1:</span>
                  {currentCard.example1}
                  <TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 text-base" />
                </p>
                {currentCard.example1Translation && (
                  <p
                    className="text-sm sm:text-base flex items-start"
                    style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                  >
                    <span className="font-semibold mr-2">翻译:</span>
                    {currentCard.example1Translation}
                    <TextToSpeechButton text={currentCard.example1Translation} lang={lang} className="ml-2 text-sm" />
                  </p>
                )}
              </>
            )}

            {currentCard.example2 && (
              <>
                <p
                  className="text-base sm:text-lg italic flex items-start mt-2"
                  style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                >
                  <span className="font-semibold not-italic mr-2">例句2:</span>
                  {currentCard.example2}
                  <TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 text-base" />
                </p>
                {currentCard.example2Translation && (
                  <p
                    className="text-sm sm:text-base flex items-start"
                    style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                  >
                    <span className="font-semibold mr-2">翻译:</span>
                    {currentCard.example2Translation}
                    <TextToSpeechButton text={currentCard.example2Translation} lang={lang} className="ml-2 text-sm" />
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
          className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
