// pages/learn/quiz-bank/[dbId].js (单个题库的题目列表)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo';
import { getQuizzesFromDatabase, getQuizBanksFromPortalPage } from '@/lib/quiz';

const QuizBankPage = () => {
  const router = useRouter();
  const { dbId } = router.query;

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankName, setBankName] = useState('未知题库');

  useEffect(() => {
    async function fetchQuizzes() {
      setLoading(true);
      if (!dbId) return;

      const allBanks = await getQuizBanksFromPortalPage();
      const currentBank = allBanks.find(bank => bank.id === dbId);

      if (currentBank) {
        setBankName(currentBank.title);
        const fetchedQuizzes = await getQuizzesFromDatabase(dbId, currentBank.quizType);
        setQuizzes(fetchedQuizzes);
      } else {
        setQuizzes([]);
      }
      setLoading(false);
    }
    fetchQuizzes();
  }, [dbId]);

  if (loading) { return <LayoutBase><div className="p-10 text-center">正在加载题目...</div></LayoutBase>; }
  if (!dbId || !quizzes.length) { return <LayoutBase><div className="p-10 text-center text-red-500 dark:text-red-400">该题库不存在或暂无题目。</div></LayoutBase>; }

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
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <span className="mr-2">类型: {quiz.type === 'DanXuan' ? '单选' : '多选'}</span>
                <span className="mr-2">难度: {quiz.level}</span>
                {quiz.topic && quiz.topic.length > 0 && (
                  <span>主题: {quiz.topic.join(', ')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </LayoutBase>
  );
};

export default QuizBankPage;
