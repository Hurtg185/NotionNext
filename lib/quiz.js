// lib/quiz.js (最终修复版 - 确保 getPageProperties 导入路径正确)

import { getPage } from '@/lib/notion/getPostBlocks'; // 导入 getPage 函数
import QUIZ from '@/quiz.config';
// 【核心修复】getPageProperties 通常直接从 '@/lib/notion' 导出，而不是 '@/lib/notion/notion'
import { getPageProperties } from '@/lib/notion'; // 【修正为更通用的路径】


// 【核心修复】将 parseNotionPageToQuiz 函数直接定义在这里
function parseNotionPageToQuiz(notionPage, predefinedQuizType) {
  // getPageProperties 是 NotionNext 的核心函数，用于从 Notion 页面中提取属性
  const properties = getPageProperties(notionPage); // 使用 getPageProperties 解析属性

  const quiz = {
    id: notionPage.id,
    type: predefinedQuizType,
    title: properties.title || properties.Name || '未知题目', // 假设 title 或 Name 是标题
    question: {
      text: properties.QuestionText || '题目内容缺失', // 假设 Notion 属性名为 QuestionText
    },
    options: [
      { id: 'a', text: properties.OptionA },
      { id: 'b', text: properties.OptionB },
      { id: 'c', text: properties.OptionC },
      { id: 'd', text: properties.OptionD }
    ].filter(opt => opt.text !== null && opt.text !== ''),
    correctAnswer: properties.CorrectAnswer,
    explanation: properties.Explanation,
    level: properties.Level,
    topic: properties.Topic,
    published: properties.status === 'Published', // 假设有 status 属性表示发布状态
    createdAt: properties.date?.start_date || properties.createdTime || notionPage.created_time // 假设 NotionNext 会解析出 date 或 createdTime
  };
  
  if (predefinedQuizType === 'DuoXuan' && quiz.correctAnswer && typeof quiz.correctAnswer === 'string') {
    quiz.correctAnswers = quiz.correctAnswer.split(',').map(s => s.trim());
    delete quiz.correctAnswer;
  } else {
    quiz.correctAnswers = [quiz.correctAnswer];
  }
  
  return quiz;
}


// 获取题库入口页面中所有的链接数据库
export async function getQuizBanksFromPortalPage() {
  const portalPageId = QUIZ.QUIZ_PORTAL_PAGE_ID;
  if (!portalPageId) {
    console.warn('QUIZ_PORTAL_PAGE_ID 未配置');
    return [];
  }
  try {
    const recordMap = await getPage(portalPageId); // 使用 getPage 获取页面内容
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
      const recordMap = await getPage(databaseId);
      const pages = Object.values(recordMap.block)
        .filter(block => block.value?.type === 'page' && block.value.parent_table === 'collection')
        .map(block => block.value);

      const quizzesInBank = pages
        .filter(page => getPageProperties(page).status === 'Published') // 假设有 status 属性
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
