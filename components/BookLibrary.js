import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Sparkles, Heart, Plus, Link as LinkIcon, Download } from 'lucide-react';

// =========================================
// 0. 数据源
// =========================================
const BOOKS_DATA = [
  {
    id: 'b1',
    title: '汉语语法基础',
    subTitle: 'တရုတ်သဒ္ဒါအခြေခံ', 
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    pdfUrl: 'https://pdf.886.best/pdf/chinese-vocab-audio/hsk1.pdf', // 测试用 PDF
    category: 'Grammar',
    level: 'Beginner',
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
    rating: 4.8,
    color: 'from-violet-500 to-indigo-400'
  }
];

const HISTORY_KEY = 'hsk-reader-meta';

// =========================================
// 1. PDF 阅读器组件 (修复版)
// =========================================
const PDFReader = ({ url, title, onClose }) => {
  if (!url) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center text-white">
         <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full"><X size={24} /></button>
         <p className="text-slate-400 mb-4">该书籍暂无 PDF 资源</p>
         <div className="text-xs text-slate-500">请联系管理员添加</div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <h2 className="text-white text-sm font-bold truncate pr-4 max-w-[70%]">{title}</h2>
        <div className="flex gap-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
            <Download size={18} />
          </a>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-red-500/80 transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 w-full h-full bg-slate-100 relative">
        <iframe 
          src={url} 
          className="w-full h-full border-0" 
          title="PDF Viewer"
        />
      </div>
    </motion.div>
  );
};

// =========================================
// 2. 极简书本组件 (无书脊，无标签)
// =========================================
const CleanBookCard = ({ cover, title, subTitle, color, onClick }) => {
  return (
    <div onClick={onClick} className="flex flex-col gap-2 w-full group cursor-pointer">
      {/* 
         封面区域 
         perspective-0: 去掉强烈的透视
         shadow-lg: 保留阴影增加层次
      */}
      <div className="relative w-full aspect-[0.7/1] z-0">
        
        {/* 底部微弱彩色光晕 */}
        <div className={`absolute -bottom-2 left-2 right-2 h-3 rounded-full blur-lg opacity-40 group-active:opacity-70 transition-all duration-300 bg-gradient-to-r ${color}`} />

        {/* 
           封面主体
           active:scale-95: 点击时的微缩反馈
        */}
        <div className="relative w-full h-full rounded-md overflow-hidden bg-white shadow-md transition-transform duration-200 group-active:scale-95 border border-slate-100/50">
          
          {/* 图片 */}
          <img src={cover} alt={title} className="w-full h-full object-cover" />
          
          {/* 极其轻微的纸张高光 */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50 pointer-events-none" />

          {/* 
             (这里去掉了所有的标签、Icon、等级文字) 
             只保留纯净的封面 
          */}
        </div>
      </div>

      {/* 外部信息区 - 极简排版 */}
      <div className="px-0.5 min-h-[2.5rem]">
        <h3 className="text-[11px] font-bold text-slate-800 leading-[1.2] line-clamp-2 h-[2.4em]">
          {subTitle}
        </h3>
        {/* 只在第二行显示中文标题，字体更小颜色更淡 */}
        <p className="text-[9px] text-slate-400 truncate mt-0.5">{title}</p>
      </div>
    </div>
  );
};

// =========================================
// 3. 主界面
// =========================================
export default function BookLibrary() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Grammar', 'Conversation', 'Exam', 'Culture', 'Business'];

  useEffect(() => {
    // 模拟读取历史
    const allHistory = [];
    BOOKS_DATA.forEach(book => {
      const saved = localStorage.getItem(`${HISTORY_KEY}_${book.id}`);
      if (saved) { allHistory.push({ ...book, ...JSON.parse(saved) }); }
    });
    // 如果没有历史记录，为了展示效果，默认把前三个加进去
    if (allHistory.length === 0) {
       setHistory(BOOKS_DATA.slice(0, 3));
    } else {
       setHistory(allHistory);
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
    <>
      {/* 注入全局样式：隐藏滚动条但保留功能 */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="fixed inset-0 z-[110] flex justify-end bg-slate-900/60 backdrop-blur-[4px]">
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }}
          className="relative w-full h-full bg-slate-50 shadow-2xl flex flex-col overflow-hidden sm:max-w-md ml-auto"
        >
          {/* --- Header (增加网站链接和功能按钮) --- */}
          <div className="relative shrink-0 bg-white z-20 border-b border-slate-100">
            <div className="absolute inset-0 bg-slate-50/50" />
            
            <div className="relative z-10 px-4 pt-4 pb-2">
              {/* Top Row: 网站链接 & 右侧按钮 */}
              <div className="flex items-center justify-between mb-4">
                <a 
                  href="https://886.best" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <LinkIcon size={12} />
                  <span className="text-[11px] font-bold tracking-tight">886.best</span>
                </a>

                <div className="flex gap-2">
                  <button className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                    <Heart size={18} />
                  </button>
                  <button className="p-2 rounded-full bg-slate-800 text-white shadow-md active:scale-95 transition-transform">
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              
              {/* Title Row */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Sparkles size={16} className="text-amber-500" />
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">
                      My Library
                    </h2>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium pl-0.5">
                    学习资源库
                  </p>
                </div>
                <button className="p-2 text-slate-400">
                  <Search size={20} />
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-500'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* --- Main Content (无滚动条) --- */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-20 space-y-8 bg-slate-50">
            
            {/* 历史记录 (改成 Grid 3列) */}
            {history.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">最近阅读</span>
                </div>
                
                {/* 这里的 Grid 和下面保持一致：3列 */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-6">
                  {history.map((book) => (
                    <CleanBookCard 
                      key={`hist-${book.id}`} 
                      {...book} 
                      onClick={() => setSelectedBook(book)} 
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 全部书籍 Grid (3列) */}
            <section>
               <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {selectedCategory} Books
                  </span>
                  <span className="text-[9px] text-slate-300">{filteredBooks.length} items</span>
                </div>

              <div className="grid grid-cols-3 gap-x-3 gap-y-6">
                {filteredBooks.map((book) => (
                  <CleanBookCard 
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
            <PDFReader 
              url={selectedBook.pdfUrl}
              title={selectedBook.title}
              onClose={() => setSelectedBook(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
