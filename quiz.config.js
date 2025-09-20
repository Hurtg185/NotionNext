// quiz.config.js (新建文件)

const QUIZ = {
  // 【核心】题库入口页面的 Notion Page ID
  // 这个 ID 就是你截图中“中文学习题库”页面的 ID
  QUIZ_PORTAL_PAGE_ID: process.env.NOTION_QUIZ_PORTAL_PAGE_ID || '251c928a2fa68045ad64c522426367a9',
}

module.exports = QUIZ
