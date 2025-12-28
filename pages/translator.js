// pages/translator.js
import Head from 'next/head';
import dynamic from 'next/dynamic';

// 强制关闭 SSR，完美解决 ReferenceError
const TranslatorUI = dynamic(
  () => import('../components/TranslatorUI'), // 确保文件名对应
  { ssr: false }
);

export default function Home() {
  return <TranslatorUI />;
}
