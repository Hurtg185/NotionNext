// pages/translator.js

import Head from 'next/head';
// 1. 引入 dynamic
import dynamic from 'next/dynamic';

// 2. 使用 dynamic 动态引入组件，并强制关闭 SSR (服务端渲染)
// 这样 Next.js 在构建时就会跳过这个组件，不再报错 "self is not defined"
const TranslatorChat = dynamic(
  () => import('../components/TranslatorChat'),
  { 
    ssr: false, // 关键配置：禁止服务端渲染
    loading: () => (
      // 可选：加载时的占位符，避免页面空白
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white opacity-80">正在加载翻译引擎...</div>
      </div>
    )
  }
);

export default function Home() {
  return (
    <>
      <Head>
        <title>中缅翻译 - AI 智能翻译引擎</title>
        <meta name="description" content="中缅双语智能翻译" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        {/* 3. 像平时一样使用组件 */}
        <TranslatorChat />
      </main>
    </>
  );
}
