// /components/PinyinHanziQuiz.js - 看拼音写汉字组件
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件

/**
 * 看拼音写汉字组件
 * @param {Array<Object>|string} questionsProp - 题目数据数组或其 JSON 字符串。
 *   格式: [{ pinyin: 'nǐ hǎo', correctAnswers: ['你好'], hint: 'Hello' }]
 * @param {string} title - 组件标题
 */
const PinyinHanziQuiz = ({ questions: questionsProp, title = '看拼音写汉字' }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false); // 内部状态，用于确保只打乱一次

  const inputRef = useRef(null);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);

  // --- Prop 解析和数据初始化 ---
  useEffect(() => {
    let initialQuestions = [];
    if (typeof questionsProp === 'string') {
      try { initialQuestions = JSON.parse(questionsProp); } catch (e) { console.error("Error parsing questions JSON string:", e); initialQuestions = []; }
    } else if (Array.isArray(questionsProp)) { initialQuestions = questionsProp; }

    if (initialQuestions.length > 0 && !isShuffled) {
      setQuestions([...initialQuestions].sort(() => Math.random() - 0.5));
      setIsShuffled(true);
    }
  }, [questionsProp, isShuffled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3');
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3');
    }
  }, []);
  
  // 每次切换题目时，自动聚焦到输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex]);
  
  const currentQuestion = questions[currentIndex];

  const handleSubmit = useCallback(() => {
    if (!userInput.trim()) return; // 不允许提交空答案

    const result = currentQuestion.correctAnswers.includes(userInput.trim());
    setIsCorrect(result);
    setIsSubmitted(true);
    if (result) {
      correctAudioRef.current?.play().catch(e => console.error("Error playing sound", e));
    } else {
      wrongAudioRef.current?.play().catch(e => console.error("Error playing sound", e));
    }
  }, [userInput, currentQuestion]);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetQuestionState();
    } else {
      // 最后一题，可以提示用户已完成
      alert('恭喜你，全部完成了！');
    }
  };

  const resetQuestionState = () => {
    setUserInput('');
    setIsSubmitted(false);
    setIsCorrect(null);
    setShowHint(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 阻止表单默认提交行为
      if (!isSubmitted) {
        handleSubmit();
      } else {
        handleNext();
      }
    }
  };

  // --- 动态样式 ---
  const getInputClass = () => {
    let classes = 'w-full text-center text-4xl p-4 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-4 ';
    if (isSubmitted) {
      if (isCorrect) {
        classes += 'bg-green-100 border-green-500 text-green-800 ring-green-300';
      } else {
        classes += 'bg-red-100 border-red-500 text-red-800 ring-red-300';
      }
    } else {
      classes += 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-primary/[.5] focus:border-primary';
    }
    return classes;
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3 text-body-color dark:text-dark-7">
        <p className="text-lg font-semibold text-center">没有题目数据。请提供 questions 数组。</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-dark-DEFAULT dark:text-gray-1">{title}</h3>
        <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* 拼音展示区 */}
      <div className="flex items-center justify-center bg-gray-100 dark:bg-dark-2 p-6 rounded-lg shadow-inner mb-6">
        <p className="text-5xl font-serif text-primary dark:text-yellow-400 select-none">
          {currentQuestion.pinyin}
        </p>
        <TextToSpeechButton text={currentQuestion.pinyin} lang="zh-CN" className="ml-4 text-3xl" />
      </div>

      {/* 汉字输入区 */}
      <div className="mb-6">
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="在这里输入汉字"
          className={getInputClass()}
          disabled={isSubmitted}
          autoFocus
        />
      </div>
      
      {/* 提示和答案反馈区 */}
      <div className="min-h-[80px] flex flex-col justify-center items-center">
        {isSubmitted ? (
            // 已提交
            isCorrect ? (
                <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        <i className="fas fa-check-circle mr-2"></i>回答正确！
                    </p>
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                        <i className="fas fa-times-circle mr-2"></i>回答错误！
                    </p>
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                        正确答案是：<span className="font-bold text-primary dark:text-yellow-400">{currentQuestion.correctAnswers.join(' / ')}</span>
                    </p>
                </div>
            )
        ) : (
            // 未提交
            currentQuestion.hint && (
                <button
                    onClick={() => setShowHint(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg shadow transition-all duration-300 ${showHint ? 'bg-gray-200 dark:bg-dark-3 text-gray-700 dark:text-gray-300' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200'}`}
                    disabled={showHint}
                >
                    {showHint ? (
                        <>
                            <i className="fas fa-eye mr-2"></i>
                            {currentQuestion.hint}
                        </>
                    ) : (
                        <>
                           <i className="fas fa-lightbulb mr-2"></i>
                            显示提示
                        </>
                    )}
                </button>
            )
        )}
      </div>

      {/* 操作按钮区 */}
      <div className="mt-6 flex justify-center">
        {isSubmitted ? (
          <button
            onClick={handleNext}
            className="w-full px-8 py-4 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 text-xl"
          >
            {currentIndex < questions.length - 1 ? '下一题' : '完成'}
            <i className="fas fa-arrow-right ml-2"></i>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="w-full px-8 py-4 bg-green-500 text-white font-bold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 text-xl"
            disabled={!userInput.trim()}
          >
            提交
          </button>
        )}
      </div>
    </div>
  );
};

export default PinyinHanziQuiz;
