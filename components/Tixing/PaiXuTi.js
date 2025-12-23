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
// 2. 音频与震动控制器
// =================================================================================

// 播放音效 (SFX)
const playSfx = (type) => {
  const paths = {
    click: '/sounds/click.mp3',
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/incorrect.mp3'
  };
  const path = paths[type];
  if (!path) return;
  
  const audio = new Audio(path);
  audio.volume = 1.0;
  audio.play().catch(() => {});
};

// 触发震动
const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// TTS 语音控制器
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
    this.activeUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeUrls = [];
  },

  async playSingle(text, lang = 'zh') {
    this.stop(); 
    if (!text) return;

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

  async playMixed(text, settings = {}, onStart, onEnd) {
    this.stop();
    if (!text) return;
    
    const reqId = this.latestRequestId;
    onStart?.();

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
// 3. 样式表 (CSS-in-JS) - 适配大图与防遮挡
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
  padding: 60px 20px 10px; 
  display: flex; justify-content: center;
}
.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; 
  align-items: center; /* 垂直居中 */
  gap: 12px;
}
.teacher-img {
  height: 180px; /* 放大人物 */
  width: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
  flex-shrink: 0;
}
.bubble-box {
  flex: 1; background: #fff;
  border-radius: 18px;
  padding: 14px 18px;
  border: 2px solid #e5e7eb;
  position: relative;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
}
.bubble-tail {
  position: absolute; 
  top: 50%; left: -10px;
  transform: translateY(-50%);
  width: 0; height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 10px solid #e5e7eb;
}
.bubble-tail::after {
  content: ''; position: absolute;
  top: -6px; left: 2px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 8px solid #fff;
}
.question-img-small {
  max-width: 80px; max-height: 80px;
  object-fit: cover; border-radius: 6px;
  margin-right: 8px; float: left;
}

/* --- 核心交互区 (可滚动) --- */
.pxt-scroll-body {
  flex: 1; overflow-y: auto;
  /* 底部留出极大空间，适配不同机型底部栏 */
  padding: 10px 16px 220px; 
  display: flex; flex-direction: column; align-items: center;
}

/* --- 答题排序框 (上方) --- */
.sort-area {
  width: 100%; max-width: 600px;
  min-height: 120px;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-top: 4px solid #e2e8f0; /* 顶部加粗模拟凹陷感 */
  border-radius: 16px;
  padding: 14px;
  display: flex; flex-wrap: wrap; gap: 10px;
  align-content: flex-start;
  margin-bottom: 30px;
  transition: all 0.3s ease;
}
.sort-area.active { border-color: #3b82f6; background: #eff6ff; }
.sort-area.error { border-color: #fca5a5; background: #fef2f2; }
.sort-area.success { border-color: #86efac; background: #f0fdf4; }

/* --- 待选池 (下方 - 包含干扰项) --- */
.pool-area {
  width: 100%; max-width: 600px;
  display: flex; flex-wrap: wrap; 
  justify-content: center; 
  gap: 12px;
}

/* --- 卡片样式 --- */
.word-card {
  touch-action: none;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-bottom: 4px solid #cbd5e1; /* 立体感 */
  border-radius: 14px;
  padding: 10px 18px;
  font-size: 1.2rem;
  font-weight: 700;
  color: #334155;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  user-select: none;
  cursor: grab;
  transition: all 0.1s;
  min-width: 60px;
}
.word-card:active { transform: translateY(2px); border-bottom-width: 2px; margin-top: 2px; }
.word-card.in-pool { background: #fff; }
.word-card.dragging { opacity: 0.3; }
.word-card.overlay { 
  transform: scale(1.05) rotate(2deg); 
  box-shadow: 0 10px 25px rgba(0,0,0,0.2); 
  z-index: 999; border-color: #3b82f6; background: #fff;
}
.pinyin-sub { font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-bottom: 2px; }

/* --- 底部控制栏 --- */
.footer-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 20px calc(40px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 2px solid #f1f5f9;
  display: flex; justify-content: center;
  z-index: 50;
}
.check-btn {
  width: 100%; max-width: 600px;
  background: #58cc02; color: white;
  padding: 16px; border-radius: 16px;
  font-size: 1.2rem; font-weight: 800; text-transform: uppercase;
  box-shadow: 0 4px 0 #46a302; /* Duolingo 风格按钮阴影 */
  border: none;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.1s;
}
.check-btn:active { transform: translateY(4px); box-shadow: none; }
.check-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: none; }

/* --- 结果面板 --- */
.result-sheet {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: white;
  border-radius: 24px 24px 0 0;
  padding: 24px 24px calc(40px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 40px rgba(0,0,0,0.15);
  transform: translateY(110%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
  max-height: 85vh; overflow-y: auto;
}
.result-sheet.correct { background: #dcfce7; color: #166534; }
.result-sheet.wrong { background: #fee2e2; color: #991b1b; }
.result-sheet.open { transform: translateY(0); }

.sheet-header {
  display: flex; align-items: center; gap: 10px;
  font-size: 1.5rem; font-weight: 800; margin-bottom: 16px;
}
.correct-answer-box {
  background: #fff; padding: 16px; border-radius: 14px;
  margin-bottom: 20px; color: #475569; font-size: 1.15rem; font-weight: 600;
  border: 2px solid rgba(0,0,0,0.05);
}
.explanation-box {
  background: #fffbeb; border: 1px solid #fcd34d;
  padding: 14px; border-radius: 12px;
  margin-bottom: 20px; font-size: 1rem; color: #92400e;
  line-height: 1.6;
}
.next-action-btn {
  width: 100%; padding: 16px; border-radius: 16px; border: none;
  font-size: 1.2rem; font-weight: 800; text-transform: uppercase;
  color: white; cursor: pointer;
  border-bottom: 4px solid rgba(0,0,0,0.2);
}
.next-action-btn:active { transform: translateY(4px); border-bottom-width: 0; }
.btn-correct { background: #58cc02; }
.btn-wrong { background: #ef4444; }
`;

// =================================================================================
// 4. 单个卡片组件
// =================================================================================
const SortableItem = ({ id, content, isPool, onClick, isOverlay }) => {
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

  // 拼音处理：标点符号不显示拼音
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
      // 这里的 onClick 用于处理“点击移动”逻辑
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
  onWrong 
}) => {
  // 数据解析
  // 题目数据应包含 items (所有卡片，含干扰项) 和 correctOrder (正确顺序的ID数组)
  const { 
    title,       
    items,       
    correctOrder,
    explanation, 
    imageUrl     
  } = data || {};

  const [poolIds, setPoolIds] = useState([]);
  const [answerIds, setAnswerIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  
  // 状态: 'idle' | 'success' | 'error'
  const [gameStatus, setGameStatus] = useState('idle');
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化
  useEffect(() => {
    if (!items) return;
    
    // 将 items 里的所有 ID 取出并随机打乱 (包含了正确项和干扰项)
    const ids = items.map(i => i.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setPoolIds(ids);
    setAnswerIds([]);
    setGameStatus('idle');
    
    // 音频重置
    audioController.stop(); 
    let timer;
    if (title) {
        timer = setTimeout(() => {
            audioController.playMixed(title, {}, () => setIsPlaying(true), () => setIsPlaying(false));
        }, 800);
    }

    return () => {
        if(timer) clearTimeout(timer);
        audioController.stop();
    };
  }, [data]); 

  // 传感器设置 (Pointer 距离 5px 激活，避免误触)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findItem = (id) => items.find(i => i.id === id);

  // 点击卡片移动逻辑
  const handleCardClick = (id) => {
    if (gameStatus === 'success') return;

    // 播放点击音效和轻微震动
    playSfx('click');
    vibrate(15);
    
    const item = findItem(id);
    if (item) audioController.playSingle(item.text);

    // 逻辑：如果在答案区，移回池子；如果在池子，移入答案区
    if (answerIds.includes(id)) {
      setAnswerIds(prev => prev.filter(i => i !== id));
      setPoolIds(prev => [...prev, id]);
    } else {
      setPoolIds(prev => prev.filter(i => i !== id));
      setAnswerIds(prev => [...prev, id]);
      // 如果之前是错误状态，用户修改答案后重置为 idle
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
    vibrate(15); // 拖拽放下时震动
  };

  // 提交检查
  const handleCheck = () => {
    const currentStr = answerIds.join(',');
    const correctStr = (correctOrder || []).join(',');

    // 验证逻辑：
    // 1. 顺序必须完全一致
    // 2. 干扰项(不在 correctOrder 里)不能出现在 answerIds 里
    // 3. 必须包含所有 correctOrder 里的项
    if (currentStr === correctStr) {
      setGameStatus('success');
      playSfx('correct');
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.65 } });
      
      // 播放完整句子
      const fullSentence = correctOrder.map(id => findItem(id).text).join('');
      audioController.playSingle(fullSentence); 
      
      if (onCorrect) onCorrect();
    } else {
      setGameStatus('error');
      playSfx('wrong');
      vibrate([50, 50, 50]); // 强烈震动反馈
      if (onWrong) onWrong();
    }
  };

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
          vibrate(10);
        }} 
        onDragEnd={handleDragEnd}
      >
        {/* --- 顶部 Header --- */}
        <div className="pxt-header">
          <div className="scene-wrapper">
             <img 
               src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png" 
               className="teacher-img" 
               alt="Teacher" 
             />
             <div className="bubble-box" onClick={() => audioController.playMixed(title)}>
               <div className="bubble-tail" />
               
               <div className="flex items-center gap-2">
                 {/* 如果有题目图，显示小缩略图，不占太多空间 */}
                 {imageUrl && <img src={imageUrl} className="question-img-small" alt="Context" />}
                 
                 <span className="text-lg font-semibold text-slate-700 leading-snug flex-1">
                   {title || "Put the words in the correct order."}
                 </span>
                 
                 <button className={`p-2 rounded-full ${isPlaying ? 'text-blue-600' : 'text-slate-400'}`}>
                   {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
                 </button>
               </div>
             </div>
          </div>
        </div>

        {/* --- 答题区与选词区 --- */ }
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
             
             {/* 占位提示 */}
             {answerIds.length === 0 && !activeId && (
               <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">
                 Tap words below to build the sentence
               </div>
             )}
          </div>

          {/* 2. 待选池 (包含干扰项) */}
          <div className="pool-area">
             {poolIds.map(id => (
               <div key={id} onClick={() => handleCardClick(id)}>
                  <div className="word-card in-pool">
                    <div className="text-lg">{findItem(id)?.text}</div>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* --- 拖拽浮层 (Overlay) --- */}
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeItem ? <SortableItem id={activeId} content={activeItem.text} isOverlay /> : null}
        </DragOverlay>

        {/* --- 底部固定按钮 --- */}
        <div className="footer-bar">
           {!isOrderedResult(gameStatus) && (
             <button 
                className="check-btn" 
                onClick={handleCheck}
                disabled={answerIds.length === 0}
             >
               CHECK
             </button>
           )}
        </div>

        {/* --- 结果弹层 (Bottom Sheet) --- */}
        <div className={`result-sheet ${isOrderedResult(gameStatus) ? 'open' : ''} ${gameStatus === 'success' ? 'correct' : 'wrong'}`}>
           {/* 成功 */}
           {gameStatus === 'success' && (
             <>
               <div className="sheet-header">
                 <FaCheck /> Excellent!
               </div>
               <button className="next-action-btn btn-correct" onClick={handleNext}>
                 CONTINUE <FaArrowRight style={{marginLeft:8}} />
               </button>
             </>
           )}

           {/* 失败 */}
           {gameStatus === 'error' && (
             <>
               <div className="sheet-header">
                 <FaTimes /> Incorrect
               </div>
               
               <div className="mb-2 text-sm font-bold opacity-80">Correct Answer:</div>
               <div className="correct-answer-box">
                  {correctOrder?.map(id => findItem(id)?.text).join('')}
               </div>

               {/* 解析 */}
               {explanation && (
                 <div className="explanation-box animate-fade-in">
                   <div className="flex items-center gap-2 mb-2 font-bold">
                     <FaLightbulb /> Explanation:
                   </div>
                   {explanation}
                 </div>
               )}

               <button className="next-action-btn btn-wrong" onClick={handleNext}>
                 GOT IT <FaRedo style={{marginLeft:8, fontSize: '0.9em'}} />
               </button>
             </>
           )}
        </div>

      </DndContext>
    </div>
  );
};

// 辅助函数：判断是否出结果了
function isOrderedResult(status) {
  return status === 'success' || status === 'error';
}

export default PaiXuTi;
