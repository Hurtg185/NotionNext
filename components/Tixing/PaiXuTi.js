import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaRobot, FaRedoAlt } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 样式常量 ---
const COLORS = {
  primary: '#3b82f6', // 蓝色主色
  success: '#22c55e', // 绿色
  error: '#ef4444',   // 红色
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#1e293b',
  placeholder: '#94a3b8'
};

const keyColors = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { bg: '#fffbeb', border: '#fef3c7', text: '#92400e' },
  { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' }
];

// --- 音效引擎 (无需外部文件) ---
const sfx = {
  ctx: null,
  init: () => {
    if (typeof window !== 'undefined' && !sfx.ctx) {
      sfx.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playTone: (type) => {
    sfx.init();
    if (!sfx.ctx) return;
    const osc = sfx.ctx.createOscillator();
    const gain = sfx.ctx.createGain();
    osc.connect(gain);
    gain.connect(sfx.ctx.destination);
    
    const now = sfx.ctx.currentTime;
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }
};

// --- TTS 播放器 ---
const ttsCache = new Map();
const playTTS = (text, lang = 'zh') => {
  if (!text) return;
  const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural';
  const cacheKey = `${voice}:${text}`;
  
  // 简单的震动反馈
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);

  if (ttsCache.has(cacheKey)) {
    const audio = ttsCache.get(cacheKey);
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  
  const audio = new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`);
  audio.oncanplaythrough = () => ttsCache.set(cacheKey, audio);
  audio.play().catch(() => {});
};

// --- 子组件: 可拖拽/点击卡片 ---
const CardItem = React.forwardRef(({ id, content, color, lang, isOverlay, isPool, onClick, style, ...props }, ref) => {
  const isPunc = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content?.trim());
  const py = (lang === 'zh' && !isPunc) ? pinyin(content, { toneType: 'mark' }) : '';

  const baseStyle = {
    backgroundColor: color?.bg || '#fff',
    borderColor: color?.border || '#e2e8f0',
    color: color?.text || '#334155',
    boxShadow: isOverlay ? '0 10px 25px rgba(0,0,0,0.15)' : '0 2px 5px rgba(0,0,0,0.05)',
    transform: isOverlay ? 'scale(1.05)' : 'scale(1)',
    cursor: 'pointer',
    ...style,
  };

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center justify-center rounded-xl border-b-4 border-l border-r border-t border-solid transition-all active:scale-95 select-none
        ${isPool ? 'min-w-[60px] h-[56px] px-3' : 'min-w-[60px] h-[64px] px-4'}
      `}
      style={baseStyle}
      onClick={(e) => {
        if(onClick) onClick();
        if(!isPunc) playTTS(content, lang);
      }}
      {...props}
    >
      {py && <span className="text-[10px] font-medium opacity-60 mb-0.5 leading-none">{py}</span>}
      <span className={`${isPool ? 'text-lg' : 'text-xl'} font-bold leading-none`}>{content}</span>
    </div>
  );
});

const SortableCard = ({ id, content, color, lang, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardItem content={content} color={color} lang={lang} onClick={onClick} />
    </div>
  );
};

// --- 主组件 ---
const PaiXuTi = ({ 
  title, 
  items: sourceItems, 
  correctOrder, 
  onCorrectionRequest, 
  onCorrect, 
  onWrong, // 新增：通知父组件“我错了，请把我加到队尾”
  lang = 'zh' 
}) => {
  
  // 状态机：idle -> playing -> checking -> success / error
  const [status, setStatus] = useState('idle'); 
  const [answerIds, setAnswerIds] = useState([]);
  const [poolIds, setPoolIds] = useState([]);
  const [activeId, setActiveId] = useState(null); // 拖拽中的ID

  // 预处理 Items，附加颜色
  const itemsMap = useMemo(() => {
    const map = {};
    sourceItems.forEach((it, idx) => {
      map[it.id] = { ...it, color: keyColors[idx % keyColors.length] };
    });
    return map;
  }, [sourceItems]);

  // 初始化：打乱顺序，清空答案区
  const initGame = useCallback(() => {
    const allIds = sourceItems.map(i => i.id);
    // Fisher-Yates Shuffle
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    setPoolIds(allIds);
    setAnswerIds([]);
    setStatus('playing');
  }, [sourceItems]);

  useEffect(() => { initGame(); }, [initGame]);

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 动作：从待选区 <-> 答案区
  const handleToggle = (id) => {
    if (status === 'success') return;
    
    if (answerIds.includes(id)) {
      setAnswerIds(prev => prev.filter(i => i !== id));
      setPoolIds(prev => [...prev, id]);
    } else {
      setPoolIds(prev => prev.filter(i => i !== id));
      setAnswerIds(prev => [...prev, id]);
      // 如果处于错误显示状态，用户开始修改时，重置为 playing
      if (status === 'error') setStatus('playing');
    }
  };

  // 动作：检查答案
  const handleCheck = () => {
    // 构建当前ID序列字符串
    const currentOrderStr = answerIds.join(',');
    const correctOrderStr = correctOrder.join(',');
    
    setStatus('checking');

    if (currentOrderStr === correctOrderStr) {
      sfx.playTone('correct');
      setStatus('success');
      playTTS("太棒了", lang);
      setTimeout(() => {
        if (onCorrect) onCorrect();
      }, 1500);
    } else {
      sfx.playTone('wrong');
      setStatus('error');
      // 这里不立即跳转，等待用户查看反馈后点击“继续”
    }
  };

  // 动作：错误后点击继续 (触发错题沉底逻辑)
  const handleContinueAfterError = () => {
    if (onWrong) {
      // 通知父组件：这道题错了，请安排重做
      onWrong(); 
    } else {
      // 如果父组件没处理，默认允许重试
      initGame();
    }
  };

  // DND 拖拽结束
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
  };

  // 渲染所需的列表
  const answerItems = answerIds.map(id => itemsMap[id]);
  const poolItems = poolIds.map(id => itemsMap[id]);
  const activeItem = activeId ? itemsMap[activeId] : null;

  // 获取正确答案文本（用于错误提示）
  const correctAnswerText = correctOrder.map(id => itemsMap[id]?.text).join('');

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto p-4 box-border font-sans bg-white md:bg-transparent">
      
      {/* 头部：标题与发音 */}
      <div className="flex-none flex flex-col items-center justify-center py-4 mb-2">
        <button 
          onClick={() => playTTS(title, lang)}
          className="w-14 h-14 mb-3 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          <FaVolumeUp size={24} />
        </button>
        <h2 className="text-xl font-bold text-slate-800 text-center leading-snug">{title}</h2>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={({active}) => setActiveId(active.id)} 
        onDragEnd={handleDragEnd}
        modifiers={[/*限制拖拽范围若需要*/]}
      >
        {/* 1. 答案区 (Sortable) */}
        <div className={`
          flex-1 flex content-center justify-center flex-wrap gap-2 p-4 rounded-3xl border-2 border-dashed transition-all duration-300
          ${answerIds.length === 0 ? 'border-slate-200 bg-slate-50' : 'border-blue-100 bg-blue-50/30'}
          ${status === 'error' ? 'border-red-200 bg-red-50' : ''}
          ${status === 'success' ? 'border-green-300 bg-green-50' : ''}
        `}>
          <SortableContext items={answerIds} strategy={rectSortingStrategy}>
            {answerItems.map(item => (
              <SortableCard 
                key={item.id} 
                id={item.id} 
                content={item.text} 
                color={item.color} 
                lang={lang}
                onClick={() => handleToggle(item.id)}
              />
            ))}
          </SortableContext>
          
          {answerIds.length === 0 && !activeId && (
            <div className="text-slate-400 text-sm font-medium self-center">点击下方卡片组成句子</div>
          )}
        </div>
        
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeItem ? <CardItem content={activeItem.text} color={activeItem.color} lang={lang} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* 2. 控制与反馈区 (紧贴答案区) */}
      <div className="flex-none mt-4 mb-6 relative z-10">
        {/* 检查按钮 / 状态按钮 */}
        {status !== 'error' ? (
          <button 
            onClick={handleCheck}
            disabled={answerIds.length === 0 || status === 'success'}
            className={`
              w-full py-3.5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all
              ${status === 'success' 
                ? 'bg-green-500 text-white shadow-green-200 scale-105' 
                : answerIds.length === 0 
                  ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                  : 'bg-slate-800 text-white shadow-slate-300 active:scale-95 hover:bg-slate-700'
              }
            `}
          >
            {status === 'success' ? <><FaCheck /> 太棒了!</> : '检查答案'}
          </button>
        ) : (
          // 错误状态下的按钮：引导至下一题（实际上是触发错题逻辑）
          <button 
             onClick={handleContinueAfterError}
             className="w-full py-3.5 bg-slate-200 text-slate-700 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-sm active:bg-slate-300 transition-colors"
          >
             继续 <FaArrowRight size={14} />
          </button>
        )}

        {/* 错误反馈层 (Collapse 动画) */}
        <div className={`
           overflow-hidden transition-all duration-300 ease-out origin-top
           ${status === 'error' ? 'max-h-60 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}
        `}>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-red-600 font-bold mb-1">
              <FaTimes /> 顺序不对哦
            </div>
            <p className="text-slate-600 mb-3 text-sm">
              正确答案：<span className="font-bold text-slate-800">{correctAnswerText}</span>
            </p>
            {onCorrectionRequest && (
              <button 
                onClick={() => onCorrectionRequest(`题目"${title}"，正确答案是"${correctAnswerText}"，我排成了"${answerItems.map(i=>i.text).join('')}"。请解析其中的语法逻辑。`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-500 text-sm font-bold rounded-full shadow-sm active:scale-95"
              >
                <FaRobot /> 为什么？
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. 待选池 (底部) */}
      <div className="flex-none min-h-[120px] bg-slate-100 rounded-t-3xl -mx-4 px-4 py-6 flex flex-wrap justify-center content-start gap-2.5 shadow-inner">
        {poolItems.map(item => (
          <CardItem 
            key={item.id}
            content={item.text}
            color={item.color}
            lang={lang}
            isPool
            onClick={() => handleToggle(item.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default PaiXuTi;
