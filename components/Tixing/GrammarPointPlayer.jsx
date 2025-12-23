import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaPause, FaPlay, FaChevronRight, FaTachometerAlt, 
  FaUserAlt, FaUserTie, FaExclamationTriangle, FaBookReader
} from 'react-icons/fa';

// =================================================================================
// ===== 1. 健壮的 TTS Hook (生命周期管理 & 内存泄漏修复) =====
// =================================================================================

function useRobustTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    loadingId: null,
    activeId: null, // 当前激活的音频ID
    duration: 0,
    currentTime: 0,
    playbackRate: 0.85, // 默认语速 -15%
  });

  const audioRef = useRef(null);      // Audio 对象引用
  const audioUrlRef = useRef(null);   // Blob URL 引用 (用于清理内存)
  const requestRef = useRef(null);    // 动画帧引用
  const mountedRef = useRef(true);    // 组件挂载状态

  // 组件卸载时强制清理
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAudio();
    };
  }, []);

  // 深度清理函数
  const cleanupAudio = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    if (audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      // 移除核心监听器
      audio.removeAttribute('src'); // 断开连接
      audio.load();
    }
    
    // 释放 Blob 内存
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    audioRef.current = null;
  }, []);

  // 停止并重置状态
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

  // 进度更新循环
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

  // 切换 播放/暂停
  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      if (audio.paused) {
        // 如果已经结束了，重置时间
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

  // 调整进度
  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  // 调整语速
  const setRate = useCallback((rate) => {
    setPlayerState(prev => ({ ...prev, playbackRate: rate }));
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  // === 核心播放函数 ===
  const play = useCallback(async (text, uniqueId, voiceOverride = null) => {
    // 逻辑修复：如果是同一个ID
    if (playerState.activeId === uniqueId && audioRef.current) {
      // 检查是否已结束，如果结束了，视为“重播”，否则视为“暂停/继续”
      if (!audioRef.current.ended) {
        toggle();
        return;
      }
      // 如果 ended 为 true，代码继续往下执行，重新加载播放（或者直接重置 currentTime 播放也可以，这里选择重新加载确保状态一致）
    }

    // 1. 彻底清理上一个音频
    cleanupAudio();

    // 2. 设置加载状态
    setPlayerState(prev => ({ 
      ...prev, 
      loadingId: uniqueId, 
      activeId: uniqueId,
      isPlaying: false 
    }));

    // 3. 处理文本和发音人
    let cleanText = String(text).replace(/<[^>]+>/g, '').trim();
    if (!cleanText) {
      setPlayerState(prev => ({ ...prev, loadingId: null }));
      return;
    }

    // 默认女声: Xiaoyou, 男孩专用: Yunxia (根据要求)
    let targetVoice = 'zh-CN-XiaoyouNeural'; 
    if (voiceOverride) targetVoice = voiceOverride;
    else if (/[\u1000-\u109F]/.test(text)) targetVoice = 'my-MM-NilarNeural'; // 缅语自动识别

    try {
      // 4. 请求音频
      const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${targetVoice}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS API Error');
      
      const blob = await response.blob();
      if (!mountedRef.current) return; // 防止组件卸载后回调

      // 5. 创建 Audio 对象
      const blobUrl = URL.createObjectURL(blob);
      audioUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      // 6. 设置属性和监听
      audio.playbackRate = playerState.playbackRate;

      audio.onloadedmetadata = () => {
         if (!mountedRef.current) return;
         setPlayerState(prev => ({ ...prev, duration: audio.duration, currentTime: 0 }));
      };

      // 播放结束处理
      audio.onended = () => {
         if (!mountedRef.current) return;
         setPlayerState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentTime: 0 }));
         cancelAnimationFrame(requestRef.current);
      };

      // 播放错误处理
      audio.onerror = (e) => {
         console.error("Audio playback error", e);
         setPlayerState(prev => ({ ...prev, loadingId: null, isPlaying: false }));
      };

      // 7. 开始播放
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
// ===== 2. 文本渲染 (带拼音) =====
// =================================================================================

const renderTextWithPinyin = (text, colorStyle = 'inherit', isBold = false) => {
  if (!text) return null;
  // 去除一些特殊标记，只留文本
  const displayable = text.replace(/^[❌✅XV×√]\s*/i, '').replace(/\{\{|\}\}/g, '');
  // 分割汉字和非汉字
  const parts = displayable.match(/([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g) || [];

  return (
    <span style={{ 
      lineHeight: '2.4', 
      wordBreak: 'break-word', 
      color: colorStyle, 
      fontWeight: isBold ? '700' : '400',
      fontSize: '1.1rem' 
    }}>
      {parts.map((part, idx) => {
        if (/[\u4e00-\u9fff]/.test(part)) {
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

// =================================================================================
// ===== 3. 底部悬浮播放器 (仅用于长音频) =====
// =================================================================================
const BottomPlayer = ({ 
  isPlaying, isPaused, duration, currentTime, 
  onToggle, onSeek, onRateChange, playbackRate, label, visible 
}) => {
  
  if (!visible) return null;

  const cycleRate = () => {
    // 语速循环：0.85 -> 1.0 -> 0.6 -> 0.85
    if (playbackRate === 0.85) onRateChange(1.0);
    else if (playbackRate === 1.0) onRateChange(0.6);
    else onRateChange(0.85);
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
        <button onClick={onToggle} style={styles.mainPlayBtn}>
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
  // 数据格式化
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      explanation: item['语法详解'] || item.visibleExplanation || '',
      // 如果没有讲解脚本，使用纯文本的详解
      explanationScript: item['讲解脚本'] || (item['语法详解'] || '').replace(/<[^>]+>/g, ''),
      attention: item['注意事项'] || item.attention || '', 
      
      dialogues: (item['例句列表'] || item.examples || []).map((ex, i) => {
        // 判断性别
        const isBoy = ex.speaker === 'B' || ex.speaker === 'Boy' || i % 2 !== 0;
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

  // 判断底部播放器是否可见：只有在播放讲解 (activeId 包含 narration) 时显示
  const isNarrationActive = activeId && activeId.includes('narration');

  return (
    <div style={styles.container}>
      {/* 页面切换动画容器 */}
      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                {/* 标题 */}
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 1. 核心句型 (Core Pattern - အဓိက ဝါကျပုံစံ) */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>
                      <FaBookReader /> အဓိက ဝါကျပုံစံ
                    </div>
                    <div 
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                      style={{ 
                        cursor: 'pointer', ...styles.patternText,
                        color: activeId === `pattern_${gp.id}` ? '#3b82f6' : '#0f172a'
                      }}
                      className="active-scale"
                    >
                      {renderTextWithPinyin(gp.pattern)}
                    </div>
                  </div>
                )}

                {/* 2. 语法详解 (Grammar Explanation - သဒ္ဒါရှင်းလင်းချက်) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 သဒ္ဒါရှင်းလင်းချက်</span>
                    <button 
                       onClick={() => play(gp.explanationScript, narrationId)}
                       style={styles.playBtnCircle}
                       disabled={loadingId === narrationId}
                    >
                      {loadingId === narrationId ? <div className="spin" style={styles.miniSpin}/> : 
                        (activeId === narrationId && (isPlaying || isPaused) ? <FaPause size={10}/> : <FaPlay size={10} style={{marginLeft:2}}/>)}
                    </button>
                  </div>
                  {/* 富文本内容 */}
                  <div style={styles.richTextBlock} dangerouslySetInnerHTML={{__html: gp.explanation.replace(/\n/g, '<br/>')}} />
                </div>

                {/* 3. 易错点 (Common Mistakes - သတိပြုရန်အချက်များ) */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={{...styles.sectionTitle, color: '#b91c1c', display:'flex', alignItems:'center', gap:6}}>
                        <FaExclamationTriangle /> သတိပြုရန်အချက်များ
                      </span>
                    </div>
                    {/* 修复样式挤压和数字看不清的问题 */}
                    <div style={styles.attentionBox}>
                      <div style={styles.attentionText}>{gp.attention}</div>
                    </div>
                  </div>
                )}

                {/* 4. 场景对话 (Dialogues - ဥပမာ စကားပြော) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>💬 ဥပမာ စကားပြော</span>
                  </div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const exId = `ex_${gp.id}_${idx}`;
                      const isBoy = ex.gender === 'male';
                      
                      // 小男孩使用 Yunxia, 女孩使用 Xiaoyou
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
                          {/* 头像 */}
                          <div style={styles.avatarWrapper}>
                             <div style={{
                               ...styles.avatar, 
                               background: isBoy ? '#60a5fa' : '#f472b6'
                             }}>
                               {isBoy ? <FaUserTie size={16}/> : <FaUserAlt size={14}/>}
                             </div>
                          </div>
                          
                          {/* 气泡 */}
                          <div style={styles.bubbleCol}>
                             <div style={{
                               ...styles.speakerName,
                               alignSelf: isBoy ? 'flex-end' : 'flex-start'
                             }}>
                               {isBoy ? 'ကောင်လေး' : 'ကောင်မလေး'}
                             </div>
                             
                             <div style={{
                                ...styles.bubble,
                                background: isBoy ? '#eff6ff' : '#fff1f2',
                                border: isBoy ? '1px solid #bfdbfe' : '1px solid #fbcfe8',
                                // 选中时文字变色高亮
                                color: activeId === exId ? (isBoy ? '#1e40af' : '#be185d') : '#334155'
                             }}>
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
                
                {/* 底部按钮 (缅语) */}
                <div style={styles.nextButtonContainer}>
                   <button style={styles.nextBtn} onClick={handleNext}>
                     {i === normalizedPoints.length -1 ? 'လေ့ကျင့်ခန်းစမယ်' : 'ရှေ့ဆက်'} <FaChevronRight size={14} />
                   </button>
                </div>
                
                {/* 垫高底部，防止被悬浮播放器遮挡 (虽然播放器可能会隐藏) */}
                <div style={{ height: '120px' }} />
              </div>
            </div>
          </animated.div>
        );
      })}

      {/* 底部悬浮播放器 - 仅在讲解时显示 */}
      <BottomPlayer 
        visible={isNarrationActive}
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onToggle={toggle}
        onSeek={seek}
        onRateChange={setRate}
        label={loadingId ? 'လုပ်ဆောင်နေသည်...' : 'ရှင်းလင်းချက် နားထောင်နေသည်'}
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
    bottom: '80px', // 上调位置，避免太低
    left: 0, right: 0,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000, pointerEvents: 'none'
  },
  bottomPlayerCapsule: {
    pointerEvents: 'auto',
    width: '92%', maxWidth: '400px', height: '64px',
    background: 'rgba(255, 255, 255, 0.98)',
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
    color: '#991b1b', // 深红色字体，解决看不清的问题
    fontSize: '1rem',
    whiteSpace: 'pre-wrap' // 保持换行
  },

  ruby: { rubyPosition: 'over', margin: '0 1px' },
  rt: { fontSize: '0.6em', userSelect: 'none' },

  // === Dialogue Styles ===
  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '24px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' },
  avatarWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingTop: '10px' },
  avatar: { width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  
  bubbleCol: { display: 'flex', flexDirection: 'column', maxWidth: '85%' },
  speakerName: { fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' },
  bubble: { 
    padding: '14px 18px', 
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
    /* 强制覆盖可能的外部字体设置，解决数字颜色问题 */
    .attention-box * { color: #991b1b !important; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
