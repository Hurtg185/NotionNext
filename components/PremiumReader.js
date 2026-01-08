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

// =================================================
// 1. 核心修复：解决新版 PDF.js 的 URL.parse 兼容性报错
// =================================================
if (typeof URL !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = function(url, base) {
    try { return new URL(url, base); } catch (e) { return null; }
  };
}

// 样式补丁 (确保路径正确)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 设置 Worker (使用 CDN 确保加载速度)
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

  // 手势支持 (右滑返回，左右滑动翻页)
  const handlers = useSwipeable({
    onSwipedLeft: () => pageNumber < numPages && setPageNumber(p => p + 1),
    onSwipedRight: () => {
        if (pageNumber > 1) setPageNumber(p => p - 1);
        else onClose();
    },
    trackMouse: true
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans"
    >
      {/* 1. 顶部工具栏 (白色磨砂) */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-800 truncate max-w-[160px] leading-tight">{title}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Page {pageNumber} / {numPages || '--'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={toggleBookmark} 
            className={`p-2 rounded-full transition-all ${bookmarks.includes(pageNumber) ? 'text-amber-500 scale-110' : 'text-slate-300'}`}
          >
            <Star size={20} fill={bookmarks.includes(pageNumber) ? "currentColor" : "none"} />
          </button>
          <button onClick={() => setShowSidebar(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <List size={22} />
          </button>
        </div>

        {/* 顶部进度条 */}
        <div className="absolute bottom-0 left-0 h-[3px] bg-indigo-500 transition-all duration-500" style={{ width: `${(pageNumber/numPages)*100}%` }} />
      </header>

      {/* 2. PDF 渲染区域 (背景浅灰，突出白色纸张) */}
      <main 
        {...handlers} 
        className="flex-1 overflow-auto flex justify-center bg-slate-200/50 pt-20 pb-28 px-4 scrollbar-hide select-none"
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          options={{
            cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
            cMapPacked: true,
          }}
          loading={
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <div className="relative">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
                <BookOpen className="absolute inset-0 m-auto text-indigo-200" size={20} />
              </div>
              <p className="text-xs font-bold tracking-widest uppercase">Fetching Document...</p>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-xl shadow-slate-300/50 rounded-sm border border-slate-300/20"
            width={Math.min(window.innerWidth - 32, 600)}
          />
        </Document>
      </main>

      {/* 3. 底部悬浮控制台 (胶囊设计) */}
      <footer className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-white/90 backdrop-blur-2xl rounded-full border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-30">
        <button 
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber(p => p - 1)}
          className="p-2 text-slate-700 disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="h-6 w-[1px] bg-slate-200 mx-2" />

        <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 text-slate-400 hover:text-indigo-500"><ZoomOut size={18}/></button>
            <span className="text-[11px] font-black text-slate-700 min-w-[45px] text-center">{Math.round(scale*100)}%</span>
            <button onClick={() => setScale(s => Math.min(s + 0.2, 2.0))} className="p-2 text-slate-400 hover:text-indigo-500"><ZoomIn size={18}/></button>
        </div>

        <div className="h-6 w-[1px] bg-slate-200 mx-2" />

        <button 
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber(p => p + 1)}
          className="p-2 text-slate-700 disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronRight size={24} />
        </button>
      </footer>

      {/* 4. 侧边栏 (白色面板) */}
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
              className="absolute top-0 right-0 bottom-0 w-80 bg-white z-[50] shadow-2xl flex flex-col border-l border-slate-100"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <List size={18} />
                    </div>
                    <h2 className="text-slate-800 font-black text-lg">Index</h2>
                </div>
                <button onClick={() => setShowSidebar(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
                {/* 书签板块 */}
                <div>
                  <div className="flex items-center gap-2 text-amber-500 mb-4 px-1">
                    <Bookmark size={14} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Saved Pages</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {bookmarks.map(p => (
                      <button 
                        key={p} 
                        onClick={() => { setPageNumber(p); setShowSidebar(false); }}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${pageNumber === p ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-200'}`}
                      >
                        P. {p}
                      </button>
                    ))}
                    {bookmarks.length === 0 && <p className="col-span-3 text-[11px] text-slate-400 px-2 py-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">No bookmarks saved yet</p>}
                  </div>
                </div>

                {/* 目录板块 (PDF Outline) */}
                <div>
                   <div className="flex items-center gap-2 text-indigo-500 mb-4 px-1">
                    <Search size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Table of Contents</span>
                  </div>
                  <div className="text-slate-600 premium-outline">
                    <Document file={url}>
                      <Outline 
                        onItemClick={({ pageNumber }) => {
                          if (pageNumber) setPageNumber(pageNumber);
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
        .premium-outline ul { list-style: none; padding-left: 8px; }
        .premium-outline li { 
            margin: 14px 0; 
            font-weight: 700; 
            cursor: pointer; 
            color: #475569; 
            font-size: 13px;
            padding: 8px 12px;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px solid #f1f5f9;
            transition: all 0.2s;
        }
        .premium-outline li:hover { 
            color: #4f46e5; 
            background: #eef2ff;
            border-color: #e0e7ff;
            transform: translateX(4px);
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </motion.div>
  );
}
