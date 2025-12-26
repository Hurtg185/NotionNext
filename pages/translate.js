import React from 'react';
import Head from 'next/head';
import GlosbeSearchCard from '../components/GlosbeSearchCard'; // 引用刚才创建的组件

const TranslatePage = () => {
  return (
    <>
      <Head>
        <title>AI 汉缅翻译 | 独立版</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen w-full bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
        
        {/* 背景装饰 */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-50"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-50"></div>
        </div>

        {/* 核心组件 */}
        <div className="z-10 w-full max-w-2xl">
           <GlosbeSearchCard />
        </div>

        {/* 底部版权 */}
        <div className="absolute bottom-4 text-center text-xs text-gray-400 z-10">
          Powered by AI
        </div>
      </div>
    </>
  );
};

export default TranslatePage;
