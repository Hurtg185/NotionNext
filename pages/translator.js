// pages/translate.jsx
import Head from 'next/head';
import Translator from '../components/Translator';

export default function TranslatePage() {
  return (
    <>
      <Head>
        <title>中缅翻译 | Myanmar-Chinese Translator</title>
        <meta name="description" content="专业的中缅双语翻译工具，提供5种翻译风格" />
      </Head>
      <Translator />
    </>
  );
}
