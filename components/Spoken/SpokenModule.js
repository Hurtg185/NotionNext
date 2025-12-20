import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, Lock, Crown, PlayCircle, Loader2, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { spokenBooks } from '@/data/spoken/structure';

export default function SpokenModule() {
  const [view, setView] = useState('category'); // category | list
  const [selectedBook, setSelectedBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  
  const audioRef = useRef(null);
  const listContainerRef = useRef(null);
  const chapterRefs = useRef({});

  // 检查激活状态 (只在客户端运行)
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    
    const handlePopState = () => setView('category');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 音频播放逻辑
  const playAudio = (text, id) => {
    if (typeof window === 'undefined') return;
    if (playingId === id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    
    setPlayingId(id);
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyanNeural&r=-0.3`;
    const audio = new window.Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  // 动态加载书本数据
  const openBook = async (book) => {
    try {
      const data = await import(`@/data/spoken/${book.file}.js`);
      setPhrases(data.default);
      setSelectedBook(book);
      setView('list');
      window.history.pushState({ view: 'list' }, '');
    } catch (e) {
      alert("内容更新中...");
    }
  };

  // 提取唯一小主题标签
  const chapters = useMemo(() => {
    return Array.from(new Set(phrases.map(p => p.chapter).filter(Boolean)));
  }, [phrases]);

  // 平滑滚动到章节
  const scrollToChapter = (ch) => {
    const el = chapterRefs.current[ch];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto shadow-2xl relative font-sans overflow-hidden">
      
      {/* 视图1：书籍分类 */}
      <div className={view === 'category' ? 'block' : 'hidden'}>
        <header className="pt-12 pb-6 px-6 bg-white">
          <button onClick={() => window.history.back()} className="p-1 -ml-2 text-slate-400 mb-2"><ChevronLeft size={28} /></button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">口语特训</h1>
          <p className="text-xs text-slate-400">海量场景会话 · 地道发音谐音助记</p>
        </header>
        
        <div className="px-6 grid grid-cols-2 gap-5 pb-32">
          {spokenBooks.map(book => (
            <motion.div 
              key={book.id} 
              whileTap={{ scale: 0.95 }} 
              onClick={() => openBook(book)} 
              className="relative aspect-[3/4.3] rounded-[2.2rem] overflow-hidden shadow-lg border border-slate-50 cursor-pointer group"
            >
              <img src={book.image} className="w-full h-full object-cover group-hover:scale-110 duration-700" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-5 flex flex-col justify-end">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">{book.tag}</span>
                <h3 className="text-white font-bold text-sm leading-tight">{book.title}</h3>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 视图2：对话列表 */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col max-w-md mx-auto"
          >
            {/* 详情页页头 */}
            <div className="bg-white border-b sticky top-0 z-20">
              <div className="p-4 flex items-center justify-between">
                <button onClick={() => setView('category')} className="p-2 -ml-2"><ChevronLeft size={24} /></button>
                <h2 className="font-black text-slate-800 text-sm truncate">{selectedBook?.title}</h2>
                <div className="w-8" />
              </div>
              
              {/* 小主题导航标签 */}
              <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar scroll-smooth">
                {chapters.map(ch => (
                  <button 
                    key={ch} 
                    onClick={() => scrollToChapter(ch)} 
                    className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 whitespace-nowrap active:bg-blue-600 active:text-white"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* 对话滚动区域 */}
            <div 
              ref={listContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 pb-40" 
              onScroll={(e) => {
                if (!isUnlocked && e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 50) {
                    setShowVip(true);
                }
              }}
            >
              {phrases.map((item, index) => {
                // 核心模糊逻辑
                const isLocked = !isUnlocked && index >= 6;
                const isBlurLight = !isUnlocked && index === 4;
                const isBlurMedium = !isUnlocked && index === 5;
                const isHeader = index === 0 || phrases[index - 1].chapter !== item.chapter;

                return (
                  <div key={item.id} ref={el => { if (isHeader) chapterRefs.current[item.chapter] = el; }}>
                    {isHeader && item.chapter && (
                      <div className="py-4 px-1 text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
                        <div className="h-[1px] bg-blue-100 flex-1"></div> {item.chapter} <div className="h-[1px] bg-blue-100 flex-1"></div>
                      </div>
                    )}
                    
                    <div 
                        onClick={() => isLocked ? setShowVip(true) : playAudio(item.chinese, item.id)} 
                        className={`relative bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all
                            ${isLocked ? 'blur-[6px] opacity-60 cursor-pointer' : ''}
                            ${isBlurLight ? 'blur-[1px]' : ''}
                            ${isBlurMedium ? 'blur-[2.5px]' : ''}
                        `}
                    >
                      <div className="absolute top-5 right-5">
                        {playingId === item.id ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <PlayCircle size={16} className="text-slate-200" />}
                      </div>
                      <p className="text-[9px] text-slate-400 mb-1 font-mono">{item.pinyin}</p>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">{item.chinese}</h3>
                      <p className="text-sm text-blue-600 font-medium mb-4">{item.burmese}</p>
                      <span className="px-4 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100/50">{item.xieyin}</span>
                      
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
                            <Lock className="text-slate-400/40" size={32} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 底部悬浮激活条 */}
            {!isUnlocked && (
              <div className="fixed bottom-10 left-6 right-6 p-4 bg-slate-900 rounded-[1.5rem] shadow-2xl flex items-center justify-between text-white max-w-sm mx-auto z-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 rounded-lg text-white"><Crown size={18} /></div>
                  <div><p className="text-xs font-bold">激活口语特训包</p><p className="text-[10px] text-slate-400">解锁 10,000+ 完整内容</p></div>
                </div>
                <button onClick={() => setShowVip(true)} className="px-5 py-2.5 bg-blue-600 rounded-xl text-xs font-bold active:scale-95 transition-all">立即激活</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 激活弹窗 */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowVip(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative bg-white rounded-[2.8rem] p-10 w-full text-center shadow-2xl max-w-xs">
              <Crown className="w-16 h-16 mx-auto text-amber-500 mb-6" />
              <h3 className="text-2xl font-black text-slate-800 mb-3">解锁特训课程</h3>
              <p className="text-sm text-slate-500 mb-10 leading-relaxed">激活后即可解锁 10,000+ 核心短句、所有行业场景及地道谐音助记。</p>
              <button className="w-full py-4.5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 active:scale-95 transition-all">联系老师激活 (30,000 Ks)</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
