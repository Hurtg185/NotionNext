'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut,
  List, X, AlertCircle, FileText, ScrollText
} from 'lucide-react';

const PDF_VERSION = '3.11.174';

/* =================================================================
   子组件：智能页面渲染器 (含 Canvas + Text Layer)
   🔴 升级点：增加了 renderTextLayer 逻辑
================================================================= */
const PDFPageLayer = ({ pdfDoc, pageNum, scale, onVisible, shouldRender, viewMode }) => {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null); // 文字层容器
  const containerRef = useRef(null);
  const [status, setStatus] = useState('init'); 
  const renderTaskRef = useRef(null);

  // 1. 可见性监听
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

  // 2. 渲染主逻辑
  useEffect(() => {
    if (!shouldRender) {
      // 销毁逻辑
      if (status === 'rendered') {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          canvasRef.current.width = 0;
          canvasRef.current.height = 0;
        }
        if (textLayerRef.current) textLayerRef.current.innerHTML = ''; // 清空文字层
        setStatus('init');
      }
      return;
    }

    if (shouldRender && status === 'init' && pdfDoc) {
      renderPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, pdfDoc, scale]);

  const renderPage = async () => {
    if (!containerRef.current) return;
    setStatus('loading');

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // --- A. 渲染 Canvas (画面) ---
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = '100%';
      
      // 设置容器尺寸，确保文字层对齐
      containerRef.current.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      // 文字层需要绝对尺寸
      if (textLayerRef.current) {
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;
        // 清空旧文字
        textLayerRef.current.innerHTML = '';
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch(e){}

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // --- B. 渲染 Text Layer (文字) ---
      // 只有在单页模式下，或者非快速滚动时才渲染文字层(优化性能)
      // 这里为了功能完整，默认渲染
      if (textLayerRef.current) {
        const textContent = await page.getTextContent();
        const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        
        // 使用 PDF.js 的 renderTextLayer API
        pdfjsLib.renderTextLayer({
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

  return (
    <div 
      ref={containerRef}
      id={`page-container-${pageNum}`}
      className="relative bg-white shadow-md mb-4 mx-auto transition-all"
      style={{ width: '100%', minHeight: '200px' }}
    >
      {shouldRender ? (
        <>
           {/* 加载状态 */}
           {status !== 'rendered' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-300">
              {status === 'loading' ? <Loader2 className="animate-spin" /> : <span className="text-xs">Page {pageNum}</span>}
            </div>
          )}
          
          {/* 1. 画布层 (图像) */}
          <canvas ref={canvasRef} className="block w-full h-auto" />
          
          {/* 2. 🔴 文字层 (透明可选中) - 必须绝对定位覆盖在 Canvas 上 */}
          <div ref={textLayerRef} className="textLayer absolute inset-0" />
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
   子组件：缩略图
================================================================= */
const Thumbnail = ({ pdfDoc, pageNum, onClick, active }) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loaded) renderThumb(); },
      { rootMargin: '50% 0px' } 
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  });

  const renderThumb = async () => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.15 }); 
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      setLoaded(true);
    } catch(e) {}
  };

  return (
    <div ref={containerRef} onClick={onClick} className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${active ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent hover:border-slate-200'}`}>
      <div className="bg-slate-100 aspect-[210/297] relative">
        <canvas ref={canvasRef} className="w-full h-full object-contain" />
        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">{pageNum}</div>
      </div>
    </div>
  );
};

/* =================================================================
   主组件 PremiumReader
================================================================= */
export default function PremiumReader({ url, title, onClose }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [viewMode, setViewMode] = useState('single');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('toc');
  const [outline, setOutline] = useState([]);

  // 手势相关状态
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const progressKey = `pdf_progress_${url}`;

  // 初始化
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const loadPDF = async () => {
    setLoading(true);
    try {
      const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`;
      const safeUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;

      const loadingTask = pdfjsLib.getDocument({
        url: safeUrl, 
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/cmaps/`,
        cMapPacked: true,
        disableAutoFetch: false,
        disableStream: false,    
        rangeChunkSize: 2097152, 
        useSystemFonts: true,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      doc.getOutline().then(t => setOutline(t || [])).catch(()=>{});
    } catch (err) {
      console.error(err);
      setError('加载失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    const p = Math.min(Math.max(newPage, 1), numPages);
    setPageNumber(p);
    localStorage.setItem(progressKey, p.toString());
    
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

  // --- 🔴 手势处理逻辑 ---
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    // 只有在单页模式下才启用左右滑动手势
    if (viewMode === 'single') {
      if (isLeftSwipe && pageNumber < numPages) {
        handlePageChange(pageNumber + 1);
      }
      if (isRightSwipe && pageNumber > 1) {
        handlePageChange(pageNumber - 1);
      }
    }
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
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={()=>setViewMode('single')} className={`p-1.5 rounded ${viewMode==='single'?'bg-white shadow text-blue-600':'text-slate-400'}`}><FileText size={16}/></button>
            <button onClick={()=>setViewMode('scroll')} className={`p-1.5 rounded ${viewMode==='scroll'?'bg-white shadow text-blue-600':'text-slate-400'}`}><ScrollText size={16}/></button>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2"><List size={22}/></button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div 
        className="flex-1 overflow-hidden relative flex flex-row bg-slate-200/50"
        // 🔴 绑定手势事件到主容器
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={32}/></div>}
        {error && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-red-500 gap-2"><AlertCircle size={40}/><span className="text-xs">{error}</span></div>}

        {/* 滚动模式 */}
        {viewMode === 'scroll' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 sm:px-8 py-4 scroll-smooth">
             <div className="max-w-3xl mx-auto pb-20">
               {pdfDoc && Array.from({ length: numPages }, (_, i) => {
                 const n = i + 1;
                 const shouldRender = Math.abs(pageNumber - n) <= 3;
                 return (
                   <PDFPageLayer 
                     key={n} 
                     pdfDoc={pdfDoc} 
                     pageNum={n} 
                     scale={scale} 
                     onVisible={setPageNumber}
                     shouldRender={shouldRender} 
                     viewMode={viewMode}
                   />
                 );
               })}
             </div>
          </div>
        )}

        {/* 单页模式 */}
        {viewMode === 'single' && (
           <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {pdfDoc && (
                // 添加动画 Key，让翻页有淡入淡出效果
                <motion.div
                  key={pageNumber}
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full flex justify-center"
                >
                    <PDFPageLayer 
                        key={`single-${pageNumber}`} 
                        pdfDoc={pdfDoc} 
                        pageNum={pageNumber} 
                        scale={scale} 
                        shouldRender={true}
                        viewMode={viewMode}
                    />
                </motion.div>
              )}
           </div>
        )}

        {/* 底部悬浮条 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-2xl rounded-full px-5 py-2 flex items-center gap-4 z-20 border border-white/50">
          <button onClick={() => setScale(s => Math.max(0.5, s-0.2))}><ZoomOut size={18} className="text-slate-500"/></button>
          <span className="text-xs font-black min-w-[30px] text-center">{Math.round(scale*100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s+0.2))}><ZoomIn size={18} className="text-slate-500"/></button>
          <div className="w-px h-4 bg-slate-300 mx-1"/>
          
          <button disabled={pageNumber <= 1} onClick={() => handlePageChange(pageNumber - 1)} className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 active:scale-90 transition">
            <ChevronLeft size={24} className="text-slate-700" />
          </button>
          <div className="text-xs font-bold text-slate-800 whitespace-nowrap min-w-[50px] text-center">{pageNumber} <span className="text-slate-400 font-normal">/ {numPages}</span></div>
          <button disabled={pageNumber >= numPages} onClick={() => handlePageChange(pageNumber + 1)} className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 active:scale-90 transition">
            <ChevronRight size={24} className="text-slate-700" />
          </button>
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
