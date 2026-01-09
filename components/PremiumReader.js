'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Loader2, ZoomIn, ZoomOut,
  List, X, AlertCircle
} from 'lucide-react';

// 使用 CDN 上的稳定版本
const PDF_VERSION = '3.11.174';
const CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}`;

/* =================================================================
   子组件：页面渲染器 (修复了缩放和文字复制)
================================================================= */
const PDFPageLayer = ({ pdfDoc, pageNum, scale, onVisible, shouldRender }) => {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const containerRef = useRef(null);
  const [status, setStatus] = useState('init'); 
  const renderTaskRef = useRef(null);

  // 1. 监听可见性
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.1 && onVisible) {
          onVisible(pageNum);
        }
      },
      { threshold: [0.1] }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  // 2. 渲染逻辑
  useEffect(() => {
    if (!shouldRender) {
      // 销毁以释放内存
      if (status === 'rendered') {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          canvasRef.current.width = 1; canvasRef.current.height = 1;
        }
        if (textLayerRef.current) textLayerRef.current.innerHTML = '';
        setStatus('init');
      }
      return;
    }

    const render = async () => {
      if (!containerRef.current || !pdfDoc) return;
      setStatus('loading');

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        // --- A. 渲染 Canvas ---
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        const dpr = window.devicePixelRatio || 1;
        
        // 🔴 修复缩放：使用 viewport 的实际宽高，而不是 100%
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;   // 关键：显式设置像素宽
        canvas.style.height = `${viewport.height}px`; // 关键：显式设置像素高
        
        // 容器也同步大小
        containerRef.current.style.width = `${viewport.width}px`;
        containerRef.current.style.height = `${viewport.height}px`;

        // 文字层同步大小
        if (textLayerRef.current) {
          textLayerRef.current.style.width = `${viewport.width}px`;
          textLayerRef.current.style.height = `${viewport.height}px`;
        }

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch(e){}
        }

        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // --- B. 渲染文字层 (可复制) ---
        if (textLayerRef.current) {
          const textContent = await page.getTextContent();
          textLayerRef.current.innerHTML = '';
          window.pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport: viewport,
            textDivs: []
          });
        }

        setStatus('rendered');
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') setStatus('init');
      }
    };

    if (shouldRender && status === 'init') render();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, pdfDoc, scale]); // scale 变化时自动重绘

  return (
    <div 
      ref={containerRef}
      id={`page-container-${pageNum}`}
      className="relative bg-white shadow-sm mb-4 mx-auto transition-all"
      style={{ minHeight: '200px' }} // 初始占位
    >
      {shouldRender ? (
        <>
           {status !== 'rendered' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-300 z-10">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}
          <canvas ref={canvasRef} className="block" />
          <div ref={textLayerRef} className="textLayer absolute inset-0 mix-blend-multiply opacity-50" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 text-slate-200 text-[10px]">
          {pageNum}
        </div>
      )}
    </div>
  );
};

/* =================================================================
   主组件：PremiumReader
================================================================= */
export default function PremiumReader({ url, title, onClose }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0); // 默认比例
  const [isMobile, setIsMobile] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outline, setOutline] = useState([]);

  const progressKey = `pdf_progress_${url}`;

  // 1. 初始化 (自动加载 CDN 脚本)
  useEffect(() => {
    // 手机检测
    if (window.innerWidth < 768) {
      setIsMobile(true);
      setScale(window.innerWidth / 600); // 手机根据屏幕宽度自动计算初始缩放
    }

    const saved = localStorage.getItem(progressKey);
    if (saved) setPageNumber(parseInt(saved));

    const init = async () => {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = `${CDN_BASE}/pdf.min.js`;
        script.onload = loadPDF;
        script.onerror = () => { setError('核心库加载失败'); setLoading(false); };
        document.head.appendChild(script);
      } else {
        loadPDF();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 2. 加载 PDF (针对手机优化)
  const loadPDF = async () => {
    setLoading(true);
    try {
      const pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN_BASE}/pdf.worker.min.js`;

      const safeUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;

      const loadingTask = pdfjsLib.getDocument({
        url: safeUrl, 
        cMapUrl: `${CDN_BASE}/cmaps/`, // 🔴 必须：解决中文乱码
        cMapPacked: true,
        
        // 🚀 手机端核心优化
        rangeChunkSize: isMobile ? 1024 * 512 : 1024 * 1024 * 2, // 手机512KB, 电脑2MB
        disableAutoFetch: true,  // 手机禁止自动预读
        disableStream: false,
        useSystemFonts: true,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      
      doc.getOutline().then(t => setOutline(t || [])).catch(()=>{});
      
      // 恢复位置
      const savedPage = parseInt(localStorage.getItem(progressKey) || '1');
      if (savedPage > 1) {
        setTimeout(() => {
           document.getElementById(`page-container-${savedPage}`)?.scrollIntoView();
        }, 500);
      }

    } catch (err) {
      console.error(err);
      setError('加载失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const jumpToDest = async (dest) => {
    if (!pdfDoc) return;
    try {
      if (typeof dest === 'string') dest = await pdfDoc.getDestination(dest);
      const idx = await pdfDoc.getPageIndex(dest[0]);
      const p = idx + 1;
      setPageNumber(p);
      setSidebarOpen(false);
      document.getElementById(`page-container-${p}`)?.scrollIntoView({ behavior: 'smooth' });
    } catch(e){}
  };

  // 缩放控制
  const changeScale = (delta) => {
    setScale(prev => Math.min(3, Math.max(0.5, +(prev + delta).toFixed(2))));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#e2e8f0] flex flex-col text-slate-800 font-sans"
    >
      {/* 头部导航 */}
      <header className="h-14 flex items-center justify-between px-4 z-30 shrink-0 bg-white/90 backdrop-blur border-b shadow-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-600"><ChevronLeft size={24}/></button>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-xs font-bold truncate max-w-[200px]">{title}</h1>
            <span className="text-[9px] text-slate-400">
                {pdfDoc ? `${pageNumber} / ${numPages}` : 'Loading...'}
            </span>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2"><List size={22}/></button>
      </header>

      {/* 滚动阅读区 */}
      <div className="flex-1 overflow-hidden relative flex flex-row bg-slate-200/50">
        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={32}/></div>}
        {error && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-red-500 gap-2"><AlertCircle size={40}/><span className="text-xs">{error}</span></div>}

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 sm:px-8 py-4 scroll-smooth">
             {/* 
                max-w-fit: 允许内容撑开宽度，这样放大时会出现横向滚动条，而不是挤压图片
                min-h-full: 确保高度撑满
             */}
             <div className="max-w-fit min-h-full mx-auto pb-20 flex flex-col items-center">
               {pdfDoc && Array.from({ length: numPages }, (_, i) => {
                 const n = i + 1;
                 // 窗口渲染：手机渲染前后 1 页，电脑前后 3 页
                 const windowSize = isMobile ? 1 : 3;
                 const shouldRender = Math.abs(pageNumber - n) <= windowSize;
                 
                 return (
                   <PDFPageLayer 
                     key={n} 
                     pdfDoc={pdfDoc} 
                     pageNum={n} 
                     scale={scale} 
                     onVisible={setPageNumber}
                     shouldRender={shouldRender} 
                   />
                 );
               })}
             </div>
        </div>

        {/* 底部悬浮条 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-2xl rounded-full px-5 py-2 flex items-center gap-4 z-20 border border-white/50">
          <button onClick={() => changeScale(-0.2)} className="active:scale-90 transition"><ZoomOut size={18} className="text-slate-500"/></button>
          <span className="text-xs font-black min-w-[35px] text-center">{Math.round(scale*100)}%</span>
          <button onClick={() => changeScale(0.2)} className="active:scale-90 transition"><ZoomIn size={18} className="text-slate-500"/></button>
        </div>
      </div>

      {/* 目录侧边栏 */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSidebarOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-[150]" />
            <motion.aside initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:25,stiffness:200}} className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[200] flex flex-col">
              <div className="h-14 border-b flex items-center justify-between px-4 bg-slate-50">
                 <span className="text-xs font-bold uppercase text-slate-500">Table of Contents</span>
                 <X onClick={()=>setSidebarOpen(false)} className="text-slate-400 cursor-pointer"/>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                  <div className="space-y-1">
                    {outline.length > 0 ? outline.map((item, i) => (
                      <div key={i} onClick={() => jumpToDest(item.dest)} className="py-3 px-2 hover:bg-slate-50 border-b border-slate-50 text-xs text-slate-600 cursor-pointer truncate">{item.title}</div>
                    )) : <div className="text-center mt-20 text-slate-300 text-xs">暂无目录</div>}
                  </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        /* 这里的样式必须有，用于文字层对齐 */
        .textLayer {
          position: absolute; inset: 0; line-height: 1.0; pointer-events: all;
        }
        .textLayer > span {
          color: transparent; position: absolute; white-space: pre; cursor: text;
          transform-origin: 0% 0%; pointer-events: all;
        }
        ::selection { background: rgba(0, 100, 255, 0.2); }
      `}</style>
    </motion.div>
  );
}
