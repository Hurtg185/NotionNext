// components/TianKongTi.jsx
import React, { useState } from 'react'

const TianKongTi = ({ sentence, correctAnswer, explanation, placeholder = '在此输入' }) => {
  const [userInput, setUserInput] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  const handleSubmit = () => {
    if (userInput.trim() === '') {
      alert('请输入答案！')
      return
    }
    setIsSubmitted(true)
    setIsCorrect(userInput.trim().toLowerCase() === correctAnswer.trim().toLowerCase())
  }

  const handleReset = () => {
    setUserInput('')
    setIsSubmitted(false)
    setIsCorrect(null)
  }

  // 将句子中的占位符 "___" 替换为输入框
  const renderSentenceWithInput = () => {
    const parts = sentence.split('___')
    if (parts.length === 1) {
      return (
        <p className="inline text-body-color dark:text-dark-7">
          {sentence} (请确保问题中包含 `___` 占位符)
        </p>
      )
    }

    return (
      <p className="inline text-body-color dark:text-dark-7 text-xl leading-relaxed">
        {parts[0]}
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitted}
          className={`mx-2 p-2 border-b-2 outline-none focus:border-primary transition-colors duration-200 text-center
            ${isSubmitted && isCorrect === true ? 'border-secondary bg-secondary/[0.05] text-secondary' : ''}
            ${isSubmitted && isCorrect === false ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400' : ''}
            ${!isSubmitted ? 'border-stroke dark:border-dark-4 focus:ring-primary/[0.2] focus:ring-2' : ''}
            rounded-md w-40 sm:w-60 text-lg font-medium text-dark-DEFAULT dark:text-gray-1 placeholder-body-secondary dark:placeholder-dark-5
          `}
          style={{ minWidth: '80px' }}
        />
        {parts[1]}
      </p>
    )
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-semibold mb-6 text-dark-DEFAULT dark:text-gray-1">请填空：</h3>

      <div className="mb-8 text-xl">
        {renderSentenceWithInput()}
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
        <div className="mt-6 p-4 bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 rounded-b-xl text-body-color dark:text-dark-7">
          <h4 className="font-semibold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1">
            <i className="fas fa-lightbulb mr-2 text-warning"></i>解释：
          </h4>
          <p>{explanation}</p>
        </div>
      )}

      {isSubmitted && !isCorrect && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border-t-2 border-red-200 dark:border-red-700 rounded-b-xl text-body-color dark:text-dark-7">
          <h4 className="font-semibold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1">
            <i className="fas fa-exclamation-circle mr-2 text-red-600 dark:text-red-400"></i>正确答案是：
          </h4>
          <p className="text-red-600 dark:text-red-400 font-bold">{correctAnswer}</p>
        </div>
      )}
    </div>
  )
}

export default TianKongTi
