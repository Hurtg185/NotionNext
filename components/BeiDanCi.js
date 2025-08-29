// /components/BeiDanCi.js - 最终稳定版：无 3D 翻转，点击淡入淡出，高度优化，背景图强化
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 作为页面内容的一部分显示，尺寸较大。
 * 点击卡片（非按钮区域）可显示/隐藏背面详细信息，带有淡入淡出动画。
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
    setShowBack(false); // 切换前先隐藏背面
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
  }, [displayFlashcards.length]);

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

    const isCardBodyClick = e.changedTouches[0].target.closest('.flashcard-body');

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > SWIPE_THRESHOLD) { handlePrev(); } else { handleNext(); }
    } else if (isCardBodyClick) {
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

      {/* 卡片主体容器：包含背景、内容、和点击事件 */}
      <div
        onClick={handleToggleBack} // 点击卡片主体切换背面信息
        className="flashcard-body relative w-full overflow-hidden rounded-xl shadow-2xl hover:shadow-3xl transition-shadow duration-300 transform hover:scale-105 my-4 cursor-pointer touch-action-none"
        style={{
          height: '500px', // 固定高度，提供足够的空间
          maxWidth: '800px', // 限制最大宽度，保持美观
          margin: '0 auto', // 居中
          border: '1px solid var(--border-color-subtle, #e0e0e0)', // 精致边框
          backgroundColor: currentBackgroundImage ? 'transparent' : 'var(--bg-card-default, #ffffff)', // 无背景图时的默认背景色
          // 使用 flex 布局确保内容垂直居中
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 卡片背景图层 - 确保在最底层 */}
        {currentBackgroundImage && (
          <div
            className="absolute inset-0 rounded-xl"
            style={{
              backgroundImage: `url('${currentBackgroundImage}')`, // 确认背景图路径
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.9, // 略微降低背景图透明度，提高文字可读性
              zIndex: 0, // 确保在最底层
            }}
          >
            {/* 半透明颜色叠加层，确保文本可读性，位于背景图之上 */}
            <div className="absolute inset-0 bg-black opacity-30 dark:opacity-50 rounded-xl z-10"></div>
          </div>
        )}

        {/* 正面：大中文单词 - 始终可见，位于背景和叠加层之上 */}
        <div className={`relative z-20 text-white p-6 sm:p-8 text-center flex flex-col items-center justify-center`}>
          <p className="text-5xl sm:text-7xl font-bold leading-tight select-none flex items-center drop-shadow-lg"> {/* 添加文字阴影 */}
            {currentCard.word}
            <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl drop-shadow-md" />
          </p>
        </div>

        {/* 背面：所有详细信息，根据 showBack 状态淡入淡出，位于正面单词之下但高于背景叠加层 */}
        <div
          className={`absolute inset-0 p-6 sm:p-8 flex flex-col justify-center items-center rounded-xl z-20 transition-all duration-300 ease-in-out ${
            showBack ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none' // 隐藏时禁用事件
          } ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7'}
           ${!currentBackgroundImage && showBack ? 'dark:bg-dark-2 bg-gray-50 bg-opacity-80 dark:bg-opacity-80' : ''}
          `}
          onClick={e => e.stopPropagation()} // 阻止背面内容的点击事件冒泡到卡片主体
          style={{
            // 如果有背景图，则背面内容透明，只显示文字
            // 如果无背景图，则显示半透明的背景板，增加可读性
            background: currentBackgroundImage
              ? 'transparent'
              : showBack
                ? 'rgba(255, 255, 255, 0.8)' // 浅色背景板
                : 'transparent',
            color: currentBackgroundImage ? 'white' : 'var(--text-primary)' // 文本颜色根据背景变化
          }}
        >
          {/* 背面内容需要一个可滚动区域，以防内容过多 */}
          <div className="w-full h-full max-h-[100%] overflow-y-auto custom-scrollbar p-2"> {/* 添加滚动条，自定义类名 */}
            <h4
              className="text-2xl sm:text-3xl font-extrabold text-center mb-4 flex items-center justify-center leading-tight drop-shadow-md" // 添加文字阴影
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-primary)' }}
            >
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-2xl sm:text-3xl drop-shadow-sm" />
            </h4>

            {currentCard.pinyin && (
              <p
                className="text-lg sm:text-xl mb-2 flex items-center drop-shadow-sm" // 添加文字阴影
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
              >
                <span className="font-semibold mr-2">拼音:</span>
                {currentCard.pinyin}
                <TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 text-lg" />
              </p>
            )}

            {currentCard.myanmar && (
              <p
                className="text-lg sm:text-xl mb-2 flex items-center font-myanmar drop-shadow-sm" // 添加文字阴影
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
              >
                <span className="font-semibold mr-2">缅文:</span>
                {currentCard.myanmar}
                <TextToSpeechButton text={currentCard.myanmar} lang="my-MM" className="ml-2 text-lg" />
              </p>
            )}

            {/* 释义 */}
            <p
              className="text-lg sm:text-xl mb-2 flex items-center drop-shadow-sm" // 添加文字阴影
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}
            >
              <span className="font-semibold mr-2">释义:</span>
              {currentCard.meaning}
              <TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 text-lg" />
            </p>

            {currentCard.example1 && (
              <>
                <p
                  className="text-base sm:text-lg italic flex items-start mt-2 drop-shadow-sm" // 添加文字阴影
                  style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                >
                  <span className="font-semibold not-italic mr-2">例句1:</span>
                  {currentCard.example1}
                  <TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 text-base" />
                </p>
                {currentCard.example1Translation && (
                  <p
                    className="text-sm sm:text-base flex items-start drop-shadow-sm" // 添加文字阴影
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
                  className="text-base sm:text-lg italic flex items-start mt-2 drop-shadow-sm" // 添加文字阴影
                  style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}
                >
                  <span className="font-semibold not-italic mr-2">例句2:</span>
                  {currentCard.example2}
                  <TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 text-base" />
                </p>
                {currentCard.example2Translation && (
                  <p
                    className="text-sm sm:text-base flex items-start drop-shadow-sm" // 添加文字阴影
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
          className="flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl"
        >
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
