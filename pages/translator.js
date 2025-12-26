import dynamic from 'next/dynamic';

// 使用 dynamic 引用刚才创建的组件，必须设置 ssr: false
const TranslatorMain = dynamic(
  () => import('../components/TranslatorMain'),
  { ssr: false }
);

export default function TranslatorPage() {
  return <TranslatorMain />;
}
