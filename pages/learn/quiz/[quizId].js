// pages/learn/quiz/[quizId].js (修改 getStaticPaths)
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizByIdFromNotion } from '@/lib/quiz';

import DanXuanTi from '@/themes/heo/components/quiz/DanXuanTi';

// 【核心修改】只在 getStaticProps 中获取数据
export async function getStaticProps({ params }) {
  const { quizId } = params;
  const currentQuiz = await getQuizByIdFromNotion(quizId);
  
  // 如果找不到题目，返回 notFound
  if (!currentQuiz) {
    return { notFound: true };
  }

  return {
    props: {
      currentQuiz
    },
    revalidate: 60
  };
}

// 【核心修改】getStaticPaths 使用 fallback: 'blocking'
// 这意味着在构建时不生成任何路径
// 当用户首次访问一个新 quizId 时，服务器会先生成页面，然后再返回给用户
export async function getStaticPaths() {
  return {
    paths: [], // 不预渲染任何路径
    fallback: 'blocking' // 或 'true'
  };
}

const SingleQuizPage = ({ currentQuiz }) => {
  const router = useRouter();
  const [userAnswers, setUserAnswers] = useState({});

  if (router.isFallback) {
    return <LayoutBase><div className="p-10 text-center">正在为您生成题目...</div></LayoutBase>;
  }

  // ... (你的 handleAnswerSubmit, handleNextQuiz 等逻辑保持不变) ...
  // 【重要】handleNextQuiz 需要重新获取所有题目，因为 props 中不再有 allQuizzes
  const handleNextQuiz = async () => {
    // ... (这里需要重新 fetch allQuizzes 或者从父页面传递)
    alert('下一题功能需要调整。');
  };

  return (
    <LayoutBase>
      {/* ... (你的 JSX) ... */}
    </LayoutBase>
  );
};

export default SingleQuizPage;
