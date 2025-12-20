import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, Lock, Crown, PlayCircle, Loader2, ListFilter, X, Search, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// 引入新的元数据文件
import { spokenBooks } from '@/data/spoken/meta';

export default function SpokenModule() {
  const [view, setView] = useState('category'); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [phrases, setPhrases] = useState([]); // 当前加载的句子数据
  const [playingId, setPlayingId] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  
  // 用于自动跳转的 Ref
  const pendingScrollChapter = useRef(null);
  const audioRef = useRef(null);
  const chapterRefs = useRef({});

  // 1. 初始化
  useEffect(() => {
    // 权限检查
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    
    // 物理返回处理
    const handlePopState = () => setView('category');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2. 音频播放 (SSR 安全)
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

  // 3. 核心：打开书籍并处理跳转
  const openBook = async (book, targetChapter = null) => {
    try {
      // 只有点击具体的标签/书籍时，才去下载那个 3MB 的大文件
      const data = await import(`@/data/spoken/${book.file}.js`);
      setPhrases(data.default);
      setSelectedBook(book);
      
      // 记录要跳转的目标章节
      if (targetChapter) {
        pendingScrollChapter.current = targetChapter;
      }

      setView('list');
      window.history.pushState({ view: 'list' }, '');
    } catch (e) {
      console.error(e);
      alert("资源加载中，请稍后重试...");
    }
  };

  // 4. 数据加载完成后，执行自动滚动
  useEffect(() => {
    if (view === 'list' && pendingScrollChapter.current && phrases.length > 0) {
      const ch = pendingScrollChapter.current;
      setTimeout(() => {
        const el = chapterRefs.current[ch];
        if (el) {
          // 减去顶部导航高度，精准定位
          const offset = 120; 
          const elementPosition = el.getBoundingClientRect().top + window.scrollY; // 这里需要改为容器内的滚动
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          pendingScrollChapter.current = null;
        }
      }, 300); // 稍微延迟等待 DOM 渲染
    }
  }, [view, phrases]);

  // 5. 提取去重后的小主题 (用于详情页顶部导航)
  const chaptersInDetail = useMemo(() => {
    return Array.from(new Set(phrases.map(p => p.chapter).filter(Boolean)));
  }, [phrases]);

  // 6. 详情页内部点击标签滚动
  const scrollToChapterInDetail = (ch) => {
     if (!isUnlocked) { setShowVip(true); return; }
     const el = chapterRefs.current[ch];
     if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-slate-900 max-w-md mx-auto relative overflow-hidden">
      
      {/* ================= 视图 A: 聚合首页 (App Store 风格) ================= */}
      <div className={`${view === 'category' ? 'block' : 'hidden'} pb-24`}>
        
        {/* 顶部大标题 */}
        <div className="pt-12 pb-6 px-6 bg-white sticky top-0 z-20 shadow-sm/50 backdrop-blur-md bg-white/80">
          <div className="flex items-center justify-between mb-4">
             <button onClick={() => window.history.back()} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
               <ChevronLeft size={24} />
             </button>
             <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
               <Crown size={12} fill="currentColor" /> PRO VERSION
             </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">口语特训库</h1>
          <p className="text-xs text-slate-500 mt-1">精选 {spokenBooks.length} 套教材 · 10,000+ 地道会话</p>
        </div>

        {/* 书籍 + 标签 卡片流 */}
        <div className="px-5 space-y-8 mt-6">
          {spokenBooks.map((book, index) => (
            <motion.div 
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-[2rem] p-5 shadow-xl shadow-slate-200/60 border border-white"
            >
              {/* 上半部分：书籍信息 */}
              <div 
                onClick={() => openBook(book)}
                className="flex gap-5 mb-5 cursor-pointer group"
              >
                {/* 封面图 (带阴影) */}
                <div className="relative w-24 h-32 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                  <img src={book.image} className="w-full h-full object-cover" alt={book.title} />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                </div>
                
                {/* 标题描述 */}
                <div className="flex-1 py-1">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md mb-2 inline-block">
                    {book.tag} Series
                  </span>
                  <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {book.description || "包含海量地道表达，涵盖生活、工作、商务等高频场景。"}
                  </p>
                </div>
              </div>

              {/* 下半部分：自动生成的标签云 (Chips) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={12} className="text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Jump / 快速直达</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {book.chapters.slice(0, 8).map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => openBook(book, ch)}
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-100
                        ${!isUnlocked && i > 2 
                            ? 'bg-slate-50 text-slate-300' 
                            : 'bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white hover:shadow-md active:scale-95'
                        }
                      `}
                    >
                      {ch}
                      {!isUnlocked && i > 2 && <Lock size={8} className="inline ml-1 mb-[1px] opacity-50" />}
                    </button>
                  ))}
                  {book.chapters.length > 8 && (
                    <button onClick={() => openBook(book)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-500 bg-blue-50 hover:bg-blue-100">
                      +{book.chapters.length - 8} More
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>


      {/* ================= 视图 B: 全屏阅读器 (Portal) ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-0 z-[999] bg-[#F5F7FA] flex flex-col w-full h-full max-w-md mx-auto"
          >
            {/* 1. 阅读器顶部导航 */}
            <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 z-50 flex-none">
              <div className="pt-safe-top px-4 h-14 flex items-center justify-between">
                <button onClick={() => setView('category')} className="p-2 -ml-2 text-slate-600 active:scale-90"><ChevronLeft size={26}/></button>
                <h2 className="font-bold text-slate-800 text-sm truncate">{selectedBook?.title}</h2>
                <div className="w-8" />
              </div>
              {/* 内部快捷导航 */}
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                 {chaptersInDetail.map(ch => (
                   <button key={ch} onClick={() => scrollToChapterInDetail(ch)} className="flex-shrink-0 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[11px] font-bold active:bg-blue-600 active:text-white">
                     {ch} {!isUnlocked && <Lock size={8} className="inline ml-1"/>}
                   </button>
                 ))}
              </div>
            </div>

            {/* 2. 核心列表 */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3 pb-32"
              onScroll={(e) => {
                 if (!isUnlocked && e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 100) setShowVip(true);
              }}
            >
              {phrases.map((item, index) => {
                const isLocked = !isUnlocked && index >= 6;
                const isBlurry = !isUnlocked && index === 5;
                const isHeader = index === 0 || phrases[index - 1].chapter !== item.chapter;

                return (
                  <div key={item.id} ref={el => { if (isHeader) chapterRefs.current[item.chapter] = el; }}>
                    {/* 章节分隔头 */}
                    {isHeader && (
                      <div className="mt-8 mb-4 flex items-center gap-3">
                         <div className="h-6 w-1.5 bg-blue-500 rounded-r-md"></div>
                         <span className="text-sm font-black text-slate-800">{item.chapter}</span>
                         <div className="h-[1px] bg-slate-200 flex-1"></div>
                      </div>
                    )}
                    
                    {/* 句子卡片 */}
                    <motion.div 
                        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                        onClick={() => isLocked ? setShowVip(true) : playAudio(item.chinese, item.id)} 
                        className={`
                            relative bg-white p-5 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.99] transition-all cursor-pointer
                            ${isLocked ? 'blur-[6px] opacity-60 pointer-events-none' : ''}
                            ${isBlurry ? 'blur-[2px]' : ''}
                            ${playingId === item.id ? 'ring-2 ring-blue-500 shadow-blue-100' : ''}
                        `}
                    >
                      {playingId === item.id && <div className="absolute right-4 top-4"><Loader2 size={16} className="animate-spin text-blue-500" /></div>}
                      <p className="text-[10px] text-slate-400 mb-1 font-mono">{item.pinyin}</p>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">{item.chinese}</h3>
                      <p className="text-sm text-blue-600 font-medium mb-3">{item.burmese}</p>
                      <div className="flex justify-between items-center">
                         <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">{item.xieyin}</span>
                         {playingId !== item.id && <PlayCircle size={18} className="text-slate-200" />}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
              {isUnlocked && <div className="h-20 text-center text-xs text-slate-300 pt-10">已加载全部内容</div>}
            </div>

            {/* 3. 底部拦截条 */}
            {!isUnlocked && (
              <div className="absolute bottom-8 left-4 right-4 z-[60]">
                 <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 shadow-2xl flex items-center justify-between border border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-white"><Crown size={18} fill="currentColor"/></div>
                        <div><p className="text-xs font-bold text-white">激活完整版</p><p className="text-[9px] text-slate-400">解锁标签直达 & 所有内容</p></div>
                    </div>
                    <button onClick={() => setShowVip(true)} className="px-5 py-2 bg-white text-slate-900 rounded-xl text-xs font-black shadow-lg">立即激活</button>
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= 视图 C: VIP 弹窗 ================= */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
              <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full"><X size={16}/></button>
              <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4"><Crown size={32} fill="currentColor"/></div>
              <h3 className="text-xl font-black mb-2">解锁所有章节</h3>
              <p className="text-xs text-slate-500 mb-6">激活后即可使用 <b>标签一键跳转</b> 功能，并查看所有 <b>10,000+</b> 行业场景会话。</p>
              <a href="https://m.me/61575187883357" target="_blank" className="block w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200">联系老师激活 (30,000 Ks)</a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .pt-safe-top { padding-top: max(16px, env(safe-area-inset-top)); }
      `}</style>
    </div>
  );
}
