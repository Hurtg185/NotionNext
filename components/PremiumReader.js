'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

// === 1. 核心补丁：防止 URL.parse 报错 ===
if (typeof window !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = (url, base) => { try { return new URL(url, base); } catch (e) { return null; } };
}

// === 2. 锁定并配置 Worker (使用稳定版 CDN) ===
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isClient, setIsClient] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [useFallback, setUseFallback] = useState(false); // 是否切换到原生模式

  // 确保只在客户端运行
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // --- 模式 A：高级阅读器 (react-pdf) ---
  const renderAdvancedReader = () => (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => {
        setNumPages(numPages);
        setLoadError(false);
      }}
      onLoadError={(err) => {
        console.error("PDF高级插件加载失败:", err);
        setLoadError(true);
        // 如果报错且不是因为网络，3秒后自动尝试原生模式
        setTimeout(() => setUseFallback(true), 1000);
      }}
      loading={
        <div className="flex flex-col items-center mt-32 text-slate-400 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={48} />
          <p className="text-xs font-bold uppercase tracking-widest">正在解析文档...</p>
        </div>
      }
    >
      <Page 
        pageNumber={pageNumber} 
        width={Math.min(window.innerWidth - 32, 600)}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        className="shadow-2xl rounded-sm border border-slate-200"
      />
    </Document>
  );

  // --- 模式 B：原生阅读器 (Iframe - 最稳兼容方案) ---
  const renderNativeReader = () => (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-slate-800 font-bold mb-2">切换到兼容阅读模式</h3>
        <p className="text-xs text-slate-500 mb-6">当前环境不支持高级渲染，已为你切换至原生模式。</p>
        <button 
          onClick={() => window.open(url, '_blank')}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
        >
          <ExternalLink size={18} />
          直接在浏览器打开
        </button>
      </div>
      
      {/* 备选方案：尝试用 iframe 嵌入 */}
      <iframe src={url} className="w-full h-full mt-6 rounded-t-3xl border-none shadow-2xl bg-white" title="PDF Reader" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans"
    >
      {/* 顶部工具栏 */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-800 truncate max-w-[180px] leading-tight">{title}</h1>
            {!useFallback && <p className="text-[10px] text-slate-400 font-bold">P. {pageNumber} / {numPages || '--'}</p>}
          </div>
        </div>
        <div className="text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-md uppercase tracking-tighter">
          {useFallback ? 'Native Mode' : 'Premium Mode'}
        </div>
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-auto bg-slate-200/50 flex flex-col items-center scrollbar-hide relative">
        {useFallback ? renderNativeReader() : (
           <div className="pt-8 pb-32">
             {renderAdvancedReader()}
           </div>
        )}
      </main>

      {/* 底部翻页 (仅在高级模式显示) */}
      {!useFallback && numPages && (
        <footer className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8 px-8 py-3 bg-white/90 backdrop-blur-2xl rounded-full border border-slate-200 shadow-2xl z-30">
          <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="text-slate-700 disabled:opacity-20 active:scale-90 transition-transform">
             <ChevronLeft size={28} />
          </button>
          <span className="text-sm font-black tabular-nums">{pageNumber} / {numPages}</span>
          <button disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)} className="text-slate-700 disabled:opacity-20 active:scale-90 transition-transform rotate-180">
             <ChevronLeft size={28} />
          </button>
        </footer>
      )}
    </motion.div>
  );
}
