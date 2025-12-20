const dailyData = [
  // 小主题：基础问候 (1-10)
  { id: 1, chapter: "基础问候", chinese: "你好！", pinyin: "Nǐ hǎo!", burmese: "မင်္ဂလာပါ!", xieyin: "မင်ဂလာပါ" },
  { id: 2, chapter: "基础问候", chinese: "你叫什么名字？", pinyin: "Nǐ jiào shénme míngzì?", burmese: "နာမည်ဘယ်လိုခေါ်လဲ?", xieyin: "နားမမည် ဘယ်လိုခေါ်လဲ" },
  { id: 3, chapter: "基础问候", chinese: "认识你很高兴。", pinyin: "Rènshí nǐ hěn gāoxìng.", burmese: "တွေ့ရတာ ဝမ်းသာပါတယ်။", xieyin: "တွေ့ရတာ ဝမ်းသာပါတယ်" },
  { id: 4, chapter: "基础问候", chinese: "麻烦帮个忙。", pinyin: "Máfan bāng gè máng.", burmese: "အကူအညီလေး တစ်ခုလောက်ပေးပါ။", xieyin: "မားဖန့် ပန်းကော့မန်း" },
  { id: 5, chapter: "基础问候", chinese: "没关系。", pinyin: "Méiguānxì.", burmese: "ကိစ္စမရှိပါဘူး။", xieyin: "မေကွန်းရှိ" },
  
  // 小主题：购物交际 (11-25)
  { id: 11, chapter: "购物交际", chinese: "这个多少钱？", pinyin: "Zhège duōshǎo qián?", burmese: "ဒါ ဘယ်လောက်လဲ?", xieyin: "တကျော့ တိုးရှောင်ချี่ยน" },
  { id: 12, chapter: "购物交际", chinese: "太贵了，便宜点。", pinyin: "Tài guì le, piányí diǎn.", burmese: "ဈေးကြီးတယ်၊ လျှော့ပေးပါ။", xieyin: "ထိုက်ကွေ့လော့ ဖျန်ယီတี่ยน" },
  { id: 13, chapter: "购物交际", chinese: "有黑色的吗？", pinyin: "Yǒu hēisè de ma?", burmese: "အနက်ရောင် ရှိလား?", xieyin: "ရို ဟေးစော့တိုမား" },
  
  // 小主题：工作实战 (26-50)
  { id: 26, chapter: "工作实战", chinese: "这个工序怎么做？", pinyin: "Zhège gōngxù zěnme zuò?", burmese: "ဒီအဆင့်ကို ဘယ်လိုလုပ်ရမလဲ?", xieyin: "တကျော့ ကုန်းရွိ" },
  { id: 27, chapter: "工作实战", chinese: "老板，我想请假。", pinyin: "Lǎobǎn, wǒ xiǎng qǐngjià.", burmese: "အလုပ်ရှင်၊ ခွင့်ယူချင်ပါတယ်။", xieyin: "လောင်ပန့် ဝေါ့ရှန့်ချင်ကျား" },
];

// 补充满 50 条用于测试滑动拦截
for(let i=30; i<=50; i++) {
    dailyData.push({ id: i, chapter: "更多内容", chinese: `测试短句第 ${i} 句`, pinyin: "test", burmese: "test", xieyin: "test" });
}

export default dailyData;
