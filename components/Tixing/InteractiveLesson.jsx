import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaPlay, FaHome, FaRedo } from "react-icons/fa";

// --- 1. 核心全屏播放器组件 ---
import WordStudyPlayer from './WordStudyPlayer';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 外部练习题组件 ---
import XuanZeTi from './XuanZeTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import TianKongTi from './TianKongTi'; 
import PaiXuTi from './PaiXuTi'; 

// ============================================================================
// ===== 模拟/占位组件 (防止缺失) =====
// ============================================================================
const DuiHua = ({ data, onComplete }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
    <h3 className="text-xl font-bold mb-4">对话练习</h3>
    <p className="text-gray-500 mb-8">（Dialogue Cinematic）</p>
    <button onClick={onComplete} className="bg-blue-600 text-white px-6 py-2 rounded-full">完成对话</button>
  </div>
);

const PanDuanTi = ({ data, onCorrect }) => (
  <div className="p-8 text-center">
    <h3 className="text-xl font-bold mb-6">{data.question}</h3>
    <div className="flex gap-4 justify-center">
      <button onClick={onCorrect} className="p-6 bg-green-100 rounded-2xl text-3xl">正确</button>
      <button className="p-6 bg-red-100 rounded-2xl text-3xl">错误</button>
    </div>
  </div>
);

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
// ===== 子组件定义 =====
// ============================================================================

// 1. 列表容器适配器
const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  const list = data.words || data.sentences || data.vocabulary || []; 

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-50">
      <div className="flex-none pt-12 pb-4 px-4 text-center z-10">
        <h2 className="text-2xl font-black text-slate-800">{data.title || (isPhrase ? "常用短句" : "核心生词")}</h2>
      </div>
      <div className="flex-1 w-full overflow-y-auto px-4 pb-32">
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {list.map((item, i) => (
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100" onClick={() => audioManager.playTTS(item.sentence || item.chinese)}>
               <div className="text-lg font-bold text-slate-800">{item.sentence || item.chinese}</div>
               <div className="text-sm text-slate-500">{item.pinyin}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-10 left-0 right-0 p-6 z-20">
        <button onClick={onComplete} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all">
          我学会了
        </button>
      </div>
    </div>
  );
};

// 2. 重构首页：移除动态特效，改为静态布局
const CoverBlock = ({ data, onNext }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900 overflow-hidden">
      {/* 全屏背景图 */}
      {data.imageUrl && (
        <div className="absolute inset-0 z-0">
           <img src={data.imageUrl} alt="Cover" className="w-full h-full object-cover opacity-60 scale-105" />
           <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
        </div>
      )}
      
      {/* 内容居中 */}
      <div className="relative z-10 w-full px-8 text-center flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight drop-shadow-lg">
          {data.title || "开始学习"}
        </h1>
        <p className="text-white/80 text-lg max-w-xs mb-16 font-medium drop-shadow-md">
          {data.description || "准备好了吗？让我们开始今天的课程吧！"}
        </p>

        {/* 静态按钮 */}
        <button 
          onClick={onNext}
          className="flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg shadow-xl shadow-blue-900/50 active:scale-95 transition-all"
        >
          <FaPlay size={18} />
          <span>开始学习</span>
        </button>
      </div>
    </div>
  );
};

// 3. 完成页面：修复再学一次和返回按钮
const CompletionBlock = ({ data, router, onRestart }) => { 
  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center">
      <div className="text-8xl mb-6 animate-bounce">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-2">{data.title || "课程完成！"}</h2>
      <p className="text-slate-500 mb-10">你已经完成了本节课的所有内容</p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
         <button 
           onClick={onRestart} 
           className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
         >
           <FaRedo /> 再学一次
         </button>
         
         <button 
           onClick={() => router.push('/')} 
           className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-[0.98] transition-all"
         >
           <FaHome /> 返回主页
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');

  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  useEffect(() => { setHasMounted(true); }, []);
  
  // 初始化加载进度
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`); 
      if (saved) setCurrentIndex(Math.min(parseInt(saved, 10), totalBlocks - 1));
    } 
  }, [lesson, hasMounted, totalBlocks]);

  // 保存进度
  useEffect(() => { 
    if (hasMounted && lesson?.id) {
      localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
    }
    audioManager?.stop(); 
  }, [currentIndex, lesson?.id, hasMounted]);

  // 重置课程逻辑
  const resetLesson = useCallback(() => {
    if (lesson?.id) {
      localStorage.removeItem(`lesson-progress-${lesson.id}`);
    }
    setCurrentIndex(0);
  }, [lesson?.id]);

  const goNext = useCallback(() => { 
    if (currentIndex < totalBlocks - 1) setCurrentIndex(prev => prev + 1);
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => { 
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);
  
  const delayedNextStep = useCallback(() => {
    import('canvas-confetti').then(m => m.default({ particleCount: 60, spread: 50, origin: { y: 0.7 } }));
    setTimeout(() => { if (currentIndex < totalBlocks - 1) setCurrentIndex(prev => prev + 1); }, 1200); 
  }, [currentIndex, totalBlocks]);

  const renderBlock = () => {
    if (!currentBlock) return null;
    const type = (currentBlock.type || '').toLowerCase();
    const commonProps = { 
      key: `${lesson.id}-${currentIndex}`, 
      data: currentBlock.content, 
      onCorrect: delayedNextStep, 
      onComplete: goNext, 
      onNext: goNext, 
      onPrev: goPrev,
      settings: { playTTS: audioManager?.playTTS }, 
      isFirstBlock: currentIndex === 0
    };
    
    switch (type) {
      case 'cover':
      case 'start_page': return <CoverBlock data={commonProps.data} onNext={goNext} />;
      case 'word_study': return <WordStudyPlayer {...commonProps} />;
      case 'phrase_study': 
      case 'sentences': return <CardListRenderer {...commonProps} type={type} />;
      case 'grammar_study': 
        return <GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goNext} onPrev={goPrev} />;
      case 'choice': return <XuanZeTi {...commonProps} />;
      case 'lianxian': return <LianXianTi {...commonProps} />;
      case 'paixu': return <PaiXuTi {...commonProps} />;
      case 'panduan': return <PanDuanTi {...commonProps} />;
      case 'gaicuo': return <GaiCuoTi {...commonProps} />;
      case 'image_match_blanks': return <TianKongTi {...commonProps} />;
      case 'complete': 
      case 'end': 
        return <CompletionBlock data={commonProps.data} router={router} onRestart={resetLesson} />;
      default: return <div className="p-10 text-center">未知题型: {type}</div>;
    }
  };

  if (!hasMounted) return null;
  const type = currentBlock?.type?.toLowerCase();

  // 哪些页面隐藏底部导航
  const hideBottomNav = ['cover', 'start_page', 'word_study', 'complete', 'end'].includes(type);
  const hideTopProgressBar = ['cover', 'start_page', 'complete', 'end'].includes(type);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ touchAction: 'none' }}>
      <style>{`
        ::-webkit-scrollbar { display: none; } 
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes bounce-custom {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow { animation: bounce-custom 2s infinite; }
      `}</style>
      
      {/* 顶部细进度条 */}
      <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] px-6 py-2 z-50 pointer-events-none">
        {!hideTopProgressBar && (
          <div className="h-1 bg-slate-200/50 rounded-full overflow-hidden backdrop-blur-md">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <main className="relative w-full h-full z-10">
        {renderBlock()}
      </main>

      {/* 底部导航按钮 - 只有左右按钮，无背景无指示器 */}
      {!hideBottomNav && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between pointer-events-none"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        >
            {/* 上一个 */}
            <button 
              onClick={goPrev}
              disabled={currentIndex === 0}
              className={`pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center border border-slate-100 shadow-lg transition-all
                ${currentIndex === 0
                  ? 'bg-slate-50 text-slate-200 opacity-0 cursor-not-allowed' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 active:scale-95'}`}
            >
              <FaChevronLeft size={20} />
            </button>

            {/* 下一个 */}
            <button 
              onClick={goNext}
              className="pointer-events-auto px-8 h-14 bg-slate-900 text-white rounded-full font-bold text-lg shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center gap-3 hover:bg-slate-800"
            >
              继续 <FaChevronRight size={16} />
            </button>
        </div>
      )}
      
      {/* 跳转弹窗 - 逻辑保留，但触发入口已移除 */}
      {isJumping && (
        <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-white p-8 rounded-[2rem] shadow-2xl w-72 text-center animate-in zoom-in-95 duration-200">
                <h3 className="font-black text-slate-700 mb-6">跳转到指定页</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const p = parseInt(jumpValue);
                  if (p >= 1 && p <= totalBlocks) setCurrentIndex(p - 1);
                  setIsJumping(false); setJumpValue('');
                }}>
                    <input 
                        type="number" autoFocus value={jumpValue} 
                        onChange={e => setJumpValue(e.target.value)} 
                        placeholder={`1 - ${totalBlocks}`}
                        className="w-full text-center text-4xl font-black text-blue-600 border-b-4 border-blue-100 outline-none pb-2 mb-8 bg-transparent" 
                    />
                    <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all">确认跳转</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
