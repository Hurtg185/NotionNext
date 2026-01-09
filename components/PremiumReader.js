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
} from 'lucide-react';

export default function PremiumReader({ url, title, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfRef = useRef(null); // 防止重复加载

  /* ===============================
     1. 加载 pdf.js（只加载一次）
  =============================== */
  useEffect(() => {
    if (window.pdfjsLib) {
      loadPDF();
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      loadPDF();
    };
    document.head.appendChild(script);

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /* ===============================
     2. 加载 PDF（关键配置）
  =============================== */
  const loadPDF = async () => {
    try {
      const pdfjsLib =
        window.pdfjsLib || window['pdfjs-dist/build/pdf'];

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      // 🔴 关键：必须禁用 streaming / autofetch
      const loadingTask = pdfjsLib.getDocument({
        url,
        withCredentials: false,

        disableStream: true,
        disableAutoFetch: true,
        rangeChunkSize: 65536,
      });

      const pdfDoc = await loadingTask.promise;
      pdfRef.current = pdfDoc;

      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);
      setPageNumber(1);

      await renderPage(1, pdfDoc, scale);
    } catch (err) {
      console.error('PDF 加载失败:', err);
      alert('读取失败，请确认使用的是 Worker 地址并已开启跨域');
    }
  };

  /* ===============================
     3. 渲染页面
  =============================== */
  const renderPage = async (
    num,
    pdfDoc = pdfRef.current,
    currentScale = scale
  ) => {
    if (!pdfDoc || !canvasRef.current) return;

    setLoading(true);

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: currentScale });

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });

    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } catch (_) {
      // ignore cancelled render
    }

    setLoading(false);
  };

  /* ===============================
     4. 翻页 / 缩放
  =============================== */
  const changePage = async (offset) => {
    const newPage = pageNumber + offset;
    if (newPage < 1 || newPage > numPages) return;

    setPageNumber(newPage);
    await renderPage(newPage);
  };

  const changeScale = async (delta) => {
    const newScale = Math.min(Math.max(scale + delta, 0.5), 3);
    setScale(newScale);
    await renderPage(pageNumber, pdfRef.current, newScale);
  };

  /* ===============================
     UI
  =============================== */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col text-slate-800"
    >
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4">
        <button onClick={onClose} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center max-w-[160px]">
          <div className="text-sm font-bold truncate">{title}</div>
          <div className="text-[10px] text-slate-400">
            {pageNumber} / {numPages}
          </div>
        </div>
        <button className="p-2">
          <List size={20} />
        </button>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-3 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/60 z-10">
            <Loader2 className="animate-spin" size={32} />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="bg-white shadow-lg max-w-full"
        />
      </div>

      {/* Footer */}
      <footer className="h-20 bg-white border-t flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-6">
          <button onClick={() => changeScale(-0.2)}>
            <ZoomOut size={18} />
          </button>
          <span className="text-xs font-bold">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => changeScale(0.2)}>
            <ZoomIn size={18} />
          </button>
        </div>

        <div className="flex items-center gap-10">
          <button
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="disabled:opacity-30"
          >
            <ChevronLeft size={28} />
          </button>
          <span className="text-xs font-black">
            PAGE {pageNumber}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => changePage(1)}
            className="disabled:opacity-30"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </footer>
    </motion.div>
  );
        }
