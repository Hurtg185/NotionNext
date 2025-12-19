// components/Tixing/PaiXuTi.js

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner, FaRobot } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

const keyColors = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { bg: '#fffbeb', border: '#fef3c7', text: '#92400e' },
  { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' }
];

const styles = {
  // 全屏容器，撑满父级
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system, system-ui, sans-serif',
    padding: '20px',
    boxSizing: 'border-box'
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '30px',
    marginTop: '20px'
  },
  playCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
  },
  title: { fontSize: '1.2rem', fontWeight: '700', color: '#1e293b', textAlign: 'center', margin: 0 },
  
  // 答案槽
  answerSection: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '30px 15px',
    backgroundColor: '#f8fafc',
    borderRadius: '24px',
    border: '2px dashed #e2e8f0',
    transition: 'all 0.3s ease'
  },
  answerSectionActive: { borderColor: '#3b82f6', backgroundColor: '#f0f7ff' },
  answerSectionError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },

  // 待选池
  poolSection: {
    flexShrink: 0,
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#f1f5f9',
    borderRadius: '24px',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px'
  },

  // 卡片
  card: {
    touchAction: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 18px',
    borderRadius: '16px',
    border: '1px solid transparent',
    boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    userSelect: 'none'
  },
  pinyin: { fontSize: '0.75rem', fontWeight: '500', marginBottom: '2px', opacity: 0.7 },
  content: { fontSize: '1.25rem', fontWeight: '600' },
  
  // 底部控制
  footer: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  btn: {
    width: '100%',
    padding: '16px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '1.1rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },
  btnPrimary: { backgroundColor: '#1e293b', color: 'white' },
  feedback: { padding: '16px', borderRadius: '20px', textAlign: 'center', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  
  explanation: { backgroundColor: '#fffbeb', color: '#92400e', padding: '16px', borderRadius: '16px', border: '1px solid #fef3c7', fontSize: '0.95rem', lineHeight: '1.6' }
};

// TTS
const ttsCache = new Map();
const triggerHaptic = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); };

const playAudio = async (text, lang = 'zh') => {
  if (!text) return;
  const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural';
  const cacheKey = `${voice}:${text}`;
  if (ttsCache.has(cacheKey)) { ttsCache.get(cacheKey).currentTime = 0; ttsCache.get(cacheKey).play(); return; }
  const audio = new Audio(`/api/tts?t=${encodeURIComponent(text)}&v=${voice}`);
  audio.oncanplaythrough = () => ttsCache.set(cacheKey, audio);
  audio.play().catch(() => {});
};

const CardItem = forwardRef(({ content, color, lang, isSmall, isDragging, ...props }, ref) => {
  const isPunc = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content?.trim());
  const py = (lang === 'zh' && !isPunc) ? pinyin(content, { toneType: 'mark' }) : '';

  return (
    <div 
      ref={ref} 
      style={{
        ...styles.card,
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text,
        transform: isSmall ? 'scale(0.85)' : 'scale(1)',
        opacity: isDragging ? 0.4 : 1,
        minWidth: isSmall ? '40px' : '50px'
      }} 
      onClick={() => { triggerHaptic(); if (props.onClick) props.onClick(); if (!isPunc) playAudio(content, lang); }}
      {...props}
    >
      {py && <div style={styles.pinyin}>{py}</div>}
      <div style={styles.content}>{content}</div>
    </div>
  );
});

const SortableCard = ({ id, content, color, lang, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform) };
  return (
    <div ref={setNodeRef} style={style}>
      <CardItem id={id} content={content} color={color} lang={lang} isDragging={isDragging} onClick={onClick} {...attributes} {...listeners} />
    </div>
  );
};

const PaiXuTi = ({ title, items: initialItems, correctOrder, aiExplanation, onCorrectionRequest, lang = 'zh', onCorrect }) => {
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });
  const [isAI, setIsAI] = useState(false);

  const items = useMemo(() => initialItems?.map((it, idx) => ({ ...it, color: keyColors[idx % keyColors.length] })) || [], [initialItems]);

  const init = useCallback(() => {
    setPoolItems([...items].sort(() => Math.random() - 0.5));
    setAnswerItems([]);
    setFeedback({ shown: false, correct: false });
    setIsAI(false);
  }, [items]);

  useEffect(() => { init(); }, [init]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const onToggle = (it) => {
    if (answerItems.some(i => i.id === it.id)) {
      setAnswerItems(prev => prev.filter(i => i.id !== it.id));
      setPoolItems(prev => [...prev, it]);
    } else {
      setPoolItems(prev => prev.filter(i => i.id !== it.id));
      setAnswerItems(prev => [...prev, it]);
    }
  };

  const onCheck = () => {
    const isCorrect = answerItems.map(i => i.id).join(',') === correctOrder.join(',');
    setFeedback({ shown: true, correct: isCorrect });
    if (isCorrect && onCorrect) setTimeout(onCorrect, 1200);
  };

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      
      <div style={styles.header}>
        <div style={styles.playCircle} onClick={() => playAudio(title, lang)}><FaVolumeUp /></div>
        <h3 style={styles.title}>{title}</h3>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveId(e.active.id)} onDragEnd={e => {
        const { active, over } = e;
        if (over && active.id !== over.id) {
          setAnswerItems(prev => arrayMove(prev, prev.findIndex(i => i.id === active.id), prev.findIndex(i => i.id === over.id)));
        }
        setActiveId(null);
      }}>
        <div style={{ ...styles.answerSection, ...(feedback.shown && !feedback.correct ? styles.answerSectionError : {}) }}>
          {answerItems.length === 0 && !activeId && <span style={{color:'#94a3b8', fontSize:'0.9rem'}}>点击卡片或拖拽至此</span>}
          <SortableContext items={answerItems} strategy={rectSortingStrategy}>
            {answerItems.map(it => <SortableCard key={it.id} id={it.id} content={it.text} color={it.color} lang={lang} onClick={() => onToggle(it)} />)}
          </SortableContext>
        </div>
        <DragOverlay>
          {activeId ? <CardItem content={items.find(i => i.id === activeId)?.text} color={items.find(i => i.id === activeId)?.color} lang={lang} /> : null}
        </DragOverlay>
      </DndContext>

      <div style={styles.poolSection}>
        {poolItems.map(it => <CardItem key={it.id} content={it.text} color={it.color} lang={lang} isSmall onClick={() => onToggle(it)} />)}
      </div>

      <div style={styles.footer}>
        {!feedback.shown ? (
          <button style={{...styles.btn, ...styles.btnPrimary}} onClick={onCheck} disabled={answerItems.length === 0}>检查答案</button>
        ) : (
          <>
            <div style={{...styles.feedback, backgroundColor: feedback.correct ? '#dcfce7':'#fee2e2', color: feedback.correct ? '#166534':'#991b1b'}}>
              {feedback.correct ? <><FaCheck /> 太棒了！</> : <><FaTimes /> 顺序错咯</>}
            </div>
            {!feedback.correct && onCorrectionRequest && (
              <button style={{...styles.btn, backgroundColor:'#f59e0b', color:'white'}} onClick={() => { setIsAI(true); onCorrectionRequest(`题目"${title}"，我排的是"${answerItems.map(i=>i.text).join('')}"，正确是"${correctOrder.map(id=>items.find(i=>i.id===id).text).join('')}"。请解释语法。`); }} disabled={isAI}>
                {isAI ? <FaSpinner style={{animation:'spin 1s linear infinite'}} /> : <><FaRobot /> 问 AI 为什么</>}
              </button>
            )}
            <button style={{...styles.btn, backgroundColor:'#64748b', color:'white'}} onClick={feedback.correct ? onCorrect : init}>
              {feedback.correct ? '下一关' : '再试一次'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaiXuTi;
