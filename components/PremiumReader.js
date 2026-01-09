'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  List,
  AlertCircle
} from 'lucide-react';

// 锁定版本号，确保核心库、Worker 和 字体映射表 版本一致
const PDF_VERSION = '3.11.174';

export default function PremiumReader({ url, title, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfRef = useRef(null); // 缓存 PDF 文档实例

  /* ===============================
     1. 初始化：加载 PDF.js 脚本
  =============================== */
  useEffect(() => {
    // 如果全局对象已存在，直接加载 PDF
    if (window.pdfjsLib) {
      loadPDF();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`;
    script.onload = () => {
      loadPDF();
    };
    script.onerror = () => {
      setError('PDF 组件加载失败，请检查网络');
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      // 组件卸载时取消渲染任务
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /* ===============================
     2. 核心：加载 PDF 文件
  =============================== */
  const loadPDF = async () => {
    setLoading(true);
    setError(null);

    try {
      const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];

      // 设置 Worker 地址
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`;

      // 配置加载任务
      const loadingTask = pdfjsLib.getDocument({
        url,
        withCredentials: false, // 避免跨域携带 Cookie 问题
        
        // --- 🔴 中文支持关键配置 ---
        // 指定字体映射表路径，解决中文显示为空白的问题
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/cmaps/`,
        cMapPacked: true,
        
        // --- 🔴 稳定性配置 ---
        // 配合 CF Worker 建议禁用流式传输，一次性获取或按需分块
        disableStream: true, 
        disableAutoFetch: true,
        rangeChunkSize: 65536 * 2, 
      });

      const pdfDoc = await loadingTask.promise;
      pdfRef.current = pdfDoc;

      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);
      setPageNumber(1);

      // 渲染第一页
      await renderPage(1, pdfDoc, scale);
    } catch (err) {
      console.error('PDF Load Error:', err);
      setError('无法读取文件 (Load Failed)');
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     3. 渲染页面逻辑
  =============================== */
  const renderPage = async (
    num,
    pdfDoc = pdfRef.current,
    currentScale = scale
  ) => {
    if (!pdfDoc || !canvasRef.current) return;

    setLoading(true);

    // 如果有正在进行的渲染任务，取消它
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // 处理高清屏 (Retina Display)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      
      // CSS 样式设置实际显示大小
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      // 缩放 Context 以匹配高清屏
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') {
        console.error('Render error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     4. 交互控制
  =============================== */
  const changePage = async (offset) => {
    const newPage = pageNumber + offset;
    if (newPage < 1 || newPage > numPages) return;

    setPageNumber(newPage);
    await renderPage(newPage);
  };

  const changeScale = async (delta) => {
    const newScale = Math.min(Math.max(scale + delta, 0.5), 3.0); // 限制缩放 0.5x ~ 3.0x
    setScale(newScale);
    await renderPage(pageNumber, pdfRef.current, newScale);
  };

  /* ===============================
     UI 渲染
  =============================== */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col text-slate-800"
    >
      {/* --- Header --- */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-20">
        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center max-w-[200px]">
          <div className="text-sm font-bold truncate">{title}</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {loading ? 'Loading...' : `${pageNumber} / ${numPages}`}
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-full transition">
          <List size={20} />
        </button>
      </header>

      {/* --- Main Canvas Area --- */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-4 relative">
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 z-10 backdrop-blur-[1px]">
            <div className="bg-white p-3 rounded-full shadow-lg">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error ? (
          <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
            <AlertCircle size={40} className="text-red-400" />
            <p className="text-sm font-medium">{error}</p>
            <button 
              onClick={() => loadPDF()} 
              className="mt-2 text-xs bg-white border px-3 py-1 rounded shadow-sm hover:bg-slate-50"
            >
              重试
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="bg-white shadow-lg"
            style={{ maxWidth: '100%', display: 'block' }}
          />
        )}
      </div>

      {/* --- Footer Controls --- */}
      <footer className="h-20 bg-white border-t flex flex-col items-center justify-center gap-2 z-20 pb-safe">
        {/* Zoom Controls */}
        <div className="flex items-center gap-6 text-slate-600">
          <button onClick={() => changeScale(-0.2)} className="hover:text-blue-600 active:scale-90 transition">
            <ZoomOut size={20} />
          </button>
          <span className="text-xs font-bold font-mono w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => changeScale(0.2)} className="hover:text-blue-600 active:scale-90 transition">
            <ZoomIn size={20} />
          </button>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-8">
          <button
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="p-2 disabled:opacity-20 hover:bg-slate-100 rounded-full transition active:scale-90"
          >
            <ChevronLeft size={28} />
          </button>
          
          <span className="text-xs font-black tracking-widest text-slate-800">
            PAGE {pageNumber}
          </span>
          
          <button
            disabled={pageNumber >= numPages}
            onClick={() => changePage(1)}
            className="p-2 disabled:opacity-20 hover:bg-slate-100 rounded-full transition active:scale-90"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </footer>
    </motion.div>
  );
              }
