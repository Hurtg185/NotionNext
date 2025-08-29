// /components/PaiXuTi.js (更多卡片颜色)
import React, { useState, useEffect, useRef } from 'react'
import TextToSpeechButton from './TextToSpeechButton' // 朗读按钮

const PaiXuTi = ({ words, explanation, question = '请将以下词语点击交换位置，组成一个正确的句子或短语：', hskLevel }) => { // 添加 hskLevel prop
  const [currentOrder, setCurrentOrder] = useState([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [firstClickedIndex, setFirstClickedIndex] = useState(null)

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)
  
  const speechSynthesisUtteranceRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  // 预定义的卡片颜色数组 (扩充更多颜色)
  const cardColors = [
    'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700',
    'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border-green-300 dark:border-green-700',
    'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700',
    'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-700',
    'bg-pink-100 dark:bg-pink-800 text-pink-800 dark:text-pink-100 border-pink-300 dark:border-pink-700',
    'bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 border-indigo-300 dark:border-indigo-700',
    'bg-teal-100 dark:bg-teal-800 text-teal-800 dark:text-teal-100 border-teal-300 dark:border-teal-700', // 新增
    'bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-100 border-orange-300 dark:border-orange-700', // 新增
    'bg-cyan-100 dark:bg-cyan-800 text-cyan-800 dark:text-cyan-100 border-cyan-300 dark:border-cyan-700', // 新增
    'bg-lime-100 dark:bg-lime-800 text-lime-800 dark:text-lime-100 border-lime-300 dark:border-lime-700', // 新增
    'bg-fuchsia-100 dark:bg-fuchsia-800 text-fuchsia-800 dark:text-fuchsia-100 border-fuchsia-300 dark:border-fuchsia-700', // 新增
    'bg-rose-100 dark:bg-rose-800 text-rose-800 dark:text-rose-100 border-rose-300 dark:border-rose-700', // 新增
  ];

  // HSK 等级颜色映射
  const getHskLevelColorClass = (level) => {
    switch (level) {
      case 1: return 'bg-green-500 text-white';
      case 2: return 'bg-yellow-500 text-gray-800';
      case 3: return 'bg-primary text-white';
      case 4: return 'bg-purple-600 text-white';
      case 5: return 'bg-red-600 text-white';
      case 6: return 'bg-dark-DEFAULT text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3')
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3')

      speechSynthesisRef.current = window.speechSynthesis;
      speechSynthesisUtteranceRef.current = new SpeechSynthesisUtterance();
      speechSynthesisUtteranceRef.current.lang = 'zh-CN';
      speechSynthesisUtteranceRef.current.rate = 1;
      speechSynthesisUtteranceRef.current.pitch = 1;
    }

    const shuffledWords = [...words].sort(() => Math.random() - 0.5);
    setCurrentOrder(shuffledWords);

    return () => {
      if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
    };
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
    if (isSubmitted) return

    if (firstClickedIndex === null) {
      setFirstClickedIndex(index)
    } else if (firstClickedIndex === index) {
      setFirstClickedIndex(null)
    } else {
      const newOrder = [...currentOrder]
      const temp = newOrder[firstClickedIndex]
      newOrder[firstClickedIndex] = newOrder[index]
      newOrder[index] = temp
      setCurrentOrder(newOrder)
      setFirstClickedIndex(null)
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
    if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)
    setCurrentOrder(shuffledWords)
    setIsSubmitted(false)
    setIsCorrect(null)
    setFirstClickedIndex(null)
  }

  const getWordCardClasses = (index) => {
    let classes = `paixuti-item px-5 py-3 m-2 rounded-lg shadow-md cursor-pointer transition-all duration-200 text-lg font-semibold select-none `
    
    const baseColorClass = cardColors[index % cardColors.length];
    classes += baseColorClass + ' ';

    if (isSubmitted) {
      classes += 'cursor-not-allowed ';
      if (currentOrder[index] === words[index]) {
        classes += 'bg-secondary/[0.15] border-secondary text-secondary shadow-lg ';
      } else {
        classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400 shadow-lg ';
      }
    } else {
      classes += 'hover:scale-[1.03] hover:shadow-lg ';
      if (firstClickedIndex === index) {
        classes += 'ring-4 ring-offset-2 ring-primary scale-[1.05] shadow-xl ';
      }
    }
    return classes
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-dark-DEFAULT dark:text-gray-1 flex items-center">
          {question}
          <TextToSpeechButton text={question} lang="zh-CN" />
        </h3>
        {hskLevel && (
          <span className={`px-3 py-1 text-sm font-bold rounded-full ml-3 ${getHskLevelColorClass(hskLevel)}`}>
            HSK {hskLevel}
            <TextToSpeechButton text={`HSK ${hskLevel} 级`} lang="zh-CN" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center items-center min-h-[120px] p-4 border border-dashed border-stroke dark:border-dark-4 rounded-lg bg-gray-1 dark:bg-dark-2 shadow-inner">
        {currentOrder.map((word, index) => (
          <div
            key={word + '-' + index}
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
                <TextToSpeechButton text={explanation} lang="zh-CN" />
          </h4>
          <p>{explanation}</p>
        </div>
      )}

      {isSubmitted && !isCorrect && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border-t-2 border-red-200 dark:border-red-700 rounded-b-xl text-body-color dark:text-dark-7 shadow-inner">
          <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
            <i className="fas fa-exclamation-circle mr-2 text-red-600 dark:text-red-400"></i>正确顺序是：
            <TextToSpeechButton text={words.join(' ')} lang="zh-CN" />
          </h4>
          <p className="text-red-600 dark:text-red-400 font-bold">{words.join(' ')}</p>
        </div>
      )}
    </div>
  )
}

export default PaiXuTi
