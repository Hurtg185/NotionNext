import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Mic, StopCircle, ArrowUp, 
  ChevronRight, Sparkles, X, ChevronDown, Volume2, Heart, Play, Square, RefreshCw,
  Menu, Globe, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 引入数据 (假设路径一致)
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 0. 拼音评分工具 (集成 & 修改：不对比符号/声调)
// ============================================================================
const INITIALS = [
  'zh','ch','sh','b','p','m','f','d','t','n','l',
  'g','k','h','j','q','x','r','z','c','s','y','w'
];

function splitPinyin(py) {
  let initial = '';
  let final = py;
  for (const i of INITIALS) {
    if (py.startsWith(i)) {
      initial = i;
      final = py.slice(i.length);
      break;
    }
  }
  // 移除声调处理，因为要求不对比符号
  // 简单处理：韵母移除声调符号以便对比 (标准化)
  const finalClean = final.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  return { initial, final: finalClean };
}

function scorePronunciation(targetText, userText) {
  // 过滤标点符号，只比对汉字/拼音
  const cleanTarget = targetText.replace(/[^\u4e00-\u9fa5]/g, '');
  const cleanUser = userText.replace(/[^\u4e00-\u9fa5]/g, '');

  const targetPyArr = pinyin(cleanTarget, { type: 'array', toneType: 'symbol' });
  const userPyArr = pinyin(cleanUser, { type: 'array', toneType: 'symbol' });

  const details = [];
  let correct = 0;
  const len = Math.max(targetPyArr.length, userPyArr.length);

  for (let i = 0; i < len; i++) {
    const tPy = targetPyArr[i];
    const uPy = userPyArr[i];

    if (!tPy || !uPy) {
      // 缺字或多字暂不计入详细声韵母错误，仅影响整体正确率
      continue;
    }

    const t = splitPinyin(tPy);
    const u = splitPinyin(uPy);
    const errors = [];

    // 1. 对比声母
    if (t.initial !== u.initial) {
      errors.push({ part: '声母', target: t.initial || '∅', user: u.initial || '∅' });
    }

    // 2. 对比韵母 (已去除声调符号)
    if (t.final !== u.final) {
      errors.push({ part: '韵母', target: t.final, user: u.final });
    }

    // 3. 声调/符号：根据要求【不要进行对比】，此处逻辑已移除

    if (errors.length === 0) {
      correct++;
    } else {
      details.push({
        index: i,
        char: cleanTarget[i] || '',
        pinyin: tPy,
        errors
      });
    }
  }

  const accuracy = targetPyArr.length > 0 ? correct / targetPyArr.length : 0;
  return { accuracy, details, userText: cleanUser };
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
// 2. 录音机
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
      alert("请开启麦克风权限");
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
// 3. 语音识别
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
// 4. 组件：拼读练习弹窗 (UI优化版)
// ============================================================================
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1); // -1: none, 'all': full sentence, 0-N: specific char
  const [recordState, setRecordState] = useState('idle'); 
  const [userAudio, setUserAudio] = useState(null);
  const chars = item.chinese.split('');

  // 播放逻辑：如果选中单字，播放单字R2；如果未选中，播放整句TTS
  const handlePlayOriginal = async () => {
    AudioEngine.stop();
    
    // 场景1：选中了单个字
    if (typeof activeCharIndex === 'number' && activeCharIndex >= 0) {
      const char = chars[activeCharIndex];
      const py = pinyin(char, { toneType: 'symbol' });
      const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
      AudioEngine.play(r2Url);
    } 
    // 场景2：默认或全选 -> 播放整句
    else {
      setActiveCharIndex('all');
      AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, () => setActiveCharIndex(-1));
    }
  };

  const handleCharClick = (index) => {
    if (activeCharIndex === index) {
      setActiveCharIndex(-1); // Toggle off
    } else {
      setActiveCharIndex(index);
      // 立即播放点击的字
      const char = chars[index];
      const py = pinyin(char, { toneType: 'symbol' });
      const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
      AudioEngine.play(r2Url);
    }
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
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
        className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl relative" 
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部把手 */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />

        <div className="flex items-center justify-between mb-8">
            <h3 className="text-slate-900 font-black text-lg">拼读练习</h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">点击汉字听单音</span>
        </div>

        {/* 字卡区域 */}
        <div className="flex flex-wrap justify-center gap-2 mb-10 px-2">
          {chars.map((char, i) => (
            <div 
                key={i} 
                onClick={() => handleCharClick(i)}
                className={`flex flex-col items-center p-2 rounded-xl transition-all cursor-pointer select-none
                ${activeCharIndex === i ? 'bg-blue-50 ring-2 ring-blue-500 scale-110 shadow-lg' : 'hover:bg-slate-50'}`}
            >
              <span className={`text-xs font-mono mb-1 ${activeCharIndex === i ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                {pinyin(char, {toneType:'symbol'})}
              </span>
              <span className={`text-3xl font-black transition-colors ${activeCharIndex === i ? 'text-blue-800' : 'text-slate-800'}`}>
                {char}
              </span>
            </div>
          ))}
        </div>

        {/* 控制栏 */}
        <div className="flex justify-around items-center px-4 pb-4">
            {/* 原音按钮 */}
            <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handlePlayOriginal}>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 border
                   ${activeCharIndex === 'all' || activeCharIndex >= 0 ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                   <Volume2 size={20}/>
               </div>
               <span className="text-[10px] text-slate-400 font-bold">
                   {activeCharIndex >= 0 ? '单字原音' : '整句原音'}
               </span>
            </div>

            {/* 录音按钮 */}
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={toggleRecord}>
               <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 border-4 
                  ${recordState === 'recording' ? 'bg-red-500 border-red-100 ring-2 ring-red-500' : 'bg-slate-900 border-slate-100'}`}>
                  {recordState === 'recording' ? 
                    <Square size={24} className="text-white animate-pulse" fill="currentColor"/> : 
                    <Mic size={28} className="text-white"/>}
               </div>
               <span className="text-[10px] text-slate-400 font-bold">{recordState === 'recording' ? '停止录音' : '按住跟读'}</span>
            </div>

            {/* 回放按钮 */}
            <div className={`flex flex-col items-center gap-2 transition-all ${userAudio ? 'opacity-100 cursor-pointer' : 'opacity-30 pointer-events-none'}`} onClick={() => userAudio && AudioEngine.play(userAudio)}>
               <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center shadow-sm border border-green-100 active:scale-95">
                   <Play size={18} fill="currentColor"/>
               </div>
               <span className="text-[10px] text-slate-400 font-bold">我的录音</span>
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
  // 核心状态
  const [phrases] = useState(dailyData); 
  const [currentSub, setCurrentSub] = useState(null); // 当前选中的场景
  const [showCatalog, setShowCatalog] = useState(false); // 目录是否显示

  const [settings, setSettings] = useState({ zhVoice: 'zh-CN-YunxiaNeural', zhRate: -10, zhEnabled: true, myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true });
  
  // 播放与交互状态
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null);
  const [recordingId, setRecordingId] = useState(null); 
  const [speechResult, setSpeechResult] = useState(null); // { id, scoreData }
  const [favorites, setFavorites] = useState([]);
  
  // UI 状态
  const [showHeader, setShowHeader] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  const lastScrollY = useRef(0);

  // 初始化：默认选中第一个场景，加载设置
  useEffect(() => {
    const savedSet = localStorage.getItem('spoken_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
    
    const savedFavs = JSON.parse(localStorage.getItem('spoken_favs') || '[]');
    setFavorites(savedFavs);

    if (dailyData.length > 0 && !currentSub) {
      setCurrentSub(dailyData[0].sub); // 默认进入第一个分类
    }
  }, []);

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 400);
      
      // 下滑隐藏 Header，上滑显示
      if (y > 60 && y > lastScrollY.current) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 保存设置
  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // --- 业务逻辑 ---

  const handleCatalogSelect = (sub) => {
    setCurrentSub(sub);
    setShowCatalog(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCardPlay = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    
    setPlayingId(item.id);
    const seq = async () => {
      if (settings.zhEnabled) await new Promise(r => AudioEngine.playTTS(item.chinese, settings.zhVoice, settings.zhRate, r));
      if (AudioEngine.current?.paused) return; // 被打断
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
        // 使用新评分函数
        const scoreData = scorePronunciation(item.chinese, transcript);
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

  // 生成目录数据结构
  const catalogTree = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  // 当前列表数据
  const listData = useMemo(() => phrases.filter(p => p.sub === currentSub), [phrases, currentSub]);

  // 渲染评分结果（带标签）
  const renderScoreResult = (scoreData) => {
      const { details, userText, accuracy } = scoreData;
      
      return (
        <div className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-100 text-left">
           <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Recognition</span>
              <span className={`text-xs font-black ${accuracy === 1 ? 'text-green-500' : accuracy > 0.6 ? 'text-amber-500' : 'text-red-500'}`}>
                 {accuracy === 1 ? 'Perfect' : 'Keep Trying'}
              </span>
           </div>
           
           <div className="text-sm font-medium text-slate-700 mb-2">{userText}</div>

           {/* 错误详情标签 */}
           {details.length > 0 && (
             <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200/50">
               {details.map((d, idx) => (
                 <div key={idx} className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-red-100 shadow-sm">
                    <span className="text-slate-800 font-bold text-xs">{d.char}</span>
                    <div className="flex gap-0.5">
                       {d.errors.map((err, eIdx) => (
                          <span key={eIdx} className="bg-red-50 text-red-600 text-[10px] px-1 rounded-sm font-medium">
                             {err.part}
                          </span>
                       ))}
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* ================= HEADER (Auto-hide) ================= */}
      <motion.div 
        initial={{ y: 0 }} 
        animate={{ y: showHeader ? 0 : -80 }} 
        transition={{ ease: "easeInOut", duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm max-w-md mx-auto"
      >
        <div className="h-14 px-4 flex items-center justify-between">
           {/* 网站Logo区域 */}
           <a href="https://886.best" className="flex items-center gap-2 text-blue-600">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black italic text-sm shadow-md">
                 886
              </div>
              <span className="font-bold text-sm tracking-tight hidden sm:block">.best</span>
           </a>

           {/* 当前场景标题 */}
           <div className="flex-1 text-center px-4">
              <span className="text-sm font-black text-slate-800 line-clamp-1">{currentSub}</span>
           </div>

           {/* 目录触发器 */}
           <button 
             onClick={() => setShowCatalog(true)} 
             className="w-9 h-9 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center active:scale-90 transition-transform hover:bg-slate-100"
           >
             <Menu size={18}/>
           </button>
        </div>
      </motion.div>

      {/* ================= CATALOG OVERLAY (Quick Jump) ================= */}
      <AnimatePresence>
        {showCatalog && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-[150] backdrop-blur-sm" onClick={() => setShowCatalog(false)} />
            <motion.div 
               initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring', damping:25}}
               className="fixed inset-y-0 right-0 z-[160] w-3/4 max-w-xs bg-white shadow-2xl overflow-y-auto"
            >
               <div className="p-5">
                  <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-black text-slate-800">快速跳转</h2>
                     <button onClick={() => setShowCatalog(false)} className="p-1 text-slate-400"><X size={24}/></button>
                  </div>
                  <div className="space-y-4">
                     {catalogTree.map((cat, i) => (
                        <div key={i}>
                           <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider ml-1">{cat.name}</h3>
                           <div className="grid grid-cols-1 gap-2">
                              {cat.subs.map((sub, j) => (
                                 <button 
                                   key={j} 
                                   onClick={() => handleCatalogSelect(sub)}
                                   className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all
                                   ${currentSub === sub ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
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

      {/* ================= MAIN CONTENT LIST ================= */}
      <div className="pt-20 pb-32 px-4 space-y-6 min-h-screen">
         {listData.map((item, index) => (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             key={item.id} 
             className="relative"
           >
              <div 
                className={`relative bg-white pt-9 pb-5 px-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all active:scale-[0.99] max-w-[360px] mx-auto
                ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
                onClick={() => handleCardPlay(item)}
              >
                 {/* 谐音胶囊 */}
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-[10px] font-black border border-amber-100 shadow-sm z-10 whitespace-nowrap flex items-center gap-1">
                    <Zap size={10} className="text-amber-500 fill-amber-500"/> {item.xieyin}
                 </div>
                 
                 <div className="text-[13px] text-slate-400 font-mono mb-2 mt-2">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                 <h3 className="text-2xl font-black text-slate-800 mb-2 leading-snug tracking-tight">{item.chinese}</h3>
                 <p className="text-sm text-blue-600 font-medium mb-5 font-burmese opacity-90">{item.burmese}</p>

                 {/* 底部工具栏 */}
                 <div className="w-full flex justify-center items-center gap-6 pt-4 border-t border-slate-50">
                    <button onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors">
                        <Sparkles size={18}/>
                    </button>
                    
                    <button onClick={(e) => { e.stopPropagation(); handleSpeech(item); }} className={`w-14 h-14 -mt-6 rounded-full flex items-center justify-center transition-all shadow-lg border-4 border-white ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
                        {recordingId === item.id ? <StopCircle size={24}/> : <Mic size={24}/>}
                    </button>
                    
                    <button onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300 hover:text-pink-300'}`}>
                        <Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"}/>
                    </button>
                 </div>
              </div>

              {/* 评分结果展示区 */}
              <AnimatePresence>
                {speechResult?.id === item.id && (
                  <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                     {renderScoreResult(speechResult.data)}
                  </motion.div>
                )}
              </AnimatePresence>

           </motion.div>
         ))}

         {listData.length === 0 && (
             <div className="text-center py-20 text-slate-400">
                 <p>正在加载或该分类下无数据...</p>
             </div>
         )}
      </div>

      {/* ================= MODALS & TOOLS ================= */}
      
      {/* 拼读弹窗 */}
      <AnimatePresence>
        {spellingItem && (
            <SpellingModal item={spellingItem} settings={settings} onClose={() => setSpellingItem(null)} />
        )}
      </AnimatePresence>

      {/* 回到顶部 */}
      <AnimatePresence>
        {showBackTop && (
          <motion.button 
            initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} 
            onClick={() => window.scrollTo({top:0, behavior:'smooth'})} 
            className="fixed bottom-8 right-6 w-10 h-10 bg-white shadow-xl border border-slate-100 rounded-full flex items-center justify-center text-slate-500 z-[90] active:scale-90"
          >
            <ArrowUp size={20}/>
          </motion.button>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .font-burmese { font-family: 'Padauk', sans-serif; }
      `}</style>
    </div>
  );
}
