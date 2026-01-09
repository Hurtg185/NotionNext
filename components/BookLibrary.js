import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, PlayCircle, Clock, BookOpen } from 'lucide-react';
import dynamic from 'next/dynamic';

// ==========================================
// 重要：使用动态导入加载阅读器 (防止 Next.js 服务端报错)
// ==========================================
const PremiumReader = dynamic(() => import('./PremiumReader'), { 
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white">Loading Reader...</div>
});

const BOOKS_DATA = [
  {
    id: 'b1',
    title: '汉语语法基础 (Basic Grammar)',
    subTitle: 'တရုတ်သဒ္ဒါအခြေခံ',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    pdfUrl: 'https://pdf-proxy.mfeng.workers.dev/pdf/chinese-vocab-audio/ffice.pdf', 
  },
  {
    id: 'b2',
    title: '实用口语 300 句',
    subTitle: 'လက်တွေ့သုံး စကားပြော',
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
    pdfUrl: 'https://reader.zlib.fi/read/aed200cc9e27adfe2b703fc2e36f68304c4ded6662ecb42159503f1b4eede2f1/3635834/3fc1a9/hsk-2-standard-course.html?client_key=1fFLi67gBrNRP1j1iPy1&extension=pdf&signature=1c516e2bb836fd87086b18384c0ff1b1a2bd12aec42363620bc0334226c38455',
  }
];

const HISTORY_KEY = 'hsk-reader-meta';

export default function BookLibrary({ isOpen, onClose }) {
  const [selectedBook, setSelectedBook] = useState(null); // 当前选中的书对象
  const [history, setHistory] = useState([]);

  // 加载阅读历史（用于显示最近阅读）
  useEffect(() => {
    const allHistory = [];
    BOOKS_DATA.forEach(book => {
      const saved = localStorage.getItem(`${HISTORY_KEY}_${book.id}`);
      if (saved) {
        allHistory.push({ ...book, ...JSON.parse(saved) });
      }
    });
    // 按最后阅读时间排序
    setHistory(allHistory.sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead)));
  }, [selectedBook, isOpen]); // 当关闭阅读器或打开图书馆时刷新历史

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      className="fixed inset-0 z-[110] bg-slate-50 flex flex-col overflow-hidden"
    >
      {/* 图书馆 Header */}
      <div className="px-4 py-4 bg-white shadow-sm flex items-center justify-between shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-600"><ChevronLeft size={24}/></button>
        <h2 className="text-lg font-black text-slate-800">免费书籍 (Library)</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* 1. 最近阅读 (History) */}
        {history.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Recently Read</span>
            </div>
            <div 
              onClick={() => setSelectedBook(history[0])}
              className="bg-blue-600 rounded-3xl p-4 text-white flex items-center gap-4 shadow-lg shadow-blue-100 active:scale-95 transition-transform cursor-pointer"
            >
              <img src={history[0].cover} className="w-16 h-20 object-cover rounded-xl shadow-md" alt=""/>
              <div className="flex-1">
                <h3 className="font-bold text-sm line-clamp-1">{history[0].title}</h3>
                <p className="text-[10px] opacity-80 mt-1">继续阅读第 {history[0].page} 页</p>
                <div className="mt-2 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white" style={{ width: '40%' }} />
                </div>
              </div>
              <PlayCircle size={32} fill="currentColor" className="text-white/20" />
            </div>
          </section>
        )}

        {/* 2. 所有书籍列表 (All Books) */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <BookOpen size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">All Collections</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {BOOKS_DATA.map(book => (
              <div 
                key={book.id} 
                onClick={() => setSelectedBook(book)}
                className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all"
              >
                <div className="aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-slate-100 shadow-inner">
                  <img src={book.cover} className="w-full h-full object-cover" alt="" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight h-8">{book.title}</h3>
                <p className="text-[9px] text-slate-400 mt-1 font-burmese">{book.subTitle}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ==========================================
          阅读器弹出层 (当选中书时显示)
      ========================================== */}
      <AnimatePresence>
        {selectedBook && (
          <PremiumReader 
            url={selectedBook.pdfUrl}
            bookId={selectedBook.id}
            title={selectedBook.title}
            onClose={() => setSelectedBook(null)} // 关闭时清空选中，回到图书馆
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
