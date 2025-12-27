import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import ReactPlayer from 'react-player';
import {
  FaPause, FaPlay, FaChevronRight, FaTachometerAlt,
  FaExclamationTriangle, FaBookReader, FaVolumeUp
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
  audio.volume = 0.6;
  audio.play().catch(() => {});
};

// =================================================================================
// ===== 1. TTS Hook =====
// =================================================================================
function useRobustTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false, isPaused: false, loadingId: null, activeId: null,
    duration: 0, currentTime: 0, playbackRate: 0.9,
  });

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const requestRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
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
    setPlayerState(prev => ({
      ...prev, isPlaying: false, isPaused: false, activeId: null,
      loadingId: null, currentTime: 0, duration: 0
    }));
  }, [cleanupAudio]);

  const updateProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      setPlayerState(prev => ({
        ...prev, currentTime: audioRef.current.currentTime, duration: audioRef.current.duration || 0
      }));
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      if (audio.paused) {
        if (audio.ended) audio.currentTime = 0;
        audio.play().catch(err => console.warn("Play interrupted", err));
        setPlayerState(prev => ({ ...prev, isPaused: false, isPlaying: true }));
        requestRef.current = requestAnimationFrame(updateProgress);
      } else {
        audio.pause();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setPlayerState(prev => ({ ...prev, isPaused: true, isPlaying: false }));
      }
    }
  }, [updateProgress]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  const setRate = useCallback((rate) => {
    setPlayerState(prev => ({ ...prev, playbackRate: rate }));
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const play = useCallback(async (text, uniqueId, voiceOverride = null) => {
    playSFX('click');
    if (playerState.activeId === uniqueId && audioRef.current && !audioRef.current.ended) {
      toggle();
      return;
    }
    cleanupAudio();
    setPlayerState(prev => ({ ...prev, loadingId: uniqueId, activeId: uniqueId, isPlaying: false }));

    let cleanText = String(text).replace(/\*\*|~~|\{\{|\}\}|###/g, '').replace(/<[^>]+>/g, '').trim();
    if (!cleanText) {
      setPlayerState(prev => ({ ...prev, loadingId: null }));
      return;
    }

    let targetVoice = 'zh-CN-XiaoyouNeural'; 
    if (voiceOverride) targetVoice = voiceOverride;
    else if (/[\u1000-\u109F]/.test(text)) targetVoice = 'my-MM-NilarNeural'; 

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
      audio.playbackRate = playerState.playbackRate;

      audio.onloadedmetadata = () => {
         if (!mountedRef.current) return;
         setPlayerState(prev => ({ ...prev, duration: audio.duration, currentTime: 0 }));
      };
      audio.onended = () => {
         if (!mountedRef.current) return;
         setPlayerState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentTime: 0 }));
         cancelAnimationFrame(requestRef.current);
      };
      await audio.play();
      setPlayerState(prev => ({ ...prev, isPlaying: true, isPaused: false, loadingId: null }));
      requestRef.current = requestAnimationFrame(updateProgress);
    } catch (e) {
      console.error("TTS Play failed:", e);
      setPlayerState(prev => ({ ...prev, loadingId: null, activeId: null }));
    }
  }, [playerState.activeId, playerState.playbackRate, cleanupAudio, updateProgress, toggle]);

  return { ...playerState, play, stop, toggle, seek, setRate };
}

// =================================================================================
// ===== 2. 文本渲染组件 (严格配色方案) =====
// =================================================================================

const PinyinText = ({ text, onClick, color = '#000000', bold = false, strikethrough = false }) => {
  if (!text) return null;
  const displayable = text.replace(/\*\*|~~|\{\{|\}\}|###/g, '');
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = displayable.split(regex);

  return (
    <span
      onClick={(e) => {
        if(onClick) { e.stopPropagation(); onClick(text); }
      }}
      style={{
        lineHeight: '2.2', wordBreak: 'break-word', color: color,
        fontWeight: bold ? '700' : '400', fontSize: '1.1rem', cursor: onClick ? 'pointer' : 'default',
        textDecoration: strikethrough ? 'line-through' : 'none',
        textDecorationColor: strikethrough ? '#ff0000' : 'transparent',
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
          return <span key={idx}>{part}</span>;
        }
      })}
    </span>
  );
};

const RichTextRenderer = ({ content, onPlayText }) => {
  if (!content) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {content.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('###')) {
          return (
            <h3 key={idx} style={{
              fontSize: '1.1rem', fontWeight: 'bold', color: '#000000',
              marginTop: '10px', marginBottom: '4px', borderLeft: '4px solid #0000ff', paddingLeft: '8px'
            }}>{trimmed.replace(/###\s?/, '')}</h3>
          );
        }
        
        // 解析：**蓝色**, ~~红色删除线~~, {{黄色}}
        const parts = trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g);
        
        return (
          <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.8' }}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                    <PinyinText text={part.slice(2, -2)} onClick={onPlayText} color="#0000ff" bold={true} />
                  </span>
                );
              } else if (part.startsWith('~~') && part.endsWith('~~')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={onPlayText} color="#ff0000" strikethrough={true} />;
              } else if (part.startsWith('{{') && part.endsWith('}}')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={onPlayText} color="#eab308" bold={true} />;
              } else if (part.trim()) {
                return <PinyinText key={pIdx} text={part} onClick={onPlayText} color="#000000" />;
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 3. 顶部固定播放器 =====
// =================================================================================
const TopPlayer = ({
  isPlaying, isPaused, duration, currentTime,
  onToggle, onSeek, onRateChange, playbackRate, label, visible
}) => {
  if (!visible) return null;
  const cycleRate = () => {
    if (playbackRate === 0.9) onRateChange(1.0);
    else if (playbackRate === 1.0) onRateChange(0.7);
    else onRateChange(0.9);
  };
  const formatTime = (t) => {
    if (!t) return '0:00';
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };
  return (
    <div style={styles.topPlayerWrapper}>
      <div style={styles.topPlayerCapsule}>
        <button onClick={() => { playSFX('click'); onToggle(); }} style={styles.mainPlayBtn}>
          {(isPlaying || isPaused) && !isPaused ? <FaPause size={14} /> : <FaPlay size={14} style={{marginLeft:2}} />}
        </button>
        <div style={styles.bpInfo}>
          <div style={styles.bpLabel}>{label}</div>
          <div style={styles.bpTimeRow}>
            <span style={styles.bpTime}>{formatTime(currentTime)}</span>
            <div style={styles.bpProgressBg}>
              <div style={{...styles.bpProgressFill, width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`}} />
              <input type="range" min="0" max={duration || 100} value={currentTime} onChange={(e) => onSeek(Number(e.target.value))} style={styles.hiddenRangeInput} />
            </div>
            <span style={styles.bpTime}>{formatTime(duration)}</span>
          </div>
        </div>
        <button onClick={() => { playSFX('click'); cycleRate(); }} style={styles.bpSpeedBtn}>
          <FaTachometerAlt size={12} /><span>{playbackRate}x</span>
        </button>
      </div>
    </div>
  );
};

// =================================================================================
// ===== 4. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete }) => {
  const { updatePageContext } = useAI();
  const playerWrapperRef = useRef(null);

  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      // 视频链接防盗处理及默认值
      videoUrl: item['视频链接'] || 'https://audio.886.best/chinese-vocab-audio/35339558-uhd_1440_2560_25fps.mp4',
      explanationScript: item['讲解脚本'] || (item['语法详解'] || '').replace(/\*\*|~~|\{\{|\}\}|###/g, ''),
      explanationRaw: item['语法详解'] || item.visibleExplanation || '',
      attention: item['注意事项'] || item.attention || '',
      dialogues: (item['例句列表'] || item.examples || []).map((ex, i) => {
        // 修正性别识别：判断 A/B 或 男/女 标签
        const s = (ex.speaker || '').toUpperCase();
        const isBoy = s === 'B' || s.includes('男') || s.includes('BOY') || s.includes('MALE');
        return {
          id: ex.id || i, gender: isBoy ? 'male' : 'female',
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

  useEffect(() => {
    if (currentPoint) {
      const ctx = `标题：${currentPoint.title}\n句型：${currentPoint.pattern}\n详解：${currentPoint.explanationRaw}\n注意事项：${currentPoint.attention}`;
      updatePageContext(ctx);
    }
  }, [currentPoint, updatePageContext]);

  const {
    play, stop, toggle, seek, setRate,
    isPlaying, isPaused, loadingId, activeId, currentTime, duration, playbackRate
  } = useRobustTTS();

  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const handleNext = () => {
    playSFX('switch');
    if (currentIndex < normalizedPoints.length - 1) setCurrentIndex(p => p + 1);
    else if (onComplete) onComplete();
  };

  const handleVideoClick = () => {
    const wrapper = playerWrapperRef.current;
    if (wrapper) {
      const videoEl = wrapper.querySelector('video');
      if (videoEl) {
        if (videoEl.requestFullscreen) videoEl.requestFullscreen();
        else if (videoEl.webkitRequestFullscreen) videoEl.webkitRequestFullscreen();
      }
    }
  };

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translate3d(100%,0,0)' },
    enter: { opacity: 1, transform: 'translate3d(0%,0,0)' },
    leave: { opacity: 0, transform: 'translate3d(-100%,0,0)', position: 'absolute' },
  });

  if (!normalizedPoints.length) return <div style={styles.center}>Data Loading...</div>;

  const narrationId = `narration_${currentPoint.id}`;
  const isControllingNarration = activeId === narrationId;

  return (
    <div style={styles.container}>
      <TopPlayer 
        label={loadingId === narrationId ? '加载中...' : (isControllingNarration ? '正在讲解' : '播放全文讲解')}
        isPlaying={isControllingNarration && isPlaying}
        isPaused={isControllingNarration && isPaused}
        currentTime={isControllingNarration ? currentTime : 0}
        duration={isControllingNarration ? duration : 0}
        playbackRate={playbackRate}
        onToggle={() => isControllingNarration ? toggle() : play(currentPoint.explanationScript, narrationId)}
        onSeek={seek}
        onRateChange={setRate}
        visible={true} 
      />

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
                    <div 
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                      style={{ cursor: 'pointer', ...styles.patternText, color: activeId === `pattern_${gp.id}` ? '#3b82f6' : '#000' }}
                    >
                      <PinyinText text={gp.pattern} />
                    </div>
                  </div>

                  {/* 竖屏视频防盗播放器 */}
                  <div style={styles.videoSideContainer} ref={playerWrapperRef} onClick={handleVideoClick} onContextMenu={(e)=>e.preventDefault()}>
                    <ReactPlayer
                      url={gp.videoUrl}
                      width="100%"
                      height="100%"
                      playing={false}
                      controls={false}
                      light={true} // 显示封面图模式
                      config={{
                        file: {
                          attributes: {
                            controlsList: 'nodownload', // 禁止下载
                            disablePictureInPicture: true,
                          }
                        }
                      }}
                    />
                    <div style={styles.videoOverlayLabel}>点击全屏播放</div>
                  </div>
                </div>

                {/* 语法详解 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                    <button onClick={() => play(gp.explanationScript, narrationId)} style={styles.playBtnCircle}>
                      {loadingId === narrationId ? <div className="spin" style={styles.miniSpin}/> : 
                        (activeId === narrationId && (isPlaying || isPaused) ? <FaPause size={10}/> : <FaPlay size={10} style={{marginLeft:2}}/>)}
                    </button>
                  </div>
                  <div style={styles.richTextBlock}>
                      <RichTextRenderer content={gp.explanationRaw} onPlayText={(t) => play(t, `txt_${Date.now()}`)} />
                  </div>
                </div>

                {/* 注意事项 */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={{...styles.sectionTitle, color: '#ff0000', display:'flex', alignItems:'center', gap:6}}>
                        <FaExclamationTriangle /> 注意事项
                      </span>
                    </div>
                    <div style={styles.attentionBox}>
                       <RichTextRenderer content={gp.attention} onPlayText={(t) => play(t, `attn_${Date.now()}`)} />
                    </div>
                  </div>
                )}

                {/* 场景对话 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}><span style={styles.sectionTitle}>💬 场景对话</span></div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const exId = `ex_${gp.id}_${idx}`;
                      const isBoy = ex.gender === 'male';
                      return (
                        <div key={idx} onClick={() => play(ex.script, exId, isBoy ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyouNeural')}
                             style={{ ...styles.dialogueRow, flexDirection: isBoy ? 'row-reverse' : 'row' }} className="active-scale"
                        >
                          <div style={styles.avatarWrapper}>
                             <img src={isBoy ? "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/10111437211381.jpg" : "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/images.jpeg"}
                                  alt="avatar" style={styles.avatarImg} />
                          </div>
                          <div style={{...styles.bubbleCol, alignItems: isBoy ? 'flex-end' : 'flex-start'}}>
                             <div style={{ ...styles.bubble, background: isBoy ? '#eff6ff' : '#fff1f2', border: isBoy ? '1px solid #bfdbfe' : '1px solid #fbcfe8' }}>
                                <div style={isBoy ? styles.tailRight : styles.tailLeft} />
                                <div style={{...styles.bubbleText, color: activeId === exId ? (isBoy ? '#1e40af' : '#be185d') : '#000'}}>
                                  <PinyinText text={ex.sentence} />
                                </div>
                                <div style={styles.bubbleTrans}>{ex.translation}</div>
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
                <div style={{ height: '40px' }} />
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
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', padding: '0 16px', paddingTop: '70px' },
  contentWrapper: { maxWidth: '650px', margin: '0 auto', paddingTop: '20px' },

  topPlayerWrapper: { position: 'absolute', top: '15px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 1000, pointerEvents: 'none' },
  topPlayerCapsule: { pointerEvents: 'auto', width: '94%', maxWidth: '500px', height: '56px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '28px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '12px' },
  mainPlayBtn: { width: 38, height: 38, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  bpInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' },
  bpLabel: { fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' },
  bpTimeRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  bpTime: { fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' },
  bpProgressBg: { flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px', position: 'relative' },
  bpProgressFill: { height: '100%', background: '#3b82f6', borderRadius: '2px' },
  hiddenRangeInput: { position: 'absolute', top: -6, left: 0, width: '100%', height: '16px', opacity: 0, cursor: 'pointer' },
  bpSpeedBtn: { background: '#f1f5f9', border: 'none', borderRadius: '12px', padding: '4px 8px', fontSize: '0.6rem', color: '#64748b' },

  title: { fontSize: '1.5rem', fontWeight: '800', textAlign: 'center', color: '#000', marginBottom: '24px' },
  
  headerFlexRow: { display: 'flex', gap: '12px', marginBottom: '30px', alignItems: 'stretch' },
  patternCard: { flex: 1, background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  videoSideContainer: { width: '100px', height: '150px', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  videoOverlayLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', textAlign: 'center', padding: '2px 0' },

  cardLabel: { fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', marginBottom: '8px', display:'flex', gap: '4px' },
  patternText: { fontSize: '1.2rem', fontWeight: '600', lineHeight: 1.5, textAlign: 'center' },

  section: { marginBottom: '30px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#000' },
  playBtnCircle: { width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', color: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  miniSpin: { width: 12, height: 12, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' },

  richTextBlock: { fontSize: '1.05rem', lineHeight: '1.8', color: '#000' },
  attentionBox: { border: '1px dashed #ff0000', borderRadius: '12px', padding: '16px' },

  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' },
  avatarWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  avatarImg: { width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' },
  bubbleCol: { display: 'flex', flexDirection: 'column', maxWidth: '82%' },
  bubble: { padding: '10px 12px', position: 'relative', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  tailLeft: { position: 'absolute', top: '12px', left: '-5px', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailRight: { position: 'absolute', top: '12px', right: '-5px', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  bubbleText: { fontSize: '1.05rem', marginBottom: '2px' },
  bubbleTrans: { fontSize: '0.85rem', color: '#666' },

  nextButtonContainer: { marginTop: '30px', display: 'flex', justifyContent: 'center' },
  nextBtn: { background: '#000', color: 'white', border: 'none', padding: '14px 40px', borderRadius: '30px', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
};

if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; } 
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } 
    .active-scale:active { transform: scale(0.97); opacity: 0.9; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
