import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, Loader2, 
  Settings2, Mic, StopCircle, Home, ArrowUp, 
  ChevronRight, Sparkles, X, Volume2, Heart, Play, Square, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 引入数据
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 1. 音频引擎 (独占、数值语速)
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
  // 播放 TTS
  play(text, voice, rate, onEnd) {
    if (typeof window === 'undefined' || !text) return;
    this.stop();
    const r = parseInt(rate) || 0; 
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    const audio = new Audio(url);
    this.current = audio;
    audio.onended = () => { this.current = null; if(onEnd) onEnd(); };
    audio.onerror = () => { this.current = null; if(onEnd) onEnd(); };
    audio.play().catch(() => { this.current = null; if(onEnd) onEnd(); });
  },
  // 播放 URL (R2)
  playUrl(url, onEnd) {
    if (typeof window === 'undefined') return;
    this.stop();
    const audio = new Audio(url);
    this.current = audio;
    audio.onended = () => { this.current = null; if(onEnd) onEnd(); };
    audio.onerror = () => { if(onEnd) onEnd(); };
    audio.play().catch(() => { if(onEnd) onEnd(); });
  }
};

// ============================================================================
// 2. 录音机 (用于拼读窗口)
// ============================================================================
const RecorderEngine = {
  mediaRecorder: null,
  chunks: [],
  async start() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];
      this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
      this.mediaRecorder.start();
      return true;
    } catch (e) {
      alert("无法访问麦克风，请在浏览器设置中允许权限");
      return false;
    }
  },
  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
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
    if (!SR) {
      alert("您的浏览器不支持语音识别，请使用 Chrome/Safari");
      if(onError) onError();
      return;
    }
    this.recognition = new SR();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    this.recognition.onerror = (e) => { console.error(e); if(onError) onError(); };
    this.recognition.onend = () => { if(onError) onError(); };
    try {
      this.recognition.start();
    } catch(e) { if(onError) onError(); }
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
  
  // 打开自动拼读
  useEffect(() => {
    let isMounted = true;
    const sequence = async () => {
      const chars = item.chinese.split('');
      // 1. 逐字 R2
      for (let i = 0; i < chars.length; i++) {
        if(!isMounted) return;
        setActiveCharIndex(i);
        const py = pinyin(chars[i], { toneType: 'symbol' });
        const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
        await new Promise(r => AudioEngine.playUrl(r2Url, r));
        await new Promise(r => setTimeout(r, 150));
      }
      // 2. 整句 TTS
      if(!isMounted) return;
      setActiveCharIndex('all');
      await new Promise(r => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, r));
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
      AudioEngine.stop(); // 录音前停止播放
      const success = await RecorderEngine.start();
      if (success) setRecordState('recording');
    }
  };

  const playUserAudio = () => {
    if (userAudio) {
        AudioEngine.stop();
        new Audio(userAudio).play();
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
        className="bg-white w-full max-w-xs rounded-[2rem] p-6 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 p-2"><X size={24}/></button>
        <h3 className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">拼读演示 & 录音</h3>

        {/* 拼音大字 */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {item.chinese.split('').map((char, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className={`text-sm font-mono mb-1 transition-colors ${activeCharIndex === i ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>
                {pinyin(char, {toneType:'symbol'})}
              </span>
              <span className={`text-3xl font-black transition-all ${activeCharIndex === i || activeCharIndex === 'all' ? 'text-slate-800 scale-125' : 'text-slate-300'}`}>
                {char}
              </span>
            </div>
          ))}
        </div>

        {/* 底部操作区 */}
        <div className="flex justify-around items-center px-2">
            {/* 重播 */}
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => { setActiveCharIndex(-1); setTimeout(() => setActiveCharIndex(0), 10); }}>
               <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center shadow-sm active:scale-95">
                  <RefreshCw size={18}/>
               </div>
               <span className="text-[10px] text-slate-400">重播</span>
            </div>

            {/* 录音按钮 (大) */}
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={toggleRecord}>
               <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${recordState === 'recording' ? 'bg-red-500 ring-4 ring-red-200' : 'bg-blue-600'}`}>
                  {recordState === 'recording' ? <Square size={20} className="text-white animate-pulse" fill="currentColor"/> : <Mic size={24} className="text-white"/>}
               </div>
               <span className="text-[10px] text-slate-500">{recordState === 'recording' ? '停止' : '录音'}</span>
            </div>

            {/* 回放 */}
            <div className={`flex flex-col items-center gap-2 transition-all ${userAudio ? 'opacity-100 cursor-pointer' : 'opacity-30 pointer-events-none'}`} onClick={playUserAudio}>
               <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm active:scale-95">
                  <Play size={18} fill="currentColor"/>
               </div>
               <span className="text-[10px] text-slate-500">我的</span>
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
  const [view, setView] = useState('catalog'); // 默认直接显示目录
  const [phrases] = useState(dailyData); 
  const [selectedSub, setSelectedSub] = useState(null); // 选中的小主题
  
  // 设置
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // 状态
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null);
  const [recordingId, setRecordingId] = useState(null); 
  const [speechResult, setSpeechResult] = useState(null); // {id, text, score}
  const [favorites, setFavorites] = useState([]);
  
  // 交互
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

    // 进度恢复
    const progress = JSON.parse(localStorage.getItem('spoken_progress'));
    if (progress && progress.view === 'list' && progress.sub) {
        setSelectedSub(progress.sub);
        setView('list');
        // 手势返回支持：恢复到列表页时，也push一个历史记录
        window.history.replaceState({ page: 'list' }, '');
        setTimeout(() => window.scrollTo(0, progress.scrollY || 0), 100);
    } else {
        window.history.replaceState({ page: 'catalog' }, '');
    }
  }, []);

  // 监听浏览器返回 (手势返回)
  useEffect(() => {
    const handlePopState = (event) => {
      // 如果当前是 list，且按了返回，则回到 catalog
      if (view === 'list') {
        setView('catalog');
        setSelectedSub(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // 保存设置 & 进度
  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => {
    if (view === 'list') {
        localStorage.setItem('spoken_progress', JSON.stringify({ view: 'list', sub: selectedSub, scrollY: window.scrollY }));
    }
  }, [view, selectedSub]);

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowBackTop(y > 300);
      if (y < lastScrollY.current || y < 50) setShowHeader(true);
      else if (y > lastScrollY.current && y > 80) setShowHeader(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- 业务逻辑 ---

  const handleEnterList = (sub) => {
    setSelectedSub(sub);
    setView('list');
    window.scrollTo(0, 0);
    // 关键：Push 一个历史记录，这样按返回键/手势返回时，不会直接退出页面
    window.history.pushState({ page: 'list' }, '');
  };

  const handleCardPlay = (item) => {
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

  const handleSpeech = (item) => {
    if (recordingId === item.id) { 
        SpeechEngine.stop(); 
        setRecordingId(null); 
    } else {
        AudioEngine.stop(); // 停止其他播放
        setRecordingId(item.id);
        setSpeechResult(null);
        SpeechEngine.start((text) => {
            setSpeechResult({ id: item.id, text });
            setRecordingId(null);
        }, () => {
            setRecordingId(null);
            // alert("未检测到语音");
        });
    }
  };

  const toggleFav = (id) => {
    const newFavs = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem('spoken_favs', JSON.stringify(newFavs));
  };

  // 整理目录
  const catalog = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({ name: cat, subs: Array.from(subs) }));
  }, [phrases]);

  const listData = useMemo(() => phrases.filter(p => p.sub === selectedSub), [phrases, selectedSub]);

  // 渲染纠错结果
  const renderSpeechDiff = (target, input) => {
    return target.split('').map((char, i) => {
        const isMatch = input.includes(char);
        return <span key={i} className={isMatch ? "text-slate-700 font-bold" : "text-red-500 font-black"}>{char}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* 886.best (仅在目录页显示) */}
      {view === 'catalog' && (
        <a href="https://886.best" className="fixed top-4 right-4 z-[2000] bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold border border-white/10 active:scale-95 transition-transform">
          Home
        </a>
      )}

      {/* ================= VIEW 1: 目录页 (Catalog) ================= */}
      {view === 'catalog' && (
        <div className="min-h-screen bg-white">
           {/* 顶部大图背景 + 融合遮罩 */}
           <div className="relative h-64">
              <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
              <div className="absolute bottom-10 left-6 text-slate-800">
                 <h1 className="text-3xl font-black mb-1 text-white drop-shadow-md">日常高频口语</h1>
                 <p className="text-white/90 text-xs font-bold uppercase tracking-widest bg-black/20 px-2 py-1 rounded inline-block backdrop-blur-sm">10,000 Sentences</p>
              </div>
           </div>

           {/* 目录列表 (向上覆盖) */}
           <div className="px-5 pb-20 -mt-6 relative z-10 space-y-6">
              {catalog.map((cat, idx) => (
                 <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-200">{idx + 1}</div>
                       <h3 className="font-bold text-slate-800">{cat.name}</h3>
                    </div>
                    <div className="p-2 grid grid-cols-2 gap-2">
                       {cat.subs.map((s, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleEnterList(s)}
                            className="text-left bg-white p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 active:scale-95 transition-transform hover:border-blue-200 hover:text-blue-600 shadow-sm"
                          >
                             {s}
                          </button>
                       ))}
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* ================= VIEW 2: 列表页 (List) ================= */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28 }}
            className="fixed inset-0 z-[1000] bg-[#F5F7FA] overflow-y-auto no-scrollbar"
          >
             {/* 顶部控制栏 (滚动隐显) */}
             <motion.div 
               initial={{ y: 0 }} animate={{ y: showHeader ? 0 : -100 }}
               className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur shadow-sm max-w-md mx-auto"
             >
               <div className="h-12 px-4 flex items-center justify-between border-b border-slate-50">
                 <button onClick={() => window.history.back()} className="p-2 -ml-2 text-slate-600 active:scale-90"><ChevronLeft size={22}/></button>
                 <span className="font-black text-slate-800 text-sm truncate">{selectedSub}</span>
                 <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}><Settings2 size={20}/></button>
               </div>
             </motion.div>

             {/* 设置面板 */}
             <AnimatePresence>
               {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={()=>setShowSettings(false)} />}
             </AnimatePresence>

             {/* 列表内容 */}
             <div className="pt-16 pb-32 px-4 space-y-5">
                {listData.map((item, index) => {
                   const isLocked = !isUnlocked && index >= 3; // 前3条免费
                   
                   return (
                     <div key={item.id} className="relative">
                        {/* 卡片容器 */}
                        <div 
                          className={`relative bg-white pt-8 pb-4 px-5 rounded-[1.8rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all active:scale-[0.99] cursor-pointer max-w-[340px] mx-auto
                          ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}
                          ${isLocked ? 'blur-[4px] opacity-60 pointer-events-none' : ''}`}
                          onClick={() => isLocked ? setShowVip(true) : handleCardPlay(item)}
                        >
                           {/* 1. 谐音胶囊 (骑缝) */}
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-700 px-4 py-1 rounded-full text-[10px] font-black border border-amber-200 shadow-sm z-10 whitespace-nowrap">
                              {item.xieyin}
                           </div>

                           {/* 2. 拼音 */}
                           <div className="text-[12px] text-slate-400 font-mono mb-1 mt-2">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                           
                           {/* 3. 中文 */}
                           <h3 className="text-2xl font-black text-slate-800 mb-2 leading-snug">{item.chinese}</h3>
                           
                           {/* 4. 缅文 */}
                           <p className="text-sm text-blue-600 font-medium mb-4 font-burmese">{item.burmese}</p>

                           {/* 5. 底部工具栏 (靠拢) */}
                           <div className="flex justify-center items-center gap-6 pt-3 border-t border-slate-50 w-full">
                              {/* 拼读 (左) */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} 
                                className="p-2 text-slate-400 hover:text-blue-500 active:scale-90 transition-colors"
                              >
                                 <Sparkles size={18}/>
                              </button>

                              {/* 语音识别 (中) */}
                              <button 
                                 onClick={(e) => { e.stopPropagation(); handleSpeech(item); }}
                                 className={`p-3 rounded-full shadow-md active:scale-90 transition-all ${recordingId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-50 text-blue-600'}`}
                              >
                                 <Mic size={20}/>
                              </button>

                              {/* 收藏 (右) */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} 
                                className={`p-2 active:scale-90 transition-colors ${favorites.includes(item.id) ? 'text-pink-500' : 'text-slate-400'}`}
                              >
                                 <Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"}/>
                              </button>
                           </div>
                           
                           {/* 识别结果显示 */}
                           {speechResult?.id === item.id && (
                              <div className="mt-3 bg-slate-50 p-2 rounded-lg text-xs w-full border border-slate-100 animate-in fade-in">
                                 <div className="flex justify-center gap-1 flex-wrap">
                                    {renderSpeechDiff(item.chinese, speechResult.text)}
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* 播放动画 */}
                        {playingId === item.id && (
                           <div className="absolute top-4 right-4 animate-pulse">
                              <Loader2 size={16} className="text-blue-400 animate-spin"/>
                           </div>
                        )}

                        {/* 锁定遮罩 */}
                        {isLocked && (
                           <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                              <Lock className="text-slate-500 mb-2" size={32}/>
                              <span className="text-[10px] bg-slate-800 text-white px-3 py-1 rounded-full font-bold shadow-lg">VIP 解锁全部</span>
                           </div>
                        )}
                     </div>
                   )
                })}

                {!isUnlocked && listData.length > 3 && (
                   <div className="py-8 text-center">
                      <button onClick={() => setShowVip(true)} className="bg-slate-900 text-white px-8 py-3 rounded-full text-sm font-bold shadow-xl animate-bounce">
                         解锁全部内容
                      </button>
                   </div>
                )}
             </div>

             <AnimatePresence>
                {showBackTop && (
                  <motion.button initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} onClick={() => window.scrollTo({top:0, behavior:'smooth'})} className="fixed bottom-10 right-6 w-10 h-10 bg-white shadow-xl border border-slate-100 rounded-full flex items-center justify-center text-slate-500 z-[1100] active:scale-90"><ArrowUp size={20}/></motion.button>
                )}
             </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 拼读弹窗 */}
      {spellingItem && <SpellingModal item={spellingItem} settings={settings} onClose={() => setSpellingItem(null)} />}

      {/* VIP 弹窗 */}
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

// 辅助组件：设置面板 (高对比度)
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-16 left-4 right-4 z-[2000] bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden max-w-sm mx-auto">
       <div className="p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
             <span className="text-xs font-black text-slate-400 uppercase">Audio Settings</span>
             <button onClick={onClose}><X size={16} className="text-slate-300"/></button>
          </div>

          {/* 中文 */}
          <div>
             <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">中文发音</span>
                <Switch checked={settings.zhEnabled} onChange={v => setSettings(s => ({...s, zhEnabled: v}))} />
             </div>
             <div className="grid grid-cols-3 gap-2 mb-2">
                {[{l:'男童',v:'zh-CN-YunxiaNeural'},{l:'女声',v:'zh-CN-XiaoyanNeural'},{l:'男声',v:'zh-CN-YunxiNeural'}].map(opt => (
                   <button key={opt.v} onClick={() => setSettings(s => ({...s, zhVoice: opt.v}))} 
                     className={`py-2 text-[10px] font-black rounded-lg border transition-all ${settings.zhVoice === opt.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
                     {opt.l}
                   </button>
                ))}
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-8">Speed</span>
                <input type="range" min="-50" max="50" step="10" value={settings.zhRate} onChange={e => setSettings(s => ({...s, zhRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-blue-600"/>
                <span className="text-[10px] text-blue-600 font-mono w-6 text-right">{settings.zhRate}</span>
             </div>
          </div>

          {/* 缅文 */}
          <div>
             <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">缅文发音</span>
                <Switch checked={settings.myEnabled} color="green" onChange={v => setSettings(s => ({...s, myEnabled: v}))} />
             </div>
             <div className="grid grid-cols-2 gap-2 mb-2">
                {[{l:'Thiha (男)',v:'my-MM-ThihaNeural'},{l:'Nilar (女)',v:'my-MM-NilarNeural'}].map(opt => (
                   <button key={opt.v} onClick={() => setSettings(s => ({...s, myVoice: opt.v}))} 
                     className={`py-2 text-[10px] font-black rounded-lg border transition-all ${settings.myVoice === opt.v ? 'bg-green-600 text-white border-green-600' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
                     {opt.l}
                   </button>
                ))}
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-8">Speed</span>
                <input type="range" min="-50" max="50" step="10" value={settings.myRate} onChange={e => setSettings(s => ({...s, myRate: Number(e.target.value)}))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-green-600"/>
                <span className="text-[10px] text-green-600 font-mono w-6 text-right">{settings.myRate}</span>
             </div>
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
