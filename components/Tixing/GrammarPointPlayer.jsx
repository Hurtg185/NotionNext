import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaPause, FaPlay, FaChevronRight, FaTachometerAlt, 
  FaUserAlt, FaUserTie, FaExclamationTriangle, FaBookReader, FaVolumeUp
} from 'react-icons/fa';

// =================================================================================
// ===== 0. 音效工具 (新增) =====
// =================================================================================
const playSFX = (type) => {
  const audio = new Audio(
    type === 'switch' ? '/sounds/switch-card.mp3' : '/sounds/click.mp3'
  );
  audio.volume = 0.6;
  audio.play().catch(() => {});
};

// =================================================================================
// ===== 1. 健壮的 TTS Hook (优化语速与生命周期) =====
// =================================================================================

function useRobustTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    loadingId: null,
    activeId: null, 
    duration: 0,
    currentTime: 0,
    playbackRate: 0.9, // 修改：默认语速 -10% (0.9)
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
      ...prev,
      isPlaying: false,
      isPaused: false,
      activeId: null,
      loadingId: null,
      currentTime: 0,
      duration: 0
    }));
  }, [cleanupAudio]);

  const updateProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audioRef.current.currentTime,
        duration: audioRef.current.duration || 0
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
    // 播放点击音效
    playSFX('click');

    if (playerState.activeId === uniqueId && audioRef.current) {
      if (!audioRef.current.ended) {
        toggle();
        return;
      }
    }

    cleanupAudio();

    setPlayerState(prev => ({ 
      ...prev, 
      loadingId: uniqueId, 
      activeId: uniqueId,
      isPlaying: false 
    }));

    // 清理 Markdown 符号和 HTML 标签，只留纯文本给 TTS
    let cleanText = String(text)
      .replace(/\*\*|###/g, '') // 去除 Markdown 符号
      .replace(/<[^>]+>/g, '')  // 去除 HTML 标签
      .trim();

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

      audio.onerror = (e) => {
         console.error("Audio playback error", e);
         setPlayerState(prev => ({ ...prev, loadingId: null, isPlaying: false }));
      };

      await audio.play();
      
      setPlayerState(prev => ({ 
        ...prev, 
        isPlaying: true, 
        isPaused: false, 
        loadingId: null 
      }));
      
      requestRef.current = requestAnimationFrame(updateProgress);

    } catch (e) {
      console.error("TTS Play failed:", e);
      setPlayerState(prev => ({ ...prev, loadingId: null, activeId: null }));
    }
  }, [playerState.activeId, playerState.playbackRate, cleanupAudio, updateProgress, toggle]);

  return { ...playerState, play, stop, toggle, seek, setRate };
}

// =================================================================================
// ===== 2. 文本渲染组件 (含拼音 + 可点击) =====
// =================================================================================

// 纯文本带拼音渲染组件
const PinyinText = ({ text, onClick, color = 'inherit', bold = false }) => {
  if (!text) return null;
  // 过滤掉 markdown 符号显示
  const displayable = text.replace(/\*\*|###/g, '').replace(/\{\{|\}\}/g, '');
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = displayable.split(regex);

  return (
    <span 
      onClick={(e) => {
        if(onClick) {
            e.stopPropagation();
            onClick(text);
        }
      }}
      style={{ 
        lineHeight: '2.2', 
        wordBreak: 'break-word', 
        color: color, 
        fontWeight: bold ? '700' : '400',
        fontSize: '1.1rem',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {parts.map((part, idx) => {
        if (/[\u4e00-\u9fa5]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          const charArray = part.split('');
          return charArray.map((char, cIdx) => (
            <ruby key={`${idx}-${cIdx}`} style={styles.ruby}>
              {char}
              <rt style={{...styles.rt, color: '#64748b'}}>
                {pyArray[cIdx] || ''}
              </rt>
            </ruby>
          ));
        } else {
          return <span key={idx}>{part}</span>;
        }
      })}
    </span>
  );
};

// 专门用于解析 "语法详解" Markdown 的组件
const RichTextRenderer = ({ content, onPlayText }) => {
    if (!content) return null;
    const lines = content.split('\n');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // 标题 ###
                if (trimmed.startsWith('###')) {
                    const title = trimmed.replace(/###\s?/, '');
                    return (
                        <h3 key={idx} style={{ 
                            fontSize: '1.1rem', fontWeight: 'bold', color: '#4338ca', 
                            marginTop: '10px', marginBottom: '4px', borderLeft: '4px solid #818cf8', paddingLeft: '8px' 
                        }}>
                            {title}
                        </h3>
                    );
                }

                // 分割粗体 **...**
                const parts = trimmed.split(/(\*\*.*?\*\*)/g);
                return (
                    <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.8' }}>
                        {parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                const clean = part.slice(2, -2);
                                return (
                                    <span key={pIdx} style={{ background: '#fff7ed', padding: '0 4px', borderRadius: '4px', borderBottom: '1px solid #fed7aa' }}>
                                        <PinyinText text={clean} onClick={onPlayText} color="#9a3412" bold />
                                    </span>
                                );
                            } else if (part.trim()) {
                                return <PinyinText key={pIdx} text={part} onClick={onPlayText} color="#334155" />;
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
// ===== 3. 底部悬浮播放器 (修改为常驻) =====
// =================================================================================
const BottomPlayer = ({ 
  isPlaying, isPaused, duration, currentTime, 
  onToggle, onSeek, onRateChange, playbackRate, label 
}) => {
  
  const cycleRate = () => {
    // 语速循环: 0.9 -> 1.0 -> 0.7 -> 0.9
    if (playbackRate === 0.9) onRateChange(1.0);
    else if (playbackRate === 1.0) onRateChange(0.7);
    else onRateChange(0.9);
  };

  const formatTime = (t) => {
    if (!t && t !== 0) return '0:00';
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <div style={styles.bottomPlayerWrapper}>
      <div style={styles.bottomPlayerCapsule}>
        
        {/* 播放/暂停 */}
        <button onClick={(e) => { playSFX('click'); onToggle(); }} style={styles.mainPlayBtn}>
           {(isPlaying || isPaused) && !isPaused ? <FaPause size={14} /> : <FaPlay size={14} style={{marginLeft:2}} />}
        </button>

        {/* 进度 */}
        <div style={styles.bpInfo}>
           <div style={styles.bpLabel}>{label}</div>
           <div style={styles.bpTimeRow}>
             <span style={styles.bpTime}>{formatTime(currentTime)}</span>
             <div style={styles.bpProgressBg}>
                <div style={{...styles.bpProgressFill, width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`}} />
                <input 
                  type="range" min="0" max={duration || 100} value={currentTime} 
                  onChange={(e) => onSeek(Number(e.target.value))}
                  style={styles.hiddenRangeInput}
                />
             </div>
             <span style={styles.bpTime}>{formatTime(duration)}</span>
           </div>
        </div>

        {/* 语速 */}
        <button onClick={(e) => { playSFX('click'); cycleRate(); }} style={styles.bpSpeedBtn}>
          <FaTachometerAlt size={12} />
          <span>{playbackRate}x</span>
        </button>

      </div>
    </div>
  );
};

// =================================================================================
// ===== 4. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete }) => {
  // 数据格式化
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      // 优先使用 '讲解脚本' 用于全文朗读，若无则使用 '语法详解' 纯文本
      explanationScript: item['讲解脚本'] || (item['语法详解'] || '').replace(/\*\*|###/g, ''),
      // '语法详解' 用于富文本渲染
      explanationRaw: item['语法详解'] || item.visibleExplanation || '',
      attention: item['注意事项'] || item.attention || '', 
      
      dialogues: (item['例句列表'] || item.examples || []).map((ex, i) => {
        // 判断性别：B/Boy/奇数为男，G/Girl/偶数为女
        const isBoy = ex.speaker === 'B' || ex.speaker === 'Boy' || (ex.speaker && ex.speaker.includes('男'));
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
  
  // 引入 TTS Hook
  const { 
    play, stop, toggle, seek, setRate,
    isPlaying, isPaused, loadingId, activeId, currentTime, duration, playbackRate 
  } = useRobustTTS();

  // 翻页时停止播放
  useEffect(() => {
    stop(); 
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const handleNext = () => {
    playSFX('switch');
    if (currentIndex < normalizedPoints.length - 1) {
      setCurrentIndex(p => p + 1);
    } else {
      if (onComplete) onComplete();
    }
  };

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translate3d(100%,0,0)' },
    enter: { opacity: 1, transform: 'translate3d(0%,0,0)' },
    leave: { opacity: 0, transform: 'translate3d(-100%,0,0)', position: 'absolute' },
  });

  if (!normalizedPoints.length) return <div style={styles.center}>Data Loading...</div>;

  const currentPoint = normalizedPoints[currentIndex];
  // 当前页面的讲解ID
  const narrationId = `narration_${currentPoint.id}`;
  // 底部播放器是否正在控制“讲解” (activeId 匹配)
  const isControllingNarration = activeId === narrationId;
  
  // 底部播放器始终显示，如果未播放讲解，点击播放按钮触发 play(narrationId)
  const handleBottomPlayClick = () => {
      if (isControllingNarration) {
          toggle();
      } else {
          // 如果当前在播别的（如例句），先切回讲解
          play(currentPoint.explanationScript, narrationId);
      }
  };

  return (
    <div style={styles.container}>
      {/* 页面切换动画容器 */}
      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                {/* 标题 */}
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 1. 核心句型 (Core Pattern) */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>
                      <FaBookReader /> 核心句型
                    </div>
                    <div 
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                      style={{ 
                        cursor: 'pointer', ...styles.patternText,
                        color: activeId === `pattern_${gp.id}` ? '#3b82f6' : '#0f172a'
                      }}
                      className="active-scale"
                    >
                      <PinyinText text={gp.pattern} />
                    </div>
                  </div>
                )}

                {/* 2. 语法详解 (Markdown + Pinyin + TTS) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                    {/* 小播放按钮，功能同底部大按钮 */}
                    <button 
                       onClick={() => play(gp.explanationScript, narrationId)}
                       style={styles.playBtnCircle}
                    >
                      {loadingId === narrationId ? <div className="spin" style={styles.miniSpin}/> : 
                        (activeId === narrationId && (isPlaying || isPaused) ? <FaPause size={10}/> : <FaPlay size={10} style={{marginLeft:2}}/>)}
                    </button>
                  </div>
                  
                  {/* 使用 RichTextRenderer 替代 dangerouslySetInnerHTML */}
                  <div style={styles.richTextBlock}>
                      <RichTextRenderer 
                          content={gp.explanationRaw} 
                          onPlayText={(text) => play(text, `text_${Date.now()}`)} // 点击单句播放
                      />
                  </div>
                </div>

                {/* 3. 易错点 (Attention) */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={{...styles.sectionTitle, color: '#b91c1c', display:'flex', alignItems:'center', gap:6}}>
                        <FaExclamationTriangle /> 注意事项
                      </span>
                    </div>
                    <div style={styles.attentionBox}>
                      <div style={styles.attentionText}>
                          {/* 简单渲染注意事项，也加上拼音点读 */}
                          <PinyinText text={gp.attention} onClick={(t) => play(t, `attn_${gp.id}`)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. 场景对话 (Dialogues) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>💬 场景对话</span>
                  </div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const exId = `ex_${gp.id}_${idx}`;
                      const isBoy = ex.gender === 'male';
                      
                      // 女声 Xiaoyou, 男声 Yunxia
                      const voiceId = isBoy ? 'zh-CN-YunxiaNeural' : 'zh-CN-XiaoyouNeural';

                      return (
                        <div key={idx} 
                             onClick={() => play(ex.script, exId, voiceId)}
                             style={{ 
                               ...styles.dialogueRow, 
                               flexDirection: isBoy ? 'row-reverse' : 'row',
                             }}
                             className="active-scale"
                        >
                          {/* 头像 - 使用指定URL */}
                          <div style={styles.avatarWrapper}>
                             <img 
                                src={isBoy 
                                  ? "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/10111437211381.jpg" 
                                  : "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/images.jpeg"}
                                alt={isBoy ? "Boy" : "Girl"}
                                style={styles.avatarImg}
                             />
                          </div>
                          
                          {/* 气泡 */}
                          <div style={styles.bubbleCol}>
                             {/* 名字移出气泡，放在上方 */}
                             <div style={{
                               ...styles.speakerName,
                               alignSelf: isBoy ? 'flex-end' : 'flex-start'
                             }}>
                               {isBoy ? '男孩' : '女孩'}
                             </div>
                             
                             <div style={{
                                ...styles.bubble,
                                background: isBoy ? '#eff6ff' : '#fff1f2',
                                border: isBoy ? '1px solid #bfdbfe' : '1px solid #fbcfe8',
                                color: activeId === exId ? (isBoy ? '#1e40af' : '#be185d') : '#334155'
                             }}>
                                <div style={isBoy ? styles.tailRight : styles.tailLeft} />
                                {/* 对话内容带拼音 */}
                                <div style={styles.bubbleText}>
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
                
                {/* 底部按钮 */}
                <div style={styles.nextButtonContainer}>
                   <button style={styles.nextBtn} onClick={handleNext}>
                     {i === normalizedPoints.length -1 ? '完成学习' : '下一页'} <FaChevronRight size={14} />
                   </button>
                </div>
                
                {/* 垫高底部 */}
                <div style={{ height: '140px' }} />
              </div>
            </div>
          </animated.div>
        );
      })}

      {/* 底部悬浮播放器 - 常驻 */}
      <BottomPlayer 
        // 始终显示播放器
        label={
             loadingId === narrationId ? '加载中...' : 
             (isControllingNarration ? '正在播放讲解' : '点击播放全文讲解')
        }
        // 如果正在控制讲解，则传写真实状态；否则显示为暂停状态
        isPlaying={isControllingNarration && isPlaying}
        isPaused={isControllingNarration && isPaused}
        currentTime={isControllingNarration ? currentTime : 0}
        duration={isControllingNarration ? duration : 0}
        
        playbackRate={playbackRate}
        onToggle={handleBottomPlayClick}
        onSeek={seek}
        onRateChange={setRate}
      />
    </div>
  );
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

// =================================================================================
// ===== 5. 样式定义 (CSS-in-JS) =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: '"Padauk", "Myanmar3", sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px' },
  contentWrapper: { maxWidth: '600px', margin: '0 auto', paddingTop: '20px' }, 
  
  // === Bottom Player Style ===
  bottomPlayerWrapper: {
    position: 'absolute', 
    bottom: '40px', 
    left: 0, right: 0,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000, pointerEvents: 'none'
  },
  bottomPlayerCapsule: {
    pointerEvents: 'auto',
    width: '92%', maxWidth: '400px', height: '64px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: '32px',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px'
  },
  mainPlayBtn: {
    width: 42, height: 42, borderRadius: '50%', background: '#3b82f6', color: 'white',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    flexShrink: 0, boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
  },
  bpInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' },
  bpLabel: { fontSize: '0.8rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bpTimeRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  bpTime: { fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace', width: '28px' },
  bpProgressBg: { flex: 1, height: '5px', background: '#e2e8f0', borderRadius: '3px', position: 'relative' },
  bpProgressFill: { height: '100%', background: '#3b82f6', borderRadius: '3px' },
  hiddenRangeInput: { position: 'absolute', top: -6, left: 0, width: '100%', height: '16px', opacity: 0, cursor: 'pointer', margin: 0 },
  bpSpeedBtn: {
    background: '#f1f5f9', border: 'none', borderRadius: '12px',
    padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', 
    cursor: 'pointer', gap: '1px', fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold'
  },

  // === Content Styles ===
  title: { fontSize: '1.5rem', fontWeight: '800', textAlign: 'center', color: '#1e293b', marginBottom: '24px', marginTop: '10px' },
  
  card: { background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
  cardLabel: { fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', marginBottom: '12px', display:'flex', gap: '6px', alignItems:'center' },
  patternText: { fontSize: '1.3rem', fontWeight: '600', color: '#0f172a', lineHeight: 1.6, textAlign: 'center' },

  section: { marginBottom: '36px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: '700', color: '#334155' },
  playBtnCircle: { width: 30, height: 30, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  miniSpin: { width: 14, height: 14, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' },

  richTextBlock: { fontSize: '1.05rem', lineHeight: '1.8', color: '#475569' },
  
  // 易错点样式优化
  attentionBox: { 
    background: '#fef2f2', 
    borderRadius: '16px', 
    border: '1px solid #fee2e2', 
    padding: '20px',
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.05)'
  },
  attentionText: { 
    lineHeight: 1.8, 
    color: '#991b1b', 
    fontSize: '1rem',
    whiteSpace: 'pre-wrap'
  },

  ruby: { rubyPosition: 'over', margin: '0 1px' },
  rt: { fontSize: '0.6em', userSelect: 'none' },

  // === Dialogue Styles ===
  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '24px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' },
  avatarWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingTop: '4px' },
  avatarImg: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  
  bubbleCol: { display: 'flex', flexDirection: 'column', maxWidth: '80%' },
  speakerName: { fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600', padding: '0 4px' },
  bubble: { 
    padding: '12px 16px', 
    position: 'relative', 
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    transition: 'background 0.2s',
    minWidth: '60px'
  },
  
  tailLeft: {
    position: 'absolute', top: '14px', left: '-8px',
    width: 0, height: 0,
    borderTop: '8px solid transparent',
    borderBottom: '8px solid transparent',
    borderRight: '8px solid #fff1f2', 
  },
  tailRight: {
    position: 'absolute', top: '14px', right: '-8px',
    width: 0, height: 0,
    borderTop: '8px solid transparent',
    borderBottom: '8px solid transparent',
    borderLeft: '8px solid #eff6ff', 
  },

  bubbleText: { fontSize: '1.1rem', marginBottom: '6px' },
  bubbleTrans: { fontSize: '0.9rem', opacity: 0.85, fontFamily: '"Padauk", sans-serif' },

  nextButtonContainer: { marginTop: '30px', marginBottom: '20px', display: 'flex', justifyContent: 'center', width: '100%' },
  nextBtn: {
    background: '#1e293b', color: 'white',
    border: 'none', padding: '16px 48px',
    borderRadius: '50px', fontSize: '1.1rem', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', boxShadow: '0 10px 25px rgba(30, 41, 59, 0.25)',
    transition: 'transform 0.1s',
    fontFamily: '"Padauk", sans-serif'
  },
};

// 全局样式注入
if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    ruby { ruby-align: center; }
    .active-scale:active { transform: scale(0.98); opacity: 0.9; }
    .attention-box * { color: #991b1b !important; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
