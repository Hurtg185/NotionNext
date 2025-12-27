import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import ReactPlayer from 'react-player';
import {
  FaPause, FaPlay, FaChevronRight, FaVolumeUp, 
  FaExclamationTriangle, FaBookReader
} from 'react-icons/fa';
import { useAI } from '../AIConfigContext';

// =================================================================================
// ===== 0. 音效工具 (UI 交互反馈) =====
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
// ===== 1. 健壮的 TTS Hook (移除进度监听，彻底解决空对象崩溃问题) =====
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
    // 如果当前正在播放这个 ID，则执行暂停/继续逻辑
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

    // 播放新的文本，先清理旧的
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

    const targetVoice = voiceOverride || (/[\u1000-\u109F]/.test(text) ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural');

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
// ===== 2. 文本渲染组件 (拼音 + 排版样式 + 点击朗读) =====
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
        textDecorationColor: color === '#ff0000' ? '#ff0000' : '#ef4444', 
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

        // 识别特定加粗标题行
        const isHeader = /三个核心句型|两种其他用法|总结/.test(trimmed);
        // 识别错误提示行
        const isErrorLine = trimmed.startsWith('错误：');

        if (trimmed.startsWith('###')) {
          return <h3 key={idx} style={styles.h3}>{trimmed.replace(/###\s?/, '')}</h3>;
        }

        const segmentId = `seg_${idx}`;

        return (
          <div key={idx} style={styles.textRow}>
            {trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g).map((part, pIdx) => {
              // 重点标记 logic
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                    <PinyinText text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#0000ff" bold={true} />
                  </span>
                );
              } 
              // 红色删除线 logic
              if (part.startsWith('~~') && part.endsWith('~~')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#ff0000" strikethrough={true} />;
              }
              // 黄色加粗 logic
              if (part.startsWith('{{') && part.endsWith('}}')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#eab308" bold={true} />;
              }
              
              // 复合排版逻辑
              let displayColor = "#000000";
              let hasStrikethrough = false;
              let isBoldText = isHeader;
              
              if (isErrorLine) {
                  displayColor = "#ff0000";
                  // 只要不是行首的“错误：”字样，后面的字全部加删除线
                  if (pIdx > 0 || !trimmed.startsWith(part)) {
                      hasStrikethrough = true;
                  } else {
                      isBoldText = true;
                  }
              }

              return (
                <PinyinText 
                  key={pIdx} 
                  text={part} 
                  onClick={() => onPlayText(trimmed, segmentId)} 
                  color={displayColor}
                  bold={isBoldText}
                  strikethrough={hasStrikethrough}
                />
              );
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
  const { updatePageContext } = useAI();
  const playerContainerRef = useRef(null);
  
  // 视频状态
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);

  // TTS 状态
  const { play, stop, activeId } = useRobustTTS();

  // 数据标准化
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || '',
      pattern: item['句型结构'] || '',
      videoUrl: item['视频链接'] || 'https://audio.886.best/chinese-vocab-audio/35339558-uhd_1440_2560_25fps.mp4',
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

  // 全屏交互逻辑：进入全屏播放，退出全屏自动暂停
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

  // 更新全局 AI 上下文
  useEffect(() => {
    if (currentPoint) {
      updatePageContext(`等级:${level} | 标题:${currentPoint.title} | 内容概览:${currentPoint.explanationRaw.slice(0, 100)}`);
    }
  }, [currentPoint, level, updatePageContext]);

  // 翻页清理
  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  // 页面切换动画
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

  // 触发视频全屏
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

                {/* 核心句型卡片 + 视频封面 */}
                <div style={styles.headerRow}>
                  <div style={styles.patternCard}>
                    <div style={styles.cardLabel}><FaBookReader /> 核心句型</div>
                    <div onClick={() => play(gp.pattern, `pat_${gp.id}`)} style={styles.patternText}>
                      <PinyinText text={gp.pattern} color="#1e40af" bold />
                    </div>
                  </div>

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
                      light={true} 
                      config={{ file: { attributes: { controlsList: 'nodownload' }}}} 
                    />
                    <div style={styles.videoOverlay}>点击全屏</div>
                  </div>
                </div>

                {/* 语法详解内容 */}
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

                {/* 注意事项模块 */}
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

                {/* 对话模块 (根据 speaker 自动区分左右和音色) */}
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
// ===== 5. 样式定义 (CSS-in-JS) =====
// =================================================================================
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
  chatBubble: { padding: '12px', position: 'relative', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' },
  tailL: { position: 'absolute', top: '12px', left: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailR: { position: 'absolute', top: '12px', right: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  chatTranslation: { fontSize: '0.85rem', color: '#64748b', marginTop: '4px' },

  submitBtn: { width: '100%', background: '#000', color: 'white', border: 'none', padding: '14px 0', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
};

// 全局内联样式注入 (处理视频控制条显示)
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
