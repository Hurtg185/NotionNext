'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  List,
  AlertCircle,
  X
} from 'lucide-react';

const PDF_VERSION = '3.11.174';

export default function PremiumReader({ url, title, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 新增状态：目录和显示控制
  const [outline, setOutline] = useState([]);
  const [showToc, setShowToc] = useState(false);

  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfRef = useRef(null);

  // 进度保存的 Key
  const progressKey = `pdf_progress_${url}`;

  /* ===============================
     1. 初始化：加载脚本并获取历史进度
  =============================== */
  useEffect(() => {
    // 优先读取本地进度
    const savedPage = localStorage.getItem(progressKey);
    if (savedPage) {
      setPageNumber(parseInt(savedPage, 10));
    }

    if (window.pdfjsLib) {
      loadPDF();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`;
    script.onload = () => loadPDF();
    script.onerror = () => {
      setError('PDF 组件加载失败');
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [url]);

  /* ===============================
     2. 加载 PDF 实例及提取目录
  =============================== */
  const loadPDF = async () => {
    setLoading(true);
    setError(null);

    try {
      const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`;

      const loadingTask = pdfjsLib.getDocument({
        url,
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/cmaps/`,
        cMapPacked: true,
        disableStream: true,
        disableAutoFetch: true,
      });

      const pdfDoc = await loadingTask.promise;
      pdfRef.current = pdfDoc;
      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);

      // --- 🔴 提取目录逻辑 ---
      try {
        const pdfOutline = await pdfDoc.getOutline();
        setOutline(pdfOutline || []);
      } catch (e) {
        console.log("此 PDF 无目录");
      }

      // 获取当前要渲染的页码（可能是初始 1，也可能是读取到的进度）
      const savedPage = localStorage.getItem(progressKey);
      const startPage = savedPage ? parseInt(savedPage, 10) : 1;
      
      await renderPage(startPage, pdfDoc, scale);
    } catch (err) {
      console.error('PDF Load Error:', err);
      setError('无法读取文件');
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     3. 渲染页面
  =============================== */
  const renderPage = async (num, pdfDoc = pdfRef.current, currentScale = scale) => {
    if (!pdfDoc || !canvasRef.current) return;

    setLoading(true);
    if (renderTaskRef.current) renderTaskRef.current.cancel();

    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      
      // 渲染成功后保存进度
      localStorage.setItem(progressKey, num.toString());
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     4. 交互：翻页、缩放、目录跳转
  =============================== */
  const changePage = async (offset) => {
    const newPage = Math.min(Math.max(pageNumber + offset, 1), numPages);
    if (newPage === pageNumber) return;
    setPageNumber(newPage);
    await renderPage(newPage);
  };

  const changeScale = async (delta) => {
    const newScale = Math.min(Math.max(scale + delta, 0.5), 3.0);
    setScale(newScale);
    await renderPage(pageNumber, pdfRef.current, newScale);
  };

  // --- 🔴 目录跳转核心逻辑 ---
  const jumpToOutline = async (item) => {
    if (!item.dest) return;
    try {
      const pdfDoc = pdfRef.current;
      // dest 可能是一个字符串引用或者一个数组
      let dest = item.dest;
      if (typeof dest === 'string') {
        dest = await pdfDoc.getDestination(dest);
      }
      const pageIndex = await pdfDoc.getPageIndex(dest[0]);
      const targetPage = pageIndex + 1;
      
      setPageNumber(targetPage);
      setShowToc(false);
      await renderPage(targetPage);
    } catch (err) {
      console.error("跳转失败", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col text-slate-800 overflow-hidden"
    >
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 z-20 shrink-0">
        <button onClick={onClose} className="p-2 -ml-2"><ChevronLeft size={24} /></button>
        <div className="text-center max-w-[160px]">
          <div className="text-xs font-bold truncate">{title}</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {pageNumber} / {numPages}
          </div>
        </div>
        <button onClick={() => setShowToc(true)} className="p-2"><List size={20} /></button>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-4 relative custom-scrollbar">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 z-10">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center gap-2"><AlertCircle className="text-red-400"/><p className="text-sm">{error}</p></div>
        ) : (
          <canvas ref={canvasRef} className="bg-white shadow-lg h-fit" />
        )}
      </div>

      {/* Footer */}
      <footer className="h-24 bg-white border-t flex flex-col items-center justify-center gap-2 shrink-0 pb-safe">
        {/* 简易进度条 */}
        <div className="w-full px-8 flex items-center gap-2">
            <input 
                type="range" min="1" max={numPages || 1} value={pageNumber} 
                onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPageNumber(val);
                    renderPage(val);
                }}
                className="w-full h-1 bg-slate-100 accent-blue-600 appearance-none rounded-lg"
            />
        </div>
        
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={() => changeScale(-0.2)}><ZoomOut size={18}/></button>
            <span className="text-[10px] font-bold text-slate-600">{Math.round(scale * 100)}%</span>
            <button onClick={() => changeScale(0.2)}><ZoomIn size={18}/></button>
          </div>

          <div className="flex items-center gap-8">
            <button disabled={pageNumber <= 1} onClick={() => changePage(-1)} className="disabled:opacity-20"><ChevronLeft size={28}/></button>
            <span className="text-xs font-black">PAGE {pageNumber}</span>
            <button disabled={pageNumber >= numPages} onClick={() => changePage(1)} className="disabled:opacity-20"><ChevronRight size={28}/></button>
          </div>
        </div>
      </footer>

      {/* 🔴 侧边目录抽屉 (TOC Drawer) */}
      <AnimatePresence>
        {showToc && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowToc(false)}
              className="fixed inset-0 bg-black/40 z-[210] backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-[220] flex flex-col"
            >
              <div className="p-4 border-b flex justify-between items-center">
                <span className="font-bold text-sm uppercase tracking-widest text-slate-400">Contents</span>
                <button onClick={() => setShowToc(false)} className="p-1"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {outline.length > 0 ? (
                  outline.map((item, i) => (
                    <div 
                      key={i} 
                      onClick={() => jumpToOutline(item)}
                      className="py-2 px-3 hover:bg-slate-50 rounded cursor-pointer text-sm border-b border-slate-50 text-slate-600 active:text-blue-600 transition-colors"
                    >
                      {item.title}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-300 mt-10 text-xs">No Catalog Found</div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
                  }
