import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import ReactPlayer from 'react-player';
import {
  FaPause, FaPlay, FaChevronRight, FaVolumeUp, 
  FaExclamationTriangle, FaBookReader, FaRobot, FaCopy, FaCheck
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
    isPaused: false,
    loadingId: null,
    activeId: null,
    playbackRate: 1.0,
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
      const audio = audioRef.current;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    setPlayerState((prev) => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      activeId: null,
      loadingId: null,
    }));
  }, [cleanupAudio]);

  const play = useCallback(async (text, uniqueId, voiceOverride = null) => {
    playSFX('click');
    if (playerState.activeId === uniqueId && audioRef.current && !audioRef.current.ended) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setPlayerState(p => ({ ...p, isPlaying: true, isPaused: false }));
      } else {
        audioRef.current.pause();
        setPlayerState(p => ({ ...p, isPlaying: false, isPaused: true }));
      }
      return;
    }
    cleanupAudio();
    setPlayerState((prev) => ({ ...prev, loadingId: uniqueId, activeId: uniqueId, isPlaying: false }));

    let cleanText = String(text).replace(/\*\*|~~|\{\{|\}\}|###/g, '').replace(/<[^>]+>/g, '').trim();
    if (!cleanText) {
      setPlayerState((prev) => ({ ...prev, loadingId: null }));
      return;
    }

    let targetVoice = voiceOverride || (/[\u1000-\u109F]/.test(text) ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural');

    try {
      const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${targetVoice}`;
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
         setPlayerState((prev) => ({ ...prev, isPlaying: false, isPaused: false, activeId: null }));
      };
      await audio.play();
      setPlayerState((prev) => ({ ...prev, isPlaying: true, isPaused: false, loadingId: null }));
    } catch (e) {
      console.error("TTS Play failed:", e);
      setPlayerState((prev) => ({ ...prev, loadingId: null, activeId: null }));
    }
  }, [playerState.activeId, cleanupAudio]);

  return { ...playerState, play, stop };
}

// =================================================================================
// ===== 2. 交互工具栏 (复制, 朗读, AI解释) =====
// =================================================================================
const ActionToolbar = ({ text, onPlay, isPlaying, onAIExplain }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const cleanText = text.replace(/\*\*|~~|\{\{|\}\}|###/g, '');
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    playSFX('click');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.actionToolbar}>
      <button style={styles.actionBtn} onClick={() => onPlay(text)}>
        {isPlaying ? <FaPause size={12} color="#3b82f6" /> : <FaVolumeUp size={12} />}
        <span>朗读</span>
      </button>
      <button style={styles.actionBtn} onClick={() => onAIExplain(text)}>
        <FaRobot size={12} />
        <span>AI解释</span>
      </button>
      <button style={styles.actionBtn} onClick={handleCopy}>
        {copied ? <FaCheck size={12} color="#22c55e" /> : <FaCopy size={12} />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
    </div>
  );
};

// =================================================================================
// ===== 3. 文本渲染组件 (增强排版逻辑) =====
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
        lineHeight: '2.4', wordBreak: 'break-word', color: color,
        fontWeight: bold ? '700' : '400', fontSize: '1.1rem', cursor: onClick ? 'pointer' : 'default',
        textDecoration: strikethrough ? 'line-through' : 'none',
        textDecorationColor: '#ff0000', textDecorationThickness: '2px'
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
          return <span key={idx} style={{ fontFamily: '"Padauk", sans-serif' }}>{part}</span>;
        }
      })}
    </span>
  );
};

const RichTextRenderer = ({ content, onPlayText, activeTtsId, onAIExplain }) => {
  if (!content) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {content.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;

        // 1. 特殊标题加粗逻辑
        const isBlackBoldHeader = /三个核心句型|两种其他用法|总结/.test(trimmed);
        
        // 2. 错误文字删除线逻辑 (错误：xxx)
        const isErrorLine = trimmed.startsWith('错误：');

        if (trimmed.startsWith('###')) {
          return <h3 key={idx} style={styles.h3}>{trimmed.replace(/###\s?/, '')}</h3>;
        }

        const parts = trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g);
        const segmentId = `segment_${idx}`;

        return (
          <div key={idx} style={styles.textSegmentWrapper}>
            <div style={{ marginBottom: '4px', lineHeight: '1.8' }}>
              {parts.map((part, pIdx) => {
                // 处理加粗
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                      <PinyinText text={part.slice(2, -2)} onClick={onPlayText} color="#0000ff" bold={true} />
                    </span>
                  );
                } 
                // 处理删除线
                if (part.startsWith('~~') && part.endsWith('~~')) {
                  return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={onPlayText} color="#ff0000" strikethrough={true} />;
                }
                // 处理高亮
                if (part.startsWith('{{') && part.endsWith('}}')) {
                  return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={onPlayText} color="#eab308" bold={true} />;
                }
                
                // 处理常规行
                return (
                  <PinyinText 
                    key={pIdx} 
                    text={part} 
                    onClick={onPlayText} 
                    color={isErrorLine ? "#ff0000" : "#000000"} 
                    bold={isBlackBoldHeader}
                    strikethrough={isErrorLine && pIdx > 0} // 错误后的字加删除线
                  />
                );
              })}
            </div>
            
            {/* 每一段文字后面的交互工具栏 */}
            <ActionToolbar 
              text={trimmed} 
              onPlay={(t) => onPlayText(t, segmentId)} 
              isPlaying={activeTtsId === segmentId}
              onAIExplain={onAIExplain}
            />
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 4. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, level = "HSK 1", onComplete }) => {
  const { updatePageContext, askAI } = useAI();
  const playerContainerRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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
          gender: isBoy ? 'male' : 'female',
          sentence: ex['句子'] || ex.sentence || '',
          translation: ex['翻译'] || ex.translation || '',
          script: ex['例句发音'] || ex['句子'] || ''
        };
      })
    }));
  }, [grammarPoints]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);
  const currentPoint = normalizedPoints[currentIndex];

  const { play, stop, isPlaying, activeId } = useRobustTTS();

  // 监听全屏状态：全屏播放，退出暂停
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setIsVideoPlaying(false);
      } else {
        setIsVideoPlaying(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (currentPoint) {
      updatePageContext(`
【当前学生等级】${level}
【当前页面内容】
标题：${currentPoint.title}
详解：${currentPoint.explanationRaw}
注意事项：${currentPoint.attention}
例句：${currentPoint.dialogues.map(d => `${d.sentence}`).join(' | ')}
      `);
    }
  }, [currentPoint, level, updatePageContext]);

  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const handleNext = () => {
    playSFX('switch');
    if (currentIndex < normalizedPoints.length - 1) setCurrentIndex(p => p + 1);
    else if (onComplete) onComplete();
  };

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translate3d(50px,0,0)' },
    enter: { opacity: 1, transform: 'translate3d(0,0,0)' },
    leave: { opacity: 0, transform: 'translate3d(-50px,0,0)', position: 'absolute' },
  });

  const handleVideoFullScreen = () => {
    const el = playerContainerRef.current;
    if (el) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  const handleAIExplain = (text) => {
    playSFX('click');
    askAI(`请详细解释一下这段语法内容，并用简单的中文和缅甸语说明：\n\n${text}`);
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

                {/* 核心句型 + 视频并排 */}
                <div style={styles.headerFlexRow}>
                  <div style={styles.patternCard}>
                    <div style={styles.cardLabel}><FaBookReader /> 核心句型</div>
                    <div onClick={() => play(gp.pattern, `pat_${gp.id}`)} style={styles.patternText}>
                      <PinyinText text={gp.pattern} color="#1e40af" bold />
                    </div>
                  </div>

                  {/* 竖屏视频播放器容器 */}
                  <div 
                    style={styles.videoSideContainer} 
                    ref={playerContainerRef} 
                    onClick={handleVideoFullScreen}
                    onContextMenu={e => e.preventDefault()}
                  >
                    <ReactPlayer 
                      url={gp.videoUrl} 
                      width="100%" 
                      height="100%" 
                      playing={isVideoPlaying}
                      light={true} 
                      loop={true}
                      config={{ file: { attributes: { controlsList: 'nodownload', disablePictureInPicture: true }}}} 
                    />
                    <div style={styles.videoOverlayLabel}>点击全屏观看</div>
                  </div>
                </div>

                {/* 语法详解区 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                  </div>
                  <div style={styles.richTextBlock}>
                    <RichTextRenderer 
                      content={gp.explanationRaw} 
                      onPlayText={play} 
                      activeTtsId={activeId}
                      onAIExplain={handleAIExplain}
                    />
                  </div>
                </div>

                {/* 注意事项 */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={{...styles.sectionHeader, color: '#ef4444'}}>
                      <span style={{display:'flex', alignItems:'center', gap:6}}><FaExclamationTriangle /> 注意事项</span>
                    </div>
                    <div style={styles.attentionBox}>
                       <RichTextRenderer 
                        content={gp.attention} 
                        onPlayText={play} 
                        activeTtsId={activeId}
                        onAIExplain={handleAIExplain}
                       />
                    </div>
                  </div>
                )}

                {/* 场景对话 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}><span style={styles.sectionTitle}>💬 场景对话</span></div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const isMale = ex.gender === 'male';
                      const voice = isMale ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyouNeural';
                      const exId = `ex_${gp.id}_${idx}`;
                      return (
                        <div key={idx} 
                             style={{ ...styles.dialogueRow, flexDirection: isMale ? 'row-reverse' : 'row' }} 
                             className="active-scale"
                        >
                          <img 
                            src={isMale ? "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/10111437211381.jpg" : "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/images.jpeg"}
                            style={styles.avatarImg} alt="avatar" 
                          />
                          <div style={{...styles.bubbleCol, alignItems: isMale ? 'flex-end' : 'flex-start'}}>
                             <div style={{ 
                               ...styles.bubble, 
                               background: isMale ? '#eff6ff' : '#fff1f2', 
                               border: isMale ? '1px solid #bfdbfe' : '1px solid #fbcfe8' 
                             }}>
                                <div style={isMale ? styles.tailRight : styles.tailLeft} />
                                <div onClick={() => play(ex.sentence, exId, voice)}>
                                  <PinyinText text={ex.sentence} bold={activeId === exId} />
                                </div>
                                <div style={styles.bubbleTrans}>{ex.translation}</div>
                                
                                <ActionToolbar 
                                  text={ex.sentence} 
                                  onPlay={(t) => play(t, exId, voice)} 
                                  isPlaying={activeId === exId}
                                  onAIExplain={handleAIExplain}
                                />
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div style={styles.nextButtonContainer}>
                   <button style={styles.nextBtn} onClick={handleNext}>
                     {i === normalizedPoints.length -1 ? '完成学习' : '下一页'} <FaChevronRight size={14} />
                   </button>
                </div>
                <div style={{ height: '50px' }} />
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
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', padding: '20px 16px 40px' },
  contentWrapper: { maxWidth: '600px', margin: '0 auto' },

  title: { fontSize: '1.4rem', fontWeight: '800', textAlign: 'center', color: '#000', marginBottom: '24px' },
  h3: { fontSize: '1.1rem', color: '#000', borderLeft: '4px solid #3b82f6', paddingLeft: '10px', marginTop: '20px', marginBottom: '10px' },
  
  headerFlexRow: { display: 'flex', gap: '12px', marginBottom: '30px', alignItems: 'stretch' },
  patternCard: { flex: 1, background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  videoSideContainer: { width: '100px', height: '150px', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  videoOverlayLabel: { position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '9px', textAlign: 'center', padding: '2px 0' },

  cardLabel: { fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' },
  patternText: { fontSize: '1.2rem', textAlign: 'center' },

  section: { marginBottom: '30px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '1rem', fontWeight: 'bold' },
  sectionTitle: { color: '#000' },

  textSegmentWrapper: { 
    padding: '12px 0', 
    borderBottom: '1px solid #f1f5f9', 
    display: 'flex', 
    flexDirection: 'column',
    gap: '4px'
  },
  
  actionToolbar: { 
    display: 'flex', 
    gap: '12px', 
    marginTop: '6px' 
  },
  actionBtn: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '4px', 
    background: '#f8fafc', 
    border: '1px solid #e2e8f0', 
    padding: '4px 8px', 
    borderRadius: '6px', 
    fontSize: '0.7rem', 
    color: '#64748b', 
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  richTextBlock: { fontSize: '1.05rem', color: '#000' },
  attentionBox: { border: '1px dashed #ef4444', borderRadius: '16px', padding: '16px' },

  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  dialogueRow: { display: 'flex', gap: '10px' },
  avatarImg: { width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee' },
  bubbleCol: { maxWidth: '85%' },
  bubble: { padding: '12px', position: 'relative', borderRadius: '16px', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' },
  tailLeft: { position: 'absolute', top: '12px', left: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailRight: { position: 'absolute', top: '12px', right: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  bubbleTrans: { fontSize: '0.85rem', color: '#64748b', marginTop: '6px', marginBottom: '8px', fontFamily: '"Padauk", sans-serif' },

  nextButtonContainer: { marginTop: '30px', display: 'flex', justifyContent: 'center' },
  nextBtn: { background: '#000', color: 'white', border: 'none', padding: '14px 40px', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
};

// 全局样式注入
if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; } 
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } 
    .active-scale:active { transform: scale(0.97); opacity: 0.9; }
    .action-btn:hover { background: #f1f5f9; color: #3b82f6; border-color: #3b82f6; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
