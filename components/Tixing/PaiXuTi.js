import React, { useState, useEffect, useRef } from 'react';
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
  FaRedo,
  FaTachometerAlt 
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. IndexedDB 缓存
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
// 2. 音效与TTS控制器
// =================================================================================

// 播放音效
const playSfx = (type) => {
  const paths = {
    click: '/sounds/click.mp3',
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/incorrect.mp3',
    switch: '/sounds/switch-card.mp3'
  };
  const path = paths[type];
  if (!path) return;
  
  const audio = new Audio(path);
  audio.volume = 1.0;
  audio.play().catch(() => {});
};

// 震动反馈
const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// 语音控制器
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

  // 播放单条 (带语速)
  async playSingle(text, lang = 'zh', speed = 1.0) {
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
      // 缅语通常不支持语速调节(取决于引擎)，中文支持
      if (lang !== 'my') audio.playbackRate = speed;
      
      this.currentAudio = audio;
      audio.play().catch(() => {});
    } catch (e) {
      console.error(e);
    }
  },

  // 播放混合文本 (带语速)
  async playMixed(text, speed = 1.0, onStart, onEnd) {
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
          const audio = new Audio(url);
          if (!isMy) audio.playbackRate = speed;
          return audio;
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
  /* 增加顶部空间，适应更大的人物 */
  padding: 40px 20px 0px; 
  display: flex; justify-content: center;
  margin-bottom: 10px;
}
.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; 
  align-items: flex-end; /* 底部对齐 */
  gap: 10px;
}
.teacher-img {
  height: 240px; /* 大尺寸 */
  width: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
  flex-shrink: 0;
  margin-left: -10px;
}
.bubble-box {
  flex: 1; background: #fff;
  border-radius: 20px 20px 20px 4px;
  padding: 16px;
  border: 2px solid #e2e8f0;
  position: relative;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  margin-bottom: 40px; /* 把气泡顶上去一点 */
}
.bubble-tail {
  position: absolute; 
  bottom: 15px; left: -11px;
  width: 0; height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 12px solid #e2e8f0;
}
.bubble-tail::after {
  content: ''; position: absolute;
  top: -7px; left: 3px;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-right: 9px solid #fff;
}
.question-img-small {
  width: 60px; height: 60px;
  object-fit: cover; border-radius: 8px;
  margin-right: 10px; float: left;
  border: 1px solid #f1f5f9;
}

/* --- 核心交互区 --- */
.pxt-scroll-body {
  flex: 1; overflow-y: auto;
  padding: 0 16px 220px; 
  display: flex; flex-direction: column; align-items: center;
}

/* --- 答题排序框 --- */
.sort-area {
  width: 100%; max-width: 600px;
  min-height: 120px;
  background: #fff;
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  padding: 12px;
  display: flex; flex-wrap: wrap; gap: 8px;
  align-content: flex-start;
  margin-bottom: 24px;
  transition: all 0.3s ease;
}
.sort-area.active { border-color: #3b82f6; background: #eff6ff; border-style: solid; }
.sort-area.error { border-color: #fca5a5; background: #fef2f2; border-style: solid; }
.sort-area.success { border-color: #86efac; background: #f0fdf4; border-style: solid; }

/* --- 待选池 --- */
.pool-area {
  width: 100%; max-width: 600px;
  display: flex; flex-wrap: wrap; 
  justify-content: center; 
  gap: 10px;
}

/* --- 卡片样式 --- */
.word-card {
  touch-action: none;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-bottom: 3px solid #e2e8f0;
  border-radius: 12px;
  padding: 6px 14px;
  font-size: 1.15rem;
  font-weight: 700;
  color: #334155;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  user-select: none;
  cursor: grab;
  transition: all 0.1s;
  min-width: 50px;
}
.word-card:active { transform: translateY(2px); border-bottom-width: 1px; margin-top: 2px; }
.word-card.in-pool { background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
.word-card.dragging { opacity: 0.3; }
.word-card.overlay { 
  transform: scale(1.1) rotate(2deg); 
  box-shadow: 0 10px 25px rgba(0,0,0,0.15); 
  z-index: 999; border-color: #3b82f6; background: #fff;
}
.pinyin-sub { font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-bottom: 0px; line-height: 1.2; }

/* --- 底部控制栏 --- */
.footer-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 20px calc(30px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f1f5f9;
  display: flex; justify-content: center;
  z-index: 50;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.02);
}
.check-btn {
  width: 100%; max-width: 600px;
  background: #58cc02; color: white;
  padding: 15px; border-radius: 16px;
  font-size: 1.1rem; font-weight: 800; text-transform: uppercase;
  box-shadow: 0 4px 0 #46a302;
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
  font-size: 1.4rem; font-weight: 800; margin-bottom: 16px;
}
.correct-answer-box {
  background: #fff; padding: 14px; border-radius: 12px;
  margin-bottom: 20px; color: #475569; font-size: 1.1rem; font-weight: 600;
  border: 1px solid rgba(0,0,0,0.05);
}
.explanation-box {
  background: #fffbeb; border: 1px solid #fcd34d;
  padding: 14px; border-radius: 12px;
  margin-bottom: 20px; font-size: 0.95rem; color: #92400e;
  line-height: 1.6;
}
.next-action-btn {
  width: 100%; padding: 15px; border-radius: 16px; border: none;
  font-size: 1.1rem; font-weight: 800; text-transform: uppercase;
  color: white; cursor: pointer;
  border-bottom: 4px solid rgba(0,0,0,0.2);
}
.next-action-btn:active { transform: translateY(4px); border-bottom-width: 0; }
.btn-correct { background: #58cc02; }
.btn-wrong { background: #ef4444; }
`;

// =================================================================================
// 4. 组件：卡片内容 (统一处理拼音)
// =================================================================================
const CardContent = ({ text }) => {
  // 简单判断是否标点，是则不注音
  const isPunc = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(text);
  const py = !isPunc ? pinyin(text, { toneType: 'mark' }) : '';

  return (
    <>
      {py && <div className="pinyin-sub">{py}</div>}
      <div>{text}</div>
    </>
  );
};

// =================================================================================
// 5. 组件：排序项 (Draggable)
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

  if (isOverlay) {
    return (
      <div className="word-card overlay">
         <CardContent text={content} />
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
      <CardContent text={content} />
    </div>
  );
};

// =================================================================================
// 6. 主逻辑组件
// =================================================================================
const PaiXuTi = ({ 
  data, 
  onCorrect, 
  onNext, 
  onWrong 
}) => {
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
  const [speed, setSpeed] = useState(1.0); // 语速状态

  // 初始化
  useEffect(() => {
    if (!items) return;
    
    // 随机打乱 ID (包含干扰项)
    const ids = items.map(i => i.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setPoolIds(ids);
    setAnswerIds([]);
    setGameStatus('idle');
    
    // 自动朗读题目
    audioController.stop(); 
    let timer;
    if (title) {
        timer = setTimeout(() => {
            audioController.playMixed(title, speed, () => setIsPlaying(true), () => setIsPlaying(false));
        }, 800);
    }

    return () => {
        if(timer) clearTimeout(timer);
        audioController.stop();
    };
  }, [data]); // 注意：这里没有将 speed 放入依赖，因为切换语速不应重置题目

  // 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findItem = (id) => items.find(i => i.id === id);

  // 切换语速
  const toggleSpeed = (e) => {
      e.stopPropagation();
      const newSpeed = speed === 1.0 ? 0.75 : 1.0;
      setSpeed(newSpeed);
      // 可选：切换时给个提示音或重读
      // audioController.playMixed(title, newSpeed); 
  };

  // 点击卡片
  const handleCardClick = (id) => {
    if (gameStatus === 'success') return;

    playSfx('click');
    vibrate(15);
    
    const item = findItem(id);
    if (item) audioController.playSingle(item.text, 'zh', speed);

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
    vibrate(15);
  };

  // 提交检查
  const handleCheck = () => {
    // 先播放点击音效
    playSfx('click'); 

    const currentStr = answerIds.join(',');
    const correctStr = (correctOrder || []).join(',');

    const isCorrect = currentStr === correctStr;

    // 延迟一点点出结果，让点击感更自然
    setTimeout(() => {
        if (isCorrect) {
          setGameStatus('success');
          playSfx('correct');
          confetti({ particleCount: 150, spread: 100, origin: { y: 0.65 } });
          
          const fullSentence = correctOrder.map(id => findItem(id).text).join('');
          audioController.playSingle(fullSentence, 'zh', speed); 
          
          if (onCorrect) onCorrect();
        } else {
          setGameStatus('error');
          playSfx('wrong');
          vibrate([50, 50, 50]);
          if (onWrong) onWrong();
        }
    }, 150);
  };

  const handleNext = () => {
    playSfx('switch'); // 翻页音效
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
             <div className="bubble-box" onClick={() => audioController.playMixed(title, speed)}>
               <div className="bubble-tail" />
               
               <div className="flex items-start gap-2">
                 {imageUrl && <img src={imageUrl} className="question-img-small" alt="Context" />}
                 
                 <span className="text-lg font-semibold text-slate-700 leading-snug flex-1 pt-1">
                   {title || "Put the words in the correct order."}
                 </span>
                 
                 <div className="flex flex-col gap-2 shrink-0">
                    <button className={`p-2 rounded-full ${isPlaying ? 'text-blue-600' : 'text-slate-400'} bg-slate-50`}>
                        {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
                    </button>
                    <button 
                        onClick={toggleSpeed}
                        className="p-2 rounded-full text-slate-400 bg-slate-50 text-xs font-bold flex items-center justify-center border border-slate-200"
                    >
                        {speed}x
                    </button>
                 </div>
               </div>
             </div>
          </div>
        </div>

        {/* --- 答题区与选词区 --- */ }
        <div className="pxt-scroll-body">
          {/* 1. 答案排序区 */}
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
               <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">
                 Tap words below
               </div>
             )}
          </div>

          {/* 2. 待选池 (自动拼音) */}
          <div className="pool-area">
             {poolIds.map(id => (
               <div key={id} onClick={() => handleCardClick(id)}>
                  <div className="word-card in-pool">
                    <CardContent text={findItem(id)?.text} />
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

        {/* --- 结果弹层 --- */}
        <div className={`result-sheet ${isOrderedResult(gameStatus) ? 'open' : ''} ${gameStatus === 'success' ? 'correct' : 'wrong'}`}>
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

           {gameStatus === 'error' && (
             <>
               <div className="sheet-header">
                 <FaTimes /> Incorrect
               </div>
               
               <div className="mb-2 text-sm font-bold opacity-80">Correct Answer:</div>
               <div className="correct-answer-box">
                  {correctOrder?.map(id => findItem(id)?.text).join('')}
               </div>

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

// 辅助函数
function isOrderedResult(status) {
  return status === 'success' || status === 'error';
}

export default PaiXuTi;
