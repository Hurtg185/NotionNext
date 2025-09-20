// pages/learn/quiz-bank/[dbId].js (修复 getStaticPaths)
import React from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizzesFromDatabase, getQuizBanksFromPortalPage } from '@/lib/quiz';

// 【核心修改】getStaticProps 保持不变，但 getStaticPaths 改变
export async function getStaticProps({ params }) {
  const { dbId } = params;
  const allBanks = await getQuizBanksFromPortalPage();
  const currentBank = allBanks.find(bank => bank.id === dbId);

  let quizzes = [];
  if (currentBank) {
    quizzes = await getQuizzesFromDatabase(dbId, currentBank.quizType);
  }

  // 如果找不到题库或题目，返回 notFound
  if (!currentBank) {
    return { notFound: true };
  }

  return {
    props: {
      quizzes,
      bankName: currentBank.title
    },
    revalidate: 60
  };
}

// 【核心修改】getStaticPaths 使用 fallback: 'blocking'
// 这意味着在构建时不生成任何路径
// 当用户首次访问一个新 dbId 时，服务器会先生成页面，然后再返回给用户
export async function getStaticPaths() {
  return {
    paths: [], // 不预渲染任何路径
    fallback: 'blocking'
  };
}

const QuizBankPage = ({ quizzes, bankName }) => {
  const router = useRouter();

  if (router.isFallback) {
    return <LayoutBase><div className="p-10 text-center">正在为您生成题库...</div></LayoutBase>;
  }

  if (!quizzes || !quizzes.length) {
    return <LayoutBase><div className="p-10 text-center text-red-500 dark:text-red-400">该题库不存在或暂无题目。</div></LayoutBase>;
  }

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white text-center">
          {bankName} - 题目列表
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map(quiz => (
            <div 
              key={quiz.id} 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-5 cursor-pointer hover:shadow-xl transition-shadow duration-200"
              onClick={() => router.push(`/learn/quiz/${quiz.id}`)}
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{quiz.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 truncate">{quiz.question.text}</p>
              {/* ... (其他信息) ... */}
            </div>
          ))}
        </div>
      </div>
    </LayoutBase>
  );
};

export default QuizBankPage;
