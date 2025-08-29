// /components/BeiDanCi.js (触摸事件监听模拟滑动)
import React, { useState, useEffect, useRef } from 'react'
import TextToSpeechButton from './TextToSpeechButton' // 导入朗读组件

/**
 * 背单词卡片组件 (Flashcard)
 * 点击卡片翻转，显示单词、词义、例句。支持左右触摸滑动切换卡片。
 * 卡片背景可使用随机图片。
 */
const BeiDanCi = ({ flashcards, questionTitle = '背单词', lang = 'zh-CN', backgroundImages = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false) // 卡片是否翻转
  const [touchStartX, setTouchStartX] = useState(null) // 记录触摸开始时的 X 坐标

  const flipAudioRef = useRef(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // flipAudioRef.current = new Audio('/sounds/flip.mp3'); 
    }
  }, []);

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
    // if (flipAudioRef.current) {
    //   flipAudioRef.current.currentTime = 0;
    //   flipAudioRef.current.play().catch(e => console.error("Error playing flip sound:", e));
    // }
  }

  const handleNext = () => {
    setIsFlipped(false) // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex((prevIndex) => (prevIndex + 1) % flashcards.length)
    }, 150) // 匹配翻转动画时间
  }

  const handlePrev = () => {
    setIsFlipped(false) // 切换前先翻回正面
    setTimeout(() => { // 延迟切换，给翻转动画时间
      setCurrentIndex((prevIndex) => (prevIndex - 1 + flashcards.length) % flashcards.length)
    }, 150) // 匹配翻转动画时间
  }

  // 触摸开始事件
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX)
  }

  // 触摸结束事件
  const handleTouchEnd = (e) => {
    if (touchStartX === null) {
      return
    }

    const touchEndX = e.changedTouches[0].clientX
    const deltaX = touchEndX - touchStartX

    const SWIPE_THRESHOLD = 50 // 滑动阈值，超过这个距离才认为是有效滑动

    if (deltaX > SWIPE_THRESHOLD) {
      // 右滑
      handlePrev()
    } else if (deltaX < -SWIPE_THRESHOLD) {
      // 左滑
      handleNext()
    }

    setTouchStartX(null) // 重置触摸起始坐标
  }


  const currentCard = flashcards[currentIndex]
  const currentBackgroundImage = backgroundImages[currentIndex % backgroundImages.length]; // 循环使用背景图

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
        <p className="text-lg font-semibold text-center">没有卡片数据。请提供 flashcards 数组。</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-bold mb-6 text-dark-DEFAULT dark:text-gray-1 text-center">
        {questionTitle}
      </h3>

      <div
        className="relative w-full h-[400px] perspective-1000 my-8"
        onTouchStart={handleTouchStart} // 监听触摸开始
        onTouchEnd={handleTouchEnd}     // 监听触摸结束
      >
        <div
          onClick={handleFlip}
          className={`absolute w-full h-full preserve-3d transition-transform duration-300 cursor-pointer rounded-lg shadow-lg border border-stroke dark:border-dark-4
            ${isFlipped ? 'rotate-y-180' : ''}`}
        >
          {/* 卡片背景图层 */}
          {currentBackgroundImage && (
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                backgroundImage: `url(${currentBackgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* 半透明颜色叠加层，确保文本可读性 */}
              <div className="absolute inset-0 bg-black opacity-30 dark:opacity-50 rounded-lg"></div>
            </div>
          )}

          {/* 卡片正面 */}
          <div className={`absolute w-full h-full backface-hidden rounded-lg flex flex-col items-center justify-center p-6 text-white z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-dark-DEFAULT dark:text-gray-1'}
                      ${!currentBackgroundImage && !isFlipped ? 'bg-gray-100 dark:bg-dark-3' : ''}
                      ${!currentBackgroundImage && isFlipped ? 'bg-gray-1 dark:bg-dark-3' : ''} `}>
            <p className="text-4xl font-bold text-center select-none flex items-center">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} />
            </p>
          </div>

          {/* 卡片背面 */}
          <div className={`absolute w-full h-full backface-hidden rounded-lg flex flex-col justify-center p-6 rotate-y-180 z-10
                      ${currentBackgroundImage ? 'text-white' : 'text-body-color dark:text-dark-7'}
                      ${!currentBackgroundImage && isFlipped ? 'bg-gray-1 dark:bg-dark-3' : ''}
                      ${!currentBackgroundImage && !isFlipped ? 'bg-gray-100 dark:bg-dark-3' : ''} `}>
            <h4 className="text-xl font-bold text-center mb-2 select-none flex items-center"
                style={{ color: currentBackgroundImage ? 'white' : 'var(--text-primary)' }}>
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} />
            </h4>
            <p className="text-lg mb-2 select-none flex items-center"
               style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-color-or-dark7)' }}>
              <span className="font-semibold">词义: </span>{currentCard.meaning}
              <TextToSpeechButton text={currentCard.meaning} lang={lang} />
            </p>
            {currentCard.example && (
              <p className="text-base italic select-none flex items-center"
                 style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}>
                <span className="font-semibold not-italic">例句: </span>{currentCard.example}
                <TextToSpeechButton text={currentCard.example} lang={lang} />
              </p>
            )}
            {currentCard.exampleTranslation && (
              <p className="text-base select-none flex items-center"
                 style={{ color: currentBackgroundImage ? 'white' : 'var(--text-body-secondary-or-dark6)' }}>
                <span className="font-semibold">翻译: </span>{currentCard.exampleTranslation}
                <TextToSpeechButton text={currentCard.exampleTranslation} lang={lang} />
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={handlePrev}
          disabled={flashcards.length <= 1}
          className="px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fas fa-arrow-left mr-2"></i> 上一个
        </button>
        <span className="text-body-color dark:text-dark-7 text-lg font-medium self-center">
          {currentIndex + 1} / {flashcards.length}
        </span>
        <button
          onClick={handleNext}
          disabled={flashcards.length <= 1}
          className="px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一个 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  )
}

export default BeiDanCi
