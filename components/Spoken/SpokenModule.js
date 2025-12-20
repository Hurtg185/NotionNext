import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Mic, Heart, RotateCcw, Volume2, Home, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { spokenBooks } from '@/data/spoken/structure';

// --- 全局音频管理器 (防 SSR 报错) ---
const playTTS = (text, lang = 'zh', rate = 0, gender = 'female', onEnd) => {
  if (typeof window === 'undefined') return;
  
  // 停止之前的
  if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
  }

  // 这里的 Voice 只是示例，实际取决于你的 TTS 接口支持的参数
  const voice = lang === 'my' ? 'my-MM-ThihaNeural' : (gender === 'male' ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyanNeural');
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
  
  const audio = new Audio(url);
  window.currentAudio = audio;
  audio.onended = onEnd;
  audio.onerror = onEnd; // 出错也重置状态
  audio.play().catch(e => console.log("Play error:", e));
};

export default function SpokenModule() {
  // 视图状态
  const [view, setView] = useState('category'); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  
  // 播放与设置状态
  const [playingId, setPlayingId] = useState(null);
  const [settings, setSettings] = useState({ zh: true, my: true, speed: -0.2, voice: 'female' });
  const [showSettings, setShowSettings] = useState(false);
  
  // 交互状态
  const [recordingId, setRecordingId] = useState(null); // 正在录音的ID
  const [favorites, setFavorites] = useState([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [expandedTags, setExpandedTags] = useState({}); // 首页标签展开状态

  // Refs
  const categoryRefs = useRef({});

  // 1. 初始化
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    setFavorites(JSON.parse(localStorage.getItem('spoken_favs') || '[]'));
  }, []);

  // 2. 打开书籍逻辑
  const openBook = async (book, targetCategory = null) => {
    try {
      const data = await import(`@/data/spoken/${book.file}.js`);
      setPhrases(data.default);
      setSelectedBook(book);
      setView('list');
      
      // 如果指定了分类，延迟跳转
      if (targetCategory) {
        setTimeout(() => {
            const el = categoryRefs.current[targetCategory];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (e) { alert("数据加载中..."); }
  };

  // 3. 智能连播逻辑
  const handlePlay = async (item) => {
    if (playingId === item.id) {
        if (window.currentAudio) window.currentAudio.pause();
        setPlayingId(null);
        return;
    }

    setPlayingId(item.id);

    // 播放序列
    const playSequence = async () => {
        if (settings.zh) {
            await new Promise(resolve => playTTS(item.chinese, 'zh', settings.speed, settings.voice, resolve));
        }
        if (playingId !== item.id) return; // 如果中途被切断
        
        if (settings.my) {
            // 稍微停顿
            await new Promise(r => setTimeout(r, 300));
            await new Promise(resolve => playTTS(item.burmese, 'my', settings.speed, 'male', resolve));
        }
        setPlayingId(null);
    };

    playSequence();
  };

  // 4. 收藏逻辑
  const toggleFav = (id) => {
      const newFavs = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
      setFavorites(newFavs);
      localStorage.setItem('spoken_favs', JSON.stringify(newFavs));
  };

  // 5. 模拟语音评测 (调用浏览器 Web Speech API)
  const startRecord = (item) => {
      setRecordingId(item.id);
      // 模拟录音 2 秒后评分 (真实环境需接 API)
      setTimeout(() => {
          alert(`评测结果：95分！\n你的发音非常标准：${item.chinese}`);
          setRecordingId(null);
      }, 2000);
  };

  // 6. 提取数据中的大主题 (用于导航)
  const categories = useMemo(() => {
      return Array.from(new Set(phrases.map(p => p.category).filter(Boolean)));
  }, [phrases]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative overflow-hidden">
      
      {/* ================= 视图 A: 聚合首页 ================= */}
      <div className={`${view === 'category' ? 'block' : 'hidden'} pb-24`}>
        {/* 顶部动态主页胶囊 */}
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
             <a href="https://886.best" target="_blank" className="pointer-events-auto bg-black/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-top-4">
                 <Home size={12} /> 886.best
             </a>
        </div>

        <div className="pt-20 px-6">
            <h1 className="text-3xl font-black text-slate-900 mb-2">口语特训</h1>
            <p className="text-sm text-slate-500 mb-8">精选场景会话 · 10,000+ 词条</p>
        </div>

        <div className="space-y-8 px-5">
           {spokenBooks.map((book) => {
               const isExpanded = expandedTags[book.id];
               const visibleCats = isExpanded ? book.categories : book.categories.slice(0, 6); // 默认显示6个

               return (
                   <div key={book.id} className="bg-white rounded-[2rem] p-5 shadow-xl shadow-slate-200/50 border border-white">
                       {/* 书籍头部 */}
                       <div onClick={() => openBook(book)} className="flex gap-4 mb-6 cursor-pointer group">
                           <div className="w-20 h-28 rounded-2xl overflow-hidden shadow-lg shrink-0">
                               <img src={book.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                           </div>
                           <div className="flex-1 py-1">
                               <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md mb-2 inline-block">{book.tag}</span>
                               <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">{book.title}</h3>
                               <p className="text-xs text-slate-400 line-clamp-2">{book.desc}</p>
                           </div>
                       </div>
                       
                       {/* 标签云 (可折叠) */}
                       <div className="flex flex-wrap gap-2">
                           {visibleCats.map((cat, i) => (
                               <button 
                                   key={cat}
                                   onClick={() => openBook(book, cat)}
                                   className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100 active:bg-blue-600 active:text-white transition-colors"
                               >
                                   {cat}
                               </button>
                           ))}
                           {book.categories.length > 6 && (
                               <button 
                                   onClick={() => setExpandedTags(p => ({...p, [book.id]: !isExpanded}))}
                                   className="px-3 py-1.5 text-blue-500 text-xs font-bold"
                               >
                                   {isExpanded ? "收起" : "更多..."}
                               </button>
                           )}
                       </div>
                   </div>
               )
           })}
        </div>
      </div>

      {/* ================= 视图 B: 沉浸式列表页 ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-0 z-[999] bg-[#F5F7FA] flex flex-col w-full h-full max-w-md mx-auto"
          >
            {/* 1. 顶部 Parallax Header */}
            <div className="relative h-48 flex-none overflow-hidden">
                <img src={selectedBook?.image} className="absolute inset-0 w-full h-full object-cover opacity-90 blur-[2px] scale-110" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#F5F7FA]" />
                
                {/* 导航栏 */}
                <div className="absolute top-0 left-0 right-0 pt-safe-top p-4 flex justify-between items-center z-20 text-white">
                    <button onClick={() => setView('category')} className="w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center active:scale-90"><ChevronLeft size={20}/></button>
                    <a href="https://886.best" className="text-xs font-bold opacity-80 bg-black/30 px-3 py-1 rounded-full">886.best</a>
                    <button onClick={() => setShowSettings(!showSettings)} className="w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center active:bg-white active:text-slate-900"><Settings2 size={18}/></button>
                </div>

                <div className="absolute bottom-4 left-6 z-10">
                    <h2 className="text-2xl font-black text-white shadow-sm">{selectedBook?.title}</h2>
                    <p className="text-white/70 text-xs mt-1">当前播放模式：{settings.zh ? '中' : ''}{settings.my ? '+缅' : ''} | 语速 {settings.speed}</p>
                </div>
            </div>

            {/* 2. 设置面板 (折叠式) */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border-b overflow-hidden">
                        <div className="p-5 grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400">朗读语言</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setSettings(s => ({...s, zh: !s.zh}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${settings.zh ? 'bg-blue-500 text-white border-blue-500' : 'text-slate-500 border-slate-200'}`}>中文</button>
                                    <button onClick={() => setSettings(s => ({...s, my: !s.my}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${settings.my ? 'bg-green-500 text-white border-green-500' : 'text-slate-500 border-slate-200'}`}>缅文</button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400">发音人</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setSettings(s => ({...s, voice: 'female'}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${settings.voice === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'text-slate-500 border-slate-200'}`}>女声</button>
                                    <button onClick={() => setSettings(s => ({...s, voice: 'male'}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${settings.voice === 'male' ? 'bg-indigo-500 text-white border-indigo-500' : 'text-slate-500 border-slate-200'}`}>男声</button>
                                </div>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-500"><span>语速</span><span>{settings.speed}</span></div>
                                <input type="range" min="-0.5" max="0.5" step="0.1" value={settings.speed} onChange={e => setSettings(s => ({...s, speed: parseFloat(e.target.value)}))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-blue-600" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. 悬浮分类导航 */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-30 px-2 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                    <button 
                        key={cat} 
                        onClick={() => {
                            const el = categoryRefs.current[cat];
                            if(el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
                        }}
                        className="flex-shrink-0 px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-600 shadow-sm active:bg-slate-900 active:text-white transition-colors"
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* 4. 核心内容流 */}
            <div 
              className="flex-1 overflow-y-auto p-4 pb-32 space-y-6"
              onScroll={(e) => {
                  if (!isUnlocked && e.target.scrollTop > 500) setShowVip(true);
              }}
            >
              {phrases.map((item, index) => {
                // 权限控制：前 3 条清晰，后面模糊
                const isLocked = !isUnlocked && index >= 3;
                const isHeader = index === 0 || phrases[index-1].category !== item.category || phrases[index-1].sub !== item.sub;
                const isBigHeader = index === 0 || phrases[index-1].category !== item.category;

                return (
                  <div key={item.id} ref={el => { if(isBigHeader) categoryRefs.current[item.category] = el }}>
                    {/* 大主题标题 */}
                    {isBigHeader && (
                        <div className="mt-8 mb-4 flex items-center gap-3">
                            <span className="text-lg font-black text-slate-800">{item.category}</span>
                            <div className="h-[1px] bg-slate-200 flex-1"></div>
                        </div>
                    )}
                    
                    {/* 小主题标题 (Sub-category) */}
                    {isHeader && item.sub && (
                        <div className="mb-3 pl-2 text-xs font-bold text-blue-500 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> {item.sub}
                        </div>
                    )}

                    {/* 对话卡片 (居中布局) */}
                    <div 
                       onClick={() => isLocked ? setShowVip(true) : null}
                       className={`
                          relative bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all text-center
                          ${isLocked ? 'blur-[5px] opacity-60 select-none' : ''}
                          ${playingId === item.id ? 'ring-2 ring-blue-500 shadow-blue-100' : ''}
                       `}
                    >
                       {/* 顶部拼音 */}
                       <p className="text-xs text-slate-400 font-mono mb-2">{item.pinyin}</p>
                       
                       {/* 中文大字 */}
                       <h3 className="text-2xl font-black text-slate-800 mb-4 leading-relaxed">{item.chinese}</h3>
                       
                       {/* 缅文 (蓝色强调) */}
                       <p className="text-lg text-blue-600 font-medium mb-4 leading-relaxed">{item.burmese}</p>

                       {/* 底部工具栏 */}
                       <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-50">
                           {/* 播放按钮 */}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handlePlay(item); }}
                             className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center active:scale-90"
                           >
                              {playingId === item.id ? <Loader2 className="animate-spin" size={20}/> : <Volume2 size={20}/>}
                           </button>

                           {/* 语音评测 */}
                           <button 
                              onClick={(e) => { e.stopPropagation(); startRecord(item); }}
                              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-500'}`}
                           >
                              <Mic size={20}/>
                           </button>

                           {/* 收藏 */}
                           <button 
                              onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}
                              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300'}`}
                           >
                              <Heart size={20} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                           </button>
                       </div>
                       
                       {/* 谐音助记 (胶囊) */}
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-100 text-amber-700 px-3 py-0.5 rounded-full text-[10px] font-bold border-2 border-white shadow-sm">
                           {item.xieyin}
                       </div>

                       {/* 锁定遮罩 */}
                       {isLocked && (
                           <div className="absolute inset-0 flex items-center justify-center z-10">
                               <Lock className="text-slate-400/50" size={40} />
                           </div>
                       )}
                    </div>
                  </div>
                )
              })}
              
              {/* 模糊区域的诱导文案 */}
              {isUnlocked ? (
                  <div className="text-center text-slate-300 py-10 text-xs">已经到底啦 ~</div>
              ) : (
                  <div className="py-10 text-center">
                      <p className="text-sm font-bold text-slate-400 mb-4">想看更多内容？</p>
                      <button onClick={() => setShowVip(true)} className="bg-slate-900 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-bounce">
                          点击解锁全部
                      </button>
                  </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= 视图 C: VIP 弹窗 ================= */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400"><X size={16}/></button>
                 <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg">
                     <Crown size={32} fill="currentColor" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 mb-2">解锁完整课程</h3>
                 <ul className="text-left text-xs text-slate-500 space-y-2 mb-8 bg-slate-50 p-4 rounded-xl">
                     <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-500"/> 解锁 10,000+ 完整句子</li>
                     <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-500"/> 开启标签一键跳转</li>
                     <li className="flex gap-2"><CheckCircle2 size={14} className="text-green-500"/> 使用语音评测功能</li>
                 </ul>
                 <a href="https://m.me/61575187883357" className="block w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform">
                     联系老师激活 (30,000 Ks)
                 </a>
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
