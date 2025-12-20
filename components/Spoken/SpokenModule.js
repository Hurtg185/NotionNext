import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Mic, StopCircle, Volume2, Home, ArrowUp, 
  ChevronRight, Sparkles, CheckCircle2, X 
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { pinyin } from 'pinyin-pro';
// 确保这两个数据文件路径正确
import { spokenBooks } from '@/data/spoken/meta';

// ============================================================================
// 1. 内置工具：音频播放 (解决 SSR 报错 & 队列控制)
// ============================================================================
const AudioEngine = {
  current: null,
  play(text, voice, rate, onEnd) {
    if (typeof window === 'undefined') return;
    if (this.current) { this.current.pause(); this.current = null; }
    
    // 语速转换 -30 -> -30%
    const r = rate < 0 ? `${rate}%` : `+${rate}%`;
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    
    const audio = new Audio(url);
    this.current = audio;
    audio.onended = onEnd;
    audio.onerror = onEnd;
    audio.play().catch(() => onEnd());
  },
  stop() {
    if (this.current) { this.current.pause(); this.current = null; }
  }
};

// ============================================================================
// 2. 内置工具：语音识别 (Web Speech API)
// ============================================================================
const SpeechEngine = {
  recognition: null,
  start(lang = 'zh-CN', onResult, onError) {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音识别，请使用 Chrome 或 Safari");
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
    this.recognition.onerror = (e) => {
      console.error(e);
      onError();
    };
    this.recognition.onend = onError; // 结束也视为一种停止状态
    this.recognition.start();
  },
  stop() {
    if (this.recognition) this.recognition.stop();
  }
};

// 简单的相似度打分 (0-100)
const calculateScore = (target, input) => {
  if (!input) return 0;
  // 去除标点
  const t = target.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
  const i = input.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
  if (t === i) return 100;
  if (t.includes(i) || i.includes(t)) return 80;
  return 60; // 只要有识别结果就算及格，鼓励为主
};

// ============================================================================
// 3. 主组件
// ============================================================================
export default function SpokenModule() {
  // --- 状态管理 ---
  const [view, setView] = useState('home'); // home | category | list
  const [book, setBook] = useState(null);
  const [category, setCategory] = useState(null); // 大主题
  const [phrases, setPhrases] = useState([]);
  
  // 播放与设置
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [playingId, setPlayingId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // 语音识别状态
  const [recordingId, setRecordingId] = useState(null);
  const [speechResult, setSpeechResult] = useState(null); // { id, text, score }

  // UI 交互
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  
  const listRef = useRef(null);
  const lastScrollY = useRef(0);

  // --- 初始化 ---
  useEffect(() => {
    // 1. 权限检查
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    // 你的激活码如果有效，user.unlocked_levels 里应该包含 'SP'
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));

    // 2. 恢复设置
    const saved = localStorage.getItem('spoken_settings');
    if (saved) setSettings(JSON.parse(saved));

    // 3. 恢复进度
    const progress = JSON.parse(localStorage.getItem('spoken_progress'));
    if (progress?.bookId) {
       const targetBook = spokenBooks.find(b => b.id === progress.bookId);
       if (targetBook) {
          loadData(targetBook).then(() => {
             setBook(targetBook);
             if (progress.view === 'list' && progress.cat) {
                setCategory(progress.cat);
                setView('list');
                setTimeout(() => window.scrollTo(0, progress.scrollY || 0), 100);
             } else {
                setView('category');
             }
          });
       }
    }
  }, []);

  // 监听设置变化保存
  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // 监听滚动 (Header 自动隐显)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 300);
      // 下拉(y变小)显示，上滑(y变大)隐藏
      if (y < lastScrollY.current - 10 || y < 50) setShowHeader(true);
      else if (y > lastScrollY.current + 10 && y > 50) setShowHeader(false);
      lastScrollY.current = y;
      
      // 保存进度
      if (view === 'list') {
        localStorage.setItem('spoken_progress', JSON.stringify({ 
          bookId: book?.id, view: 'list', cat: category, scrollY: y 
        }));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view, book, category]);

  // --- 业务逻辑 ---

  const loadData = async (targetBook) => {
    try {
      const mod = await import(`@/data/spoken/${targetBook.file}.js`);
      setPhrases(mod.default);
    } catch(e) { console.error("Data load error", e); }
  };

  const handleBookClick = async (b) => {
    await loadData(b);
    setBook(b);
    setView('category');
    window.scrollTo(0, 0);
  };

  const handleCatClick = (catName) => {
    setCategory(catName);
    setView('list');
    window.scrollTo(0, 0);
  };

  const handlePlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    
    const sequence = async () => {
      if (settings.zhEnabled) {
        await new Promise(resolve => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, resolve));
      }
      if (AudioEngine.current?.paused) return; // 被打断
      
      if (settings.myEnabled) {
        await new Promise(r => setTimeout(r, 400));
        await new Promise(resolve => AudioEngine.play(item.burmese, settings.myVoice, settings.myRate, resolve));
      }
      setPlayingId(null);
    };
    sequence();
  };

  // 语音识别逻辑
  const toggleRecord = (item) => {
    if (recordingId === item.id) {
      // 停止
      SpeechEngine.stop();
      setRecordingId(null);
    } else {
      // 开始
      setRecordingId(item.id);
      setSpeechResult(null); // 清空旧结果
      SpeechEngine.start(
        'zh-CN',
        (transcript) => {
          const score = calculateScore(item.chinese, transcript);
          setSpeechResult({ id: item.id, text: transcript, score });
          setRecordingId(null);
        },
        () => setRecordingId(null)
      );
    }
  };

  // 数据筛选
  const listData = useMemo(() => {
    if (!category) return [];
    return phrases.filter(p => p.category === category);
  }, [phrases, category]);

  const subCategories = useMemo(() => {
    return Array.from(new Set(listData.map(p => p.sub).filter(Boolean)));
  }, [listData]);

  // 跳转锚点
  const scrollToSub = (sub) => {
    const el = document.getElementById(`sub-${sub}`);
    if(el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // --- 渲染 ---
  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-slate-900 w-full relative">
      
      {/* 全局主页按钮 (悬浮) */}
      <a href="https://886.best" className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-2 shadow-lg border border-white/10 active:scale-95 transition-transform">
        <Home size={12}/> 886.best
      </a>

      {/* ================= 视图 A: 主页 (Home) ================= */}
      {view === 'home' && (
        <div className="min-h-screen relative flex flex-col">
           {/* 全屏背景 */}
           <div className="fixed inset-0 z-0">
             <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" className="w-full h-full object-cover brightness-[0.6]" />
           </div>
           
           <div className="relative z-10 pt-32 px-6">
             <h1 className="text-4xl font-black text-white mb-2 tracking-tight">口语特训</h1>
             <p className="text-white/80 text-sm font-medium mb-12">Select Course</p>
             
             <div className="space-y-4 pb-20">
               {spokenBooks.map(b => (
                 <motion.div 
                   key={b.id} whileTap={{ scale: 0.98 }} onClick={() => handleBookClick(b)}
                   className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl cursor-pointer flex items-center justify-between group"
                 >
                   <div>
                     <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{b.title}</h3>
                     <p className="text-xs text-slate-500">{b.categories?.length || 0} 个大主题</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                     <ChevronRight size={20}/>
                   </div>
                 </motion.div>
               ))}
             </div>
           </div>
        </div>
      )}

      {/* ================= 视图 B: 分类页 (Category) ================= */}
      {view === 'category' && book && (
        <div className="min-h-screen bg-white">
           <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100 px-4 h-14 flex items-center justify-between">
             <button onClick={() => setView('home')} className="p-2 -ml-2 text-slate-600"><ChevronLeft/></button>
             <span className="font-bold text-slate-800">{book.title}</span>
             <div className="w-8"/>
           </div>
           <div className="p-6 grid gap-4">
             {book.categories?.map((cat, i) => (
               <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                 onClick={() => handleCatClick(cat.name)}
                 className="p-5 rounded-2xl bg-slate-50 border border-slate-100 active:bg-blue-50 active:border-blue-200 cursor-pointer"
               >
                 <div className="flex justify-between items-center">
                   <h3 className="text-lg font-bold text-slate-800">{cat.name}</h3>
                   <ArrowUp className="rotate-90 text-slate-300" size={16}/>
                 </div>
                 <p className="text-xs text-slate-400 mt-1">{cat.desc}</p>
               </motion.div>
             ))}
           </div>
        </div>
      )}

      {/* ================= 视图 C: 列表页 (List) - 全屏 ================= */}
      {view === 'list' && (
        <div className="min-h-screen bg-[#F5F7FA] fixed inset-0 z-[100] overflow-y-auto no-scrollbar" ref={listRef}>
           
           {/* 顶部悬浮面板 (窄, 自动隐显) */}
           <motion.div 
             initial={{ y: 0 }} animate={{ y: showHeader ? 0 : -100 }} transition={{ type: 'tween' }}
             className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm max-w-md mx-auto"
           >
             <div className="h-12 px-4 flex items-center justify-between">
               <button onClick={() => setView('category')} className="p-2 -ml-2 text-slate-600"><ChevronLeft size={22}/></button>
               <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{category}</span>
               <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}><Settings2 size={20}/></button>
             </div>
             {/* 细分选择 (横向滚动) */}
             <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
               {subCategories.map(sub => (
                 <button key={sub} onClick={() => scrollToSub(sub)} className="flex-shrink-0 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold active:bg-blue-600 active:text-white transition-colors">{sub}</button>
               ))}
             </div>
           </motion.div>

           {/* 设置面板 (绝对定位) */}
           <AnimatePresence>
             {showSettings && (
               <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="fixed top-20 left-4 right-4 z-[60] bg-white rounded-2xl shadow-2xl p-5 border border-slate-100 max-w-sm mx-auto">
                 {/* 中文设置 */}
                 <div className="mb-4 pb-4 border-b border-slate-50">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-blue-600">中文设置</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input type="checkbox" className="sr-only peer" checked={settings.zhEnabled} onChange={e => setSettings(s => ({...s, zhEnabled: e.target.checked}))} />
                       <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                     </label>
                   </div>
                   <div className="flex gap-2 mb-2">
                     {[{n:'云夏',v:'zh-CN-YunxiaNeural'},{n:'晓晓',v:'zh-CN-XiaoxiaoNeural'},{n:'云希',v:'zh-CN-YunxiNeural'}].map(opt => (
                       <button key={opt.v} onClick={() => setSettings(s => ({...s, zhVoice: opt.v}))} className={`flex-1 py-1 text-[10px] font-bold rounded ${settings.zhVoice === opt.v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{opt.n}</button>
                     ))}
                   </div>
                   <input type="range" min="-50" max="50" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-blue-600"/>
                 </div>
                 {/* 缅文设置 */}
                 <div>
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-green-600">缅文设置</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input type="checkbox" className="sr-only peer" checked={settings.myEnabled} onChange={e => setSettings(s => ({...s, myEnabled: e.target.checked}))} />
                       <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                     </label>
                   </div>
                   <div className="flex gap-2 mb-2">
                     {[{n:'Thiha',v:'my-MM-ThihaNeural'},{n:'Nilar',v:'my-MM-NilarNeural'}].map(opt => (
                       <button key={opt.v} onClick={() => setSettings(s => ({...s, myVoice: opt.v}))} className={`flex-1 py-1 text-[10px] font-bold rounded ${settings.myVoice === opt.v ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{opt.n}</button>
                     ))}
                   </div>
                   <input type="range" min="-50" max="50" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-green-600"/>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* 列表内容区 */}
           <div className="pt-24 pb-32 px-4 space-y-6">
             {listData.map((item, index) => {
               // 模糊逻辑：未解锁 && 第4条开始模糊
               const isLocked = !isUnlocked && index >= 3;
               const showSubHeader = index === 0 || listData[index-1].sub !== item.sub;

               return (
                 <div key={item.id} id={`sub-${item.sub}`}>
                   {/* 小主题标题 */}
                   {showSubHeader && (
                     <div className="flex items-center gap-2 mb-3 mt-6">
                       <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                       <span className="text-xs font-black text-slate-500">{item.sub}</span>
                     </div>
                   )}

                   <motion.div 
                     whileTap={{ scale: 0.99 }}
                     onClick={() => isLocked ? setShowVip(true) : handlePlay(item)}
                     className={`
                       relative bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-center transition-all cursor-pointer
                       ${isLocked ? 'blur-[4px] select-none opacity-60' : ''}
                       ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}
                     `}
                   >
                     {/* 拼音 (自动) */}
                     <div className="text-[10px] text-slate-400 font-mono mb-1">{pinyin(item.chinese, { toneType: 'symbol' })}</div>
                     {/* 中文 */}
                     <h3 className="text-xl font-black text-slate-800 mb-2">{item.chinese}</h3>
                     {/* 缅文 */}
                     <p className="text-sm text-blue-600 font-medium mb-3 font-burmese">{item.burmese}</p>
                     {/* 谐音 */}
                     <div className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded mb-3">{item.xieyin}</div>

                     {/* 功能栏 */}
                     <div className="flex justify-center gap-6 border-t border-slate-50 pt-3">
                       {/* 拼读图标 */}
                       <button onClick={(e) => {e.stopPropagation(); alert('拼读演示');}} className="text-orange-400 active:scale-90"><Sparkles size={18}/></button>
                       {/* 播放中 */}
                       <button className={`${playingId === item.id ? 'text-blue-600' : 'text-slate-300'}`}>
                         {playingId === item.id ? <Loader2 className="animate-spin" size={20}/> : <Volume2 size={20}/>}
                       </button>
                       {/* 语音识别 (录音) */}
                       <button onClick={(e) => {e.stopPropagation(); toggleRecord(item);}} className={`${recordingId === item.id ? 'text-red-500 animate-pulse' : 'text-slate-400'} active:scale-90`}>
                         {recordingId === item.id ? <StopCircle size={18}/> : <Mic size={18}/>}
                       </button>
                     </div>

                     {/* 识别结果展示 */}
                     {speechResult?.id === item.id && (
                       <div className="mt-3 bg-slate-50 p-2 rounded-lg text-xs flex justify-between items-center animate-in fade-in">
                         <span className="text-slate-500 truncate max-w-[150px]">你说: {speechResult.text}</span>
                         <span className={`font-bold ${speechResult.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>{speechResult.score}分</span>
                       </div>
                     )}

                     {/* 锁定遮罩 */}
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
                 <p className="text-xs text-slate-500 mb-6">该内容仅对 VIP 开放。</p>
                 <div className="bg-slate-50 p-3 rounded-xl mb-4 text-left space-y-2">
                    <p className="text-xs text-slate-500 flex gap-2"><CheckCircle2 size={14} className="text-green-500"/> 解锁 10,000+ 对话</p>
                    <p className="text-xs text-slate-500 flex gap-2"><CheckCircle2 size={14} className="text-green-500"/> 开启语音评测</p>
                 </div>
                 <a href="https://m.me/61575187883357" className="block w-full py-3 bg-blue-600 text-white rounded-xl font-bold">联系老师激活</a>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .font-burmese { font-family: 'Padauk', sans-serif; }
      `}</style>
    </div>
  );
}
