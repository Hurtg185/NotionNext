import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaPause, FaPlay, FaChevronRight, FaTachometerAlt, FaUserCircle
} from 'react-icons/fa';

// =================================================================================
// ===== 1. TTS 核心逻辑 (保持不变) =====
// =================================================================================

const ttsCache = new Map();

const getTTSAudio = async (text, lang = 'zh') => {
  const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural';
  const cacheKey = `${text}|${voice}`;

  if (ttsCache.has(cacheKey)) {
    const cachedAudio = ttsCache.get(cacheKey);
    cachedAudio.currentTime = 0;
    return cachedAudio;
  }

  try {
    const url = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}`;
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
    playingId: null,
    duration: 0,
    currentTime: 0,
    playbackRate: 1.0, 
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
      audioObjRef.current = null;
    }
    ttsCache.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    setPlayerState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      playingId: null,
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

  const toggle = useCallback(() => {
    if (audioObjRef.current) {
      if (audioObjRef.current.paused) {
        audioObjRef.current.play().catch(console.error);
        setPlayerState(prev => ({ ...prev, isPaused: false }));
        requestRef.current = requestAnimationFrame(updateProgress);
      } else {
        audioObjRef.current.pause();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setPlayerState(prev => ({ ...prev, isPaused: true }));
      }
    }
  }, [updateProgress]);

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

  const play = useCallback(async (text, uniqueId) => {
    if (playerState.playingId === uniqueId) {
      toggle();
      return;
    }

    stop();
    setPlayerState(prev => ({ ...prev, loadingId: uniqueId }));

    let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
    // 移除行首的特殊符号，避免朗读出来
    cleanText = cleanText.replace(/^[❌✅XV×√]\s*/i, ''); 

    if (!cleanText) {
      setPlayerState(prev => ({ ...prev, loadingId: null }));
      return;
    }

    const segments = [];
    const hasBurmese = /[\u1000-\u109F]/.test(cleanText);

    if (!hasBurmese) {
      segments.push({ text: cleanText, lang: 'zh' });
    } else {
      const regex = /([\u1000-\u109F]+)|([^\u1000-\u109F]+)/g;
      let match;
      while ((match = regex.exec(cleanText)) !== null) {
        if (match[0].trim()) {
          segments.push({ text: match[0].trim(), lang: /[\u1000-\u109F]/.test(match[0]) ? 'my' : 'zh' });
        }
      }
    }

    try {
      const audioPromises = segments.map(seg => getTTSAudio(seg.text, seg.lang));
      const validAudios = (await Promise.all(audioPromises)).filter(a => a !== null);

      if (validAudios.length === 0) {
        setPlayerState(prev => ({ ...prev, loadingId: null }));
        return;
      }

      const playQueue = (index) => {
        if (!mountedRef.current) return;
        if (index >= validAudios.length) {
          stop();
          return;
        }

        const audio = validAudios[index];
        audioObjRef.current = audio;
        audio.playbackRate = playerState.playbackRate;
        
        const onLoadedMeta = () => {
           if(index === 0) setPlayerState(prev => ({ ...prev, duration: audio.duration, currentTime: 0 }));
        };
        const onEnded = () => playQueue(index + 1);
        const onError = () => playQueue(index + 1);

        audio.addEventListener('loadedmetadata', onLoadedMeta);
        audio.addEventListener('ended', onEnded, { once: true });
        audio.addEventListener('error', onError, { once: true });

        audio.play()
          .then(() => {
            setPlayerState(prev => ({ 
              ...prev, isPlaying: true, isPaused: false, playingId: uniqueId, loadingId: null 
            }));
            requestRef.current = requestAnimationFrame(updateProgress);
          })
          .catch(err => {
            console.error("Play error", err);
            playQueue(index + 1);
          });
      };

      playQueue(0);
    } catch (e) {
      console.error(e);
      setPlayerState(prev => ({ ...prev, loadingId: null }));
    }
  }, [playerState.playingId, playerState.playbackRate, stop, toggle, updateProgress]);

  return { ...playerState, play, stop, toggle, seek, setRate };
}

// =================================================================================
// ===== 3. 富文本与拼音解析 =====
// =================================================================================

// 拼音渲染器
const renderTextWithPinyin = (text, colorStyle = 'inherit', isBold = false) => {
  if (!text) return null;
  // 移除标记符号进行显示
  const displayable = text.replace(/^[❌✅XV×√]\s*/i, '').replace(/\{\{|\}\}/g, '');
  const parts = displayable.match(/([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g) || [];

  return (
    <span style={{ 
      lineHeight: '2.2', 
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
              <rt style={{...styles.rt, color: colorStyle === '#ef4444' ? '#fca5a5' : '#94a3b8'}}>
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

// 简单的 Markdown 转 HTML 解析器 (处理标题、表格、粗体)
const processRichText = (text) => {
  if (!text) return '';
  let html = text;
  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3 style="margin: 16px 0 8px; font-size: 1.1rem; color: #1e293b;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="margin: 20px 0 10px; font-size: 1.25rem; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 10px;">$1</h2>');
  // 加粗
  html = html.replace(/\*\*(.*?)\*\*/g, '<b style="color: #0f172a;">$1</b>');
  // 列表
  html = html.replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; list-style-type: disc;">$1</li>');
  // 换行
  html = html.replace(/\n/g, '<br/>');
  return html;
};

// 交互式文本块 (支持点击朗读，且紧凑排版)
const InteractiveTextBlock = ({ text, playFn, baseId }) => {
  if (!text) return null;
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {lines.map((line, idx) => {
        const uniqueId = `${baseId}_line_${idx}`;
        const trimmed = line.trim();
        
        // 正误判断
        const isWrong = /^[❌X×]/.test(trimmed);
        const isCorrect = /^[✅V√]/.test(trimmed);
        
        let color = '#334155'; 
        if (isWrong) color = '#ef4444'; // 红字
        if (isCorrect) color = '#0f172a'; // 黑字

        return (
          <div 
            key={idx}
            onClick={() => playFn(line, uniqueId)}
            style={{ 
              cursor: 'pointer', 
              padding: '2px 4px',
              borderRadius: '4px',
              transition: 'background 0.2s',
            }}
            className="hover-bg"
          >
             {renderTextWithPinyin(trimmed, color, isCorrect)}
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 4. 音乐播放器风格悬浮组件 (MusicPlayerHeader) =====
// =================================================================================
const MusicPlayerHeader = ({ 
  isPlaying, isPaused, duration, currentTime, 
  onToggle, onSeek, onRateChange, playbackRate, label 
}) => {
  
  const cycleRate = () => {
    if (playbackRate >= 1.0) onRateChange(0.6);
    else if (playbackRate <= 0.6) onRateChange(0.8);
    else onRateChange(1.0);
  };

  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <div style={styles.musicPlayerContainer}>
      <div style={styles.musicPlayerInner}>
        
        {/* 左侧头像 */}
        <div style={styles.avatarBox}>
          <FaUserCircle size={36} color="#cbd5e1" />
        </div>

        {/* 中间控制区 */}
        <div style={styles.controlsCenter}>
          {/* 进度条 (在上方) */}
          <div style={styles.progressBarWrapper}>
             <div 
               style={{ 
                 ...styles.progressBarFill, 
                 width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` 
               }} 
             />
             <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={(e) => onSeek(Number(e.target.value))}
                style={styles.hiddenRangeInput}
              />
          </div>

          {/* 播放按钮与信息 (在下方) */}
          <div style={styles.playInfoRow}>
             <button onClick={onToggle} style={styles.playBtnSmall}>
               {isPlaying && !isPaused ? <FaPause size={12} /> : <FaPlay size={12} style={{marginLeft: 2}} />}
             </button>
             <div style={styles.trackInfo}>
               <span style={styles.trackTitle}>{label}</span>
               <span style={styles.trackTime}>{formatTime(currentTime)} / {formatTime(duration)}</span>
             </div>
          </div>
        </div>

        {/* 右侧语速 */}
        <button onClick={cycleRate} style={styles.speedBtn}>
          <FaTachometerAlt size={14} color="#64748b" />
          <span style={{fontSize: 10, fontWeight: 700, color: '#64748b'}}>{playbackRate}x</span>
        </button>

      </div>
    </div>
  );
};

// =================================================================================
// ===== 5. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete }) => {
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      explanation: item['语法详解'] || item.visibleExplanation || '',
      attention: item['注意事项'] || item['易错点'] || item.attention || '', 
      explanationScript: item['讲解脚本'] || item.narrationScript || (item['语法详解'] || '').replace(/<[^>]+>/g, ''),
      dialogues: (item['例句列表'] || item.examples || []).map((ex, i) => ({
        id: ex.id || i,
        speaker: i % 2 === 0 ? 'A' : 'B', 
        sentence: ex['句子'] || ex.sentence || '',
        translation: ex['翻译'] || ex.translation || '',
        script: ex['例句发音'] || ex.narrationScript || ex['句子'] || ''
      }))
    }));
  }, [grammarPoints]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);
  
  const { 
    play, stop, toggle, seek, setRate,
    isPlaying, isPaused, loadingId, playingId, currentTime, duration, playbackRate 
  } = useSimpleTTS();

  useEffect(() => {
    stop(); 
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const handleNext = () => {
    if (currentIndex < normalizedPoints.length - 1) {
      setCurrentIndex(p => p + 1);
    } else {
      // 触发外部回调，进入下一环节（如练习题），不显示完成页
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
      {/* 悬浮音乐播放器 */}
      <MusicPlayerHeader 
        isPlaying={isPlaying || isPaused}
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

      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 1. 核心句型 */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>核心句型</div>
                    <div 
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                      style={{ cursor: 'pointer', ...styles.patternText }}
                      className="hover-bg"
                    >
                      {renderTextWithPinyin(gp.pattern)}
                    </div>
                  </div>
                )}

                {/* 2. 语法详解 (使用富文本解析) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                    {/* 这个按钮用来触发长音频讲解 */}
                    <button 
                       onClick={() => play(gp.explanationScript, narrationId)}
                       style={styles.playBtnCircle}
                       disabled={loadingId === narrationId}
                    >
                      {loadingId === narrationId ? <div className="spin" style={styles.miniSpin}/> : (playingId === narrationId && !isPaused ? <FaPause size={12}/> : <FaPlay size={12} style={{marginLeft:2}}/>)}
                    </button>
                  </div>
                  
                  <div style={styles.richTextBlock} dangerouslySetInnerHTML={{__html: processRichText(gp.explanation)}} />
                </div>

                {/* 3. 易错点 (红字/黑字交互) */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={{...styles.sectionTitle, color: '#ef4444'}}>⚠️ 易错点 / 注意事项</span>
                    </div>
                    <div style={styles.attentionBox}>
                      <InteractiveTextBlock 
                        text={gp.attention} 
                        playFn={play} 
                        baseId={`att_${gp.id}`} 
                      />
                    </div>
                  </div>
                )}

                {/* 4. 场景对话 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>💬 场景对话</span>
                  </div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const exId = `ex_${gp.id}_${idx}`;
                      const isLeft = ex.speaker === 'A';
                      return (
                        <div key={idx} 
                             onClick={() => play(ex.script, exId)}
                             style={{ 
                               ...styles.dialogueRow, 
                               flexDirection: isLeft ? 'row' : 'row-reverse',
                               cursor: 'pointer'
                             }}
                        >
                          <div style={{...styles.avatar, background: isLeft ? '#3b82f6' : '#ec4899'}}>
                            {ex.speaker}
                          </div>
                          
                          <div style={{
                             ...styles.bubble,
                             background: isLeft ? '#eff6ff' : '#fff1f2',
                             border: isLeft ? '1px solid #dbeafe' : '1px solid #fce7f3',
                             borderRadius: isLeft ? '16px 16px 16px 4px' : '16px 16px 4px 16px'
                          }} className="hover-bg">
                             <div style={styles.bubbleText}>
                               {renderTextWithPinyin(ex.sentence)}
                             </div>
                             <div style={styles.bubbleTrans}>{ex.translation}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 底部按钮 */}
                <div style={styles.nextButtonContainer}>
                   <button style={styles.nextBtn} onClick={handleNext}>
                     {i === normalizedPoints.length -1 ? '进入练习' : '下一个'} <FaChevronRight size={14} />
                   </button>
                </div>
                
                <div style={{ height: '60px' }} />
              </div>
            </div>
          </animated.div>
        );
      })}
    </div>
  );
};

GrammarPointPlayer.propTypes = {
  grammarPoints: PropTypes.array.isRequired,
  onComplete: PropTypes.func,
};

// =================================================================================
// ===== 6. 样式定义 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px' },
  contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: '100px' }, 
  
  // === Music Player Style ===
  musicPlayerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '84px',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)'
  },
  musicPlayerInner: {
    width: '100%', maxWidth: '800px', padding: '0 20px',
    display: 'flex', alignItems: 'center', gap: '16px'
  },
  avatarBox: {
    width: 48, height: 48, borderRadius: '12px', background: '#f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  controlsCenter: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  progressBarWrapper: { position: 'relative', height: '4px', width: '100%', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' },
  progressBarFill: { height: '100%', background: '#3b82f6', borderRadius: '2px' },
  hiddenRangeInput: { position: 'absolute', top: -5, left: 0, width: '100%', height: '14px', opacity: 0, cursor: 'pointer', margin: 0 },
  
  playInfoRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  playBtnSmall: {
    width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', color: 'white',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)'
  },
  trackInfo: { display: 'flex', flexDirection: 'column' },
  trackTitle: { fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' },
  trackTime: { fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' },
  
  speedBtn: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
    padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', 
    cursor: 'pointer', gap: '2px'
  },

  // === Content Styles ===
  title: { fontSize: '1.8rem', fontWeight: '800', textAlign: 'center', color: '#1e293b', marginBottom: '24px', marginTop: '10px', letterSpacing: '-0.02em' },
  
  card: { background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '32px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' },
  cardLabel: { fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' },
  patternText: { fontSize: '1.4rem', fontWeight: '600', color: '#0f172a', lineHeight: 1.5 },

  section: { marginBottom: '40px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: '700', color: '#334155' },
  playBtnCircle: { width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  miniSpin: { width: 12, height: 12, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' },

  richTextBlock: { fontSize: '1.05rem', lineHeight: '1.8', color: '#475569' },
  attentionBox: { background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },

  ruby: { rubyPosition: 'over', margin: '0 1px' },
  rt: { fontSize: '0.6em', userSelect: 'none' },

  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '24px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-end', gap: '12px' },
  avatar: { width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0, marginBottom: '6px' },
  bubble: { padding: '14px 18px', maxWidth: '85%', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
  bubbleText: { fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' },
  bubbleTrans: { fontSize: '0.9rem', color: '#94a3b8' },

  nextButtonContainer: { marginTop: '40px', marginBottom: '20px', display: 'flex', justifyContent: 'center', width: '100%' },
  nextBtn: {
    background: '#1e293b', color: 'white',
    border: 'none', padding: '16px 48px',
    borderRadius: '50px', fontSize: '1rem', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: 'pointer', boxShadow: '0 10px 25px rgba(30, 41, 59, 0.25)',
    transition: 'transform 0.1s'
  },
};

if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    ruby { ruby-align: center; }
    .hover-bg:active { background-color: rgba(0,0,0,0.04) !important; transform: scale(0.995); }
    /* Table styles for rich text */
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.95rem; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
