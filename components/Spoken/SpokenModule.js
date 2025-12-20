import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Mic, Heart, RotateCcw, Volume2, Home, CheckCircle2,
  X, StopCircle, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { spokenBooks } from '@/data/spoken/structure';
import { startSpeechRecognition, createRecorder } from '@/utils/speech'; // 假设你放到了 utils

// --- 全局音频管理器 (CF TTS) ---
const playTTS = (text, lang = 'zh', rate = 0, gender = 'female', onEnd) => {
  if (typeof window === 'undefined') return;
  if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
  }

  // 这里的 Voice 映射到你的 CF Worker 支持的参数
  // 假设你的 /api/tts?t=...&v=...&r=... 已经对接好微软 TTS
  const voice = lang === 'my' ? 'my-MM-ThihaNeural' : (gender === 'male' ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyanNeural');
  // 你的 CF 缓存地址
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
  
  const audio = new Audio(url);
  window.currentAudio = audio;
  audio.onended = onEnd;
  audio.onerror = onEnd;
  audio.play().catch(e => console.log("Play error:", e));
};

export default function SpokenModule() {
  const [view, setView] = useState('category'); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  
  // 播放状态
  const [playingId, setPlayingId] = useState(null);
  
  // 设置状态
  const [settings, setSettings] = useState({ zh: true, my: true, speed: 0, voice: 'female' });
  const [showSettings, setShowSettings] = useState(false);
  
  // 录音评测状态
  const [recordingId, setRecordingId] = useState(null); // 正在录音的 Item ID
  const [recordResult, setRecordResult] = useState(null); // { id, score, audioUrl }
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);

  // 其他状态
  const [favorites, setFavorites] = useState([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [expandedTags, setExpandedTags] = useState({});

  const categoryRefs = useRef({});

  // 1. 初始化
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    setFavorites(JSON.parse(localStorage.getItem('spoken_favs') || '[]'));
  }, []);

  // 2. 打开书籍
  const openBook = async (book, targetCategory = null) => {
    try {
      const data = await import(`@/data/spoken/${book.file}.js`);
      setPhrases(data.default);
      setSelectedBook(book);
      setView('list');
      
      if (targetCategory) {
        setTimeout(() => {
            const el = categoryRefs.current[targetCategory];
            if (el) {
                // 平滑滚动，减去 header 高度
                const top = el.getBoundingClientRect().top + window.scrollY - 180;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        }, 500);
      }
    } catch (e) { alert("数据加载中..."); }
  };

  // 3. 智能连播
  const handlePlay = async (item) => {
    if (playingId === item.id) {
        if (window.currentAudio) window.currentAudio.pause();
        setPlayingId(null);
        return;
    }
    setPlayingId(item.id);

    const playSequence = async () => {
        if (settings.zh) {
            await new Promise(resolve => playTTS(item.chinese, 'zh', settings.speed, settings.voice, resolve));
        }
        if (playingId !== item.id) return;
        
        if (settings.my) {
            await new Promise(r => setTimeout(r, 400));
            await new Promise(resolve => playTTS(item.burmese, 'my', settings.speed, 'male', resolve));
        }
        setPlayingId(null);
    };
    playSequence();
  };

  // 4. 录音评测 (浏览器 API + MediaRecorder)
  const handleRecord = async (item) => {
    if (isRecording) {
        // 停止录音
        setIsRecording(false);
        const audioUrl = await recorderRef.current.stop();
        // 结束识别
        // 真实识别逻辑通常是异步的，这里简化为 startSpeechRecognition 返回结果
        // 为了体验，我们假设识别已经完成或者并行进行
        
        // 模拟评分 (实际请替换 startSpeechRecognition 的结果)
        try {
            // const transcript = await startSpeechRecognition(); // 真实识别
            const transcript = item.chinese; // 模拟识别成功
            const score = 85 + Math.floor(Math.random() * 15); // 模拟分数
            setRecordResult({ id: item.id, score, audioUrl, userText: transcript });
        } catch(e) {
            alert("无法识别，请重试");
        }
        setRecordingId(null);
    } else {
        // 开始录音
        setRecordingId(item.id);
        setIsRecording(true);
        recorderRef.current = createRecorder();
        recorderRef.current.start();
        
        // 同时启动语音识别 (Web Speech API)
        // startSpeechRecognition().then(...).catch(...)
    }
  };

  // 5. 播放用户录音
  const playUserAudio = () => {
      if (recordResult?.audioUrl) {
          const audio = new Audio(recordResult.audioUrl);
          audio.play();
      }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative overflow-hidden">
      
      {/* ================= 视图 A: 聚合首页 ================= */}
      <div className={`${view === 'category' ? 'block' : 'hidden'} pb-24`}>
        {/* 顶部主页胶囊 (滚动显示/隐藏逻辑可根据 scrollTop 优化，这里常驻) */}
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
             <a href="https://886.best" target="_blank" className="pointer-events-auto bg-black/70 backdrop-blur-md text-white px-5 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-4 border border-white/20">
                 <Home size={14} /> 886.best
             </a>
        </div>

        <div className="pt-24 px-6 mb-8">
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">口语特训</h1>
            <p className="text-sm text-slate-500 font-medium">精选场景会话 · 智能语音评测</p>
        </div>

        <div className="space-y-8 px-5">
           {spokenBooks.map((book) => {
               const isExpanded = expandedTags[book.id];
               const visibleCats = isExpanded ? book.categories : book.categories.slice(0, 6);

               return (
                   <div key={book.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/60 border border-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -z-0 opacity-50" />
                       
                       {/* 书籍头部 */}
                       <div onClick={() => openBook(book)} className="flex gap-5 mb-6 cursor-pointer group relative z-10">
                           <div className="w-24 h-32 rounded-2xl overflow-hidden shadow-lg shadow-blue-900/10 shrink-0 transform group-hover:scale-105 transition-transform duration-500">
                               <img src={book.image} className="w-full h-full object-cover" />
                           </div>
                           <div className="flex-1 py-1 flex flex-col justify-center">
                               <span className="text-[10px] font-black text-blue-600 bg-blue-100/50 px-2 py-1 rounded-md mb-2 self-start">{book.tag}</span>
                               <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 group-hover:text-blue-600 transition-colors">{book.title}</h3>
                               <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{book.desc}</p>
                           </div>
                       </div>
                       
                       {/* 标签云 */}
                       <div className="flex flex-wrap gap-2 relative z-10">
                           {visibleCats.map((cat) => (
                               <button 
                                   key={cat}
                                   onClick={() => openBook(book, cat)}
                                   className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100 active:bg-blue-600 active:text-white active:scale-95 transition-all"
                               >
                                   {cat}
                               </button>
                           ))}
                           {book.categories.length > 6 && (
                               <button 
                                   onClick={() => setExpandedTags(p => ({...p, [book.id]: !isExpanded}))}
                                   className="px-4 py-2 text-blue-500 text-xs font-bold"
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

      {/* ================= 视图 B: 列表页 ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-0 z-[999] bg-[#F5F7FA] flex flex-col w-full h-full max-w-md mx-auto"
          >
            {/* 1. Parallax Header + 顶部背景图 */}
            <div className="relative h-64 flex-none overflow-hidden">
                <img src={selectedBook?.image} className="absolute inset-0 w-full h-full object-cover opacity-80 blur-sm scale-110" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#F5F7FA]" />
                
                {/* 导航栏 */}
                <div className="absolute top-0 left-0 right-0 pt-safe-top p-4 flex justify-between items-center z-20 text-white">
                    <button onClick={() => setView('category')} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform"><ChevronLeft size={22}/></button>
                    <a href="https://886.best" className="text-xs font-bold bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">886.best</a>
                    <button onClick={() => setShowSettings(!showSettings)} className={`w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center transition-all ${showSettings ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}><Settings2 size={20}/></button>
                </div>

                {/* 书籍信息 */}
                <div className="absolute bottom-6 left-6 right-6 z-10">
                    <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl font-black text-white shadow-sm mb-2">{selectedBook?.title}</motion.h2>
                    <p className="text-white/80 text-xs font-medium flex items-center gap-2">
                        <span>{phrases.length} 词条</span> 
                        <span className="w-1 h-1 bg-white/50 rounded-full"/>
                        <span>{settings.speed === 0 ? '正常语速' : `语速 ${settings.speed}`}</span>
                    </p>
                </div>
            </div>

            {/* 2. 设置面板 (悬浮) */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} 
                        className="absolute top-20 right-4 left-4 bg-white/95 backdrop-blur-xl rounded-3xl p-5 shadow-2xl border border-white/20 z-50"
                    >
                        <div className="grid grid-cols-1 gap-6">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600">朗读模式</span>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button onClick={() => setSettings(s => ({...s, zh: !s.zh}))} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.zh ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>中文</button>
                                    <button onClick={() => setSettings(s => ({...s, my: !s.my}))} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.my ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}>缅文</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600">发音人</span>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button onClick={() => setSettings(s => ({...s, voice: 'female'}))} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.voice === 'female' ? 'bg-white shadow text-pink-500' : 'text-slate-400'}`}>女声</button>
                                    <button onClick={() => setSettings(s => ({...s, voice: 'male'}))} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.voice === 'male' ? 'bg-white shadow text-indigo-500' : 'text-slate-400'}`}>男声</button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-bold text-slate-600"><span>语速调节</span><span className="text-blue-500">{settings.speed}</span></div>
                                <input type="range" min="-0.5" max="0.5" step="0.1" value={settings.speed} onChange={e => setSettings(s => ({...s, speed: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600 cursor-pointer" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. 内容流 (小主题分组) */}
            <div 
              className="flex-1 overflow-y-auto p-4 pb-40 space-y-8 bg-[#F5F7FA]"
              onScroll={(e) => {
                  if (!isUnlocked && e.target.scrollTop > 600) setShowVip(true);
              }}
            >
              {phrases.map((item, index) => {
                const isLocked = !isUnlocked && index >= 3; // 第4条开始模糊
                const isBigHeader = index === 0 || phrases[index-1].category !== item.category;
                const isSubHeader = index === 0 || phrases[index-1].sub !== item.sub || isBigHeader;

                return (
                  <div key={item.id} ref={el => { if(isBigHeader) categoryRefs.current[item.category] = el }}>
                    
                    {/* 大主题锚点 */}
                    {isBigHeader && (
                        <div className="flex items-center gap-3 mb-6 mt-2 px-2">
                            <span className="text-xl font-black text-slate-800 tracking-tight">{item.category}</span>
                            <div className="h-1 w-12 bg-blue-500 rounded-full"></div>
                        </div>
                    )}
                    
                    {/* 小主题标签 */}
                    {isSubHeader && item.sub && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-full mb-4 ml-1 shadow-sm">
                           <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div> 
                           <span className="text-xs font-bold text-slate-500">{item.sub}</span>
                        </div>
                    )}

                    {/* 对话卡片 */}
                    <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       whileInView={{ opacity: 1, y: 0 }}
                       viewport={{ once: true }}
                       onClick={() => isLocked ? setShowVip(true) : null}
                       className={`
                          relative bg-white rounded-[1.5rem] p-6 mb-4 shadow-sm border border-slate-100 transition-all text-center
                          ${isLocked ? 'blur-sm opacity-60 select-none' : ''}
                          ${playingId === item.id ? 'ring-2 ring-blue-500 shadow-blue-100 scale-[1.01]' : ''}
                       `}
                    >
                       {/* 拼音 */}
                       <p className="text-xs text-slate-400 font-mono mb-2">{item.pinyin}</p>
                       
                       {/* 中文 */}
                       <h3 className="text-2xl font-black text-slate-800 mb-3 leading-tight">{item.chinese}</h3>
                       
                       {/* 缅文 */}
                       <p className="text-base text-blue-600 font-medium mb-5 leading-relaxed font-burmese">{item.burmese}</p>

                       {/* 底部功能栏 */}
                       <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                           
                           {/* 播放 */}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handlePlay(item); }}
                             className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingId === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                           >
                              {playingId === item.id ? <Loader2 className="animate-spin" size={18}/> : <Volume2 size={18}/>}
                           </button>

                           {/* 录音评测 (长按/点击切换) */}
                           <div className="flex items-center gap-3">
                               {recordResult?.id === item.id && (
                                   <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100 animate-in fade-in zoom-in">
                                       <span className="text-xs font-bold text-green-600">{recordResult.score}分</span>
                                       <button onClick={(e) => { e.stopPropagation(); playUserAudio(); }} className="p-1 bg-green-200 text-green-700 rounded-full"><PlayCircle size={12}/></button>
                                   </div>
                               )}
                               <button 
                                  onClick={(e) => { e.stopPropagation(); handleRecord(item); }}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording && recordingId === item.id ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-300' : 'bg-slate-50 text-slate-600'}`}
                               >
                                  {isRecording && recordingId === item.id ? <StopCircle size={18}/> : <Mic size={18}/>}
                               </button>
                           </div>

                           {/* 收藏 */}
                           <button 
                              onClick={(e) => { e.stopPropagation(); 
                                const newFavs = favorites.includes(item.id) ? favorites.filter(f => f !== item.id) : [...favorites, item.id];
                                setFavorites(newFavs);
                                localStorage.setItem('spoken_favs', JSON.stringify(newFavs));
                              }}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300'}`}
                           >
                              <Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                           </button>
                       </div>
                       
                       {/* 谐音胶囊 (顶部居中悬浮) */}
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-50 text-amber-700 px-3 py-0.5 rounded-full text-[10px] font-bold border border-amber-100 shadow-sm">
                           {item.xieyin}
                       </div>

                       {/* 锁定遮罩 */}
                       {isLocked && (
                           <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/10 backdrop-blur-[1px]">
                               <Lock className="text-slate-400" size={32} />
                               <span className="text-[10px] font-bold text-slate-400 mt-2 bg-white/80 px-2 py-1 rounded">VIP 专属内容</span>
                           </div>
                       )}
                    </motion.div>
                  </div>
                )
              })}
              
              {/* 底部拦截器 */}
              {!isUnlocked && (
                  <div className="py-8 text-center">
                      <p className="text-sm font-bold text-slate-400 mb-4">解锁查看剩余 9,900+ 条内容</p>
                      <button onClick={() => setShowVip(true)} className="bg-slate-900 text-white px-8 py-3 rounded-full text-sm font-bold shadow-xl animate-bounce">
                          立即激活完整版
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
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100"><X size={18}/></button>
                 <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-6 text-white shadow-xl shadow-orange-200">
                     <Crown size={32} fill="currentColor" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 mb-2">解锁 VIP 特权</h3>
                 <div className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-3 text-left">
                     <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><CheckCircle2 className="text-green-500" size={16}/> <span>解锁 10,000+ 完整短句</span></div>
                     <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><CheckCircle2 className="text-green-500" size={16}/> <span>开启 AI 语音评测功能</span></div>
                     <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><CheckCircle2 className="text-green-500" size={16}/> <span>使用标签一键跳转</span></div>
                 </div>
                 <a href="https://m.me/61575187883357" className="block w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform text-sm">
                     联系老师激活 (30,000 Ks)
                 </a>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .pt-safe-top { padding-top: max(16px, env(safe-area-inset-top)); }
        .font-burmese { font-family: 'Padauk', sans-serif; }
      `}</style>
    </div>
  );
}
