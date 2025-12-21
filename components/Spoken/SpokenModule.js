import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, Loader2, 
  Settings2, Mic, StopCircle, Home, ArrowUp, 
  ChevronRight, Sparkles, X, ChevronDown, Volume2, Heart, Play, Square, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 引入数据
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 1. 核心音频引擎 (独占、数值语速)
// ============================================================================
const AudioEngine = {
  current: null,
  stop() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  },
  play(url, onEnd) {
    if (typeof window === 'undefined' || !url) return;
    this.stop(); // 强制停止其他声音
    const audio = new Audio(url);
    this.current = audio;
    audio.onended = () => { this.current = null; if(onEnd) onEnd(); };
    audio.onerror = () => { this.current = null; if(onEnd) onEnd(); };
    audio.play().catch(() => { this.current = null; if(onEnd) onEnd(); });
  },
  // 生成 TTS URL 并播放
  playTTS(text, voice, rate, onEnd) {
    const r = parseInt(rate) || 0; 
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    this.play(url, onEnd);
  }
};

// ============================================================================
// 2. 录音机 (用于拼读窗口)
// ============================================================================
const RecorderEngine = {
  mediaRecorder: null, chunks: [],
  async start() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];
      this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
      this.mediaRecorder.start();
      return true;
    } catch (e) {
      alert("麦克风权限未开启");
      return false;
    }
  },
  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);
      this.mediaRecorder.onstop = () => {
        const url = URL.createObjectURL(new Blob(this.chunks, { type: 'audio/webm' }));
        this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        this.mediaRecorder = null;
        resolve(url);
      };
      this.mediaRecorder.stop();
    });
  }
};

// ============================================================================
// 3. 语音识别 (Web Speech API)
// ============================================================================
const SpeechEngine = {
  recognition: null,
  start(onResult, onError) {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("浏览器不支持语音识别"); if(onError) onError(); return; }
    
    this.recognition = new SR();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    this.recognition.onerror = () => { if(onError) onError(); };
    this.recognition.onend = () => { if(onError) onError(); };
    try { this.recognition.start(); } catch(e) { if(onError) onError(); }
  },
  stop() { if(this.recognition) this.recognition.stop(); }
};

// ============================================================================
// 4. 子组件：拼读 & 录音弹窗 (自动演示)
// ============================================================================
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [recordState, setRecordState] = useState('idle'); 
  const [userAudio, setUserAudio] = useState(null);
  
  useEffect(() => {
    handleSpellPlay();
    return () => AudioEngine.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpellPlay = async () => {
    const chars = item.chinese.split('');
    // 1. 逐字播放 R2
    for (let i = 0; i < chars.length; i++) {
      setActiveCharIndex(i);
      const py = pinyin(chars[i], { toneType: 'symbol' });
      const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
      await new Promise(resolve => AudioEngine.play(r2Url, resolve));
      await new Promise(r => setTimeout(r, 100));
    }
    // 2. 整句 TTS
    setActiveCharIndex('all');
    await new Promise(resolve => AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, resolve));
    setActiveCharIndex(-1);
  };

  const toggleRecord = async () => {
    if (recordState === 'recording') {
      const url = await RecorderEngine.stop();
      setUserAudio(url);
      setRecordState('review');
    } else {
      AudioEngine.stop();
      const success = await RecorderEngine.start();
      if (success) setRecordState('recording');
    }
  };

  const playUserAudio = () => {
    if (userAudio) { AudioEngine.play(userAudio); }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-xs rounded-[2rem] p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 p-2"><X size={24}/></button>
        <h3 className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">拼读练习</h3>
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {item.chinese.split('').map((char, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className={`text-lg font-mono mb-1 ${activeCharIndex === i ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>{pinyin(char, {toneType:'symbol'})}</span>
              <span className={`text-5xl font-black transition-all ${activeCharIndex === i || activeCharIndex === 'all' ? 'text-slate-800 scale-125' : 'text-slate-300'}`}>{char}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-around items-center px-2">
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => handleSpellPlay()}>
               <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center shadow-sm active:scale-95"><RefreshCw size={20}/></div>
               <span className="text-[10px] text-slate-400">重播</span>
            </div>
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={toggleRecord}>
               <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${recordState === 'recording' ? 'bg-red-500 ring-4 ring-red-200' : 'bg-blue-600'}`}>
                  {recordState === 'recording' ? <Square size={20} className="text-white animate-pulse" fill="currentColor"/> : <Mic size={24} className="text-white"/>}
               </div>
               <span className="text-[10px] text-slate-500">{recordState === 'recording' ? '停止' : '录音'}</span>
            </div>
            <div className={`flex flex-col items-center gap-2 transition-all ${userAudio ? 'opacity-100 cursor-pointer' : 'opacity-30 pointer-events-none'}`} onClick={playUserAudio}>
               <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm active:scale-95"><Play size={18} fill="currentColor"/></div>
               <span className="text-[10px] text-slate-400">我的</span>
            </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// 5. 主组件 SpokenModule
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('home'); // home | catalog | list
  const [phrases] = useState(dailyData); 
  const [selectedBook, setSelectedBook] = useState(null); // 当前书
  const [selectedSub, setSelectedSub] = useState(null); // 当前小节
  
  const [settings, setSettings] = useState({ zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true, myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true });
  const [showSettings, setShowSettings] = useState(false);
  
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null);
  const [recordingId, setRecordingId] = useState(null); 
  const [speechResult, setSpeechResult] = useState(null);
  const [favorites, setFavorites] = useState([]);
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  
  const lastScrollY = useRef(0);

  // 初始化
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    const savedFavs = JSON.parse(localStorage.getItem('spoken_favs') || '[]');
    setFavorites(savedFavs);

    // 恢复进度
    const progress = JSON.parse(localStorage.getItem('spoken_progress'));
    if (progress && progress.sub) {
        // 直接恢复到书籍和目录
        const book = { title: "日常高频口语", desc: "10,000 Sentences" }; // 模拟书籍对象
        setSelectedBook(book);
        setSelectedSub(progress.sub);
        setView('list'); 
        setTimeout(() => window.scrollTo(0, progress.scrollY || 0), 100);
    }
  }, []);

  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // 滚动监听 (顶部面板自动隐显)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 300);
      if (y < lastScrollY.current) setShowHeader(true); // 向上滚显示
      else if (y > 50 && y > lastScrollY.current) setShowHeader(false); // 向下滚隐藏
      lastScrollY.current = y;
      
      if (view === 'list') {
        localStorage.setItem('spoken_progress', JSON.stringify({ sub: selectedSub, scrollY: y }));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view, selectedSub]);

  // --- 业务 ---
  const handleOpenBook = () => {
    setSelectedBook({ title: "日常高频口语", desc: "10,000 Sentences" });
    setView('catalog');
    window.scrollTo(0, 0);
  };

  const handleEnterList = (subName) => {
    setSelectedSub(subName);
    setView('list');
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (view === 'list') setView('catalog');
    else if (view === 'catalog') setView('home');
  };

  const handleCardPlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    const seq = async () => {
      if (settings.zhEnabled) await new Promise(r => AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, r));
      if (AudioEngine.current?.paused) return; // 检查中断
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
        await new Promise(r => AudioEngine.playTTS(item.burmese, settings.myVoice, settings.myRate, r));
      }
      setPlayingId(null);
    };
    seq();
  };

  const handleSpeech = (item) => {
    if (recordingId === item.id) { SpeechEngine.stop(); setRecordingId(null); } 
    else {
      AudioEngine.stop(); setRecordingId(item.id); setSpeechResult(null);
      SpeechEngine.start((text) => {
        setSpeechResult({ id: item.id, text });
        setRecordingId(null);
      }, () => setRecordingId(null));
    }
  };

  const toggleFav = (id) => {
    const newFavs = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem('spoken_favs', JSON.stringify(newFavs));
  };

  const catalog = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  const listData = useMemo(() => phrases.filter(p => p.sub === selectedSub), [phrases, selectedSub]);

  // 逐字比对 (错字标红)
  const renderDiff = (target, input) => {
    return target.split('').map((char, i) => {
        const isMatch = input.includes(char);
        return <span key={i} className={isMatch ? "text-slate-800 font-bold" : "text-red-500 font-black"}>{char}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* ================= VIEW 1: 书架首页 (背景图面板) ================= */}
      {view === 'home' && (
        <div className="min-h-screen">
           <div className="relative h-64 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FB] to-transparent" />
              <div className="absolute bottom-12 left-8 text-white">
                 <h1 className="text-4xl font-black mb-1">口语特训</h1>
                 <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Digital Learning Library</p>
              </div>
              <a href="https://886.best" className="absolute top-6 right-6 bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold border border-white/10">Home</a>
           </div>

           <div className="px-5 -mt-8 relative z-10">
              <motion.div whileTap={{ scale: 0.98 }} className="bg-white rounded-[2rem] p-5 shadow-xl border border-white cursor-pointer flex gap-5 items-center" onClick={handleOpenBook}>
                  <div className="w-20 h-28 rounded-2xl overflow-hidden shadow-lg shrink-0">
                      <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                      <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">日常高频 10000 句</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">涵盖生活、工作、情感表达等全场景。</p>
                      <div className="flex items-center text-blue-600 text-[10px] font-black uppercase tracking-tighter">
                          <span>Start Learning</span> <ChevronRight size={14} className="ml-1"/>
                      </div>
                  </div>
              </motion.div>
           </div>
        </div>
      )}

      {/* ================= VIEW 2: 书籍目录页 (Catalog) ================= */}
      {view === 'catalog' && (
        <div className="min-h-screen bg-white">
           {/* 顶部融合背景 */}
           <div className="relative h-48">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" className="w-full h-full object-cover brightness-[0.6]" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
              <div className="absolute bottom-4 left-6">
                 <h1 className="text-2xl font-black text-slate-800 mb-1">课程大纲</h1>
                 <p className="text-slate-500 text-xs font-bold">10,000 Sentences</p>
              </div>
              <button onClick={handleBack} className="absolute top-6 left-6 w-8 h-8 bg-black/20 backdrop-blur rounded-full flex items-center justify-center text-white"><ChevronLeft size={20}/></button>
           </div>

           <div className="px-5 pb-20 relative z-10 space-y-6">
              {catalog.map((cat, idx) => (
                 <CatalogGroup key={idx} cat={cat} idx={idx} onSelect={handleEnterList} />
              ))}
           </div>
        </div>
      )}

      {/* ================= VIEW 3: 学习列表页 (全屏) ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:28}} className="fixed inset-0 z-[1000] bg-[#F5F7FA] overflow-y-auto no-scrollbar">
             
             {/* 顶部控制栏 (滚动隐显) */}
             <motion.div initial={{y:0}} animate={{y: showHeader ? 0 : -100}} className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur shadow-sm max-w-md mx-auto">
               <div className="h-12 px-4 flex items-center justify-between border-b border-slate-50">
                 <button onClick={handleBack} className="p-2 -ml-2 text-slate-600 active:scale-90"><ChevronLeft size={22}/></button>
                 <span className="font-black text-slate-800 text-sm truncate">{selectedSub}</span>
                 <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}><Settings2 size={20}/></button>
               </div>
             </motion.div>

             {/* 设置面板 */}
             <AnimatePresence>
               {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={()=>setShowSettings(false)} />}
             </AnimatePresence>

             {/* 列表内容 */}
             <div className="pt-20 pb-32 px-4 space-y-5">
                {listData.map((item, index) => {
                   // 权限核心逻辑：前3条免费，后面锁住
                   const isLocked = !isUnlocked && index >= 3;
                   
                   return (
                     <div key={item.id} className="relative">
                        <div 
                          className={`relative bg-white pt-8 pb-4 px-5 rounded-[1.8rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all active:scale-[0.99] max-w-[360px] mx-auto
                          ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}
                          ${isLocked ? 'blur-sm opacity-50 pointer-events-none' : ''}`}
                          onClick={() => isLocked ? setShowVip(true) : handleCardPlay(item)}
                        >
                           {/* 谐音 (骑缝) */}
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-[10px] font-black border-2 border-white shadow-sm z-10 whitespace-nowrap">{item.xieyin}</div>
                           
                           <div className="text-[12px] text-slate-400 font-mono mb-1 mt-2">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                           <h3 className="text-2xl font-black text-slate-800 mb-2 leading-snug">{item.chinese}</h3>
                           <p className="text-sm text-blue-600 font-medium mb-4 font-burmese">{item.burmese}</p>

                           {/* 底部工具栏 */}
                           <div className="w-full flex justify-center items-center gap-8 px-4 pt-4 border-t border-slate-50">
                              <button onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center active:scale-90"><Sparkles size={18}/></button>
                              <button onClick={(e) => { e.stopPropagation(); handleSpeech(item); }} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>{recordingId === item.id ? <StopCircle size={22}/> : <Mic size={22}/>}</button>
                              <button onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300'}`}><Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"}/></button>
                           </div>
                        </div>

                        {speechResult?.id === item.id && (
                          <div className="mt-2 bg-white p-3 rounded-lg text-xs w-full border border-slate-100 shadow-sm animate-in fade-in max-w-[360px] mx-auto text-center">
                             <div className="flex justify-center gap-1 flex-wrap font-mono">
                                {renderDiff(item.chinese, speechResult.text)}
                             </div>
                          </div>
                        )}

                        {isLocked && (
                           <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                              <Lock className="text-slate-500 mb-2" size={32}/>
                              <span className="text-[10px] bg-slate-800 text-white px-3 py-1 rounded-full font-bold shadow-lg">激活后解锁</span>
                           </div>
                        )}
                     </div>
                   )
                })}
             </div>

             <AnimatePresence>
                {showBackTop && (
                  <motion.button initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-10 right-6 w-10 h-10 bg-white shadow-xl border border-slate-100 rounded-full flex items-center justify-center text-slate-500 z-[1100] active:scale-90"><ArrowUp size={20}/></motion.button>
                )}
             </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {spellingItem && <SpellingModal item={spellingItem} settings={settings} onClose={() => setSpellingItem(null)} />}

      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{scale:0.9}} animate={{scale:1}} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 text-slate-400"><X size={20}/></button>
                 <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><Crown size={32} /></div>
                 <h3 className="text-xl font-black text-slate-900 mb-2">解锁完整版</h3>
                 <p className="text-xs text-slate-500 mb-6">激活口语特训包，解锁全部 10,000+ 场景会话。</p>
                 <a href="https://m.me/61575187883357" target="_blank" className="block w-full py-3.5 bg-blue-600 text-white rounded-xl font-black shadow-lg active:scale-95 transition-transform">联系老师激活</a>
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

// 目录分组
const CatalogGroup = ({ cat, idx, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
       <div onClick={() => setIsOpen(!isOpen)} className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">{idx + 1}</div>
             <h3 className="font-bold text-slate-800">{cat.name}</h3>
          </div>
          <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </div>
       <AnimatePresence>
         {isOpen && (
           <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50/50">
              <div className="p-2 grid grid-cols-2 gap-2">
                 {cat.subs.map((sub, i) => (
                    <button key={i} onClick={() => onSelect(sub)} className="text-left bg-white p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 active:scale-95 transition-transform">
                       {sub}
                    </button>
                 ))}
              </div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
};

// 设置面板
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-16 left-4 right-4 z-[2000] bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden max-w-sm mx-auto">
       <div className="p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
             <span className="text-xs font-black text-slate-400 uppercase">Audio Settings</span>
             <button onClick={onClose}><X size={16} className="text-slate-300"/></button>
          </div>
          <div>
             <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-700">中文发音</span><Switch checked={settings.zhEnabled} onChange={v => setSettings(s => ({...s, zhEnabled: v}))} /></div>
             <div className="grid grid-cols-3 gap-2 mb-2">
                {[{l:'男童',v:'zh-CN-YunxiaNeural'},{l:'女声',v:'zh-CN-XiaoyanNeural'},{l:'男声',v:'zh-CN-YunxiNeural'}].map(opt => (
                   <button key={opt.v} onClick={() => setSettings(s => ({...s, zhVoice: opt.v}))} className={`py-2 text-[10px] font-black rounded-lg border transition-all ${settings.zhVoice === opt.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-transparent'}`}>{opt.l}</button>
                ))}
             </div>
             <div className="flex items-center gap-2"><span className="text-[10px] text-slate-400 w-8">Speed</span><input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-blue-600"/><span className="text-[10px] text-blue-600 font-mono w-6 text-right">{settings.zhRate}</span></div>
          </div>
          <div>
             <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-700">缅文发音</span><Switch checked={settings.myEnabled} color="green" onChange={v => setSettings(s => ({...s, myEnabled: v}))} /></div>
             <div className="grid grid-cols-2 gap-2 mb-2">
                {[{l:'Thiha (男)',v:'my-MM-ThihaNeural'},{l:'Nilar (女)',v:'my-MM-NilarNeural'}].map(opt => (
                   <button key={opt.v} onClick={() => setSettings(s => ({...s, myVoice: opt.v}))} className={`py-2 text-[10px] font-black rounded-lg border transition-all ${settings.myVoice === opt.v ? 'bg-green-600 text-white border-green-600' : 'bg-slate-50 text-slate-400 border-transparent'}`}>{opt.l}</button>
                ))}
             </div>
             <div className="flex items-center gap-2"><span className="text-[10px] text-slate-400 w-8">Speed</span><input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-green-600"/><span className="text-[10px] text-green-600 font-mono w-6 text-right">{settings.myRate}</span></div>
          </div>
       </div>
    </motion.div>
  );
};

const Switch = ({ checked, onChange, color='blue' }) => (
    <button onClick={() => onChange(!checked)} className={`w-9 h-5 rounded-full p-0.5 transition-all ${checked ? (color === 'blue' ? 'bg-blue-600' : 'bg-green-600') : 'bg-slate-200'}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
);
