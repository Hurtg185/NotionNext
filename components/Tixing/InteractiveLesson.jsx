import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
// --- 修改点 1: 导入全屏控制图标 ---
import { FaPlay, FaHome, FaRedo, FaStar, FaRegStar, FaClock, FaMedal, FaExpand, FaCompress } from "react-icons/fa";
import confetti from 'canvas-confetti';

// --- 核心全屏播放器组件 ---
import WordStudyPlayer from './WordStudyPlayer';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 外部练习题组件 ---
import XuanZeTi from './XuanZeTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import TianKongTi from './TianKongTi'; 
import PaiXuTi from './PaiXuTi'; 

// ============================================================================
// ===== Audio Manager (TTS 工具) =====
// ============================================================================
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  if (typeof window === 'undefined') return null;
  let audioEl = null, onEnded = null;
  
  const stop = () => { 
    try { if (audioEl) { audioEl.pause(); audioEl = null; } } catch (e) {} 
    if (onEnded) { onEnded(); onEnded = null; } 
  };

  const playUrl = async (url, { onEnd = null } = {}) => { 
    stop(); 
    if (!url) return; 
    try { 
      const a = new Audio(url); 
      a.volume = 1.0; 
      a.onended = () => { if (onEnd) onEnd(); if (audioEl === a) { audioEl = null; onEnded = null; } }; 
      audioEl = a; onEnded = onEnd; 
      await a.play().catch(e => console.warn("Audio play failed:", e)); 
    } catch (e) { if (onEnd) onEnd(); } 
  };

  const blobCache = new Map();
  const fetchToBlobUrl = async (url) => { 
    try { 
      if (blobCache.has(url)) return blobCache.get(url); 
      const r = await fetch(url); 
      const b = await r.blob(); 
      const u = URL.createObjectURL(b); 
      blobCache.set(url, u); return u; 
    } catch (e) { return url; } 
  };

  return { 
    stop, 
    playTTS: async (t, l='zh', r=0, cb=null) => { 
      if (!t) { if (cb) cb(); return; } 
      const v = ttsVoices[l]||ttsVoices.zh; 
      const u = await fetchToBlobUrl(`https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${v}&r=${r}`); 
      return playUrl(u, { onEnd: cb }); 
    }
  };
})();

// ============================================================================
// ===== 辅助组件 (已翻译为缅文) =====
// ============================================================================

// 1. 列表容器适配器
const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  const list = data.words || data.sentences || data.vocabulary || []; 
  // 缅文标题映射
  const defaultTitle = isPhrase ? "အသုံးများသော စကားစုများ" : "အဓိက ဝေါဟာရများ";

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-50">
      <div className="flex-none pt-12 pb-4 px-4 text-center z-10">
        <h2 className="text-2xl font-black text-slate-800">{data.title || defaultTitle}</h2>
      </div>
      <div className="flex-1 w-full overflow-y-auto px-4 pb-32">
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {list.map((item, i) => (
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 active:bg-slate-50" onClick={() => audioManager.playTTS(item.sentence || item.chinese)}>
               <div className="text-lg font-bold text-slate-800">{item.sentence || item.chinese}</div>
               <div className="text-sm text-slate-500">{item.pinyin}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-6 left-0 right-0 p-6 z-20 flex justify-center">
        <button onClick={onComplete} className="w-full max-w-md py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all">
          မှတ်မိပါပြီ {/* 我学会了 */}
        </button>
      </div>
    </div>
  );
};

// 2. 封面页 (图片优化 + 缅文)
const CoverBlock = ({ data, onNext }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900 overflow-hidden">
      {data.imageUrl && (
        <div className="absolute inset-0 z-0">
           {/* 图片加载优化: eager + high priority */}
           <img 
             src={data.imageUrl} 
             alt="Cover" 
             loading="eager"
             fetchPriority="high"
             className="w-full h-full object-cover opacity-60 scale-105" 
           />
           <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
        </div>
      )}
      <div className="relative z-10 w-full px-8 text-center flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight drop-shadow-lg">
          {data.title || "စတင်လေ့လာမည်"} {/* 开始学习 */}
        </h1>
        <p className="text-white/80 text-lg max-w-xs mb-16 font-medium drop-shadow-md">
          {data.description || "အဆင်သင့်ဖြစ်ပြီလား။ သင်ခန်းစာစလိုက်ကြရအောင်။"} {/* 准备好了吗... */}
        </p>
        <button 
          onClick={onNext}
          className="flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg shadow-xl shadow-blue-900/50 active:scale-95 transition-all"
        >
          <FaPlay size={18} />
          <span>စိန်ခေါ်မှု စတင်မည်</span> {/* 开始挑战 */}
        </button>
      </div>
    </div>
  );
};

// 3. 结果结算页面 (5星制 + 缅文)
const SummaryBlock = ({ duration, mistakes, router, onRestart }) => { 
  // 5星评分逻辑
  let stars = 0;
  let title = "";
  let color = "";

  if (mistakes === 0) {
    stars = 5; title = "ထူးချွန်ပါတယ်!"; // 完美
    color = "text-yellow-500";
  } else if (mistakes === 1) {
    stars = 4; title = "အလွန်ကောင်းမွန်သည်!"; // 很好
    color = "text-blue-500";
  } else if (mistakes === 2) {
    stars = 3; title = "ကောင်းမွန်သည်!"; // 不错
    color = "text-blue-400";
  } else if (mistakes === 3) {
    stars = 2; title = "ကြိုးစားပါ!"; // 加油
    color = "text-slate-600";
  } else {
    stars = 1; title = "ထပ်မံလေ့ကျင့်ပါ"; // 再练练
    color = "text-slate-500";
  }

  // 格式化时间
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} မိနစ် ${s} စက္ကန့်`; // 分 秒
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center animate-fade-in">
      {/* 奖牌/动画区 */}
      <div className="mb-8 relative">
         <div className="text-9xl filter drop-shadow-2xl animate-bounce">
            {stars >= 4 ? "🏆" : stars >= 3 ? "🥈" : "🥉"}
         </div>
         {stars === 5 && <div className="absolute -top-4 -right-4 text-6xl animate-pulse">✨</div>}
      </div>

      <h2 className={`text-3xl font-black mb-2 ${color}`}>{title}</h2>
      <p className="text-slate-400 mb-8 font-medium">သင်ခန်းစာ ပြီးမြောက်ပါပြီ</p> {/* 课程完成 */}

      {/* 统计卡片 */}
      <div className="flex gap-4 w-full max-w-sm mb-10">
        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            {/* 5星显示 */}
            <div className="text-yellow-400 text-lg mb-1 flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                 i < stars ? <FaStar key={i}/> : <FaRegStar key={i} className="text-slate-200"/>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">ရမှတ်</span> {/* 评分 */}
        </div>
        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="text-slate-700 text-lg font-black mb-1 flex items-center gap-2">
               <FaClock size={18} className="text-blue-500"/> 
               <span className="text-base">{formatTime(duration)}</span>
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">အချိန်</span> {/* 时间 */}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
         <button 
           onClick={onRestart} 
           className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-300 active:scale-[0.98] transition-all"
         >
           <FaRedo /> နောက်တစ်ခါ ပြန်ကြိုးစားမည် {/* 再练一次 */}
         </button>
         <button 
           onClick={() => router.push('/')} 
           className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-[0.98] transition-all"
         >
           <FaHome /> ပင်မစာမျက်နှာသို့ {/* 返回主页 */}
         </button>
      </div>
    </div>
  ); 
};

// ============================================================================
// ===== 主组件: InteractiveLesson =====
// ============================================================================
export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  
  // 核心状态
  const [dynamicBlocks, setDynamicBlocks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const initializedLessonId = useRef(null);
  
  // 计时器状态
  const [timeSpent, setTimeSpent] = useState(0);
  const timerRef = useRef(null);

  // --- 修改点 2: 添加全屏状态和 Ref ---
  const lessonContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- 修改点 3: 实现进入和退出全屏的函数 ---
  const enterFullscreen = useCallback(() => {
    const elem = lessonContainerRef.current;
    if (elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
      } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { // IE11
        elem.msRequestFullscreen();
      }
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { // Safari
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE11
      document.msExitFullscreen();
    }
  }, []);
  
  // --- 修改点 4: 添加 Effect 来监听全屏状态变化 ---
  useEffect(() => {
    const handleFullscreenChange = () => {
      // document.fullscreenElement will be null if not in fullscreen
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // For Safari

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);


  // 初始化
  useEffect(() => {
    setHasMounted(true);
    if (lesson?.blocks && lesson.id !== initializedLessonId.current) {
      setDynamicBlocks(lesson.blocks);
      initializedLessonId.current = lesson.id;
      setCurrentIndex(0);
      setMistakeCount(0);
      setTimeSpent(0);
      setIsFinished(false);
    } 
    else if (lesson?.blocks && dynamicBlocks.length === 0) {
      setDynamicBlocks(lesson.blocks);
    }
  }, [lesson, dynamicBlocks.length]);

  const currentBlock = dynamicBlocks[currentIndex];
  const type = currentBlock?.type?.toLowerCase() || '';

  // 智能计时器逻辑
  useEffect(() => {
    if (!hasMounted || isFinished) return;
    const isLearningPhase = ['cover', 'start_page', 'word_study', 'grammar_study', 'phrase_study', 'end'].includes(type);
    if (!isLearningPhase) {
      timerRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasMounted, isFinished, type]);

  // 进度条计算
  const progressPercent = useMemo(() => {
    if (!dynamicBlocks.length) return 0;
    return ((currentIndex + 1) / dynamicBlocks.length) * 100;
  }, [currentIndex, dynamicBlocks.length]);


  // --- 核心动作 ---
  const goNext = useCallback(() => {
    audioManager.stop();
    if (currentIndex < dynamicBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  }, [currentIndex, dynamicBlocks.length]);

  // --- 修改点 5: 创建一个新的开始函数，用于触发全屏 ---
  const handleStartLesson = useCallback(() => {
    enterFullscreen();
    goNext();
  }, [enterFullscreen, goNext]);

  const handleFinish = () => {
    setIsFinished(true);
    // 如果在全屏，则退出
    if (isFullscreen) {
      exitFullscreen();
    }
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    audioManager.playTTS("恭喜你完成课程", 'zh');
  };

  const handleRestart = () => {
    if (lesson?.blocks) {
      setDynamicBlocks(lesson.blocks);
    }
    setCurrentIndex(0);
    setMistakeCount(0);
    setTimeSpent(0);
    setIsFinished(false);
  };

  const handleWrong = useCallback(() => {
    setMistakeCount(prev => prev + 1);
    setDynamicBlocks(prev => {
      const currentBlockData = prev[currentIndex];
      const retryBlock = { ...currentBlockData, _isRetry: true };
      console.log("错题已加入重做队列:", retryBlock);
      return [...prev, retryBlock];
    });
  }, [currentIndex]);


  // --- 渲染逻辑 ---
  if (!hasMounted) return null;

  if (isFinished) {
    return (
      <SummaryBlock 
        duration={timeSpent} 
        mistakes={mistakeCount} 
        router={router} 
        onRestart={handleRestart} 
      />
    );
  }

  const renderContent = () => {
    if (!currentBlock) return <div className="p-10 text-center text-slate-400">Loading Lesson...</div>;

    const commonProps = {
      key: `${currentIndex}-${currentBlock.id || 'idx'}`,
      data: currentBlock.content,
      onNext: goNext,
      onComplete: goNext,
      onCorrect: goNext,
      onWrong: handleWrong,
      settings: { playTTS: audioManager?.playTTS },
      isRetry: currentBlock._isRetry
    };

    switch (type) {
      case 'cover':
      case 'start_page': 
        // --- 修改点 6: 将 onNext 指向新的 handleStartLesson 函数 ---
        return <CoverBlock {...commonProps} onNext={handleStartLesson} />;
      
      case 'word_study': return <WordStudyPlayer {...commonProps} />;
      case 'phrase_study': 
      case 'sentences': return <CardListRenderer {...commonProps} type={type} />;
      case 'grammar_study': return <GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goNext} />;
      
      case 'choice': return <XuanZeTi {...commonProps} onIncorrect={handleWrong} />; 
      case 'paixu': return <PaiXuTi {...commonProps} />; 
      
      case 'lianxian': return <LianXianTi {...commonProps} />;
      case 'panduan': return <div className="p-8 text-center">暂未适配错题沉底</div>; 
      case 'gaicuo': return <GaiCuoTi {...commonProps} />;
      case 'image_match_blanks': return <TianKongTi {...commonProps} />;
      
      case 'complete': 
      case 'end': 
        return <SummaryBlock duration={timeSpent} mistakes={mistakeCount} router={router} onRestart={handleRestart} />;
        
      default: return <div className="p-10 text-center">未知题型: {type}</div>;
    }
  };

  const hideTopProgressBar = ['cover', 'start_page', 'complete', 'end'].includes(type);

  return (
    // --- 修改点 7: 附加 ref 到主容器 ---
    <div ref={lessonContainerRef} className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ touchAction: 'none' }}>
      <style>{`
        ::-webkit-scrollbar { display: none; } 
        * { -webkit-tap-highlight-color: transparent; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {!hideTopProgressBar && (
        // --- 修改点 8: 在顶部栏添加全屏切换按钮 ---
        <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] px-4 py-3 z-50 pointer-events-none flex items-center justify-center gap-3 bg-slate-50/80 backdrop-blur-sm">
           <div className="flex-1 max-w-lg h-1.5 bg-slate-200 rounded-full overflow-hidden">
             <div 
                 className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out" 
                 style={{ width: `${progressPercent}%` }} 
             />
           </div>

           {currentBlock._isRetry && (
             <div className="text-orange-500 font-bold text-[10px] flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-full animate-pulse border border-orange-100">
               <FaRedo size={10} /> <span>ပြန်ဖြေ</span>
             </div>
           )}

           {/* 全屏按钮 */}
           <button 
             onClick={isFullscreen ? exitFullscreen : enterFullscreen}
             className="absolute right-4 top-1/2 -translate-y-1/2 -mt-px text-slate-400 p-2 rounded-full hover:bg-slate-200 pointer-events-auto transition-colors"
             aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
           >
             {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
           </button>
        </div>
      )}

      <main className="relative w-full h-full z-10">
        {renderContent()}
      </main>
    </div>
  );
}
