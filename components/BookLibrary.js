'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, PlayCircle, Clock, BookOpen, Search } from 'lucide-react';
import dynamic from 'next/dynamic';

const PremiumReader = dynamic(() => import('./PremiumReader'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white">
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )
});

const BOOKS_DATA = [
  {
    id: 'b1',
    title: '汉语语法基础',
    subTitle: 'တရုတ်သဒ္ဒါအခြေခံ',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    pdfUrl: 'https://pdf.886.best/pdf/chinese-vocab-audio/ffice.pdf'
  },
  {
    id: 'b2',
    title: '实用口语 300 句',
    subTitle: 'လက်တွေ့သုံး စကားပြော',
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
    pdfUrl:
      'https://reader.zlib.fi/read/aed200cc9e27adfe2b703fc2e36f68304c4ded6662ecb42159503f1b4eede2f1/3635834/3fc1a9/hsk-2-standard-course.html?client_key=1fFLi67gBrNRP1j1iPy1&extension=pdf&signature=1c516e2bb836fd87086b18384c0ff1b1a2bd12aec42363620bc0334226c38455'
  },
  {
    id: 'b3',
    title: 'HSK 1级 标准教程',
    subTitle: 'HSK 1 စံသင်ရိုး',
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80',
    pdfUrl: 'https://audio.886.best/chinese-vocab-audio/hsk1.pdf'
  },
  {
    id: 'b4',
    title: '中国文化常识',
    subTitle: 'တရုတ်ယဉ်ကျေးမှု',
    cover: 'https://images.unsplash.com/photo-1519682577862-22b62b233c1c?w=400&q=80',
    pdfUrl: ''
  },
  {
    id: 'b5',
    title: '测试书籍',
    subTitle: 'မြန်မာစာ',
    cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80',
    pdfUrl: ''
  }
];

const HISTORY_KEY = 'hsk-reader-meta';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toProgress = (page = 0, total = 100) => clamp(Math.round((page / Math.max(total, 1)) * 100), 0, 100);

/* =================================================================
   组件：Cinema-Grade 3D Book
================================================================= */
const ThreeDBook = ({ cover, title, onClick, disabled }) => {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`group relative perspective-1000 w-full aspect-[3/4.2] mx-auto z-10 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <div className="absolute -bottom-5 left-4 right-4 h-4 bg-black/40 blur-xl rounded-full transition-all duration-500 ease-out group-hover:bg-black/60 group-hover:scale-125 group-hover:blur-2xl opacity-60 group-hover:opacity-80" />

      <div className="relative w-full h-full transition-all duration-500 ease-out transform-style-3d group-hover:-translate-y-4 group-hover:rotate-y-[-6deg] group-hover:rotate-x-[4deg] group-hover:scale-[1.03]">
        <div className="absolute inset-0 rounded-r-md rounded-l-[2px] overflow-hidden z-20 bg-white shadow-[1px_0_4px_rgba(0,0,0,0.1)]">
          <img src={cover} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none mix-blend-overlay" />
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/20 to-transparent pointer-events-none mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
          {disabled && (
            <div className="absolute inset-0 bg-slate-900/35 flex items-end justify-center pb-2">
              <span className="text-[10px] text-white/90 font-bold tracking-wide bg-black/40 px-2 py-0.5 rounded">
                即将上线
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-[3px] bottom-[3px] right-[-8px] w-[10px] bg-[#f8fafc] border-l border-gray-200 z-10 transform translate-z-[-2px] rounded-r-sm flex flex-col justify-between py-1 shadow-inner">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-px bg-slate-300/40 mx-0.5" />
          ))}
        </div>

        <div className="absolute top-[2px] bottom-[2px] left-0 w-[4px] bg-gradient-to-r from-gray-300 via-white to-gray-300 z-10 transform translate-x-[-2px] translate-z-[-1px] rotate-y-[-90deg] rounded-l-sm" />
        <div className="absolute top-[2px] bottom-[2px] left-[2px] right-[-6px] bg-white -z-10 rounded-sm translate-z-[-4px] shadow-sm" />
      </div>
    </div>
  );
};

/* =================================================================
   主组件
================================================================= */
export default function BookLibrary({ isOpen, onClose }) {
  const [selectedBook, setSelectedBook] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    const allHistory = [];
    BOOKS_DATA.forEach((book) => {
      const saved = localStorage.getItem(`${HISTORY_KEY}_${book.id}`);
      if (!saved) return;

      try {
        const parsed = JSON.parse(saved);
        allHistory.push({ ...book, ...parsed });
      } catch (_) {}
    });

    allHistory.sort(
      (a, b) => new Date(b.lastRead || 0).getTime() - new Date(a.lastRead || 0).getTime()
    );

    setHistory(allHistory);
  }, [isOpen, selectedBook]);

  const continueBook = useMemo(
    () => history.find((item) => !!item.pdfUrl),
    [history]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex justify-end"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[3px]"
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative w-full h-full bg-slate-50 shadow-2xl flex flex-col overflow-hidden sm:max-w-md ml-auto"
      >
        <div className="relative h-36 shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900">
            <img
              src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80"
              className="w-full h-full object-cover opacity-50 mix-blend-overlay scale-110"
              alt="Background"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/20 to-transparent" />
          </div>

          <div className="absolute inset-0 px-5 pt-5 pb-2 flex flex-col justify-between z-10">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="p-2 -ml-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all active:scale-95 border border-white/10"
              >
                <ChevronLeft size={24} />
              </button>
              <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all border border-white/10">
                <Search size={18} />
              </button>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2 drop-shadow-sm tracking-tight">
                Library <span className="text-yellow-500 text-2xl">✨</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium pl-0.5 opacity-80">
                Discover your next journey
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 space-y-8">
          {continueBook && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Clock size={14} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Continue Reading
                </span>
              </div>

              <div
                onClick={() => continueBook.pdfUrl && setSelectedBook(continueBook)}
                className="group relative w-full aspect-[2.6/1] overflow-hidden rounded-2xl cursor-pointer shadow-xl shadow-blue-500/5 hover:shadow-blue-500/15 active:scale-[0.98] transition-all duration-300 bg-white"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 blur-md scale-125"
                  style={{ backgroundImage: `url(${continueBook.cover})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-slate-900/40" />

                <div className="absolute inset-0 p-4 flex items-center gap-4">
                  <div className="relative h-full aspect-[3/4.2] shadow-lg rounded-sm overflow-hidden border border-white/10 group-hover:-translate-y-1 transition-transform duration-300">
                    <img src={continueBook.cover} className="w-full h-full object-cover" alt="" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center text-white h-full py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-yellow-500/20 text-yellow-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/30 backdrop-blur-md">
                        READING
                      </span>
                    </div>
                    <h3 className="font-bold text-base leading-tight truncate text-slate-100">
                      {continueBook.subTitle}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{continueBook.title}</p>

                    <div className="mt-auto">
                      <div className="flex justify-between text-[9px] text-slate-400 mb-1 font-mono">
                        <span>Progress</span>
                        <span>{toProgress(continueBook.page, continueBook.numPages)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${toProgress(continueBook.page, continueBook.numPages)}%` }}
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-300 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                    <PlayCircle size={20} className="text-white ml-0.5" />
                  </div>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center gap-2 mb-5 px-1">
              <BookOpen size={14} className="text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Collections
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8">
                {BOOKS_DATA.map((book) => {
                  const disabled = !book.pdfUrl;
                  return (
                    <div key={book.id} className="flex flex-col items-center group">
                      <ThreeDBook
                        cover={book.cover}
                        title={book.title}
                        disabled={disabled}
                        onClick={() => setSelectedBook(book)}
                      />

                      <div className="text-center mt-3 w-full px-0.5 transition-colors group-hover:text-blue-600">
                        <h3 className="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed pb-0.5 h-[2.8em] flex items-start justify-center overflow-hidden">
                          {book.subTitle}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedBook?.pdfUrl && (
          <PremiumReader
            url={selectedBook.pdfUrl}
            title={selectedBook.title}
            bookId={selectedBook.id}
            onClose={() => setSelectedBook(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
