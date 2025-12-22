import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, StopCircle, ArrowUp, Sparkles, X, Volume2, Star, Play, Square, 
  Menu, Zap, Crown, Lock, Settings2, Globe, ChevronLeft, ChevronRight, 
  ChevronDown, ChevronUp, Home, CheckCircle2, BookOpen, Loader2, Heart
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// ============================================================================
// 引入数据源
// ============================================================================
import dailyData from '@/data/spoken/daily10k.js'; 
import { CategoryTrans, SubTrans } from '@/data/spoken/categoryConfig.js';

// ============================================================================
// 0. 工具函数
// ============================================================================

const getBilingualText = (text, type = 'sub') => {
    const map = type === 'cat' ? CategoryTrans : SubTrans;
    const en = map[text];
    return en ? `${text} | ${en}` : text;
};

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
    result.push({ targetChar: cleanTarget[i] || '', targetPy: t, userPy: u, isMatch, isMissing: !u });
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
  play(url) {
    return new Promise((resolve) => {
      this.stop(); 
      if (typeof window === 'undefined' || !url) { resolve(); return; }
      
      const audio = new Audio(url);
      this.current = audio;
      
      audio.onended = () => { this.current = null; resolve(); };
      audio.onerror = () => { this.current = null; resolve(); };
      audio.play().catch(() => { this.current = null; resolve(); });
    });
  },
  playTTS(text, voice, rate) {
    const r = parseInt(rate) || 0; 
    const url = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    return this.play(url);
  }
};

// ============================================================================
// 2. 录音与识别
// ============================================================================
const RecorderEngine = {
  mediaRecorder: null, chunks: [],
  async start() {
    AudioEngine.stop();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];
      this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
      this.mediaRecorder.start();
      return true;
    } catch (e) { alert("请开启麦克风权限 | မိုက်ခရိုဖုန်းဖွင့်ပါ"); return false; }
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
    AudioEngine.stop();
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("浏览器不支持语音识别 | Browser doesn't support speech recognition"); if(onError) onError(); return; }
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
// 3. 子组件：设置面板
// ============================================================================
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, scale: 0.95 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-16 right-4 z-[2000] bg-white rounded-2xl shadow-2xl border border-slate-100 w-72 overflow-hidden"
      onClick={(e) => e.stopPropagation()} 
    >
       <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-100">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">播放设置 | Play Settings</span>
          <button onClick={onClose}><X size={16} className="text-slate-400 hover:text-red-500"/></button>
       </div>
       <div className="p-5 space-y-5">
          {/* 中文设置 */}
          <div className="space-y-2">
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">中文朗读 | တရုတ်အသံ</span>
                <div 
                   onClick={() => setSettings(s => ({...s, zhEnabled: !s.zhEnabled}))}
                   className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${settings.zhEnabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                >
                   <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.zhEnabled ? 'left-4.5' : 'left-0.5'}`} style={{left: settings.zhEnabled ? '18px' : '2px'}}/>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '小晓 (女)', val: 'zh-CN-XiaochenMultilingualNeural' },
                  { label: '小红 (女)', val: 'fr-FR-VivienneMultilingualNeural' },
                  { label: '云夏 (男童)', val: 'zh-CN-YunxiaNeural' },
                  { label: '小颜 (通用)', val: 'zh-CN-XiaoyanNeural' }
                ].map(opt => (
                  <button 
                    key={opt.val}
                    onClick={() => setSettings(s => ({...s, zhVoice: opt.val}))}
                    className={`py-1.5 text-[10px] font-bold rounded border transition-all truncate ${settings.zhVoice === opt.val ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400'}`}
                  >
                    {opt.label}
                  </button>
                ))}
             </div>
             <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-400">语速 | Speed</span>
                <input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-blue-500"/>
                <span className="text-[10px] w-6 text-right font-mono text-slate-400">{settings.zhRate}</span>
             </div>
          </div>

          <div className="h-[1px] bg-slate-50"/>

          {/* 缅文设置 */}
          <div className="space-y-2">
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">缅文朗读 | မြန်မာအသံ</span>
                <div 
                   onClick={() => setSettings(s => ({...s, myEnabled: !s.myEnabled}))}
                   className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${settings.myEnabled ? 'bg-green-500' : 'bg-slate-200'}`}
                >
                   <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform`} style={{left: settings.myEnabled ? '18px' : '2px'}}/>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Thiha (男)', val: 'my-MM-ThihaNeural' },
                  { label: 'Nilar (女)', val: 'my-MM-NilarNeural' }
                ].map(opt => (
                  <button 
                    key={opt.val}
                    onClick={() => setSettings(s => ({...s, myVoice: opt.val}))}
                    className={`py-1.5 text-[10px] font-bold rounded border transition-all truncate ${settings.myVoice === opt.val ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-slate-100 text-slate-400'}`}
                  >
                    {opt.label}
                  </button>
                ))}
             </div>
             <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-400">语速 | Speed</span>
                <input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-green-500"/>
                <span className="text-[10px] w-6 text-right font-mono text-slate-400">{settings.myRate}</span>
             </div>
          </div>
       </div>
    </motion.div>
  );
};

// ============================================================================
// 4. 子组件：拼读弹窗
// ============================================================================
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [recordState, setRecordState] = useState('idle'); 
  const [userAudio, setUserAudio] = useState(null);
  const chars = item.chinese.split('');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    AudioEngine.stop(); 
    const autoSpell = async () => {
        await new Promise(r => setTimeout(r, 200)); 
        if (!isMounted.current) return;
        for (let i = 0; i < chars.length; i++) {
            if (!isMounted.current) break;
            setActiveCharIndex(i);
            const py = pinyin(chars[i], { toneType: 'symbol' });
            const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
            await AudioEngine.play(r2Url);
            await new Promise(r => setTimeout(r, 50)); 
        }
        if (isMounted.current) setActiveCharIndex(-1);
    };
    autoSpell();
    return () => { isMounted.current = false; AudioEngine.stop(); };
  }, []);

  const handleCharClick = (index) => {
    setActiveCharIndex(index);
    const char = chars[index];
    const py = pinyin(char, { toneType: 'symbol' });
    const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
    AudioEngine.play(r2Url);
  };

  const playWhole = () => {
     setActiveCharIndex('all');
     AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate).then(() => setActiveCharIndex(-1));
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
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-slate-900 font-black text-lg">拼读练习 | စာလုံးပေါင်း</h3>
            <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-1 rounded font-bold animate-pulse">自动演示中...</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-10 px-2">
          {chars.map((char, i) => (
            <div key={i} onClick={() => handleCharClick(i)} className={`flex flex-col items-center p-2 rounded-xl transition-all cursor-pointer select-none ${activeCharIndex === i ? 'bg-blue-50 ring-2 ring-blue-500 scale-110 shadow-lg' : 'hover:bg-slate-50'}`}>
              <span className={`text-xs font-pinyin mb-1 ${activeCharIndex === i ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>{pinyin(char, {toneType:'symbol'})}</span>
              <span className={`text-3xl font-black ${activeCharIndex === i ? 'text-blue-800' : 'text-slate-800'}`}>{char}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-around items-center px-4 pb-4">
            <div onClick={playWhole} className="flex flex-col items-center gap-2 cursor-pointer"><Volume2 size={24}/> <span className="text-[10px]">整句 | စာကြောင်း</span></div>
            <div onClick={toggleRecord} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl border-4 ${recordState === 'recording' ? 'bg-red-500 border-red-100' : 'bg-slate-100'}`}>
               {recordState === 'recording' ? <Square size={24} className="text-white"/> : <Mic size={28}/>}
            </div>
            <div onClick={() => userAudio && AudioEngine.play(userAudio)} className={`flex flex-col items-center gap-2 ${userAudio ? '' : 'opacity-30'}`}><Play size={24}/> <span className="text-[10px]">回放 | ပြန်ဖွင့်ပါ</span></div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// 5. 主组件
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('home'); 
  const [phrases] = useState(dailyData); 

  // 收藏相关
  const [favorites, setFavorites] = useState([]);
  const [isFavMode, setIsFavMode] = useState(false); // 🔥 新增：是否处于收藏模式

  // 可见数量控制与无限滚动
  const [visibleCount, setVisibleCount] = useState(20); 
  const loaderRef = useRef(null); 
  
  // UI 状态
  const [showCatalog, setShowCatalog] = useState(false); 
  const [showSettings, setShowSettings] = useState(false);
  const [expandedCats, setExpandedCats] = useState({}); 
  const [isHeaderVisible, setIsHeaderVisible] = useState(true); 

  const [settings, setSettings] = useState({ 
      zhVoice: 'zh-CN-XiaoxiaoMultilingualNeural', zhRate: -20, zhEnabled: true, 
      myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true 
  });
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null);
  const [recordingId, setRecordingId] = useState(null); 
  const [speechResult, setSpeechResult] = useState(null); 
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVip, setShowVip] = useState(false);
  
  const { scrollY } = useScroll();
  const itemRefs = useRef({});

  useEffect(() => {
    // 1. 读取用户信息和设置
    const user = JSON.parse(localStorage.getItem('hsk_user') || '{}');
    setIsUnlocked((user.unlocked_levels || '').includes('SP')); 
    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    
    // 2. 读取收藏
    setFavorites(JSON.parse(localStorage.getItem('spoken_favs') || '[]'));

    // 3. 🔥 核心逻辑：检查 URL 是否带有收藏过滤器
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('filter') === 'favorites') {
          setView('list');
          setIsFavMode(true);
      }
    }
  }, []);

  // 返回时清除状态
  useEffect(() => {
    const onPopState = () => { 
        if (view === 'list') { 
            AudioEngine.stop(); 
            // 如果是收藏模式返回，重置模式
            if (isFavMode) {
               window.history.replaceState(null, '', '/spoken'); // 清除 URL 参数
               setIsFavMode(false);
            }
            setView('home'); 
        } 
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [view, isFavMode]);

  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious();
    setIsHeaderVisible(!(latest > previous && latest > 50));
    if (view === 'list' && !isFavMode) { // 仅在非收藏模式下保存位置
        localStorage.setItem('spoken_scroll_pos', latest.toString());
        localStorage.setItem('spoken_visible_count', visibleCount.toString()); 
    }
  });

  // 🔥 核心逻辑：计算当前显示的列表
  const displayPhrases = useMemo(() => {
      if (isFavMode) {
          // 如果是收藏模式，只返回在 favorites 数组中的 ID 对应的句子
          // 注意：favorites 存的是 ID，所以需要 filter
          return phrases.filter(p => favorites.includes(p.id));
      }
      return phrases;
  }, [phrases, favorites, isFavMode]);

  useEffect(() => {
    if (view !== 'list') return;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + 20, displayPhrases.length));
        }
    }, { root: null, rootMargin: '200px', threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => { if (loaderRef.current) observer.unobserve(loaderRef.current); };
  }, [view, displayPhrases.length]);

  const catalogTree = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  const enterList = (targetSub = null) => {
    window.history.pushState({ page: 'list' }, '', '');
    let targetCount = 20;
    
    // 只要是从目录进入，就退出收藏模式
    setIsFavMode(false);

    if (targetSub) {
        const idx = phrases.findIndex(p => p.sub === targetSub);
        if (idx !== -1) targetCount = idx + 20; 
    } else {
        const savedCount = parseInt(localStorage.getItem('spoken_visible_count') || '20');
        targetCount = Math.max(20, savedCount);
    }
    setVisibleCount(targetCount);
    setView('list');
    
    setTimeout(() => {
        if (targetSub) {
            const el = itemRefs.current[targetSub];
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else if (!targetSub) {
             const savedPos = localStorage.getItem('spoken_scroll_pos');
             if (savedPos) window.scrollTo({ top: parseInt(savedPos), behavior: 'auto' });
        }
    }, 100);
  };

  const goHome = () => { 
      AudioEngine.stop(); 
      if (isFavMode) {
          window.history.back(); // 收藏模式返回上一页
      } else {
          window.history.back(); // 普通模式返回主页
      }
  };

  const handleCatalogJump = (sub) => {
    setShowCatalog(false);
    const idx = phrases.findIndex(p => p.sub === sub);
    if (idx !== -1 && idx >= visibleCount) setVisibleCount(idx + 20);
    setTimeout(() => {
        const el = itemRefs.current[sub];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCardPlay = async (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    if (settings.zhEnabled) await AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate);
    if (AudioEngine.current === null) { setPlayingId(null); return; }
    if (settings.myEnabled) {
      if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
      if (AudioEngine.current === null && settings.zhEnabled) { setPlayingId(null); return; }
      await AudioEngine.playTTS(item.burmese, settings.myVoice, settings.myRate);
    }
    setPlayingId(null);
  };

  const handleSpeech = (item) => {
    if (recordingId === item.id) { SpeechEngine.stop(); setRecordingId(null); } else {
      AudioEngine.stop(); setRecordingId(item.id); setSpeechResult(null);
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

  const toggleCat = (catName) => {
    setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* ================= VIEW 1: HOME ================= */}
      {view === 'home' && (
         <div className="min-h-screen bg-white">
            <div className="relative h-64 overflow-hidden">
               <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
               <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
               <div className="absolute bottom-6 left-6 right-6">
                  <div className="inline-block px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded mb-2 shadow-sm">口语特训</div>
                  <h1 className="text-3xl font-black text-slate-900 mb-1 leading-tight">汉缅会话精选20000句</h1>
                  <p className="text-slate-600 text-xs font-medium font-burmese leading-relaxed">တရုတ်-မြန်မာ စကားပြော ရွေးချယ်စုစည်းမှု ဝါကျ ၂၀၀၀၀</p>
               </div>
               
               <div onClick={() => window.location.href = 'https://886.best'} className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 z-20 cursor-pointer active:scale-95 transition-transform hover:bg-black/30">
                   <Globe size={12} className="text-white"/> <span className="text-[10px] font-bold text-white tracking-widest">886.best</span>
               </div>
            </div>

            <div className="px-6 mb-8">
                <button 
                  onClick={() => enterList(null)} 
                  className="w-full py-4 bg-gradient-to-r from-sky-50 to-indigo-50 border border-blue-100 text-slate-800 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-blue-600"/> 
                    <span>继续上次阅读</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-burmese font-normal">ပြီးခဲ့သည့်စာဖတ်ခြင်းကို ဆက်ရန်</span>
                </button>
            </div>

            <div className="px-4 pb-20 space-y-4">
               <h2 className="px-2 text-sm font-black text-slate-400 uppercase tracking-widest">Directory</h2>
               {catalogTree.map((cat, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                     <div onClick={() => toggleCat(cat.name)} className="flex items-center justify-between p-4 cursor-pointer active:bg-slate-50">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center font-bold text-xs">{i + 1}</div>
                           <span className="font-bold text-slate-800 text-sm">{getBilingualText(cat.name, 'cat')}</span>
                        </div>
                        {expandedCats[cat.name] ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                     </div>
                     
                     <AnimatePresence>
                        {expandedCats[cat.name] && (
                           <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden bg-slate-50/50">
                              <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
                                 {cat.subs.map((sub, j) => (
                                    <button key={j} onClick={() => enterList(sub)} className="text-left px-3 py-2 bg-white border border-slate-100 rounded-lg text-xs font-medium text-slate-600 active:scale-95 transition-transform h-auto break-words leading-tight">
                                       {getBilingualText(sub, 'sub')}
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
      )}

      {/* ================= VIEW 2: LIST ================= */}
      {view === 'list' && (
        <div className="min-h-screen pb-32 bg-[#F5F7FA]">
            <div onClick={() => window.location.href = 'https://886.best'} className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 pointer-events-auto cursor-pointer drop-shadow-sm hover:scale-105 transition-transform bg-white/50 px-2 py-1 rounded-full backdrop-blur-sm">
                <Globe size={14} className="text-slate-800"/>
                <span className="text-xs font-black text-slate-800 tracking-tight">886.best</span>
            </div>

            <motion.div 
               animate={{ y: isHeaderVisible ? 0 : -80 }} 
               className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-100 h-14 max-w-md mx-auto px-4 flex justify-between items-center"
            >
               <button onClick={goHome} className="p-2 -ml-2 text-slate-500 hover:text-slate-900"><ChevronLeft size={24} /></button>
               
               {/* 🔥 标题栏变化：收藏模式显示标题 */}
               {isFavMode && (
                 <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <span className="text-sm font-black text-slate-800">我的收藏</span>
                    <span className="text-[10px] text-slate-400 font-burmese">မှတ်ထားသော စကားပြော</span>
                 </div>
               )}

               <div className="flex items-center gap-1">
                   <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-slate-400 hover:text-blue-600"><Settings2 size={20} /></button>
                   {/* 收藏模式下隐藏目录按钮 */}
                   {!isFavMode && (
                      <button onClick={() => setShowCatalog(true)} className="p-2 text-slate-600 hover:text-blue-600"><Menu size={20} /></button>
                   )}
               </div>
            </motion.div>

            <AnimatePresence>
              {showSettings && (
                <>
                  {/* 透明遮罩层，点击此处关闭设置 */}
                  <div className="fixed inset-0 z-[1999]" onClick={() => setShowSettings(false)} />
                  <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />
                </>
              )}
            </AnimatePresence>

            <AnimatePresence>
                {showCatalog && (
                  <>
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-[150] backdrop-blur-sm" onClick={() => setShowCatalog(false)} />
                    <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} className="fixed inset-y-0 right-0 z-[160] w-[80%] max-w-[280px] bg-white shadow-2xl overflow-y-auto">
                       <div className="p-5">
                          <div className="flex justify-between items-center mb-6">
                             <div className="flex flex-col">
                               <h2 className="text-lg font-black text-slate-800">快速跳转</h2>
                               <span className="text-xs text-slate-400 font-burmese">အမြန်သွားရန်</span>
                             </div>
                             <button onClick={() => setShowCatalog(false)}><X size={20} className="text-slate-400"/></button>
                          </div>
                          <div className="space-y-4">
                             {catalogTree.map((cat, i) => (
                                <div key={i} className="border-b border-slate-50 pb-2">
                                   <div onClick={() => toggleCat(cat.name)} className="flex items-center justify-between py-2 cursor-pointer">
                                       <h3 className="text-sm font-bold text-slate-700">{getBilingualText(cat.name, 'cat')}</h3>
                                       {expandedCats[cat.name] ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                                   </div>
                                   <AnimatePresence>
                                     {expandedCats[cat.name] && (
                                       <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
                                          <div className="pl-3 flex flex-col gap-1 pb-2">
                                            {cat.subs.map((sub, j) => (
                                              <button key={j} onClick={() => handleCatalogJump(sub)} className="text-left py-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 truncate">
                                                  {getBilingualText(sub, 'sub')}
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

            <div className="pt-20 px-3 space-y-4">
               {/* 🔥 空状态处理 */}
               {isFavMode && displayPhrases.length === 0 && (
                   <div className="flex flex-col items-center justify-center pt-32 text-slate-400">
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                           <Heart size={32} className="text-slate-300" />
                       </div>
                       <p className="text-sm font-bold">还没有收藏的句子</p>
                       <p className="text-xs font-burmese mt-1">မှတ်ထားသော စာကြောင်း မရှိသေးပါ</p>
                       <button onClick={() => { setIsFavMode(false); setView('home'); }} className="mt-6 px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold active:scale-95 transition-transform">
                           去浏览课程 (Browse Lessons)
                       </button>
                   </div>
               )}

               {displayPhrases.slice(0, visibleCount).map((item, index) => {
                  // 在收藏模式下，不显示分类标题
                  const isNewSub = !isFavMode && (index === 0 || displayPhrases[index - 1].sub !== item.sub);
                  // 收藏模式下，不锁定VIP
                  const isLocked = !isFavMode && !isUnlocked && index >= 50;

                  return (
                    <div key={item.id} ref={el => { if(isNewSub && !isFavMode) itemRefs.current[item.sub] = el; }}>
                        {isNewSub && (
                            <div className="mt-8 mb-3 pl-2 border-l-4 border-blue-500 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800">{getBilingualText(item.sub, 'sub')}</h3>
                            </div>
                        )}

                        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                           <div 
                             className={`relative bg-white pt-10 pb-4 px-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all max-w-[360px] mx-auto overflow-visible mt-6
                             ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}
                             ${isLocked ? 'cursor-pointer' : 'active:scale-[0.98] cursor-pointer'}`}
                             onClick={() => isLocked ? setShowVip(true) : handleCardPlay(item)}
                           >
                              {isLocked && (
                                <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] rounded-[1.5rem] flex flex-col items-center justify-center">
                                   <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg mb-2 animate-bounce"><Lock size={18}/></div>
                                   <span className="text-[10px] font-bold text-slate-900 px-2 py-0.5 border border-slate-900 rounded-full">VIP 点击解锁</span>
                                </div>
                              )}
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 w-full flex justify-center pointer-events-none">
                                  <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black border border-amber-100 shadow-sm flex items-center gap-1 whitespace-nowrap">
                                     <Zap size={10} className="fill-amber-500 text-amber-500"/> {item.xieyin}
                                  </div>
                              </div>

                              <div className={isLocked ? 'opacity-30 blur-sm pointer-events-none' : ''}>
                                  <div className="text-[13px] text-slate-400 font-pinyin mb-1.5">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                                  <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">{item.chinese}</h3>
                                  <p className="text-sm text-blue-600 font-medium mb-4 font-burmese">{item.burmese}</p>

                                  <div className="w-full flex justify-center items-center gap-5 pt-3 border-t border-slate-50">
                                     <button onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} className="w-9 h-9 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500"><Sparkles size={16}/></button>
                                     <button onClick={(e) => { e.stopPropagation(); handleSpeech(item); }} className={`w-12 h-12 -mt-4 rounded-full flex items-center justify-center shadow-md border-4 border-white ${recordingId === item.id ? 'bg-slate-100 text-slate-500 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                                         {recordingId === item.id ? <StopCircle size={20}/> : <Mic size={20}/>}
                                     </button>
                                     <button onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} className={`w-9 h-9 rounded-full flex items-center justify-center ${favorites.includes(item.id) ? 'bg-yellow-50 text-yellow-500' : 'bg-slate-50 text-slate-300'}`}><Star size={16} fill={favorites.includes(item.id) ? "currentColor" : "none"}/></button>
                                  </div>
                              </div>
                           </div>
                           
                           <AnimatePresence>
                             {speechResult?.id === item.id && !isLocked && (
                               <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="bg-white mx-auto max-w-[360px] rounded-xl mt-2 p-3 shadow-sm border border-slate-100">
                                  <div className="flex justify-between items-center mb-2">
                                     <span className="text-[10px] font-bold text-slate-400">评分 | ရမှတ်</span>
                                     <span className={`text-xs font-black ${speechResult.data.accuracy > 0.8 ? 'text-green-500' : 'text-red-500'}`}>{Math.round(speechResult.data.accuracy * 100)}%</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 justify-center">
                                      {speechResult.data.comparison.map((r, idx) => (
                                          <div key={idx} className="flex flex-col items-center">
                                              <span className={`text-xs font-pinyin font-bold ${r.isMatch ? 'text-slate-800' : 'text-red-500'}`}>{r.userPy || '?'}</span>
                                              <span className="text-[10px] text-slate-400">{r.targetChar}</span>
                                          </div>
                                      ))}
                                  </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </motion.div>
                    </div>
                  );
               })}
               
               {/* 底部加载指示器 (仅在有内容且未显示完时显示) */}
               {displayPhrases.length > 0 && (
                 <div ref={loaderRef} className="py-10 text-center text-slate-400">
                     {visibleCount < displayPhrases.length ? (
                         <div className="flex items-center justify-center gap-2 text-xs font-bold animate-pulse">
                             <Loader2 className="animate-spin" size={16}/> 正在加载更多...
                         </div>
                     ) : (
                         <div className="flex flex-col items-center gap-2 opacity-50">
                             <div className="w-12 h-1 bg-slate-200 rounded-full"/>
                             <span className="text-[10px]">到底了 (Total: {displayPhrases.length})</span>
                         </div>
                     )}
                 </div>
               )}
            </div>
        </div>
      )}

      <AnimatePresence>
        {showVip && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
             <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl">
                 <button onClick={() => setShowVip(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                 <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg ring-4 ring-orange-100">
                     <Crown size={32} fill="currentColor" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 mb-2">解锁完整课程</h3>
                 <p className="text-xs text-slate-500 mb-4 font-burmese">သင်ခန်းစာအပြည့်အစုံကို ဖွင့်ပါ</p>
                 <ul className="text-left text-xs text-slate-500 space-y-2 mb-8 bg-slate-50 p-4 rounded-xl">
                     <li className="flex gap-2 items-center"><CheckCircle2 size={14} className="text-green-500"/> 解锁 20,000+ 完整句子</li>
                     <li className="flex gap-2 items-center"><CheckCircle2 size={14} className="text-green-500"/> 开启 AI 语音评测</li>
                     <li className="flex gap-2 items-center"><CheckCircle2 size={14} className="text-green-500"/> 永久有效，无限回放</li>
                 </ul>
                 <a href="https://m.me/61575187883357" target="_blank" className="block w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform hover:bg-slate-800">
                     联系老师激活 (60,000 Ks)
                 </a>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {spellingItem && <SpellingModal item={spellingItem} settings={settings} onClose={() => setSpellingItem(null)} />}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .font-burmese { font-family: 'Padauk', sans-serif; }
        .font-pinyin { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
      `}</style>
    </div>
  );
}
