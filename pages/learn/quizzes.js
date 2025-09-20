// pages/learn/quizzes.js (使用 getStaticProps)
import React from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizBanksFromPortalPage } from '@/lib/quiz'; // 导入新函数

// 【核心修改】使用 getStaticProps 在服务器端获取数据
export async function getStaticProps() {
  const quizBanks = await getQuizBanksFromPortalPage();
  return {
    props: {
      quizBanks
    },
    revalidate: 60 // 每 60 秒重新生成一次页面，以获取 Notion 的最新更新
  };
}

const QuizzesListPage = ({ quizBanks }) => { // 【修改】从 props 接收 quizBanks
  const router = useRouter();

  // 【修改】移除 useEffect 和 loading state，因为数据已经由 getStaticProps 提供了

  if (!quizBanks || quizBanks.length === 0) {
    return (
      <LayoutBase>
        <div className="p-10 text-center text-red-500 dark:text-red-400">
          未找到任何题库。请检查 quiz.config.js 中的 QUIZ_PORTAL_PAGE_ID 是否正确，以及该页面是否已分享。
        </div>
      </LayoutBase>
    );
  }

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white text-center">中文学习题库</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
          {quizBanks.map(bank => (
            <div 
              key={bank.id} 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow duration-200"
              onClick={() => router.push(`/learn/quiz-bank/${bank.id}`)}
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{bank.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">点击开始学习</p>
            </div>
          ))}
        </div>
      </div>
    </LayoutBase>
  );
};

export default QuizzesListPage;
