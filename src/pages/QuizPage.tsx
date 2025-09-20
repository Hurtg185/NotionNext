// src/pages/QuizPage.tsx

import React, { useState } from 'react';
import XuanZeTiWrapper from '../components/XuanZeTiWrapper';
import {
  DanXuanQuizData,
  DuoXuanQuizData,
  AnyQuizData,
  UserAnswer,
  Option,
  QuizType,
} from '../types/quiz';

// 模拟从Notion转换后的数据结构
// 这个函数现在只处理 DanXuan 和 DuoXuan，并且会处理 Notion 的纯数字ID和选项大写
const transformNotionDataToQuizData = (
  notionPageData: any, // 模拟Notion原始数据，Any类型
  quizType: QuizType
): AnyQuizData => {
  const baseData = {
    id: notionPageData['题目ID'].toString(), // 确保 ID 是字符串
    question: {
      text: notionPageData['题目名称'],
      imageUrl: null,
      audioUrl: null,
    },
    analysis: notionPageData['答案解析'] || undefined,
  };

  if (quizType === 'DanXuan' || quizType === 'DuoXuan') {
    const options: Option[] = [];
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((letter) => { // 选项大写 A-F
      const optionKey = `选项${letter}`;
      if (notionPageData[optionKey]) {
        options.push({ id: letter, text: notionPageData[optionKey] });
      }
    });
    return {
      ...baseData,
      type: quizType,
      options: options,
      ...(quizType === 'DanXuan'
        ? { correctAnswer: notionPageData['正确答案'].toString().toUpperCase() } // 确保单选答案是大写
        : { correctAnswers: Array.isArray(notionPageData['正确答案']) // 多选答案可能是数组或逗号分隔字符串
            ? notionPageData['正确答案'].map((id: string) => id.toString().toUpperCase())
            : (notionPageData['正确答案'] ? notionPageData['正确答案'].split(',').map((id: string) => id.trim().toUpperCase()) : [])
          }),
    } as AnyQuizData;
  }

  throw new Error(`Unsupported quiz type for transformation: ${quizType}`);
};


// --- 模拟 Notion 原始数据 (纯数字ID, 选项大写) ---

const mockNotionDanXuanData = {
  '题目ID': 101, // 纯数字ID
  '题目名称': '下列哪个城市是中国的首都？',
  '选项A': '上海',
  '选项B': '北京',
  '选项C': '广州',
  '选项D': '深圳',
  '正确答案': 'B', // 大写字母
  '答案解析': '北京是中华人民共和国的首都，也是中国的政治、文化中心。',
};

const mockNotionDuoXuanData = {
  '题目ID': 1001, // 纯数字ID
  '题目名称': '请选择所有红色的水果：',
  '选项A': '苹果',
  '选项B': '香蕉',
  '选项C': '草莓',
  '选项D': '橙子',
  '选项E': '樱桃',
  '正确答案': ['A', 'C', 'E'], // 大写字母数组
  '答案解析': '苹果、草莓和樱桃通常是红色的，香蕉是黄色，橙子是橙色。',
};


// 转换为我们组件所需的数据结构
const sampleQuizDanXuan = transformNotionDataToQuizData(mockNotionDanXuanData, 'DanXuan');
const sampleQuizDuoXuan = transformNotionDataToQuizData(mockNotionDuoXuanData, 'DuoXuan');


const quizzes: AnyQuizData[] = [
  sampleQuizDanXuan,
  sampleQuizDuoXuan,
];

const QuizPage: React.FC = () => {
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const currentQuiz = quizzes[currentQuizIndex];
  const [mode, setMode] = useState<'answer' | 'review'>('answer');
  const [userAnswerHistory, setUserAnswerHistory] = useState<{ [quizId: string]: UserAnswer }>({});
  const [quizResults, setQuizResults] = useState<{ [quizId: string]: { selected: UserAnswer, correct: boolean } }>({});

  const handleAnswerSubmit = (quizId: string, selectedAnswer: string | string[], isCorrect: boolean) => {
    console.log(`题目ID: ${quizId}, 提交答案: ${selectedAnswer}, 是否正确: ${isCorrect}`);
    setUserAnswerHistory(prev => ({ ...prev, [quizId]: selectedAnswer }));
    setQuizResults(prev => ({ ...prev, [quizId]: { selected: selectedAnswer, correct: isCorrect } }));
  };

  const goToNextQuiz = () => {
    setCurrentQuizIndex(prev => (prev + 1) % quizzes.length);
    setMode('answer');
  };

  const toggleMode = () => {
    setMode(prev => (prev === 'answer' ? 'review' : 'answer'));
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="text-center mb-8 text-gray-500">
        <p>这里是顶部广告位</p>
        <p className="text-sm">XuanZeTi 组件本身不包含此区域</p>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={goToNextQuiz}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 transition"
        >
          下一题 ({currentQuiz.type === 'DanXuan' ? '单选' : '多选'})
        </button>
        <button
          onClick={toggleMode}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          切换模式 ({mode === 'answer' ? '当前作答模式' : '当前复习模式'})
        </button>
      </div>

      {currentQuiz && (
        <XuanZeTiWrapper
          quizData={currentQuiz}
          onAnswerSubmit={handleAnswerSubmit}
          isReviewMode={mode === 'review'}
          userAnswer={userAnswerHistory[currentQuiz.id] || null}
        />
      )}
    </div>
  );
};

export default QuizPage;
