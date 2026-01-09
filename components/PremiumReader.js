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

// 引入样式
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ==========================================
// 🔴 关键修复 1: 手动补全 URL.parse 方法
// 解决 "TypeError: URL.parse is not a function" 报错
// ==========================================
if (typeof window !== 'undefined' && !URL.parse) {
  URL.parse = (string) => {
    try {
      return new URL(string);
    } catch (err) {
      return null;
    }
  };
}

// ==========================================
// 🔴 关键修复 2: 手动补全 Promise.withResolvers
// 新版 pdf.js 也可能依赖这个方法
// ==========================================
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// ==========================================
// 3. 配置 Worker
// ==========================================
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PremiumReader({ url, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);

  // 配置项
  const options = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    disableStream: true,
    disableAutoFetch: true,
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError(error) {
    console.error('PDF Load Error:', error);
    setLoading(false);
    // 这里不再弹窗 alert，避免无限弹窗，只在界面显示错误
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
      {/* Header */}
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-4 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 z-10 backdrop-blur-[1px]">
             <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          onLoadStart={() => setLoading(true)}
          loading={null}
          options={options}
          className="shadow-lg"
          // 🔴 修复 Hydration Error: 确保加载时有占位符
          noData={<div className="text-slate-400 mt-10">正在初始化 PDF...</div>}
          error={
            <div className="flex flex-col items-center mt-20 text-slate-500">
              <AlertCircle size={40} className="text-red-400 mb-2" />
              <p>加载失败</p>
              <p className="text-xs mt-2 text-slate-400">请检查网络或刷新页面</p>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale} 
            renderTextLayer={false} 
            renderAnnotationLayer={false} 
            className="bg-white"
            loading=""
            // 🔴 修复高清屏模糊问题
            devicePixelRatio={Math.min(window.devicePixelRatio, 2)}
          />
        </Document>
      </div>

      {/* Footer */}
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
