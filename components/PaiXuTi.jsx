// /components/PaiXuTi.js (点击交换位置 + 颜色背景)
import React, { useState, useEffect, useRef } from 'react'
import TextToSpeechButton from './TextToSpeechButton' // 朗读按钮，如果需要

const PaiXuTi = ({ words, explanation, question = '请将以下词语点击交换位置，组成一个正确的句子或短语：' }) => {
  const [currentOrder, setCurrentOrder] = useState([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [firstClickedIndex, setFirstClickedIndex] = useState(null) // 记录第一次点击的词语索引

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)

  // 预定义的卡片颜色数组，循环使用
  const cardColors = [
    'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700',
    'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border-green-300 dark:border-green-700',
    'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700',
    'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-700',
    'bg-pink-100 dark:bg-pink-800 text-pink-800 dark:text-pink-100 border-pink-300 dark:border-pink-700',
    'bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 border-indigo-300 dark:border-indigo-700',
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3')
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3')
    }
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)
    setCurrentOrder(shuffledWords)
  }, [words])

  const playSound = (isCorrect) => {
    if (isCorrect && correctAudioRef.current) {
      correctAudioRef.current.currentTime = 0;
      correctAudioRef.current.play().catch(e => console.error("Error playing correct sound:", e))
    } else if (!isCorrect && wrongAudioRef.current) {
      wrongAudioRef.current.currentTime = 0;
      wrongAudioRef.current.play().catch(e => console.error("Error playing wrong sound:", e))
    }
  }

  const handleWordClick = (index) => {
    if (isSubmitted) return // 提交后不能再点击

    if (firstClickedIndex === null) {
      // 第一次点击，记录索引
      setFirstClickedIndex(index)
    } else if (firstClickedIndex === index) {
      // 再次点击同一个词语，取消选中
      setFirstClickedIndex(null)
    } else {
      // 第二次点击不同词语，交换位置
      const newOrder = [...currentOrder]
      const temp = newOrder[firstClickedIndex]
      newOrder[firstClickedIndex] = newOrder[index]
      newOrder[index] = temp
      setCurrentOrder(newOrder)
      setFirstClickedIndex(null) // 交换后重置第一次点击
    }
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
    const correctOrderString = words.join('')
    const currentOrderString = currentOrder.join('')
    const result = currentOrderString === correctOrderString
    setIsCorrect(result)
    playSound(result)
  }

  const handleReset = () => {
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)
    setCurrentOrder(shuffledWords)
    setIsSubmitted(false)
    setIsCorrect(null)
    setFirstClickedIndex(null) // 重置点击状态
  }

  const getWordCardClasses = (index) => {
    let classes = `paixuti-item px-5 py-3 m-2 rounded-lg shadow-md cursor-pointer transition-all duration-200 text-lg font-semibold select-none `
    
    // 基础颜色背景
    const baseColorClass = cardColors[index % cardColors.length];
    classes += baseColorClass + ' ';

    if (isSubmitted) {
      classes += 'cursor-not-allowed ';
      if (currentOrder[index] === words[index]) {
        // 正确位置的词语，用 secondary 主题色覆盖
        classes += 'bg-secondary/[0.15] border-secondary text-secondary shadow-lg ';
      } else {
        // 错误位置的词语，用红色主题色覆盖
        classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400 shadow-lg ';
      }
    } else {
      classes += 'hover:scale-[1.03] hover:shadow-lg '; // 悬停放大和加深阴影
      if (firstClickedIndex === index) {
        classes += 'ring-4 ring-offset-2 ring-primary scale-[1.05] shadow-xl '; // 第一次点击高亮，更强的放大和阴影
      }
    }
    return classes
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-bold mb-6 text-dark-DEFAULT dark:text-gray-1 flex items-center">
        {question}
        <TextToSpeechButton text={question} lang="zh-CN" /> {/* 朗读问题按钮 */}
      </h3>

      <div className="flex flex-wrap justify-center items-center min-h-[120px] p-4 border border-dashed border-stroke dark:border-dark-4 rounded-lg bg-gray-1 dark:bg-dark-2 shadow-inner">
        {currentOrder.map((word, index) => (
          <div
            key={word + index} // 使用 word + index 作为 key，避免重复词语的 key 冲突
            onClick={() => handleWordClick(index)}
            className={getWordCardClasses(index)}
          >
            {word}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between items-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200"
          >
            提交答案
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200"
          >
            重置
          </button>
        )}

        {isSubmitted && (
          <div className="flex items-center space-x-3">
            {isCorrect ? (
              <span className="text-secondary font-bold text-xl">
                <i className="fas fa-check-circle mr-2"></i>回答正确！
              </span>
            ) : (
              <span className="text-red-600 font-bold text-xl dark:text-red-400">
                <i className="fas fa-times-circle mr-2"></i>回答错误！
              </span>
            )}
          </div>
        )}
      </div>

      {isSubmitted && explanation && (
        <div className="mt-6 p-4 bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 rounded-b-xl text-body-color dark:text-dark-7 shadow-inner">
          <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
                <i className="fas fa-lightbulb mr-2 text-warning"></i>解释：
                <TextToSpeechButton text={explanation} lang="zh-CN" /> {/* 朗读解释按钮 */}
          </h4>
          <p>{explanation}</p>
        </div>
      )}

      {isSubmitted && !isCorrect && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border-t-2 border-red-200 dark:border-red-700 rounded-b-xl text-body-color dark:text-dark-7 shadow-inner">
          <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
            <i className="fas fa-exclamation-circle mr-2 text-red-600 dark:text-red-400"></i>正确顺序是：
            <TextToSpeechButton text={words.join(' ')} lang="zh-CN" /> {/* 朗读正确顺序按钮 */}
          </h4>
          <p className="text-red-600 dark:text-red-400 font-bold">{words.join(' ')}</p>
        </div>
      )}
    </div>
  )
}

export default PaiXuTi
