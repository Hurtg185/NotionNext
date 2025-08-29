// /components/XuanZeTi.js (最终版：点击选项文本时朗读并选择，点击题目/解释朗读按钮只朗读)
import React, { useState, useEffect, useRef } from 'react'
import TextToSpeechButton from './TextToSpeechButton' // 导入朗读组件

const XuanZeTi = ({ question, options, correctAnswerIndex, explanation }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)
  
  // SpeechSynthesisUtterance 实例，用于朗读选项文本
  const speechSynthesisUtteranceRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3') 
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3')   
      
      // 初始化 SpeechSynthesis
      speechSynthesisRef.current = window.speechSynthesis;
      speechSynthesisUtteranceRef.current = new SpeechSynthesisUtterance();
      speechSynthesisUtteranceRef.current.lang = 'zh-CN'; // 默认中文
      speechSynthesisUtteranceRef.current.rate = 1;
      speechSynthesisUtteranceRef.current.pitch = 1;
    }

    return () => { // 清理函数
      if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, [])

  const playSound = (isCorrect) => {
    if (isCorrect && correctAudioRef.current) {
      correctAudioRef.current.currentTime = 0;
      correctAudioRef.current.play().catch(e => console.error("Error playing correct sound:", e))
    } else if (!isCorrect && wrongAudioRef.current) {
      wrongAudioRef.current.currentTime = 0;
      wrongAudioRef.current.play().catch(e => console.error("Error playing wrong sound:", e))
    }
  }

  // 新增：朗读选项文本的函数
  const speakOptionText = (textToSpeak) => {
    if (speechSynthesisRef.current && textToSpeak) {
      if (speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel(); // 如果正在朗读，先停止
      }
      speechSynthesisUtteranceRef.current.text = textToSpeak;
      speechSynthesisRef.current.speak(speechSynthesisUtteranceRef.current);
    }
  };

  const handleOptionClick = (index, optionText) => { // 接收 optionText 参数
    if (isAnswered) return

    setSelectedOptionIndex(index)
    setIsAnswered(true)
    setShowFeedback(true)

    playSound(index === correctAnswerIndex)
    speakOptionText(optionText); // 点击选项时朗读选项文本
  }

  const handleReset = () => {
    setShowFeedback(false)
    if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel(); // 重置时停止朗读
    }
    setTimeout(() => {
      setSelectedOptionIndex(null)
      setIsAnswered(false)
    }, 300)
  }

  const getOptionClasses = (optionIndex) => {
    let classes = 'w-full text-left p-3 rounded-md border transition-all duration-200 flex items-center '
    const isCorrectOption = optionIndex === correctAnswerIndex
    const isSelectedOption = optionIndex === selectedOptionIndex

    if (isAnswered) {
      if (isCorrectOption) {
        classes += 'bg-secondary/[0.1] border-secondary text-secondary font-medium shadow-md '
      } else if (isSelectedOption && !isCorrectOption) {
        classes += 'bg-red-100 border-red-400 text-red-600 font-medium dark:bg-red-900 dark:border-red-700 dark:text-red-400 shadow-md '
      } else {
        classes += 'bg-gray-50 dark:bg-dark-3 border-stroke dark:border-dark-4 text-body-color dark:text-dark-7 shadow-sm '
      }
      classes += 'pointer-events-none '
    } else {
      classes += 'bg-gray-50 dark:bg-dark-2 border-stroke dark:border-dark-4 hover:bg-primary/[0.05] dark:hover:bg-dark-3 '
      if (isSelectedOption) {
        classes += 'ring-2 ring-primary/[0.5] shadow-md scale-100 '
      } else {
        classes += 'shadow-sm hover:shadow-md hover:scale-[1.01] '
      }
      classes += 'text-body-color dark:text-dark-7 '
    }
    return classes
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-bold mb-6 text-dark-DEFAULT dark:text-gray-1 flex items-center">
        {question}
        <TextToSpeechButton text={question} lang="zh-CN" /> {/* 朗读问题按钮 */}
      </h3>

      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={index}
            // 修改：点击整个按钮时，传递选项文本给 handleOptionClick
            onClick={() => handleOptionClick(index, option)} 
            disabled={isAnswered}
            className={getOptionClasses(index)}
          >
            <span className="text-lg font-semibold flex-1 flex items-center">
              {String.fromCharCode(65 + index)}. {option}
              {/* 这里不再需要 TextToSpeechButton，因为点击选项本身就会朗读 */}
            </span>
          </button>
        ))}
      </div>

      {isAnswered && (
        <div className={`mt-8 ${showFeedback ? 'animate-fade-in-up-fast' : 'animate-fade-out-fast'}`}>
          <div className="flex items-center space-x-3 mb-4">
            {selectedOptionIndex === correctAnswerIndex ? (
              <span className="text-secondary font-bold text-xl">
                <i className="fas fa-check-circle mr-2"></i>回答正确！
              </span>
            ) : (
              <span className="text-red-600 font-bold text-xl dark:text-red-400">
                <i className="fas fa-times-circle mr-2"></i>回答错误！
              </span>
            )}
          </div>

          {explanation && (
            <div className="mt-4 p-4 bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 rounded-b-xl text-body-color dark:text-dark-7 shadow-inner animate-fade-in-fast">
              <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
                <i className="fas fa-lightbulb mr-2 text-warning"></i>解释：
                <TextToSpeechButton text={explanation} lang="zh-CN" /> {/* 朗读解释按钮 */}
              </h4>
              <p>{explanation}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200"
            >
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default XuanZeTi
