import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronLeft, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 导入数据
import { spokenCategories } from '@/data/spoken/categories';
// 导入组件
import SpokenBookCard from '@/components/Spoken/SpokenBookCard';
import SpokenDialogueList from '@/components/Spoken/SpokenDialogueList';

export default function SpokenPage() {
  const router = useRouter();
  const [view, setView] = useState('category'); // category | list
  const [selectedBook, setSelectedBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [showVipModal, setShowVipModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // 1. 挂载时检查激活状态
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
  }, []);

  // 2. 点击书籍，加载对应数据
  const handleBookClick = async (book) => {
    try {
      // 动态加载对应 JSON 数据，例如 data/spoken/daily10k.js
      const module = await import(`@/data/spoken/${book.file}.js`);
      setPhrases(module.default);
      setSelectedBook(book);
      setView('list');
    } catch (e) {
      console.error("数据加载失败:", e);
      // 如果没数据，先用 Mock 数据演示
      setPhrases(Array.from({length: 15}, (_, i) => ({ id: i, chinese: '测试句子', pinyin: 'test', burmese: 'test' })));
      setSelectedBook(book);
      setView('list');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto shadow-2xl relative font-sans">
      
      {/* 首页分类视图 */}
      <div className="bg-white min-h-screen">
        <header className="pt-10 pb-6 px-6">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.back()} className="p-1 -ml-2 text-slate-400"><ChevronLeft size={24} /></button>
            <h1 className="text-3xl font-black text-slate-900">口语特训</h1>
          </div>
          <p className="text-xs text-slate-400">地道场景会话 · 发音谐音助记</p>
        </header>

        <div className="px-6 space-y-10 pb-20">
          {spokenCategories.map(cat => (
            <div key={cat.id}>
              <h2 className="flex items-center gap-2 font-black text-slate-800 mb-5">
                <span className="text-xl">{cat.icon}</span> {cat.title}
              </h2>
              <div className="grid grid-cols-2 gap-5">
                {cat.books.map(book => (
                  <SpokenBookCard key={book.id} book={book} onClick={handleBookClick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 对话详情视图 */}
      <AnimatePresence>
        {view === 'list' && (
          <SpokenDialogueList 
            phrases={phrases}
            bookName={selectedBook?.name}
            isUnlocked={isUnlocked}
            onShowVip={() => setShowVipModal(true)}
            onBack={() => setView('category')}
          />
        )}
      </AnimatePresence>

      {/* 激活 VIP 弹窗 */}
      <AnimatePresence>
        {showVipModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowVipModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white rounded-[2.5rem] p-8 w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                <Crown size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2 text-slate-800">解锁特训课程</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">激活后即可解锁 10,000+ 完整内容、所有行业场景及发音谐音。</p>
              <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 active:scale-95 transition-all">联系老师开通</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
