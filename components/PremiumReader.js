'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, Outline, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, List, Star, ZoomIn, ZoomOut, 
  ChevronRight, Loader2, X, Bookmark, Search,
  AlertCircle, ExternalLink, BookOpen
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

// ==========================================
// 1. 兼容性与服务端补丁 (彻底解决 Application Error)
// ==========================================
if (typeof window !== 'undefined') {
  // 修复 URL.parse 报错
  if (typeof URL.parse !== 'function') {
    URL.parse = (url, base) => { try { return new URL(url, base); } catch (e) { return null; } };
  }
  // 修复服务端找不到 self 的问题
  if (!window.self) window.self = window;
}

// 样式补丁
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 锁定稳定版 Worker (使用 CDN)
const PDF_JS_VERSION = '4.4.168';
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.mjs`;
}

const STORAGE_KEY = 'hsk_reader_v2';

export default function PremiumReader({ url, bookId, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [windowWidth, setWindowWidth] = useState(0);

  // 初始化：处理客户端状态、窗口大小、本地进度
  useEffect(() => {
    setIsClient(true);
    setWindowWidth(window.innerWidth);
    
    const savedData = localStorage.getItem(`${STORAGE_KEY}_${bookId}`);
    if (savedData) {
      const { page, savedBookmarks } = JSON.parse(savedData);
      if (page) setPageNumber(page);
      if (savedBookmarks) setBookmarks(savedBookmarks);
    }

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bookId]);

  // 自动保存进度
  useEffect(() => {
    if (isClient && numPages) {
      localStorage.setItem(`${STORAGE_KEY}_${bookId}`, JSON.stringify({
        page: pageNumber,
        savedBookmarks: bookmarks,
        lastTime: new Date().getTime()
      }));
    }
  }, [pageNumber, bookmarks, numPages, bookId, isClient]);

  // 手势控制：手机端核心体验
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => pageNumber < numPages && setPageNumber(p => p + 1),
    onSwipedRight: () => {
      if (pageNumber > 1) setPageNumber(p => p - 1);
      else onClose(); // 第一页右滑关闭
    },
    trackMouse: true,
    delta: 50,
    preventScrollOnSwipe: true
  });

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoadError(null);
  };

  const toggleBookmark = () => {
    setBookmarks(prev => 
      prev.includes(pageNumber) ? prev.filter(p => p !== pageNumber) : [...prev, pageNumber].sort((a,b)=>a-b)
    );
  };

  const jumpToPage = (p) => {
    setPageNumber(Math.max(1, Math.min(p, numPages)));
    setShowSidebar(false);
  };

  if (!isClient) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans text-slate-900 select-none"
    >
      {/* 顶部工具栏 (白色磨砂) */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-full">
            <ChevronLeft size={26} />
          </button>
          <div className="max-w-[160px]">
            <h1 className="text-sm font-black text-slate-800 truncate leading-tight">{title}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Page {pageNumber} / {numPages || '--'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={toggleBookmark}
            className={`p-2 transition-all ${bookmarks.includes(pageNumber) ? 'text-amber-500 scale-110' : 'text-slate-300'}`}
          >
            <Star size={22} fill={bookmarks.includes(pageNumber) ? "currentColor" : "none"} />
          </button>
          <button onClick={() => setShowSidebar(true)} className="p-2 text-slate-500 active:bg-slate-100 rounded-full">
            <List size={24} />
          </button>
        </div>

        {/* 顶部细进度条 */}
        <div 
            className="absolute bottom-0 left-0 h-[3px] bg-indigo-500 transition-all duration-300" 
            style={{ width: `${(pageNumber / (numPages || 1)) * 100}%` }} 
        />
      </header>

      {/* PDF 核心内容区 */}
      <main 
        {...swipeHandlers}
        className="flex-1 overflow-auto bg-slate-100/50 flex flex-col items-center pt-4 pb-32 scrollbar-hide"
      >
        {loadError ? (
           <div className="mt-20 px-10 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-bold text-slate-800 mb-2">无法加载 PDF</h3>
              <p className="text-xs text-slate-500 mb-6">链接可能已失效或网络跨域受阻</p>
              <button 
                onClick={() => window.open(url, '_blank')}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <ExternalLink size={18} /> 直接在浏览器打开
              </button>
           </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => setLoadError(err.message)}
            options={{
              cMapUrl: `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/standard_fonts/`,
            }}
            loading={
                <div className="flex flex-col items-center mt-32 text-slate-400 gap-4">
                    <Loader2 className="animate-spin text-indigo-500" size={40} />
                    <p className="text-xs font-bold tracking-widest uppercase">Fetching Book...</p>
                </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              width={windowWidth - 20}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="shadow-lg border border-slate-200"
              loading={<div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-md" />}
            />
          </Document>
        )}
      </main>

      {/* 底部浮动控制台 (手机端单手优化) */}
      <footer className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-2.5 bg-white/95 backdrop-blur-2xl rounded-full border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.1)] z-30">
        <button 
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber(p => p - 1)}
          className="p-2 text-slate-700 disabled:opacity-20 active:scale-90"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="h-6 w-[1px] bg-slate-200 mx-1" />

        <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 text-slate-400"><ZoomOut size={18}/></button>
            <span className="text-[11px] font-black text-slate-800 min-w-[40px] text-center">{Math.round(scale*100)}%</span>
            <button onClick={() => setScale(s => Math.min(s + 0.2, 2.5))} className="p-2 text-slate-400"><ZoomIn size={18}/></button>
        </div>

        <div className="h-6 w-[1px] bg-slate-200 mx-1" />

        <button 
          disabled={pageNumber >= (numPages || 0)}
          onClick={() => setPageNumber(p => p + 1)}
          className="p-2 text-slate-700 disabled:opacity-20 active:scale-90 transition-transform rotate-180"
        >
          <ChevronLeft size={28} />
        </button>
      </footer>

      {/* 侧边栏 (目录与书签面板) */}
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
              className="absolute top-0 right-0 bottom-0 w-[80%] bg-white z-[50] shadow-2xl flex flex-col border-l border-slate-100"
            >
              <div className="p-5 flex items-center justify-between border-b border-slate-50 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-indigo-600" />
                    <h2 className="text-slate-800 font-black text-base">Index & Bookmarks</h2>
                </div>
                <button onClick={() => setShowSidebar(false)} className="p-2 text-slate-400"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                {/* 快速跳转输入 */}
                <div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1">Jump to Page</span>
                   <div className="flex gap-2">
                     <input 
                       type="number" 
                       placeholder={`1 - ${numPages}`}
                       className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                       onKeyDown={(e) => e.key === 'Enter' && jumpToPage(parseInt(e.target.value))}
                     />
                   </div>
                </div>

                {/* 书签列表 */}
                <div>
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 block px-1 flex items-center gap-1">
                    <Star size={10} fill="currentColor" /> My Bookmarks
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {bookmarks.map(p => (
                      <button 
                        key={p} 
                        onClick={() => jumpToPage(p)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${pageNumber === p ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                      >
                        P. {p}
                      </button>
                    ))}
                    {bookmarks.length === 0 && <p className="col-span-3 text-[10px] text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">No bookmarks</p>}
                  </div>
                </div>

                {/* 目录 (Outline) */}
                <div>
                   <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 block px-1">Table of Contents</span>
                   <div className="text-slate-600 text-sm premium-outline-mobile">
                      <Document file={url}>
                         <Outline onItemClick={({ pageNumber }) => jumpToPage(pageNumber)} />
                      </Document>
                   </div>
                </div>
              </div>
              
              <div className="p-5 bg-slate-50 border-t border-slate-100 text-[10px] font-bold text-slate-400 text-center">
                 Powered by HSK Premium Reader
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .premium-outline-mobile ul { list-style: none; padding-left: 5px; }
        .premium-outline-mobile li { 
            margin: 12px 0; 
            padding: 10px 12px; 
            background: #f8fafc; 
            border-radius: 12px; 
            font-weight: 700; 
            font-size: 13px; 
            color: #475569;
            border: 1px solid #f1f5f9;
        }
        .premium-outline-mobile li:active { background: #eef2ff; color: #4f46e5; border-color: #e0e7ff; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </motion.div>
  );
}
