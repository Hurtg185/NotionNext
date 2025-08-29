// /components/BeiDanCi.js - 完整且经过检查的版本
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 作为页面内容的一部分显示，尺寸较大。
 * 支持从 `!include` 语句中接收 JSON 字符串形式的 props。
 *
 * @param {Array<Object>|string} flashcards - 单词卡片数据数组，或其 JSON 字符串表示。
 *   每个对象应包含:
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
 * @param {string} questionTitle - 组件标题。
 * @param {string} lang - 朗读语言，默认为 'zh-CN'。
 * @param {Array<string>|string} backgroundImages - 背景图片URL数组，或其 JSON 字符串表示。
 *   图片路径应相对于 `public` 文件夹，例如 `"/images/bg.jpg"`。
 * @param {boolean|string} isShuffle - 是否随机排序。可以为布尔值或 "true"/"false" 字符串。
 */
const BeiDanCi = ({
  flashcards: flashcardsProp,          // 将 prop 名称改为 flashcardsProp 以避免与内部状态混淆
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [], // 同样改名
  isShuffle: isShuffleProp = false,     // 接收 isShuffle prop，可能为字符串
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false); // 卡片是否翻转，初始为false (正面)
  const [touchStartX, setTouchStartX] = useState(null); // 记录触摸开始时的 X 坐标

  // 内部状态来存储解析后的数据和排序模式
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false); // 内部布尔值来管理是否随机

  // Ref 用于播放翻转音效 (如果启用)
  const flipAudioRef = useRef(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 如果需要翻转音效，取消注释并提供音效文件路径
      // flipAudioRef.current = new Audio('/sounds/flip.mp3');
    }
  }, []);

  // --- Prop 解析和数据初始化 ---

  // 处理 flashcards prop (可以接收 JSON 字符串或数组)
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

    // 根据 internalIsShuffle 状态来排序
    if (internalIsShuffle) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setDisplayFlashcards(shuffled);
    } else {
      setDisplayFlashcards([...cards]); // 保持原始顺序
    }
    setCurrentIndex(0); // 排序或切换模式后重置到第一张卡片
    setIsFlipped(false); // 重置翻转状态到正面
  }, [flashcardsProp, internalIsShuffle]); // 依赖 flashcardsProp 和 internalIsShuffle 变化

  // 处理 backgroundImages prop (可以接收 JSON 字符串或数组)
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

  // 处理 isShuffle prop (可以接收布尔值或 "true"/"false" 字符串)
  useEffect(() => {
    if (typeof isShuffleProp === 'string') {
      setInternalIsShuffle(isShuffleProp === 'true');
    } else {
      setInternalIsShuffle(!!isShuffleProp); // 转换为布尔值 (确保是 true/false)
    }
  }, [isShuffleProp]);

  // --- 交互逻辑 ---

  // 卡片翻转
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    // if (flipAudioRef.current) {
    //   flipAudioRef.current.currentTime = 0;
    //   flipAudioRef.current.play().catch(e => console.error("Error playing flip sound:", e));
    // }
  }, []);

  // 切换到下一张卡片
  const handleNext = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex((prevIndex) => (prevIndex + 1) % displayFlashcards.length);
    }, 150); // 匹配翻转动画时间
  }, [displayFlashcards.length]);

  // 切换到上一张卡片
  const handlePrev = useCallback(() => {
    setIsFlipped(false); // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex(
        (prevIndex) => (prevIndex - 1 + displayFlashcards.length) % displayFlashcards.length
      );
    }, 150); // 匹配翻转动画时间
  }, [displayFlashcards.length]);

  // 键盘事件监听：左右箭头切换，空格/回车翻转
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0) return; // 没有卡片时不响应键盘事件

      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') { // 空格键或回车键翻转
        e.preventDefault(); // 阻止页面滚动（特别是空格键）
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
    setTouchStartX(e.touches[0].clientX);
  };

  // 触摸结束事件 (处理滑动和点击翻转)
  const handleTouchEnd = (e) => {
    if (touchStartX === null || displayFlashcards.length === 0) {
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    const SWIPE_THRESHOLD = 50; // 滑动阈值，超过这个距离才认为是有效滑动

    // 判断触摸是否发生在卡片主体区域，避免按钮点击被误判为卡片点击
    const isCardBodyClick = e.changedTouches[0].target.closest('.flashcard-body');

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) { // 明显的左右滑动
      if (deltaX > SWIPE_THRESHOLD) { // 右滑
        handlePrev();
      } else { // 左滑
        handleNext();
      }
    } else if (isCardBodyClick) { // 短距离触摸且在卡片主体上，视为点击翻转
      handleFlip();
    }

    setTouchStartX(null); // 重置触摸起始坐标
  };

  // --- 渲染部分 ---

  const currentCard = displayFlashcards[currentIndex];
  // 循环使用背景图，确保索引不会超出图片数组范围
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length];

  // 没有卡片数据时的显示
  if (!displayFlashcards || displayFlashcards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
        <p className="text-lg font-semibold text-center">没有卡片数据。请提供 flashcards 数组。</p>
      </div>
    );
  }

  return (
    // 外层容器：不再全屏，而是最大宽度、居中、有垂直外边距
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      {/* 标题 */}
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      {/* 卡片容器：包含3D翻转效果和触摸监听 */}
      <div
        className="relative w-full h-[500px] sm:h-[600px] md:h-[700px] perspective-1000 my-4 touch-action-none" // touch-action-none 阻止触摸默认行为
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        // onTouchMove={e => e.preventDefault()} // 可选：如果希望触摸滑动完全不触发页面滚动，可以启用
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

          {/* 卡片正面：只显示大中文单词 */}
          <div
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
            className={`flashcard-body absolute w-full h-full backface-hidden rounded-xl flex flex-col justify-center p-6 sm:p-8 rotate-y-180 select-none cursor-pointer z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7 bg-gray-1 dark:bg-dark-3'} `}
          >
            {/* 单词标题和朗读 */}
            <h4
              className="text-3xl sm:text-4xl font-extrabold text-center mb-4 flex items-center justify-center leading-tight"
              style={{ color: currentBackgroundImage ? 'white' : 'var(--text-primary)' }}
            >
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-3xl sm:text-4xl" />
            </h4>

            {/* 拼音 */}
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

            {/* 缅文 */}
            {currentCard.myanmar && (
              <p
                className="text-xl sm:text-2xl mb-2 flex items-center font-myanmar" // 注意：font-myanmar 需要在全局CSS中定义
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

            {/* 例句1及其翻译 */}
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

            {/* 例句2及其翻译 */}
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
