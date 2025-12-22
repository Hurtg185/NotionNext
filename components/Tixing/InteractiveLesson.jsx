import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { FaPlay, FaHome, FaRedo, FaStar, FaRegStar, FaClock, FaMedal } from "react-icons/fa";
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
// ===== Audio Manager (TTS 工具 - 保持不变) =====
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

// 1. 列表容器适配器 (用于 sentences / phrase_study)
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
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 active:bg-slate-50" onClick={() => audioManager.playTTS(item.sentence || item.chinese)}>
               <div className="text-lg font-bold text-slate-800">{item.sentence || item.chinese}</div>
               <div className="text-sm text-slate-500">{item.pinyin}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-6 left-0 right-0 p-6 z-20 flex justify-center">
        <button onClick={onComplete} className="w-full max-w-md py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all">
          我学会了
        </button>
      </div>
    </div>
  );
};

// 2. 封面页
const CoverBlock = ({ data, onNext }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900 overflow-hidden">
      {data.imageUrl && (
        <div className="absolute inset-0 z-0">
           <img src={data.imageUrl} alt="Cover" className="w-full h-full object-cover opacity-60 scale-105" />
           <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
        </div>
      )}
      <div className="relative z-10 w-full px-8 text-center flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight drop-shadow-lg">
          {data.title || "开始学习"}
        </h1>
        <p className="text-white/80 text-lg max-w-xs mb-16 font-medium drop-shadow-md">
          {data.description || "准备好了吗？让我们开始今天的课程吧！"}
        </p>
        <button 
          onClick={onNext}
          className="flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg shadow-xl shadow-blue-900/50 active:scale-95 transition-all"
        >
          <FaPlay size={18} />
          <span>开始挑战</span>
        </button>
      </div>
    </div>
  );
};

// 3. 结果结算页面 (重设计)
const SummaryBlock = ({ duration, mistakes, router, onRestart }) => { 
  // 评分逻辑
  let stars = 0;
  let title = "";
  let color = "";

  if (mistakes === 0) {
    stars = 3; title = "传说级表现！"; color = "text-yellow-500";
  } else if (mistakes <= 2) {
    stars = 2; title = "非常出色！"; color = "text-blue-500";
  } else {
    stars = 1; title = "继续加油！"; color = "text-slate-500";
  }

  // 格式化时间
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分 ${s}秒`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center animate-fade-in">
      {/* 奖牌/动画区 */}
      <div className="mb-8 relative">
         <div className="text-9xl filter drop-shadow-2xl animate-bounce">
            {stars === 3 ? "🏆" : stars === 2 ? "🥈" : "🥉"}
         </div>
         {stars === 3 && <div className="absolute -top-4 -right-4 text-6xl animate-pulse">✨</div>}
      </div>

      <h2 className={`text-3xl font-black mb-2 ${color}`}>{title}</h2>
      <p className="text-slate-400 mb-8 font-medium">课程完成</p>

      {/* 统计卡片 */}
      <div className="flex gap-4 w-full max-w-sm mb-10">
        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="text-yellow-400 text-2xl mb-1 flex gap-1">
              {[...Array(3)].map((_, i) => (
                 i < stars ? <FaStar key={i}/> : <FaRegStar key={i} className="text-slate-200"/>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">评分</span>
        </div>
        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="text-slate-700 text-2xl font-black mb-1 flex items-center gap-2">
               <FaClock size={20} className="text-blue-500"/> {formatTime(duration)}
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">答题耗时</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
         <button 
           onClick={onRestart} 
           className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-300 active:scale-[0.98] transition-all"
         >
           <FaRedo /> 再练一次
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
  
  // 核心状态
  const [dynamicBlocks, setDynamicBlocks] = useState([]); // 动态题目队列（含错题重做）
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // 计时器状态
  const [timeSpent, setTimeSpent] = useState(0);
  const timerRef = useRef(null);

  // 初始化
  useEffect(() => {
    setHasMounted(true);
    if (lesson?.blocks) {
      setDynamicBlocks(lesson.blocks);
    }
  }, [lesson]);

  // 获取当前块
  const currentBlock = dynamicBlocks[currentIndex];
  const type = currentBlock?.type?.toLowerCase() || '';

  // --- 智能计时器逻辑 ---
  useEffect(() => {
    if (!hasMounted || isFinished) return;

    // 定义哪些页面不需要计时（学习类）
    const isLearningPhase = ['cover', 'start_page', 'word_study', 'grammar_study', 'phrase_study', 'end'].includes(type);

    if (!isLearningPhase) {
      // 如果是做题页面，开启计时
      timerRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasMounted, isFinished, type]); // 依赖 type，切换页面时重新判断

  // 进度条计算
  const progressPercent = useMemo(() => {
    if (!dynamicBlocks.length) return 0;
    // 使用 currentIndex / 动态长度。如果错题增加，分母变大，进度条会“倒退”，符合逻辑
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

  const handleFinish = () => {
    setIsFinished(true);
    // 撒花庆祝
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    audioManager.playTTS("恭喜你完成课程", 'zh');
  };

  const handleRestart = () => {
    if (lesson?.blocks) {
      setDynamicBlocks(lesson.blocks); // 重置为原始题目
    }
    setCurrentIndex(0);
    setMistakeCount(0);
    setTimeSpent(0);
    setIsFinished(false);
  };

  // --- 错题沉底逻辑 ---
  const handleWrong = useCallback(() => {
    // 1. 记录错误次数
    setMistakeCount(prev => prev + 1);

    // 2. 复制当前 block
    const currentBlockData = dynamicBlocks[currentIndex];
    
    // 3. 生成一个重做副本 (添加 retry 标记防止 key 重复警告，或者依赖 index)
    // 注意：这里我们不修改 ID，因为子组件可能依赖 ID。React key 使用 index 即可规避。
    const retryBlock = { 
      ...currentBlockData, 
      _isRetry: true // 内部标记，仅供调试或特殊 UI 显示
    };

    // 4. 追加到队列末尾
    setDynamicBlocks(prev => [...prev, retryBlock]);

    // 注意：这里不调用 goNext，子组件通常在显示错误反馈后，让用户点击“继续”按钮，
    // 那个“继续”按钮会触发 onNext，从而进入下一题。
    // 如果子组件逻辑是自动跳转，则不需要这里处理跳转。
    // 根据之前的 PaiXuTi 和 XuanZeTi 设计，它们会在错误弹窗中提供一个按钮调用 onNext。
  }, [dynamicBlocks, currentIndex]);


  // --- 渲染逻辑 ---
  
  if (!hasMounted) return null;

  // 渲染完成页
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

  // 渲染题目块
  const renderContent = () => {
    if (!currentBlock) return <div className="p-10 text-center text-slate-400">Loading Lesson...</div>;

    const commonProps = {
      key: `${currentIndex}-${currentBlock.id || 'idx'}`, // 确保 Key 唯一，触发重渲染
      data: currentBlock.content,
      onNext: goNext,          // 通用下一步
      onComplete: goNext,      // 学习类页面完成
      onCorrect: goNext,       // 答对 -> 下一步
      onWrong: handleWrong,    // 答错 -> 错题沉底
      settings: { playTTS: audioManager?.playTTS },
      isRetry: currentBlock._isRetry // 传递给子组件（可选，比如显示“复习模式”）
    };

    switch (type) {
      case 'cover':
      case 'start_page': return <CoverBlock {...commonProps} />;
      
      // 学习类 (不计入时间，不触发错题)
      case 'word_study': return <WordStudyPlayer {...commonProps} />;
      case 'phrase_study': 
      case 'sentences': return <CardListRenderer {...commonProps} type={type} />;
      case 'grammar_study': return <GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goNext} />;
      
      // 测试类 (计入时间，触发错题)
      case 'choice': return <XuanZeTi {...commonProps} onIncorrect={handleWrong} />; // XuanZeTi 使用 onIncorrect
      case 'paixu': return <PaiXuTi {...commonProps} />; // PaiXuTi 使用 onWrong
      case 'lianxian': return <LianXianTi {...commonProps} />;
      case 'panduan': return <PanDuanTi {...commonProps} />;
      case 'gaicuo': return <GaiCuoTi {...commonProps} />;
      case 'image_match_blanks': return <TianKongTi {...commonProps} />;
      
      case 'complete': 
      case 'end': 
        // 遇到中间的 end block 直接跳过进入结算，或者作为中间休息页
        return <SummaryBlock duration={timeSpent} mistakes={mistakeCount} router={router} onRestart={handleRestart} />;
        
      default: return <div className="p-10 text-center">未知题型: {type}</div>;
    }
  };

  const hideTopProgressBar = ['cover', 'start_page', 'complete', 'end'].includes(type);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ touchAction: 'none' }}>
      <style>{`
        ::-webkit-scrollbar { display: none; } 
        * { -webkit-tap-highlight-color: transparent; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {/* 顶部进度条 (类似多邻国) */}
      {!hideTopProgressBar && (
        <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] px-6 py-4 z-50 pointer-events-none flex items-center gap-3">
           {/* 关闭/返回按钮 (可选) */}
           <div className="pointer-events-auto cursor-pointer text-slate-400" onClick={() => router.back()}>
             <FaTimes size={18} />
           </div>
           
           {/* 进度条槽 */}
           <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
             <div 
                 className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out shadow-[0_2px_0_rgba(0,0,0,0.1)_inset]" 
                 style={{ width: `${progressPercent}%` }} 
             />
             {/* 高光效果 */}
             <div className="w-full h-1 bg-white/20 absolute top-0 left-0 rounded-full" />
           </div>

           {/* 剩余题数或红心 (可选) */}
           {currentBlock._isRetry && (
             <div className="text-orange-500 font-bold text-xs flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-lg animate-pulse">
               <FaRedo /> 重做
             </div>
           )}
        </div>
      )}

      {/* 主内容区 */}
      <main className="relative w-full h-full z-10">
        {renderContent()}
      </main>

      {/* 
         注意：底部导航已移除。
         所有子组件 (PaiXuTi, XuanZeTi 等) 必须自己包含提交/下一步按钮。
         我在之前的代码中已经为它们添加了这些按钮。
      */}

    </div>
  );
}

// 简单的关闭图标组件，避免引入额外包
const FaTimes = ({size}) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height={size} width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M289.94 256l95-95A24 24 0 00351 127l-95 95-95-95a24 24 0 00-34 34l95 95-95 95a24 24 0 1034 34l95-95 95 95a24 24 0 0034-34z"></path>
  </svg>
);
