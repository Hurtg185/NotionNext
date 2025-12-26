import React from 'react';
// 假设你把刚才那个长代码保存为了 components/GlosbeSearchCard.js
import GlosbeSearchCard from './components/GlosbeSearchCard'; 

const TranslatePage = () => {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-gray-900 relative overflow-hidden flex flex-col items-center justify-center p-4">
      
      {/* 🟢 1. 装饰性背景 (可选) - 让页面看起来不像白板 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[500px] h-[500px] bg-violet-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* 🟢 2. 页面标题/导航栏 (可选) */}
      <nav className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
            G
          </div>
          <span className="text-xl font-bold text-slate-700 dark:text-white tracking-tight">
            AI Translator
          </span>
        </div>
        {/* 如果需要返回主页按钮 */}
        {/* <a href="/" className="text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors">返回首页</a> */}
      </nav>

      {/* 🟢 3. 核心翻译组件 */}
      <div className="z-10 w-full max-w-2xl">
        {/* 这里的 max-w-2xl 可以覆盖组件内部的宽度限制，让它在独立页宽一点 */}
        <div className="scale-100 sm:scale-110 transition-transform duration-500"> 
           <GlosbeSearchCard />
        </div>
      </div>

      {/* 🟢 4. 底部版权/链接 (可选) */}
      <footer className="absolute bottom-4 text-center text-xs text-slate-400 dark:text-slate-600 z-10">
        Powered by DeepSeek / Gemini & Microsoft TTS
      </footer>
      
      {/* 补充 CSS 动画 (如果你的 tailwind.config.js 没配置 blob 动画，可以直接用 style) */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default TranslatePage;
