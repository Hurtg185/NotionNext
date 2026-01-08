'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, List } from 'lucide-react';

export default function PremiumReader({ url, title, onClose }) {
  const [isClient, setIsClient] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // 1. 初始化并加载脚本
  useEffect(() => {
    setIsClient(true);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => loadPDF();
    document.head.appendChild(script);
    return () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, []);

  // 2. 加载 PDF 文件
  const loadPDF = async () => {
    try {
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      // 使用你的 Worker 链接加载
      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);
      renderPage(1, pdfDoc, scale);
    } catch (err) {
      console.error('PDF加载失败:', err);
      alert('读取失败，请确保使用的是 Worker 链接并已开启跨域');
    }
  };

  // 3. 渲染页面到 Canvas
  const renderPage = async (num, pdfDoc = pdf, currentScale = scale) => {
    if (!pdfDoc || !canvasRef.current) return;
    setLoading(true);

    // 如果有正在进行的渲染任务，先取消它
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: currentScale });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // 适配手机像素比，防止模糊
    const dpr = window.devicePixelRatio || 1;
    canvas.height = viewport.height * dpr;
    canvas.width = viewport.width * dpr;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    context.scale(dpr, dpr);

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);
    renderTaskRef.current = renderTask;
    
    try {
      await renderTask.promise;
      setLoading(false);
    } catch (e) {
      console.log('渲染任务取消');
    }
  };

  // 翻页逻辑
  const changePage = (offset) => {
    const newPage = pageNumber + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      renderPage(newPage);
    }
  };

  // 缩放逻辑
  const changeScale = (delta) => {
    const newScale = Math.min(Math.max(scale + delta, 0.5), 3);
    setScale(newScale);
    renderPage(pageNumber, pdf, newScale);
  };

  if (!isClient) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans text-slate-800"
    >
      {/* 顶部工具栏 */}
      <header className="h-14 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-500"><ChevronLeft size={24} /></button>
        <div className="max-w-[150px] text-center">
          <h1 className="text-sm font-bold truncate">{title}</h1>
          <p className="text-[10px] text-slate-400">{pageNumber} / {numPages}</p>
        </div>
        <button className="p-2 text-slate-500"><List size={20} /></button>
      </header>

      {/* 渲染区域 */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center items-start p-2 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-200/50">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        )}
        {/* PDF 画面就在这里画出来 */}
        <canvas ref={canvasRef} className="shadow-lg bg-white max-w-full" />
      </div>

      {/* 底部控制台 */}
      <footer className="h-20 bg-white border-t border-slate-100 flex flex-col items-center justify-center px-6 shrink-0 gap-2">
        <div className="flex items-center gap-6">
           <button onClick={() => changeScale(-0.2)} className="p-2 bg-slate-50 rounded-full"><ZoomOut size={18}/></button>
           <span className="text-[10px] font-bold text-slate-400">{Math.round(scale*100)}%</span>
           <button onClick={() => changeScale(0.2)} className="p-2 bg-slate-50 rounded-full"><ZoomIn size={18}/></button>
        </div>
        <div className="flex items-center gap-12">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="text-slate-700 disabled:opacity-20"
          >
            <ChevronLeft size={32} />
          </button>
          <span className="text-xs font-black">PAGE {pageNumber}</span>
          <button 
            disabled={pageNumber >= numPages}
            onClick={() => changePage(1)}
            className="text-slate-700 disabled:opacity-20"
          >
            <ChevronRight size={32} />
          </button>
        </div>
      </footer>
    </motion.div>
  );
}
