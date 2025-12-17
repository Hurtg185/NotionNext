import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// 引入你刚才提供的互动组件
import InteractiveLesson from '@/components/Tixing/InteractiveLesson';

export default function LessonPage() {
  const router = useRouter();
  const { level, id } = router.query;
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 1. 动态加载 JSON 数据
  useEffect(() => {
    if (!router.isReady) return;
    
    setLoading(true);
    setError(false);

    async function loadData() {
      try {
        // 动态导入: data/hsk/hsk1/1.json
        const mod = await import(`@/data/hsk/hsk${level}/${id}.js`);
        // 兼容 export default 和 纯 JSON
        setLessonData(mod.default || mod);
      } catch (err) {
        console.error("Failed to load lesson:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router.isReady, level, id]);

  // 2. 数据转换适配器 (核心逻辑)
  // 如果你的 JSON 里没有 blocks 字段，这个函数会自动生成 blocks
  const formattedLesson = useMemo(() => {
    if (!lessonData) return null;

    // 如果 JSON 里已经写好了 blocks (比如高级自定义课程)，直接用
    if (lessonData.blocks && lessonData.blocks.length > 0) {
      return lessonData;
    }

    // 否则，自动根据 newWords 和 dialogues 生成 blocks
    const generatedBlocks = [];

    // --- 模块 1: 教学引导 (Teaching) ---
    // (可选，如果 description 存在)
    if (lessonData.description) {
        generatedBlocks.push({
            type: 'teaching', // 会被你的组件自动跳过，但保留结构完整性
            content: { title: "课程介绍", text: lessonData.description }
        });
    }

    // --- 模块 2: 生词学习 (Word Study) ---
    if (lessonData.newWords && lessonData.newWords.length > 0) {
      generatedBlocks.push({
        type: 'word_study',
        content: {
          title: "核心生词",
          // 你的 WordCard 组件可能需要 specific keys, 这里做映射
          words: lessonData.newWords.map((w, idx) => ({
            id: idx,
            word: w.hanzi,      // 适配 WordCard 显示
            chinese: w.hanzi,   // 适配 TTS
            pinyin: w.pinyin,
            meaning: w.meaning,
            type: w.type
          }))
        }
      });
    }

    // --- 模块 3: 短句/课文学习 (Sentences / Phrase Study) ---
    if (lessonData.dialogues && lessonData.dialogues.length > 0) {
      generatedBlocks.push({
        type: 'sentences', // 或者 'phrase_study'
        content: {
          title: "课文跟读",
          // 适配 PhraseCard
          sentences: lessonData.dialogues.map((d, idx) => ({
            id: idx,
            chinese: d.content,   // 汉字
            pinyin: d.pinyin,     // 拼音
            meaning: d.translation, // 翻译
            avatar: d.avatar,     // 头像
            role: d.role
          }))
        }
      });
    }

    // --- 模块 4: 完成页 (Completion) ---
    generatedBlocks.push({
      type: 'complete',
      content: {
        title: "太棒了！",
        message: "你已经完成了本课的学习。"
      }
    });

    return {
      ...lessonData,
      blocks: generatedBlocks
    };

  }, [lessonData]);


  // 3. 渲染状态处理
  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-slate-400 font-medium">正在准备课程...</p>
      </div>
    );
  }

  if (error || !formattedLesson) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">未找到课程</h1>
        <p className="text-slate-500 mb-6">无法加载 HSK {level} 第 {id} 课的数据。</p>
        <button 
          onClick={() => router.back()}
          className="px-6 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 font-bold hover:bg-slate-100 transition-colors"
        >
          返回目录
        </button>
      </div>
    );
  }

  // 4. 渲染全屏互动组件
  return (
    <>
      <Head>
        <title>{formattedLesson.title || `HSK ${level} Lesson ${id}`} - 学习模式</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      
      {/* 直接使用你的组件，不需要额外的 Layout，因为它本身就是全屏的 */}
      <InteractiveLesson lesson={formattedLesson} />
    </>
  );
}
