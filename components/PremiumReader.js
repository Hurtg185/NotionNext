'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, Outline, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, List, Bookmark, Star, 
  Maximize2, ZoomIn, ZoomOut, Search, 
  ChevronRight, Loader2, X, Download, Clock
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

// 样式补丁
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 设置 Worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const STORAGE_KEY = 'hsk-reader-meta';

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. 读取历史进度与书签
  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_${bookId}`);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.page) setPageNumber(data.page);
      if (data.bookmarks) setBookmarks(data.bookmarks);
    }
  }, [bookId]);

  // 2. 自动保存进度
  useEffect(() => {
    if (numPages) {
      localStorage.setItem(`${STORAGE_KEY}_${bookId}`, JSON.stringify({
        page: pageNumber,
        bookmarks: bookmarks,
        lastRead: new Date().toISOString()
      }));
    }
  }, [pageNumber, bookmarks, numPages, bookId]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const toggleBookmark = () => {
    setBookmarks(prev => 
      prev.includes(pageNumber) ? prev.filter(p => p !== pageNumber) : [...prev, pageNumber].sort((a,b)=>a-b)
    );
  };

  // 手势支持
  const handlers = useSwipeable({
    onSwipedLeft: () => pageNumber < numPages && setPageNumber(p => p + 1),
    onSwipedRight: () => pageNumber > 1 ? setPageNumber(p => p - 1) : onClose(),
    trackMouse: true
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col font-sans"
    >
      {/* 1. 顶部悬浮工具栏 (毛玻璃) */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-slate-900/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 z-30 text-white">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-sm font-black truncate max-w-[140px] leading-tight">{title}</h1>
            <p className="text-[10px] text-slate-400 font-medium">Page {pageNumber} of {numPages}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={toggleBookmark} className={`p-2 rounded-full ${bookmarks.includes(pageNumber) ? 'text-amber-400' : 'text-white/60'}`}>
            <Star size={20} fill={bookmarks.includes(pageNumber) ? "currentColor" : "none"} />
          </button>
          <button onClick={() => setShowSidebar(true)} className="p-2 text-white/60">
            <List size={20} />
          </button>
        </div>

        {/* 顶部细进度条 */}
        <div className="absolute bottom-0 left-0 h-[2px] bg-blue-500 transition-all duration-300" style={{ width: `${(pageNumber/numPages)*100}%` }} />
      </header>

      {/* 2. 主渲染区域 */}
      <main {...handlers} className="flex-1 overflow-auto flex justify-center bg-slate-950 pt-20 pb-24 px-4 scrollbar-hide">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <Loader2 className="animate-spin" size={40} />
              <p className="text-sm font-medium">Downloading PDF...</p>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-2xl shadow-black/50 rounded-sm"
            width={Math.min(window.innerWidth - 32, 600)}
          />
        </Document>
      </main>

      {/* 3. 底部悬浮控制台 */}
      <footer className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-slate-800/80 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl z-30">
        <button 
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber(p => p - 1)}
          className="p-2 text-white disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="h-6 w-[1px] bg-white/10 mx-2" />

        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 text-white/60"><ZoomOut size={18}/></button>
        <span className="text-[10px] font-bold text-white min-w-[40px] text-center">{Math.round(scale*100)}%</span>
        <button onClick={() => setScale(s => Math.min(s + 0.2, 2.0))} className="p-2 text-white/60"><ZoomIn size={18}/></button>

        <div className="h-6 w-[1px] bg-white/10 mx-2" />

        <button 
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber(p => p + 1)}
          className="p-2 text-white disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronRight size={24} />
        </button>
      </footer>

      {/* 4. 侧边栏 (目录与书签) */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[40]"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="absolute top-0 right-0 bottom-0 w-72 bg-slate-900 z-[50] shadow-2xl flex flex-col border-l border-white/10"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                <h2 className="text-white font-black">Contents</h2>
                <button onClick={() => setShowSidebar(false)} className="text-slate-400"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 书签板块 */}
                <div>
                  <div className="flex items-center gap-2 text-amber-400 mb-3 px-2">
                    <Star size={14} fill="currentColor" />
                    <span className="text-xs font-black uppercase tracking-widest">Bookmarks</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {bookmarks.map(p => (
                      <button 
                        key={p} 
                        onClick={() => { setPageNumber(p); setShowSidebar(false); }}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all ${pageNumber === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}
                      >
                        P. {p}
                      </button>
                    ))}
                    {bookmarks.length === 0 && <p className="col-span-3 text-[10px] text-slate-600 px-2 italic">No bookmarks yet</p>}
                  </div>
                </div>

                {/* 目录板块 (PDF Outline) */}
                <div>
                   <div className="flex items-center gap-2 text-blue-400 mb-3 px-2">
                    <List size={14} />
                    <span className="text-xs font-black uppercase tracking-widest">Outline</span>
                  </div>
                  <div className="text-slate-300 text-sm premium-outline">
                    <Document file={url}>
                      <Outline 
                        onItemClick={({ pageNumber }) => {
                          setPageNumber(pageNumber);
                          setShowSidebar(false);
                        }}
                      />
                    </Document>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .premium-outline ul { list-style: none; padding-left: 10px; }
        .premium-outline li { margin: 12px 0; font-weight: 600; cursor: pointer; color: #94a3b8; font-size: 13px; }
        .premium-outline li:hover { color: #3b82f6; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </motion.div>
  );
}
