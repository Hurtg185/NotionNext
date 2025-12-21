import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, Loader2, 
  Settings2, Mic, StopCircle, Home, ArrowUp, 
  ChevronRight, Sparkles, X, ChevronDown, Volume2, Heart, Play, Square, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 引入数据 (单本书，直接进目录)
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 1. 核心音频引擎 (独占、数值语速)
// ============================================================================
const AudioEngine = {
  current: null,
  stop() {
    if (this.current) {
      this.current.pause();
      this.current.src = "";
      this.current = null;
    }
  },
  play(url) {
    return new Promise((resolve) => {
      this.stop();
      const audio = new Audio(url);
      this.current = audio;
      audio.onended = () => { this.current = null; resolve(); };
      audio.onerror = () => { this.current = null; resolve(); };
      audio.play().catch(() => { this.current = null; resolve(); });
    });
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
    } catch (e) { alert("麦克风权限未开启"); return false; }
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
    if (!SR) { alert("浏览器不支持识别"); if(onError) onError(); return; }
    this.recognition = new SR();
    this.recognition.lang = 'zh-CN';
    this.recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    this.recognition.onerror = (e) => { if(onError) onError(); };
    this.recognition.onend = () => { if(onError) onError(); };
    try { this.recognition.start(); } catch(e) { if(onError) onError(); }
  },
  stop() { if(this.recognition) this.recognition.stop(); }
};

// ============================================================================
// 4. 子组件：拼读 & 录音对比弹窗
// ============================================================================
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [recordState, setRecordState] = useState('idle'); 
  const [userAudio, setUserAudio] = useState(null);
  
  // 自动开始拼读
  useEffect(() => {
    let isMounted = true;
    const sequence = async () => {
      const chars = item.chinese.split('');
      for (let i = 0; i < chars.length; i++) {
        if(!isMounted) return;
        setActiveCharIndex(i);
        const py = pinyin(chars[i], { toneType: 'symbol' });
        const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
        await new Promise(r => AudioEngine.playUrl(r2Url, r));
        await new Promise(r => setTimeout(r, 150));
      }
      if(!isMounted) return;
      setActiveCharIndex('all');
      const r = parseInt(settings.zhRate) || 0;
      const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.chinese)}&v=${settings.zhVoice}&r=${r}`;
      await new Promise(r => AudioEngine.play(ttsUrl, r));
      if(isMounted) setActiveCharIndex(-1);
    };
    sequence();
    return () => { isMounted = false; AudioEngine.stop(); };
  }, [item, settings]);

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

  const playUserAudio = () => { if (userAudio) { AudioEngine.stop(); new Audio(userAudio).play(); } };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
        className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 p-2"><X size={24}/></button>
        <h3 className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">拼读练习</h3>
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {item.chinese.split('').map((char, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className={`text-lg font-mono mb-1 transition-colors ${activeCharIndex === i ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>{pinyin(char, {toneType:'symbol'})}</span>
              <span className={`text-5xl font-black transition-all ${activeCharIndex === i || activeCharIndex === 'all' ? 'text-slate-800 scale-125' : 'text-slate-300'}`}>{char}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-around items-center px-4">
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => { setActiveCharIndex(-1); setTimeout(() => setActiveCharIndex(0), 10); }}>
               <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center shadow-sm active:scale-95"><RefreshCw size={20}/></div>
               <span className="text-[10px] text-slate-400">重播</span>
            </div>
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={toggleRecord}>
               <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${recordState === 'recording' ? 'bg-red-500 ring-4 ring-red-200' : 'bg-blue-600'}`}>
                  {recordState === 'recording' ? <Square size={24} className="text-white animate-pulse" fill="currentColor"/> : <Mic size={28} className="text-white"/>}
               </div>
               <span className="text-[10px] text-slate-500">{recordState === 'recording' ? '停止' : '录音'}</span>
            </div>
            <div className={`flex flex-col items-center gap-2 transition-all ${userAudio ? 'opacity-100 cursor-pointer' : 'opacity-30 pointer-events-none'}`} onClick={playUserAudio}>
               <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm active:scale-95"><Play size={20} fill="currentColor"/></div>
               <span className="text-[10px] text-slate-400">我的</span>
            </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// 5. 主组件
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('catalog'); // 默认目录
  const [phrases] = useState(dailyData); 
  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  
  const [settings, setSettings] = useState({ zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true, myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true });
  const [showSettings, setShowSettings] = useState(false);
  
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null);
  const [recordingId, setRecordingId] = useState(null); 
  const [speechResult, setSpeechResult] = useState(null);
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  // 初始化
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));
    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    
    // 进度恢复
    const progress = JSON.parse(localStorage.getItem('spoken_progress'));
    if (progress && progress.view === 'list' && progress.sub) {
        setSelectedCat(progress.cat);
        setSelectedSub(progress.sub);
        setView('list');
        window.history.replaceState({ page: 'list' }, '', `?sub=${progress.sub}`); // 更新URL
        setTimeout(() => window.scrollTo(0, progress.scrollY || 0), 100);
    } else {
        window.history.replaceState({ page: 'catalog' }, '', window.location.pathname);
    }
  }, []);

  // 手势返回
  useEffect(() => {
    const handlePopState = (event) => {
        // 当URL hash或query变化时，我们用这个来处理返回
        if (view === 'list') {
            setView('catalog');
            setSelectedSub(null);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // 保存设置
  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      if (y < lastScrollY.current || y < 50) setShowHeader(true);
      else if (y > lastScrollY.current && y > 100) setShowHeader(false);
      lastScrollY.current = y;
      if (view === 'list') {
        localStorage.setItem('spoken_progress', JSON.stringify({ view: 'list', cat: selectedCat, sub: selectedSub, scrollY: y }));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view, selectedCat, selectedSub]);

  // --- 逻辑 ---
  const handleEnterList = (catName, subName) => {
    setSelectedCat(catName);
    setSelectedSub(subName);
    setView('list');
    window.history.pushState({ page: 'list' }, '', `?sub=${subName}`);
    window.scrollTo(0, 0);
  };

  const handleCardPlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    const seq = async () => {
      if (settings.zhEnabled) await new Promise(r => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, r));
      if (AudioEngine.current?.paused) return; 
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
        await new Promise(r => AudioEngine.play(item.burmese, settings.myVoice, settings.myRate, r));
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

  const catalog = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  const listData = useMemo(() => phrases.filter(p => p.sub === selectedSub), [phrases, selectedSub]);

  const renderDiff = (target, input) => {
    return target.split('').map((char, i) => {
        return <span key={i} className={input.includes(char) ? "text-slate-700 font-bold" : "text-red-500 font-black"}>{char}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* ================= VIEW 1: 目录页 (融合背景) ================= */}
      {view === 'catalog' && (
        <div className="min-h-screen">
           <div className="relative h-64">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-10 left-8 text-white">
                 <h1 className="text-4xl font-black mb-1">日常口语</h1>
                 <p className="text-white/80 text-xs font-bold uppercase tracking-widest">10,000 Sentences</p>
              </div>
              <a href="https://886.best" className="absolute top-6 right-6 bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold border border-white/10">Home</a>
           </div>

           <div className="px-5 pb-20 -mt-10 relative z-10 space-y-6">
              {catalog.map((cat, idx) => (
                 <CatalogGroup key={idx} cat={cat} idx={idx} onSelect={handleEnterList} />
              ))}
           </div>
        </div>
      )}

      {/* ================= VIEW 2: 学习列表页 ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:28}} className="fixed inset-0 z-[1000] bg-[#F5F7FA] overflow-y-auto no-scrollbar">
             
             <motion.div initial={{y:0}} animate={{y: showHeader ? 0 : -100}} className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur shadow-sm max-w-md mx-auto">
               <div className="h-12 px-4 flex items-center justify-between border-b border-slate-50">
                 <button onClick={() => window.history.back()} className="p-2 -ml-2 text-slate-600 active:scale-90"><ChevronLeft size={22}/></button>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold">{selectedCat}</span>
                    <span className="text-sm font-black text-slate-800">{selectedSub}</span>
                 </div>
                 <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}><Settings2 size={20}/></button>
               </div>
             </motion.div>

             <AnimatePresence>
               {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={()=>setShowSettings(false)} />}
             </AnimatePresence>

             <div className="pt-20 pb-32 px-4 space-y-5">
                {listData.map((item, index) => {
                   const isLocked = !isUnlocked && index >= 3;
                   return (
                     <div key={item.id} className="relative">
                        <div 
                          className={`relative bg-white pt-8 pb-4 px-5 rounded-[1.8rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all active:scale-[0.99] max-w-[360px] mx-auto
                          ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}
                          ${isLocked ? 'blur-[5px] opacity-60 pointer-events-none' : ''}`}
                          onClick={() => isLocked ? setShowVip(true) : handleCardPlay(item)}
                        >
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-[10px] font-black border-2 border-white shadow-sm z-10 whitespace-nowrap">{item.xieyin}</div>
                           <div className="text-[12px] text-slate-400 font-mono mb-1 mt-2">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                           <h3 className="text-2xl font-black text-slate-800 mb-2 leading-snug">{item.chinese}</h3>
                           <p className="text-sm text-blue-600 font-medium mb-4 font-burmese">{item.burmese}</p>

                           <div className="w-full flex justify-center items-center gap-8 px-4 pt-4 border-t border-slate-50">
                              <button onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center active:scale-90"><Sparkles size={18}/></button>
                              <button onClick={(e) => { e.stopPropagation(); toggleRecord(item); }} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>{recordingId === item.id ? <StopCircle size={22}/> : <Mic size={22}/>}</button>
                              <button onClick={(e) => { e.stopPropagation(); const newFavs = favorites.includes(item.id) ? favorites.filter(i => i !== item.id) : [...favorites, item.id]; setFavorites(newFavs); localStorage.setItem('spoken_favs', JSON.stringify(newFavs)); }} className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300'}`}><Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"}/></button>
                           </div>
                        </div>

                        {speechResult?.id === item.id && (
                          <div className="mt-2 bg-white p-3 rounded-lg text-xs w-full border border-slate-100 shadow-sm animate-in fade-in max-w-[360px] mx-auto text-center">
                             {renderDiff(item.chinese, speechResult.text)}
                          </div>
                        )}

                        {isLocked && <div className="absolute inset-0 flex flex-col items-center justify-center z-20"><Lock className="text-slate-500 mb-2" size={32}/><span className="text-[10px] bg-slate-800 text-white px-3 py-1 rounded-full font-bold shadow-lg">激活后解锁</span></div>}
                     </div>
                   )
                })}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {spellingItem && <SpellingModal item={spellingItem} settings={settings} onClose={() => setSpellingItem(null)} />}
    </div>
  );
}

// ============================================================================
// 辅助组件：目录分组 (可折叠)
// ============================================================================
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
                    <button key={i} onClick={() => onSelect(cat.name, sub)} className="text-left bg-white p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 active:scale-95 transition-transform">
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

// ============================================================================
// 辅助组件：设置面板
// ============================================================================
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-16 left-4 right-4 z-[60] bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden max-w-sm mx-auto">
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
