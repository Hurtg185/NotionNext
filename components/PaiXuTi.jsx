// /components/PaiXuTi.js (使用 dnd-kit 重写拖拽，增强用户体验)
import React, { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy, // 适用于水平列表
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// SortableItem 组件：每个可拖拽的词语卡片
const SortableItem = ({ id, word, isSubmitted, correctWords, currentOrderWords }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging // 判断是否正在拖拽
  } = useSortable({ id: id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto', // 拖拽时提高 Z-index
    opacity: isDragging ? 0.5 : 1 // 拖拽时透明度降低
  }

  const isCorrectPosition = isSubmitted && word === correctWords[currentOrderWords.indexOf(word)];
  const isInCorrectPosition = isSubmitted && word !== correctWords[currentOrderWords.indexOf(word)] && currentOrderWords.indexOf(word) !== -1;

  let classes = 'paixuti-item px-5 py-3 m-2 rounded-full shadow-md cursor-grab transition-all duration-200 text-lg font-semibold select-none '

  if (isSubmitted) {
    classes += 'cursor-not-allowed '
    if (isCorrectPosition) {
      classes += 'bg-secondary/[0.15] border-secondary text-secondary '
    } else if (isInCorrectPosition) {
      classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400 '
    } else {
      classes += 'bg-gray-2 dark:bg-dark-3 border-stroke dark:border-dark-4 text-body-color dark:text-dark-7 ' // 未选中且非正确答案的词语
    }
  } else {
    classes += 'bg-primary/[0.15] text-primary border border-primary/[0.4] hover:bg-primary/[0.25] active:bg-primary/[0.35] hover:shadow-lg '
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={classes}
    >
      {word}
    </div>
  )
}


const PaiXuTi = ({ words, explanation, question = '请将以下词语拖拽排序，组成一个正确的句子或短语：' }) => {
  // currentOrder 存储的是打乱后的词语字符串数组
  const [currentOrder, setCurrentOrder] = useState([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)

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

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖拽前需要移动8像素，避免误触
      },
    })
  )

  function handleDragEnd(event) {
    const { active, over } = event

    if (active.id !== over.id) {
      setCurrentOrder((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
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
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-bold mb-6 text-dark-DEFAULT dark:text-gray-1">
        {question}
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-wrap justify-center items-center min-h-[120px] p-4 border border-dashed border-stroke dark:border-dark-4 rounded-lg bg-gray-1 dark:bg-dark-2 shadow-inner">
          <SortableContext items={currentOrder} strategy={horizontalListSortingStrategy}>
            {currentOrder.map((word) => (
              <SortableItem
                key={word} // dnd-kit 要求 key 必须是 id
                id={word} // id 必须是唯一的
                word={word}
                isSubmitted={isSubmitted}
                correctWords={words}
                currentOrderWords={currentOrder}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>


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
          <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1">
                <i className="fas fa-lightbulb mr-2 text-warning"></i>解释：
          </h4>
          <p>{explanation}</p>
        </div>
      )}

      {isSubmitted && !isCorrect && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border-t-2 border-red-200 dark:border-red-700 rounded-b-xl text-body-color dark:text-dark-7 shadow-inner">
          <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1">
            <i className="fas fa-exclamation-circle mr-2 text-red-600 dark:text-red-400"></i>正确顺序是：
          </h4>
          <p className="text-red-600 dark:text-red-400 font-bold">{words.join(' ')}</p>
        </div>
      )}
    </div>
  )
}

export default PaiXuTi
