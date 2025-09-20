// lib/quiz.js (修复导入路径)
import { getNotionPageData } from '@/lib/notion'; // 【核心修复】使用绝对路径导入
import QUIZ from '@/quiz.config';
import { parseNotionPageToQuiz } from '@/lib/notion/parseNotionPageToQuiz'; // 【核心修复】使用绝对路径导入

// ... (其他函数保持不变) ...

// 获取题库入口页面中所有的链接数据库
export async function getQuizBanksFromPortalPage() {
  const portalPageId = QUIZ.QUIZ_PORTAL_PAGE_ID;
  if (!portalPageId) {
    console.warn('QUIZ_PORTAL_PAGE_ID 未配置');
    return [];
  }
  try {
    const notionPageData = await getNotionPageData({ pageId: portalPageId });
    const recordMap = notionPageData.recordMap;
    const linkedDatabases = [];
    if (!recordMap || !recordMap.block) return linkedDatabases;

    for (const blockId in recordMap.block) {
      const block = recordMap.block[blockId].value;
      if ((block?.type === 'collection_view_page' || block?.type === 'collection_view') && block.parent_id === portalPageId) {
        const collection = recordMap.collection[block.collection_id];
        if (collection) {
          const dbTitle = collection.value.name[0][0];
          let quizType = 'Unknown';
          if (dbTitle.includes('单选')) quizType = 'DanXuan';
          if (dbTitle.includes('多选')) quizType = 'DuoXuan';
          linkedDatabases.push({
            id: block.collection_id,
            title: dbTitle,
            quizType: quizType
          });
        }
      }
    }
    return linkedDatabases;
  } catch (error) {
    console.error(`Error fetching quiz portal page ${portalPageId}:`, error);
    return [];
  }
}

// 根据数据库ID拉取所有题目
export async function getQuizzesFromDatabase(databaseId, predefinedQuizType) {
    if (!databaseId) return [];
    try {
      const notionPageData = await getNotionPageData({ pageId: databaseId });
      const pages = notionPageData.allPages;
      const quizzesInBank = pages
        .filter(page => page.status === 'Published')
        .map(page => parseNotionPageToQuiz(page, predefinedQuizType));
      return quizzesInBank.filter(Boolean);
    } catch (error) {
      console.error(`Error fetching quizzes from database ${databaseId}:`, error);
      return [];
    }
}

// 获取单个题目 (需要遍历所有题库)
export async function getQuizByIdFromNotion(quizId) {
    const quizBanks = await getQuizBanksFromPortalPage();
    for (const bank of quizBanks) {
        const quizzesInBank = await getQuizzesFromDatabase(bank.id, bank.quizType);
        const foundQuiz = quizzesInBank.find(q => q.id === quizId);
        if (foundQuiz) {
            return { ...foundQuiz, quizBankName: bank.title, quizBankId: bank.id };
        }
    }
    return null;
             }
