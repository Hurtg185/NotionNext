// pages/learn/quiz-bank/[dbId].js (使用 getStaticProps)
import React from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizzesFromDatabase, getQuizBanksFromPortalPage } from '@/lib/quiz';
import BLOG from '@/blog.config'; // 导入配置，但现在可能不需要了

// 【核心修改】使用 getStaticProps 和 getStaticPaths
export async function getStaticProps({ params }) {
  const { dbId } = params;
  const allBanks = await getQuizBanksFromPortalPage();
  const currentBank = allBanks.find(bank => bank.id === dbId);

  let quizzes = [];
  if (currentBank) {
    quizzes = await getQuizzesFromDatabase(dbId, currentBank.quizType);
  }

  return {
    props: {
      quizzes,
      bankName: currentBank?.title || '未知题库'
    },
    revalidate: 60
  };
}

export async function getStaticPaths() {
  const quizBanks = await getQuizBanksFromPortalPage();
  const paths = quizBanks.map(bank => ({ params: { dbId: bank.id } }));
  return {
    paths,
    fallback: true // 允许新的题库被动态生成
  };
}

const QuizBankPage = ({ quizzes, bankName }) => {
  const router = useRouter();

  if (router.isFallback) {
    return <LayoutBase><div className="p-10 text-center">正在加载题目...</div></LayoutBase>;
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
