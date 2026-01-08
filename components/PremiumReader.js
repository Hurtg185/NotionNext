'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, Outline, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, List, Bookmark, Star, 
  ZoomIn, ZoomOut, Search, 
  ChevronRight, Loader2, X, BookOpen, Clock
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

// === 1. 兼容性补丁 (修复 URL.parse 报错) ===
if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = function(url, base) {
    try { return new URL(url, base); } catch (e) { return null; }
  };
}

// === 2. Worker 锁定 (使用 4.4.168 避免兼容性问题) ===
const PDF_JS_VERSION = '4.4.168';
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;
}

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

const STORAGE_KEY = 'hsk-reader-meta';

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 600);

  // 确保组件仅在客户端挂载 (解决 Application Error)
  useEffect(() => {
    setIsClient(true);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    // 加载进度
    const saved = localStorage.getItem(`${STORAGE_KEY}_${bookId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.page) setPageNumber(data.page);
        if (data.bookmarks) setBookmarks(data.bookmarks);
      } catch (e) { console.error(e); }
    }
    
    return () => window.removeEventListener('resize', handleResize);
  }, [bookId]);

  // 保存进度
  useEffect(() => {
    if (numPages && isClient) {
      localStorage.setItem(`${STORAGE_KEY}_${bookId}`, JSON.stringify({
        page: pageNumber,
        bookmarks: bookmarks,
        lastRead: new Date().toISOString()
      }));
    }
  }, [pageNumber, bookmarks, numPages, bookId, isClient]);

  const onDocumentLoadSuccess = ({ numPages: total }) => {
    setNumPages(total);
    setIsLoading(false);
  };

  const toggleBookmark = () => {
    setBookmarks(prev => 
      prev.includes(pageNumber) ? prev.filter(p => p !== pageNumber) : [...prev, pageNumber].sort((a,b)=>a-b)
    );
  };

  const goToPage = (p) => {
    const target = Math.max(1, Math.min(p, numPages));
    setPageNumber(target);
    setShowSidebar(false);
  };

  // 键盘支持
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') setPageNumber(p => Math.max(p - 1, 1));
      if (e.key === 'ArrowRight') setPageNumber(p => Math.min(p + 1, numPages || p));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [numPages, onClose]);

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
      {/* 1. 顶部工具栏 (浅色优雅) */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><ChevronLeft size={24} /></button>
          <div>
            <h1 className="text-sm font-black text-slate-800 truncate max-w-[150px] leading-tight">{title}</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">P. {pageNumber} / {numPages || '--'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={toggleBookmark} className={`p-2 rounded-full transition-colors ${bookmarks.includes(pageNumber) ? 'text-amber-500' : 'text-slate-300'}`}>
            <Star size={20} fill={bookmarks.includes(pageNumber) ? "currentColor" : "none"} />
          </button>
          <button onClick={() => setShowSidebar(true)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full"><List size={22} /></button>
        </div>
        <div className="absolute bottom-0 left-0 h-[3px] bg-indigo-500 transition-all duration-300" style={{ width: `${(pageNumber/numPages)*100}%` }} />
      </header>

      {/* 2. PDF 主区域 */}
      <main {...handlers} className="flex-1 overflow-auto bg-slate-200/50 flex flex-col items-center pt-8 pb-32 px-4 scrollbar-hide">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          options={{
            cMapUrl: `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/cmaps/`,
            cMapPacked: true, // 必须开启，否则中文乱码
            standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/standard_fonts/`,
          }}
          loading={<div className="flex flex-col items-center mt-32 text-slate-400 gap-4"><Loader2 className="animate-spin text-indigo-500" size={48} /><p className="text-xs font-bold uppercase tracking-widest">Opening Book...</p></div>}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-2xl rounded-sm border border-slate-300/20"
            width={Math.min(windowWidth - 32, 600)}
          />
        </Document>
      </main>

      {/* 3. 底部悬浮控制栏 */}
      <footer className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-2 bg-white/90 backdrop-blur-2xl rounded-full border border-slate-200 shadow-xl shadow-slate-200/50 z-30">
        <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="p-2 text-slate-700 disabled:opacity-20"><ChevronLeft size={24} /></button>
        <div className="h-6 w-[1px] bg-slate-200 mx-2" />
        <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 text-slate-400"><ZoomOut size={18}/></button>
            <span className="text-[11px] font-black text-slate-700 min-w-[45px] text-center">{Math.round(scale*100)}%</span>
            <button onClick={() => setScale(s => Math.min(s + 0.2, 2.0))} className="p-2 text-slate-400"><ZoomIn size={18}/></button>
        </div>
        <div className="h-6 w-[1px] bg-slate-200 mx-2" />
        <button disabled={pageNumber >= (numPages || 0)} onClick={() => setPageNumber(p => p + 1)} className="p-2 text-slate-700 disabled:opacity-20"><ChevronRight size={24} /></button>
      </footer>

      {/* 4. 侧边栏 (高级功能合集) */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSidebar(false)} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-[40]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute top-0 right-0 bottom-0 w-80 bg-white z-[50] shadow-2xl flex flex-col border-l border-slate-100">
              <div className="p-6 flex items-center justify-between border-b border-slate-50 shrink-0">
                <h2 className="text-slate-800 font-black text-lg">Contents</h2>
                <button onClick={() => setShowSidebar(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
                {/* 快速跳转 */}
                <div>
                   <div className="flex items-center gap-2 text-slate-500 mb-3 px-1 font-bold text-xs uppercase tracking-widest"><Search size={14}/> Jump to</div>
                   <div className="flex gap-2">
                     <input 
                       type="number" 
                       placeholder={`1 - ${numPages}`} 
                       className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                       onKeyDown={(e) => e.key === 'Enter' && goToPage(parseInt(e.target.value))}
                     />
                   </div>
                </div>

                {/* 书签板块 */}
                <div>
                  <div className="flex items-center gap-2 text-amber-500 mb-3 px-1 font-bold text-xs uppercase tracking-widest"><Bookmark size={14} fill="currentColor" /> Bookmarks</div>
                  <div className="grid grid-cols-3 gap-2">
                    {bookmarks.map(p => (
                      <button key={p} onClick={() => goToPage(p)} className={`py-2 text-xs font-bold rounded-xl border transition-all ${pageNumber === p ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>P. {p}</button>
                    ))}
                    {bookmarks.length === 0 && <p className="col-span-3 text-[11px] text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No bookmarks saved</p>}
                  </div>
                </div>

                {/* 目录/大纲 */}
                <div>
                   <div className="flex items-center gap-2 text-indigo-500 mb-3 px-1 font-bold text-xs uppercase tracking-widest"><BookOpen size={14} /> Outline</div>
                   <div className="text-slate-600 text-sm premium-outline">
                      <Document file={url}>
                         <Outline onItemClick={({ pageNumber }) => goToPage(pageNumber)} />
                      </Document>
                   </div>
                </div>
              </div>
              
              {/* 进度百分比底部 */}
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Progress</span>
                    <span className="text-xs font-black text-indigo-600">{Math.round((pageNumber/numPages)*100)}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(pageNumber/numPages)*100}%` }} />
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .react-pdf__Outline__item { margin: 8px 0; padding: 10px; background: #f8fafc; border-radius: 12px; cursor: pointer; font-weight: 700; color: #475569; font-size: 13px; transition: all 0.2s; border: 1px solid #f1f5f9; }
        .react-pdf__Outline__item:hover { transform: translateX(5px); background: #eef2ff; color: #4f46e5; border-color: #e0e7ff; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </motion.div>
  );
        }
