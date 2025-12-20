export const spokenBooks = [
  { 
    id: '10k', 
    title: '日常高频 10000 句', 
    desc: '从零基础到流利对话的通关秘籍',
    tag: 'Daily', 
    file: 'daily10k', 
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80',
    // 首页显示的标签（只显示大主题）
    categories: [
      "日常问候", "介绍与交流", "出行交通", "餐厅用餐", 
      "购物消费", "酒店住宿", "情感表达", "紧急求助",
      "职场沟通", "电话用语", "时间日期", "天气气候"
    ]
  },
  { 
    id: 'factory', 
    title: '服装厂实战会话', 
    desc: '车间沟通、工序指导、薪资管理',
    tag: 'Work', 
    file: 'factory', 
    image: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&q=80',
    categories: ["面试入职", "工序指导", "质量检查", "设备维修"]
  }
];
