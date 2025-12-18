import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// 引入互动组件
import InteractiveLesson from '@/components/Tixing/InteractiveLesson';

// ==========================================
// 1. 静态数据注册表
// ==========================================
const hskLessonsIndex = {
  '1_1': require('@/data/hsk/hsk1/1.js').default || require('@/data/hsk/hsk1/1.js'),
  '1_6': require('@/data/hsk/hsk1/6.js').default || require('@/data/hsk/hsk1/6.js'),
  '1_7': require('@/data/hsk/hsk1/7.js').default || require('@/data/hsk/hsk1/7.js'),
  '2_1': require('@/data/hsk/hsk2/1.js').default || require('@/data/hsk/hsk2/1.js'),
  '2_5': require('@/data/hsk/hsk2/5.js').default || require('@/data/hsk/hsk2/5.js')
};

// ==========================================
// 2. 静态路径导出 (解决 Cloudflare 404 的关键)
// ==========================================
export async function getStaticPaths() {
  // 明确告诉 Next.js 需要导出哪些静态页面
  const paths = [
    { params: { level: '1', id: '1' } },
    { params: { level: '1', id: '6' } },
    { params: { level: '1', id: '7' } },
    { params: { level: '2', id: '1' } },
    { params: { level: '2', id: '5' } }
  ];
  return { paths, fallback: false }; // fallback: false 表示不在列表中的路径直接返回 404
}

export async function getStaticProps({ params }) {
  // 静态导出必须有这个函数，哪怕返回空对象
  return { props: { level: params.level, id: params.id } };
}

export default function LessonPage({ level: initialLevel, id: initialId }) {
  const router = useRouter();
  
  // 优先使用静态生成的 props，如果不可用则从 query 获取
  const level = initialLevel || router.query.level;
  const id = initialId || router.query.id;
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (level && id) {
      const dataKey = `${level}_${id}`;
      const data = hskLessonsIndex[dataKey];
      if (data) {
        setLessonData(data);
      }
      setLoading(false);
    }
  }, [level, id]);

  const formattedLesson = useMemo(() => {
    if (!lessonData) return null;
    if (lessonData.blocks && lessonData.blocks.length > 0) return lessonData;

    const generatedBlocks = [];
    if (lessonData.description) {
        generatedBlocks.push({ type: 'teaching', content: { title: "课程介绍", text: lessonData.description } });
    }
    if (lessonData.newWords) {
      generatedBlocks.push({
        type: 'word_study',
        content: {
          title: "核心生词学习",
          words: lessonData.newWords.map((w, idx) => ({
            id: `word-${idx}`, word: w.hanzi || w.word, chinese: w.hanzi || w.word, pinyin: w.pinyin, meaning: w.meaning
          }))
        }
      });
    }
    if (lessonData.dialogues) {
      generatedBlocks.push({
        type: 'sentences',
        content: {
          title: "课文朗读",
          sentences: lessonData.dialogues.map((d, idx) => ({
            id: `sen-${idx}`, chinese: d.content, pinyin: d.pinyin, meaning: d.translation, avatar: d.avatar, role: d.role
          }))
        }
      });
    }
    generatedBlocks.push({ type: 'complete', content: { title: "学习完成", message: "继续加油！" } });
    return { ...lessonData, blocks: generatedBlocks };
  }, [lessonData]);

  if (loading) return <div className="h-screen flex items-center justify-center">加载中...</div>;
  if (!formattedLesson) return <div className="h-screen flex items-center justify-center">未找到课程数据</div>;

  return (
    <>
      <Head>
        <title>{formattedLesson.title || `HSK ${level} Lesson ${id}`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <InteractiveLesson lesson={formattedLesson} />
    </>
  );
}
