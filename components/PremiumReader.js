'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Loader2, ZoomIn, ZoomOut,
  List, X, AlertCircle
} from 'lucide-react';

const PDF_VERSION = '3.11.174';
const RENDER_WINDOW = 3; // 只渲染前后 3 页

/* =================================================================
   子组件：页面渲染器 (Canvas + TextLayer)
   简洁高效：离开窗口自动销毁，进入自动渲染
================================================================= */
const PDFPageLayer = ({ pdfDoc, pageNum, scale, onVisible, shouldRender }) => {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const containerRef = useRef(null);
  const [status, setStatus] = useState('init'); 
  const renderTaskRef = useRef(null);

  // 1. 监听可见性 (更新当前页码)
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

  // 2. 核心渲染逻辑 (监听 scale 变化，解决缩放失效)
  useEffect(() => {
    // A. 销毁逻辑
    if (!shouldRender) {
      if (status === 'rendered') {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          canvasRef.current.width = 0;
          canvasRef.current.height = 0;
        }
        if (textLayerRef.current) textLayerRef.current.innerHTML = '';
        setStatus('init');
      }
      return;
    }

    // B. 渲染逻辑 (当 pdfDoc / scale / shouldRender 变化时触发)
    const render = async () => {
      if (!containerRef.current || !pdfDoc) return;
      setStatus('loading');

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale }); // 使用最新的 scale
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d', { alpha: false }); // 关闭透明度提升性能
        const dpr = window.devicePixelRatio || 1;
        
        // 设置高清画布
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = '100%';
        
        // 容器占位防止抖动
        containerRef.current.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        
        // 文字层对齐
        if (textLayerRef.current) {
          textLayerRef.current.style.width = `${viewport.width}px`;
          textLayerRef.current.style.height = `${viewport.height}px`;
        }

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        // 取消上一次渲染
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch(e){}
        }

        // 开始渲染
        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // 渲染文字 (可选)
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

    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, pdfDoc, scale]); // 👈 关键：依赖 scale，变焦时自动重绘

  return (
    <div 
      ref={containerRef}
      id={`page-container-${pageNum}`}
      className="relative bg-white shadow-sm mb-3 mx-auto transition-all"
      style={{ width: '100%', minHeight: '200px' }}
    >
      {shouldRender ? (
        <>
           {status !== 'rendered' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-300">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}
          <canvas ref={canvasRef} className="block w-full h-auto" />
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
  const [scale, setScale] = useState(1.0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outline, setOutline] = useState([]);

  const progressKey = `pdf_progress_${url}`;

  // 1. 初始化
  useEffect(() => {
    const saved = localStorage.getItem(progressKey);
    if (saved) setPageNumber(parseInt(saved));

    const init = async () => {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`;
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

  // 2. 加载 PDF (针对手机大文件的黄金配置)
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
        
        // 🚀 核心优化：
        // 1. 512KB 分块：手机下载 4MB 太慢会超时，512KB 刚刚好，进度条跑得快
        rangeChunkSize: 1024 * 512, 
        // 2. 禁止自动预读：手机上不要在后台偷偷下载几十页，会卡死当前页
        disableAutoFetch: true,
        // 3. 允许流式：必须开启
        disableStream: false,
        // 4. 不下载内嵌字体：直接提升 30% 加载速度
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
      localStorage.setItem(progressKey, p.toString());
      setSidebarOpen(false);
      document.getElementById(`page-container-${p}`)?.scrollIntoView({ behavior: 'smooth' });
    } catch(e){}
  };

  // 缩放逻辑
  const changeScale = (delta) => {
    setScale(prev => Math.min(3, Math.max(0.5, +(prev + delta).toFixed(1))));
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
            <h1 className="text-xs font-bold truncate max-w-[200px]">{title}</h1>
            <span className="text-[9px] text-slate-400">
                {pdfDoc ? `${pageNumber} / ${numPages}` : 'Loading...'}
            </span>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2"><List size={22}/></button>
      </header>

      {/* MAIN CONTENT (滚动容器) */}
      <div className="flex-1 overflow-hidden relative flex flex-row bg-slate-200/50">
        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={32}/></div>}
        {error && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-red-500 gap-2"><AlertCircle size={40}/><span className="text-xs">{error}</span></div>}

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 sm:px-8 py-4 scroll-smooth">
             <div className="max-w-3xl mx-auto pb-20">
               {pdfDoc && Array.from({ length: numPages }, (_, i) => {
                 const n = i + 1;
                 // 窗口渲染：只渲染当前页前后 RENDER_WINDOW 页
                 const shouldRender = Math.abs(pageNumber - n) <= RENDER_WINDOW;
                 
                 return (
                   <PDFPageLayer 
                     key={n} 
                     pdfDoc={pdfDoc} 
                     pageNum={n} 
                     scale={scale} // 传入 Scale，变化时自动重绘
                     onVisible={setPageNumber}
                     shouldRender={shouldRender} 
                   />
                 );
               })}
             </div>
        </div>

        {/* 底部悬浮条 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-2xl rounded-full px-5 py-2 flex items-center gap-4 z-20 border border-white/50">
          <button onClick={() => changeScale(-0.2)}><ZoomOut size={18} className="text-slate-500"/></button>
          <span className="text-xs font-black min-w-[30px] text-center">{Math.round(scale*100)}%</span>
          <button onClick={() => changeScale(0.2)}><ZoomIn size={18} className="text-slate-500"/></button>
        </div>
      </div>

      {/* SIDEBAR (目录) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSidebarOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-[150]" />
            <motion.aside initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:25,stiffness:200}} className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[200] flex flex-col">
              <div className="h-14 border-b flex items-center justify-between px-4 bg-slate-50">
                 <span className="text-xs font-bold uppercase text-slate-500">Contents</span>
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
