'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Loader2, ZoomIn, ZoomOut,
  List, X, AlertCircle, RefreshCw
} from 'lucide-react';

const PDF_VERSION = '3.11.174';
const RENDER_WINDOW = 3; // 减少到3页，降低内存压力
const MAX_CONCURRENT_RENDERS = 2; // 最大并发渲染数
const RETRY_TIMES = 3; // 重试次数
const RETRY_DELAY = 1000; // 重试延迟

/* =================================================================
   工具函数
================================================================= */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

/* =================================================================
   子组件：页面渲染器 (Canvas + TextLayer)
   只负责渲染自己那一页，离开视口自动清理内存
================================================================= */
const PDFPageLayer = React.memo(({ 
  pdfDoc, 
  pageNum, 
  scale, 
  onVisible, 
  shouldRender,
  estimatedHeight,
  estimatedWidth,
  renderQueue
}) => {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const containerRef = useRef(null);
  const [status, setStatus] = useState('init'); 
  const renderTaskRef = useRef(null);
  const pageRef = useRef(null);
  const mountedRef = useRef(true);

  // 组件卸载时标记
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 取消正在进行的渲染
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch(e){}
      }
      // 清理页面引用
      if (pageRef.current) {
        try { pageRef.current.cleanup(); } catch(e){}
        pageRef.current = null;
      }
    };
  }, []);

  // 1. 监听可见性 (更新当前页码)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // 当页面进入屏幕中心区域时更新页码
        if (entry.isIntersecting && entry.intersectionRatio > 0.2 && onVisible) {
          onVisible(pageNum);
        }
      },
      { 
        threshold: [0.2, 0.5],
        rootMargin: '-10% 0px -10% 0px' // 聚焦到屏幕中心区域
      }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  // 2. 渲染与销毁逻辑
  useEffect(() => {
    // 离开窗口 -> 销毁
    if (!shouldRender) {
      if (status === 'rendered' || status === 'loading') {
        // 取消正在进行的渲染
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch(e){}
          renderTaskRef.current = null;
        }
        // 清理 Canvas
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          canvasRef.current.width = 1;
          canvasRef.current.height = 1;
        }
        // 清理文字层
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = '';
        }
        // 清理页面引用释放内存
        if (pageRef.current) {
          try { pageRef.current.cleanup(); } catch(e){}
          pageRef.current = null;
        }
        setStatus('init');
      }
      return;
    }

    // 进入窗口 -> 渲染
    if (shouldRender && status === 'init' && pdfDoc) {
      // 使用渲染队列控制并发
      if (renderQueue) {
        renderQueue.add(() => renderPage());
      } else {
        renderPage();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, pdfDoc, scale]);

  const renderPage = async () => {
    if (!containerRef.current || !mountedRef.current) return;
    setStatus('loading');

    try {
      // 获取页面对象
      const page = await pdfDoc.getPage(pageNum);
      if (!mountedRef.current) {
        page.cleanup();
        return;
      }
      pageRef.current = page;

      const viewport = page.getViewport({ scale });
      
      // A. 准备 Canvas
      if (!canvasRef.current || !mountedRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { 
        alpha: false,  // 禁用透明度，提升性能
        willReadFrequently: false 
      });
      
      if (!context) return;

      // 移动端限制 DPR，避免内存爆炸
      const maxDpr = window.innerWidth < 768 ? 2 : 3;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      
      // 限制最大尺寸，避免超大 canvas
      const maxCanvasSize = 4096;
      let canvasWidth = viewport.width * dpr;
      let canvasHeight = viewport.height * dpr;
      
      if (canvasWidth > maxCanvasSize || canvasHeight > maxCanvasSize) {
        const ratio = Math.min(maxCanvasSize / canvasWidth, maxCanvasSize / canvasHeight);
        canvasWidth *= ratio;
        canvasHeight *= ratio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = '100%';
      
      // 占位容器定高，防止抖动
      containerRef.current.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      
      // 文字层定高
      if (textLayerRef.current) {
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;
      }

      const scaleRatio = canvasWidth / viewport.width;
      context.setTransform(scaleRatio, 0, 0, scaleRatio, 0, 0);

      // 取消之前的渲染任务
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch(e){}
      }

      // B. 渲染画面
      const renderTask = page.render({ 
        canvasContext: context, 
        viewport: viewport,
        // 优化渲染
        intent: 'display',
        annotationMode: 0, // 不渲染注释
      });
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;

      if (!mountedRef.current) return;

      // C. 渲染文字层 (用于复制) - 延迟执行，不阻塞主渲染
      if (textLayerRef.current && window.pdfjsLib) {
        requestIdleCallback ? requestIdleCallback(() => renderTextLayer(page, viewport)) 
                           : setTimeout(() => renderTextLayer(page, viewport), 100);
      }

      setStatus('rendered');
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name !== 'RenderingCancelledException') {
        console.warn(`Page ${pageNum} render failed:`, err.message);
        setStatus('error');
      }
    }
  };

  const renderTextLayer = async (page, viewport) => {
    if (!textLayerRef.current || !mountedRef.current) return;
    try {
      const textContent = await page.getTextContent();
      if (!mountedRef.current || !textLayerRef.current) return;
      
      textLayerRef.current.innerHTML = '';
      window.pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerRef.current,
        viewport: viewport,
        textDivs: []
      });
    } catch (e) {
      // 文字层渲染失败不影响主体
    }
  };

  // 计算占位高度
  const placeholderStyle = {
    width: '100%',
    minHeight: estimatedHeight ? `${estimatedHeight}px` : '400px',
    aspectRatio: estimatedWidth && estimatedHeight ? `${estimatedWidth} / ${estimatedHeight}` : 'auto'
  };

  return (
    <div 
      ref={containerRef}
      id={`page-container-${pageNum}`}
      className="relative bg-white shadow-sm mb-4 mx-auto transition-all overflow-hidden"
      style={placeholderStyle}
    >
      {shouldRender ? (
        <>
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-400" size={24} />
                <span className="text-[10px] text-slate-400">渲染第 {pageNum} 页</span>
              </div>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 z-10">
              <div className="flex flex-col items-center gap-2 text-red-400">
                <AlertCircle size={24} />
                <span className="text-[10px]">渲染失败</span>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="block w-full h-auto" />
          <div 
            ref={textLayerRef} 
            className="textLayer absolute top-0 left-0 overflow-hidden opacity-30"
            style={{ 
              transformOrigin: 'top left',
              transform: `scale(${1})`,
              pointerEvents: 'all'
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 text-slate-300">
          <span className="text-sm font-light">{pageNum}</span>
        </div>
      )}
    </div>
  );
});

PDFPageLayer.displayName = 'PDFPageLayer';

/* =================================================================
   渲染队列：控制并发渲染数量
================================================================= */
class RenderQueue {
  constructor(maxConcurrent = MAX_CONCURRENT_RENDERS) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    
    this.running++;
    const { task, resolve, reject } = this.queue.shift();
    
    try {
      const result = await task();
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this.running--;
      this.process();
    }
  }

  clear() {
    this.queue = [];
  }
}

/* =================================================================
   主组件：PremiumReader (滚动版)
================================================================= */
export default function PremiumReader({ url, title, onClose }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  
  const [loadingState, setLoadingState] = useState('init'); // init, loading, partial, done, error
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outline, setOutline] = useState([]);
  const [pageEstimates, setPageEstimates] = useState([]); // 预估每页尺寸

  const renderQueueRef = useRef(new RenderQueue());
  const scrollContainerRef = useRef(null);
  const progressKey = `pdf_progress_${url}`;

  // 保存阅读进度（防抖）
  const saveProgress = useCallback((page) => {
    setPageNumber(page);
    // 防抖保存
    clearTimeout(window._saveProgressTimer);
    window._saveProgressTimer = setTimeout(() => {
      localStorage.setItem(progressKey, page.toString());
    }, 500);
  }, [progressKey]);

  // 1. 初始化
  useEffect(() => {
    const saved = localStorage.getItem(progressKey);
    if (saved) {
      const savedPage = parseInt(saved);
      if (!isNaN(savedPage) && savedPage > 0) {
        setPageNumber(savedPage);
      }
    }

    initPdfJs();

    return () => {
      // 清理
      renderQueueRef.current.clear();
      if (window._saveProgressTimer) {
        clearTimeout(window._saveProgressTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 初始化 PDF.js
  const initPdfJs = async () => {
    setLoadingState('loading');
    setLoadProgress(5);

    try {
      // 加载 PDF.js 核心库
      if (!window.pdfjsLib) {
        await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`);
        setLoadProgress(15);
      }
      
      await loadPDF();
    } catch (err) {
      console.error('Init failed:', err);
      setError('PDF库加载失败，请刷新重试');
      setLoadingState('error');
    }
  };

  // 2. 加载 PDF (带重试和进度)
  const loadPDF = async (retryCount = 0) => {
    try {
      const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`;

      // 添加时间戳防止缓存问题
      const safeUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;

      setLoadProgress(20);

      const loadingTask = pdfjsLib.getDocument({
        url: safeUrl, 
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/cmaps/`,
        cMapPacked: true,
        
        // 🚀 大文件优化配置
        rangeChunkSize: 1024 * 1024 * 4, // 4MB 分块，减少请求次数
        disableAutoFetch: false,         // 允许自动获取
        disableStream: false,            // 允许流式加载
        
        // 字体优化
        useSystemFonts: true,            // 优先使用系统字体
        standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/standard_fonts/`,
        
        // 其他优化
        isEvalSupported: true,
        maxImageSize: 1024 * 1024 * 10,  // 限制图片大小 10MB
        
        // 提前设置密码（如果需要）
        // password: 'xxx',
      });

      // 监听加载进度
      loadingTask.onProgress = (data) => {
        if (data.total > 0) {
          const percent = Math.min(90, 20 + (data.loaded / data.total) * 70);
          setLoadProgress(Math.round(percent));
        }
      };

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setLoadProgress(95);

      // 预获取所有页面的尺寸（用于占位）
      await prefetchPageSizes(doc);
      
      setLoadProgress(100);
      setLoadingState('done');

      // 获取目录（不阻塞）
      doc.getOutline().then(t => setOutline(t || [])).catch(() => {});
      
      // 恢复阅读位置
      const savedPage = parseInt(localStorage.getItem(progressKey) || '1');
      if (savedPage > 1 && savedPage <= doc.numPages) {
        setTimeout(() => {
          const element = document.getElementById(`page-container-${savedPage}`);
          if (element) {
            element.scrollIntoView({ behavior: 'auto' });
          }
        }, 300);
      }

    } catch (err) {
      console.error('Load PDF failed:', err);
      
      // 重试逻辑
      if (retryCount < RETRY_TIMES) {
        console.log(`Retrying... (${retryCount + 1}/${RETRY_TIMES})`);
        setLoadProgress(10);
        await sleep(RETRY_DELAY * (retryCount + 1));
        return loadPDF(retryCount + 1);
      }
      
      setError(`加载失败: ${err.message || '网络错误'}`);
      setLoadingState('error');
    }
  };

  // 预获取页面尺寸
  const prefetchPageSizes = async (doc) => {
    const estimates = [];
    
    // 只获取前几页的尺寸作为参考
    const sampleCount = Math.min(3, doc.numPages);
    let avgWidth = 595; // 默认 A4
    let avgHeight = 842;
    
    for (let i = 1; i <= sampleCount; i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        avgWidth = viewport.width;
        avgHeight = viewport.height;
        page.cleanup();
      } catch (e) {}
    }
    
    // 用采样尺寸填充所有页面
    for (let i = 0; i < doc.numPages; i++) {
      estimates.push({ width: avgWidth, height: avgHeight });
    }
    
    setPageEstimates(estimates);
  };

  // 跳转到目录位置
  const jumpToDest = async (dest) => {
    if (!pdfDoc) return;
    try {
      let actualDest = dest;
      if (typeof dest === 'string') {
        actualDest = await pdfDoc.getDestination(dest);
      }
      if (!actualDest || !actualDest[0]) return;
      
      const idx = await pdfDoc.getPageIndex(actualDest[0]);
      const targetPage = idx + 1;
      
      setPageNumber(targetPage);
      localStorage.setItem(progressKey, targetPage.toString());
      setSidebarOpen(false);
      
      setTimeout(() => {
        const element = document.getElementById(`page-container-${targetPage}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch(e) {
      console.warn('Jump failed:', e);
    }
  };

  // 重试加载
  const handleRetry = () => {
    setError(null);
    setLoadProgress(0);
    initPdfJs();
  };

  // 缩放控制
  const handleZoomIn = () => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)));
  const handleZoomOut = () => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)));

  // 快速跳转到指定页
  const jumpToPage = (page) => {
    if (page < 1 || page > numPages) return;
    setPageNumber(page);
    localStorage.setItem(progressKey, page.toString());
    const element = document.getElementById(`page-container-${page}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-[#e2e8f0] flex flex-col text-slate-800 font-sans"
    >
      {/* HEADER */}
      <header className="h-14 flex items-center justify-between px-4 z-30 shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          <button 
            onClick={onClose} 
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
            aria-label="返回"
          >
            <ChevronLeft size={24}/>
          </button>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-[400px]">
              {title || 'PDF 文档'}
            </h1>
            <span className="text-[10px] text-slate-400">
              {loadingState === 'done' 
                ? `第 ${pageNumber} 页 / 共 ${numPages} 页` 
                : loadingState === 'loading' 
                  ? `加载中 ${loadProgress}%`
                  : '准备中...'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* 页码快速跳转 */}
          {loadingState === 'done' && numPages > 0 && (
            <div className="hidden sm:flex items-center gap-1 mr-2 text-xs">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) jumpToPage(val);
                }}
                className="w-12 px-2 py-1 text-center border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-400"
              />
              <span className="text-slate-400">/ {numPages}</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
            aria-label="目录"
          >
            <List size={22}/>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative flex flex-row bg-slate-100">
        
        {/* 加载状态 */}
        <AnimatePresence>
          {loadingState === 'loading' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="animate-spin text-blue-500" size={40}/>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-600">{loadProgress}%</span>
                  </div>
                </div>
                <div className="text-sm text-slate-500">正在加载文档...</div>
                {/* 进度条 */}
                <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${loadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-2">
                  {loadProgress < 30 ? '连接服务器...' : 
                   loadProgress < 70 ? '下载文件数据...' : 
                   loadProgress < 95 ? '解析文档结构...' : '准备完成'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 错误状态 */}
        {loadingState === 'error' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95">
            <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle size={32} className="text-red-500"/>
              </div>
              <div className="text-lg font-medium text-slate-800">加载失败</div>
              <div className="text-sm text-slate-500">{error}</div>
              <button 
                onClick={handleRetry}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors active:scale-95"
              >
                <RefreshCw size={16}/>
                重新加载
              </button>
            </div>
          </div>
        )}

        {/* PDF 页面容器 */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-6 lg:px-8 py-4 scroll-smooth"
          style={{ 
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch' 
          }}
        >
          <div className="max-w-4xl mx-auto pb-24">
            {pdfDoc && Array.from({ length: numPages }, (_, i) => {
              const n = i + 1;
              // 🚀 虚拟列表：只渲染当前页前后 WINDOW 页
              const shouldRender = Math.abs(pageNumber - n) <= RENDER_WINDOW;
              const estimate = pageEstimates[i] || { width: 595, height: 842 };
              
              return (
                <PDFPageLayer 
                  key={n} 
                  pdfDoc={pdfDoc} 
                  pageNum={n} 
                  scale={scale} 
                  onVisible={saveProgress}
                  shouldRender={shouldRender}
                  estimatedWidth={estimate.width * scale}
                  estimatedHeight={estimate.height * scale}
                  renderQueue={renderQueueRef.current}
                />
              );
            })}
          </div>
        </div>

        {/* 底部工具栏 */}
        {loadingState === 'done' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm shadow-xl rounded-full px-4 py-2 flex items-center gap-3 z-20 border border-slate-200/50"
          >
            {/* 缩放控制 */}
            <button 
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
              aria-label="缩小"
            >
              <ZoomOut size={18} className="text-slate-600"/>
            </button>
            
            <span className="text-xs font-semibold min-w-[40px] text-center text-slate-700">
              {Math.round(scale * 100)}%
            </span>
            
            <button 
              onClick={handleZoomIn}
              disabled={scale >= 3}
              className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
              aria-label="放大"
            >
              <ZoomIn size={18} className="text-slate-600"/>
            </button>

            {/* 分隔线 */}
            <div className="w-px h-5 bg-slate-200"/>

            {/* 页码显示 */}
            <div className="text-xs text-slate-500 font-medium px-1">
              {pageNumber} / {numPages}
            </div>
          </motion.div>
        )}
      </div>

      {/* SIDEBAR 目录 */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* 遮罩 */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)} 
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[150]" 
            />
            
            {/* 侧边栏 */}
            <motion.aside 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-[200] flex flex-col"
            >
              {/* 目录头部 */}
              <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50 shrink-0">
                <span className="text-sm font-semibold text-slate-700">目录</span>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-200 transition-colors"
                  aria-label="关闭目录"
                >
                  <X size={18} className="text-slate-500"/>
                </button>
              </div>
              
              {/* 目录内容 */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {outline.length > 0 ? (
                  <div className="py-2">
                    {outline.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => jumpToDest(item.dest)}
                        className="w-full text-left py-3 px-4 hover:bg-blue-50 active:bg-blue-100 border-b border-slate-50 text-sm text-slate-700 truncate transition-colors flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"/>
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <List size={40} strokeWidth={1}/>
                    <span className="text-sm mt-3">暂无目录信息</span>
                  </div>
                )}
              </div>
              
              {/* 快速跳转 */}
              {numPages > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <div className="text-xs text-slate-500 mb-2">快速跳转</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={numPages}
                      placeholder="页码"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt(e.currentTarget.value);
                          if (!isNaN(val) && val >= 1 && val <= numPages) {
                            jumpToPage(val);
                            setSidebarOpen(false);
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-slate-400">/ {numPages}</span>
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 全局样式 */}
      <style jsx global>{`
        /* 文字层样式 */
        .textLayer {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          line-height: 1.0;
          pointer-events: all;
        }
        
        .textLayer > span {
          color: transparent;
          position: absolute;
          white-space: pre;
          transform-origin: 0% 0%;
          pointer-events: all;
          user-select: text;
          -webkit-user-select: text;
        }
        
        .textLayer ::selection {
          background: rgba(0, 100, 200, 0.3);
        }
        
        /* 自定义滚动条 */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
        
        /* 隐藏数字输入框的上下箭头 */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </motion.div>
  );
}
