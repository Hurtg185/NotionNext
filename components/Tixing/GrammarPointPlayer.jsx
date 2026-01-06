import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import ReactPlayer from 'react-player';
import {
  FaChevronRight, 
  FaExclamationTriangle, 
  FaBookReader
} from 'react-icons/fa';
import { useAI } from '../AIConfigContext';

// =================================================================================
// ===== 文本渲染组件 (已移除所有 TTS 相关逻辑) =====
// =================================================================================
const PinyinText = ({ text, color = '#000000', bold = false, strikethrough = false }) => {
  if (!text) return null;
  const displayable = text.replace(/\*\*|~~|\{\{|\}\}|###/g, '');
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = displayable.split(regex);

  return (
    <span
      style={{
        lineHeight: '2.4', 
        wordBreak: 'break-word', 
        color: color,
        fontWeight: bold ? '700' : '400', 
        fontSize: '1.1rem',
        textDecoration: strikethrough ? 'line-through' : 'none',
        textDecorationColor: color, 
        textDecorationThickness: '2px'
      }}
    >
      {parts.map((part, idx) => {
        if (/[\u4e00-\u9fa5]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          return part.split('').map((char, cIdx) => (
            <ruby key={`${idx}-${cIdx}`} style={{ rubyPosition: 'over', margin: '0 1px' }}>
              {char}<rt style={{ fontSize: '0.6em', userSelect: 'none', color: '#64748b' }}>{pyArray[cIdx] || ''}</rt>
            </ruby>
          ));
        } else {
          return <span key={idx} style={{ fontFamily: '"Padauk", "Myanmar3", sans-serif' }}>{part}</span>;
        }
      })}
    </span>
  );
};

const RichTextRenderer = ({ content }) => {
  if (!content) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {content.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;

        if (trimmed.startsWith('###')) {
          return <h3 key={idx} style={styles.h3}>{trimmed.replace(/###\s?/, '')}</h3>;
        }

        return (
          <div key={idx} style={styles.textRow}>
            {trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g).map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                    <PinyinText text={part.slice(2, -2)} color="#0000ff" bold={true} />
                  </span>
                );
              } 
              if (part.startsWith('~~') && part.endsWith('~~')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} color="#ef4444" strikethrough={true} />;
              }
              if (part.startsWith('{{') && part.endsWith('}}')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} color="#eab308" bold={true} />;
              }
              
              return <PinyinText key={pIdx} text={part} />;
            })}
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, level = "HSK 1", onComplete }) => {
  const { prepareGrammarTask, resetToChatMode } = useAI();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const playerContainerRef = useRef(null);
  const contentRef = useRef(null);

  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || '',
      pattern: item['句型结构'] || '',
      videoUrl: item['视频链接'] || item.videoUrl || '',
      videoPoster: item['视频封面'] || item.poster || '', 
      explanationRaw: item['语法详解'] || '',
      attention: item['注意事项'] || '',
      aiPreAnswer: item['讲解脚本'] || '',
      dialogues: (item['例句列表'] || []).map((ex, i) => {
        const s = (ex.speaker || '').toUpperCase();
        const isBoy = s === 'B' || s.includes('男') || s.includes('BOY');
        return { id: ex.id || i, isMale: isBoy, sentence: ex['句子'] || '', translation: ex['翻译'] || '' };
      })
    }));
  }, [grammarPoints]);

  const currentPoint = normalizedPoints[currentIndex];
  
  useEffect(() => {
    if (currentPoint) {
      const levelId = `${level.replace(/\s+/g, '').toLowerCase()}_grammar_${currentPoint.id}`;
      
      let genericContent = `请为我讲解“${currentPoint.title}”这个语法点。\n\n【参考资料】:\n`;
      genericContent += `核心句型：${currentPoint.pattern}\n`;
      genericContent += `详解：${currentPoint.explanationRaw}\n`;
      if (currentPoint.attention) {
        genericContent += `注意事项：${currentPoint.attention}\n`;
      }
      
      prepareGrammarTask({
        title: currentPoint.title,
        content: genericContent,
        id: levelId,
        aiPreAnswer: currentPoint.aiPreAnswer,
      });
    }

    return () => {
      resetToChatMode();
    };
  }, [currentIndex, currentPoint, level, prepareGrammarTask, resetToChatMode]);

  // --- UI 交互逻辑 (已移除TTS) ---

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsVideoPlaying(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex]);

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translate3d(30px,0,0)' },
    enter: { opacity: 1, transform: 'translate3d(0,0,0)' },
    leave: { opacity: 0, transform: 'translate3d(-30px,0,0)', position: 'absolute' },
  });

  const handleNext = () => {
    if (currentIndex < normalizedPoints.length - 1) {
      setCurrentIndex(p => p + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const handleVideoFullScreen = () => {
    const el = playerContainerRef.current;
    if (el) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  if (!currentPoint) return null;

  return (
    <div style={styles.container}>
      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                <div style={styles.headerRow}>
                  <div style={styles.patternCard}>
                    <div style={styles.cardLabel}><FaBookReader /> 核心句型</div>
                    <div style={styles.patternText}>
                      <PinyinText text={gp.pattern} color="#1e40af" bold />
                    </div>
                  </div>

                  {gp.videoUrl ? (
                    <div 
                      style={styles.videoBox} 
                      ref={playerContainerRef} 
                      onClick={handleVideoFullScreen}
                    >
                      <ReactPlayer 
                        url={gp.videoUrl} 
                        width="100%" 
                        height="100%" 
                        playing={isVideoPlaying}
                        light={gp.videoPoster || true} 
                        config={{ file: { attributes: { controlsList: 'nodownload' }}}} 
                      />
                      <div style={styles.videoOverlay}>点击全屏</div>
                    </div>
                  ) : (
                    <div style={{...styles.videoBox, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <span style={{fontSize: '2rem'}}>📖</span>
                    </div>
                  )}
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionHeader}>📝 语法详解</div>
                  <div style={styles.textBody}>
                    <RichTextRenderer content={gp.explanationRaw} />
                  </div>
                </div>

                {gp.attention && (
                  <div style={styles.section}>
                    <div style={{...styles.sectionHeader, color: '#ef4444'}}>
                      <FaExclamationTriangle /> 注意事项
                    </div>
                    <div style={styles.attentionBox}>
                       <RichTextRenderer content={gp.attention} />
                    </div>
                  </div>
                )}

                <div style={styles.section}>
                  <div style={styles.sectionHeader}>💬 场景对话</div>
                  <div style={styles.chatList}>
                    {gp.dialogues.map((ex, idx) => {
                      const isMale = ex.isMale;
                      return (
                        <div key={idx} style={{ ...styles.chatRow, flexDirection: isMale ? 'row-reverse' : 'row' }}>
                          <img 
                            src={isMale ? "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/10111437211381.jpg" : "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/images.jpeg"}
                            style={styles.chatAvatar} alt="avatar" 
                          />
                          <div style={{...styles.bubbleWrapper, alignItems: isMale ? 'flex-end' : 'flex-start'}}>
                             <div style={{ ...styles.chatBubble, background: isMale ? '#eff6ff' : '#fff1f2', border: isMale ? '1px solid #bfdbfe' : '1px solid #fbcfe8' }}>
                                <div style={isMale ? styles.tailR : styles.tailL} />
                                <PinyinText text={ex.sentence} />
                                <div style={styles.chatTranslation}>{ex.translation}</div>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <button style={styles.submitBtn} onClick={handleNext}>
                  {currentIndex === normalizedPoints.length - 1 ? '完成学习' : '下一页'} <FaChevronRight size={14} />
                </button>
                <div style={{ height: '60px' }} />
              </div>
            </div>
          </animated.div>
        );
      })}
    </div>
  );
};

// --- 样式定义 (无变动) ---
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#fff' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', padding: '20px 16px 40px' },
  contentWrapper: { maxWidth: '600px', margin: '0 auto' },
  title: { fontSize: '1.4rem', fontWeight: '800', textAlign: 'center', color: '#000', marginBottom: '20px' },
  h3: { fontSize: '1.1rem', color: '#000', borderLeft: '4px solid #3b82f6', paddingLeft: '10px', marginTop: '20px', marginBottom: '10px' },
  headerRow: { display: 'flex', gap: '10px', marginBottom: '24px', alignItems: 'stretch' },
  patternCard: { flex: 1, background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  videoBox: { width: '100px', height: '150px', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative', cursor: 'pointer' },
  videoOverlay: { position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '9px', textAlign: 'center', padding: '2px 0' },
  cardLabel: { fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' },
  patternText: { fontSize: '1.15rem', textAlign: 'center' },
  section: { marginBottom: '25px' },
  sectionHeader: { fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px', color: '#000', display: 'flex', alignItems: 'center', gap: '6px' },
  textRow: { padding: '4px 0' },
  textBody: { fontSize: '1.05rem', color: '#000' },
  attentionBox: { border: '1px dashed #ef4444', borderRadius: '12px', padding: '14px' },
  chatList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  chatRow: { display: 'flex', gap: '10px' },
  chatAvatar: { width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee' },
  bubbleWrapper: { maxWidth: '85%', display: 'flex', flexDirection: 'column' },
  chatBubble: { padding: '12px', position: 'relative', borderRadius: '16px', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' },
  tailL: { position: 'absolute', top: '12px', left: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailR: { position: 'absolute', top: '12px', right: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  chatTranslation: { fontSize: '0.85rem', color: '#64748b', marginTop: '4px' },
  submitBtn: { width: '100%', background: '#000', color: 'white', border: 'none', padding: '14px 0', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
};

export default GrammarPointPlayer;
