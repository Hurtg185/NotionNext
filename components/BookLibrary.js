import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, PlayCircle, Clock, BookOpen, Search, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';

// ==========================================
// 动态导入阅读器
// ==========================================
const PremiumReader = dynamic(() => import('./PremiumReader'), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-xs font-bold tracking-widest uppercase">Opening Book...</span>
      </div>
    </div>
  )
});

// 数据源
const BOOKS_DATA = [
  {
    id: 'b1',
    title: '汉语语法基础',
    subTitle: 'Basic Grammar',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    pdfUrl: 'https://pdf-proxy.mfeng.workers.dev/pdf/chinese-vocab-audio/ffice.pdf', 
  },
  {
    id: 'b2',
    title: '实用口语 300 句',
    subTitle: 'Conversational Chinese',
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
    pdfUrl: 'https://reader.zlib.fi/read/aed200cc9e27adfe2b703fc2e36f68304c4ded6662ecb42159503f1b4eede2f1/3635834/3fc1a9/hsk-2-standard-course.html?client_key=1fFLi67gBrNRP1j1iPy1&extension=pdf&signature=1c516e2bb836fd87086b18384c0ff1b1a2bd12aec42363620bc0334226c38455',
  },
  {
    id: 'b3',
    title: 'HSK 4级 标准教程',
    subTitle: 'Standard Course',
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80',
    pdfUrl: '', // 示例
  },
  {
    id: 'b4',
    title: '中国文化常识',
    subTitle: 'Chinese Culture',
    cover: 'https://images.unsplash.com/photo-1519682577862-22b62b233c1c?w=400&q=80',
    pdfUrl: '', // 示例
  }
];

const HISTORY_KEY = 'hsk-reader-meta';

/* =================================================================
   组件：3D 立体书封面 (CSS Magic)
   - 增加阴影模拟厚度
   - 增加左侧高光模拟书脊
   - 悬浮时轻微上浮
================================================================= */
const ThreeDBook = ({ cover, title, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative cursor-pointer perspective-800 w-full aspect-[2/3] max-w-[140px] mx-auto"
    >
      {/* 阴影层 (Shadow) */}
      <div className="absolute -bottom-3 left-2 right-2 h-4 bg-black/40 blur-md rounded-full transition-all duration-300 group-hover:bg-black/60 group-hover:scale-110 group-hover:blur-lg" />
      
      {/* 书本主体 Container */}
      <div className="relative w-full h-full transition-transform duration-300 transform-style-3d group-hover:-translate-y-3 group-hover:rotate-y-[-10deg] group-hover:rotate-x-[5deg]">
        
        {/* 1. 封面 (Cover) */}
        <div className="absolute inset-0 rounded-r-md rounded-l-sm overflow-hidden z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
          <img src={cover} alt={title} className="w-full h-full object-cover" />
          {/* 书脊高光效果 (Spine Highlight) */}
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-white/40 to-transparent pointer-events-none" />
          {/* 封面光泽 (Gloss) */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none" />
        </div>

        {/* 2. 书的厚度/侧边 (Side/Pages) - 模拟白色纸张 */}
        <div className="absolute top-[2px] bottom-[2px] right-[-6px] w-[8px] bg-[#fdfdfd] border-l border-gray-200 z-0 transform translate-z-[-1px] rounded-r-sm shadow-sm flex flex-col justify-between py-1">
           {/* 模拟纸张纹理 */}
           {Array.from({length: 8}).map((_,i) => <div key={i} className="h-px bg-gray-200/50 mx-0.5" />)}
        </div>
        
        {/* 3. 书的封底 (Back Cover - minimal visible) */}
        <div className="absolute top-[1px] bottom-[1px] left-[2px] right-[-4px] bg-gray-100 -z-10 rounded-sm" />
      </div>
    </div>
  );
};

/* =================================================================
   主组件：图书馆
================================================================= */
export default function BookLibrary({ isOpen, onClose }) {
  const [selectedBook, setSelectedBook] = useState(null);
  const [history, setHistory] = useState([]);

  // 加载历史记录
  useEffect(() => {
    const allHistory = [];
    BOOKS_DATA.forEach(book => {
      const saved = localStorage.getItem(`${HISTORY_KEY}_${book.id}`);
      if (saved) {
        allHistory.push({ ...book, ...JSON.parse(saved) });
      }
    });
    setHistory(allHistory.sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead)));
  }, [selectedBook, isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex justify-end"
    >
      {/* 1. 背景遮罩 (透明毛玻璃) */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
      />

      {/* 2. 主体内容 (从右侧滑入) */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full h-full bg-slate-50/90 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden sm:max-w-md ml-auto border-l border-white/20"
      >
        {/* --- Header --- */}
        <div className="px-6 py-5 flex items-center justify-between shrink-0 bg-white/40 border-b border-white/20 backdrop-blur-md z-10">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors text-slate-700">
            <ChevronLeft size={26}/>
          </button>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Library <Sparkles size={16} className="text-yellow-500" />
          </h2>
          <button className="p-2 rounded-full hover:bg-black/5 text-slate-600">
            <Search size={22} />
          </button>
        </div>

        {/* --- Scrollable Content --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
          
          {/* Section 1: Recently Read (悬浮卡片风格) */}
          {history.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-5 text-slate-500/80">
                <Clock size={14} strokeWidth={3} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Continue Reading</span>
              </div>
              
              <div 
                onClick={() => setSelectedBook(history[0])}
                className="group relative w-full aspect-[2.5/1] overflow-hidden rounded-3xl cursor-pointer shadow-xl shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300"
              >
                {/* 动态背景图 */}
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${history[0].cover})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-slate-900/80" />

                <div className="absolute inset-0 p-5 flex items-center gap-5 text-white">
                  {/* 小封面 */}
                  <img src={history[0].cover} className="h-full aspect-[2/3] object-cover rounded-lg shadow-lg border border-white/10" alt=""/>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                    <span className="text-[10px] font-bold text-blue-200 bg-blue-500/20 px-2 py-0.5 rounded w-fit mb-2 backdrop-blur-sm">
                      上次阅读至 P{history[0].page}
                    </span>
                    <h3 className="font-bold text-lg leading-tight truncate">{history[0].title}</h3>
                    <p className="text-xs text-white/60 mt-1 truncate">{history[0].subTitle}</p>
                    
                    {/* 进度条 */}
                    <div className="mt-auto pt-3">
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(history[0].page / (history[0].numPages || 100)) * 100}%` }}
                          className="h-full bg-blue-400 rounded-full" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayCircle size={20} fill="currentColor" className="text-white" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 2: All Collections (3列 + 立体书) */}
          <section className="pb-10">
            <div className="flex items-center gap-2 mb-6 text-slate-500/80">
              <BookOpen size={14} strokeWidth={3} />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Collections</span>
            </div>

            {/* 🔴 改为 grid-cols-3，并且 gap 加大适应立体书 */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-10 px-2">
              {BOOKS_DATA.map(book => (
                <div key={book.id} className="flex flex-col items-center">
                  {/* 立体书组件 */}
                  <ThreeDBook 
                    cover={book.cover} 
                    title={book.title} 
                    onClick={() => setSelectedBook(book)}
                  />
                  
                  {/* 书名信息 */}
                  <div className="text-center mt-4 w-full">
                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed h-8">
                      {book.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-1">
                      {book.subTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* --- Background Decorations (Atmosphere) --- */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/10 rounded-full blur-[80px] -z-10 pointer-events-none" />

      </motion.div>

      {/* 3. 阅读器层 (保持原样) */}
      <AnimatePresence>
        {selectedBook && (
          <PremiumReader 
            url={selectedBook.pdfUrl}
            bookId={selectedBook.id}
            title={selectedBook.title}
            onClose={() => setSelectedBook(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
            }
