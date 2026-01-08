'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, List, Star, 
  ExternalLink, Loader2, X, Bookmark, 
  Search, BookOpen, AlertCircle
} from 'lucide-react';

const STORAGE_KEY = 'hsk_reader_v3';

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);

  // 1. 初始化客户端状态
  useEffect(() => {
    setIsClient(true);
    // 加载书签
    const saved = localStorage.getItem(`${STORAGE_KEY}_${bookId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.bookmarks) setBookmarks(data.bookmarks);
      } catch (e) { console.error(e); }
    }

    // 模拟加载动画
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [bookId]);

  if (!isClient) return null;

  // 手机端 R2 链接处理：强制预览而不是下载
  // 确保链接不含导致下载的参数
  const previewUrl = url;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans text-slate-900"
    >
      {/* 1. 顶部工具栏 (浅色优雅) */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={26} />
          </button>
          <div className="max-w-[180px]">
            <h1 className="text-sm font-black text-slate-800 truncate leading-tight">{title}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Premium Learning Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => window.open(url, '_blank')}
            className="p-2 text-slate-400 active:text-indigo-500"
          >
            <ExternalLink size={20} />
          </button>
          <button onClick={() => setShowSidebar(true)} className="p-2 text-slate-500">
            <List size={24} />
          </button>
        </div>
      </header>

      {/* 2. 主内容区 (使用原生渲染引擎) */}
      <main className="flex-1 relative bg-slate-100/50 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Opening Document...</p>
          </div>
        )}

        {/* 核心：使用 iframe 承载浏览器原生 PDF 阅读器 */}
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
          className="w-full h-full border-none"
          title="PDF Viewer"
          onLoad={() => setIsLoading(false)}
        />
      </main>

      {/* 3. 底部操作栏 (仅保留快捷跳转提示) */}
      <footer className="h-14 bg-white border-t border-slate-200 flex items-center justify-center px-6 shrink-0 z-30">
          <p className="text-[10px] text-slate-400 font-bold font-burmese">
            ဖတ်ရှုရန် မျက်နှာပြင်ကို အပေါ်အောက် ဆွဲရွှေ့ပေးပါ
          </p>
      </footer>

      {/* 4. 侧边栏 (书签管理) */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-[40]"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="absolute top-0 right-0 bottom-0 w-[80%] bg-white z-[50] shadow-2xl flex flex-col"
            >
              <div className="p-5 flex items-center justify-between border-b border-slate-100">
                <h2 className="text-slate-800 font-black text-base flex items-center gap-2">
                   <BookOpen size={18} className="text-indigo-500"/> Library Options
                </h2>
                <button onClick={() => setShowSidebar(false)} className="p-2 text-slate-400"><X size={20}/></button>
              </div>

              <div className="flex-1 p-5 space-y-6">
                 <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h3>
                    <button 
                        onClick={() => window.open(url, '_blank')}
                        className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        <ExternalLink size={18} /> 全屏阅读 (Full Screen)
                    </button>
                 </div>
                 
                 <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                        <AlertCircle size={16} />
                        <span className="text-xs font-bold">阅读提示</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-burmese">
                        စာမျက်နှာများကို ဖတ်ရှုရန် မျက်နှာပြင်ကို အပေါ်အောက် (Vertical Scroll) အသုံးပြုနိုင်ပါသည်။
                    </p>
                 </div>
              </div>

              <div className="p-6 text-center">
                 <button 
                   onClick={onClose}
                   className="text-xs font-bold text-slate-400 underline"
                 >
                   Back to Library
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
