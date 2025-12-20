import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Mic, StopCircle, Volume2, Home, ArrowUp, 
  ChevronRight, Sparkles, CheckCircle2, X, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';
import { spokenBooks } from '@/data/spoken/meta';

// ============================================================================
// 1. 音频引擎 (修复连读、中断)
// ============================================================================
const AudioEngine = {
  current: null,
  play(text, voice, rate, onEnd) {
    if (typeof window === 'undefined') return;
    this.stop(); // 播放新音频前强制停止旧的
    
    // 语速转换 -30 => -30%
    const r = rate < 0 ? `${rate}%` : `+${rate}%`;
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    
    const audio = new Audio(url);
    this.current = audio;
    audio.onended = () => { this.current = null; if(onEnd) onEnd(); };
    audio.onerror = () => { this.current = null; if(onEnd) onEnd(); };
    audio.play().catch(() => { this.current = null; if(onEnd) onEnd(); });
  },
  stop() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }
};

// ============================================================================
// 2. 语音识别引擎
// ============================================================================
const SpeechEngine = {
  recognition: null,
  start(lang = 'zh-CN', onResult, onError) {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("当前浏览器不支持语音识别");
      onError();
      return;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = lang;
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    this.recognition.onerror = onError;
    this.recognition.onend = onError;
    this.recognition.start();
  },
  stop() {
    if (this.recognition) this.recognition.stop();
  }
};

// ============================================================================
// 3. 主组件
// ============================================================================
export default function SpokenModule() {
  // 视图状态
  const [view, setView] = useState('home'); // home | category | list
  const [book, setBook] = useState(null);
  const [category, setCategory] = useState(null); // 大主题
  const [phrases, setPhrases] = useState([]);
  
  // 设置状态 (默认值)
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  // 识别与拼读
  const [recordingId, setRecordingId] = useState(null);
  const [speechResult, setSpeechResult] = useState(null); // {id, text, score}
  const [spellingId, setSpellingId] = useState(null);

  // 交互
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  
  const lastScrollY = useRef(0);

  // 初始化
  useEffect(() => {
    // 权限
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    // 设置
    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    // 进度恢复
    const progress = JSON.parse(localStorage.getItem('spoken_progress'));
    if (progress?.bookId) {
       const targetBook = spokenBooks.find(b => b.id === progress.bookId);
       if (targetBook) {
          import(`@/data/spoken/${targetBook.file}.js`).then(mod => {
             setPhrases(mod.default);
             setBook(targetBook);
             if (progress.view === 'list' && progress.cat) {
                setCategory(progress.cat);
                setView('list');
                setTimeout(() => window.scrollTo(0, progress.scrollY || 0), 100);
             } else {
                setView('category');
             }
          }).catch(e => console.error("Restore failed", e));
       }
    }
  }, []);

  // 保存设置
  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // 滚动逻辑
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 400);
      if (y < lastScrollY.current || y < 50) setShowHeader(true);
      else if (y > lastScrollY.current && y > 100) setShowHeader(false);
      lastScrollY.current = y;
      
      if (view === 'list') {
        localStorage.setItem('spoken_progress', JSON.stringify({ 
          bookId: book?.id, view: 'list', cat: category, scrollY: y 
        }));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view, book, category]);

  // --- 业务方法 ---

  const handleBookClick = async (b) => {
    try {
      const mod = await import(`@/data/spoken/${b.file}.js`);
      setPhrases(mod.default);
      setBook(b);
      setView('category');
      window.scrollTo(0, 0);
    } catch(e) { alert("该课程暂未上线"); }
  };

  const handlePlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    
    const sequence = async () => {
      if (settings.zhEnabled) {
        await new Promise(resolve => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, resolve));
      }
      if (AudioEngine.current?.paused && !settings.zhEnabled) {} // 如果被暂停则不继续，除非中文未开启
      else if (settings.zhEnabled && AudioEngine.current === null) {} // 正常结束

      if (settings.myEnabled) {
        // 如果中文开启了，稍微停顿一下
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
        await new Promise(resolve => AudioEngine.play(item.burmese, settings.myVoice, settings.myRate, resolve));
      }
      setPlayingId(null);
    };
    sequence();
  };

  const toggleRecord = (item) => {
    if (recordingId === item.id) {
      SpeechEngine.stop();
      setRecordingId(null);
    } else {
      setRecordingId(item.id);
      setSpeechResult(null);
      SpeechEngine.start('zh-CN', (text) => {
        // 简单评分: 包含50%字符即及格
        let hit = 0;
        const target = item.chinese.split('');
        target.forEach(char => { if(text.includes(char)) hit++; });
        const score = Math.floor((hit / target.length) * 100);
        setSpeechResult({ id: item.id, text, score: score > 100 ? 100 : score });
        setRecordingId(null);
      }, () => setRecordingId(null));
    }
  };

  // 数据筛选
  const listData = useMemo(() => {
    if (!category) return [];
    return phrases.filter(p => p.category === category);
  }, [phrases, category]);

  // 提取小主题
  const subCats = useMemo(() => {
    return Array.from(new Set(listData.map(p => p.sub).filter(Boolean)));
  }, [listData]);

  // 跳转锚点
  const scrollToSub = (sub) => {
    const el = document.getElementById(`sub-${sub}`);
    if(el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl">
      
      {/* 886.best 悬浮链接 (所有页面) */}
      <a href="https://886.best" className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-2 shadow-lg border border-white/10 active:scale-95 transition-transform">
        <Home size={12}/> 886.best
      </a>

      {/* =================================================================
          VIEW 1: 主页 (背景图 + 小海报网格)
      ================================================================= */}
      {view === 'home' && (
        <div className="min-h-screen bg-[#F0F2F5]">
           {/* 顶部面板背景 */}
           <div className="relative h-72 rounded-b-[3rem] overflow-hidden shadow-xl z-0">
              <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-75" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              <div className="absolute bottom-10 left-8">
                 <h1 className="text-3xl font-black text-white mb-2">口语特训</h1>
                 <p className="text-white/80 text-sm font-medium bg-black/30 px-3 py-1 rounded-lg inline-block backdrop-blur-sm">
                    {spokenBooks.length} 套精选课程 · 持续更新
                 </p>
              </div>
           </div>

           {/* 书籍网格 (小海报) */}
           <div className="px-6 -mt-12 relative z-10 grid grid-cols-2 gap-5 pb-20">
              {spokenBooks.map(b => (
                <motion.div 
                  key={b.id} whileTap={{ scale: 0.95 }} onClick={() => handleBookClick(b)}
                  className="bg-white rounded-2xl p-3 shadow-lg flex flex-col items-center border border-slate-100 cursor-pointer"
                >
                  <div className="w-full aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-md relative">
                     <img src={b.image} className="w-full h-full object-cover" />
                     <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        {b.tag}
                     </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 text-center leading-tight mb-1">{b.title}</h3>
                  <p className="text-[10px] text-slate-400">{b.categories?.length || 0} 个大类</p>
                </motion.div>
              ))}
           </div>
        </div>
      )}

      {/* =================================================================
          VIEW 2: 分类页 (大主题)
      ================================================================= */}
      {view === 'category' && book && (
        <div className="min-h-screen bg-white">
           <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 h-14 flex items-center justify-between">
             <button onClick={() => setView('home')} className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-full"><ChevronLeft/></button>
             <span className="font-bold text-slate-800">{book.title}</span>
             <div className="w-8"/>
           </div>
           
           <div className="p-5">
             <div className="mb-6">
                <h2 className="text-xl font-black text-slate-800">选择学习主题</h2>
                <p className="text-xs text-slate-400 mt-1">Select a topic to start</p>
             </div>
             
             <div className="grid gap-3">
                {book.categories?.map((cat, i) => (
                  <motion.div 
                    key={i} initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} transition={{delay: i*0.05}}
                    onClick={() => { setCategory(cat.name); setView('list'); window.scrollTo(0,0); }}
                    className="group bg-slate-50 hover:bg-blue-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div>
                       <h3 className="font-bold text-slate-700 group-hover:text-blue-700">{cat.name}</h3>
                       <p className="text-xs text-slate-400 mt-1 group-hover:text-blue-400">{cat.desc}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400" />
                  </motion.div>
                ))}
             </div>
           </div>
        </div>
      )}

      {/* =================================================================
          VIEW 3: 列表页 (对话 + 设置)
      ================================================================= */}
      {view === 'list' && (
        <div className="min-h-screen bg-[#F5F7FA]">
           
           {/* 顶部控制栏 (滚动隐显) */}
           <motion.div 
             initial={{ y: 0 }} animate={{ y: showHeader ? 0 : -120 }} transition={{ type: 'tween' }}
             className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm max-w-md mx-auto"
           >
             {/* Nav Row */}
             <div className="h-14 px-4 flex items-center justify-between border-b border-slate-50">
               <button onClick={() => setView('category')} className="p-2 -ml-2 text-slate-600"><ChevronLeft/></button>
               <span className="font-bold text-slate-800 text-sm">{category}</span>
               <button 
                 onClick={() => setShowSettings(!showSettings)} 
                 className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
               >
                 <Settings2 size={18}/>
               </button>
             </div>
             
             {/* Sub-category Filter */}
             <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-white">
               {subCats.map(sub => (
                 <button key={sub} onClick={() => scrollToSub(sub)} className="flex-shrink-0 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold active:bg-blue-600 active:text-white active:border-blue-600 transition-colors">
                   {sub}
                 </button>
               ))}
             </div>
           </motion.div>

           {/* --- 设置面板 (重设计：高对比度) --- */}
           <AnimatePresence>
             {showSettings && (
               <motion.div 
                 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                 className="fixed top-28 left-4 right-4 z-[50] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-sm mx-auto"
               >
                 <div className="p-5 space-y-6">
                    {/* 中文区块 */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                       <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-blue-500"></span> 中文设置
                          </span>
                          <button onClick={() => setSettings(s => ({...s, zhEnabled: !s.zhEnabled}))} className={`text-[10px] px-2 py-1 rounded font-bold ${settings.zhEnabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                             {settings.zhEnabled ? '开启中' : '已关闭'}
                          </button>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                             {l:'男童', v:'zh-CN-YunxiaNeural'},
                             {l:'女声', v:'zh-CN-XiaoyanNeural'},
                             {l:'男声', v:'zh-CN-YunxiNeural'}
                          ].map(opt => (
                             <button 
                               key={opt.v} 
                               onClick={() => setSettings(s => ({...s, zhVoice: opt.v}))}
                               className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${settings.zhVoice === opt.v ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                             >
                               {opt.l}
                             </button>
                          ))}
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-8">语速</span>
                          <input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600"/>
                          <span className="text-[10px] text-blue-600 font-mono w-6 text-right">{settings.zhRate}</span>
                       </div>
                    </div>

                    {/* 缅文区块 */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                       <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-green-500"></span> 缅文设置
                          </span>
                          <button onClick={() => setSettings(s => ({...s, myEnabled: !s.myEnabled}))} className={`text-[10px] px-2 py-1 rounded font-bold ${settings.myEnabled ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                             {settings.myEnabled ? '开启中' : '已关闭'}
                          </button>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-2 mb-3">
                          {[
                             {l:'男声 (Thiha)', v:'my-MM-ThihaNeural'},
                             {l:'女声 (Nilar)', v:'my-MM-NilarNeural'}
                          ].map(opt => (
                             <button 
                               key={opt.v} 
                               onClick={() => setSettings(s => ({...s, myVoice: opt.v}))}
                               className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${settings.myVoice === opt.v ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                             >
                               {opt.l}
                             </button>
                          ))}
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-8">语速</span>
                          <input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-green-600"/>
                          <span className="text-[10px] text-green-600 font-mono w-6 text-right">{settings.myRate}</span>
                       </div>
                    </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* 列表内容 */}
           <div className="pt-28 pb-32 px-4 space-y-6" ref={listRef}>
             {listData.map((item, index) => {
               const isLocked = !isUnlocked && index >= 3;
               const showSubHeader = index === 0 || listData[index-1].sub !== item.sub;

               return (
                 <div key={item.id} id={`sub-${item.sub}`}>
                   {showSubHeader && (
                     <div className="mt-8 mb-4 flex items-center gap-2">
                       <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                       <span className="text-sm font-black text-slate-700">{item.sub}</span>
                     </div>
                   )}

                   <motion.div 
                     whileTap={{ scale: 0.98 }}
                     onClick={() => isLocked ? setShowVip(true) : handlePlay(item)}
                     className={`
                       relative bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-center transition-all cursor-pointer
                       ${isLocked ? 'blur-[4px] select-none opacity-60' : ''}
                       ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}
                     `}
                   >
                     {/* 拼读演示 (自动拼音) */}
                     {spellingId === item.id ? (
                        <div className="mb-2 animate-in fade-in">
                           <div className="flex justify-center gap-1">
                              {item.chinese.split('').map((char, i) => (
                                 <div key={i} className="flex flex-col items-center">
                                    <span className="text-[10px] text-orange-500 font-mono">{pinyin(char, {toneType:'symbol'})}</span>
                                    <span className="text-lg font-bold text-slate-800">{char}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     ) : (
                        <div className="text-[10px] text-slate-400 font-mono mb-1">{pinyin(item.chinese, { toneType: 'symbol' })}</div>
                     )}

                     <h3 className="text-xl font-black text-slate-800 mb-2">{item.chinese}</h3>
                     <p className="text-sm text-blue-600 font-medium mb-3">{item.burmese}</p>
                     
                     <div className="flex justify-between items-center border-t border-slate-50 pt-2 mt-2">
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">{item.xieyin}</span>
                        <div className="flex gap-4">
                           {/* 拼读按钮 */}
                           <button onClick={(e) => {e.stopPropagation(); setSpellingId(spellingId === item.id ? null : item.id)}} className={`active:scale-90 ${spellingId === item.id ? 'text-orange-500' : 'text-slate-300'}`}>
                              <Sparkles size={16}/>
                           </button>
                           {/* 录音按钮 */}
                           <button onClick={(e) => {e.stopPropagation(); toggleRecord(item)}} className={`active:scale-90 ${recordingId === item.id ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                              {recordingId === item.id ? <StopCircle size={16}/> : <Mic size={16}/>}
                           </button>
                           {/* 播放状态 */}
                           {playingId === item.id ? <Loader2 className="text-blue-600 animate-spin" size={16}/> : <Volume2 className="text-slate-300" size={16}/>}
                        </div>
                     </div>

                     {/* 识别结果 */}
                     {speechResult?.id === item.id && (
                        <div className="mt-2 bg-slate-50 p-2 rounded text-xs flex justify-between items-center text-slate-500">
                           <span className="truncate max-w-[150px]">你: {speechResult.text}</span>
                           <span className={`font-bold ${speechResult.score >= 60 ? 'text-green-600' : 'text-orange-500'}`}>{speechResult.score}分</span>
                        </div>
                     )}

                     {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/10">
                           <Lock className="text-slate-500" size={32}/>
                        </div>
                     )}
                   </motion.div>
                 </div>
               )
             })}

             {/* 底部拦截 */}
             {!isUnlocked && (
               <div className="py-10 text-center">
                 <button onClick={() => setShowVip(true)} className="bg-slate-900 text-white px-8 py-3 rounded-full text-sm font-bold shadow-xl animate-bounce">
                   解锁全部内容
                 </button>
               </div>
             )}
           </div>

           {/* 回到顶部 */}
           <AnimatePresence>
             {showBackTop && (
               <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                 onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                 className="fixed bottom-8 right-6 w-10 h-10 bg-white shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-slate-500 z-40"
               >
                 <ArrowUp size={20}/>
               </motion.button>
             )}
           </AnimatePresence>
        </div>
      )}

      {/* VIP 弹窗 */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2"><X size={18} className="text-slate-400"/></button>
                 <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><Crown size={32} /></div>
                 <h3 className="text-xl font-black mb-2">解锁完整版</h3>
                 <p className="text-xs text-slate-500 mb-6">获取所有大主题、小主题及 10,000+ 对话的永久观看权限。</p>
                 <a href="https://m.me/61575187883357" className="block w-full py-3 bg-blue-600 text-white rounded-xl font-bold">联系老师激活</a>
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
