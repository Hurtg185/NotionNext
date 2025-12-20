import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Volume2, Home, ArrowUp, ChevronRight, BookOpen 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { spokenBooks } from '@/data/spoken/meta'; // 确保路径正确

// --- 音频播放核心 (修复缅文播放) ---
const playTTS = (text, voice, rate, onEnd) => {
  if (typeof window === 'undefined') return;
  if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
  }

  // rate 转换: -30 => -30%
  const rateStr = rate < 0 ? `${rate}%` : `+${rate}%`;
  // 构建 CF 缓存友好链接
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateStr}`;
  
  const audio = new Audio(url);
  window.currentAudio = audio;
  audio.onended = onEnd;
  audio.onerror = (e) => {
      console.error("TTS Error:", e);
      onEnd(); // 出错也要结束，不然会卡住
  };
  audio.play().catch(() => onEnd());
};

export default function SpokenModule() {
  // === 1. 状态管理 ===
  const [view, setView] = useState('home'); // home | category | list
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null); // 选中的大主题
  const [phrases, setPhrases] = useState([]); // 当前加载的所有数据
  
  // 播放设置 (默认值满足你的要求)
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  // 交互状态
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  
  // 滚动记忆
  const lastScrollY = useRef(0);
  const listRef = useRef(null);

  // === 2. 初始化与进度恢复 ===
  useEffect(() => {
    // 读取权限
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));

    // 读取设置
    const savedSettings = JSON.parse(localStorage.getItem('spoken_settings'));
    if (savedSettings) setSettings(savedSettings);

    // 尝试恢复浏览进度
    const savedProgress = JSON.parse(localStorage.getItem('spoken_progress'));
    if (savedProgress && savedProgress.bookId) {
        const book = spokenBooks.find(b => b.id === savedProgress.bookId);
        if (book) {
            restoreProgress(book, savedProgress);
        }
    }
  }, []);

  // 恢复进度的逻辑
  const restoreProgress = async (book, progress) => {
      try {
          const data = await import(`@/data/spoken/${book.file}.js`);
          setPhrases(data.default);
          setSelectedBook(book);
          
          if (progress.view === 'category') {
              setView('category');
          } else if (progress.view === 'list' && progress.catName) {
              setSelectedCat(progress.catName);
              setView('list');
              // 恢复滚动位置
              setTimeout(() => window.scrollTo(0, progress.scrollY || 0), 100);
          }
      } catch (e) { console.error("Restore failed", e); }
  };

  // 保存设置
  useEffect(() => {
      localStorage.setItem('spoken_settings', JSON.stringify(settings));
  }, [settings]);

  // 保存进度 (视图切换时保存)
  useEffect(() => {
      const progress = {
          bookId: selectedBook?.id,
          view: view,
          catName: selectedCat,
          scrollY: window.scrollY
      };
      localStorage.setItem('spoken_progress', JSON.stringify(progress));
  }, [view, selectedBook, selectedCat]);

  // === 3. 业务逻辑 ===

  // 加载书籍数据 -> 进入分类选择页
  const handleOpenBook = async (book) => {
      try {
          const data = await import(`@/data/spoken/${book.file}.js`);
          setPhrases(data.default);
          setSelectedBook(book);
          setView('category');
          window.scrollTo(0, 0);
      } catch (e) { alert("数据加载中，请稍后..."); }
  };

  // 选择大主题 -> 进入列表页
  const handleSelectCategory = (catName) => {
      setSelectedCat(catName);
      setView('list');
      window.scrollTo(0, 0);
  };

  // 播放逻辑 (支持分别设置)
  const handlePlay = (item) => {
      if (playingId === item.id) {
          if (window.currentAudio) window.currentAudio.pause();
          setPlayingId(null);
          return;
      }
      setPlayingId(item.id);

      const playSequence = async () => {
          // 1. 中文
          if (settings.zhEnabled) {
              await new Promise(resolve => playTTS(item.chinese, settings.zhVoice, settings.zhRate, resolve));
          }
          if (playingId !== item.id) return; // 被打断

          // 2. 缅文 (增加一点间隔)
          if (settings.myEnabled) {
              await new Promise(r => setTimeout(r, 400));
              await new Promise(resolve => playTTS(item.burmese, settings.myVoice, settings.myRate, resolve));
          }
          setPlayingId(null);
      };
      playSequence();
  };

  // 滚动监听 (显隐 Header + 回到顶部)
  useEffect(() => {
      if (view !== 'list') return;
      const handleScroll = () => {
          const currentY = window.scrollY;
          setShowBackTop(currentY > 300);
          setShowHeader(currentY < lastScrollY.current || currentY < 100);
          lastScrollY.current = currentY;
          
          // 更新滚动位置到本地存储(防抖优化可加可不加)
          localStorage.setItem('spoken_progress', JSON.stringify({
              bookId: selectedBook?.id, view: 'list', catName: selectedCat, scrollY: currentY
          }));
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, [view, selectedBook, selectedCat]);

  // 数据过滤：根据大主题筛选
  const filteredPhrases = useMemo(() => {
      if (!selectedCat) return [];
      return phrases.filter(p => p.category === selectedCat);
  }, [phrases, selectedCat]);

  // 提取小主题 (用于列表页锚点)
  const subCategories = useMemo(() => {
      return Array.from(new Set(filteredPhrases.map(p => p.sub).filter(Boolean)));
  }, [filteredPhrases]);

  // 小主题跳转
  const scrollToSub = (subName) => {
      const el = document.getElementById(`sub-${subName}`);
      if (el) {
          const offset = 140; // 避开顶部
          const top = el.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
      }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl">
      
      {/* =================================================================
          1. 首页 (Home) - 只有背景图和书籍列表 (非卡片流)
      ================================================================= */}
      {view === 'home' && (
        <div className="min-h-screen relative flex flex-col">
            {/* 全屏背景图 */}
            <div className="fixed inset-0 z-0">
                <img src="https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&q=80" className="w-full h-full object-cover opacity-100" />
                <div className="absolute inset-0 bg-black/40" /> {/* 遮罩 */}
            </div>

            {/* 顶部主页胶囊 */}
            <div className="fixed top-6 left-0 right-0 z-50 flex justify-center">
                 <a href="https://886.best" target="_blank" className="bg-black/40 backdrop-blur-md border border-white/20 text-white px-5 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl active:scale-95 transition-transform">
                     <Home size={14} /> 886.best
                 </a>
            </div>

            {/* 标题 */}
            <div className="relative z-10 pt-32 px-8 mb-10">
                <h1 className="text-4xl font-black text-white mb-2 tracking-tight">口语特训</h1>
                <p className="text-white/80 text-sm font-medium">每天 10 分钟，开口即地道</p>
            </div>

            {/* 书籍列表 (简约条目式) */}
            <div className="relative z-10 flex-1 px-6 space-y-4 pb-20">
                {spokenBooks.map((book) => (
                    <motion.div 
                        key={book.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleOpenBook(book)}
                        className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-black/10 cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                {book.id === '10k' ? '🔥' : '🏭'}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{book.title}</h3>
                                <div className="text-xs text-slate-500 mt-0.5 flex gap-2">
                                    <span className="bg-slate-100 px-1.5 rounded">含 {book.categories.length} 大主题</span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-300" />
                    </motion.div>
                ))}
            </div>
        </div>
      )}

      {/* =================================================================
          2. 分类选择页 (Category) - 大主题列表
      ================================================================= */}
      {view === 'category' && selectedBook && (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white sticky top-0 z-20 px-4 pt-4 pb-3 shadow-sm flex items-center justify-between">
                <button onClick={() => setView('home')} className="p-2 -ml-2 text-slate-500"><ChevronLeft/></button>
                <span className="font-bold text-slate-800">{selectedBook.title}</span>
                <div className="w-8" />
            </div>

            <div className="p-6">
                <h2 className="text-2xl font-black text-slate-900 mb-6">请选择学习主题</h2>
                <div className="grid gap-4">
                    {selectedBook.categories.map((cat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => handleSelectCategory(cat.name)}
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm active:scale-98 cursor-pointer flex items-center justify-between"
                        >
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{cat.name}</h3>
                                <p className="text-xs text-slate-400 mt-1">{cat.desc}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                                <ArrowUp className="rotate-90" size={16} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* =================================================================
          3. 列表详情页 (List) - 小主题 + 对话
      ================================================================= */}
      {view === 'list' && (
        <div className="min-h-screen bg-[#F5F7FA]">
            {/* 顶部控制栏 (滚动自动隐藏) */}
            <motion.div 
                initial={{ y: 0 }}
                animate={{ y: showHeader ? 0 : -100 }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md shadow-sm max-w-md mx-auto"
            >
                {/* 第一行：返回 + 标题 + 设置 */}
                <div className="px-4 h-14 flex items-center justify-between pt-safe-top">
                    <button onClick={() => setView('category')} className="p-2 -ml-2 text-slate-600"><ChevronLeft/></button>
                    <span className="font-bold text-slate-800 text-sm">{selectedCat}</span>
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}><Settings2 size={20}/></button>
                </div>
                
                {/* 第二行：小主题细分导航 */}
                <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
                    {subCategories.map(sub => (
                        <button 
                            key={sub}
                            onClick={() => scrollToSub(sub)}
                            className="flex-shrink-0 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold active:bg-blue-600 active:text-white transition-colors"
                        >
                            {sub}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* 占位符 (防止内容被 Header 遮挡) */}
            <div className="h-28" />

            {/* 设置面板 (绝对定位) */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-28 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-5 border border-slate-100 max-w-sm mx-auto"
                    >
                        {/* 中文设置 */}
                        <div className="mb-5 pb-5 border-b border-slate-50">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700">中文朗读</span>
                                    <Switch checked={settings.zhEnabled} onChange={v => setSettings(s => ({...s, zhEnabled: v}))} />
                                </div>
                                <select 
                                    value={settings.zhVoice}
                                    onChange={e => setSettings(s => ({...s, zhVoice: e.target.value}))}
                                    className="text-xs bg-slate-100 rounded px-2 py-1 outline-none border-none text-slate-600"
                                >
                                    <option value="zh-CN-YunxiaNeural">云夏 (男童)</option>
                                    <option value="zh-CN-XiaoyanNeural">晓晓 (女声)</option>
                                    <option value="zh-CN-YunxiNeural">云希 (男声)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">语速 {settings.zhRate}%</span>
                                <input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-500"/>
                            </div>
                        </div>

                        {/* 缅文设置 */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700">缅文朗读</span>
                                    <Switch checked={settings.myEnabled} onChange={v => setSettings(s => ({...s, myEnabled: v}))} />
                                </div>
                                <select 
                                    value={settings.myVoice}
                                    onChange={e => setSettings(s => ({...s, myVoice: e.target.value}))}
                                    className="text-xs bg-slate-100 rounded px-2 py-1 outline-none border-none text-slate-600"
                                >
                                    <option value="my-MM-ThihaNeural">Thiha (男声)</option>
                                    <option value="my-MM-NilarNeural">Nilar (女声)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">语速 {settings.myRate}%</span>
                                <input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-green-500"/>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 内容列表 */}
            <div className="px-4 pb-32 space-y-4 min-h-screen">
                {filteredPhrases.length === 0 && <div className="text-center text-slate-400 py-10">暂无内容</div>}
                
                {filteredPhrases.map((item, index) => {
                    const isLocked = !isUnlocked && index >= 3; // 第4条模糊
                    const showSubHeader = index === 0 || filteredPhrases[index-1].sub !== item.sub;

                    return (
                        <div key={item.id} id={`sub-${item.sub}`}>
                            {/* 小主题标题 */}
                            {showSubHeader && item.sub && (
                                <div className="mt-6 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                    <span className="text-sm font-black text-slate-700">{item.sub}</span>
                                </div>
                            )}

                            {/* 句子卡片 */}
                            <div 
                                onClick={() => isLocked ? setShowVip(true) : handlePlay(item)}
                                className={`
                                    relative bg-white p-5 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.99] transition-all cursor-pointer
                                    ${isLocked ? 'blur-[5px] select-none opacity-60' : ''}
                                    ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}
                                `}
                            >
                                {playingId === item.id && <div className="absolute right-4 top-4"><Loader2 size={16} className="animate-spin text-blue-500" /></div>}
                                <p className="text-[10px] text-slate-400 mb-1 font-mono">{item.pinyin}</p>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">{item.chinese}</h3>
                                <p className="text-sm text-blue-600 font-medium mb-3 font-burmese">{item.burmese}</p>
                                
                                <div className="flex justify-between items-center border-t border-slate-50 pt-2 mt-2">
                                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-100/50">{item.xieyin}</span>
                                    {playingId !== item.id && <Volume2 size={16} className="text-slate-300" />}
                                </div>

                                {isLocked && <div className="absolute inset-0 z-10 flex items-center justify-center"><Lock className="text-slate-400/50" size={32}/></div>}
                            </div>
                        </div>
                    );
                })}

                {/* 底部拦截 */}
                {!isUnlocked && (
                    <div className="py-8 text-center">
                        <button onClick={() => setShowVip(true)} className="bg-slate-900 text-white px-8 py-3 rounded-full text-sm font-bold shadow-xl animate-bounce">
                            解锁全部内容 (30,000 Ks)
                        </button>
                    </div>
                )}
            </div>

            {/* 回到顶部 */}
            <AnimatePresence>
                {showBackTop && (
                    <motion.button
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-8 right-6 w-12 h-12 bg-white/90 backdrop-blur shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-slate-600 z-30"
                    >
                        <ArrowUp size={20} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
      )}

      {/* VIP 弹窗 */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><Crown size={32} /></div>
                 <h3 className="text-xl font-black mb-2">解锁完整版</h3>
                 <p className="text-xs text-slate-500 mb-6">获取所有大主题、小主题及 10,000+ 对话的永久观看权限。</p>
                 <a href="https://m.me/61575187883357" className="block w-full py-3 bg-blue-600 text-white rounded-xl font-bold">联系老师激活</a>
                 <button onClick={() => setShowVip(false)} className="mt-4 text-xs text-slate-400">暂不激活</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .pt-safe-top { padding-top: max(16px, env(safe-area-inset-top)); }
        .font-burmese { font-family: 'Padauk', sans-serif; }
      `}</style>
    </div>
  );
}

// 简单的 Switch 组件
const Switch = ({ checked, onChange }) => (
    <button 
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-blue-500' : 'bg-slate-200'}`}
    >
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
);
