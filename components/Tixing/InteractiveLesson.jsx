import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaPlay } from "react-icons/fa";

// --- 1. 核心全屏播放器组件 ---
import WordStudyPlayer from './WordStudyPlayer';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 外部练习题组件 ---
// 请确保这些文件在你的项目中存在，如果不存在，请使用下方的占位符或创建对应文件
import XuanZeTi from './XuanZeTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import TianKongTi from './TianKongTi'; 
// 补充缺失的组件导入，防止报错
import PaiXuTi from './PaiXuTi'; // 需确保文件存在
// import PanDuanTi from './PanDuanTi'; // 需确保文件存在
// import DuiHua from './DuiHua'; // 假设对话组件叫这个

// --- 3. 旧版/备用组件 ---
import WordCard from '../WordCard'; 
// import PhraseCard from '../PhraseCard'; // 如果有短句卡片组件请取消注释

// ============================================================================
// ===== 占位组件 (防止因缺少文件导致整个页面崩溃) =====
// ============================================================================
const DuiHua = ({ data, onComplete }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
    <h3 className="text-xl font-bold mb-4">对话练习</h3>
    <p className="text-gray-500 mb-8">（此处应加载 DialogueCinematic 组件）</p>
    <button onClick={onComplete} className="bg-blue-600 text-white px-6 py-2 rounded-full">完成对话</button>
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
    try { 
      if (audioEl) { audioEl.pause(); audioEl = null; } 
    } catch (e) {} 
    if (onEnded) { onEnded(); onEnded = null; } 
  };

  const playUrl = async (url, { onEnd = null } = {}) => { 
    stop(); 
    if (!url) return; 
    try { 
      const a = new Audio(url); 
      a.volume = 1.0; 
      a.preload = 'auto'; 
      a.onended = () => { if (onEnd) onEnd(); if (audioEl === a) { audioEl = null; onEnded = null; } }; 
      a.onerror = () => { if (onEnd) onEnd(); }; 
      audioEl = a; 
      onEnded = onEnd; 
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
      blobCache.set(url, u); 
      return u; 
    } catch (e) { return url; } 
  };

  return { 
    stop, 
    playTTS: async (t, l='zh', r=0, cb=null) => { 
      if (!t) { if (cb) cb(); return; } 
      const v = ttsVoices[l]||ttsVoices.zh; 
      // 注意：这里的 tts 接口是示例，请确保你的服务器支持
      const u = await fetchToBlobUrl(`https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${v}&r=${r}`); 
      return playUrl(u, { onEnd: cb }); 
    }, 
    playDing: () => { try { new Audio('/sounds/click.mp3').play().catch(()=>{}); } catch(e){} } 
  };
})();

// ============================================================================
// ===== 子组件定义 =====
// ============================================================================

// 1. 列表容器适配器 (用于旧版渲染或短句)
const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  const list = data.words || data.sentences || data.vocabulary || []; 

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-50">
      <div className="flex-none pt-12 pb-4 px-4 text-center z-10 bg-slate-50">
        <h2 className="text-2xl font-black text-slate-800">
          {data.title || (isPhrase ? "常用短句" : "核心生词")}
        </h2>
        <p className="text-slate-400 text-xs mt-1">共 {list.length} 个 • 点击卡片跟读</p>
      </div>
      <div className="flex-1 w-full overflow-y-auto px-4 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {list.map((item, i) => (
            isPhrase ? (
              <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100" onClick={() => audioManager.playTTS(item.sentence || item.chinese)}>
                 <div className="text-lg font-bold text-slate-800">{item.sentence || item.chinese}</div>
                 <div className="text-sm text-slate-500 mt-1">{item.pinyin}</div>
                 <div className="text-sm text-slate-400 mt-1">{item.translation}</div>
              </div>
            ) : (
              <WordCard 
                key={item.id || i} 
                word={item}
                data={item}
                onPlay={() => audioManager.playTTS(item.word || item.chinese)}
              />
            )
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-20">
        <button 
          onClick={onComplete} 
          className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          我学会了 <FaChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// 2. 封面/首页组件 (新增：支持图片)
const CoverBlock = ({ data, onNext }) => {
  return (
    <div className="w-full h-full flex flex-col items-center relative bg-white overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-blue-50 rounded-[100%] z-0" />
      
      <div className="flex-1 flex flex-col items-center justify-center z-10 w-full px-6">
        {data.imageUrl && (
          <div className="w-64 h-64 mb-8 rounded-3xl overflow-hidden shadow-2xl shadow-blue-100">
             <img src={data.imageUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}
        <h1 className="text-3xl font-black text-slate-800 text-center mb-4 leading-tight">
          {data.title || "开始学习"}
        </h1>
        <p className="text-slate-500 text-center text-lg max-w-xs leading-relaxed">
          {data.description || "准备好了吗？让我们开始今天的课程吧！"}
        </p>
      </div>

      <div className="w-full p-8 z-10">
        <button 
          onClick={onNext}
          className="w-full py-4 bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <FaPlay size={18} /> 开始学习
        </button>
      </div>
    </div>
  );
};

// 3. 完成页面
const CompletionBlock = ({ data, router }) => { 
  useEffect(() => { 
    audioManager?.playTTS("恭喜完成学习", 'zh'); 
    // 自动返回逻辑可选
    // setTimeout(() => router.back(), 3000); 
  }, []); 
  
  return (
    <div className="flex flex-col items-center justify-center h-full animate-bounce-in bg-slate-50">
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-2">{data.title||"课程完成！"}</h2>
      <p className="text-slate-500 mb-10">你真棒！已经掌握了所有内容。</p>
      
      <div className="flex gap-4">
         <button onClick={() => router.back()} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold shadow-sm active:scale-95 transition-all">
           返回列表
         </button>
         <button onClick={() => window.location.reload()} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all">
           再学一次
         </button>
      </div>
    </div>
  ); 
};

// 4. 未知题型处理
const UnknownBlockHandler = ({ type, onSkip }) => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
    <p className="mb-4">暂不支持的题型: <span className="font-mono text-red-400 bg-red-50 px-2 py-1 rounded">{type}</span></p>
    <button onClick={onSkip} className="mt-4 text-blue-500 underline">跳过此页</button>
  </div>
);

// 辅助函数：数组打乱
const shuffleArray = (array) => {
  const newArray = [...array]; 
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; 
  }
  return newArray;
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
  
  // 1. 读取进度
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`); 
      if (saved) {
        const savedIndex = parseInt(saved, 10);
        if (savedIndex < totalBlocks) {
          setCurrentIndex(savedIndex); 
        } else {
          // 如果上次已经学完，这次从头开始（或者保留在最后也行，这里选择重置）
          setCurrentIndex(0);
          localStorage.removeItem(`lesson-progress-${lesson.id}`);
        }
      }
    } 
  }, [lesson, hasMounted, totalBlocks]);

  // 2. 保存进度
  useEffect(() => { 
    if (hasMounted && lesson?.id) {
        const isFinished = currentIndex >= totalBlocks || 
                           ['complete', 'end'].includes(blocks[currentIndex]?.type);

        if (isFinished) {
            localStorage.removeItem(`lesson-progress-${lesson.id}`);
        } else {
            localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
        }
    }
    audioManager?.stop(); 
  }, [currentIndex, lesson?.id, hasMounted, totalBlocks, blocks]);

  // 自动跳过 Teaching 类型（如果是纯逻辑块）
  useEffect(() => {
    if (currentBlock && currentBlock.type === 'teaching') {
      const timer = setTimeout(() => {
        if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
      }, 50); 
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentBlock, totalBlocks]);

  // 导航函数
  const goNext = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex < totalBlocks) {
        setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
    }
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex > 0) {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  }, [currentIndex]);
  
  const delayedNextStep = useCallback(() => {
    import('canvas-confetti').then(m => m.default({ particleCount: 80, spread: 60, origin: { y: 0.6 } })).catch(()=>{});
    setTimeout(() => {
        if (currentIndex < totalBlocks) setCurrentIndex(prev => prev + 1);
    }, 1200); 
  }, [currentIndex, totalBlocks]);

  const handleJump = (e) => { 
      e.preventDefault(); 
      const p = parseInt(jumpValue); 
      if (p >= 1 && p <= totalBlocks) setCurrentIndex(p - 1); 
      setIsJumping(false); 
      setJumpValue(''); 
  };

  // --- 核心渲染逻辑 ---
  const renderBlock = () => {
    if (!currentBlock) return <div className="text-slate-400 mt-20 text-center">Loading Content...</div>;
    const type = (currentBlock.type || '').toLowerCase();
    
    // 通用属性传递
    const commonProps = { 
      key: `${lesson.id}-${currentIndex}`, 
      data: currentBlock.content, 
      onCorrect: delayedNextStep, 
      onComplete: goNext, // 完成当前 Block 后去下一个
      onNext: goNext, 
      onPrev: goPrev,     // 传递 onPrev 给子组件
      settings: { playTTS: audioManager?.playTTS },
      isFirstBlock: currentIndex === 0
    };
    
    const CommonWrapper = ({ children }) => <div className="w-full h-full flex flex-col items-center justify-center pt-4 bg-slate-50">{children}</div>;
    const FullHeightWrapper = ({ children }) => <div className="w-full h-full flex flex-col bg-slate-50">{children}</div>;

    try {
      switch (type) {
        case 'teaching': return null; 

        // 首页/封面 (新增)
        case 'cover':
        case 'start_page':
            return <CoverBlock data={commonProps.data} onNext={goNext} />;

        // 全屏单词学习
        case 'word_study': 
          return (
            <WordStudyPlayer 
              data={commonProps.data} 
              onNext={goNext} 
              onPrev={goPrev}
              isFirstBlock={commonProps.isFirstBlock}
            />
          );

        // 短句学习列表
        case 'phrase_study': 
        case 'sentences':
          return <FullHeightWrapper><CardListRenderer {...commonProps} type={type} /></FullHeightWrapper>;

        // 语法学习 (全屏)
        case 'grammar_study': 
          if (!commonProps.data.grammarPoints?.length) return <UnknownBlockHandler type="grammar_study (empty)" onSkip={goNext} />;
          return (
             <div className="w-full h-full relative bg-slate-50">
                <GrammarPointPlayer 
                    grammarPoints={commonProps.data.grammarPoints} 
                    onComplete={commonProps.onComplete}
                    onPrev={goPrev} // 允许从语法第一页返回上一题
                />
             </div>
          );

        // 各种练习题
        case 'choice': {
            const { correctId } = commonProps.data;
            const correctAnswer = Array.isArray(correctId) ? correctId : (correctId != null ? [correctId] : []);
            return <CommonWrapper><XuanZeTi {...commonProps} data={{...commonProps.data, correctAnswer}} /></CommonWrapper>;
        }
        case 'lianxian': {
            const columnA = commonProps.data.pairs?.map(p => ({ id: p.id, content: p.left })) || [];
            const columnB = commonProps.data.pairs?.map(p => ({ id: `${p.id}_b`, content: p.right })) || [];
            const shuffledColumnB = shuffleArray(columnB);
            const pairsMap = commonProps.data.pairs?.reduce((acc, p) => { acc[p.id] = `${p.id}_b`; return acc }, {}) || {};
            
            return <CommonWrapper><LianXianTi {...commonProps} data={{...commonProps.data, columnA, columnB: shuffledColumnB, pairs: pairsMap}} /></CommonWrapper>;
        }
        case 'paixu': {
            const correctOrder = [...(commonProps.data.items || [])].sort((a,b) => a.order - b.order).map(i => i.id);
            return <CommonWrapper><PaiXuTi {...commonProps} data={{...commonProps.data, correctOrder}} /></CommonWrapper>;
        }
        
        case 'panduan': return <CommonWrapper><PanDuanTi {...commonProps} /></CommonWrapper>;
        case 'gaicuo': return <CommonWrapper><GaiCuoTi {...commonProps} /></CommonWrapper>;
        case 'image_match_blanks': return <CommonWrapper><TianKongTi {...commonProps} /></CommonWrapper>;
        case 'dialogue_cinematic': return <DuiHua {...commonProps} />;
        
        case 'complete': case 'end': return <CompletionBlock data={commonProps.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (e) { 
        console.error("Error rendering block:", type, e);
        return <UnknownBlockHandler type={`${type} Error`} onSkip={goNext} />; 
    }
  };

  if (!hasMounted) return null;

  const type = currentBlock?.type?.toLowerCase();

  // 哪些页面是"全屏沉浸式"的，不需要底部的通用导航栏
  // cover: 封面自己有大按钮
  // word_study, grammar_study: 自带全套导航
  // complete: 结束页有自己逻辑
  const hideBottomNav = ['cover', 'start_page', 'word_study', 'phrase_study', 'sentences', 'grammar_study', 'teaching', 'complete', 'end'].includes(type);
  
  // 哪些页面隐藏顶部的细条进度条 (全屏体验更好)
  const hideTopProgressBar = ['cover', 'start_page', 'word_study', 'grammar_study', 'complete', 'end'].includes(type);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans select-none" style={{ touchAction: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; } * { -webkit-tap-highlight-color: transparent; }`}</style>
      
      {/* 顶部进度条 */}
      <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] px-4 py-3 z-30 pointer-events-none">
        {!hideTopProgressBar && currentIndex < totalBlocks && (
          <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden mx-4 backdrop-blur-sm">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <main className="relative w-full h-full flex flex-col z-10 overflow-hidden">
        {currentIndex >= totalBlocks ? 
          <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : 
          renderBlock()
        }
      </main>

      {/* 底部通用导航 (仅在做练习题时显示) */}
      {!hideBottomNav && currentIndex < totalBlocks && (
        <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-8 py-4 z-30 flex justify-between items-center pointer-events-none">
            {/* 上一步 */}
            <button 
                onClick={goPrev} 
                className={`pointer-events-auto w-12 h-12 rounded-full bg-white/90 shadow-sm border border-slate-100 text-slate-400 flex items-center justify-center backdrop-blur-md active:scale-95 transition-all ${currentIndex === 0 ? 'opacity-0' : 'opacity-100'}`}
            >
                <FaChevronLeft />
            </button>
            
            {/* 页面跳转器 (点击数字) */}
            <button onClick={() => setIsJumping(true)} className="pointer-events-auto px-4 py-2 rounded-xl active:bg-black/5 transition-colors">
              <span className="text-xs font-bold text-slate-400 tracking-widest">{currentIndex + 1} / {totalBlocks}</span>
            </button>
            
            {/* 下一步 (如果是练习题，通常由题目内部触发 onCorrect，但提供一个强制跳过按钮也是可以的，或者置灰) */}
            <button 
                onClick={goNext} 
                className={`pointer-events-auto w-12 h-12 rounded-full bg-white/90 shadow-sm border border-slate-100 text-slate-400 flex items-center justify-center backdrop-blur-md active:scale-95 transition-all ${currentIndex >= totalBlocks ? 'opacity-0' : 'opacity-100'}`}
            >
                <FaChevronRight />
            </button>
        </div>
      )}
      
      {/* 快速跳转弹窗 */}
      {isJumping && (
        <div className="absolute inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-3xl shadow-2xl w-72 animate-scale-in">
                <h3 className="text-center font-bold text-slate-700 mb-4">跳转到页面</h3>
                <form onSubmit={handleJump}>
                    <input 
                        type="number" 
                        autoFocus 
                        value={jumpValue} 
                        onChange={e => setJumpValue(e.target.value)} 
                        placeholder={`1 - ${totalBlocks}`}
                        className="w-full text-center text-3xl font-black text-blue-600 border-b-2 border-slate-100 outline-none py-2 mb-6 bg-transparent" 
                    />
                    <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold active:scale-95 transition-transform">
                        GO
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
