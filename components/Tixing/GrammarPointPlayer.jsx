import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaPause, FaPlay, FaChevronRight, FaTachometerAlt, 
  FaUserAlt, FaUserTie // 用不同的图标区分男女
} from 'react-icons/fa';

// =================================================================================
// ===== 1. TTS 核心逻辑 =====
// =================================================================================

const ttsCache = new Map();

// 获取音频，支持指定特定的 Voice ID (用于男女声对话)
const getTTSAudio = async (text, voiceId = 'zh-CN-XiaoyouNeural') => {
  const cacheKey = `${text}|${voiceId}`;

  if (ttsCache.has(cacheKey)) {
    const cachedAudio = ttsCache.get(cacheKey);
    cachedAudio.currentTime = 0;
    return cachedAudio;
  }

  try {
    // 这里的 URL 参数结构 ?t=xxx&v=xxx 非常适合 Cloudflare 缓存
    const url = `/api/tts?t=${encodeURIComponent(text)}&v=${voiceId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('TTS API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(cacheKey, audio);
    return audio;
  } catch (e) {
    console.error(`Failed to get TTS for "${text}"`, e);
    return null;
  }
};

function useSimpleTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    loadingId: null,
    playingId: null, // 当前正在播放的条目ID
    duration: 0,
    currentTime: 0,
    playbackRate: 0.7, // 默认语速 -30% ~ -35%
    currentText: null, // 记录当前文本，用于面板直接重新播放
    currentVoice: null // 记录当前声音
  });

  const audioObjRef = useRef(null);
  const requestRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, []);

  const stop = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      audioObjRef.current.currentTime = 0;
    }
    setPlayerState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      // playingId 不清空，以便UI显示当前选中的是哪个
      loadingId: null,
      currentTime: 0,
      duration: 0
    }));
  }, []);

  const updateProgress = useCallback(() => {
    if (audioObjRef.current && !audioObjRef.current.paused) {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audioObjRef.current.currentTime,
        duration: audioObjRef.current.duration || 0
      }));
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  // 切换播放/暂停（针对当前已加载的音频）
  const toggle = useCallback(() => {
    if (audioObjRef.current) {
      if (audioObjRef.current.paused) {
        audioObjRef.current.play().catch(console.error);
        setPlayerState(prev => ({ ...prev, isPaused: false, isPlaying: true }));
        requestRef.current = requestAnimationFrame(updateProgress);
      } else {
        audioObjRef.current.pause();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setPlayerState(prev => ({ ...prev, isPaused: true, isPlaying: false }));
      }
    } else if (playerState.currentText) {
      // 如果没有音频对象但有记录文本，尝试重新播放
      play(playerState.currentText, playerState.playingId, playerState.currentVoice);
    }
  }, [updateProgress, playerState.currentText, playerState.playingId]);

  const seek = useCallback((time) => {
    if (audioObjRef.current) {
      audioObjRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  const setRate = useCallback((rate) => {
    setPlayerState(prev => ({ ...prev, playbackRate: rate }));
    if (audioObjRef.current) {
      audioObjRef.current.playbackRate = rate;
    }
  }, []);

  // 核心播放函数
  const play = useCallback(async (text, uniqueId, voiceOverride = null) => {
    // 如果点击的是当前正在播放/暂停的同一条，执行 Toggle
    if (playerState.playingId === uniqueId && audioObjRef.current) {
      toggle();
      return;
    }

    stop(); // 停止之前的
    
    // 确定发音人 (缅语不做区分，中文区分男女)
    let targetVoice = 'zh-CN-XiaoyouNeural'; // 默认女声
    if (voiceOverride) targetVoice = voiceOverride;
    else if (/[\u1000-\u109F]/.test(text)) targetVoice = 'my-MM-NilarNeural'; // 缅语

    setPlayerState(prev => ({ 
      ...prev, 
      loadingId: uniqueId, 
      playingId: uniqueId, 
      currentText: text,
      currentVoice: targetVoice 
    }));

    let cleanText = String(text).replace(/<[^>]+>/g, '').trim();
    if (!cleanText) {
      setPlayerState(prev => ({ ...prev, loadingId: null }));
      return;
    }

    try {
      const audio = await getTTSAudio(cleanText, targetVoice);
      
      if (!mountedRef.current || !audio) {
        setPlayerState(prev => ({ ...prev, loadingId: null }));
        return;
      }

      audioObjRef.current = audio;
      audio.playbackRate = playerState.playbackRate;
      
      const onLoadedMeta = () => {
         setPlayerState(prev => ({ ...prev, duration: audio.duration, currentTime: 0 }));
      };
      const onEnded = () => {
         setPlayerState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentTime: 0 }));
      };

      audio.addEventListener('loadedmetadata', onLoadedMeta);
      audio.addEventListener('ended', onEnded, { once: true });

      await audio.play();
      
      setPlayerState(prev => ({ 
        ...prev, isPlaying: true, isPaused: false, loadingId: null 
      }));
      requestRef.current = requestAnimationFrame(updateProgress);

    } catch (e) {
      console.error(e);
      setPlayerState(prev => ({ ...prev, loadingId: null }));
    }
  }, [playerState.playingId, playerState.playbackRate, stop, toggle, updateProgress]);

  return { ...playerState, play, stop, toggle, seek, setRate };
}

// =================================================================================
// ===== 2. 文本渲染与样式 =====
// =================================================================================

const renderTextWithPinyin = (text, colorStyle = 'inherit', isBold = false) => {
  if (!text) return null;
  const displayable = text.replace(/^[❌✅XV×√]\s*/i, '').replace(/\{\{|\}\}/g, '');
  const parts = displayable.match(/([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g) || [];

  return (
    <span style={{ 
      lineHeight: '2.4', // 增加行高适应拼音
      wordBreak: 'break-word', 
      color: colorStyle, 
      fontWeight: isBold ? '700' : '400',
      fontSize: '1.05rem' 
    }}>
      {parts.map((part, idx) => {
        if (/[\u4e00-\u9fff]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          const charArray = part.split('');
          return charArray.map((char, cIdx) => (
            <ruby key={`${idx}-${cIdx}`} style={styles.ruby}>
              {char}
              <rt style={{...styles.rt, color: '#94a3b8'}}>
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

// =================================================================================
// ===== 3. 底部悬浮播放器 (Compact Bottom Player) =====
// =================================================================================
const BottomPlayer = ({ 
  isPlaying, isPaused, duration, currentTime, 
  onToggle, onSeek, onRateChange, playbackRate, label 
}) => {
  
  const cycleRate = () => {
    // 语速循环：0.7 -> 1.0 -> 0.5 -> 0.7
    if (playbackRate === 0.7) onRateChange(1.0);
    else if (playbackRate === 1.0) onRateChange(0.5);
    else onRateChange(0.7);
  };

  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <div style={styles.bottomPlayerWrapper}>
      <div style={styles.bottomPlayerCapsule}>
        
        {/* 播放/暂停按钮 (主控) */}
        <button onClick={onToggle} style={styles.mainPlayBtn}>
           {(isPlaying || isPaused) && !isPaused ? <FaPause size={14} /> : <FaPlay size={14} style={{marginLeft:2}} />}
        </button>

        {/* 进度信息 */}
        <div style={styles.bpInfo}>
           <div style={styles.bpLabel}>{label}</div>
           <div style={styles.bpTimeRow}>
             <span style={styles.bpTime}>{formatTime(currentTime)}</span>
             {/* 进度条 */}
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

        {/* 语速按钮 */}
        <button onClick={cycleRate} style={styles.bpSpeedBtn}>
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
  // 数据标准化
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      explanation: item['语法详解'] || item.visibleExplanation || '',
      // 注意：这里我们提取讲解脚本，如果没有则用详解文字
      explanationScript: item['讲解脚本'] || (item['语法详解'] || '').replace(/<[^>]+>/g, ''),
      attention: item['注意事项'] || item.attention || '', 
      
      // 对话/例句处理
      dialogues: (item['例句列表'] || item.examples || []).map((ex, i) => {
        // 根据索引或 speaker 字段决定男女
        // 偶数(0, 2...) = Girl/A, 奇数(1, 3...) = Boy/B
        const isBoy = ex.speaker === 'B' || ex.speaker === 'Boy' || i % 2 !== 0;
        return {
          id: ex.id || i,
          speakerName: isBoy ? 'Boy' : 'Girl',
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
  
  const { 
    play, stop, toggle, seek, setRate,
    isPlaying, isPaused, loadingId, playingId, currentTime, duration, playbackRate 
  } = useSimpleTTS();

  // 页面切换时停止播放并回滚顶部
  useEffect(() => {
    stop(); 
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const handleNext = () => {
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

  if (!normalizedPoints.length) return <div style={styles.center}>暂无数据</div>;

  return (
    <div style={styles.container}>
      {/* 全屏过渡容器 */}
      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 1. 核心句型 (支持点击) */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>核心句型 (点击朗读)</div>
                    <div 
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                      style={{ 
                        cursor: 'pointer', ...styles.patternText,
                        color: playingId === `pattern_${gp.id}` ? '#3b82f6' : '#0f172a'
                      }}
                      className="active-scale"
                    >
                      {renderTextWithPinyin(gp.pattern)}
                    </div>
                  </div>
                )}

                {/* 2. 语法详解 (长音频) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                    <button 
                       onClick={() => play(gp.explanationScript, narrationId)}
                       style={styles.playBtnCircle}
                       disabled={loadingId === narrationId}
                    >
                      {loadingId === narrationId ? <div className="spin" style={styles.miniSpin}/> : 
                        (playingId === narrationId && (isPlaying || isPaused) ? <FaPause size={10}/> : <FaPlay size={10} style={{marginLeft:2}}/>)}
                    </button>
                  </div>
                  {/* 使用 dangerouslySetInnerHTML 处理简单 HTML */}
                  <div style={styles.richTextBlock} dangerouslySetInnerHTML={{__html: gp.explanation.replace(/\n/g, '<br/>')}} />
                </div>

                {/* 3. 易错点 */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={{...styles.sectionTitle, color: '#ef4444'}}>⚠️ 易错点 / 注意事项</span>
                    </div>
                    <div style={styles.attentionBox}>
                      <div style={{lineHeight: 1.6, color: '#b91c1c'}}>{gp.attention}</div>
                    </div>
                  </div>
                )}

                {/* 4. 场景对话 (男女声 + 气泡尾巴) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>💬 场景对话</span>
                  </div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const exId = `ex_${gp.id}_${idx}`;
                      const isBoy = ex.gender === 'male';
                      
                      // 语音选择: Boy -> Yunxi, Girl -> Xiaoyou
                      const voiceId = isBoy ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoyouNeural';

                      return (
                        <div key={idx} 
                             onClick={() => play(ex.script, exId, voiceId)}
                             style={{ 
                               ...styles.dialogueRow, 
                               flexDirection: isBoy ? 'row-reverse' : 'row', // 男右女左
                             }}
                             className="active-scale"
                        >
                          {/* 头像与名字 */}
                          <div style={styles.avatarWrapper}>
                             <div style={{
                               ...styles.avatar, 
                               background: isBoy ? '#3b82f6' : '#ec4899'
                             }}>
                               {isBoy ? <FaUserTie size={18}/> : <FaUserAlt size={16}/>}
                             </div>
                          </div>
                          
                          {/* 气泡区域 */}
                          <div style={styles.bubbleCol}>
                             <div style={{
                               ...styles.speakerName,
                               alignSelf: isBoy ? 'flex-end' : 'flex-start'
                             }}>
                               {isBoy ? 'Boy' : 'Girl'}
                             </div>
                             
                             <div style={{
                                ...styles.bubble,
                                background: isBoy ? '#eff6ff' : '#fff1f2', // 蓝/粉 背景
                                border: isBoy ? '1px solid #bfdbfe' : '1px solid #fbcfe8',
                                color: playingId === exId ? (isBoy ? '#1e40af' : '#be185d') : '#334155'
                             }}>
                                {/* 气泡小尾巴 */}
                                <div style={isBoy ? styles.tailRight : styles.tailLeft} />
                                
                                <div style={styles.bubbleText}>
                                  {renderTextWithPinyin(ex.sentence)}
                                </div>
                                <div style={styles.bubbleTrans}>{ex.translation}</div>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 底部继续按钮 (防遮挡) */}
                <div style={styles.nextButtonContainer}>
                   <button style={styles.nextBtn} onClick={handleNext}>
                     {i === normalizedPoints.length -1 ? '进入练习' : '继续'} <FaChevronRight size={14} />
                   </button>
                </div>
                
                {/* 底部占位符，防止被播放器挡住 */}
                <div style={{ height: '100px' }} />
              </div>
            </div>
          </animated.div>
        );
      })}

      {/* 底部悬浮播放器 */}
      <BottomPlayer 
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onToggle={toggle}
        onSeek={seek}
        onRateChange={setRate}
        label={
             loadingId ? '加载中...' :
             playingId ? (playingId.includes('narration') ? '讲解中...' : '朗读中') : '准备播放'
        }
      />
    </div>
  );
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

// =================================================================================
// ===== 5. 样式定义 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px' },
  contentWrapper: { maxWidth: '600px', margin: '0 auto', paddingTop: '20px' }, 
  
  // === Bottom Player Style ===
  bottomPlayerWrapper: {
    position: 'absolute', bottom: '20px', left: 0, right: 0,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000, pointerEvents: 'none' // wrapper 不挡点击，内部 capsule 挡
  },
  bottomPlayerCapsule: {
    pointerEvents: 'auto',
    width: '90%', maxWidth: '380px', height: '64px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: '32px',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px'
  },
  mainPlayBtn: {
    width: 40, height: 40, borderRadius: '50%', background: '#3b82f6', color: 'white',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    flexShrink: 0, boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
  },
  bpInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' },
  bpLabel: { fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bpTimeRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  bpTime: { fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace', width: '28px' },
  bpProgressBg: { flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px', position: 'relative' },
  bpProgressFill: { height: '100%', background: '#3b82f6', borderRadius: '2px' },
  hiddenRangeInput: { position: 'absolute', top: -6, left: 0, width: '100%', height: '16px', opacity: 0, cursor: 'pointer', margin: 0 },
  bpSpeedBtn: {
    background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', 
    cursor: 'pointer', gap: '1px', fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold'
  },

  // === Content Styles ===
  title: { fontSize: '1.6rem', fontWeight: '800', textAlign: 'center', color: '#1e293b', marginBottom: '20px', marginTop: '10px' },
  
  card: { background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' },
  cardLabel: { fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' },
  patternText: { fontSize: '1.3rem', fontWeight: '600', color: '#0f172a', lineHeight: 1.5 },

  section: { marginBottom: '32px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#334155' },
  playBtnCircle: { width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  miniSpin: { width: 10, height: 10, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' },

  richTextBlock: { fontSize: '1rem', lineHeight: '1.7', color: '#475569' },
  attentionBox: { background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3', padding: '12px' },

  ruby: { rubyPosition: 'over', margin: '0 1px' },
  rt: { fontSize: '0.6em', userSelect: 'none' },

  // === Dialogue Styles ===
  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' },
  avatarWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingTop: '18px' },
  avatar: { width: 32, height: 32, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  
  bubbleCol: { display: 'flex', flexDirection: 'column', maxWidth: '80%' },
  speakerName: { fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' },
  bubble: { 
    padding: '12px 16px', 
    position: 'relative', 
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    transition: 'background 0.2s'
  },
  // CSS Triangle Tails
  tailLeft: {
    position: 'absolute', top: '10px', left: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderRight: '6px solid #fff1f2', // 需匹配 bubble 背景色
  },
  tailRight: {
    position: 'absolute', top: '10px', right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #eff6ff', // 需匹配 bubble 背景色
  },

  bubbleText: { fontSize: '1.05rem', marginBottom: '4px' },
  bubbleTrans: { fontSize: '0.85rem', opacity: 0.8 },

  nextButtonContainer: { marginTop: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'center', width: '100%' },
  nextBtn: {
    background: '#1e293b', color: 'white',
    border: 'none', padding: '14px 40px',
    borderRadius: '50px', fontSize: '1rem', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: 'pointer', boxShadow: '0 8px 20px rgba(30, 41, 59, 0.2)',
    transition: 'transform 0.1s'
  },
};

// 全局样式注入 (动画、Ruby对齐)
if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    ruby { ruby-align: center; }
    .active-scale:active { transform: scale(0.98); opacity: 0.9; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
