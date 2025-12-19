// 注意：文件名现在是 1.js，不再是 1.json
export default {
  id: "hsk1_01",
  title: "第1课：你是哪国人？",
  blocks: [
    // ==========================================
    // 1. 单词学习 (Word Study)
    // ==========================================
    {
      type: "word_study",
      content: {
        title: "核心生词",
        words: [
          {
            id: 1,
            hsk_level: 1, 
            word: "你好",
            pinyin: "nǐ hǎo",
            decomposition: ["你", "好"], 
            similar_sound: "尼好",
            burmese: "မင်္ဂလာပါ",
            definition: "Hello / Hi", 
            explanation: "用于打招呼，任何时间都可以说。", 
            example: "你好！你是老师吗？",
            example_burmese: "မင်္ဂလာပါ၊ သင်က ဆရာလား။",
            example2: "老师，你好！",
            example2_burmese: "ဆရာ/မ မင်္ဂလာပါ။"
          },
          {
            id: 2,
            hsk_level: 1,
            word: "中国",
            pinyin: "Zhōng guó",
            decomposition: ["中", "国"],
            similar_sound: "钟国",
            burmese: "တရုတ်",
            definition: "China",
            explanation: "东亚国家。",
            example: "我是中国人。",
            example_burmese: "ကျွန်တော်က တရုတ်လူမျိုးပါ။",
            example2: "我爱中国。",
            example2_burmese: "ကျွန်တော် တရုတ်ပြည်ကို ချစ်တယ်။"
          },
          {
            id: 3,
            hsk_level: 1,
            word: "美国",
            pinyin: "Měi guó",
            decomposition: ["美", "国"],
            similar_sound: "美过",
            burmese: "အမေရိကန်",
            definition: "USA",
            explanation: "北美国家。",
            example: "他是美国人。",
            example_burmese: "သူက အမေရိကန်လူမျိုးပါ။",
            example2: "你要去美国吗？",
            example2_burmese: "မင်း အမေရိကန်ကို သွားမှာလား။"
          },
          {
            id: 4,
            hsk_level: 1,
            word: "人",
            pinyin: "rén",
            decomposition: ["人"],
            similar_sound: "忍",
            burmese: "လူ",
            definition: "Person / People",
            explanation: "人类，或者指某种身份的人。",
            example: "中国人 / 美国人",
            example_burmese: "တရုတ်လူမျိုး / အမေရိကန်လူမျိုး",
            example2: "你是哪国人？",
            example2_burmese: "မင်း ဘယ်နိုင်ငံသားလဲ။"
          },
          {
            id: 5,
            hsk_level: 1,
            word: "老师",
            pinyin: "lǎo shī",
            decomposition: ["老", "师"],
            similar_sound: "老狮",
            burmese: "ဆရာ/ဆရာမ",
            definition: "Teacher",
            explanation: "在学校教书的人。",
            example: "谢谢你，老师。",
            example_burmese: "ကျေးဇူးတင်ပါတယ် ဆရာ။",
            example2: "他是汉语老师。",
            example2_burmese: "သူက တရုတ်စာ ဆရာဖြစ်တယ်။"
          }
        ]
      }
    },

    // ==========================================
    // 2. 语法讲解 (Grammar Study)
    // ==========================================
    {
      type: "grammar_study",
      content: {
        grammarPoints: [
          {
            id: "gp_01",
            '语法标题': '疑问代词「几」',
  '句型结构': '{{几}} + 量词 + 名词',
  '语法详解': `
一句话记住：数量小（十以内）、能数清，用「几」。

## 一、最常用的句型
◆ 句型: 几 + 量词 + 名词 (用来询问事物的具体数量)
· 几个人？
· 几本书？
· 几杯水？

⚠️ 对于普通名词，“几”后面必须跟上对应的量词。

## 二、固定搭配 (必须背)
· 几岁？
· 几点？
· 几天？
· 几年？

## 三、「几」和「多少」的区别
· **几**: 少量 (数量通常小于10)
❌ 这本书几钱？
✅ 这本书多少钱？
✅ 你家有几口人？

· **多少**: 数量不确定，可大可小，常用来问价格
✅ 中国有多少人？
✅ 这个多少钱？

## 四、最容易错的地方
◆ 忘了量词
❌ 几人？
✅ 几个人？

◆ 用来问价钱
❌ 几钱？
✅ 多少钱？

## 五、对话练习
A: 你有几个朋友？
B: 我有三个朋友。

A: 现在几点了？
B: 现在两点了。
`,
  '讲解脚本': '我们来学习疑问代词“几”。“几”通常用来问十以下的、可以数清楚的数量。最常用的句型是：几，加上量词，再加上名词，比如“几个人？”、“几本书？”。记住，“几”的后面一定要有量词。它和“多少”不一样，“多少”可以问很大的数量，也可以问价钱，但“几”不行。',
  '例句列表': [
    { id: 'ex101', '句子': '你有{{几}}个苹果？', '翻译': 'How many apples do you have?' },
    { id: 'ex102', '句子': '现在{{几}}点了？', '翻译': 'What time is it now?' },
    { id: 'ex103', '句子': '这个{{多少}}钱？', '翻译': 'How much is this?' },
  ]
},
          {
            id: "gp_02",
            "语法标题": "提问国籍 (Which country)",
            "句型结构": "你是 + {{哪}} + 国人？",
            "语法详解": "“哪” (nǎ) 表示疑问 'Which'。\n\n问句：你是哪国人？\n答句：我是缅甸人。",
            "讲解脚本": "问别人的国家，要用“哪”。注意是三声。"
          }
        ]
      }
    },

    // ==========================================
    // 3. 互动练习 (Interactive Exercises)
    // ==========================================
    
    // --- 练习 1：基础词汇 (纯文字) ---
    {
      type: "choice",
      content: {
        question: {
          text: "How do you say 'China' in Chinese?",
          imageUrl: null 
        },
        options: [
          { id: "opt1", text: "美国 (Měi guó)" },
          { id: "opt2", text: "老师 (Lǎo shī)" },
          { id: "opt3", text: "中国 (Zhōng guó)" }, 
          { id: "opt4", text: "你好 (Nǐ hǎo)" }
        ],
        correctAnswer: ["opt3"]
      }
    },

 {
    type: "choice",
    content: {
      question: "Select the character for 'Years old'.",
      options: [
        { id: "1", text: "岁 (suì)" },
        { id: "2", text: "多 (duō)" },
        { id: "3", text: "大 (dà)" },
        { id: "4", text: "家 (jiā)" }
      ],
      correctAnswer: ["1"]
    }
  },
  {
    type: "choice",
    content: {
      question: "Translate: 'He is 20 years old.'",
      options: [
        { id: "1", text: "他二十岁。" },
        { id: "2", text: "他是二十岁。" },
        { id: "3", text: "他岁二十。" },
        { id: "4", text: "二十岁他。" }
      ],
      correctAnswer: ["1"],
      explanation: "陈述年龄时，不需要加'是'，直接说'数字+岁'。"
    }
  },
  {
    type: "choice",
    content: {
      question: "Which one means 'Family' or 'Home'?",
      options: [
        { id: "1", text: "有 (yǒu)" },
        { id: "2", text: "家 (jiā)" },
        { id: "3", text: "口 (kǒu)" },
        { id: "4", text: "几 (jǐ)" }
      ],
      correctAnswer: ["2"]
    }
  },
    
    // --- 练习 2：看图选词 (题干有图) ---
    {
      type: "choice",
      content: {
        question: {
          text: "这张图片是什么职业？(What is this person's job?)",
          imageUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995574.png"
        },
        options: [
          { id: "opt1", text: "学生 (Xué sheng)" },
          { id: "opt2", text: "老师 (Lǎo shī)" }, 
          { id: "opt3", text: "医生 (Yī shēng)" },
          { id: "opt4", text: "人 (Rén)" }
        ],
        correctAnswer: ["opt2"]
      }
    },

    // --- 练习 3：语法填空 (文字) ---
    {
      type: "choice",
      content: {
        question: {
          text: "Complete the sentence: \n 他 ___ 美国人。 (He is NOT American.)",
          imageUrl: null
        },
        options: [
          { id: "opt1", text: "是 (shì)" },
          { id: "opt2", text: "不 (bù)" },
          { id: "opt3", text: "不是 (bú shì)" }, 
          { id: "opt4", text: "哪 (nǎ)" }
        ],
        correctAnswer: ["opt3"]
      }
    },

    // --- 练习 4：听词选图/看词选图 (选项有图) ---
    {
      type: "choice",
      content: {
        question: {
          text: "哪个是“美国” (USA)？",
          imageUrl: null
        },
        options: [
          { 
            id: "opt1", 
            text: "China", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Flag_of_the_People%27s_Republic_of_China.svg/200px-Flag_of_the_People%27s_Republic_of_China.svg.png" 
          },
          { 
            id: "opt2", 
            text: "USA", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/200px-Flag_of_the_United_States.svg.png" 
          }, 
          { 
            id: "opt3", 
            text: "UK", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Flag_of_the_United_Kingdom_%281-2%29.svg/200px-Flag_of_the_United_Kingdom_%281-2%29.svg.png" 
          },
          { 
            id: "opt4", 
            text: "Myanmar", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Flag_of_Myanmar.svg/200px-Flag_of_Myanmar.svg.png" 
          }
        ],
        correctAnswer: ["opt2"]
      }
    }
  ]
};
