// /components/PaiXuTi.js (最终版：点击朗读 + 多正确答案 + 增强选中反馈)
import React, { useState, useEffect, useRef } from 'react'
import TextToSpeechButton from './TextToSpeechButton' // 朗读按钮

const PaiXuTi = ({ words, explanation, question = '请将以下词语点击交换位置，组成一个正确的句子或短语：' }) => {
  const [currentOrder, setCurrentOrder] = useState([]) // 用户当前排列的词语顺序
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [firstClickedIndex, setFirstClickedIndex] = useState(null) // 记录第一次点击的词语索引

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)
  
  const speechSynthesisUtteranceRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  // 内部状态，用于存储所有可能的正确答案（字符串形式，例如 "我喜欢学习中文"）
  const correctAnswersJoined = useRef([]);
  // 内部状态，用于存储第一个正确答案的词语数组，用于卡片位置判断（绿色/红色高亮）
  const primaryCorrectWords = useRef([]); 

  // 预定义的卡片颜色数组 (调整，使其在白色背景下更突出)
  const cardColors = [
    'bg-primary/[0.1] text-primary border-primary/[0.3]',
    'bg-secondary/[0.1] text-secondary border-secondary/[0.3]',
    'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 border-blue-400 dark:border-blue-700',
    'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 border-green-400 dark:border-green-700',
    'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 border-yellow-400 dark:border-yellow-700',
    'bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 border-purple-400 dark:border-purple-700',
    'bg-pink-200 dark:bg-pink-800 text-pink-900 dark:text-pink-100 border-pink-400 dark:border-pink-700',
    'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 border-indigo-400 dark:border-indigo-700',
    'bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100 border-teal-400 dark:border-teal-700',
    'bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100 border-orange-400 dark:border-orange-700',
    'bg-cyan-200 dark:bg-cyan-800 text-cyan-900 dark:text-cyan-100 border-cyan-400 dark:border-cyan-700',
    'bg-lime-200 dark:bg-lime-800 text-lime-900 dark:text-lime-100 border-lime-400 dark:border-lime-700',
    'bg-fuchsia-200 dark:bg-fuchsia-800 text-fuchsia-900 dark:text-fuchsia-100 border-fuchsia-400 dark:border-fuchsia-700',
    'bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 border-rose-400 dark:border-rose-700',
  ];

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

    // 处理 words prop：如果是一个数组的数组，则提取所有可能的正确答案字符串
    // 并且打乱第一个正确答案的词语数组作为初始顺序
    if (Array.isArray(words) && words.length > 0 && Array.isArray(words[0])) {
      primaryCorrectWords.current = words[0]; // 第一个子数组作为主要参考答案，用于卡片高亮
      correctAnswersJoined.current = words.map(arr => arr.join('')); // 所有正确答案的字符串形式
    } else if (Array.isArray(words) && words.length > 0 && typeof words[0] === 'string') {
      // 如果 words 仍然是单个词语数组 (旧格式)，兼容处理
      primaryCorrectWords.current = words;
      correctAnswersJoined.current = [words.join('')];
    } else {
      console.error("PaiXuTi: 'words' prop must be an array of strings or an array of arrays of strings.");
      primaryCorrectWords.current = [];
      correctAnswersJoined.current = [];
    }

    const shuffledWords = [...primaryCorrectWords.current].sort(() => Math.random() - 0.5);
    setCurrentOrder(shuffledWords);

    return () => {
      if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, [words]) // 依赖 words，当题目内容变化时重新打乱/处理

  const playSound = (isCorrect) => {
    if (isCorrect && correctAudioRef.current) {
      correctAudioRef.current.currentTime = 0;
      correctAudioRef.current.play().catch(e => console.error("Error playing correct sound:", e))
    } else if (!isCorrect && wrongAudioRef.current) {
      wrongAudioRef.current.currentTime = 0;
      wrongAudioRef.current.play().catch(e => console.error("Error playing wrong sound:", e))
    }
  }

  // 朗读词语文本的函数
  const speakWordText = (textToSpeak) => {
    if (speechSynthesisRef.current && textToSpeak) {
      if (speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel(); // 如果正在朗读，先停止
      }
      speechSynthesisUtteranceRef.current.text = textToSpeak;
      speechSynthesisRef.current.speak(speechSynthesisUtteranceRef.current);
    }
  };


  const handleWordClick = (index) => {
    if (isSubmitted) return // 提交后不能再点击

    const clickedWord = currentOrder[index]; // 获取被点击的词语
    speakWordText(clickedWord); // <--- 修正：点击词语时朗读

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
      setFirstClickedIndex(null) // 交换后重置第一次点击
    }
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
    const currentOrderString = currentOrder.join('') // 用户当前排列的字符串

    // 检查用户答案是否匹配任何一个正确答案
    const result = correctAnswersJoined.current.includes(currentOrderString); // <--- 修正：检查是否包含在多个正确答案中
    setIsCorrect(result)
    playSound(result)
  }

  const handleReset = () => {
    if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }
    const shuffledWords = [...primaryCorrectWords.current].sort(() => Math.random() - 0.5) // <--- 修正：打乱 primaryCorrectWords
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
      // 判断当前位置的词语是否与 primaryCorrectWords 中对应位置的词语匹配
      if (currentOrder[index] === primaryCorrectWords.current[index]) { // <--- 修正：与 primaryCorrectWords[index] 比较
        classes += 'bg-secondary/[0.15] border-secondary text-secondary shadow-lg ';
      } else {
        classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400 shadow-lg ';
      }
    } else {
      // 未提交状态
      classes += 'hover:scale-[1.03] hover:shadow-lg '; // 悬停放大和加深阴影
      if (firstClickedIndex === index) {
        // === 第一次点击卡片的增强视觉反馈 ===
        classes += 'ring-4 ring-offset-2 ring-primary scale-110 shadow-xl relative z-10 '; // 更大的放大，更强的阴影，更高的层级
        classes += 'text-primary dark:text-primary '; // 强调文本颜色为主题色
        // =====================================
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
            {/* 显示所有可能的正确答案 */}
            {correctAnswersJoined.current.map((answerStr, idx) => (
              <React.Fragment key={idx}>
                {answerStr.split('').join(' ')} {/* 为了朗读和显示，重新用空格连接 */}
                <TextToSpeechButton text={answerStr} lang="zh-CN" />
                {idx < correctAnswersJoined.current.length - 1 && <span className="ml-2 mr-2">或</span>}
              </React.Fragment>
            ))}
          </h4>
          {/* 这里可以保留一个简洁的显示，或者完全依赖上面 H4 里的详细显示 */}
          <p className="text-red-600 dark:text-red-400 font-bold">
            {/* 这里的 p 标签可以根据需要调整，目前是显示所有答案 */}
            {correctAnswersJoined.current.map((answerStr, idx) => (
              <span key={`p-ans-${idx}`}>
                {answerStr}
                {idx < correctAnswersJoined.current.length - 1 && <span className="ml-1 mr-1">/</span>}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

export default PaiXuTi
