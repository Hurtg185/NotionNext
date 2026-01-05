import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import ReactPlayer from 'react-player';
import {
  FaPause, FaPlay, FaChevronRight, FaVolumeUp, 
  FaExclamationTriangle, FaBookReader, FaRobot
} from 'react-icons/fa';
import { useAI } from '../AIConfigContext';

// =================================================================================
// ===== 0. 音效工具 =====
// =================================================================================
const playSFX = (type) => {
  if (typeof window === 'undefined') return;
  const audio = new Audio(
    type === 'switch' ? '/sounds/switch-card.mp3' : '/sounds/click.mp3'
  );
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

// =================================================================================
// ===== 1. 健壮的 TTS Hook =====
// =================================================================================
function useRobustTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    activeId: null,
    loadingId: null,
  });

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioRef.current = null;
  }, []);

  const play = useCallback(async (text, uniqueId, voiceOverride = null) => {
    playSFX('click');
    if (playerState.activeId === uniqueId && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
      } else {
        audioRef.current.pause();
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      }
      return;
    }

    cleanupAudio();
    setPlayerState({ isPlaying: false, activeId: uniqueId, loadingId: uniqueId });

    const cleanText = String(text)
      .replace(/\*\*|~~|\{\{|\}\}|###/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!cleanText) {
      setPlayerState({ isPlaying: false, activeId: null, loadingId: null });
      return;
    }

    const targetVoice = voiceOverride || (/[\u1000-\u109F]/.test(text) ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoMultilingualNeural');

    try {
      const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${targetVoice}&_ts=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS API Error');
      const blob = await response.blob();
      
      if (!mountedRef.current) return;

      const blobUrl = URL.createObjectURL(blob);
      audioUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      audio.onended = () => {
         if (!mountedRef.current) return;
         setPlayerState({ isPlaying: false, activeId: null, loadingId: null });
      };

      await audio.play();
      setPlayerState({ isPlaying: true, activeId: uniqueId, loadingId: null });
    } catch (e) {
      console.error("TTS Play failed:", e);
      setPlayerState({ isPlaying: false, activeId: null, loadingId: null });
    }
  }, [playerState.activeId, cleanupAudio]);

  return { ...playerState, play, stop: cleanupAudio };
}

// =================================================================================
// ===== 2. 文本渲染组件 =====
// =================================================================================
const PinyinText = ({ text, onClick, color = '#000000', bold = false, strikethrough = false }) => {
  if (!text) return null;
  const displayable = text.replace(/\*\*|~~|\{\{|\}\}|###/g, '');
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = displayable.split(regex);

  return (
    <span
      onClick={(e) => { if(onClick) { e.stopPropagation(); onClick(text); } }}
      style={{
        lineHeight: '2.4', 
        wordBreak: 'break-word', 
        color: color,
        fontWeight: bold ? '700' : '400', 
        fontSize: '1.1rem', 
        cursor: onClick ? 'pointer' : 'default',
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

const RichTextRenderer = ({ content, onPlayText, activeTtsId }) => {
  if (!content) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {content.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;

        if (trimmed.startsWith('###')) {
          return <h3 key={idx} style={styles.h3}>{trimmed.replace(/###\s?/, '')}</h3>;
        }

        const segmentId = `seg_${idx}`;

        return (
          <div key={idx} style={styles.textRow}>
            {trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g).map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                    <PinyinText text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#0000ff" bold={true} />
                  </span>
                );
              } 
              if (part.startsWith('~~') && part.endsWith('~~')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#ef4444" strikethrough={true} />;
              }
              if (part.startsWith('{{') && part.endsWith('}}')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#eab308" bold={true} />;
              }
              
              return <PinyinText key={pIdx} text={part} onClick={() => onPlayText(trimmed, segmentId)} />;
            })}
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 3. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, level = "HSK 1", onComplete }) => {
  // 引入 AI 上下文
  const { triggerAI, updatePageContext, isAiOpen } = useAI();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const playerContainerRef = useRef(null);
  const contentRef = useRef(null);

  const { play, stop, activeId } = useRobustTTS();

  // 数据标准化：支持视频链接、封面图
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || '',
      pattern: item['句型结构'] || '',
      // 支持字段: '视频链接' (videoUrl) 和 '视频封面' (poster)
      videoUrl: item['视频链接'] || item.videoUrl || '',
      videoPoster: item['视频封面'] || item.poster || '', 
      explanationRaw: item['语法详解'] || '',
      attention: item['注意事项'] || '',
      dialogues: (item['例句列表'] || []).map((ex, i) => {
        const s = (ex.speaker || '').toUpperCase();
        const isBoy = s === 'B' || s.includes('男') || s.includes('BOY');
        return {
          id: ex.id || i, 
          isMale: isBoy,
          sentence: ex['句子'] || ex.sentence || '',
          translation: ex['翻译'] || ex.translation || '',
        };
      })
    }));
  }, [grammarPoints]);

  const currentPoint = normalizedPoints[currentIndex];

  // =================================================================================
  // 核心逻辑：构造 AI 上下文并触发
  // =================================================================================
  
  // 构造“全知视角”的内容包
  const constructFullAIContent = useCallback((point) => {
    if (!point) return '';
    let content = `【语法标题】：${point.title}\n`;
    content += `【核心句型】：${point.pattern}\n\n`;
    content += `【详解内容】：\n${point.explanationRaw}\n\n`;
    
    if (point.attention) {
      content += `【注意事项/易错点】：\n${point.attention}\n\n`;
    }
    
    if (point.dialogues && point.dialogues.length > 0) {
      content += `【参考例句】：\n`;
      point.dialogues.forEach((d, i) => {
        content += `${i+1}. ${d.sentence} (${d.translation})\n`;
      });
    }
    return content;
  }, []);

  // 触发 AI 讲解
  const handleAskAI = useCallback(() => {
    if (!currentPoint) return;
    playSFX('click');
    const fullContent = constructFullAIContent(currentPoint);
    // 构造带等级信息的 ID，确保 AI Provider 能识别等级 (如: HSK 1 -> hsk1_grammar_01)
    const levelId = `${level.replace(/\s+/g, '').toLowerCase()}_grammar_${currentPoint.id}`;
    triggerAI(currentPoint.title, fullContent, levelId);
  }, [currentPoint, level, constructFullAIContent, triggerAI]);

  // 自动同步逻辑
  useEffect(() => {
    if (currentPoint) {
      const fullContent = constructFullAIContent(currentPoint);
      // 1. 静默更新上下文 (AI 随时准备着)
      updatePageContext(fullContent);

      // 2. 如果 AI 窗口已打开，切换页面时自动触发新讲解
      if (isAiOpen) {
        const levelId = `${level.replace(/\s+/g, '').toLowerCase()}_grammar_${currentPoint.id}`;
        triggerAI(currentPoint.title, fullContent, levelId);
      }
    }
  }, [currentIndex, currentPoint, isAiOpen, level, updatePageContext, triggerAI, constructFullAIContent]);

  // =================================================================================
  // UI 交互逻辑
  // =================================================================================

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
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translate3d(30px,0,0)' },
    enter: { opacity: 1, transform: 'translate3d(0,0,0)' },
    leave: { opacity: 0, transform: 'translate3d(-30px,0,0)', position: 'absolute' },
  });

  const handleNext = () => {
    playSFX('switch');
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
      {/* 悬浮 AI 按钮：点击立即讲解当前内容 */}
      <button style={styles.aiFloatBtn} onClick={handleAskAI}>
        <FaRobot /> AI 讲解
      </button>

      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 核心句型卡片 + 视频封面 */}
                <div style={styles.headerRow}>
                  <div style={styles.patternCard}>
                    <div style={styles.cardLabel}><FaBookReader /> 核心句型</div>
                    <div onClick={() => play(gp.pattern, `pat_${gp.id}`)} style={styles.patternText}>
                      <PinyinText text={gp.pattern} color="#1e40af" bold />
                    </div>
                  </div>

                  {/* 视频模块：支持 videoUrl 和 videoPoster */}
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
                        // 如果有封面图，light 属性显示图片；否则显示默认黑色+播放按钮
                        light={gp.videoPoster || true} 
                        config={{ file: { attributes: { controlsList: 'nodownload' }}}} 
                      />
                      <div style={styles.videoOverlay}>点击全屏</div>
                    </div>
                  ) : (
                    // 无视频时的占位装饰
                    <div style={{...styles.videoBox, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <span style={{fontSize: '2rem'}}>📖</span>
                    </div>
                  )}
                </div>

                {/* 语法详解 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>📝 语法详解</div>
                  <div style={styles.textBody}>
                    <RichTextRenderer 
                      content={gp.explanationRaw} 
                      onPlayText={play} 
                      activeTtsId={activeId}
                    />
                  </div>
                </div>

                {/* 注意事项 */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={{...styles.sectionHeader, color: '#ef4444'}}>
                      <FaExclamationTriangle /> 注意事项
                    </div>
                    <div style={styles.attentionBox}>
                       <RichTextRenderer 
                        content={gp.attention} 
                        onPlayText={play} 
                        activeTtsId={activeId}
                       />
                    </div>
                  </div>
                )}

                {/* 对话模块 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>💬 场景对话</div>
                  <div style={styles.chatList}>
                    {gp.dialogues.map((ex, idx) => {
                      const isMale = ex.isMale;
                      const voice = isMale ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyouNeural';
                      const exId = `ex_${gp.id}_${idx}`;
                      return (
                        <div key={idx} 
                             style={{ ...styles.chatRow, flexDirection: isMale ? 'row-reverse' : 'row' }} 
                        >
                          <img 
                            src={isMale 
                                ? "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/10111437211381.jpg" 
                                : "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/images.jpeg"}
                            style={styles.chatAvatar} alt="avatar" 
                          />
                          <div style={{...styles.bubbleWrapper, alignItems: isMale ? 'flex-end' : 'flex-start'}}>
                             <div 
                               onClick={() => play(ex.sentence, exId, voice)}
                               style={{ 
                                 ...styles.chatBubble, 
                                 background: isMale ? '#eff6ff' : '#fff1f2', 
                                 border: isMale ? '1px solid #bfdbfe' : '1px solid #fbcfe8' 
                               }}
                             >
                                <div style={isMale ? styles.tailR : styles.tailL} />
                                <PinyinText text={ex.sentence} bold={activeId === exId} />
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

// =================================================================================
// ===== 5. 样式定义 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#fff' },
  // AI 悬浮按钮样式
  aiFloatBtn: { position: 'absolute', top: '12px', right: '16px', zIndex: 50, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '20px', padding: '6px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)', cursor: 'pointer', fontWeight: 'bold' },
  
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
  chatBubble: { padding: '12px', position: 'relative', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' },
  tailL: { position: 'absolute', top: '12px', left: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailR: { position: 'absolute', top: '12px', right: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  chatTranslation: { fontSize: '0.85rem', color: '#64748b', marginTop: '4px' },

  submitBtn: { width: '100%', background: '#000', color: 'white', border: 'none', padding: '14px 0', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
};

// 全局内联样式注入
if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .active-scale:active { transform: scale(0.97); }
    video::-webkit-media-controls-enclosure { display: flex !important; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
