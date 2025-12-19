// components/Data/1.js

export default {
  id: "hsk1_01",
  level: 1,
  title: "第1课：你是哪国人？",
  blocks: [
    // ==========================================
    // 1. 课程封面 (Cover Page)
    // ==========================================
    {
      type: "cover",
      content: {
        title: "HSK 1 - 第1课",
        subtitle: "你是哪国人？",
        description: "学习如何打招呼、介绍国籍以及使用疑问词“几”。",
        imageUrl: "https://images.pexels.com/photos/35267296/pexels-photo-35267296.jpeg"
      }
    },

    // ==========================================
    // 2. 单词学习 (Word Study)
    // ==========================================
    {
      type: "word_study",
      content: {
        title: "核心生词",
        words: [
          {
            id: 1,
            word: "你好",
            pinyin: "nǐ hǎo",
            burmese: "မင်္ဂလာပါ",
            definition: "Hello",
            example: "老师，你好！",
            example_burmese: "ဆရာမ မင်္ဂလာပါ။"
          },
          {
            id: 2,
            word: "中国",
            pinyin: "Zhōngguó",
            burmese: "တရုတ်",
            definition: "China",
            example: "我是中国人。",
            example_burmese: "ကျွန်တော်က တရုတ်လူမျိုးပါ။"
          },
          {
            id: 3,
            word: "美国",
            pinyin: "Měiguó",
            burmese: "အမေရိကန်",
            definition: "USA",
            example: "他是美国人。",
            example_burmese: "သူက အမေရိကန်လူမျိုးပါ။"
          },
          {
            id: 4,
            word: "老师",
            pinyin: "lǎoshī",
            burmese: "ဆရာ/မ",
            definition: "Teacher",
            example: "他是我的老师。",
            example_burmese: "သူက ကျွန်တော့်ရဲ့ဆရာပါ။"
          },
          {
            id: 5,
            word: "几",
            pinyin: "jǐ",
            burmese: "ဘယ်နှစ် (၁၀ အောက်)",
            definition: "How many",
            example: "你有几个朋友？",
            example_burmese: "မင်းမှာ သူငယ်ချင်း ဘယ်နှစ်ယောက်ရှိလဲ။"
          }
        ]
      }
    },

    // ==========================================
    // 3. 语法讲解 (Grammar Study)
    // ==========================================
    {
      type: "grammar_study",
      content: {
        grammarPoints: [
          {
            id: "gp_01",
            '语法标题': '疑问代词「几」 (How many)',
            '句型结构': '数量词 + {{几}} + 量词 + 名词',
            '语法详解': `
## 💡 核心用法
**「几」** 专门用来询问 **10以内**、能数清楚的数量。

### 1. 常用固定搭配 (必须背)
| 表达 | 含义 |
| :--- | :--- |
| **几岁？** | 几岁了？ (问年龄) |
| **几点？** | 几点了？ (问时间) |
| **几个？** | 几个朋友？ (问数量) |

### 2. 「几」 vs 「多少」
· **几**: 用于少量 (< 10)
❌ 这本书几钱？
✅ 这本书多少钱？

· **多少**: 用于不确定或大量，常问价格
✅ 中国有多少人？
✅ 这个多少钱？

## ⚠️ 易错提醒
◆ 必须加量词：
❌ 几人？
✅ 几个人？
`,
            '讲解脚本': '我们来学习“几”。它用来问10以下的小数量。记住，“几”的后面一定要加量词，比如“几个人”。如果你想问价格，记得要改用“多少钱”，不能用“几钱”。',
            '例句列表': [
              { id: 'ex1', '句子': '你有{{几}}个朋友？', '翻译': 'How many friends do you have?' },
              { id: 'ex2', '句子': '现在{{几}}点了？', '翻译': 'What time is it now?' }
            ]
          },
          {
            id: "gp_02",
            "语法标题": "提问国籍 (Asking Nationality)",
            "句型结构": "主语 + 是 + {{哪}} + 国人？",
            "语法详解": `
## 💡 核心用法
使用 **「哪」 (nǎ)** 来询问 "哪一个" (Which)。

### 1. 基本问答
· **问**: 你是哪国人？
· **答**: 我是缅甸人。/ 我是中国人。

### 2. 否定形式
· **说**: 我 **不是** 美国人。
`,
            "讲解脚本": "询问国籍时，句型非常固定：你是哪国人？回答时只需要把“哪国”换成具体的国家名称即可。"
          }
        ]
      }
    },

    // ==========================================
    // 4. 选择题练习 (Choice Exercises)
    // ==========================================
    {
      type: "choice",
      content: {
        question: "How do you say 'China' in Chinese?",
        options: [
          { id: "1", text: "美国 (Měiguó)" },
          { id: "2", text: "老师 (Lǎoshī)" },
          { id: "3", text: "中国 (Zhōngguó)" },
          { id: "4", text: "你好 (Nǐ hǎo)" }
        ],
        correctAnswer: ["3"]
      }
    },
    {
      type: "choice",
      content: {
        question: "Select the correct negative sentence: (I am NOT a teacher.)",
        options: [
          { id: "1", text: "我不老师。" },
          { id: "2", text: "我不是老师。" },
          { id: "3", text: "我是不老师。" },
          { id: "4", text: "老师不我是。" }
        ],
        correctAnswer: ["2"],
        explanation: "在动词'是'前面加'不'表示否定。"
      }
    },
    {
      type: "choice",
      content: {
        question: {
          text: "Look at the flag. Which country is this?",
          imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Flag_of_Myanmar.svg/200px-Flag_of_Myanmar.svg.png"
        },
        options: [
          { id: "1", text: "中国 (Zhōngguó)" },
          { id: "2", text: "美国 (Měiguó)" },
          { id: "3", text: "缅甸 (Miǎndiàn)" },
          { id: "4", text: "英国 (Yīngguó)" }
        ],
        correctAnswer: ["3"]
      }
    },

    // ==========================================
    // 5. 排序题练习 (Sorting Exercises)
    // ==========================================
    {
      type: "paixu",
      content: {
        title: "连词成句：你是哪国人？",
        items: [
          { id: "1", text: "你" },
          { id: "2", text: "是" },
          { id: "3", text: "哪" },
          { id: "4", text: "国" },
          { id: "5", text: "人" },
          { id: "6", text: "？" }
        ],
        correctOrder: ["1", "2", "3", "4", "5", "6"]
      }
    },
    {
      type: "paixu",
      content: {
        title: "连词成句：我有三个朋友。",
        items: [
          { id: "1", text: "个" },
          { id: "2", text: "我" },
          { id: "3", text: "三" },
          { id: "4", text: "有" },
          { id: "5", text: "朋友" },
          { id: "6", text: "。" }
        ],
        correctOrder: ["2", "4", "3", "1", "5", "6"]
      }
    },
    {
      type: "paixu",
      content: {
        title: "连词成句：他不是美国人。",
        items: [
          { id: "1", text: "是" },
          { id: "2", text: "不" },
          { id: "3", text: "他" },
          { id: "4", text: "美国人" },
          { id: "5", text: "。" }
        ],
        correctOrder: ["3", "2", "1", "4", "5"]
      }
    },

    // ==========================================
    // 6. 结束页面 (Completion)
    // ==========================================
    {
      type: "end",
      content: {
        title: "第一课完成！",
        description: "你太棒了！你已经学会了如何询问国籍和使用数字提问。"
      }
    }
  ]
};
