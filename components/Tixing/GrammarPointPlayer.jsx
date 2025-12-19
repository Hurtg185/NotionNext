import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaVolumeUp, FaSpinner, FaChevronRight, 
  FaPause, FaPlay, FaCheckCircle, FaRedo, FaTachometerAlt
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// =================================================================================
// ===== 1. TTS 核心逻辑 (内存缓存 + API) =====
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

// =================================================================================
// ===== 2. TTS Hook (默认语速 1.0) =====
// =================================================================================
function useSimpleTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    loadingId: null,
    playingId: null,
    duration: 0,
    currentTime: 0,
    playbackRate: 1.0, // 修改：默认语速正常
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
// ===== 3. 辅助组件：拼音与文本解析 =====
// =================================================================================

// 渲染带拼音的文本 (支持颜色)
const renderTextWithPinyin = (text, colorStyle = 'inherit') => {
  if (!text) return null;
  // 移除标记符号进行显示
  const displayable = text.replace(/^[❌✅XV×√]\s*/i, '').replace(/\{\{|\}\}/g, '');
  const parts = displayable.match(/([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g) || [];

  return (
    <span style={{ lineHeight: '2.4', wordBreak: 'break-word', color: colorStyle, fontSize: '1.05rem' }}>
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

// 交互式文本块组件：处理换行、点击朗读、红字/黑字判断
const InteractiveTextBlock = ({ text, playFn, baseId }) => {
  if (!text) return null;

  const lines = text.split('\n').filter(l => l.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {lines.map((line, idx) => {
        const uniqueId = `${baseId}_line_${idx}`;
        const trimmed = line.trim();
        
        // 判断类型
        const isWrong = /^[❌X×]/.test(trimmed);
        const isCorrect = /^[✅V√]/.test(trimmed);
        
        // 样式决定
        let color = '#334155'; // 默认深灰
        if (isWrong) color = '#ef4444'; // 红字
        if (isCorrect) color = '#0f172a'; // 黑字 (强调)

        return (
          <div 
            key={idx}
            onClick={() => playFn(line, uniqueId)}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'flex-start',
              padding: '4px 8px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            className="hover-bg"
          >
             <div style={{ flex: 1 }}>
               {renderTextWithPinyin(trimmed, color)}
             </div>
             <div style={{ marginLeft: 8, marginTop: 6, opacity: 0.4 }}>
                <FaVolumeUp size={14} color={color} />
             </div>
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 4. 顶部固定播放器 (TopFixedPlayer) =====
// =================================================================================
const TopFixedPlayer = ({ 
  isPlaying, isPaused, duration, currentTime, 
  onToggle, onSeek, onRateChange, playbackRate, label 
}) => {
  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  // 循环切换语速
  const cycleRate = () => {
    if (playbackRate >= 1.0) onRateChange(0.6);
    else if (playbackRate <= 0.6) onRateChange(0.8);
    else onRateChange(1.0);
  };

  return (
    <div style={styles.topPlayerContainer}>
      <div style={styles.topPlayerContent}>
        
        {/* 左侧：播放控制 + 文本信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, overflow: 'hidden' }}>
          <button onClick={onToggle} style={styles.playBtnLarge}>
            {isPlaying && !isPaused ? <FaPause size={16} /> : <FaPlay size={16} style={{ marginLeft: 2 }} />}
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
             <div style={styles.playerLabel}>{label || '准备播放'}</div>
             <div style={styles.timeLabel}>{formatTime(currentTime)} / {formatTime(duration)}</div>
          </div>
        </div>

        {/* 右侧：语速 */}
        <button onClick={cycleRate} style={styles.speedBtn}>
          <FaTachometerAlt size={12} />
          <span>{playbackRate.toFixed(1)}x</span>
        </button>
      </div>

      {/* 底部进度条 (吸附在容器底部) */}
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
    </div>
  );
};

// =================================================================================
// ===== 5. 完成页面 =====
// =================================================================================
const CompletionScreen = ({ onRestart }) => (
  <div style={styles.completionContainer}>
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={styles.completionCard}
    >
      <div style={styles.checkIconWrapper}>
        <FaCheckCircle size={50} color="white" />
      </div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b', marginBottom: 12 }}>学习完成</h2>
      <p style={{ color: '#64748b', marginBottom: 30, fontSize: '0.95rem' }}>太棒了！你已经掌握了本节内容。</p>
      
      <button onClick={onRestart} style={styles.restartBtn}>
        <FaRedo style={{ marginRight: 8 }} /> 重新学习
      </button>
    </motion.div>
  </div>
);

// =================================================================================
// ===== 6. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints }) => {
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      explanation: item['语法详解'] || item.visibleExplanation || '',
      attention: item['注意事项'] || item['易错点'] || item.attention || '', // 这里的内容会特殊渲染
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
  const [isCompleted, setIsCompleted] = useState(false);
  const contentRef = useRef(null);
  
  const { 
    play, stop, toggle, seek, setRate,
    isPlaying, isPaused, loadingId, playingId, currentTime, duration, playbackRate 
  } = useSimpleTTS();

  useEffect(() => {
    stop(); 
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, isCompleted, stop]);

  const handleNext = () => {
    if (currentIndex < normalizedPoints.length - 1) {
      setCurrentIndex(p => p + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setCurrentIndex(0);
  };

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translate3d(100%,0,0)' },
    enter: { opacity: 1, transform: 'translate3d(0%,0,0)' },
    leave: { opacity: 0, transform: 'translate3d(-100%,0,0)', position: 'absolute' },
  });

  if (!normalizedPoints.length) return <div style={styles.center}>暂无数据</div>;
  if (isCompleted) return <CompletionScreen onRestart={handleRestart} />;

  return (
    <div style={styles.container}>
      {/* 顶部固定播放器 - 一直显示 */}
      <TopFixedPlayer 
        isPlaying={isPlaying || isPaused} // 只要有状态就显示，或者根据需求一直显示
        isPaused={isPaused}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onToggle={toggle}
        onSeek={seek}
        onRateChange={setRate}
        label={
             loadingId ? '加载中...' :
             playingId ? (playingId.includes('narration') ? '语法讲解' : '例句朗读') : '点击文字开始朗读'
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

                {/* 1. 核心句型 (支持点击) */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>核心句型 (点击朗读)</div>
                    <div 
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                      style={{ cursor: 'pointer', ...styles.patternText }}
                    >
                      {renderTextWithPinyin(gp.pattern)}
                      <span style={{ marginLeft: 8, verticalAlign: 'middle', display: 'inline-block' }}>
                         {loadingId === `pattern_${gp.id}` ? <FaSpinner className="spin" size={16} color="#3b82f6"/> : <FaVolumeUp size={16} color="#3b82f6"/>}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. 语法详解 (文字内容) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                    {/* 单独的讲解播放按钮 */}
                    <button 
                       onClick={() => play(gp.explanationScript, narrationId)}
                       style={styles.playBtnCircle}
                       disabled={loadingId === narrationId}
                    >
                      {loadingId === narrationId ? <FaSpinner className="spin"/> : (playingId === narrationId && !isPaused ? <FaPause/> : <FaPlay/>)}
                    </button>
                  </div>
                  {/* 使用简单渲染，如果需要点击朗读详解每行，可以用 InteractiveTextBlock */}
                  <div style={styles.richText}>
                    <InteractiveTextBlock text={gp.explanation.replace(/<br\/>/g, '\n')} playFn={play} baseId={`exp_${gp.id}`} />
                  </div>
                </div>

                {/* 3. 易错点/对比 (红字/黑字逻辑) */}
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
                             borderRadius: isLeft ? '18px 18px 18px 4px' : '18px 18px 4px 18px'
                          }}>
                             <div style={styles.bubbleText}>
                               {renderTextWithPinyin(ex.sentence)}
                             </div>
                             <div style={styles.bubbleTrans}>{ex.translation}</div>
                             
                             {/* 播放状态指示 */}
                             {(playingId === exId || loadingId === exId) && (
                               <div style={{ position: 'absolute', top: 6, right: 8 }}>
                                  {loadingId === exId ? <FaSpinner className="spin" size={10} color="#94a3b8"/> : <FaVolumeUp size={12} color="#3b82f6"/>}
                               </div>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 底部按钮 - 跟随内容滚动，居中显示 */}
                <div style={styles.nextButtonContainer}>
                   <button style={styles.nextBtn} onClick={handleNext}>
                     {i === normalizedPoints.length -1 ? '完成本节' : '下一个'} <FaChevronRight size={14} />
                   </button>
                </div>
                
                <div style={{ height: '40px' }} /> {/* 底部留白 */}
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
};

// =================================================================================
// ===== 7. 样式定义 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: '-apple-system, system-ui, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px' },
  contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: '100px' }, // 给顶部播放器留出空间
  
  // 顶部播放器
  topPlayerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '80px',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    zIndex: 1000,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
  },
  topPlayerContent: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', gap: '12px'
  },
  playBtnLarge: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: 'white', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
  },
  playerLabel: { fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  timeLabel: { fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' },
  speedBtn: {
    background: '#f1f5f9', border: 'none', borderRadius: '20px',
    padding: '6px 12px', fontSize: '0.75rem', fontWeight: '600',
    color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
  },
  progressBarWrapper: { position: 'relative', height: '3px', width: '100%', background: '#e2e8f0' },
  progressBarFill: { height: '100%', background: '#3b82f6', transition: 'width 0.1s linear' },
  hiddenRangeInput: {
    position: 'absolute', top: -10, left: 0, width: '100%', height: '23px',
    opacity: 0, cursor: 'pointer', margin: 0
  },

  title: { fontSize: '1.75rem', fontWeight: '800', textAlign: 'center', color: '#1e293b', marginBottom: '24px', marginTop: '10px' },
  
  card: { background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  cardLabel: { fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' },
  patternText: { fontSize: '1.35rem', fontWeight: '600', color: '#0f172a' },

  section: { marginBottom: '32px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' },
  playBtnCircle: { width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  
  richText: { fontSize: '1rem', color: '#475569', background: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '8px' },
  attentionBox: { background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '8px' },

  ruby: { rubyPosition: 'over', margin: '0 1px' },
  rt: { fontSize: '0.6em', userSelect: 'none' },

  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-end', gap: '10px' },
  avatar: { width: 32, height: 32, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0, marginBottom: '4px' },
  bubble: { padding: '12px 16px', maxWidth: '85%', position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  bubbleText: { fontSize: '1.05rem', color: '#1e293b', marginBottom: '4px' },
  bubbleTrans: { fontSize: '0.85rem', color: '#94a3b8' },

  // 底部按钮样式
  nextButtonContainer: {
    marginTop: '40px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'center',
    width: '100%'
  },
  nextBtn: {
    background: '#1e293b', color: 'white',
    border: 'none', padding: '14px 40px',
    borderRadius: '40px', fontSize: '1rem', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: 'pointer', boxShadow: '0 10px 20px rgba(30, 41, 59, 0.2)',
    transition: 'transform 0.1s'
  },

  // 完成页
  completionContainer: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' },
  completionCard: { background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80%', maxWidth: '320px' },
  checkIconWrapper: { width: 80, height: 80, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)' },
  restartBtn: { marginTop: '10px', padding: '12px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: '600' }
};

// 注入 hover 样式
if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    ruby { ruby-align: center; }
    .hover-bg:active { background-color: rgba(0,0,0,0.03) !important; transform: scale(0.99); }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
