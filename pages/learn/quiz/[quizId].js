// pages/learn/quiz/[quizId].js (使用 getStaticProps)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizByIdFromNotion, getAllQuizzesFromNotionBanks } from '@/lib/quiz';

import DanXuanTi from '@/themes/heo/components/quiz/DanXuanTi';
// import DuoXuanTi from '@/themes/heo/components/quiz/DuoXuanTi';

export async function getStaticProps({ params }) {
  const { quizId } = params;
  const currentQuiz = await getQuizByIdFromNotion(quizId);
  const allQuizzes = await getAllQuizzesFromNotionBanks(); // 获取所有题目用于“下一题”
  
  return {
    props: {
      currentQuiz,
      allQuizzes
    },
    revalidate: 60
  };
}

export async function getStaticPaths() {
  const allQuizzes = await getAllQuizzesFromNotionBanks();
  const paths = allQuizzes.map(quiz => ({ params: { quizId: quiz.id } }));
  return {
    paths,
    fallback: true
  };
}

const SingleQuizPage = ({ currentQuiz, allQuizzes }) => {
  const router = useRouter();
  const [userAnswers, setUserAnswers] = useState({});

  if (router.isFallback) {
    return <LayoutBase><div className="p-10 text-center">加载题目中...</div></LayoutBase>;
  }

  if (!currentQuiz) {
    return <LayoutBase><div className="p-10 text-center text-red-500 dark:text-red-400">题目不存在或已下架。</div></LayoutBase>;
  }
  
  // ... (你的 handleAnswerSubmit, handleNextQuiz 等逻辑保持不变，但 allQuizzes 现在从 props 获取) ...

  const handleNextQuiz = () => {
    if (!currentQuiz) return;
    const currentIndex = allQuizzes.findIndex(q => q.id === currentQuiz.id);
    if (currentIndex !== -1 && currentIndex < allQuizzes.length - 1) {
      const nextQuiz = allQuizzes[currentIndex + 1];
      router.push(`/learn/quiz/${nextQuiz.id}`);
    } else {
      alert('恭喜你，完成所有题目！');
    }
  };
  
  // ...

  return (
    <LayoutBase>
      {/* ... (你的 JSX) ... */}
    </LayoutBase>
  );
};

export default SingleQuizPage;
