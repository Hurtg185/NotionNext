// pages/translator.js

import Head from 'next/head';
import TranslatorChat from '../components/TranslatorChat';

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
        <TranslatorChat />
      </main>
    </>
  );
}
