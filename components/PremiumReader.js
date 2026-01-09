'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  List,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

// 引入 react-pdf 必需样式
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ==========================================
// 1. 配置 Worker (必须与安装版本 3.11.174 匹配)
// ==========================================
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function PremiumReader({ url, title, onClose }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [outline, setOutline] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [pdfInstance, setPdfInstance] = useState(null);
  const [loading, setLoading] = useState(true);

  const progressKey = `pdf-progress:${url}`;

  // ==========================================
  // 2. 核心：PDF 加载配置 (解决 206 报错与中文显示)
  // ==========================================
  const options = {
    // 🔴 解决中文显示为空白
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    
    // 🔴 关键修复：强制禁用分段请求
    // 解决 Service Worker 报 "Partial response (status code 206) is unsupported" 的问题
    disableRange: true, 
    disableStream: true,
    disableAutoFetch: true,
  };

  // 给 URL 增加时间戳，防止 Service Worker 强行拦截缓存
  const finalUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();

  // 3. 读取历史进度
  useEffect(() => {
    const saved = localStorage.getItem(progressKey);
    if (saved) {
      const page = parseInt(saved, 10);
      if (!isNaN(page)) setPageNumber(page);
    }
  }, [url]);

  // 4. 保存进度
  useEffect(() => {
    if (numPages > 0) {
      localStorage.setItem(progressKey, pageNumber.toString());
    }
  }, [pageNumber, numPages]);

  // 5. 加载成功回调
  const onLoadSuccess = async (pdf) => {
    setPdfInstance(pdf);
    setNumPages(pdf.numPages);
    try {
      const toc = await pdf.getOutline();
      setOutline(toc || []);
    } catch (e) {
      console.log("此 PDF 无目录结构");
    }
    setLoading(false);
  };

  // 6. 目录跳转逻辑 (修复版)
  const jumpTo = async (item) => {
    if (!item.dest || !pdfInstance) return;
    try {
      let dest = item.dest;
      if (typeof dest === 'string') {
        dest = await pdfInstance.getDestination(dest);
      }
      const pageIndex = await pdfInstance.getPageIndex(dest[0]);
      setPageNumber(pageIndex + 1);
      setShowToc(false);
    } catch (err) {
      console.error("跳转失败:", err);
    }
  };

  // 递归渲染目录
  const renderOutlineItems = (items) => {
    return items.map((item, i) => (
      <div key={i} className="space-y-1">
        <div
          className="py-2.5 px-3 hover:bg-blue-50 rounded-lg cursor-pointer text-slate-700 text-sm transition-colors border-b border-slate-50"
          onClick={() => jumpTo(item)}
        >
          {item.title}
        </div>
        {item.items && item.items.length > 0 && (
          <div className="pl-4 border-l-2 border-slate-100 ml-2">
            {renderOutlineItems(item.items)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col overflow-hidden"
    >
      {/* ================= Header ================= */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 z-10 shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-600 active:scale-90 transition">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center max-w-[180px] truncate text-xs font-bold text-slate-800">
          {title}
        </div>
        <button onClick={() => setShowToc(true)} className="p-2 text-slate-600 active:scale-90 transition">
          <List size={22} />
        </button>
      </header>

      {/* ================= PDF 内容区 ================= */}
      <div className="flex-1 overflow-auto flex justify-center bg-slate-800 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 z-10 gap-3">
            <Loader2 className="animate-spin text-blue-400" size={32} />
            <span className="text-slate-400 text-xs tracking-widest uppercase">Initializing Reader</span>
          </div>
        )}
        
        <Document
          file={finalUrl}
          onLoadSuccess={onLoadSuccess}
          onLoadStart={() => setLoading(true)}
          loading=""
          options={options}
          className="my-4 shadow-2xl"
          error={
            <div className="flex flex-col items-center mt-20 text-slate-400 gap-4 p-6 text-center">
              <AlertCircle size={48} className="text-red-500/50" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">无法读取 PDF 文件</p>
                <p className="text-xs opacity-60">可能是跨域配置或网络问题</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full text-xs font-bold"
              >
                刷新重试
              </button>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
            className="bg-white"
            loading=""
          />
        </Document>
      </div>

      {/* ================= Footer 控制 ================= */}
      <footer className="bg-white border-t px-4 pt-3 pb-8 flex flex-col gap-4 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        {/* 进度条 */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={numPages || 1}
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
            className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="flex items-center justify-between px-1">
          {/* 缩放 */}
          <div className="flex items-center bg-slate-50 rounded-full px-3 py-1 gap-4 border border-slate-100">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="text-slate-400 hover:text-blue-600">
              <ZoomOut size={18} />
            </button>
            <span className="text-[10px] font-black text-slate-700 w-8 text-center font-mono">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} className="text-slate-400 hover:text-blue-600">
              <ZoomIn size={18} />
            </button>
          </div>

          {/* 翻页按钮 */}
          <div className="flex items-center gap-6">
            <button
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(p => p - 1)}
              className="text-slate-800 disabled:opacity-10 active:scale-75 transition"
            >
              <ChevronLeft size={32} strokeWidth={2.5} />
            </button>
            <div className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-bold font-mono min-w-[50px] text-center">
              {pageNumber} / {numPages}
            </div>
            <button
              disabled={!numPages || pageNumber >= numPages}
              onClick={() => setPageNumber(p => p + 1)}
              className="text-slate-800 disabled:opacity-10 active:scale-75 transition"
            >
              <ChevronRight size={32} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </footer>

      {/* ================= 目录抽屉 (TOC) ================= */}
      <AnimatePresence>
        {showToc && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowToc(false)}
              className="fixed inset-0 bg-black/60 z-[290] backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-white shadow-2xl z-[300] flex flex-col"
            >
              <div className="h-14 border-b flex items-center justify-between px-5 shrink-0 bg-slate-50">
                <span className="font-black text-slate-800 text-xs uppercase tracking-widest">Outline</span>
                <button onClick={() => setShowToc(false)} className="p-2 text-slate-400 bg-white rounded-full border shadow-sm">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {outline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                    <List size={40} strokeWidth={1} />
                    <span className="text-[10px] uppercase font-bold">No Catalog Available</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {renderOutlineItems(outline)}
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
