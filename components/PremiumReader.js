'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2, ExternalLink, X, BookOpen, AlertCircle } from 'lucide-react';

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // 1.5秒后关闭加载动画
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!isClient) return null;

  // 针对 R2 中文路径的特殊处理：确保 URL 是被编码的
  const safeUrl = url; 

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans text-slate-900"
    >
      {/* 顶部工具栏 - 浅色大厂风格 */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={26} />
          </button>
          <div className="max-w-[180px]">
            <h1 className="text-sm font-black text-slate-800 truncate leading-tight">{title}</h1>
            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Premium Reading</p>
          </div>
        </div>

        <button onClick={() => window.open(url, '_blank')} className="p-2 text-slate-400">
           <ExternalLink size={20} />
        </button>
      </header>

      {/* PDF 主内容区 */}
      <main className="flex-1 relative bg-slate-100/50 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">စာအုပ်ကို ဖွင့်နေသည်...</p>
          </div>
        )}

        {/* 
            核心修复：使用 <embed> 标签。
            对于移动端浏览器，它会自动调用系统 PDF 引擎。
            加上 #toolbar=0 可以隐藏原生工具栏（取决于浏览器支持）
        */}
        <embed
          src={`${safeUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          type="application/pdf"
          className="w-full h-full"
          onLoad={() => setIsLoading(false)}
        />
        
        {/* 备选方案：如果上面的没显示，点击这个链接 */}
        <div className="absolute bottom-10 left-0 right-0 px-10 pointer-events-none">
            <div className="bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl border border-slate-100 text-center pointer-events-auto">
                <p className="text-[10px] text-slate-500 mb-2">如果您看不到书籍内容，请点击下方按钮</p>
                <button 
                    onClick={() => window.open(url, '_blank')}
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                    在浏览器新窗口打开
                </button>
            </div>
        </div>
      </main>

      {/* 底部装饰 */}
      <footer className="h-6 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </footer>
    </motion.div>
  );
}
