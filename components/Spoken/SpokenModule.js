import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Lock, Crown, Loader2, 
  Settings2, Mic, StopCircle, Home, ArrowUp, 
  ChevronRight, Sparkles, X, ChevronDown, Volume2, Heart, Play, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro';

// 假设只有一个数据文件，直接引入 (请确保路径正确)
// 如果你有多个文件，可以在这里根据逻辑切换，或者合并到一个文件
import dailyData from '@/data/spoken/daily10k.js'; 

// ============================================================================
// 1. 核心音频引擎 (独占、数值语速、修复404)
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

  play(text, voice, rate, onEnd) {
    if (typeof window === 'undefined' || !text) return;
    this.stop(); // 强制停止其他声音
    
    // 语速修复：直接传数值，不带 %
    const r = parseInt(rate) || 0; 
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${r}`;
    
    const audio = new Audio(url);
    this.current = audio;
    
    audio.onended = () => { this.current = null; if(onEnd) onEnd(); };
    audio.onerror = (e) => { 
        console.error("Audio Error:", e); 
        this.current = null; 
        if(onEnd) onEnd(); 
    };
    
    audio.play().catch(e => {
        console.warn("Play failed:", e);
        this.current = null;
        if(onEnd) onEnd();
    });
  },

  // 播放 R2 拼读音频
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
// 2. 录音机 (用于拼读窗口的对比)
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
      alert("无法访问麦克风，请检查权限");
      return false;
    }
  },

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        this.mediaRecorder.stream.getTracks().forEach(t => t.stop()); // 关闭麦克风
        this.mediaRecorder = null;
        resolve(url);
      };
      this.mediaRecorder.stop();
    });
  }
};

// ============================================================================
// 3. 子组件：拼读 & 录音对比弹窗
// ============================================================================
const SpellingModal = ({ item, settings, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [recordState, setRecordState] = useState('idle'); // idle, recording, review
  const [userAudio, setUserAudio] = useState(null);
  
  // 拼读演示
  const handleSpellPlay = async () => {
    const chars = item.chinese.split('');
    
    // 1. 逐字播放 R2
    for (let i = 0; i < chars.length; i++) {
      setActiveCharIndex(i);
      const py = pinyin(chars[i], { toneType: 'symbol' });
      // 假设 R2 地址格式
      const r2Url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
      await new Promise(resolve => AudioEngine.playUrl(r2Url, resolve));
      await new Promise(r => setTimeout(r, 100));
    }
    
    // 2. 整句 TTS
    setActiveCharIndex('all');
    await new Promise(resolve => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, resolve));
    setActiveCharIndex(-1);
  };

  // 录音逻辑
  const toggleRecord = async () => {
    if (recordState === 'recording') {
      const url = await RecorderEngine.stop();
      setUserAudio(url);
      setRecordState('review');
    } else {
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
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 p-2"><X size={20}/></button>
        
        <h3 className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">拼读与发音对比</h3>

        {/* 拼音大字 */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {item.chinese.split('').map((char, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className={`text-sm font-mono mb-1 ${activeCharIndex === i ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>
                {pinyin(char, {toneType:'symbol'})}
              </span>
              <span className={`text-4xl font-black transition-all ${activeCharIndex === i || activeCharIndex === 'all' ? 'text-slate-800 scale-110' : 'text-slate-300'}`}>
                {char}
              </span>
            </div>
          ))}
        </div>

        {/* 录音对比区 */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 flex justify-around items-center">
            {/* 原音 */}
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={handleSpellPlay}>
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-sm active:scale-95">
                  <Volume2 size={20}/>
               </div>
               <span className="text-[10px] text-slate-500">听原音</span>
            </div>

            {/* 录音按钮 */}
            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={toggleRecord}>
               <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${recordState === 'recording' ? 'bg-red-500 ring-4 ring-red-200' : 'bg-white border-2 border-slate-100'}`}>
                  {recordState === 'recording' ? <StopCircle size={28} className="text-white animate-pulse"/> : <Mic size={28} className="text-slate-700"/>}
               </div>
               <span className="text-[10px] text-slate-500">{recordState === 'recording' ? '停止' : '录音'}</span>
            </div>

            {/* 回放 */}
            <div className={`flex flex-col items-center gap-2 transition-all ${userAudio ? 'opacity-100 cursor-pointer' : 'opacity-30 pointer-events-none'}`} onClick={playUserAudio}>
               <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm active:scale-95">
                  <Play size={20}/>
               </div>
               <span className="text-[10px] text-slate-500">我的</span>
            </div>
        </div>

        <p className="text-center text-xs text-slate-300">点击中间按钮开始录音，再次点击停止</p>
      </motion.div>
    </div>
  );
};

// ============================================================================
// 4. 主组件
// ============================================================================
export default function SpokenModule() {
  const [view, setView] = useState('catalog'); // 默认为目录页 catalog | list
  const [category, setCategory] = useState(null); // 选中的大主题
  const [subCategory, setSubCategory] = useState(null); // 选中的小主题
  
  // 数据
  const [phrases, setPhrases] = useState(dailyData); // 直接使用引入的数据
  
  // 设置
  const [settings, setSettings] = useState({ 
    zhVoice: 'zh-CN-YunxiaNeural', zhRate: -30, zhEnabled: true,
    myVoice: 'my-MM-ThihaNeural', myRate: 0, myEnabled: true
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // 状态
  const [playingId, setPlayingId] = useState(null);
  const [spellingItem, setSpellingItem] = useState(null); // 控制拼读弹窗
  const [favorites, setFavorites] = useState([]);
  
  // 权限与交互
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
    
    const savedFavs = JSON.parse(localStorage.getItem('spoken_favs') || '[]');
    setFavorites(savedFavs);
  }, []);

  // 保存设置
  useEffect(() => localStorage.setItem('spoken_settings', JSON.stringify(settings)), [settings]);

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      // 下拉显示，上滑隐藏
      if (y < lastScrollY.current || y < 50) setShowHeader(true);
      else if (y > lastScrollY.current && y > 100) setShowHeader(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- 逻辑处理 ---

  // 整理目录结构
  const catalog = useMemo(() => {
    const map = new Map();
    phrases.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, new Set());
      map.get(p.category).add(p.sub);
    });
    return Array.from(map.entries()).map(([cat, subs]) => ({
      name: cat,
      subs: Array.from(subs)
    }));
  }, [phrases]);

  // 进入列表
  const handleEnterList = (cat, sub) => {
    setCategory(cat);
    setSubCategory(sub);
    setView('list');
    window.scrollTo(0, 0);
  };

  // 播放卡片逻辑
  const handleCardClick = (item) => {
    if (playingId === item.id) { AudioEngine.stop(); setPlayingId(null); return; }
    setPlayingId(item.id);
    
    const seq = async () => {
      if (settings.zhEnabled) {
        await new Promise(r => AudioEngine.play(item.chinese, settings.zhVoice, settings.zhRate, r));
      }
      
      if (AudioEngine.current?.paused && !settings.zhEnabled) {} // check interrupt
      
      if (settings.myEnabled) {
        if (settings.zhEnabled) await new Promise(r => setTimeout(r, 400));
        await new Promise(r => AudioEngine.play(item.burmese, settings.myVoice, settings.myRate, r));
      }
      setPlayingId(null);
    };
    seq();
  };

  const toggleFav = (id) => {
    const newFavs = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem('spoken_favs', JSON.stringify(newFavs));
  };

  // 当前列表数据
  const listData = useMemo(() => {
    return phrases.filter(p => p.category === category && p.sub === subCategory);
  }, [phrases, category, subCategory]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* 全局主页按钮 (悬浮在最顶层) */}
      <a href="https://886.best" className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[10px] font-black border border-white/10 active:scale-95 transition-transform uppercase tracking-widest shadow-xl">
        <Home size={10} className="inline mr-1 mb-0.5"/> 886.best
      </a>

      {/* ================= VIEW 1: 目录页 (Catalog) ================= */}
      {view === 'catalog' && (
        <div className="min-h-screen bg-white">
           {/* 顶部大图 */}
           <div className="relative h-48 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" className="w-full h-full object-cover brightness-[0.7]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                 <h1 className="text-3xl font-black mb-1">日常高频口语</h1>
                 <p className="text-white/80 text-xs font-bold uppercase tracking-widest">10,000 Sentences Course</p>
              </div>
           </div>

           <div className="p-5 pb-20 space-y-6">
              {catalog.map((cat, idx) => (
                 <CatalogGroup key={idx} cat={cat} idx={idx} onSelect={handleEnterList} />
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
                 <button onClick={() => setView('catalog')} className="p-2 -ml-2 text-slate-600 active:scale-90"><ChevronLeft size={22}/></button>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold">{category}</span>
                    <span className="text-sm font-black text-slate-800">{subCategory}</span>
                 </div>
                 <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}><Settings2 size={20}/></button>
               </div>
             </motion.div>

             {/* 设置面板 */}
             <AnimatePresence>
               {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={()=>setShowSettings(false)} />}
             </AnimatePresence>

             {/* 列表内容 */}
             <div className="pt-16 pb-32 px-4 space-y-4">
                {listData.map((item, index) => {
                   const isLocked = !isUnlocked && index >= 3; // 前3条免费
                   
                   return (
                     <div key={item.id} className="relative">
                        {/* 模拟图片中的卡片样式 */}
                        <div 
                          className={`relative bg-white pt-8 pb-4 px-5 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all active:scale-[0.99] cursor-pointer
                          ${playingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}
                          ${isLocked ? 'blur-[4px] opacity-60 pointer-events-none' : ''}`}
                          onClick={() => isLocked ? setShowVip(true) : handleCardClick(item)}
                        >
                           {/* 谐音胶囊 (骑缝布局) */}
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-[10px] font-black border-2 border-white shadow-sm z-10 whitespace-nowrap">
                              {item.xieyin}
                           </div>

                           {/* 拼音 */}
                           <div className="text-[11px] text-slate-400 font-mono mb-1">{pinyin(item.chinese, {toneType:'symbol'})}</div>
                           
                           {/* 中文 */}
                           <h3 className="text-xl font-black text-slate-800 mb-2 leading-snug">{item.chinese}</h3>
                           
                           {/* 缅文 */}
                           <p className="text-sm text-blue-600 font-medium mb-4 font-burmese">{item.burmese}</p>

                           {/* 底部工具栏 */}
                           <div className="w-full flex justify-between items-center px-4 pt-3 border-t border-slate-50">
                              {/* 拼读/对比按钮 */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSpellingItem(item); }} 
                                className="w-8 h-8 rounded-full bg-slate-50 text-blue-500 flex items-center justify-center active:scale-90"
                              >
                                 <Volume2 size={16}/>
                              </button>

                              {/* 录音识别 (快速) */}
                              <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center">
                                 <Mic size={16}/>
                              </button>

                              {/* 收藏 */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 ${favorites.includes(item.id) ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-300'}`}
                              >
                                 <Heart size={16} fill={favorites.includes(item.id) ? "currentColor" : "none"}/>
                              </button>
                           </div>
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
                              <Lock className="text-slate-500 mb-1" size={32}/>
                              <span className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded">VIP 锁定</span>
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

// ============================================================================
// 辅助组件：目录分组 (可折叠)
// ============================================================================
const CatalogGroup = ({ cat, idx, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
       <div 
         onClick={() => setIsOpen(!isOpen)}
         className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50"
       >
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">{idx + 1}</div>
             <h3 className="font-bold text-slate-800">{cat.name}</h3>
          </div>
          <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </div>
       
       <AnimatePresence>
         {isOpen && (
           <motion.div 
             initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
             className="overflow-hidden bg-slate-50"
           >
              <div className="p-2 grid grid-cols-2 gap-2">
                 {cat.subs.map((sub, i) => (
                    <button 
                      key={i} 
                      onClick={() => onSelect(cat.name, sub)}
                      className="text-left bg-white p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 active:scale-95 transition-transform"
                    >
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
// 辅助组件：设置面板 (高对比度)
// ============================================================================
const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="fixed top-16 left-4 right-4 z-[60] bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden max-w-sm mx-auto">
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
