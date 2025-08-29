// pages/flashcards.js
import React from 'react';
import BeiDanCi from '../components/BeiDanCi'; // 确保路径正确
// 假设你有一个函数来从 Notion 获取 flashcards 数据
// 这个文件通常在 lib/notion.js 或 lib/data.js 等地方
import { getFlashcards } from '../lib/notion_flashcards'; // 你需要创建或修改这个文件

// 这个函数在构建时运行，从 Notion 获取数据
export async function getStaticProps() {
  const flashcards = await getFlashcards(); // 调用你获取 Notion 数据的函数

  // 定义你的背景图片数组
  const backgroundImages = [
    '/images/flashcard-bg-1.jpg', // 确保这些图片在 public/images/ 目录下
    '/images/flashcard-bg-2.jpg',
    '/images/flashcard-bg-3.jpg',
    '/images/flashcard-bg-4.jpg',
    // 可以添加更多图片
  ];

  return {
    props: {
      flashcards,
      backgroundImages,
    },
    revalidate: 3600, // 每隔 1 小时重新生成一次页面，以获取 Notion 中的最新数据
  };
}

const FlashcardsPage = ({ flashcards, backgroundImages }) => {
  const [shuffleMode, setShuffleMode] = React.useState(false);

  if (!flashcards) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-day-DEFAULT dark:bg-night-DEFAULT">
        <p className="text-xl text-gray-700 dark:text-gray-300">正在加载单词数据...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* 这个按钮可以在全屏组件上方，用于切换随机/顺序模式 */}
      <div className="fixed top-0 left-0 w-full flex justify-center p-4 bg-transparent z-[10000]"> {/* 确保按钮在全屏卡片上方 */}
        <button
          onClick={() => setShuffleMode(!shuffleMode)}
          className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 transition-colors duration-200 text-lg"
        >
          {shuffleMode ? '切换到顺序排序' : '切换到随机排序'}
        </button>
      </div>

      <BeiDanCi
        flashcards={flashcards}
        questionTitle="中文-缅文单词学习"
        lang="zh-CN"
        backgroundImages={backgroundImages}
        isShuffle={shuffleMode}
      />
    </div>
  );
};

export default FlashcardsPage;
