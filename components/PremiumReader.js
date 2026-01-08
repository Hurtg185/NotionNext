'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

export default function PremiumReader({ url, title, onClose }) {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // --- 核心逻辑 ---
  // 我们借用 Mozilla 官方的 Viewer。
  // 这个阅读器支持几乎所有手机浏览器，且能强行拦截下载行为，变为在线浏览。
  // 注意：传给它的 file 必须是你的 Worker 地址（因为 Worker 解决了跨域问题）
  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans"
    >
      {/* 1. 顶部工具栏 (仿 Zlib 简约风格) */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 active:bg-slate-50 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="max-w-[220px]">
            <h1 className="text-sm font-black text-slate-800 truncate">{title}</h1>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 text-slate-400">
           <RefreshCw size={18} />
        </button>
      </header>

      {/* 2. 阅读器主体 */}
      <div className="flex-1 relative bg-slate-100">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-burmese">စာအုပ်ကို ဖွင့်နေသည်...</p>
          </div>
        )}
        
        {/* 
           用 iframe 嵌入官方 Viewer
           这会强制手机浏览器在网页内渲染 PDF，而不再调用系统的下载工具
        */}
        <iframe
          src={viewerUrl}
          className="w-full h-full border-none"
          onLoad={() => setIsLoading(false)}
          allowFullScreen
        />
      </div>

      {/* 3. 底部紧急备选（防止某些老旧手机依然打不开） */}
      <footer className="p-4 bg-white border-t border-slate-50 shrink-0">
         <button 
           onClick={() => window.open(url, '_blank')}
           className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
         >
           <ExternalLink size={16} /> 如果预览失败，请尝试直接打开
         </button>
      </footer>
    </motion.div>
  );
}
