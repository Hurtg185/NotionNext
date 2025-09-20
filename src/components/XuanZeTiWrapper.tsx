// src/components/XuanZeTiWrapper.tsx

import React from 'react';
import {
  AnyQuizData,
  DanXuanQuizData,
  DuoXuanQuizData,
  UserAnswer,
  QuizType
} from '../types/quiz';
import DanXuanTi from './DanXuanTi';
import DuoXuanTi from './DuoXuanTi';

interface XuanZeTiWrapperProps {
  quizData: AnyQuizData;
  onAnswerSubmit: (quizId: string, selectedAnswer: string | string[], isCorrect: boolean) => void;
  isReviewMode?: boolean;
  userAnswer?: UserAnswer;
}

const XuanZeTiWrapper: React.FC<XuanZeTiWrapperProps> = ({
  quizData,
  onAnswerSubmit,
  isReviewMode,
  userAnswer,
}) => {
  if (!quizData) {
    return <div className="text-center text-gray-600 p-8">加载中或题目数据错误...</div>;
  }

  const commonProps = {
    onAnswerSubmit,
    isReviewMode,
    userAnswer,
  };

  // 占位符组件，用于未来扩展其他题型时使用
  const PlaceholderComponent = ({ quizType, quizData }: { quizType: QuizType, quizData: AnyQuizData }) => (
    <div className="max-w-2xl mx-auto p-6 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
      <p className="font-bold">{quizType}组件 (尚未实现)。</p>
      <p className="text-sm">题目ID: {quizData.id}, 题目名称: {quizData.question.text}</p>
    </div>
  );

  switch (quizData.type) {
    case 'DanXuan':
      return <DanXuanTi quizData={quizData as DanXuanQuizData} {...commonProps} />;
    case 'DuoXuan':
      return <DuoXuanTi quizData={quizData as DuoXuanQuizData} {...commonProps} />;
    // 暂时移除其他题型的 case，只保留选择题
    default:
      return (
        <div className="max-w-2xl mx-auto p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <p className="font-bold">错误: 不支持的题型 "{(quizData as AnyQuizData).type}"。</p>
          <p className="text-sm">请检查 quizData.type 是否为 'DanXuan' 或 'DuoXuan'。</p>
        </div>
      );
  }
};

export default XuanZeTiWrapper;
