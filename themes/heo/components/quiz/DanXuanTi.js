// themes/heo/components/quiz/DanXuanTi.js (新建文件)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { HiCheckCircle, HiXCircle, HiVolumeUp } from 'react-icons/hi';
import { getPinyin } from 'pinyin-pro';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const speakText = (text, lang = 'zh-CN') => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('您的浏览器不支持语音合成API。');
  }
};

const DanXuanTi = ({ quizData, onAnswerSubmit, isReviewMode = false, userAnswer = null }) => {
  const { control, handleSubmit, reset } = useForm();
  const [selectedOption, setSelectedOption] = useState(userAnswer);
  const [isSubmitted, setIsSubmitted] = useState(isReviewMode);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showPinyin, setShowPinyin] = useState(false);
  const pinyin = quizData.question.text ? getPinyin(quizData.question.text) : '';

  useEffect(() => {
    reset();
    setSelectedOption(userAnswer);
    setIsSubmitted(isReviewMode);
    if (isReviewMode && quizData && userAnswer) {
      setIsCorrect(quizData.correctAnswer === userAnswer);
    } else {
      setIsCorrect(false);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [quizData, isReviewMode, userAnswer, reset]);

  const handleOptionClick = (optionId) => {
    if (!isSubmitted) {
      setSelectedOption(optionId);
    }
  };

  const onSubmit = () => {
    if (!selectedOption) {
      alert('请选择一个答案！');
      return;
    }
    setIsSubmitted(true);
    const correct = quizData.correctAnswer === selectedOption;
    setIsCorrect(correct);
    if (onAnswerSubmit) {
      onAnswerSubmit(quizData.id, selectedOption, correct);
    }
  };

  const TTSButton = ({ text, lang }) => (
    <button
      onClick={(e) => { e.stopPropagation(); speakText(text, lang); }}
      className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
      aria-label="朗读"
    >
      <HiVolumeUp className="w-5 h-5" />
    </button>
  );

  if (!quizData) {
    return <div className="p-4 text-red-500">题目数据加载失败。</div>;
  }

  return (
    <motion.div 
      initial="hidden" 
      animate="visible" 
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl mx-auto my-8 w-full"
    >
      <motion.h2 variants={itemVariants} className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        {quizData.title || '单项选择题'}
      </motion.h2>

      <motion.div variants={itemVariants} className="mb-6 text-lg text-gray-700 dark:text-gray-300">
        <div className="flex items-center">
          <p className="whitespace-pre-wrap">{quizData.question.text}</p>
          <TTSButton text={quizData.question.text} lang="zh-CN" />
          {quizData.question.text && (
            <button 
              onClick={() => setShowPinyin(prev => !prev)}
              className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm"
            >
              {showPinyin ? '隐藏拼音' : '显示拼音'}
            </button>
          )}
        </div>
        {showPinyin && pinyin && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pinyin}</p>
        )}
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="answer"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <div className="space-y-3">
              {quizData.options.map((option) => (
                <motion.div variants={itemVariants} key={option.id}>
                  <button
                    type="button"
                    onClick={() => handleOptionClick(option.id)}
                    className={`
                      w-full p-4 rounded-lg text-left transition-all duration-200
                      ${isSubmitted
                          ? (option.id === quizData.correctAnswer
                              ? 'bg-green-100 dark:bg-green-700 border-2 border-green-500 text-green-800 dark:text-white'
                              : (option.id === selectedOption && !isCorrect
                                  ? 'bg-red-100 dark:bg-red-700 border-2 border-red-500 text-red-800 dark:text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200')
                            )
                          : (option.id === selectedOption
                              ? 'bg-blue-100 dark:bg-blue-700 border-2 border-blue-500 text-blue-800 dark:text-white'
                              : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600')
                      }
                      flex items-center justify-between
                    `}
                    disabled={isSubmitted && option.id !== selectedOption}
                  >
                    <span className="font-medium mr-2">{option.id.toUpperCase()}.</span>
                    <span className="flex-grow">{option.text}</span>
                    <TTSButton text={option.text} lang="zh-CN" />
                    {isSubmitted && option.id === quizData.correctAnswer && <HiCheckCircle className="text-green-500 text-2xl ml-2" />}
                    {isSubmitted && option.id === selectedOption && !isCorrect && <HiXCircle className="text-red-500 text-2xl ml-2" />}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        />

        <motion.div variants={itemVariants} className="mt-6 flex justify-end">
          {!isSubmitted && (
            <button
              type="submit"
              disabled={!selectedOption}
              className="px-6 py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              提交答案
            </button>
          )}
          {isSubmitted && (
            <div className={`p-3 rounded-md font-bold text-white ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
              {isCorrect ? '回答正确！' : '回答错误。'}
            </div>
          )}
        </motion.div>

        {isSubmitted && quizData.explanation && (
          <motion.div variants={itemVariants} className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
            <h4 className="font-bold mb-2">答案解释：</h4>
            <div className="flex items-center">
                <p>{quizData.explanation}</p>
                <TTSButton text={quizData.explanation} lang="zh-CN" />
            </div>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
};

export default DanXuanTi;
