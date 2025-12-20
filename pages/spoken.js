import React, { useState, useEffect } from 'react';
import { ChevronLeft, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { spokenBooks } from '@/data/spoken/structure';
import BookCard from '@/components/Spoken/BookCard';
import DialogueList from '@/components/Spoken/DialogueList';

export default function SpokenPage() {
  const [view, setView] = useState('category');
  const [selectedBook, setSelectedBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
  }, []);

  const openBook = async (book) => {
    try {
      const data = await import(`@/data/spoken/${book.file}.js`);
      setPhrases(data.default);
      setSelectedBook(book);
      setView('list');
    } catch (e) {
      alert("加载中...");
    }
  };

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto shadow-2xl relative font-sans overflow-x-hidden">
      {/* 分类主视图 */}
      <div className={view === 'category' ? 'block' : 'hidden'}>
        <header className="pt-12 pb-6 px-6">
          <button onClick={() => window.history.back()} className="p-1 -ml-2 text-slate-400 mb-2"><ChevronLeft size={28} /></button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">口语特训</h1>
          <p className="text-xs text-slate-400">海量场景会话 · 地道发音谐音</p>
        </header>

        <div className="px-6 grid grid-cols-2 gap-5 pb-24">
          {spokenBooks.map(book => (
            <BookCard key={book.id} book={book} onClick={openBook} />
          ))}
        </div>
      </div>

      {/* 对话列表视图 */}
      <AnimatePresence>
        {view === 'list' && (
          <DialogueList 
            phrases={phrases}
            book={selectedBook}
            isUnlocked={isUnlocked}
            onShowVip={() => setShowVip(true)}
            onBack={() => setView('category')}
          />
        )}
      </AnimatePresence>

      {/* 激活弹窗 */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowVip(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative bg-white rounded-[2.5rem] p-8 w-full text-center shadow-2xl">
              <Crown className="w-16 h-16 mx-auto text-amber-500 mb-4" />
              <h3 className="text-2xl font-black text-slate-800 mb-2">激活口语特训</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">解锁 10,000+ 完整句子、全部行业场景及谐音助记。</p>
              <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold">联系老师激活 (30,000 Ks)</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
