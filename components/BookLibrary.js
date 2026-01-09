import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Play, Clock, BookOpen, Search, Sparkles, Star, Bookmark, Lock } from 'lucide-react';

// =========================================
// 0. 数据源 (完全保留你的数据)
// =========================================
const BOOKS_DATA = [
  {
    id: 'b1',
    title: '汉语语法基础',
    subTitle: 'တရုတ်သဒ္ဒါအခြေခံ', 
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    pdfUrl: 'https://pdf.886.best/pdf/chinese-vocab-audio/hsk1.pdf',
    category: 'Grammar',
    level: 'Beginner',
    pages: 128,
    rating: 4.8,
    color: 'from-blue-500 to-cyan-400'
  },
  {
    id: 'b2',
    title: '实用口语 300 句',
    subTitle: 'လက်တွေ့သုံး စကားပြော', 
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80', // 换了个图示意
    pdfUrl: '',
    category: 'Conversation',
    level: 'Intermediate',
    pages: 96,
    rating: 4.6,
    color: 'from-emerald-500 to-teal-400'
  },
  {
    id: 'b3',
    title: 'HSK 4级 标准教程',
    subTitle: 'HSK 4 စံသင်ရိုး',
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80',
    pdfUrl: '',
    category: 'Exam',
    level: 'Advanced',
    pages: 256,
    rating: 4.9,
    color: 'from-purple-500 to-pink-400'
  },
  {
    id: 'b4',
    title: '中国文化常识',
    subTitle: 'တရုတ်ယဉ်ကျေးမှု',
    cover: 'https://images.unsplash.com/photo-1519682577862-22b62b233c1c?w=400&q=80',
    pdfUrl: '',
    category: 'Culture',
    level: 'All Levels',
    pages: 180,
    rating: 4.7,
    color: 'from-amber-500 to-orange-400'
  },
  {
    id: 'b5',
    title: '商务汉语速成',
    subTitle: 'စီးပွားရေး တရုတ်စာ',
    cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80',
    pdfUrl: '',
    category: 'Business',
    level: 'Intermediate',
    pages: 200,
    rating: 4.5,
    color: 'from-red-500 to-rose-400'
  },
  {
    id: 'b6',
    title: '汉字书写艺术',
    subTitle: 'တရုတ်စာလုံး ရေးသားအနုပညာ',
    cover: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&q=80',
    pdfUrl: '',
    category: 'Writing',
    level: 'Beginner',
    pages: 160,
    rating: 4.8,
    color: 'from-violet-500 to-indigo-400'
  }
];

const HISTORY_KEY = 'hsk-reader-meta';

// =========================================
// 1. 临时阅读器 (防止报错)
// =========================================
const MockReader = ({ title, onClose }) => (
  <motion.div 
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center text-white"
  >
    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full">
      <X size={24} />
    </button>
    <BookOpen size={48} className="mb-4 text-blue-400" />
    <h2 className="text-2xl font-bold mb-2">{title}</h2>
    <p className="text-slate-400">阅读器加载成功 (Mock Mode)</p>
  </motion.div>
);

// =========================================
// 2. 终极 3D 书籍组件 (支持透明背景 + 3列布局优化)
// =========================================
const Premium3DBook = ({ cover, title, subTitle, level, rating, color, onClick }) => {
  return (
    <div onClick={onClick} className="flex flex-col gap-2 w-full group cursor-pointer">
      {/* 3D 舞台 */}
      <div className="relative perspective-[600px] w-full aspect-[0.7/1] z-0">
        
        {/* 底部辉光 (随颜色变化) */}
        <div className={`absolute -bottom-3 left-2 right-2 h-4 rounded-full blur-xl opacity-40 group-active:opacity-70 transition-all duration-300 bg-gradient-to-r ${color}`} />

        {/* 3D 核心变换: 默认侧转 25度，点击回正一点 */}
        <div className="relative w-full h-full transform-style-3d transition-all duration-500 ease-out 
          rotate-y-[-25deg] rotate-x-[5deg] scale-95
          group-active:rotate-y-[-10deg] group-active:rotate-x-[0deg] group-active:scale-[0.98]">

          {/* A. 书页 (侧面厚度) */}
          <div className="absolute top-[3px] bottom-[3px] right-[-10px] w-[12px] z-0 rotate-y-[90deg] translate-x-[5px]">
            <div className="absolute inset-0 bg-[#fdfdfd] border-l border-slate-100 shadow-inner">
               <div className="w-full h-full opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,#000_1px,#000_2px)]" />
            </div>
          </div>

          {/* B. 书脊 (左侧) */}
          <div className="absolute top-[2px] bottom-[2px] left-[-6px] w-[8px] z-0 rotate-y-[-90deg] translate-x-[-3px]">
            <div className={`absolute inset-0 bg-gradient-to-b ${color} brightness-90 shadow-md rounded-l-sm`} />
          </div>

          {/* C. 封底阴影 */}
          <div className="absolute inset-0 bg-white rounded-md translate-z-[-12px] shadow-xl" />

          {/* D. 封面 (白底 + 图片) */}
          <div className="absolute inset-0 z-10 rounded-r-md rounded-l-sm overflow-hidden bg-white translate-z-[0px] shadow-[-1px_0_2px_rgba(0,0,0,0.1)]">
            {/* 图片 */}
            <img src={cover} alt={title} className="w-full h-full object-cover" />
            
            {/* 纸张纹理 & 高光 */}
            <div className="absolute inset-0 opacity-[0.05] bg-slate-100 pointer-events-none mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-active:opacity-100 transition-opacity pointer-events-none" />

            {/* 左上角 Level 标签 */}
            <div className="absolute top-2 left-0 shadow-md">
               <div className={`px-1.5 py-[2px] rounded-r text-[8px] font-black text-white bg-gradient-to-r ${color}`}>
                 {level}
               </div>
            </div>

            {/* 播放按钮 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-[2px] flex items-center justify-center border border-white/40 shadow-lg group-active:scale-110 transition-transform">
                 <Play size={12} fill="white" className="text-white ml-0.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 外部信息区 (针对一排3个优化) */}
      <div className="px-1 min-h-[3rem]">
        <h3 className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2 h-[2.4em]">
          {subTitle}
        </h3>
        <p className="text-[9px] text-slate-400 truncate mt-0.5">{title}</p>
      </div>
    </div>
  );
};

// =========================================
// 3. 主界面 (BookLibrary)
// =========================================
export default function BookLibrary() {
  const [isOpen, setIsOpen] = useState(true); // 默认打开方便调试
  const [selectedBook, setSelectedBook] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Grammar', 'Conversation', 'Exam', 'Culture', 'Business', 'Writing'];

  useEffect(() => {
    // 模拟读取历史记录
    const allHistory = [];
    BOOKS_DATA.forEach(book => {
      const saved = localStorage.getItem(`${HISTORY_KEY}_${book.id}`);
      if (saved) {
        allHistory.push({ ...book, ...JSON.parse(saved) });
      }
    });
    // 如果没有历史记录，模拟一条方便展示效果
    if (allHistory.length === 0 && BOOKS_DATA.length > 0) {
       setHistory([{...BOOKS_DATA[0], page: 12, numPages: 128}]);
    } else {
       setHistory(allHistory.sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead)));
    }
  }, [selectedBook]);

  const filteredBooks = selectedCategory === 'All' 
    ? BOOKS_DATA 
    : BOOKS_DATA.filter(book => book.category === selectedCategory);

  if (!isOpen) return (
    <div className="flex items-center justify-center h-screen bg-slate-100">
      <button onClick={() => setIsOpen(true)} className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-xl">
        打开图书馆
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-slate-900/60 backdrop-blur-[4px]">
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }}
        className="relative w-full h-full bg-slate-50 shadow-2xl flex flex-col overflow-hidden sm:max-w-md ml-auto"
      >
        {/* --- Header --- */}
        <div className="relative h-36 shrink-0 overflow-hidden bg-white">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10" />
            <img 
              src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80" 
              className="w-full h-full object-cover opacity-20"
              alt="Background"
            />
          </div>

          <div className="relative z-10 h-full px-4 pt-4 pb-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <button onClick={() => setIsOpen(false)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700">
                <ChevronLeft size={24}/>
              </button>
              <div className="flex gap-2">
                <button className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
                  <Search size={20} />
                </button>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-amber-500" />
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                  Premium Library
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium pl-0.5">
                {BOOKS_DATA.length} premium books available
              </p>
            </div>
          </div>
        </div>

        {/* --- Categories --- */}
        <div className="px-4 pt-3 pb-1 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* --- Main Content --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-6 bg-slate-50">
          
          {/* History Section */}
          {history.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Continue Reading</span>
              </div>
              
              <div 
                onClick={() => setSelectedBook(history[0])}
                className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center gap-3 active:scale-98 transition-transform"
              >
                <div className="relative h-16 w-12 shrink-0 rounded overflow-hidden shadow-md">
                   <img src={history[0].cover} className="w-full h-full object-cover" alt=""/>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-slate-800 truncate">{history[0].subTitle}</h3>
                  <p className="text-[10px] text-slate-500 truncate">{history[0].title}</p>
                  <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${(history[0].page / (history[0].numPages || 100)) * 100}%` }} 
                      className="h-full bg-blue-500 rounded-full" 
                    />
                  </div>
                </div>
                <Play size={20} className="text-blue-500" />
              </div>
            </section>
          )}

          {/* Grid Section - 强制 grid-cols-3 */}
          <section>
             <div className="flex items-center gap-2 mb-3">
                <BookOpen size={12} className="text-purple-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {selectedCategory} Books
                </span>
              </div>

            {/* 这里是重点：grid-cols-3，gap-3 */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-6 px-1">
              {filteredBooks.map((book) => (
                <Premium3DBook 
                  key={book.id} 
                  {...book} 
                  onClick={() => setSelectedBook(book)} 
                />
              ))}
            </div>
          </section>
        </div>
      </motion.div>

      {/* Reader Modal */}
      <AnimatePresence>
        {selectedBook && (
          <MockReader 
            title={selectedBook.title}
            onClose={() => setSelectedBook(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
