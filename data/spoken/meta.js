export const spokenBooks = [
  { 
    id: '10k', 
    title: '日常高频 10000 句', 
    description: '涵盖生活、出行、情感表达',
    tag: 'Daily', 
    file: 'daily10k', // 对应 content 文件名
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80',
    // 关键：在这里直接定义好有哪些章节，首页就能渲染标签
    chapters: [
      "基础问候", "自我介绍", "数字与钱", "问路交通", 
      "餐厅点餐", "酒店住宿", "商场购物", "情感表达", 
      "紧急求助", "电话用语", "时间日期", "天气气候"
    ]
  },
  { 
    id: 'factory', 
    title: '服装厂实战会话', 
    description: '车间、工序、请假、发薪',
    tag: 'Work', 
    file: 'factory', 
    image: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&q=80',
    chapters: [
      "面试入职", "工序指导", "质量检查", "设备维修", 
      "加班与考勤", "薪资咨询", "请假离职", "宿舍生活"
    ]
  }
];
