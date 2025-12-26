import React from 'react';
import dynamic from 'next/dynamic';

// 🟢 关键：使用 dynamic 引入组件，并强制关闭 SSR
const GlosbeSearchCard = dynamic(
  () => import('../components/GlosbeSearchCard'), // 👈 确保文件名和你components里的一致
  { ssr: false }
);

export default function TranslatePage() {
  return (
    // 加一个全屏居中背景，不然组件会贴在左上角不好看
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-gray-900 p-4">
      <GlosbeSearchCard />
    </div>
  );
}
