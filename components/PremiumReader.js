'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, List, Star, ZoomIn, ZoomOut, 
  ChevronRight, Loader2, X, BookOpen, AlertCircle
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

// 样式
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// === 锁定稳定版本 (4.4.168) ===
const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
}

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isClient, setIsClient] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // 确保仅客户端加载
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem(`hsk_page_${bookId}`);
    if (saved) setPageNumber(parseInt(saved));
  }, [bookId]);

  // 保存进度
  useEffect(() => {
    if (pageNumber > 1) {
      localStorage.setItem(`hsk_page_${bookId}`, pageNumber);
    }
  }, [pageNumber, bookId]);

  const handlers = useSwipeable({
    onSwipedLeft: () => pageNumber < numPages && setPageNumber(p => p + 1),
    onSwipedRight: () => pageNumber > 1 ? setPageNumber(p => p - 1) : onClose(),
    trackMouse: true
  });

  if (!isClient) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans text-slate-900"
    >
      {/* 顶部工具栏 (浅色磨砂) */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ChevronLeft size={24} />
          </button>
          <div className="max-w-[180px]">
            <h1 className="text-sm font-black text-slate-800 truncate leading-tight">{title}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {pageNumber} / {numPages || '--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">HSK LIBRARY</div>
        </div>
        {/* 顶部细进度条 */}
        <div className="absolute bottom-0 left-0 h-[3px] bg-indigo-500 transition-all duration-300" style={{ width: `${(pageNumber/numPages)*100}%` }} />
      </header>

      {/* PDF 主区域 */}
      <main {...handlers} className="flex-1 overflow-auto bg-slate-100/50 flex flex-col items-center pt-8 pb-32 px-4 scrollbar-hide">
        {loadError ? (
          <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-xs mt-20 border border-slate-100">
             <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
             <p className="text-slate-800 font-bold mb-2">无法预览文档</p>
             <p className="text-xs text-slate-500 mb-6">为了你的体验，建议直接打开或检查网络</p>
             <button 
                onClick={() => window.open(url, '_blank')} 
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold"
             >
                在浏览器中阅读
             </button>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(err) => setLoadError(err.message)}
            options={{
              cMapUrl: `https://unpkg.com/pdfjs-dist@4.4.168/cmaps/`,
              cMapPacked: true,
            }}
            loading={
              <div className="flex flex-col items-center mt-32 text-slate-400 gap-4">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
                <p className="text-xs font-bold tracking-widest uppercase">Opening Book...</p>
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="shadow-xl rounded-sm border border-slate-200"
              width={Math.min(window.innerWidth - 32, 600)}
            />
          </Document>
        )}
      </main>

      {/* 底部悬浮控制栏 */}
      <footer className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-2 bg-white/90 backdrop-blur-2xl rounded-full border border-slate-200 shadow-xl z-30">
        <button 
          disabled={pageNumber <= 1} 
          onClick={() => setPageNumber(p => p - 1)} 
          className="p-2 text-slate-700 disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 text-slate-400"><ZoomOut size={18}/></button>
            <span className="text-[11px] font-black text-slate-700 min-w-[45px] text-center">{Math.round(scale*100)}%</span>
            <button onClick={() => setScale(s => Math.min(s + 0.2, 2.0))} className="p-2 text-slate-400"><ZoomIn size={18}/></button>
        </div>

        <button 
          disabled={pageNumber >= (numPages || 0)} 
          onClick={() => setPageNumber(p => p + 1)} 
          className="p-2 text-slate-700 disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronRight size={24} />
        </button>
      </footer>
    </motion.div>
  );
}
