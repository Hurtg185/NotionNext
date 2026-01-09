import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, PlayCircle, Clock, BookOpen, Search, Sparkles, Star, Bookmark, ExternalLink, Download, Share2 } from 'lucide-react';
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
    pdfUrl: 'https://pdf-proxy.mfeng.workers.dev/pdf/chinese-vocab-audio/ffice.pdf',
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
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
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

/* =================================================================
   豪华版 3D Book - 真实立体效果
================================================================= */
const Premium3DBook = ({ cover, title, subTitle, category, level, rating, color, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative cursor-pointer perspective-1200 w-full aspect-[3/4] mx-auto"
    >
      {/* 辉光阴影 */}
      <div className={`absolute -bottom-4 left-2 right-2 h-6 bg-gradient-to-t ${color.replace('from-', 'from-').replace('to-', 'to-')}/30 blur-2xl rounded-full transition-all duration-700 ease-out group-hover:opacity-80 group-hover:scale-110 opacity-60`} />
      
      {/* 3D 书容器 */}
      <div className="relative w-full h-full transition-all duration-700 ease-out transform-style-3d group-hover:translate-y-[-8px] group-hover:rotate-y-[-8deg] group-hover:rotate-x-[2deg]">
        
        {/* 书脊装饰线 */}
        <div className="absolute left-[-4px] top-4 bottom-4 w-1 bg-gradient-to-b from-white/40 via-white/10 to-transparent z-30 rounded-full" />
        
        {/* 封面 - 带立体浮雕效果 */}
        <div className="absolute inset-0 rounded-lg overflow-hidden z-20 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-white/30 transform translate-z-[16px] group-hover:translate-z-[24px] transition-transform duration-700">
          
          {/* 渐变底色 */}
          <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-90`} />
          
          {/* 封面图片 */}
          <div className="absolute inset-3 rounded-lg overflow-hidden shadow-2xl">
            <img 
              src={cover} 
              alt={title} 
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
            />
            {/* 渐变蒙版 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
          
          {/* 标题装饰 */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="backdrop-blur-md bg-black/40 p-3 rounded-lg border border-white/20">
              <h3 className="text-sm font-bold text-white truncate">{subTitle}</h3>
              <p className="text-xs text-white/80 mt-0.5 truncate">{title}</p>
            </div>
          </div>
          
          {/* 3D 角标 */}
          <div className="absolute top-3 right-3 bg-gradient-to-br from-white to-white/80 text-slate-900 text-[10px] font-black px-2 py-1 rounded shadow-lg transform rotate-3 border border-white/50">
            {category}
          </div>
          
          {/* 光泽效果 */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          {/* 烫金边框 */}
          <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-white/30 transition-all duration-500" />
        </div>

        {/* 书页厚度 - 多层质感 */}
        <div className="absolute top-[6px] bottom-[6px] right-[-12px] w-[16px] z-10">
          <div className="absolute inset-0 bg-gradient-to-l from-slate-100 via-slate-50 to-slate-100 rounded-r-sm shadow-inner" />
          <div className="absolute inset-0 flex flex-col justify-between py-2">
            {Array.from({length: 25}).map((_, i) => (
              <div key={i} className="h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent mx-1" />
            ))}
          </div>
        </div>
        
        {/* 书脊 - 立体弧形 */}
        <div className="absolute top-[4px] bottom-[4px] left-[-8px] w-[10px] z-20">
          <div className={`absolute inset-0 bg-gradient-to-r ${color} rounded-l-md shadow-lg`} />
          <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-transparent opacity-30" />
          
          {/* 书脊标题 */}
          <div className="absolute inset-0 flex items-center justify-center rotate-180" style={{ writingMode: 'vertical-rl' }}>
            <span className="text-[8px] font-bold text-white/90 tracking-wider uppercase">{level}</span>
          </div>
        </div>

        {/* 封底 - 带装饰纹理 */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg -z-10 translate-z-[-20px] shadow-xl">
          <div className="absolute inset-2 rounded bg-gradient-to-br from-slate-700/50 to-slate-900/50 border border-slate-700/50" />
          
          {/* 出版社标志 */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-center">
            <div className="text-[10px] text-slate-500 font-bold tracking-widest">HSK PRESS</div>
            <div className="text-[6px] text-slate-600 tracking-wider mt-0.5">PREMIUM EDITION</div>
          </div>
        </div>

        {/* 悬停装饰 */}
        <div className="absolute -top-2 -right-2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-500">
          <div className="bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-900 text-[10px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
            <Sparkles size={8} />
            <span>READ</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   主组件 - 优化版
================================================================= */
export default function BookLibrary({ isOpen, onClose }) {
  const [selectedBook, setSelectedBook] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Grammar', 'Conversation', 'Exam', 'Culture', 'Business', 'Writing'];

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

  const filteredBooks = selectedCategory === 'All' 
    ? BOOKS_DATA 
    : BOOKS_DATA.filter(book => book.category === selectedCategory);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex justify-end"
    >
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[4px]"
      />

      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative w-full h-full bg-gradient-to-b from-slate-50 to-white shadow-2xl flex flex-col overflow-hidden sm:max-w-md ml-auto"
      >
        {/* --- 毛玻璃质感 Header --- */}
        <div className="relative h-40 shrink-0 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20" />
            <img 
              src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80&auto=format&fit=crop" 
              className="w-full h-full object-cover opacity-30"
              alt="Background"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-50/80 to-transparent" />
          </div>

          <div className="relative z-10 h-full px-5 pt-5 pb-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <button 
                onClick={onClose} 
                className="p-2 -ml-2 rounded-full bg-white/80 hover:bg-white backdrop-blur-lg text-slate-700 transition-all active:scale-95 shadow-lg border border-white/50"
              >
                <ChevronLeft size={24}/>
              </button>
              
              <div className="flex gap-2">
                <button className="p-2 rounded-full bg-white/80 hover:bg-white backdrop-blur-lg text-slate-700 transition-all shadow-lg border border-white/50">
                  <Search size={18} />
                </button>
                <button className="p-2 rounded-full bg-white/80 hover:bg-white backdrop-blur-lg text-slate-700 transition-all shadow-lg border border-white/50">
                  <Bookmark size={18} />
                </button>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-amber-500" />
                <h2 className="text-3xl font-black text-slate-800 drop-shadow-sm tracking-tight">
                  Premium Library
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium pl-0.5 opacity-90">
                Discover {BOOKS_DATA.length} premium Chinese learning books
              </p>
            </div>
          </div>
        </div>

        {/* --- 分类过滤器 --- */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white shadow-lg'
                    : 'bg-white/80 text-slate-600 hover:bg-white shadow-md border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* --- 主要内容区域 --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 space-y-8">
          
          {/* 继续阅读区域 */}
          {history.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-blue-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Continue Reading</span>
                </div>
                <span className="text-xs text-slate-400">{history.length} in progress</span>
              </div>
              
              <motion.div 
                layout
                onClick={() => setSelectedBook(history[0])}
                className="relative overflow-hidden rounded-2xl cursor-pointer shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 bg-white group"
              >
                {/* 装饰背景 */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-cyan-50/50" />
                
                <div className="relative p-4 flex items-center gap-4">
                  <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src={history[0].cover} className="w-full h-full object-cover" alt=""/>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        CONTINUE
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Page {history[0].page || 1}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-base text-slate-800 truncate">{history[0].subTitle}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{history[0].title}</p>
                    
                    {/* 进度条 */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Reading Progress</span>
                        <span className="font-semibold">
                          {Math.round((history[0].page / (history[0].numPages || 100)) * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(history[0].page / (history[0].numPages || 100)) * 100}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full relative"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </motion.div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <PlayCircle size={20} className="ml-0.5" />
                  </div>
                </div>
              </motion.div>
            </section>
          )}

          {/* 书籍网格 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-purple-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  {selectedCategory} Books
                </span>
              </div>
              <span className="text-xs text-slate-400">{filteredBooks.length} books</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {filteredBooks.map((book) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col"
                >
                  <Premium3DBook {...book} onClick={() => setSelectedBook(book)} />
                  
                  {/* 书籍信息卡片 */}
                  <div className="mt-2 bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-slate-200/50">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                      {book.subTitle}
                    </h4>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <Star size={10} className="text-amber-500 fill-amber-500" />
                        <span className="text-[10px] text-slate-600 font-medium">{book.rating}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{book.pages}p</span>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r ${book.color} text-white font-bold`}>
                        {book.level}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        {/* 底部装饰 */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
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
