// lib/quiz.js (新建文件)
import { getNotionPageData } from './notion/getNotionData'; // 【关键】使用 NotionNext 的核心函数
import QUIZ from '@/quiz.config';
import { parseNotionPageToQuiz } from './notion/parseNotionPageToQuiz'; // 假设解析函数在这里

// 【新的函数】获取题库入口页面中所有的链接数据库
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

    // 遍历 recordMap 中的所有块
    for (const blockId in recordMap.block) {
      const block = recordMap.block[blockId].value;
      // 识别 collection_view_page 或 collection_view 类型的块，它们通常是数据库
      if ((block?.type === 'collection_view_page' || block?.type === 'collection_view') && block.parent_id === portalPageId) {
        const collection = recordMap.collection[block.collection_id];
        if (collection) {
          const dbTitle = collection.value.name[0][0];
          // 【核心】根据数据库标题来判断题型
          let quizType = 'Unknown';
          if (dbTitle.includes('单选')) quizType = 'DanXuan';
          if (dbTitle.includes('多选')) quizType = 'DuoXuan';
          if (dbTitle.includes('填空')) quizType = 'TianKong';
          // ... 可以添加更多判断

          linkedDatabases.push({
            id: block.collection_id, // 数据库的实际 ID
            title: dbTitle, // 数据库的名称
            quizType: quizType // 动态判断的题型
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

// 【新的函数】根据数据库ID拉取所有题目
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
