// pages/learn/quiz/[quizId].js (单个题目作答页面)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizByIdFromNotion, getAllQuizzesFromNotionBanks } from '@/lib/quiz'; // 导入 Notion 题目获取函数

// 导入所有题型组件
import DanXuanTi from '@/themes/heo/components/quiz/DanXuanTi';
// import DuoXuanTi from '@/themes/heo/components/quiz/DuoXuanTi'; // 如果你有多选题，也导入

const SingleQuizPage = () => {
  const router = useRouter();
  const { quizId } = router.query;

  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [allQuizzes, setAllQuizzes] = useState([]); // 所有题目，用于导航
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuizData() {
      setLoading(true);
      if (!quizId) return;

      const quizzes = await getAllQuizzesFromNotionBanks(); // 拉取所有题目
      setAllQuizzes(quizzes);

      const foundQuiz = quizzes.find(q => q.id === quizId);
      setCurrentQuiz(foundQuiz);
      setLoading(false);
    }
    fetchQuizData();
  }, [quizId]);

  const handleAnswerSubmit = (submittedQuizId, selectedOption, isCorrect) => {
    console.log(`题目ID: ${submittedQuizId}, 用户选择: ${selectedOption}, 是否正确: ${isCorrect}`);
    setUserAnswers(prev => ({ ...prev, [submittedQuizId]: selectedOption }));
    // 可以在这里调用后端函数记录用户答案
  };

  const handleNextQuiz = () => {
    if (!currentQuiz) return;
    const currentIndex = allQuizzes.findIndex(q => q.id === currentQuiz.id);
    if (currentIndex !== -1 && currentIndex < allQuizzes.length - 1) {
      const nextQuiz = allQuizzes[currentIndex + 1];
      router.push(`/learn/quiz/${nextQuiz.id}`, undefined, { shallow: true });
    } else {
      alert('恭喜你，完成所有题目！');
      // 可以跳转到结果页面
    }
  };
  
  const hasUserAnsweredCurrentQuiz = userAnswers[currentQuiz?.id] !== undefined;

  // --- 渲染部分 ---

  if (loading) {
    return <LayoutBase><div className="p-10 text-center">加载题目中...</div></LayoutBase>;
  }

  if (!currentQuiz) {
    return <LayoutBase><div className="p-10 text-center text-red-500 dark:text-red-400">题目不存在或已下架。</div></LayoutBase>;
  }

  // 【核心】根据题目类型动态渲染组件
  const renderQuizComponent = () => {
    switch (currentQuiz.type) {
      case 'DanXuan':
        return (
          <DanXuanTi 
            quizData={currentQuiz} 
            onAnswerSubmit={handleAnswerSubmit} 
            userAnswer={userAnswers[currentQuiz.id]}
          />
        );
      // case 'DuoXuan':
      //   return (
      //     <DuoXuanTi 
      //       quizData={currentQuiz} 
      //       onAnswerSubmit={handleAnswerSubmit} 
      //       userAnswer={userAnswers[currentQuiz.id] || []}
      //     />
      //   );
      default:
        return (
          <div className="p-10 text-center text-red-500 dark:text-red-400">
            不支持的题型: {currentQuiz.type}
          </div>
        );
    }
  };

  return (
    <LayoutBase>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center pt-8 pb-8">
        {/* 顶部广告位 */}
        <div className="w-full max-w-2xl px-4 mb-6 text-center bg-gray-200 dark:bg-gray-700 h-24 flex items-center justify-center rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">这里是顶部广告位</p>
        </div>

        {/* 渲染题型组件 */}
        {renderQuizComponent()}

        {/* 下一题按钮 */}
        {hasUserAnsweredCurrentQuiz && (
          <div className="mt-6">
            <button
              onClick={handleNextQuiz}
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors"
            >
              {allQuizzes.findIndex(q => q.id === currentQuiz.id) < allQuizzes.length - 1 ? '下一题' : '完成测验'}
            </button>
          </div>
        )}
      </div>
    </LayoutBase>
  );
};

export default SingleQuizPage;
