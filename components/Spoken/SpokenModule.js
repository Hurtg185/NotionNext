import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Mic, StopCircle, Volume2, Home, ArrowUp, 
  ChevronRight, Sparkles, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';
import { spokenBooks } from '@/data/spoken/meta';

// ============================================================================
// 1. 全局音频引擎 (独占播放 + 队列控制)
// ============================================================================
const AudioEngine = {
  current: null,
  
  stop() {
    if (this.current) {
      this.current.pause();
      this.current.src = ""; // 销毁引用
      this.current = null;
    }
  },

  play(url) {
    return new Promise((resolve) => {
      this.stop(); // 播放前强制停止上一个
      
      const audio = new Audio(url);
      this.current = audio;
      
      audio.onended = () => {
        this.current = null;
        resolve();
      };
      audio.onerror = () => {
        this.current = null;
        resolve();
      };
      
      audio.play().catch(() => {
        this.current = null;
        resolve();
      });
    });
  }
};

// ============================================================================
// 2. 语音识别引擎 (Web Speech API)
// ============================================================================
const SpeechEngine = {
  recognition: null,
  
  start(onResult, onError) {
    if (typeof window === 'undefined') return;
    
    // 兼容性处理
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音识别功能");
      if (onError) onError();
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    
    this.recognition.onerror = (e) => {
      console.error("Speech Error:", e);
      if (onError) onError();
    };
    
    this.recognition.onend = () => {
      if (onError) onError();
    };

    try {
      this.recognition.start();
    } catch (e) {
      if (onError) onError();
    }
  },
  
  stop() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }
};

// ============================================================================
// 3. 主组件
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('home'); // home | catalog | list
  const [book, setBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  
  // 设置
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // 状态锁
  const [playingId, setPlayingId] = useState(null);   // 正在播放的ID (TTS 或 拼读)
  const [recordingId, setRecordingId] = useState(null); // 正在录音的ID
  const [speechDiff, setSpeechDiff] = useState(null);   // 识别结果 {id, text}
  const [spellingId, setSpellingId] = useState(null);   // 当前展开拼音的ID

  // 权限与交互
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  
  const lastScrollY = useRef(0);

  // 初始化
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    
    const saved = localStorage.getItem('spoken_settings');
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  // 保存设置
  useEffect(() => {
    localStorage.setItem('spoken_settings', JSON.stringify(settings));
  }, [settings]);

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 400);
      if (y < lastScrollY.current || y < 40) setShowHeader(true);
      else if (y > lastScrollY.current && y > 80) setShowHeader(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- 播放核心逻辑 ---

  // 1. 播放单个 TTS 任务 (支持 CF 缓存)
  const playTtsTask = async (text, voice, rate) => {
    const r = rate < 0 ? `${rate}%` : `+${rate}%`;
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    await AudioEngine.play(url);
  };

  // 2. 拼读模式：逐字 R2 音频 -> 整句 TTS
  const handleSpelling = async (item) => {
    const pId = 'spell-' + item.id;
    if (playingId === pId) {
      AudioEngine.stop();
      setPlayingId(null);
      return;
    }
    
    setPlayingId(pId);
    setSpellingId(item.id); // 展开拼音显示

    try {
      const chars = item.chinese.split('');
      
      // 逐字播放 R2 拼音音频
      for (const char of chars) {
        if (playingId !== null && playingId !== pId) break; // 防止切歌后继续播
        
        // pinyin-pro 获取带声调拼音
        const py = pinyin(char, { toneType: 'symbol' });
        // R2 地址
        const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
        
        await AudioEngine.play(r2Url);
        await new Promise(r => setTimeout(r, 150)); // 字间停顿
      }

      // 播放完拼读后，读一遍完整中文
      await playTtsTask(item.chinese, settings.zhVoice, settings.zhRate);
      
    } catch (e) {
      console.error(e);
    } finally {
      // 只有当前还在播放自己时才重置，避免打断新点击的音频
      setPlayingId(prev => (prev === pId ? null : prev));
    }
  };

  // 3. 常规朗读模式：中文 -> 缅文
  const handlePlayTTS = (item) => {
    if (playingId === item.id) {
      AudioEngine.stop();
      setPlayingId(null);
      return;
    }
    
    setPlayingId(item.id);
    
    const seq = async () => {
      // 播中文
      if (settings.zhEnabled) {
        await playTtsTask(item.chinese, settings.zhVoice, settings.zhRate);
      }
      
      // 检查是否被中断（例如用户点了别的）
      if (AudioEngine.current && AudioEngine.current.paused) return;

      // 播缅文
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
        await playTtsTask(item.burmese, settings.myVoice, settings.myRate);
      }
      
      setPlayingId(null);
    };
    
    seq();
  };

  // --- 语音识别逻辑 ---
  const toggleRecord = (item) => {
    // 停止之前的
    if (recordingId === item.id) {
      SpeechEngine.stop();
      setRecordingId(null);
    } else {
      // 开始新的
      AudioEngine.stop(); // 录音时停止播放
      setPlayingId(null);
      setRecordingId(item.id);
      setSpeechDiff(null); // 清空旧结果
      
      SpeechEngine.start(
        (text) => {
          setSpeechDiff({ id: item.id, text });
          setRecordingId(null);
        },
        () => {
          setRecordingId(null);
        }
      );
    }
  };

  // --- 目录与导航 ---
  const handleOpenBook = async (b) => {
    try {
      const mod = await import(`@/data/spoken/${b.file}.js`);
      setPhrases(mod.default);
      setBook(b);
      setView('catalog');
      window.scrollTo(0, 0);
    } catch (e) {
      alert("数据加载中...");
    }
  };

  const handleOpenSub = (subName) => {
    setSelectedSub(subName);
    setView('list');
    window.scrollTo(0, 0);
  };

  const bookOutline = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([name, subs]) => ({ name, subs: Array.from(subs) }));
  }, [phrases]);

  const displayPhrases = useMemo(() => {
    return phrases.filter(p => p.sub === selectedSub);
  }, [phrases, selectedSub]);

  // 渲染比对结果 (错字标红)
  const renderDiff = (target, input) => {
    if (!input) return null;
    const targetChars = target.split('');
    return (
      <div className="flex flex-wrap gap-1 items-center justify-center text-sm">
        <span className="text-slate-400 mr-2 text-xs">识别:</span>
        {targetChars.map((char, i) => {
          // 简单逻辑：只要识别结果里包含了这个字，就算对，否则标红
          const isMatch = input.includes(char);
          return (
            <span key={i} className={isMatch ? "text-slate-700 font-bold" : "text-red-500 font-black"}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl">
      
      {/* 全局主页按钮 */}
      <a href="https://886.best" className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[10px] font-black border border-white/10 active:scale-95 transition-transform uppercase tracking-widest">
        <Home size={10} className="inline mr-1 mb-0.5"/> 886.best
      </a>

      {/* ================= VIEW 1: 主页 ================= */}
      {view === 'home' && (
        <div className="min-h-screen">
           <div className="relative h-64 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FB] to-transparent" />
              <div className="absolute bottom-12 left-8 text-white">
                 <h1 className="text-4xl font-black text-slate-900 mb-1">口语特训</h1>
                 <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Digital Learning Library</p>
              </div>
           </div>

           <div className="px-6 -mt-6 relative z-10 space-y-6 pb-24">
              {spokenBooks.map(b => (
                <motion.div key={b.id} whileTap={{ scale: 0.98 }} className="bg-white rounded-3xl p-5 shadow-xl shadow-slate-200/50 border border-white cursor-pointer flex gap-5 items-center" onClick={() => handleOpenBook(b)}>
                    <div className="w-20 h-28 rounded-2xl overflow-hidden shadow-lg shrink-0">
                        <img src={b.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">{b.title}</h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{b.desc}</p>
                        <div className="flex items-center text-blue-600 text-[10px] font-black uppercase tracking-tighter">
                            <span>查看目录</span> <ChevronRight size={14} className="ml-1"/>
                        </div>
                    </div>
                </motion.div>
              ))}
           </div>
        </div>
      )}

      {/* ================= VIEW 2: 目录页 ================= */}
      {view === 'catalog' && (
        <div className="min-h-screen bg-white">
           <div className="p-4 flex items-center gap-3 border-b sticky top-0 bg-white/90 backdrop-blur z-20">
             <button onClick={() => setView('home')} className="p-2"><ChevronLeft/></button>
             <h2 className="font-black text-slate-800">课程目录</h2>
           </div>
           
           <div className="p-6 pb-20">
              {bookOutline.map((chapter, idx) => (
                <div key={idx} className="mb-8">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">{idx + 1}</div>
                      <h3 className="text-lg font-black text-slate-800">{chapter.name}</h3>
                   </div>
                   <div className="grid grid-cols-1 gap-2 pl-11">
                      {chapter.subs.map((s, i) => (
                         <button key={i} onClick={() => handleOpenSub(s)} className="group flex items-center justify-between py-3 border-b border-slate-50 active:bg-slate-50 pr-2">
                            <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{s}</span>
                            <ChevronRight size={16} className="text-slate-200" />
                         </button>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* ================= VIEW 3: 学习列表页 ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:28}} className="fixed inset-0 z-[1000] bg-[#F5F7FA] overflow-y-auto no-scrollbar">
             
             {/* 顶部 Header */}
             <motion.div initial={{y:0}} animate={{y: showHeader ? 0 : -100}} className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur shadow-sm max-w-md mx-auto">
               <div className="h-11 px-4 flex items-center justify-between border-b border-slate-50">
                 <button onClick={() => setView('catalog')} className="p-1.5 text-slate-600"><ChevronLeft size={22}/></button>
                 <span className="font-black text-slate-800 text-[11px] truncate uppercase tracking-widest">{selectedSub}</span>
                 <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded-full transition-all ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}><Settings2 size={16}/></button>
               </div>
             </motion.div>

             {/* 设置面板 */}
             <AnimatePresence>
               {showSettings && (
                 <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-16 left-4 right-4 z-[60] bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden max-w-sm mx-auto">
                   <div className="p-5 space-y-6">
                      {/* 中文设置 */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Chinese</span>
                            <Switch checked={settings.zhEnabled} onChange={v => setSettings(s => ({...s, zhEnabled: v}))} />
                         </div>
                         <div className="grid grid-cols-3 gap-2 mb-3">
                            {[{l:'男童',v:'zh-CN-YunxiaNeural'},{l:'女声',v:'zh-CN-XiaoyanNeural'},{l:'男声',v:'zh-CN-YunxiNeural'}].map(opt => (
                               <button key={opt.v} onClick={() => setSettings(s => ({...s, zhVoice: opt.v}))} className={`py-2 text-[9px] font-black rounded-xl border transition-all ${settings.zhVoice === opt.v ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>{opt.l}</button>
                            ))}
                         </div>
                         <div className="flex items-center gap-3"><span className="text-[9px] text-slate-400 font-black w-12">Speed {settings.zhRate}%</span><input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600"/></div>
                      </div>
                      
                      {/* 缅文设置 */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Myanmar</span>
                            <Switch checked={settings.myEnabled} onChange={v => setSettings(s => ({...s, myEnabled: v}))} />
                         </div>
                         <div className="grid grid-cols-2 gap-2 mb-3">
                            {[{l:'Thiha (Male)',v:'my-MM-ThihaNeural'},{l:'Nilar (Female)',v:'my-MM-NilarNeural'}].map(opt => (
                               <button key={opt.v} onClick={() => setSettings(s => ({...s, myVoice: opt.v}))} className={`py-2 text-[9px] font-black rounded-xl border transition-all ${settings.myVoice === opt.v ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>{opt.l}</button>
                            ))}
                         </div>
                         <div className="flex items-center gap-3"><span className="text-[9px] text-slate-400 font-black w-12">Speed {settings.myRate}%</span><input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-green-600"/></div>
                      </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* 对话列表 */}
             <div className="pt-20 pb-40 px-5 space-y-8">
               {displayPhrases.map((item, index) => {
                 const isLocked = !isUnlocked && index >= 3;
                 
                 // 构造状态：是否正在拼读，是否正在播放TTS，是否正在录音
                 const isSpelling = playingId === `spell-${item.id}`;
                 const isPlayingTTS = playingId === item.id;
                 const isRecording = recordingId === item.id;

                 return (
                   <motion.div key={item.id} className={`relative bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 text-center transition-all cursor-pointer ${isLocked ? 'blur-[5px] pointer-events-none' : ''}`}>
                      
                      <div className="inline-block bg-amber-50 text-amber-700 px-3 py-0.5 rounded-full text-[9px] font-black border border-amber-100 mb-3 shadow-sm uppercase tracking-tighter">
                         {item.xieyin}
                      </div>

                      {/* 拼音 (常驻) */}
                      <div className="text-[11px] text-slate-400 font-mono mb-2 tracking-tighter" style={{ fontFamily: '"Roboto", sans-serif' }}>
                         {pinyin(item.chinese, {toneType:'symbol'})}
                      </div>

                      <h3 className="text-2xl font-black text-slate-800 mb-3 leading-tight cursor-pointer" onClick={() => handlePlayTTS(item)}>
                         {item.chinese}
                      </h3>
                      
                      <p className="text-base text-blue-600 font-medium mb-4 font-burmese leading-relaxed">
                         {item.burmese}
                      </p>
                      
                      <div className="flex justify-center gap-8 border-t border-slate-50 pt-5">
                           {/* 拼读按钮 */}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleSpelling(item); }} 
                             className={`active:scale-90 transition-colors ${isSpelling ? 'text-orange-500 scale-110' : 'text-slate-300'}`}
                           >
                             <Sparkles size={20}/>
                           </button>

                           {/* 录音按钮 */}
                           <button 
                             onClick={(e) => { e.stopPropagation(); toggleRecord(item); }} 
                             className={`active:scale-90 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}
                           >
                             {isRecording ? <StopCircle size={20}/> : <Mic size={20}/>}
                           </button>

                           {/* 朗读按钮 */}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handlePlayTTS(item); }} 
                             className={`active:scale-90 transition-colors ${isPlayingTTS ? 'text-blue-500 scale-110' : 'text-slate-300'}`}
                           >
                             {isPlayingTTS ? <Loader2 className="animate-spin" size={20}/> : <Volume2 size={20}/>}
                           </button>
                      </div>

                      {/* 识别结果 (标红) */}
                      {speechDiff?.id === item.id && (
                        <div className="mt-4 bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                           {renderSpeechDiff(item.chinese, speechDiff.text)}
                        </div>
                      )}

                      {isLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10"><Lock className="text-slate-400" size={40}/><span className="text-[10px] font-black text-slate-400 mt-2 bg-white/80 px-2 py-0.5 rounded">VIP 内容已锁定</span></div>}
                   </motion.div>
                 );
               })}
               
               {!isUnlocked && displayPhrases.length > 3 && (
                 <div className="py-12 text-center">
                   <button onClick={() => setShowVip(true)} className="bg-slate-900 text-white px-10 py-4 rounded-[2rem] text-sm font-black shadow-2xl active:scale-95 transition-transform animate-bounce">激活完整课程</button>
                 </div>
               )}
             </div>

             <AnimatePresence>
                {showBackTop && (
                  <motion.button initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-10 right-6 w-12 h-12 bg-white/90 backdrop-blur shadow-2xl border border-slate-100 rounded-full flex items-center justify-center text-slate-600 z-[1100] active:scale-90"><ArrowUp size={24}/></motion.button>
                )}
             </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{scale:0.9}} animate={{scale:1}} className="relative bg-white rounded-[3rem] p-10 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-6 right-6 p-2 text-slate-400"><X size={20} /></button>
                 <div className="w-20 h-20 mx-auto bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner"><Crown size={42} /></div>
                 <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">解锁完整版</h3>
                 <p className="text-xs text-slate-400 mb-8 leading-relaxed">激活后可查看全部 10,000+ 对话，使用书籍目录模式及语音纠错功能。</p>
                 <a href="https://m.me/61575187883357" target="_blank" className="block w-full py-4.5 bg-blue-600 text-white rounded-[1.8rem] font-black shadow-xl shadow-blue-200 active:scale-95 transition-transform tracking-wider uppercase">联系老师开通</a>
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

const Switch = ({ checked, onChange }) => (
    <button onClick={() => onChange(!checked)} className={`w-10 h-6 rounded-full p-1 transition-all shadow-inner ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
);
