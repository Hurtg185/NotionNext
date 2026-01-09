'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
// 引入 react-pdf 组件
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  List,
  AlertCircle
} from 'lucide-react';

// 引入样式（必须！）
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ==========================================
// 1. 配置 Worker (关键)
// ==========================================
// 使用 CDN 确保 worker 版本与 react-pdf 内部依赖版本一致
// unpkg 是 react-pdf 官方推荐的 CDN 路径结构
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PremiumReader({ url, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // 2. 配置项 (解决中文显示 + 跨域流式传输)
  // ==========================================
  const options = {
    // 🔴 核心：解决中文乱码/空白问题
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    
    // 配合 Cloudflare Worker 的优化配置
    disableStream: true, 
    disableAutoFetch: true,
    
    // 允许携带凭证(如需)
    withCredentials: false,
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError(error) {
    console.error('PDF Load Error:', error);
    setLoading(false);
    alert('无法加载文档，请检查网络或跨域设置。');
  }

  const changePage = (offset) => {
    setPageNumber(prev => Math.min(Math.max(prev + offset, 1), numPages || 1));
  };

  const changeScale = (delta) => {
    setScale(prev => Math.min(Math.max(prev + delta, 0.5), 3.0));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col text-slate-800"
    >
      {/* --- Header --- */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center max-w-[200px]">
          <div className="text-sm font-bold truncate">{title}</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {numPages ? `${pageNumber} / ${numPages}` : 'Loading...'}
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-full transition">
          <List size={20} />
        </button>
      </header>

      {/* --- Main Area --- */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-4 relative">
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 z-10 backdrop-blur-[1px]">
             <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}

        {/* 
            🔴 核心组件: Document + Page 
            React-pdf 会自动处理 Canvas 渲染和清理
        */}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          onLoadStart={() => setLoading(true)}
          loading={null} // 禁用默认 loading 文字，用上面的 Spinner
          error={ // 自定义错误显示
            <div className="flex flex-col items-center mt-20 text-slate-500">
              <AlertCircle size={40} className="text-red-400 mb-2" />
              <p>加载失败</p>
            </div>
          }
          options={options} // 传入上面定义的配置
          className="shadow-lg"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale} 
            renderTextLayer={false} // 如果不需要复制文字，设为 false 可提升性能
            renderAnnotationLayer={false} // 禁用链接层，提升性能
            className="bg-white"
            loading="" // 页面内部渲染时不显示额外文字
          />
        </Document>
      </div>

      {/* --- Footer --- */}
      <footer className="h-20 bg-white border-t flex flex-col items-center justify-center gap-2 z-20 shrink-0 pb-safe">
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
            disabled={!numPages || pageNumber >= numPages}
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
