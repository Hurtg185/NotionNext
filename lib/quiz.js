// lib/quiz.js (再次确认)
import { getPage } from '@/lib/notion/getPostBlocks';
import QUIZ from '@/quiz.config';
import { getTextContent } from 'notion-utils';

function parseNotionPageToQuiz(notionPageBlock, predefinedQuizType) {
  const properties = notionPageBlock.properties;
  const getPropertyValue = (prop) => {
    if (!prop) return null;
    return getTextContent(prop);
  };
  // ... (解析逻辑) ...
  return quiz;
}

export async function getQuizBanksFromPortalPage() { /* ... */ }
export async function getQuizzesFromDatabase(databaseId, predefinedQuizType) { /* ... */ }
export async function getQuizByIdFromNotion(quizId) { /* ... */ }

// 【关键】确保这个函数也被导出了
export async function getAllQuizzesFromNotionBanks() {
  const allQuizzes = [];
  for (const bank of QUIZ.QUIZ_BANKS) {
    if (!bank.id) continue;
    try {
      const notionPageData = await getPage(bank.id); // 使用 getPage
      const pages = Object.values(notionPageData.block)
        .filter(b => b.value?.type === 'page' && b.value.parent_table === 'collection')
        .map(b => b.value);
      
      const quizzesInBank = pages.map(page => ({
        ...parseNotionPageToQuiz(page, bank.quizType),
        quizBankName: bank.name,
        quizBankId: bank.id
      }));

      allQuizzes.push(...quizzesInBank.filter(Boolean));
    } catch (error) {
      console.error(`Error fetching quizzes from bank "${bank.name}":`, error);
    }
  }
  return allQuizzes;
}
