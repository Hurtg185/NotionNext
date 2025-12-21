import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, StopCircle, ArrowUp, Sparkles, X, Volume2, Heart, Play, Square, 
  Menu, Zap, Crown, Lock, Settings2, Globe, ChevronLeft, ChevronRight, Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 引入数据
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 0. 拼音评分与对比工具 (输出用于对比的结构，红字显示)
// ============================================================================
function getPinyinComparison(targetText, userText) {
  // 清理非汉字字符
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
    
    // 简单对比：拼音完全一致
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
// 1. 核心音频引擎
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
    this.stop(); 
    const audio = new Audio(url);
    this.current = audio;
    audio.onended = () => { this.current = null; if(onEnd) onEnd(); };
    audio.onerror = () => { this.current = null; if(onEnd) onEnd(); };
    audio.play().catch(() => { this.current = null; if(onEnd) onEnd(); });
  },
  playTTS(text, voice, rate, onEnd) {
    const r = parseInt(rate) || 0; 
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    this.play(url, onEnd);
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

// 设置开关组件
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

// 拼读弹窗 (优化：速度快，自动播放)
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [recordState, setRecordState] = useState('idle'); 
  const [userAudio, setUserAudio] = useState(null);
  const chars = item.chinese.split('');

  // 挂载时自动播放整句
  useEffect(() => {
    const timer = setTimeout(() => {
        handlePlayOriginal();
    }, 300); // 稍微延迟等待动画
    return () => { clearTimeout(timer); AudioEngine.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayOriginal = async () => {
    AudioEngine.stop();
    // 如果没有选中单个字，就播放整句
    if (activeCharIndex === -1 || activeCharIndex === 'all') {
      setActiveCharIndex('all');
      AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, () => setActiveCharIndex(-1));
    } else {
      // 播放选中的字
      const char = chars[activeCharIndex];
      const py = pinyin(char, { toneType: 'symbol' });
      const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
      AudioEngine.play(r2Url);
    }
  };

  const handleCharClick = (index) => {
    // 无论当前是否选中，点击字都播放那个字
    setActiveCharIndex(index);
    AudioEngine.stop();
    const char = chars[index];
    const py = pinyin(char, { toneType: 'symbol' });
    const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
    AudioEngine.play(r2Url);
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
    // 使用 fast ease transition
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-6" onClick={onClose}>
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} 
        transition={{ duration: 0.2, ease: "easeOut" }} 
        className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl relative" 
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
        
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-slate-900 font-black text-lg">拼读练习</h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">点击汉字听单音</span>
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
            <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handlePlayOriginal}>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 border ${activeCharIndex === 'all' || activeCharIndex >= 0 ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}><Volume2 size={20}/></div>
               <span className="text-[10px] text-slate-400 font-bold">{activeCharIndex >= 0 && activeCharIndex !== 'all' ? '单字原音' : '整句原音'}</span>
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
  const [view, setView] = useState('home'); // 'home' | 'list'
  const [phrases] = useState(dailyData); 
  const [currentSub, setCurrentSub] = useState(null); 
  
  // UI 状态
  const [showCatalog, setShowCatalog] = useState(false); 
  const [showSettings, setShowSettings] = useState(false);
  const [showHeader, setShowHeader] = useState(true); // Header显隐
  const [showBackTop, setShowBackTop] = useState(false);
  
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
  
  const lastScrollY = useRef(0);

  useEffect(() => {
    // 检查 VIP 权限
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP'));

    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    
    const savedFavs = JSON.parse(localStorage.getItem('spoken_favs') || '[]');
    setFavorites(savedFavs);

    if (dailyData.length > 0 && !currentSub) {
      setCurrentSub(dailyData[0].sub); 
    }
  }, []);

  // 滚动监听 (控制Header显隐)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 400);
      
      // 下滑隐藏，上滑或停止显示
      if (y > 50 && y > lastScrollY.current) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // --- 业务逻辑 ---
  
  const enterList = () => {
    setView('list');
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    setView('home');
    window.scrollTo(0, 0);
  };

  const handleCatalogSelect = (sub) => {
    setCurrentSub(sub);
    setShowCatalog(false);
    // 列表模式下切目录：滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCardPlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    const seq = async () => {
      if (settings.zhEnabled) await new Promise(r => AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, r));
      if (AudioEngine.current?.paused) return; 
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 300));
        await new Promise(r => AudioEngine.playTTS(item.burmese, settings.myVoice, settings.myRate, r));
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

  const catalogTree = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  // 如果在列表页，则筛选；如果在Home页，随便
  const listData = useMemo(() => phrases.filter(p => p.sub === currentSub), [phrases, currentSub]);

  // 渲染评分结果 (红色错误拼音)
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
                      {/* 如果不匹配，显示红色的用户发音；匹配则显示黑色 */}
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
      
      {/* ================= VIEW 1: HOME (Cover Page) ================= */}
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

      {/* ================= VIEW 2: LIST (Content) ================= */}
      {view === 'list' && (
        <div className="min-h-screen pb-20">
            {/* Header (Auto-hide on scroll) */}
            <motion.div 
               initial={{ y: 0 }} animate={{ y: showHeader ? 0 : -80 }} 
               transition={{ ease: "easeInOut", duration: 0.3 }}
               className="fixed top-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm max-w-md mx-auto h-14 flex items-center justify-between px-4"
            >
               {/* Back Button */}
               <button onClick={goHome} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
                  <ChevronLeft size={24} />
               </button>

               {/* Center: Network Address (No Background) */}
               <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-slate-400 opacity-80 pointer-events-none">
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
            </motion.div>

            {/* Settings Dropdown */}
            <AnimatePresence>
                {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
            </AnimatePresence>

            {/* Catalog Overlay (Drawer) */}
            <AnimatePresence>
                {showCatalog && (
                  <>
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-[150] backdrop-blur-sm" onClick={() => setShowCatalog(false)} />
                    <motion.div 
                       initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:28}}
                       className="fixed inset-y-0 right-0 z-[160] w-[80%] max-w-[280px] bg-white shadow-2xl overflow-y-auto"
                    >
                       <div className="p-6">
                          <div className="flex justify-between items-center mb-6">
                             <h2 className="text-xl font-black text-slate-800">目录</h2>
                             <button onClick={() => setShowCatalog(false)} className="p-1 text-slate-400 hover:text-red-500"><X size={24}/></button>
                          </div>
                          <div className="space-y-6">
                             {catalogTree.map((cat, i) => (
                                <div key={i}>
                                   <div className="flex items-center justify-between mb-2">
                                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat.name}</h3>
                                   </div>
                                   <div className="flex flex-col gap-1 border-l-2 border-slate-100 pl-2">
                                      {cat.subs.map((sub, j) => (
                                         <button 
                                           key={j} 
                                           onClick={() => handleCatalogSelect(sub)}
                                           className={`text-left px-3 py-2 rounded-lg text-sm font-bold transition-all
                                           ${currentSub === sub ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-800'}`}
                                         >
                                            {sub}
                                         </button>
                                      ))}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </motion.div>
                  </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="pt-24 px-4 space-y-6">
               {/* Current Title Indicator */}
               <div className="text-center pb-4">
                  <h2 className="text-xl font-black text-slate-800">{currentSub}</h2>
                  <p className="text-xs text-slate-400 mt-1">Spoken Practice</p>
               </div>

               {listData.map((item, index) => {
                  const isLocked = !isUnlocked && index >= 50;

                  return (
                    <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       whileInView={{ opacity: 1, y: 0 }}
                       viewport={{ once: true }}
                       key={item.id} 
                       className="relative"
                    >
                       <div 
                         className={`relative bg-white pt-9 pb-5 px-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all max-w-[360px] mx-auto overflow-hidden
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
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-[10px] font-black border border-amber-100 shadow-sm z-10 whitespace-nowrap flex items-center gap-1">
                                 <Zap size={10} className="text-amber-500 fill-amber-500"/> {item.xieyin}
                              </div>
                              
                              <div className="text-[13px] text-slate-400 font-mono mb-2 mt-2">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                              <h3 className="text-2xl font-black text-slate-800 mb-2 leading-snug tracking-tight">{item.chinese}</h3>
                              <p className="text-sm text-blue-600 font-medium mb-5 font-burmese opacity-90">{item.burmese}</p>

                              <div className="w-full flex justify-center items-center gap-6 pt-4 border-t border-slate-50">
                                 <button onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500"><Sparkles size={18}/></button>
                                 <button onClick={(e) => { e.stopPropagation(); handleSpeech(item); }} className={`w-14 h-14 -mt-6 rounded-full flex items-center justify-center shadow-lg border-4 border-white ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
                                     {recordingId === item.id ? <StopCircle size={24}/> : <Mic size={24}/>}
                                 </button>
                                 <button onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} className={`w-10 h-10 rounded-full flex items-center justify-center ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300'}`}><Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"}/></button>
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
