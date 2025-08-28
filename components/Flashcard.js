// /components/Flashcard.js

import React, { useState, useEffect } from 'react';

/**
 * 词汇闪卡组件
 * 显示中文词语，点击翻转显示拼音和英文释义。
 * 支持多张卡片切换。
 *
 * @param {Object[]} cards - 闪卡数据数组，每个对象包含 { chinese: string, pinyin: string, english: string }。
 *                          例如：[{ chinese: "你好", pinyin: "nǐ hǎo", english: "Hello" }]
 */
const Flashcard = ({ cards }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    // 当卡片数据变化时，重置状态
    setCurrentCardIndex(0);
    setIsFlipped(false);
  }, [cards]);

  if (!cards || cards.length === 0) {
    return (
      <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg text-yellow-800 dark:text-yellow-200 mb-4">
        <p>没有可用的闪卡数据。</p>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false); // 翻到下一张前先翻回正面
    setCurrentCardIndex((prevIndex) => (prevIndex + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false); // 翻到上一张前先翻回正面
    setCurrentCardIndex((prevIndex) => (prevIndex - 1 + cards.length) % cards.length);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 font-sans text-base flex flex-col items-center">
      <style jsx>{`
        /* 确保这些样式在组件范围内，或者在全局CSS中 */
        .perspective {
          perspective: 1000px;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden; /* For Safari */
        }
        .relative.perspective > div {
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }
        .relative.perspective.rotate-y-180 > div {
          transform: rotateY(180deg);
        }
      `}</style>
      <div
        className={`w-full max-w-sm h-48 relative perspective cursor-pointer transition-transform duration-500 ease-in-out ${isFlipped ? 'rotate-y-180' : ''}`}
        onClick={handleFlip}
      >
        {/* 卡片正面 (中文) */}
        <div className="absolute w-full h-full backface-hidden bg-blue-500 text-white flex items-center justify-center rounded-lg shadow-lg">
          <span className="text-4xl font-bold">{currentCard.chinese}</span>
        </div>

        {/* 卡片背面 (拼音 & 英文) */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 flex flex-col items-center justify-center rounded-lg shadow-lg p-4">
          <span className="text-2xl font-bold mb-2">{currentCard.pinyin}</span>
          <span className="text-lg">{currentCard.english}</span>
        </div>
      </div>

      {cards.length > 1 && (
        <div className="flex mt-4 space-x-4">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            上一张
          </button>
          <span className="text-gray-600 dark:text-gray-300 flex items-center">
            {currentCardIndex + 1} / {cards.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            下一张
          </button>
        </div>
      )}
    </div>
  );
};

export default Flashcard;
