import React from 'react';
import dynamic from 'next/dynamic'; // 1. 导入 dynamic

// 2. 使用 dynamic 动态导入您的 UI 组件，并禁用服务器端渲染 (SSR)
const TranslatorUI = dynamic(
  () => import('../components/TranslatorUI'),
  { ssr: false } // 3. 这是最关键的一行！
);

// 这是翻译器的页面 (Page)
export default function TranslatorPage() {
  // 这个页面现在会确保 TranslatorUI 组件只在用户的浏览器中加载和渲染
  return <TranslatorUI />;
}
