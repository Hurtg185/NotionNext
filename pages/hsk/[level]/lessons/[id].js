import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// 引入全屏互动组件
import InteractiveLesson from '@/components/Tixing/InteractiveLesson';

// ==========================================
// 核心逻辑：静态数据注册表
// 这种方式能确保 Cloudflare Pages 100% 不会因为路径问题导致白屏
// ==========================================
const hskLessonsIndex = {
  // HSK 1 课程
  '1_1': require('@/data/hsk/hsk1/1.js').default || require('@/data/hsk/hsk1/1.js'),
  '1_2': require('@/data/hsk/hsk1/2.js').default || require('@/data/hsk/hsk1/2.js'),
  '1_3': require('@/data/hsk/hsk1/3.js').default || require('@/data/hsk/hsk1/3.js'),
  '1_4': require('@/data/hsk/hsk1/4.js').default || require('@/data/hsk/hsk1/4.js'),
  '1_5': require('@/data/hsk/hsk1/5.js').default || require('@/data/hsk/hsk1/5.js'),
  '1_6': require('@/data/hsk/hsk1/6.js').default || require('@/data/hsk/hsk1/6.js'),
  '1_7': require('@/data/hsk/hsk1/7.js').default || require('@/data/hsk/hsk1/7.js'),
  '1_8': require('@/data/hsk/hsk1/8.js').default || require('@/data/hsk/hsk1/8.js'),
  '1_9': require('@/data/hsk/hsk1/9.js').default || require('@/data/hsk/hsk1/9.js'),
  '1_10': require('@/data/hsk/hsk1/10.js').default || require('@/data/hsk/hsk1/10.js'),
  '1_11': require('@/data/hsk/hsk1/11.js').default || require('@/data/hsk/hsk1/11.js'),
  '1_12': require('@/data/hsk/hsk1/12.js').default || require('@/data/hsk/hsk1/12.js'),
  '1_13': require('@/data/hsk/hsk1/13.js').default || require('@/data/hsk/hsk1/13.js'),
  '1_14': require('@/data/hsk/hsk1/14.js').default || require('@/data/hsk/hsk1/14.js'),
  '1_15': require('@/data/hsk/hsk1/15.js').default || require('@/data/hsk/hsk1/15.js'),

  // HSK 2 课程
  '2_1': require('@/data/hsk/hsk2/1.js').default || require('@/data/hsk/hsk2/1.js'),
  '2_2': require('@/data/hsk/hsk2/2.js').default || require('@/data/hsk/hsk2/2.js'),
  '2_3': require('@/data/hsk/hsk2/3.js').default || require('@/data/hsk/hsk2/3.js'),
  '2_4': require('@/data/hsk/hsk2/4.js').default || require('@/data/hsk/hsk2/4.js'),
  '2_5': require('@/data/hsk/hsk2/5.js').default || require('@/data/hsk/hsk2/5.js'),
  '2_6': require('@/data/hsk/hsk2/6.js').default || require('@/data/hsk/hsk2/6.js'),
  '2_7': require('@/data/hsk/hsk2/7.js').default || require('@/data/hsk/hsk2/7.js'),
  '2_8': require('@/data/hsk/hsk2/8.js').default || require('@/data/hsk/hsk2/8.js'),
  '2_9': require('@/data/hsk/hsk2/9.js').default || require('@/data/hsk/hsk2/9.js'),
  '2_10': require('@/data/hsk/hsk2/10.js').default || require('@/data/hsk/hsk2/10.js'),
  '2_11': require('@/data/hsk/hsk2/11.js').default || require('@/data/hsk/hsk2/11.js'),
  '2_12': require('@/data/hsk/hsk2/12.js').default || require('@/data/hsk/hsk2/12.js'),
  '2_13': require('@/data/hsk/hsk2/13.js').default || require('@/data/hsk/hsk2/13.js'),
  '2_14': require('@/data/hsk/hsk2/14.js').default || require('@/data/hsk/hsk2/14.js'),
  '2_15': require('@/data/hsk/hsk2/15.js').default || require('@/data/hsk/hsk2/15.js'),

  // 如果有更多等级（HSK 3, 4...），请按此格式继续 require
};

export default function LessonPage() {
  const router = useRouter();
  const { level, id } = router.query;
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 1. 同步加载数据
  useEffect(() => {
    if (!router.isReady) return;
    
    setLoading(true);
    setError(false);

    // 构建索引 Key，例如 "1_1"
    const dataKey = `${level}_${id}`;
    const data = hskLessonsIndex[dataKey];

    if (data) {
      // 成功获取静态索引中的数据
      setLessonData(data);
      setLoading(false);
    } else {
      // 如果索引表中不存在该课程
      console.error(`课程数据未在索引表中注册: ${dataKey}`);
      setError(true);
      setLoading(false);
    }
  }, [router.isReady, level, id]);

  // 2. 数据转换适配器 (核心逻辑：将 JSON 转换为组件可识别的 blocks)
  const formattedLesson = useMemo(() => {
    if (!lessonData) return null;

    // 如果 JSON 里已经写好了 blocks，直接使用
    if (lessonData.blocks && lessonData.blocks.length > 0) {
      return lessonData;
    }

    // 否则，自动根据 newWords 和 dialogues 生成课程块
    const generatedBlocks = [];

    // --- 模块 1: 课程介绍 (如果有 description) ---
    if (lessonData.description) {
        generatedBlocks.push({
            type: 'teaching',
            content: { 
                title: lessonData.title || "课程介绍", 
                text: lessonData.description 
            }
        });
    }

    // --- 模块 2: 生词学习 (Word Study) ---
    if (lessonData.newWords && lessonData.newWords.length > 0) {
      generatedBlocks.push({
        type: 'word_study',
        content: {
          title: "核心生词学习",
          words: lessonData.newWords.map((w, idx) => ({
            id: `word-${idx}`,
            word: w.hanzi || w.word,   // 汉字
            chinese: w.hanzi || w.word, // 用于 TTS 朗读
            pinyin: w.pinyin,          // 拼音
            meaning: w.meaning,        // 释义
            type: w.type               // 词性
          }))
        }
      });
    }

    // --- 模块 3: 课文对话/短句学习 ---
    if (lessonData.dialogues && lessonData.dialogues.length > 0) {
      generatedBlocks.push({
        type: 'sentences',
        content: {
          title: "课文朗读与跟读",
          sentences: lessonData.dialogues.map((d, idx) => ({
            id: `sen-${idx}`,
            chinese: d.content,      // 文本内容
            pinyin: d.pinyin,        // 拼音
            meaning: d.translation,  // 翻译内容
            avatar: d.avatar || null, // 角色头像
            role: d.role || ""       // 角色名称
          }))
        }
      });
    }

    // --- 模块 4: 恭喜完成页 ---
    generatedBlocks.push({
      type: 'complete',
      content: {
        title: "本课学习已完成！",
        message: "太棒了！你已经掌握了本课的所有内容。点击下方按钮返回目录。"
      }
    });

    return {
      ...lessonData,
      blocks: generatedBlocks
    };

  }, [lessonData]);


  // 3. 渲染状态处理 (Loading)
  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-white">
        <div className="flex space-x-2 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
        <p className="text-slate-400 font-medium text-sm">正在加载课程内容...</p>
      </div>
    );
  }

  // 4. 渲染状态处理 (Error)
  if (error || !formattedLesson) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
            <span className="text-3xl">🚫</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">未找到课程数据</h1>
        <p className="text-slate-500 mb-8 max-w-xs">
            抱歉，系统未能加载 HSK {level} 第 {id} 课的内容。请确保文件路径正确且已在索引中注册。
        </p>
        <button 
          onClick={() => router.push('/hsk')}
          className="w-full max-w-xs py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
        >
          返回课程中心
        </button>
      </div>
    );
  }

  // 5. 渲染全屏互动组件
  return (
    <>
      <Head>
        <title>{formattedLesson.title || `HSK ${level} Lesson ${id}`} - 互动学习</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      
      {/* 渲染互动学习组件 */}
      <InteractiveLesson lesson={formattedLesson} />
    </>
  );
}
