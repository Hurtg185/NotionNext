// /components/PinyinInputExercise.js

import React, { useState } from 'react';

/**
 * 互动式拼音输入练习组件
 * 用户输入拼音对应的汉字，通过系统输入法转换为汉字，然后检查答案。
 *
 * @param {string} question - 题目问题描述。
 * @param {string} pinyinPrompt - 拼音提示，例如 "ni hao"。
 * @param {string} correctAnswer - 正确的汉字答案，例如 "你好"。
 * @param {string} explanation - 答案解析。
 */
const PinyinInputExercise = ({ question, pinyinPrompt, correctAnswer, explanation }) => {
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
    setFeedback(''); // 用户重新输入时清空反馈
    setShowExplanation(false);
  };

  const checkAnswer = () => {
    if (userInput.trim() === correctAnswer.trim()) {
      setFeedback('✅ 太棒了！回答正确！');
    } else {
      setFeedback('❌ 不对哦，请再试一次！');
    }
    setShowExplanation(true); // 检查后显示解析
  };

  const resetExercise = () => {
    setUserInput('');
    setFeedback('');
    setShowExplanation(false);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-4 font-sans text-base">
      {/* 题目问题 */}
      {question && (
        <p className="mb-3 text-gray-700 dark:text-gray-200">
          <strong>问题：</strong>{question}
        </p>
      )}
      
      {/* 拼音提示 */}
      {pinyinPrompt && (
        <p className="mb-3 text-gray-600 dark:text-gray-400">
          请根据拼音提示输入汉字：<code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm text-sm">{pinyinPrompt}</code>
        </p>
      )}

      {/* 输入框 */}
      <input
        type="text"
        value={userInput}
        onChange={handleInputChange}
        placeholder="在此输入汉字..."
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* 按钮组 */}
      <div className="flex space-x-2">
        <button
          onClick={checkAnswer}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200"
        >
          检查答案
        </button>
        <button
          onClick={resetExercise}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition-colors duration-200"
        >
          重置
        </button>
      </div>

      {/* 反馈信息 */}
      {feedback && (
        <p className={`mt-3 font-semibold ${feedback.startsWith('✅') ? 'text-green-600' : 'text-red-600'} dark:${feedback.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {feedback}
        </p>
      )}

      {/* 答案解析 (点击检查后显示) */}
      {showExplanation && explanation && (
        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md">
          <p className="font-semibold mb-1">正确答案：<span className="text-green-700 dark:text-green-300">{correctAnswer}</span></p>
          <p>解析：{explanation}</p>
        </div>
      )}
    </div>
  );
};

export default PinyinInputExercise;
