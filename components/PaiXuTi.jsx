// components/PaiXuTi.jsx
import React, { useState, useEffect, useRef } from 'react'

const PaiXuTi = ({ words, explanation, question = '请将以下词语拖拽排序，组成一个正确的句子或短语：' }) => {
  const [currentOrder, setCurrentOrder] = useState([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null) // null:未提交, true:正确, false:错误

  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  useEffect(() => {
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)
    setCurrentOrder(shuffledWords)
  }, [words])

  const handleDragStart = (e, index) => {
    dragItem.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.classList.add('opacity-50', 'ring-2', 'ring-primary')
  }

  const handleDragEnter = (e, index) => {
    if (!isSubmitted) {
      dragOverItem.current = index
      e.currentTarget.classList.add('scale-105')
    }
  }

  const handleDragLeave = (e) => {
    if (!isSubmitted) {
      e.currentTarget.classList.remove('scale-105')
    }
  }

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-50', 'ring-2', 'ring-primary')
    const items = document.querySelectorAll('.paixuti-item')
    items.forEach(item => item.classList.remove('scale-105'))


    if (!isSubmitted && dragItem.current !== null && dragOverItem.current !== null) {
      const newOrder = [...currentOrder]
      const draggedItemContent = newOrder[dragItem.current]
      newOrder.splice(dragItem.current, 1)
      newOrder.splice(dragOverItem.current, 0, draggedItemContent)

      setCurrentOrder(newOrder)
      dragItem.current = null
      dragOverItem.current = null
    }
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
    const correctOrderString = words.join('')
    const currentOrderString = currentOrder.join('')
    setIsCorrect(currentOrderString === correctOrderString)
  }

  const handleReset = () => {
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)
    setCurrentOrder(shuffledWords)
    setIsSubmitted(false)
    setIsCorrect(null)
  }

  const getItemClasses = (index) => {
    let classes = 'paixuti-item px-5 py-3 m-2 bg-primary/[0.1] text-primary border border-primary/[0.3] rounded-full shadow-sm cursor-grab transition-all duration-200 text-lg font-medium '
    if (isSubmitted) {
      classes += 'cursor-not-allowed '
      if (currentOrder[index] === words[index]) {
        classes += 'bg-secondary/[0.1] border-secondary text-secondary '
      } else {
        classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400 '
      }
    } else {
      classes += 'hover:bg-primary/[0.2] active:bg-primary/[0.3] '
    }
    return classes
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-semibold mb-6 text-dark-DEFAULT dark:text-gray-1">
        {question}
      </h3>

      <div className="flex flex-wrap justify-center items-center min-h-[120px] p-4 border border-dashed border-stroke dark:border-dark-4 rounded-lg bg-gray-1 dark:bg-dark-2">
        {currentOrder.map((word, index) => (
          <div
            key={word + index}
            draggable={!isSubmitted}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={getItemClasses(index)}
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
            <i className="fas fa-exclamation-circle mr-2 text-red-600 dark:text-red-400"></i>正确顺序是：
          </h4>
          <p className="text-red-600 dark:text-red-400 font-bold">{words.join(' ')}</p>
        </div>
      )}
    </div>
  )
}

export default PaiXuTi
