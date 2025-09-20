// lib/quiz.js (最终修复版 - 使用 NotionNext 真实函数)

import { getPage } from '@/lib/notion/getPostBlocks'; // 【核心修复】导入我们找到的 getPage 函数
import QUIZ from '@/quiz.config';
import { getTextContent } from 'notion-utils'; // NotionNext 使用的工具函数

// 【核心修复】自己实现 parseNotionPageToQuiz 函数，不再依赖 getPageProperties
function parseNotionPageToQuiz(notionPageBlock, predefinedQuizType) {
  // notionPageBlock 是 recordMap.block[pageId].value
  const properties = notionPageBlock.properties;
  
  // 辅助函数，安全获取属性值
  const getPropertyValue = (prop) => {
    if (!prop) return null;
    return getTextContent(prop); // 使用 notion-utils 的 getTextContent
  };

  const quiz = {
    id: notionPageBlock.id,
    type: predefinedQuizType,
    title: getPropertyValue(properties.title), // Notion 默认标题属性
    question: {
      text: getPropertyValue(properties.QuestionText),
    },
    options: [
      { id: 'a', text: getPropertyValue(properties.OptionA) },
      { id: 'b', text: getPropertyValue(properties.OptionB) },
      { id: 'c', text: getPropertyValue(properties.OptionC) },
      { id: 'd', text: getPropertyValue(properties.OptionD) }
    ].filter(opt => opt.text !== null && opt.text !== ''),
    correctAnswer: getPropertyValue(properties.CorrectAnswer),
    explanation: getPropertyValue(properties.Explanation),
    level: getPropertyValue(properties.Level),
    topic: getPropertyValue(properties.Topic)?.split(','), // Multi-select 通常是逗号分隔的字符串
    published: getPropertyValue(properties.Published) === 'Yes', // 假设 Published 是 Select 'Yes'/'No'
    createdAt: notionPageBlock.created_time
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
    const recordMap = await getPage(portalPageId);
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
      // 从 recordMap 中过滤出类型为 'page' 且 parent_table 为 'collection' 的块
      const pages = Object.values(recordMap.block)
        .filter(block => block.value?.type === 'page' && block.value.parent_table === 'collection')
        .map(block => block.value);

      const quizzesInBank = pages
        .filter(page => {
          // NotionNext 通常将 status 放在 properties 中，而不是顶层
          const properties = page.properties;
          return getPropertyValue(properties.Published) === 'Yes'; // 假设 Published 属性为 'Yes' 表示发布
        })
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
