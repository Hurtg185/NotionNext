// /components/XuanZeTi.js
import React, { useState } from 'react'

const XuanZeTi = ({ question, options, correctAnswerIndex, explanation }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)

  const handleOptionClick = (index) => {
    if (isAnswered) return

    setSelectedOptionIndex(index)
    setIsAnswered(true)
  }

  const handleReset = () => {
    setSelectedOptionIndex(null)
    setIsAnswered(false)
  }

  const getOptionClasses = (optionIndex) => {
    let classes = 'w-full text-left p-3 rounded-md border transition-all duration-200 flex items-start ' // 添加 flex items-start
    const isCorrectOption = optionIndex === correctAnswerIndex
    const isSelectedOption = optionIndex === selectedOptionIndex

    if (isAnswered) {
      if (isCorrectOption) {
        classes += 'bg-secondary/[0.1] border-secondary text-secondary font-medium '
      } else if (isSelectedOption && !isCorrectOption) {
        classes += 'bg-red-100 border-red-400 text-red-600 font-medium dark:bg-red-900 dark:border-red-700 dark:text-red-400 '
      } else {
        classes += 'bg-gray-50 dark:bg-dark-3 border-stroke dark:border-dark-4 text-body-color dark:text-dark-7 '
      }
      classes += 'pointer-events-none '
    } else {
      classes += 'bg-gray-50 dark:bg-dark-2 border-stroke dark:border-dark-4 hover:bg-primary/[0.05] dark:hover:bg-dark-3 '
      if (isSelectedOption) {
        classes += 'ring-2 ring-primary/[0.5] '
      }
      classes += 'text-body-color dark:text-dark-7 '
    }
    return classes
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-semibold mb-6 text-dark-DEFAULT dark:text-gray-1">
        {question}
      </h3>

      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(index)}
            disabled={isAnswered}
            className={getOptionClasses(index)}
          >
            <input
              type="radio"
              name="xuanzeti-option"
              value={option}
              checked={selectedOptionIndex === index}
              onChange={() => handleOptionClick(index)} // onChange 也调用，以防点击input本身
              className="mt-1 mr-3 transform scale-125 accent-primary" // 添加 mt-1 保持对齐
              disabled={isAnswered}
            />
            <span className="text-lg flex-1">{String.fromCharCode(65 + index)}. {option}</span> {/* flex-1 让文本占据剩余空间 */}
          </button>
        ))}
      </div>

      {isAnswered && (
        <div className="mt-8">
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
            <div className="mt-4 p-4 bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 rounded-b-xl text-body-color dark:text-dark-7">
              <h4 className="font-semibold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1">
                <i className="fas fa-lightbulb mr-2 text-warning"></i>解释：
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
