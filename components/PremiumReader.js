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
  X
} from 'lucide-react';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/* ===============================
   pdf.js worker（稳定版本）
================================ */
pdfjs.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function PremiumReader({ url, title, onClose }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [outline, setOutline] = useState([]);
  const [showToc, setShowToc] = useState(false);

  const progressKey = `pdf-progress:${url}`;

  /* ===============================
     读取历史进度
  ================================ */
  useEffect(() => {
    const saved = localStorage.getItem(progressKey);
    if (saved) {
      const page = parseInt(saved, 10);
      if (!isNaN(page)) setPageNumber(page);
    }
  }, [url]);

  /* ===============================
     保存进度
  ================================ */
  useEffect(() => {
    if (numPages) {
      localStorage.setItem(progressKey, pageNumber.toString());
    }
  }, [pageNumber, numPages]);

  /* ===============================
     PDF 加载成功
  ================================ */
  const onLoadSuccess = async (pdf) => {
    setNumPages(pdf.numPages);
    const toc = await pdf.getOutline();
    setOutline(toc || []);
  };

  /* ===============================
     跳转目录
  ================================ */
  const jumpTo = async (item) => {
    if (!item.dest) return;
    const pageIndex = await item.dest[0].num;
    setPageNumber(pageIndex + 1);
    setShowToc(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-100 flex flex-col"
    >
      {/* ================= Header ================= */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4">
        <button onClick={onClose}>
          <ChevronLeft size={24} />
        </button>
        <div className="text-center max-w-[200px] truncate text-sm font-bold">
          {title}
        </div>
        <button onClick={() => setShowToc(true)}>
          <List size={20} />
        </button>
      </header>

      {/* ================= Content ================= */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-slate-200">
        <Document
          file={url}
          onLoadSuccess={onLoadSuccess}
          options={{ disableStream: true, disableAutoFetch: true }}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
            className="bg-white shadow-xl"
          />
        </Document>
      </div>

      {/* ================= Footer ================= */}
      <footer className="h-24 bg-white border-t px-4 py-2 flex flex-col gap-2">
        {/* 进度条 */}
        <input
          type="range"
          min={1}
          max={numPages}
          value={pageNumber}
          onChange={(e) => setPageNumber(Number(e.target.value))}
          className="w-full"
        />

        <div className="flex items-center justify-between">
          {/* 缩放 */}
          <div className="flex items-center gap-3">
            <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))}>
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-mono">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.2))}>
              <ZoomIn size={18} />
            </button>
          </div>

          {/* 翻页 */}
          <div className="flex items-center gap-4">
            <button
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(p => p - 1)}
            >
              <ChevronLeft size={28} />
            </button>
            <span className="text-xs font-bold">
              {pageNumber} / {numPages}
            </span>
            <button
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber(p => p + 1)}
            >
              <ChevronRight size={28} />
            </button>
          </div>
        </div>
      </footer>

      {/* ================= TOC ================= */}
      <AnimatePresence>
        {showToc && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-[300]"
          >
            <div className="h-14 border-b flex items-center justify-between px-4">
              <span className="font-bold text-sm">目录</span>
              <button onClick={() => setShowToc(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="overflow-auto h-full p-4 space-y-2 text-sm">
              {outline.length === 0 && (
                <div className="text-slate-400">无目录</div>
              )}
              {outline.map((item, i) => (
                <div
                  key={i}
                  className="cursor-pointer hover:text-blue-600"
                  onClick={() => jumpTo(item)}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
