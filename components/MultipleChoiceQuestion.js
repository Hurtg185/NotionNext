// components/XuanZeTi.jsx (优化版：融合即时反馈、字母编号、全面视觉反馈、主题样式和Font Awesome)
import React, { useState } from 'react'

const XuanZeTi = ({ question, options, correctAnswerIndex, explanation }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false) // 标记是否已回答

  const handleOptionClick = (index) => {
    if (isAnswered) return // 如果已回答，则不能再选择

    setSelectedOptionIndex(index)
    setIsAnswered(true) // 标记为已回答
  }

  const handleReset = () => {
    setSelectedOptionIndex(null)
    setIsAnswered(false)
  }

  const getOptionClasses = (optionIndex) => {
    let classes = 'w-full text-left p-3 rounded-md border transition-all duration-200 '
    const isCorrectOption = optionIndex === correctAnswerIndex
    const isSelectedOption = optionIndex === selectedOptionIndex

    if (isAnswered) {
      // 已回答状态
      if (isCorrectOption) {
        // 正确答案：绿色高亮
        classes += 'bg-secondary/[0.1] border-secondary text-secondary font-medium '
      } else if (isSelectedOption && !isCorrectOption) {
        // 用户选错的答案：红色高亮
        classes += 'bg-red-100 border-red-400 text-red-600 font-medium dark:bg-red-900 dark:border-red-700 dark:text-red-400 '
      } else {
        // 其他未选中的错误选项：保持普通样式，但禁用
        classes += 'bg-gray-50 dark:bg-dark-3 border-stroke dark:border-dark-4 text-body-color dark:text-dark-7 '
      }
      classes += 'pointer-events-none ' // 提交后禁止点击
    } else {
      // 未回答状态
      classes += 'bg-gray-50 dark:bg-dark-2 border-stroke dark:border-dark-4 hover:bg-primary/[0.05] dark:hover:bg-dark-3 '
      if (isSelectedOption) {
        // 未回答但已选中（如果决定不即时反馈，而是有提交按钮时使用）
        // 在即时反馈模式下，这里不会被触发，因为点击后会立即进入 isAnswered 状态
        classes += 'ring-2 ring-primary '
      }
      classes += 'text-body-color dark:text-dark-7 '
    }
    return classes
  }

  const feedbackMessage = isAnswered
    ? (selectedOptionIndex === correctAnswerIndex ? '✅ 回答正确！' : '❌ 回答错误！')
    : ''

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
            disabled={isAnswered} // 回答后禁用所有按钮
            className={getOptionClasses(index)}
          >
            {String.fromCharCode(65 + index)}. {option}
          </button>
        ))}
      </div>

      {isAnswered && ( // 只有在回答后才显示反馈和重置按钮
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
