'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut,
  List, X, AlertCircle, FileText, ScrollText, Grid, Check
} from 'lucide-react';

const PDF_VERSION = '3.11.174';

/* =================================================================
   子组件：智能页面渲染器 (支持内存回收)
   对于几百页的 PDF，这个组件是性能的关键。
================================================================= */
const PDFPageLayer = ({ pdfDoc, pageNum, scale, onVisible, isScrolling }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // status: 'hidden' | 'loading' | 'rendered'
  const [status, setStatus] = useState('hidden'); 
  const renderTaskRef = useRef(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        
        // 1. 进入可视区域 (包括上下预加载区域 200%)
        if (entry.isIntersecting) {
          if (status === 'hidden') {
            renderPage();
          }
          // 通知父组件更新当前页码（仅当真正出现在屏幕中心时）
          if (entry.intersectionRatio > 0.1 && onVisible) {
             onVisible(pageNum);
          }
        } 
        // 2. 滚出可视区域 (内存回收核心逻辑)
        else {
          // 如果已经渲染过，且滚远了，为了省内存，我们销毁它
          if (status === 'rendered') {
            // 清空 Canvas 释放显存
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              canvasRef.current.width = 0; 
              canvasRef.current.height = 0;
            }
            setStatus('hidden'); // 重置状态，下次回来重新画
          }
        }
      },
      {
        root: null,
        // 🚀 关键优化：上下各预留 2 个屏幕的高度进行预加载
        // 既保证滑动的流畅，又保证太远的页面能及时销毁
        rootMargin: '200% 0px', 
        threshold: 0.01 
      }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, scale, pageNum, status]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    
    // 防止重复渲染
    if (renderTaskRef.current) renderTaskRef.current.cancel();

    setStatus('loading');

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      
      // 保持高清且大小正确
      canvas.style.width = '100%'; 
      // 自动计算高度比例，防止布局抖动
      containerRef.current.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      setStatus('rendered');
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error(`Page ${pageNum} render error`, err);
        setStatus('hidden');
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      id={`page-container-${pageNum}`}
      className="relative bg-white shadow-md mb-4 mx-auto transition-all"
      style={{ width: '100%', minHeight: '200px' }} // 最小高度占位，防止滚动条跳动
    >
      {status !== 'rendered' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-300">
          {status === 'loading' ? <Loader2 className="animate-spin" /> : <span className="text-xs">{pageNum}</span>}
        </div>
      )}
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
};

/* =================================================================
   子组件：缩略图 (保持简单，低清渲染)
================================================================= */
const Thumbnail = ({ pdfDoc, pageNum, onClick, active }) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loaded) {
          renderThumb();
        }
      },
      { rootMargin: '100% 0px' } // 缩略图也做懒加载，否则侧边栏会卡顿
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  });

  const renderThumb = async () => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.15 }); // 极低分辨率缩略图
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      setLoaded(true);
    } catch(e) {}
  };

  return (
    <div 
      ref={containerRef}
      onClick={onClick}
      className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${active ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent hover:border-slate-200'}`}
    >
      <div className="bg-slate-100 aspect-[210/297] relative">
        <canvas ref={canvasRef} className="w-full h-full object-contain" />
        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">
          {pageNum}
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   主组件
================================================================= */
export default function PremiumReader({ url, title, onClose }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [viewMode, setViewMode] = useState('scroll'); // 默认大文件使用滚动模式体验更好
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('toc');
  const [outline, setOutline] = useState([]);

  const progressKey = `pdf_progress_${url}`;

  // 1. 初始化
  useEffect(() => {
    // 读取本地进度
    const saved = localStorage.getItem(progressKey);
    if (saved) setPageNumber(parseInt(saved));

    const init = async () => {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`;
        script.onload = loadPDF;
        script.onerror = () => { setError('组件加载失败'); setLoading(false); };
        document.head.appendChild(script);
      } else {
        loadPDF();
      }
    };
    init();
  }, [url]);

  // 2. 加载 PDF (Fetch 模式)
  const loadPDF = async () => {
    setLoading(true);
    try {
      const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`;

      // 🔴 手动 Fetch 避免 Service Worker 206 错误
      const res = await fetch(url);
      if (!res.ok) throw new Error("下载失败");
      const buffer = await res.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/cmaps/`,
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      
      doc.getOutline().then(t => setOutline(t || [])).catch(()=>{});
    } catch (err) {
      console.error(err);
      setError('无法打开文件，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 3. 翻页/跳转
  const handlePageChange = (newPage) => {
    const p = Math.min(Math.max(newPage, 1), numPages);
    setPageNumber(p);
    localStorage.setItem(progressKey, p.toString());
    
    // 如果是滚动模式，自动滚到位置
    if (viewMode === 'scroll') {
      const el = document.getElementById(`page-container-${p}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const jumpToDest = async (dest) => {
    if (!pdfDoc) return;
    try {
      if (typeof dest === 'string') dest = await pdfDoc.getDestination(dest);
      const idx = await pdfDoc.getPageIndex(dest[0]);
      handlePageChange(idx + 1);
      setSidebarOpen(false);
    } catch(e){}
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#e2e8f0] flex flex-col text-slate-800 font-sans"
    >
      {/* HEADER */}
      <header className="h-14 flex items-center justify-between px-4 z-30 shrink-0 bg-white/90 backdrop-blur border-b shadow-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-600"><ChevronLeft size={24}/></button>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-xs font-bold truncate max-w-[150px]">{title}</h1>
            <span className="text-[9px] text-slate-400">{viewMode==='single'?'单页模式':'连续滚动'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           {/* 模式切换 */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={()=>setViewMode('single')} className={`p-1.5 rounded ${viewMode==='single'?'bg-white shadow text-blue-600':'text-slate-400'}`}><FileText size={16}/></button>
            <button onClick={()=>setViewMode('scroll')} className={`p-1.5 rounded ${viewMode==='scroll'?'bg-white shadow text-blue-600':'text-slate-400'}`}><ScrollText size={16}/></button>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2"><List size={22}/></button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative flex flex-row bg-slate-200/50">
        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={32}/></div>}
        {error && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-red-500"><AlertCircle size={40}/><span>{error}</span></div>}

        {/* --- 连续滚动模式 (高性能) --- */}
        {viewMode === 'scroll' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 sm:px-8 py-4 scroll-smooth">
             <div className="max-w-3xl mx-auto pb-20">
               {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                 <PDFPageLayer 
                   key={n} 
                   pdfDoc={pdfDoc} 
                   pageNum={n} 
                   scale={scale} 
                   onVisible={setPageNumber} // 滚动监听
                 />
               ))}
             </div>
          </div>
        )}

        {/* --- 单页模式 --- */}
        {viewMode === 'single' && (
           <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {pdfDoc && (
                <PDFPageLayer 
                   key={`single-${pageNumber}`} 
                   pdfDoc={pdfDoc} 
                   pageNum={pageNumber} 
                   scale={scale} 
                />
              )}
           </div>
        )}

        {/* 底部悬浮条 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-2xl rounded-full px-5 py-2 flex items-center gap-4 z-20 border border-white/50">
          <button onClick={() => setScale(s => Math.max(0.5, s-0.2))}><ZoomOut size={18} className="text-slate-500"/></button>
          <span className="text-xs font-black min-w-[30px] text-center">{Math.round(scale*100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s+0.2))}><ZoomIn size={18} className="text-slate-500"/></button>
          <div className="w-px h-4 bg-slate-300 mx-1"/>
          <div className="text-xs font-bold text-slate-800 whitespace-nowrap">{pageNumber} <span className="text-slate-400 font-normal">/ {numPages}</span></div>
        </div>
      </div>

      {/* SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSidebarOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-[150]" />
            <motion.aside initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:25,stiffness:200}} className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[200] flex flex-col">
              <div className="h-14 border-b flex items-center justify-between px-4 bg-slate-50">
                 <div className="flex bg-slate-200 rounded p-1">
                   <button onClick={()=>setSidebarTab('toc')} className={`px-3 py-1 text-[10px] font-bold rounded ${sidebarTab==='toc'?'bg-white shadow text-blue-600':'text-slate-500'}`}>目录</button>
                   <button onClick={()=>setSidebarTab('grid')} className={`px-3 py-1 text-[10px] font-bold rounded ${sidebarTab==='grid'?'bg-white shadow text-blue-600':'text-slate-500'}`}>缩略图</button>
                 </div>
                 <X onClick={()=>setSidebarOpen(false)} className="text-slate-400 cursor-pointer"/>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                {sidebarTab === 'toc' ? (
                  <div className="space-y-1">
                    {outline.length > 0 ? outline.map((item, i) => (
                      <div key={i} onClick={() => jumpToDest(item.dest)} className="py-3 px-2 hover:bg-slate-50 border-b border-slate-50 text-xs text-slate-600 cursor-pointer truncate">{item.title}</div>
                    )) : <div className="text-center mt-20 text-slate-300 text-xs">暂无目录</div>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                      <Thumbnail key={n} pdfDoc={pdfDoc} pageNum={n} active={pageNumber===n} onClick={()=>{handlePageChange(n); setSidebarOpen(false);}}/>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
