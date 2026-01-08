'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // 核心逻辑：利用 Mozilla 官方提供的托管阅读器，绕过本地库的崩溃问题
  // 注意：这要求你的 R2 CORS 策略必须允许所有 Origins (*)
  const pdfViewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[200] bg-white flex flex-col font-sans"
    >
      {/* 顶部工具栏 - 极简浅色 */}
      <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 active:bg-slate-50 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="max-w-[200px]">
            <h1 className="text-sm font-bold text-slate-800 truncate">{title}</h1>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 text-slate-400">
           <RefreshCw size={18} />
        </button>
      </header>

      {/* 阅读器区域 */}
      <div className="flex-1 relative bg-slate-50">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading PDF Viewer...</p>
          </div>
        )}
        
        <iframe
          src={pdfViewerUrl}
          className="w-full h-full border-none"
          onLoad={() => setIsLoading(false)}
          allowFullScreen
        />
      </div>

      {/* 底部按钮 - 备选方案 */}
      <footer className="p-4 bg-white border-t border-slate-50 shrink-0">
         <button 
           onClick={() => window.open(url, '_blank')}
           className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
         >
           <ExternalLink size={16} /> 如果无法预览，点击此处下载/打开
         </button>
      </footer>
    </motion.div>
  );
}
