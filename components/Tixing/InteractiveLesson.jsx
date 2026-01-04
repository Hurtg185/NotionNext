import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { FaPlay, FaHome, FaRedo, FaStar, FaRegStar, FaClock, FaMedal, FaExpand, FaCompress } from "react-icons/fa";
import confetti from 'canvas-confetti';
import { useAI } from '../AIConfigContext'; // 引入 AI Context
import AIChatDock from '../AIChatDock';      // 引入 AI 助手 UI 组件

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
// ===== 辅助组件 =====
// ============================================================================

const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  const list = data.words || data.sentences || data.vocabulary || []; 
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
      <div className="absolute bottom-6 left-0 right-0 p-6 z-20 flex justify-center pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <button onClick={onComplete} className="w-full max-w-md py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all">
          မှတ်မိပါပြီ 
        </button>
      </div>
    </div>
  );
};

const CoverBlock = ({ data, onNext }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900 overflow-hidden">
      {data.imageUrl && (
        <div className="absolute inset-0 z-0">
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
          {data.title || "စတင်လေ့လာမည်"} 
        </h1>
        <p className="text-white/80 text-lg max-w-xs mb-16 font-medium drop-shadow-md">
          {data.description || "အဆင်သင့်ဖြစ်ပြီလား။ သင်ခန်းစာစလိုက်ကြရအောင်။"} 
        </p>
        <button 
          onClick={onNext}
          className="flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg shadow-xl shadow-blue-900/50 active:scale-95 transition-all"
        >
          <FaPlay size={18} />
          <span>စိန်ခေါ်မှု စတင်မည်</span> 
        </button>
      </div>
    </div>
  );
};

const SummaryBlock = ({ duration, mistakes, router, onRestart }) => { 
  let stars = 0;
  let title = "";
  let color = "";

  if (mistakes === 0) {
    stars = 5; title = "ထူးချွန်ပါတယ်!"; 
    color = "text-yellow-500";
  } else if (mistakes === 1) {
    stars = 4; title = "အလွန်ကောင်းမွန်သည်!"; 
    color = "text-blue-500";
  } else if (mistakes === 2) {
    stars = 3; title = "ကောင်းမွန်သည်!"; 
    color = "text-blue-400";
  } else if (mistakes === 3) {
    stars = 2; title = "ကြိုးစားပါ!"; 
    color = "text-slate-600";
  } else {
    stars = 1; title = "ထပ်မံလေ့ကျင့်ပါ"; 
    color = "text-slate-500";
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} မိနစ် ${s} စက္ကန့်`; 
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center animate-fade-in pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <div className="mb-8 relative">
         <div className="text-9xl filter drop-shadow-2xl animate-bounce">
            {stars >= 4 ? "🏆" : stars >= 3 ? "🥈" : "🥉"}
         </div>
         {stars === 5 && <div className="absolute -top-4 -right-4 text-6xl animate-pulse">✨</div>}
      </div>

      <h2 className={`text-3xl font-black mb-2 ${color}`}>{title}</h2>
      <p className="text-slate-400 mb-8 font-medium">သင်ခန်းစာ ပြီးမြောက်ပါပြီ</p> 

      <div className="flex gap-4 w-full max-w-sm mb-10">
        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="text-yellow-400 text-lg mb-1 flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                 i < stars ? <FaStar key={i}/> : <FaRegStar key={i} className="text-slate-200"/>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">ရမှတ်</span> 
        </div>
        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="text-slate-700 text-lg font-black mb-1 flex items-center gap-2">
               <FaClock size={18} className="text-blue-500"/> 
               <span className="text-base">{formatTime(duration)}</span>
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">အချိန်</span> 
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
         <button 
           onClick={onRestart} 
           className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-300 active:scale-[0.98] transition-all"
         >
           <FaRedo /> နောက်တစ်ခါ ပြန်ကြိုးစားမည် 
         </button>
         <button 
           onClick={() => router.push('/')} 
           className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-[0.98] transition-all"
         >
           <FaHome /> ပင်မစာမျက်နှာသို့ 
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
  
  // ✅ 获取 AI 触发方法
  const { triggerInteractiveAI } = useAI();
  
  const [dynamicBlocks, setDynamicBlocks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const initializedLessonId = useRef(null);
  
  const [timeSpent, setTimeSpent] = useState(0);
  const timerRef = useRef(null);

  const lessonContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => {
    const elem = lessonContainerRef.current;
    if (elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message}`));
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }, []);
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); 
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

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

  const goNext = useCallback(() => {
    audioManager.stop();
    if (currentIndex < dynamicBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  }, [currentIndex, dynamicBlocks.length]);

  const handleStartLesson = useCallback(() => {
    enterFullscreen();
    goNext();
  }, [enterFullscreen, goNext]);

  const handleFinish = () => {
    setIsFinished(true);
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
  }, []);

  if (!hasMounted) return null;

  const isGrammarPage = type === 'grammar_study';
  const isQuestionPage = ['choice', 'paixu', 'lianxian', 'gaicuo', 'image_match_blanks'].includes(type);
  const showAIDock = !isFinished && (isGrammarPage || isQuestionPage);
  const shouldHideAiBall = isQuestionPage;

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
      settings: { playTTS: audioManager?.playTTS },
      isRetry: false 
    };

    switch (type) {
      case 'cover':
      case 'start_page': 
        return <CoverBlock {...commonProps} onNext={handleStartLesson} />;
      
      case 'word_study': return <WordStudyPlayer {...commonProps} onNext={goNext} />;
      case 'phrase_study': 
      case 'sentences': return <CardListRenderer {...commonProps} type={type} onComplete={goNext} />;
      
      case 'grammar_study': 
        // ✅ 修复：传递 onAskAI 以消除弹窗报错
        return (
          <GrammarPointPlayer 
            grammarPoints={commonProps.data.grammarPoints} 
            onComplete={goNext} 
            onAskAI={triggerInteractiveAI} 
          />
        );
      
      case 'choice': 
        return (
          <XuanZeTi 
            {...commonProps} 
            triggerAI={triggerInteractiveAI} 
            onNext={goNext}                  
            onCorrect={() => {}}             
            onWrong={handleWrong}            
          />
        );
      
      case 'paixu': 
        return (
          <PaiXuTi 
            {...commonProps} 
            triggerAI={triggerInteractiveAI} 
            onCorrect={() => { goNext(); }}
            onWrong={() => { handleWrong(); goNext(); }}
          />
        );
      
      case 'lianxian': return <LianXianTi {...commonProps} onNext={goNext} onWrong={handleWrong} />;
      case 'panduan': return <div className="p-8 text-center">暂未适配错题沉底</div>; 
      case 'gaicuo': return <GaiCuoTi {...commonProps} onNext={goNext} onWrong={handleWrong} />;
      case 'image_match_blanks': return <TianKongTi {...commonProps} onNext={goNext} onWrong={handleWrong} />;
      
      case 'complete': 
      case 'end': 
        return <SummaryBlock duration={timeSpent} mistakes={mistakeCount} router={router} onRestart={handleRestart} />;
        
      default: return <div className="p-10 text-center">未知题型: {type}</div>;
    }
  };

  return (
    <div ref={lessonContainerRef} className="fixed inset-0 w-screen h-[100dvh] bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ touchAction: 'none' }}>
      <style>{`
        ::-webkit-scrollbar { display: none; } 
        * { -webkit-tap-highlight-color: transparent; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      <main className="relative w-full h-full z-10 overflow-hidden">
        {renderContent()}
      </main>

      {showAIDock && <AIChatDock hideFloatingBall={shouldHideAiBall} />}
    </div>
  );
}
