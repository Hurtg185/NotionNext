import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, Lock, Crown, PlayCircle, Loader2, ListFilter, X, Headphones } from 'lucide-react';
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
  const chapterRefs = useRef({}); // 用于锚点跳转

  // 1. 初始化检查激活状态
  useEffect(() => {
    // 防止背景滚动
    if (view === 'list') document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [view]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    
    // 物理返回键处理
    const handlePopState = () => {
        if (view === 'list') setView('category');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // 2. 音频控制 (SSR 安全)
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

  // 3. 打开书籍
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

  // 4. 提取唯一小主题 (去重)
  const chapters = useMemo(() => {
    return Array.from(new Set(phrases.map(p => p.chapter).filter(Boolean)));
  }, [phrases]);

  // 5. 标签跳转 (带 VIP 拦截)
  const scrollToChapter = (ch) => {
    if (!isUnlocked) {
        setShowVip(true); // VIP 拦截
        return;
    }
    const el = chapterRefs.current[ch];
    if (el) {
        // 减去顶部高度，避免被遮挡
        const y = el.getBoundingClientRect().top + window.scrollY - 140; 
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* ================= 视图 A: 精美书架 (首页) ================= */}
      <div className={`${view === 'category' ? 'block' : 'hidden'} max-w-md mx-auto pb-24`}>
        {/* 顶部 Header */}
        <div className="pt-12 pb-6 px-6 bg-white sticky top-0 z-10 shadow-sm/50">
          <button onClick={() => window.history.back()} className="mb-4 inline-flex items-center justify-center w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-90 transition-transform">
              <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">口语特训</h1>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md">PRO</span>
            <span>场景会话 · 谐音助记</span>
          </div>
        </div>

        {/* 书籍列表 (List Style) */}
        <div className="px-5 space-y-6 mt-6">
          {spokenBooks.map((book, index) => (
            <motion.div 
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => openBook(book)}
              className="group relative h-40 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200 cursor-pointer active:scale-[0.98] transition-all"
            >
               {/* 背景图 */}
               <img src={book.image} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
               <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-transparent" />
               
               {/* 内容 */}
               <div className="absolute inset-0 p-6 flex flex-col justify-center items-start z-10">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl mb-3">
                      {book.icon}
                  </div>
                  <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">{book.tag}</span>
                  <h3 className="text-xl font-bold text-white leading-tight w-2/3">{book.title}</h3>
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-white/60 font-medium">
                     <Headphones size={12} /> <span>点击开始练习</span>
                  </div>
               </div>
            </motion.div>
          ))}
        </div>
      </div>


      {/* ================= 视图 B: 全屏对话播放器 (Portal 级覆盖) ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[999] bg-slate-50 flex flex-col w-full h-full"
          >
            {/* 1. 顶部固定区：返回 + 书名 + 标签导航 */}
            <div className="bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm z-50 flex-none">
              <div className="pt-safe-top px-4 h-14 flex items-center justify-between">
                <button onClick={() => setView('category')} className="p-2 -ml-2 text-slate-600 active:scale-90 transition-transform">
                    <ChevronLeft size={26} />
                </button>
                <h2 className="font-bold text-slate-800 text-base truncate max-w-[200px]">{selectedBook?.title}</h2>
                <div className="w-8" /> {/* 占位 */}
              </div>

              {/* 场景标签栏 (VIP 功能) */}
              <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar items-center">
                 <ListFilter size={14} className="text-slate-400 flex-shrink-0 mr-1" />
                 {chapters.map(ch => (
                   <button 
                     key={ch} 
                     onClick={() => scrollToChapter(ch)}
                     className={`
                       flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                       ${!isUnlocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 active:bg-blue-600 active:text-white'}
                     `}
                   >
                     {ch} {!isUnlocked && <Lock size={8} className="inline ml-1 mb-[1px]" />}
                   </button>
                 ))}
              </div>
            </div>

            {/* 2. 核心滚动列表区域 */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 bg-slate-50"
              onScroll={(e) => {
                // 滚动到底部自动拦截
                if (!isUnlocked && e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 100) {
                    setShowVip(true);
                }
              }}
            >
              {phrases.map((item, index) => {
                // 权限逻辑
                const isLocked = !isUnlocked && index >= 6;
                const isBlurry = !isUnlocked && index === 5;
                const isHeader = index === 0 || phrases[index - 1].chapter !== item.chapter;

                return (
                  <div key={item.id} ref={el => { if (isHeader) chapterRefs.current[item.chapter] = el; }}>
                    {/* 小主题分割线 */}
                    {isHeader && item.chapter && (
                      <div className="mt-6 mb-3 flex items-center gap-3 px-2">
                         <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                         <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{item.chapter}</span>
                      </div>
                    )}
                    
                    {/* 对话卡片 */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        onClick={() => isLocked ? setShowVip(true) : playAudio(item.chinese, item.id)} 
                        className={`
                            relative bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100/50 
                            active:scale-[0.98] transition-all cursor-pointer overflow-hidden
                            ${isLocked ? 'blur-[6px] opacity-60 pointer-events-none' : ''}
                            ${isBlurry ? 'blur-[2px]' : ''}
                            ${playingId === item.id ? 'ring-2 ring-blue-500 shadow-blue-100' : ''}
                        `}
                    >
                      {/* 播放中动画 */}
                      {playingId === item.id && (
                          <div className="absolute right-0 top-0 p-4">
                              <Loader2 size={18} className="animate-spin text-blue-500" />
                          </div>
                      )}

                      <p className="text-[10px] text-slate-400 mb-1.5 font-mono">{item.pinyin}</p>
                      <h3 className="text-lg font-bold text-slate-800 mb-2 leading-relaxed">{item.chinese}</h3>
                      <p className="text-sm text-blue-600 font-medium mb-4">{item.burmese}</p>
                      
                      {/* 底部功能区：谐音 + 播放按钮 */}
                      <div className="flex items-center justify-between">
                         <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100">
                           {item.xieyin}
                         </span>
                         {playingId !== item.id && <PlayCircle size={20} className="text-slate-200" />}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
              
              {/* 未解锁时的占位 */}
              {isUnlocked && <div className="h-20 text-center text-xs text-slate-300 pt-10">—— 到底啦 ——</div>}
            </div>

            {/* 3. 底部 VIP 悬浮条 */}
            {!isUnlocked && (
              <div className="absolute bottom-8 left-4 right-4 z-[60]">
                 <div className="bg-slate-900/95 backdrop-blur-md rounded-[2rem] p-1 shadow-2xl flex items-center justify-between pl-5 pr-2 py-2 border border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                            <Crown size={14} fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white">激活完整课程</p>
                            <p className="text-[9px] text-slate-400">解锁标签跳转 & 10,000+ 对话</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowVip(true)}
                        className="px-5 py-2.5 bg-white text-slate-900 rounded-[1.5rem] text-xs font-black shadow-lg active:scale-95 transition-transform"
                    >
                        立即激活
                    </button>
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= 视图 C: 激活弹窗 ================= */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 h-screen">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowVip(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-xs text-center shadow-2xl">
              <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400"><X size={16}/></button>
              <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-500 shadow-inner">
                  <Crown size={32} fill="currentColor" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">解锁 VIP 权限</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                当前仅展示试看内容。<br/>激活后可使用 <b>标签跳转</b> 功能，并查看所有 <b>10,000+</b> 行业场景会话。
              </p>
              <a href="https://m.me/61575187883357" target="_blank" rel="noreferrer" className="flex items-center justify-center w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-200 active:scale-95 transition-all">
                联系老师激活 (30,000 Ks)
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 隐藏滚动条样式 */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pt-safe-top { padding-top: max(16px, env(safe-area-inset-top)); }
      `}</style>
    </div>
  );
}
