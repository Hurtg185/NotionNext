import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  closestCenter, 
  defaultDropAnimationSideEffects 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  useSortable, 
  rectSortingStrategy 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import confetti from 'canvas-confetti';
import { 
  FaVolumeUp, 
  FaCheck, 
  FaTimes, 
  FaArrowRight, 
  FaLightbulb, 
  FaSpinner, 
  FaRedo 
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. IndexedDB 缓存 (复用高性能缓存逻辑)
// =================================================================================
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';

const idb = {
  db: null,
  async init() {
    if (typeof window === 'undefined' || this.db) return;
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
    });
  },
  async get(key) {
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    await this.init();
    if (!this.db) return;
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

// =================================================================================
// 2. 音频控制器 (支持混合语言与队列播放)
// =================================================================================
const audioController = {
  currentAudio: null,
  latestRequestId: 0,
  activeUrls: [],

  stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  },

  // 播放单条音频 (主要用于点击单词卡片)
  async playSingle(text, lang = 'zh') {
    this.stop();
    if (!text) return;

    // 震动反馈
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }

    const voice = lang === 'my' ? 'my-MM-ThihaNeural' : 'zh-CN-XiaoyouNeural';
    const cacheKey = `${voice}-${text}`;

    try {
      let blob = await idb.get(cacheKey);
      if (!blob) {
        const res = await fetch(`/api/tts?t=${encodeURIComponent(text)}&v=${voice}`);
        blob = await res.blob();
        await idb.set(cacheKey, blob);
      }
      const url = URL.createObjectURL(blob);
      this.activeUrls.push(url);
      
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.play().catch(() => {});
    } catch (e) {
      console.error(e);
    }
  },

  // 播放混合文本 (用于题目朗读：可能包含缅文和中文)
  async playMixed(text, settings = {}, onStart, onEnd) {
    this.stop();
    if (!text) return;
    const reqId = this.latestRequestId;
    onStart?.();

    // 分割中文和非中文(缅文/英文)
    const regex = /([\u4e00-\u9fa5]+|[\u1000-\u109F\s]+|[a-zA-Z0-9\s]+)/g;
    const segments = text.match(regex) || [text];

    try {
      const queue = [];
      for (const seg of segments) {
        if (!seg.trim()) continue;
        const isMy = /[\u1000-\u109F]/.test(seg);
        const voice = isMy ? 'my-MM-ThihaNeural' : 'zh-CN-XiaoyouNeural';
        
        queue.push(async () => {
          const cacheKey = `${voice}-${seg}`;
          let blob = await idb.get(cacheKey);
          if (!blob) {
            const res = await fetch(`/api/tts?t=${encodeURIComponent(seg)}&v=${voice}`);
            blob = await res.blob();
            await idb.set(cacheKey, blob);
          }
          const url = URL.createObjectURL(blob);
          this.activeUrls.push(url);
          return new Audio(url);
        });
      }

      // 递归播放队列
      const playNext = async (index) => {
        if (reqId !== this.latestRequestId) return;
        if (index >= queue.length) {
          onEnd?.();
          return;
        }
        
        const audio = await queue[index]();
        if (reqId !== this.latestRequestId) return;
        
        this.currentAudio = audio;
        audio.onended = () => playNext(index + 1);
        audio.play().catch(() => playNext(index + 1));
      };

      playNext(0);
    } catch (e) {
      console.error(e);
      onEnd?.();
    }
  }
};

// =================================================================================
// 3. 样式表 (CSS-in-JS)
// =================================================================================
const styles = `
.pxt-container {
  font-family: "Padauk", "Noto Sans SC", sans-serif;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
}

/* --- 顶部场景区 --- */
.pxt-header {
  flex-shrink: 0;
  padding: 60px 20px 10px; /* 调整顶部间距，防止太靠上 */
  display: flex; justify-content: center;
}
.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; 
  align-items: flex-start; /* 改为顶部对齐，方便气泡对齐人头 */
  gap: 12px;
}
.teacher-img {
  height: 120px; width: auto;
  object-fit: contain;
  /* 解决白色背景色差，让其融入背景 */
  mix-blend-mode: multiply;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.05));
}
.bubble-box {
  flex: 1; background: #fff;
  border-radius: 18px; 18px 18px 0;
  padding: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  position: relative;
  margin-top: 10px; /* 稍微下移，与人头对齐 */
}
.bubble-tail {
  position: absolute; 
  top: 20px; /* 尾巴移到上方 */
  left: -9px;
  width: 0; height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 10px solid #fff;
}
.question-img {
  width: 100%; max-height: 120px;
  object-fit: cover; border-radius: 8px;
  margin-bottom: 8px;
}

/* --- 核心交互区 (可滚动) --- */
.pxt-scroll-body {
  flex: 1; overflow-y: auto;
  padding: 10px 16px 140px; /* 底部留白增加，避免被按钮遮挡 */
  display: flex; flex-direction: column; align-items: center;
}

/* --- 答题排序框 (紧凑型) --- */
.sort-area {
  width: 100%; max-width: 600px;
  min-height: 80px;
  background: #eff6ff;
  border: 2px dashed #bfdbfe;
  border-radius: 16px;
  padding: 12px;
  display: flex; flex-wrap: wrap; gap: 8px;
  align-content: flex-start;
  margin-bottom: 24px;
  transition: all 0.3s ease;
}
.sort-area.active { border-color: #3b82f6; background: #dbeafe; }
.sort-area.error { border-color: #fca5a5; background: #fef2f2; }
.sort-area.success { border-color: #86efac; background: #f0fdf4; }

/* --- 待选池 (上方) --- */
.pool-area {
  width: 100%; max-width: 600px;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
}

/* --- 卡片样式 --- */
.word-card {
  touch-action: none;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-bottom-width: 3px;
  border-radius: 10px;
  padding: 6px 14px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #334155;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  user-select: none;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  transition: transform 0.1s;
}
.word-card:active { transform: scale(0.96); border-bottom-width: 1px; margin-top: 2px; }
.word-card.in-pool { background: #fff; color: #1e293b; }
.word-card.dragging { opacity: 0.4; }
.word-card.overlay { 
  transform: scale(1.05) rotate(2deg); 
  box-shadow: 0 10px 20px rgba(0,0,0,0.15); 
  z-index: 999; border-color: #3b82f6; 
}
.pinyin-sub { font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-bottom: 2px; }

/* --- 底部控制栏 --- */
.footer-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 20px 50px; /* 底部间距加大，按钮上移 */
  background: linear-gradient(to top, #ffffff 90%, rgba(255,255,255,0));
  display: flex; justify-content: center;
  z-index: 50;
}
.check-btn {
  background: #1e293b; color: white;
  padding: 14px 40px; border-radius: 100px;
  font-size: 1.1rem; font-weight: 700;
  box-shadow: 0 4px 12px rgba(30, 41, 59, 0.25);
  transition: all 0.2s; border: none;
  display: flex; align-items: center; gap: 8px;
}
.check-btn:disabled { background: #cbd5e1; color: #94a3b8; box-shadow: none; }
.check-btn:active { transform: scale(0.95); }

/* --- 结果面板 --- */
.result-sheet {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: white;
  border-radius: 24px 24px 0 0;
  padding: 24px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  transform: translateY(110%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
  max-height: 80vh; overflow-y: auto;
}
.result-sheet.open { transform: translateY(0); }
.sheet-header {
  display: flex; align-items: center; gap: 10px;
  font-size: 1.25rem; font-weight: 800; margin-bottom: 12px;
}
.correct-answer-box {
  background: #f1f5f9; padding: 12px; border-radius: 12px;
  margin-bottom: 16px; color: #475569; font-size: 1rem;
}
.explanation-box {
  background: #fffbeb; border: 1px solid #fcd34d;
  padding: 12px; border-radius: 12px;
  margin-bottom: 20px; font-size: 0.95rem; color: #92400e;
  line-height: 1.6;
}
.next-action-btn {
  width: 100%; padding: 16px; border-radius: 16px; border: none;
  font-size: 1.1rem; font-weight: 700; color: white;
  display: flex; justify-content: center; align-items: center; gap: 8px;
}
`;

// =================================================================================
// 4. 单个卡片组件
// =================================================================================
const SortableItem = ({ id, content, isPool, onClick, isOverlay, ...props }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 生成拼音
  const isPunc = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content);
  const py = !isPunc ? pinyin(content, { toneType: 'mark' }) : '';

  if (isOverlay) {
    return (
      <div className="word-card overlay">
         {py && <div className="pinyin-sub">{py}</div>}
         <div>{content}</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`word-card ${isDragging ? 'dragging' : ''} ${isPool ? 'in-pool' : ''}`}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {py && <div className="pinyin-sub">{py}</div>}
      <div>{content}</div>
    </div>
  );
};

// =================================================================================
// 5. 主组件 Logic
// =================================================================================
const PaiXuTi = ({ 
  data, 
  onCorrect, 
  onNext, 
  onWrong // 关键：父组件传入此回调，处理错题
}) => {
  // 数据解析
  const { 
    title,       // 缅文题目
    items,       // 待排序项 [{id: '1', text: '我'}, ...]
    correctOrder,// 正确ID顺序 ['1', '2', ...]
    explanation, // 语法解析
    imageUrl     // 题目附图
  } = data || {};

  // 状态管理
  const [poolIds, setPoolIds] = useState([]);
  const [answerIds, setAnswerIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  
  // 流程状态: 'idle' | 'checking' | 'success' | 'error'
  const [gameStatus, setGameStatus] = useState('idle');
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化：洗牌
  useEffect(() => {
    if (!items) return;
    const ids = items.map(i => i.id);
    // Fisher-Yates Shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setPoolIds(ids);
    setAnswerIds([]);
    setGameStatus('idle');
    
    // 自动朗读题目
    if (title) {
        setTimeout(() => {
            audioController.playMixed(title, {}, () => setIsPlaying(true), () => setIsPlaying(false));
        }, 500);
    }
  }, [data]); // data 变化时重置

  // 传感器设置 (优化移动端体验)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 查找 Item 对象
  const findItem = (id) => items.find(i => i.id === id);

  // 点击事件：移动卡片 (池 <-> 答案)
  const handleCardClick = (id) => {
    if (gameStatus === 'success') return;

    // 震动
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    
    // 朗读
    const item = findItem(id);
    if (item) audioController.playSingle(item.text);

    if (answerIds.includes(id)) {
      setAnswerIds(prev => prev.filter(i => i !== id));
      setPoolIds(prev => [...prev, id]);
    } else {
      setPoolIds(prev => prev.filter(i => i !== id));
      setAnswerIds(prev => [...prev, id]);
      if (gameStatus === 'error') setGameStatus('idle');
    }
  };

  // 拖拽结束
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAnswerIds((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  };

  // 提交检查
  const handleCheck = () => {
    const currentStr = answerIds.join(',');
    const correctStr = (correctOrder || []).join(',');

    if (currentStr === correctStr) {
      // 答对
      setGameStatus('success');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      
      const fullSentence = correctOrder.map(id => findItem(id).text).join('');
      audioController.playSingle(fullSentence); // 读一遍完整句子
      
      if (onCorrect) onCorrect();
    } else {
      // 答错
      setGameStatus('error');
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      if (onWrong) onWrong(); // 触发父组件错题逻辑 (沉底)
    }
  };

  // 下一题
  const handleNext = () => {
    audioController.stop();
    if (onNext) onNext();
  };

  const activeItem = activeId ? findItem(activeId) : null;

  return (
    <div className="pxt-container">
      <style>{styles}</style>
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={({active}) => {
          setActiveId(active.id);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        }} 
        onDragEnd={handleDragEnd}
      >
        {/* --- 顶部场景 --- */}
        <div className="pxt-header">
          <div className="scene-wrapper">
             <img 
               src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png" 
               className="teacher-img" 
               alt="Teacher" 
             />
             <div className="bubble-box" onClick={() => audioController.playMixed(title)}>
               <div className="bubble-tail" />
               {/* 题目图片支持 */}
               {imageUrl && <img src={imageUrl} className="question-img" alt="Context" />}
               
               {/* 题目文本 (缅文) */}
               <div className="flex items-center gap-2">
                 <span className="text-lg font-semibold text-slate-700 leading-snug">
                   {title || "请将下方的词块排成正确的句子。"}
                 </span>
                 <button className="text-blue-500 p-1 bg-blue-50 rounded-full">
                   {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
                 </button>
               </div>
             </div>
          </div>
        </div>

        {/* --- 滚动区域：答案框 + 选词池 --- */ }
        <div className="pxt-scroll-body">
          {/* 1. 答案排序区 (Sortable) */}
          <div className={`sort-area ${gameStatus}`}>
             <SortableContext items={answerIds} strategy={rectSortingStrategy}>
               {answerIds.map(id => (
                 <SortableItem 
                   key={id} 
                   id={id} 
                   content={findItem(id)?.text} 
                   onClick={() => handleCardClick(id)}
                 />
               ))}
             </SortableContext>
             {answerIds.length === 0 && !activeId && (
               <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                 点击下方词块组句
               </div>
             )}
          </div>

          {/* 2. 待选池 (非拖拽，仅点击) */}
          <div className="pool-area">
             {poolIds.map(id => (
               <div key={id} onClick={() => handleCardClick(id)}>
                  <div className="word-card in-pool">
                    {/* 待选区也可以显示拼音，或者只显示文字 */}
                    <div className="text-base">{findItem(id)?.text}</div>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* --- 拖拽浮层 --- */}
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeItem ? <SortableItem id={activeId} content={activeItem.text} isOverlay /> : null}
        </DragOverlay>

        {/* --- 底部固定按钮 --- */}
        <div className="footer-bar">
           {gameStatus !== 'error' && gameStatus !== 'success' && (
             <button 
                className="check-btn" 
                onClick={handleCheck}
                disabled={answerIds.length === 0}
             >
               检查答案
             </button>
           )}
        </div>

        {/* --- 结果弹层 (Bottom Sheet) --- */}
        <div className={`result-sheet ${gameStatus === 'success' || gameStatus === 'error' ? 'open' : ''}`}>
           {/* 成功状态 */}
           {gameStatus === 'success' && (
             <div>
               <div className="sheet-header text-green-600">
                 <FaCheck /> 回答正确!
               </div>
               <button className="next-action-btn bg-green-500" onClick={handleNext}>
                 下一题 <FaArrowRight />
               </button>
             </div>
           )}

           {/* 失败状态 */}
           {gameStatus === 'error' && (
             <div>
               <div className="sheet-header text-red-500">
                 <FaTimes /> 顺序不对哦
               </div>
               
               <div className="mb-2 text-sm text-slate-500 font-bold">正确答案：</div>
               <div className="correct-answer-box">
                  {correctOrder?.map(id => findItem(id)?.text).join('')}
               </div>

               {explanation && (
                 <div className="explanation-box">
                   <div className="flex items-center gap-2 mb-1 font-bold">
                     <FaLightbulb /> 老师解析:
                   </div>
                   {explanation}
                 </div>
               )}

               <button className="next-action-btn bg-slate-800" onClick={handleNext}>
                 继续 (稍后重做) <FaRedo className="text-sm" />
               </button>
             </div>
           )}
        </div>

      </DndContext>
    </div>
  );
};

export default PaiXuTi;
