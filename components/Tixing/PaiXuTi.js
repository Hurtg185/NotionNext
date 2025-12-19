// components/Tixing/PaiXuTi.js (优化美化版)

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner, FaLightbulb, FaRobot } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 样式定义 ---
const keyColors = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { bg: '#fffbeb', border: '#fef3c7', text: '#92400e' },
  { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' }
];

const styles = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '28px',
    padding: '24px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.05), 0 2px 5px rgba(0,0,0,0.02)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '520px',
    margin: '1rem auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    border: '1px solid #f1f5f9'
  },
  titleContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', paddingBottom: '10px' },
  title: { fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', margin: 0, textAlign: 'center' },
  titlePlayButton: { cursor: 'pointer', color: '#3b82f6', fontSize: '1.4rem', background: '#eff6ff', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'all 0.2s' },
  
  dropZone: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 14px',
    minHeight: '100px',
    backgroundColor: '#f8fafc',
    borderRadius: '20px',
    border: '2px dashed #e2e8f0',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  dropZoneActive: { borderColor: '#3b82f6', backgroundColor: '#f0f7ff' },
  dropZoneError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  
  wordPool: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#f1f5f9',
    borderRadius: '20px'
  },

  // 卡片基础样式
  card: {
    touchAction: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48px',
    padding: '8px 16px',
    borderRadius: '14px',
    border: '1px solid transparent',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    userSelect: 'none'
  },
  answerCard: { transform: 'scale(1.0)' },
  poolCard: { transform: 'scale(0.88)', opacity: 0.9, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  
  pinyin: { fontSize: '0.75rem', fontWeight: '500', marginBottom: '2px', opacity: 0.7 },
  content: { fontSize: '1.2rem', fontWeight: '600' },
  
  dragOverlay: { transform: 'scale(1.1) rotate(2deg)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', cursor: 'grabbing', opacity: 0.9 },
  
  buttonArea: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' },
  mainButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#1e293b',
    color: 'white',
    fontSize: '1.1rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },
  
  feedback: {
    padding: '14px',
    borderRadius: '16px',
    textAlign: 'center',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    animation: 'slideUp 0.3s ease-out'
  },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
  
  explanationBox: { backgroundColor: '#fffbeb', color: '#92400e', padding: '16px', borderRadius: '16px', border: '1px solid #fef3c7', fontSize: '0.95rem', lineHeight: '1.6', marginTop: '8px' },
  spinner: { animation: 'spin 1s linear infinite' },
};

// --- TTS 与音效控制 ---
const ttsCache = new Map();
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

const playTTS = async (text, lang = 'zh') => {
  if (!text) return;
  const cacheKey = `${lang}:${text}`;
  
  if (ttsCache.has(cacheKey)) {
    const audio = ttsCache.get(cacheKey);
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }

  try {
    const voice = ttsVoices[lang] || ttsVoices.zh;
    const url = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}`; // 修改为代理接口
    const audio = new Audio(url);
    audio.oncanplaythrough = () => ttsCache.set(cacheKey, audio);
    audio.play().catch(() => {});
  } catch (error) {
    console.error("TTS Error:", error);
  }
};

// --- 子组件: 卡片 ---
const Card = forwardRef(({ content, color, lang, isSmall, isDragging, ...props }, ref) => {
  const isPunctuation = useMemo(() => {
    return /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content?.trim());
  }, [content]);

  const pinyinText = useMemo(() => {
    if (lang !== 'zh' || isPunctuation) return '';
    return pinyin(content, { toneType: 'mark' });
  }, [content, lang, isPunctuation]);

  const cardStyle = {
    ...styles.card,
    backgroundColor: color.bg,
    borderColor: color.border,
    color: color.text,
    ...(isSmall ? styles.poolCard : styles.answerCard),
    ...(isDragging ? { opacity: 0.4 } : {})
  };

  return (
    <div 
      ref={ref} 
      style={cardStyle} 
      onClick={() => {
        triggerHaptic();
        if (props.onClick) props.onClick();
        if (!isPunctuation) playTTS(content, lang);
      }}
      {...props}
    >
      {!isPunctuation && <div style={styles.pinyin}>{pinyinText}</div>}
      <div style={styles.content}>{content}</div>
    </div>
  );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content, color, lang, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform) };
  
  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        id={id} 
        content={content} 
        color={color} 
        lang={lang} 
        isSmall={false}
        isDragging={isDragging}
        onClick={onClick} 
        {...attributes} 
        {...listeners} 
      />
    </div>
  );
};

// --- 主组件: PaiXuTi ---
const PaiXuTi = ({ title, items: initialItems, correctOrder, aiExplanation, onCorrectionRequest, lang = 'zh', onCorrect }) => {
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false, showExplanation: false });
  const [isRequestingAI, setIsRequestingAI] = useState(false);

  const itemsWithColors = useMemo(() => {
    return initialItems?.map((item, index) => ({
      ...item,
      color: keyColors[index % keyColors.length]
    })) || [];
  }, [initialItems]);

  const resetGame = useCallback(() => {
    const shuffled = [...itemsWithColors].sort(() => Math.random() - 0.5);
    setPoolItems(shuffled);
    setAnswerItems([]);
    setFeedback({ shown: false, correct: false, showExplanation: false });
    setIsRequestingAI(false);
  }, [itemsWithColors]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e) => setActiveId(e.active.id);

  const handleDragEnd = (e) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setAnswerItems((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const togglePlacement = (item) => {
    const isInAnswer = answerItems.some(i => i.id === item.id);
    if (isInAnswer) {
      setAnswerItems(prev => prev.filter(i => i.id !== item.id));
      setPoolItems(prev => [...prev, item]);
    } else {
      setPoolItems(prev => prev.filter(i => i.id !== item.id));
      setAnswerItems(prev => [...prev, item]);
    }
  };

  const checkAnswer = () => {
    const currentOrder = answerItems.map(i => i.id).join(',');
    const correctStr = correctOrder.join(',');
    const isCorrect = currentOrder === correctStr;

    setFeedback({ shown: true, correct: isCorrect, showExplanation: !isCorrect });
    
    if (isCorrect && onCorrect) {
      setTimeout(() => onCorrect(), 1500);
    }
  };

  const requestAI = () => {
    if (!onCorrectionRequest) return;
    setIsRequestingAI(true);
    const userAns = answerItems.map(i => i.text).join(' ');
    const correctItems = correctOrder.map(id => itemsWithColors.find(i => i.id === id));
    const correctAns = correctItems.map(i => i.text).join(' ');
    
    const prompt = `你是一位亲切的老师。学生在排序题 "${title}" 中，给出的答案是 "${userAns}"，但正确答案应该是 "${correctAns}"。请简短地解释语法原因并鼓励他。`;
    onCorrectionRequest(prompt);
  };

  const activeItem = useMemo(() => itemsWithColors.find(i => i.id === activeId), [activeId, itemsWithColors]);

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .hover-bg:hover { background: #dbeafe !important; }
      `}</style>

      {/* 标题 */}
      <div style={styles.titleContainer}>
        <div style={styles.titlePlayButton} onClick={() => playTTS(title, lang)}>
          <FaVolumeUp />
        </div>
        <h3 style={styles.title}>{title}</h3>
      </div>

      {/* 答案区 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ 
          ...styles.dropZone, 
          ...(activeId ? styles.dropZoneActive : {}),
          ...(feedback.shown && !feedback.correct ? styles.dropZoneError : {}) 
        }}>
          {answerItems.length === 0 && !activeId && <span style={{color: '#94a3b8', fontSize: '0.9rem'}}>点击下方卡片或拖拽至此</span>}
          <SortableContext items={answerItems} strategy={rectSortingStrategy}>
            {answerItems.map(item => (
              <SortableCard 
                key={item.id} 
                id={item.id} 
                content={item.text} 
                color={item.color} 
                lang={lang} 
                onClick={() => togglePlacement(item)} 
              />
            ))}
          </SortableContext>
        </div>
        
        <DragOverlay modifiers={[restrictToParentElement]}>
          {activeId && activeItem ? (
            <Card 
              content={activeItem.text} 
              color={activeItem.color} 
              lang={lang} 
              style={styles.dragOverlay} 
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 待选池 */}
      <div style={styles.wordPool}>
        {poolItems.map(item => (
          <Card 
            key={item.id} 
            content={item.text} 
            color={item.color} 
            lang={lang} 
            isSmall={true}
            onClick={() => togglePlacement(item)} 
          />
        ))}
      </div>

      {/* 底部控制 */}
      <div style={styles.buttonArea}>
        {!feedback.shown ? (
          <button style={styles.mainButton} onClick={checkAnswer} disabled={answerItems.length === 0}>
            检查答案
          </button>
        ) : (
          <>
            <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
              {feedback.correct ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 顺序不太对哦</>}
            </div>

            {feedback.showExplanation && aiExplanation && (
              <div style={styles.explanationBox}>{aiExplanation}</div>
            )}

            {!feedback.correct && !aiExplanation && onCorrectionRequest && (
              <button style={{...styles.mainButton, backgroundColor: '#f59e0b'}} onClick={requestAI} disabled={isRequestingAI}>
                {isRequestingAI ? <FaSpinner style={styles.spinner} /> : <><FaRobot /> 问问 AI 为什么</>}
              </button>
            )}

            <button style={{...styles.mainButton, backgroundColor: '#64748b'}} onClick={feedback.correct ? onCorrect : resetGame}>
              {feedback.correct ? <><FaRedo /> 下一关</> : <><FaRedo /> 重新排列</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaiXuTi;
