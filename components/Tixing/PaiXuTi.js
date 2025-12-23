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
// 2. 音频控制器 (支持混合语言与队列播放，严格互斥)
// =================================================================================
const audioController = {
  currentAudio: null,
  latestRequestId: 0,
  activeUrls: [],

  // 停止所有音频，清理资源
  stop() {
    this.latestRequestId++; // 增加 ID，使后续的异步播放回调失效
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    // 清理 URL 对象，释放内存
    this.activeUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeUrls = [];
  },

  // 播放单条音频 (主要用于点击单词卡片)
  async playSingle(text, lang = 'zh') {
    this.stop(); // 立即停止其他声音
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

  // 播放混合文本 (用于题目朗读)
  async playMixed(text, settings = {}, onStart, onEnd) {
    this.stop(); // 播放前强制停止旧音频
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
        // 关键：如果 request ID 变了（说明调用了 stop），则终止
        if (reqId !== this.latestRequestId) return;
        
        if (index >= queue.length) {
          onEnd?.();
          return;
        }
        
        const audio = await queue[index]();
        
        // 再次检查 ID (因为 await 期间可能发生了 stop)
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
// 3. 样式表 (CSS-in-JS) - 修复布局问题
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
  /* 增加 padding-top 到 90px，避免太靠顶 */
  padding: 90px 20px 10px; 
  display: flex; justify-content: center;
}
.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; 
  align-items: flex-start;
  gap: 12px;
}
.teacher-img {
  height: 120px; width: auto;
  object-fit: contain;
  /* 关键：正片叠底，去除白色背景色差 */
  mix-blend-mode: multiply;
  margin-top: 4px;
}
.bubble-box {
  flex: 1; background: #fff;
  border-radius: 18px 18px 18px 0;
  padding: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  position: relative;
  margin-top: 8px;
}
.bubble-tail {
  position: absolute; 
  top: 20px; 
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
  /* 底部留白大幅增加到 200px，确保内容能滚上来不被按钮遮挡 */
  padding: 10px 16px 200px; 
  display: flex; flex-direction: column; align-items: center;
}

/* --- 答题排序框 (紧凑型) --- */
.sort-area {
  width: 100%; max-width: 600px;
  min-height: 100px;
  background: #eff6ff;
  border: 2px dashed #bfdbfe;
  border-radius: 16px;
  padding: 14px;
  display: flex; flex-wrap: wrap; gap: 10px;
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
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 1.15rem;
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
.pinyin-sub { font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-bottom: 2px; }

/* --- 底部控制栏 (按钮上移) --- */
.footer-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  /* padding-bottom 增加到 100px + 安全区域，让按钮上移 */
  padding: 20px 20px calc(100px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, #f8fafc 80%, rgba(248, 250, 252, 0));
  display: flex; justify-content: center;
  z-index: 50;
  pointer-events: none; /* 让渐变层不挡点击，只有按钮可点 */
}
.check-btn {
  pointer-events: auto;
  background: #1e293b; color: white;
  padding: 16px 60px; border-radius: 100px;
  font-size: 1.15rem; font-weight: 700;
  box-shadow: 0 6px 16px rgba(30, 41, 59, 0.3);
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
  /* 底部增加 padding 适配浏览器栏 */
  padding: 24px 24px calc(50px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(0,0,0,0.15);
  transform: translateY(110%);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
  max-height: 85vh; overflow-y: auto;
}
.result-sheet.open { transform: translateY(0); }
.sheet-header {
  display: flex; align-items: center; gap: 10px;
  font-size: 1.35rem; font-weight: 800; margin-bottom: 16px;
}
.correct-answer-box {
  background: #f1f5f9; padding: 14px; border-radius: 12px;
  margin-bottom: 20px; color: #475569; font-size: 1.1rem;
  border: 1px solid #e2e8f0;
}
/* 解析样式 */
.explanation-box {
  background: #fffbeb; border: 1px solid #fcd34d;
  padding: 14px; border-radius: 12px;
  margin-bottom: 20px; font-size: 1rem; color: #92400e;
  line-height: 1.7;
}
.next-action-btn {
  width: 100%; padding: 18px; border-radius: 16px; border: none;
  font-size: 1.15rem; font-weight: 800; color: white;
  display: flex; justify-content: center; align-items: center; gap: 8px;
  cursor: pointer;
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
  onWrong 
}) => {
  // 数据解析
  const { 
    title,       // 缅文题目
    items,       // 待排序项
    correctOrder,// 正确ID顺序
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

  // 初始化：洗牌与音频控制
  useEffect(() => {
    // 1. 重置数据
    if (!items) return;
    const ids = items.map(i => i.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setPoolIds(ids);
    setAnswerIds([]);
    setGameStatus('idle');
    
    // 2. 音频控制：进入新题时立即停止旧音频，延时1秒播放新音频
    audioController.stop(); 
    
    let timer;
    if (title) {
        timer = setTimeout(() => {
            audioController.playMixed(title, {}, () => setIsPlaying(true), () => setIsPlaying(false));
        }, 1000); // 延时 1000ms 确保页面转场完成
    }

    // 3. 卸载时清理
    return () => {
        if(timer) clearTimeout(timer);
        audioController.stop();
    };
  }, [data]); 

  // 传感器设置
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 查找 Item 对象
  const findItem = (id) => items.find(i => i.id === id);

  // 点击事件
  const handleCardClick = (id) => {
    if (gameStatus === 'success') return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    
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
      setGameStatus('success');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      
      const fullSentence = correctOrder.map(id => findItem(id).text).join('');
      // 答对时播放完整句子
      audioController.playSingle(fullSentence); 
      
      if (onCorrect) onCorrect();
    } else {
      setGameStatus('error');
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      if (onWrong) onWrong();
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
               
               {imageUrl && <img src={imageUrl} className="question-img" alt="Context" />}
               
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
               <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                 点击下方词块组句
               </div>
             )}
          </div>

          {/* 2. 待选池 */}
          <div className="pool-area">
             {poolIds.map(id => (
               <div key={id} onClick={() => handleCardClick(id)}>
                  <div className="word-card in-pool">
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

        {/* --- 底部固定按钮 (上移) --- */}
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

        {/* --- 结果弹层 (包含解析) --- */}
        <div className={`result-sheet ${gameStatus === 'success' || gameStatus === 'error' ? 'open' : ''}`}>
           {/* 成功状态 */}
           {gameStatus === 'success' && (
             <div>
               <div className="sheet-header text-green-600">
                 <FaCheck /> မှန်ပါသည်! (回答正确)
               </div>
               <button className="next-action-btn bg-green-500" onClick={handleNext}>
                 ရှေ့ဆက်မည် (Next) <FaArrowRight />
               </button>
             </div>
           )}

           {/* 失败状态 */}
           {gameStatus === 'error' && (
             <div>
               <div className="sheet-header text-red-500">
                 <FaTimes /> မှားနေပါသည် (顺序不对哦)
               </div>
               
               <div className="mb-2 text-sm text-slate-500 font-bold">အဖြေမှန် (正确答案)：</div>
               <div className="correct-answer-box">
                  {correctOrder?.map(id => findItem(id)?.text).join('')}
               </div>

               {/* 显示解析 */}
               {explanation && (
                 <div className="explanation-box animate-fade-in">
                   <div className="flex items-center gap-2 mb-2 font-bold">
                     <FaLightbulb /> ရှင်းလင်းချက် (解析):
                   </div>
                   {explanation}
                 </div>
               )}

               <button className="next-action-btn bg-slate-800" onClick={handleNext}>
                 နောက်မှပြန်ဖြေမည် (Continue) <FaRedo className="text-sm" />
               </button>
             </div>
           )}
        </div>

      </DndContext>
    </div>
  );
};

export default PaiXuTi;
