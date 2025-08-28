// /components/MultipleChoiceQuestion.js

import React, { useState } from 'react';

/**
 * 多项选择题组件
 * 用户选择一个选项，立即获得反馈，并显示答案解析。
 *
 * @param {string} question - 题目问题描述。
 * @param {string[]} options - 选项数组，例如 ["选项A", "选项B", "选项C"]。
 * @param {number} correctAnswerIndex - 正确答案在 options 数组中的索引（从0开始）。
 * @param {string} explanation - 答案解析。
 */
const MultipleChoiceQuestion = ({ question, options, correctAnswerIndex, explanation }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);

  const handleOptionClick = (index) => {
    if (isAnswered) return; // 已经回答过就不能再选

    setSelectedOptionIndex(index);
    setIsAnswered(true);

    if (index === correctAnswerIndex) {
      setFeedback('✅ 回答正确！');
    } else {
      setFeedback('❌ 回答错误！');
    }
  };

  const resetQuestion = () => {
    setSelectedOptionIndex(null);
    setFeedback('');
    setIsAnswered(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 font-sans text-base">
      {/* 题目问题 */}
      <p className="mb-4 text-gray-800 dark:text-gray-100 font-semibold text-lg">
        {question}
      </p>

      {/* 选项 */}
      <div className="space-y-3 mb-4">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(index)}
            disabled={isAnswered}
            className={`w-full text-left p-3 rounded-md border transition-all duration-200 
                        ${isAnswered && index === correctAnswerIndex ? 'bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400 text-green-800 dark:text-green-200' : ''}
                        ${isAnswered && index !== correctAnswerIndex && index === selectedOptionIndex ? 'bg-red-100 border-red-500 dark:bg-red-900 dark:border-red-400 text-red-800 dark:text-red-200' : ''}
                        ${!isAnswered ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600' : ''}
                        ${!isAnswered && selectedOptionIndex === index ? 'ring-2 ring-blue-500' : ''}
                        text-gray-800 dark:text-gray-200`}
          >
            {String.fromCharCode(65 + index)}. {option}
          </button>
        ))}
      </div>

      {/* 反馈和重置按钮 */}
      {isAnswered && (
        <div className="mt-4">
          <p className={`font-semibold ${feedback.startsWith('✅') ? 'text-green-600' : 'text-red-600'} dark:${feedback.startsWith('✅') ? 'text-green-400' : 'text-red-400'} mb-2`}>
            {feedback}
          </p>
          {explanation && (
            <div className="p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md mb-3">
              <p className="font-semibold mb-1">解析：</p>
              <p>{explanation}</p>
            </div>
          )}
          <button
            onClick={resetQuestion}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            再试一次
          </button>
        </div>
      )}
    </div>
  );
};

export default MultipleChoiceQuestion;
