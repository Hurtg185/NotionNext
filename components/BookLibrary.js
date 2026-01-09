import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, PlayCircle, Clock, BookOpen, Search, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';

// 动态导入阅读器
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
    subTitle: 'တရုတ်သဒ္ဒါအခြေခံ', // 缅文
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    pdfUrl: 'https://pdf-proxy.mfeng.workers.dev/pdf/chinese-vocab-audio/ffice.pdf', 
  },
  {
    id: 'b2',
    title: '实用口语 300 句',
    subTitle: 'လက်တွေ့သုံး စကားပြော', // 缅文
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
    pdfUrl: 'https://reader.zlib.fi/read/aed200cc9e27adfe2b703fc2e36f68304c4ded6662ecb42159503f1b4eede2f1/3635834/3fc1a9/hsk-2-standard-course.html?client_key=1fFLi67gBrNRP1j1iPy1&extension=pdf&signature=1c516e2bb836fd87086b18384c0ff1b1a2bd12aec42363620bc0334226c38455',
  },
  {
    id: 'b3',
    title: 'HSK 4级 标准教程',
    subTitle: 'HSK 4 စံသင်ရိုး',
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80',
    pdfUrl: '',
  },
  {
    id: 'b4',
    title: '中国文化常识',
    subTitle: 'တရုတ်ယဉ်ကျေးမှု',
    cover: 'https://images.unsplash.com/photo-1519682577862-22b62b233c1c?w=400&q=80',
    pdfUrl: '',
  },
   {
    id: 'b5',
    title: '测试书籍',
    subTitle: 'မြန်မာစာ',
    cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80',
    pdfUrl: '',
  }
];

const HISTORY_KEY = 'hsk-reader-meta';

/* =================================================================
   组件：3D 立体书封面 (宽版 + 重阴影)
================================================================= */
const ThreeDBook = ({ cover, title, onClick }) => {
  return (
    <div 
      onClick={onClick}
      // 1. aspect-[3/4]: 让封面更宽
      // 2. w-full: 撑满格子
      className="group relative cursor-pointer perspective-800 w-full aspect-[3/4] mx-auto"
    >
      {/* 阴影层 (更深、更重) */}
      <div className="absolute -bottom-4 left-3 right-3 h-4 bg-black/70 blur-lg rounded-full transition-all duration-300 group-hover:bg-black/80 group-hover:scale-110 group-hover:blur-xl" />
      
      {/* 书本主体 */}
      <div className="relative w-full h-full transition-transform duration-300 transform-style-3d group-hover:-translate-y-2 group-hover:rotate-y-[-10deg] group-hover:rotate-x-[5deg]">
        
        {/* 封面 */}
        <div className="absolute inset-0 rounded-r-md rounded-l-sm overflow-hidden z-10 shadow-[4px_0_10px_rgba(0,0,0,0.4)] bg-white">
          <img src={cover} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-white/50 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/10 pointer-events-none" />
        </div>

        {/* 书页厚度 */}
        <div className="absolute top-[2px] bottom-[2px] right-[-6px] w-[8px] bg-[#fdfdfd] border-l border-gray-300 z-0 transform translate-z-[-1px] rounded-r-sm shadow-sm flex flex-col justify-between py-1">
           {Array.from({length: 8}).map((_,i) => <div key={i} className="h-px bg-gray-300 mx-0.5" />)}
        </div>
        
        {/* 封底 */}
        <div className="absolute top-[1px] bottom-[1px] left-[2px] right-[-4px] bg-gray-200 -z-10 rounded-sm" />
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
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex justify-end"
    >
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full h-full bg-slate-100 shadow-2xl flex flex-col overflow-hidden sm:max-w-md ml-auto"
      >
        {/* --- Header (带图片背景) --- */}
        <div className="relative h-32 shrink-0 overflow-hidden">
            {/* 背景图 */}
            <div className="absolute inset-0 bg-blue-900">
                <img 
                    src="https://images.unsplash.com/photo-1507842217121-9e962835d75d?w=800&q=80" 
                    className="w-full h-full object-cover opacity-40 mix-blend-overlay"
                    alt="Header Background"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-transparent to-transparent" />
            </div>

            {/* Header 内容 */}
            <div className="absolute inset-0 px-4 py-4 flex flex-col justify-between z-10">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-colors">
                        <ChevronLeft size={24}/>
                    </button>
                    <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-colors">
                        <Search size={20} />
                    </button>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 drop-shadow-sm">
                        Library <Sparkles size={20} className="text-yellow-500 fill-yellow-500" />
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Find your favorite books</p>
                </div>
            </div>
        </div>

        {/* --- Scrollable Content --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-20">
          
          {/* Section 1: Recently Read */}
          {history.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <Clock size={14} strokeWidth={3} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Continue Reading</span>
              </div>
              
              <div 
                onClick={() => setSelectedBook(history[0])}
                className="group relative w-full aspect-[2.8/1] overflow-hidden rounded-2xl cursor-pointer shadow-lg active:scale-95 transition-transform"
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-[2px] opacity-60"
                  style={{ backgroundImage: `url(${history[0].cover})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />

                <div className="absolute inset-0 p-4 flex items-center gap-4">
                  <img src={history[0].cover} className="h-full aspect-[3/4] object-cover rounded shadow-md border border-white/20" alt=""/>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center text-white">
                    <h3 className="font-bold text-base leading-tight truncate">{history[0].subTitle}</h3>
                    <p className="text-[10px] opacity-70 mt-1">Page {history[0].page}</p>
                    <div className="mt-3 h-1 w-24 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${(history[0].page / (history[0].numPages || 100)) * 100}%` }}
                        className="h-full bg-yellow-400 rounded-full" 
                      />
                    </div>
                  </div>
                  <PlayCircle size={32} className="text-white/80" />
                </div>
              </div>
            </section>
          )}

          {/* Section 2: Book Grid */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <BookOpen size={14} strokeWidth={3} />
              <span className="text-[10px] font-bold uppercase tracking-widest">All Books</span>
            </div>

            {/* 🔴 布局调整核心：
                1. px-1: 减少最外层边距
                2. gap-x-3: 减少横向间距
                3. gap-y-6: 减少纵向行距
            */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-6 px-1">
              {BOOKS_DATA.map(book => (
                <div key={book.id} className="flex flex-col items-center">
                  <ThreeDBook 
                    cover={book.cover} 
                    title={book.title} 
                    onClick={() => setSelectedBook(book)}
                  />
                  
                  {/* 书名区域优化：
                      1. font-burmese: 确保你需要加载缅文字体，或者浏览器默认
                      2. leading-loose / leading-relaxed: 增加行高，防止缅文底部被切
                      3. pb-1: 增加底部内边距，容纳缅文下标
                  */}
                  <div className="text-center mt-3 w-full px-0.5">
                    <h3 className="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed pb-1 h-[2.8em] flex items-start justify-center overflow-hidden">
                      {book.subTitle}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>

      {/* Reader */}
      <AnimatePresence>
        {selectedBook && (
          <PremiumReader 
            url={selectedBook.pdfUrl}
            title={selectedBook.title}
            onClose={() => setSelectedBook(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
