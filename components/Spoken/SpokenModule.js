import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, StopCircle, ArrowUp, Sparkles, X, Volume2, Star, Play, Square, 
  Menu, Zap, Crown, Lock, Settings2, Globe, ChevronLeft, ChevronRight, 
  ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 引入数据
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 0. 拼音评分与对比工具
// ============================================================================
function getPinyinComparison(targetText, userText) {
  const cleanTarget = targetText.replace(/[^\u4e00-\u9fa5]/g, '');
  const cleanUser = userText.replace(/[^\u4e00-\u9fa5]/g, '');

  const targetPy = pinyin(cleanTarget, { type: 'array', toneType: 'symbol' });
  const userPy = pinyin(cleanUser, { type: 'array', toneType: 'symbol' });

  const result = [];
  const len = Math.max(targetPy.length, userPy.length);
  let correctCount = 0;

  for (let i = 0; i < len; i++) {
    const t = targetPy[i] || '';
    const u = userPy[i] || '';
    const isMatch = t === u; 
    if (isMatch) correctCount++;

    result.push({
      targetChar: cleanTarget[i] || '',
      targetPy: t,
      userPy: u,
      isMatch: isMatch,
      isMissing: !u
    });
  }

  const accuracy = targetPy.length > 0 ? correctCount / targetPy.length : 0;
  return { accuracy, comparison: result, userText };
}

// ============================================================================
// 1. 核心音频引擎 (增加 playSequence 用于逐字拼读)
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
  play(url) {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !url) { resolve(); return; }
      this.stop(); 
      const audio = new Audio(url);
      this.current = audio;
      audio.onended = () => { this.current = null; resolve(); };
      audio.onerror = () => { this.current = null; resolve(); };
      audio.play().catch(() => { this.current = null; resolve(); });
    });
  },
  playTTS(text, voice, rate, onEnd) {
    const r = parseInt(rate) || 0; 
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    this.play(url).then(() => { if(onEnd) onEnd(); });
  }
};

// ============================================================================
// 2. 录音与识别引擎
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
    } catch (e) { alert("请开启麦克风权限"); return false; }
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
// 3. 子组件
// ============================================================================

// 设置开关
const Switch = ({ checked, onChange, color='blue' }) => (
    <button onClick={() => onChange(!checked)} className={`w-9 h-5 rounded-full p-0.5 transition-all ${checked ? (color === 'blue' ? 'bg-blue-600' : 'bg-green-600') : 'bg-slate-200'}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
);

// 设置面板
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-14 right-4 z-[2000] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden w-64">
       <div className="p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
             <span className="text-xs font-black text-slate-400 uppercase">Audio Settings</span>
             <button onClick={onClose}><X size={16} className="text-slate-300"/></button>
          </div>
          <div>
             <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-700">中文发音</span><Switch checked={settings.zhEnabled} onChange={v => setSettings(s => ({...s, zhEnabled: v}))} /></div>
             <div className="flex items-center gap-2"><span className="text-[10px] text-slate-400 w-8">语速</span><input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-blue-600"/></div>
          </div>
          <div>
             <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-700">缅文发音</span><Switch checked={settings.myEnabled} color="green" onChange={v => setSettings(s => ({...s, myEnabled: v}))} /></div>
             <div className="flex items-center gap-2"><span className="text-[10px] text-slate-400 w-8">语速</span><input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-green-600"/></div>
          </div>
       </div>
    </motion.div>
  );
};

// 拼读弹窗 (自动逐字拼读)
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [recordState, setRecordState] = useState('idle'); 
  const [userAudio, setUserAudio] = useState(null);
  const chars = item.chinese.split('');
  const isMounted = useRef(true);

  // 挂载时自动逐字拼读
  useEffect(() => {
    isMounted.current = true;
    const autoSpell = async () => {
        // 稍微延迟等待动画完成
        await new Promise(r => setTimeout(r, 400));
        if (!isMounted.current) return;

        // 逐字播放
        for (let i = 0; i < chars.length; i++) {
            if (!isMounted.current) break;
            setActiveCharIndex(i);
            const py = pinyin(chars[i], { toneType: 'symbol' });
            const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
            await AudioEngine.play(r2Url);
            await new Promise(r => setTimeout(r, 100)); // 间隔
        }
        if (isMounted.current) setActiveCharIndex(-1);
    };
    autoSpell();
    return () => { isMounted.current = false; AudioEngine.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCharClick = (index) => {
    setActiveCharIndex(index);
    AudioEngine.stop();
    const char = chars[index];
    const py = pinyin(char, { toneType: 'symbol' });
    const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
    AudioEngine.play(r2Url);
  };

  const playWhole = () => {
     setActiveCharIndex('all');
     AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, () => setActiveCharIndex(-1));
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

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-6" onClick={onClose}>
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} 
        transition={{ duration: 0.25, ease: "easeInOut" }} 
        className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl relative" 
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
        
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-slate-900 font-black text-lg">拼读练习</h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">自动演示中...</span>
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 mb-10 px-2">
          {chars.map((char, i) => (
            <div key={i} onClick={() => handleCharClick(i)} className={`flex flex-col items-center p-2 rounded-xl transition-all cursor-pointer select-none ${activeCharIndex === i ? 'bg-blue-50 ring-2 ring-blue-500 scale-110 shadow-lg' : 'hover:bg-slate-50'}`}>
              <span className={`text-xs font-mono mb-1 ${activeCharIndex === i ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>{pinyin(char, {toneType:'symbol'})}</span>
              <span className={`text-3xl font-black transition-colors ${activeCharIndex === i ? 'text-blue-800' : 'text-slate-800'}`}>{char}</span>
            </div>
          ))}
        </div>
        
        <div className="flex justify-around items-center px-4 pb-4">
            <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={playWhole}>
               <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 border bg-white text-slate-600 border-slate-200"><Volume2 size={20}/></div>
               <span className="text-[10px] text-slate-400 font-bold">整句TTS</span>
            </div>
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={toggleRecord}>
               <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 border-4 ${recordState === 'recording' ? 'bg-red-500 border-red-100 ring-2 ring-red-500' : 'bg-slate-900 border-slate-100'}`}>
                  {recordState === 'recording' ? <Square size={24} className="text-white animate-pulse" fill="currentColor"/> : <Mic size={28} className="text-white"/>}
               </div>
               <span className="text-[10px] text-slate-400 font-bold">{recordState === 'recording' ? '停止' : '跟读'}</span>
            </div>
            <div className={`flex flex-col items-center gap-2 transition-all ${userAudio ? 'opacity-100 cursor-pointer' : 'opacity-30 pointer-events-none'}`} onClick={() => userAudio && AudioEngine.play(userAudio)}>
               <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center shadow-sm border border-green-100 active:scale-95"><Play size={18} fill="currentColor"/></div>
               <span className="text-[10px] text-slate-400 font-bold">我的</span>
            </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// 4. 主组件 SpokenModule
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('home'); 
  const [phrases] = useState(dailyData); 
  
  // UI 状态
  const [showCatalog, setShowCatalog] = useState(false); 
  const [showSettings, setShowSettings] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const [expandedCats, setExpandedCats] = useState({}); // 目录折叠状态
  
  // 播放与交互
  const [settings, setSettings] = useState({ zhVoice: 'zh-CN-YunxiaNeural', zhRate: -10, zhEnabled: true, myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true });
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null);
  const [recordingId, setRecordingId] = useState(null); 
  const [speechResult, setSpeechResult] = useState(null); 
  const [favorites, setFavorites] = useState([]);
  
  // 权限
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  
  // Refs for scrolling
  const listRef = useRef(null);
  const itemRefs = useRef({}); // 保存每个sub的ref

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));

    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    
    const savedFavs = JSON.parse(localStorage.getItem('spoken_favs') || '[]');
    setFavorites(savedFavs);
  }, []);

  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // --- 业务逻辑 ---
  
  // 进入列表页 (无条件进入)
  const enterList = () => {
    setView('list');
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    setView('home');
    window.scrollTo(0, 0);
  };

  // 目录跳转
  const handleCatalogJump = (sub) => {
    setShowCatalog(false);
    // 找到对应元素并滚动
    setTimeout(() => {
        const el = itemRefs.current[sub];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
  };

  const handleCardPlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    const seq = async () => {
      if (settings.zhEnabled) await AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate);
      if (AudioEngine.current?.paused) return; 
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 300));
        await AudioEngine.playTTS(item.burmese, settings.myVoice, settings.myRate);
      }
      setPlayingId(null);
    };
    seq();
  };

  const handleSpeech = (item) => {
    if (recordingId === item.id) { 
        SpeechEngine.stop(); 
        setRecordingId(null); 
    } else {
      AudioEngine.stop(); 
      setRecordingId(item.id); 
      setSpeechResult(null);
      SpeechEngine.start((transcript) => {
        const scoreData = getPinyinComparison(item.chinese, transcript);
        setSpeechResult({ id: item.id, data: scoreData });
        setRecordingId(null);
      }, () => setRecordingId(null));
    }
  };

  const toggleFav = (id) => {
    const newFavs = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem('spoken_favs', JSON.stringify(newFavs));
  };

  // 目录结构生成
  const catalogTree = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  // 切换折叠
  const toggleCat = (catName) => {
    setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  // 渲染对比结果
  const renderComparison = (data) => {
      const { accuracy, comparison, userText } = data;
      return (
        <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100 text-left">
           <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pronunciation Check</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded ${accuracy === 1 ? 'bg-green-100 text-green-600' : accuracy > 0.6 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-500'}`}>
                 {Math.round(accuracy * 100)}%
              </span>
           </div>
           
           <div className="flex flex-wrap gap-2 mb-3">
              {comparison.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                      <span className={`text-xs font-mono font-bold ${item.isMatch ? 'text-slate-800' : 'text-red-500'}`}>
                          {item.userPy || '?'}
                      </span>
                      <span className={`text-sm ${item.isMatch ? 'text-slate-400' : 'text-red-300'}`}>
                          {item.targetChar}
                      </span>
                  </div>
              ))}
           </div>
           
           <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-200">
               <span className="mr-2">识别文本:</span> {userText}
           </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* ================= VIEW 1: HOME (Cover) ================= */}
      {view === 'home' && (
         <div className="min-h-screen bg-white">
            <div className="relative h-72">
               <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
               <div className="absolute bottom-6 left-6">
                  <h1 className="text-4xl font-black text-slate-900 mb-1">口语特训</h1>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">10,000 Sentences</p>
               </div>
               <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/90">
                   <Globe size={14} /> <span className="text-xs font-bold">886.best</span>
               </div>
            </div>
            
            <div className="px-6 -mt-4 relative z-10 pb-20">
               <div onClick={enterList} className="bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform">
                   <div className="flex gap-5 mb-4">
                      <div className="w-20 h-28 bg-slate-200 rounded-xl overflow-hidden shrink-0 shadow-inner">
                         <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 py-1">
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold mb-2 inline-block">日常高频</span>
                          <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">全场景口语速成</h3>
                          <p className="text-xs text-slate-400 line-clamp-2">包含生活、工作、旅游等常用 10000 句。</p>
                      </div>
                   </div>
                   <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                       <span className="text-xs font-bold text-slate-400">{phrases.length} 句会话</span>
                       <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center"><ChevronRight size={18} /></div>
                   </div>
               </div>
            </div>
         </div>
      )}

      {/* ================= VIEW 2: LIST (All Content) ================= */}
      {view === 'list' && (
        <div className="min-h-screen pb-20 bg-[#F5F7FA]" ref={listRef}>
            {/* Header (Fixed) */}
            <div className="fixed top-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm max-w-md mx-auto h-14 flex items-center justify-between px-4">
               {/* Back Button */}
               <button onClick={goHome} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
                  <ChevronLeft size={24} />
               </button>

               {/* Center: Website (Centered, No Bg) */}
               <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-slate-500">
                   <Globe size={14} />
                   <span className="text-xs font-bold font-mono">886.best</span>
               </div>

               {/* Right Tools */}
               <div className="flex items-center gap-1">
                   <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                       <Settings2 size={20} />
                   </button>
                   <button onClick={() => setShowCatalog(true)} className="p-2 text-slate-600 hover:text-blue-600 transition-colors">
                       <Menu size={20} />
                   </button>
               </div>
            </div>

            {/* Settings Dropdown */}
            <AnimatePresence>
                {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
            </AnimatePresence>

            {/* Catalog Overlay (Foldable) */}
            <AnimatePresence>
                {showCatalog && (
                  <>
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-[150] backdrop-blur-sm" onClick={() => setShowCatalog(false)} />
                    <motion.div 
                       initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:28}}
                       className="fixed inset-y-0 right-0 z-[160] w-[85%] max-w-[300px] bg-white shadow-2xl overflow-y-auto"
                    >
                       <div className="p-6">
                          <div className="flex justify-between items-center mb-6">
                             <h2 className="text-xl font-black text-slate-800">课程目录</h2>
                             <button onClick={() => setShowCatalog(false)} className="p-1 text-slate-400 hover:text-red-500"><X size={24}/></button>
                          </div>
                          <div className="space-y-4">
                             {catalogTree.map((cat, i) => (
                                <div key={i} className="border-b border-slate-50 pb-2">
                                   <div 
                                      className="flex items-center justify-between py-2 cursor-pointer active:bg-slate-50 rounded px-1"
                                      onClick={() => toggleCat(cat.name)}
                                   >
                                       <h3 className="text-sm font-bold text-slate-800">{cat.name}</h3>
                                       {expandedCats[cat.name] ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                                   </div>
                                   
                                   <AnimatePresence>
                                     {expandedCats[cat.name] && (
                                       <motion.div 
                                          initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}}
                                          className="overflow-hidden"
                                       >
                                          <div className="flex flex-col gap-1 pl-3 py-1">
                                            {cat.subs.map((sub, j) => (
                                              <button 
                                                key={j} 
                                                onClick={() => handleCatalogJump(sub)}
                                                className="text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                                              >
                                                  {sub}
                                              </button>
                                            ))}
                                          </div>
                                       </motion.div>
                                     )}
                                   </AnimatePresence>
                                </div>
                             ))}
                          </div>
                       </div>
                    </motion.div>
                  </>
                )}
            </AnimatePresence>

            {/* Main Content (All Items) */}
            <div className="pt-20 px-4 space-y-6">
               {phrases.map((item, index) => {
                  // 判断是否是新的一组 sub，如果是，添加 ref 用于跳转
                  const isNewSub = index === 0 || phrases[index - 1].sub !== item.sub;
                  const isLocked = !isUnlocked && index >= 50;

                  return (
                    <div key={item.id} ref={el => { if(isNewSub) itemRefs.current[item.sub] = el; }}>
                        {/* Sub Header */}
                        {isNewSub && (
                            <div className="mt-8 mb-4 flex items-center gap-2">
                                <div className="w-1 h-4 bg-blue-500 rounded-full"/>
                                <h3 className="text-sm font-bold text-slate-400">{item.sub}</h3>
                            </div>
                        )}

                        <motion.div 
                           initial={{ opacity: 0, y: 20 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           className="relative"
                        >
                           <div 
                             className={`relative bg-white pt-10 pb-5 px-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all max-w-[360px] mx-auto overflow-hidden
                             ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}
                             ${isLocked ? 'cursor-not-allowed' : 'active:scale-[0.99] cursor-pointer'}`}
                             onClick={() => isLocked ? setShowVip(true) : handleCardPlay(item)}
                           >
                              {/* Locked Overlay */}
                              {isLocked && (
                                <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
                                   <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg mb-2"><Lock size={18}/></div>
                                   <span className="text-[10px] font-bold text-slate-900 px-2 py-0.5 border border-slate-900 rounded-full">VIP</span>
                                </div>
                              )}

                              <div className={isLocked ? 'opacity-30 blur-sm pointer-events-none select-none' : ''}>
                                  {/* Xieyin (Fixed overflow issue) */}
                                  <div className="absolute top-0 inset-x-0 h-12 flex justify-center z-10 pointer-events-none">
                                      <div className="bg-amber-50 text-amber-600 px-4 h-6 flex items-center justify-center rounded-b-xl text-[10px] font-black border-b border-x border-amber-100 shadow-sm">
                                         <Zap size={10} className="mr-1 fill-amber-600"/> {item.xieyin}
                                      </div>
                                  </div>
                                  
                                  <div className="text-[13px] text-slate-400 font-mono mb-2 mt-4">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                                  <h3 className="text-2xl font-black text-slate-800 mb-2 leading-snug tracking-tight">{item.chinese}</h3>
                                  <p className="text-sm text-blue-600 font-medium mb-5 font-burmese opacity-90">{item.burmese}</p>

                                  <div className="w-full flex justify-center items-center gap-6 pt-4 border-t border-slate-50">
                                     <button onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500"><Sparkles size={18}/></button>
                                     <button onClick={(e) => { e.stopPropagation(); handleSpeech(item); }} className={`w-14 h-14 -mt-6 rounded-full flex items-center justify-center shadow-lg border-4 border-white ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                                         {recordingId === item.id ? <StopCircle size={24} className="text-white"/> : <Mic size={24}/>}
                                     </button>
                                     <button onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} className={`w-10 h-10 rounded-full flex items-center justify-center ${favorites.includes(item.id) ? 'bg-yellow-50 text-yellow-500' : 'bg-slate-50 text-slate-300'}`}><Star size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"}/></button>
                                  </div>
                              </div>
                           </div>

                           {/* Comparison Result */}
                           <AnimatePresence>
                             {speechResult?.id === item.id && !isLocked && (
                               <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                                  {renderComparison(speechResult.data)}
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </motion.div>
                    </div>
                  );
               })}
            </div>
        </div>
      )}

      {/* ================= VIP POPUP ================= */}
      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                 <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 ring-4 ring-amber-50"><Crown size={32} fill="currentColor" /></div>
                 <h3 className="text-xl font-black text-slate-900 mb-2">解锁完整版</h3>
                 <p className="text-xs text-slate-500 mb-6 leading-relaxed">当前仅预览前 50 句内容。<br/>激活口语特训包，解锁全部 10,000+ 场景会话。</p>
                 <a href="https://m.me/61575187883357" target="_blank" className="block w-full py-3.5 bg-blue-600 text-white rounded-xl font-black shadow-lg active:scale-95 transition-transform hover:bg-blue-700">联系老师激活</a>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= SPELLING MODAL ================= */}
      <AnimatePresence>
        {spellingItem && <SpellingModal item={spellingItem} settings={settings} onClose={() => setSpellingItem(null)} />}
      </AnimatePresence>

      {/* ================= BACK TOP ================= */}
      <AnimatePresence>
        {showBackTop && (
          <motion.button initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-8 right-6 w-10 h-10 bg-white shadow-xl border border-slate-100 rounded-full flex items-center justify-center text-slate-500 z-[90] active:scale-90"><ArrowUp size={20}/></motion.button>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .font-burmese { font-family: 'Padauk', sans-serif; }
      `}</style>
    </div>
  );
}
