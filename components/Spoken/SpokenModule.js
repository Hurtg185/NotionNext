import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, PlayCircle, Loader2, 
  Settings2, Mic, StopCircle, Volume2, Home, ArrowUp, 
  ChevronRight, Sparkles, CheckCircle2, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';
import { spokenBooks } from '@/data/spoken/meta';

// ============================================================================
// 1. 音频引擎 (修复语速无效问题)
// ============================================================================
const AudioEngine = {
  current: null,
  play(text, voice, rate, onEnd) {
    if (typeof window === 'undefined') return;
    this.stop();
    
    // 语速修复：确保是 -30% 这种格式，并限制在 API 接受范围内
    const r = rate < 0 ? `${rate}%` : `+${rate}%`;
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    
    const audio = new window.Audio(url);
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
  start(onResult, onError) {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("浏览器不支持识别");
    this.recognition = new SR();
    this.recognition.lang = 'zh-CN';
    this.recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    this.recognition.onerror = onError;
    this.recognition.onend = onError;
    this.recognition.start();
  },
  stop() { if (this.recognition) this.recognition.stop(); }
};

// ============================================================================
// 3. 主组件
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('home'); // home | catalog | list
  const [book, setBook] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null); // 当前选中的小节
  
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [recordingId, setRecordingId] = useState(null);
  const [speechResult, setSpeechResult] = useState(null);
  const [spellingId, setSpellingId] = useState(null);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  // 初始化
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    const saved = localStorage.getItem('spoken_settings');
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  // 滚动逻辑 (窄 Header)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      if (y < lastScrollY.current || y < 40) setShowHeader(true);
      else if (y > lastScrollY.current && y > 80) setShowHeader(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 业务方法
  const handleOpenBook = async (b) => {
    try {
      const mod = await import(`@/data/spoken/${b.file}.js`);
      setPhrases(mod.default);
      setBook(b);
      setView('catalog'); // 进入书籍目录页
      window.scrollTo(0, 0);
    } catch(e) { alert("课程内容加载失败"); }
  };

  const handleOpenSub = (subName) => {
    setSelectedSub(subName);
    setView('list'); // 进入具体的对话列表
    window.scrollTo(0, 0);
  };

  const handlePlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    const seq = async () => {
      if (settings.zhEnabled) await new Promise(r => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, r));
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
        await new Promise(r => AudioEngine.play(item.burmese, settings.myVoice, settings.myRate, r));
      }
      setPlayingId(null);
    };
    seq();
  };

  // 书籍大纲提取
  const bookOutline = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([name, subs]) => ({ name, subs: Array.from(subs) }));
  }, [phrases]);

  // 当前小节对话数据
  const displayPhrases = useMemo(() => {
    return phrases.filter(p => p.sub === selectedSub);
  }, [phrases, selectedSub]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl">
      
      {/* ================= VIEW 1: 书架首页 (背景图面板) ================= */}
      {view === 'home' && (
        <div className="min-h-screen">
           <div className="relative h-64 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FB] to-transparent" />
              <div className="absolute bottom-12 left-8">
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
                        <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">{b.title}</h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{b.desc}</p>
                        <div className="flex items-center text-blue-600 text-[10px] font-black uppercase tracking-tighter">
                            <span>Open Book</span> <ChevronRight size={14} className="ml-1"/>
                        </div>
                    </div>
                </motion.div>
              ))}
           </div>
        </div>
      )}

      {/* ================= VIEW 2: 书籍目录页 (Catalog) ================= */}
      {view === 'catalog' && (
        <div className="min-h-screen bg-white">
           <div className="p-4 flex items-center gap-3 border-b sticky top-0 bg-white/90 backdrop-blur z-20">
             <button onClick={() => setView('home')} className="p-2"><ChevronLeft/></button>
             <h2 className="font-black text-slate-800">课程大纲</h2>
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

      {/* ================= VIEW 3: 学习列表页 (全屏沉浸) ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:28}} className="fixed inset-0 z-[1000] bg-[#F5F7FA] overflow-y-auto no-scrollbar">
             
             {/* 极窄 Header (滚动消失) */}
             <motion.div initial={{y:0}} animate={{y: showHeader ? 0 : -100}} className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur shadow-sm max-w-md mx-auto">
               <div className="h-11 px-4 flex items-center justify-between border-b border-slate-50">
                 <button onClick={() => setView('catalog')} className="p-1.5 text-slate-600"><ChevronLeft size={22}/></button>
                 <span className="font-black text-slate-800 text-[11px] truncate uppercase tracking-widest">{selectedSub}</span>
                 <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded-full ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}><Settings2 size={16}/></button>
               </div>
             </motion.div>

             {/* 设置面板 (高辨识度设计) */}
             <AnimatePresence>
               {showSettings && (
                 <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-20 left-4 right-4 z-[60] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden max-w-sm mx-auto">
                   <div className="p-6 space-y-6">
                      <div className="bg-slate-50 rounded-3xl p-4 border border-slate-100">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-slate-800">CHINESE / 中文设置</span>
                            <Switch checked={settings.zhEnabled} onChange={v => setSettings(s => ({...s, zhEnabled: v}))} />
                         </div>
                         <div className="grid grid-cols-3 gap-2 mb-4">
                            {[{l:'Kid',v:'zh-CN-YunxiaNeural'},{l:'Lady',v:'zh-CN-XiaoyanNeural'},{l:'Man',v:'zh-CN-YunxiNeural'}].map(opt => (
                               <button key={opt.v} onClick={() => setSettings(s => ({...s, zhVoice: opt.v}))} className={`py-2 text-[10px] font-black rounded-xl border transition-all ${settings.zhVoice === opt.v ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100'}`}>{opt.l}</button>
                            ))}
                         </div>
                         <div className="flex items-center gap-3"><span className="text-[10px] text-slate-400 font-bold w-12">Speed {settings.zhRate}%</span><input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600"/></div>
                      </div>

                      <div className="bg-slate-50 rounded-3xl p-4 border border-slate-100">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-slate-800">MYANMAR / 缅文设置</span>
                            <Switch checked={settings.myEnabled} onChange={v => setSettings(s => ({...s, myEnabled: v}))} />
                         </div>
                         <div className="grid grid-cols-2 gap-2 mb-4">
                            {[{l:'Thiha',v:'my-MM-ThihaNeural'},{l:'Nilar',v:'my-MM-NilarNeural'}].map(opt => (
                               <button key={opt.v} onClick={() => setSettings(s => ({...s, myVoice: opt.v}))} className={`py-2 text-[10px] font-black rounded-xl border transition-all ${settings.myVoice === opt.v ? 'bg-green-600 text-white border-green-600 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100'}`}>{opt.l}</button>
                            ))}
                         </div>
                         <div className="flex items-center gap-3"><span className="text-[10px] text-slate-400 font-bold w-12">Speed {settings.myRate}%</span><input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none accent-green-600"/></div>
                      </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* 对话卡片流 */}
             <div className="pt-16 pb-40 px-5 space-y-6">
               {displayPhrases.map((item, index) => {
                 const isLocked = !isUnlocked && index >= 3;

                 return (
                   <motion.div key={item.id} whileTap={{scale:0.98}} onClick={() => isLocked ? setShowVip(true) : handlePlay(item)} className={`relative bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 text-center transition-all cursor-pointer ${isLocked ? 'blur-[4.5px] opacity-60 pointer-events-none' : ''} ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}>
                      
                      {/* 1. 谐音 (最顶) */}
                      <div className="inline-block bg-amber-50 text-amber-700 px-3 py-0.5 rounded-full text-[9px] font-black border border-amber-100 mb-3 shadow-sm uppercase tracking-tighter">
                         {item.xieyin}
                      </div>

                      {/* 2. 拼音 (自动) */}
                      <div className="text-[11px] text-slate-400 font-mono mb-2 tracking-tighter" style={{ fontFamily: '"Roboto", sans-serif' }}>
                         {pinyin(item.chinese, {toneType:'symbol'})}
                      </div>

                      {/* 3. 中文 (大字) */}
                      <h3 className="text-2xl font-black text-slate-800 mb-3 leading-tight tracking-tight">{item.chinese}</h3>

                      {/* 4. 缅文 */}
                      <p className="text-base text-blue-600 font-medium mb-5 font-burmese leading-relaxed">{item.burmese}</p>
                      
                      {/* 底部工具 */}
                      <div className="flex justify-center gap-6 border-t border-slate-50 pt-5 mt-2">
                           <button onClick={(e) => {e.stopPropagation(); setSpellingId(spellingId === item.id ? null : item.id)}} className={`active:scale-90 transition-colors ${spellingId === item.id ? 'text-orange-500 shadow-orange-100' : 'text-slate-300'}`}><Sparkles size={20}/></button>
                           <button onClick={(e) => {e.stopPropagation(); toggleRecord(item)}} className={`active:scale-90 transition-colors ${recordingId === item.id ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>{recordingId === item.id ? <StopCircle size={20}/> : <Mic size={20}/></button>
                           {playingId === item.id ? <Loader2 className="text-blue-600 animate-spin" size={20}/> : <Volume2 className="text-slate-200" size={20}/>}
                      </div>

                      {/* 拼读展开 */}
                      {spellingId === item.id && (
                        <div className="mt-5 pt-5 border-t border-slate-50 flex flex-wrap justify-center gap-3 animate-in slide-in-from-top-2">
                           {item.chinese.split('').map((char, i) => (
                              <div key={i} className="text-center"><div className="text-[9px] font-mono text-orange-500 mb-1">{pinyin(char, {toneType:'symbol'})}</div><div className="text-2xl font-black text-slate-700">{char}</div></div>
                           ))}
                        </div>
                      )}

                      {/* 识别结果 */}
                      {speechResult?.id === item.id && (
                        <div className="mt-4 bg-slate-50 p-3 rounded-2xl text-[11px] flex justify-between items-center text-slate-500 border border-slate-100">
                           <span className="truncate flex-1 text-left mr-2 italic">" {speechResult.text} "</span>
                           <span className={`font-black px-2 py-0.5 rounded-lg ${speechResult.score >= 60 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{speechResult.score}分</span>
                        </div>
                      )}

                      {/* 锁定层 */}
                      {isLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-10"><Lock className="text-slate-400" size={40}/><span className="text-[10px] font-black text-slate-400 mt-2 bg-white/80 px-2 py-0.5 rounded shadow-sm">激活码已锁定</span></div>}
                   </motion.div>
                 )
               })}
             </div>
             
             {/* 一键置顶按钮 */}
             <motion.button onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-10 right-6 w-12 h-12 bg-white/90 backdrop-blur shadow-2xl border border-slate-100 rounded-full flex items-center justify-center text-slate-600 z-[1100] active:scale-90"><ArrowUp size={24}/></motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 激活弹窗 */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{scale:0.9}} animate={{scale:1}} className="relative bg-white rounded-[3rem] p-10 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-6 right-6 p-2 text-slate-400"><X size={20} /></button>
                 <div className="w-20 h-20 mx-auto bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner"><Crown size={42} /></div>
                 <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">解锁本章节</h3>
                 <p className="text-xs text-slate-400 mb-8 leading-relaxed">当前仅展示试看内容。激活口语特训包可查看全部 10,000+ 对话，并开启智能语音评测功能。</p>
                 <a href="https://m.me/61575187883357" target="_blank" className="block w-full py-4.5 bg-blue-600 text-white rounded-[1.8rem] font-black shadow-xl shadow-blue-200 active:scale-95 transition-transform tracking-wider">联系老师激活</a>
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
