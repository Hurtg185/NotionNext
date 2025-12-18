import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaVolumeUp, FaSpinner, FaChevronLeft, FaChevronRight, 
  FaPause, FaPlay, FaUserCircle, FaRedo, FaCheckCircle
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// =================================================================================
// ===== 1. TTS 核心逻辑 (基于 Map 缓存 + 用户提供的 API) =====
// =================================================================================

const ttsCache = new Map(); // 全局内存缓存

// 获取音频对象 (Promise)
const getTTSAudio = async (text, lang = 'zh') => {
  // 根据语言选择语音包
  // 缅甸语使用 my-MM-NilarNeural，中文使用 zh-CN-XiaoyouNeural
  const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural';
  const cacheKey = `${text}|${voice}`;

  if (ttsCache.has(cacheKey)) {
    const cachedAudio = ttsCache.get(cacheKey);
    cachedAudio.currentTime = 0; // 重置进度
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
// ===== 2. React TTS Hook (封装播放状态、进度、语速) =====
// =================================================================================
function useSimpleTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    loadingId: null,
    playingId: null,
    duration: 0,
    currentTime: 0,
    playbackRate: 0.6, // 默认慢速
  });

  const audioObjRef = useRef(null);
  const requestRef = useRef(null);
  const queueRef = useRef([]); // 用于处理混合语言时的播放队列
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, []);

  // 停止所有播放
  const stop = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    // 停止当前音频
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      audioObjRef.current.currentTime = 0;
      audioObjRef.current = null;
    }

    // 停止缓存中可能正在播放的其他音频 (防卫性编程)
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

  // 更新进度条循环
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

  // 切换播放/暂停
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

  // 拖动进度
  const seek = useCallback((time) => {
    if (audioObjRef.current) {
      audioObjRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  // 设置语速
  const setRate = useCallback((rate) => {
    setPlayerState(prev => ({ ...prev, playbackRate: rate }));
    if (audioObjRef.current) {
      audioObjRef.current.playbackRate = rate;
    }
  }, []);

  // 播放入口
  const play = useCallback(async (text, uniqueId) => {
    // 如果点击的是当前正在播放的ID
    if (playerState.playingId === uniqueId) {
      toggle();
      return;
    }

    stop(); // 停止旧的
    setPlayerState(prev => ({ ...prev, loadingId: uniqueId }));

    // 1. 文本处理与分段 (处理中缅混合)
    let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
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
      // 2. 并行获取所有音频片段
      const audioPromises = segments.map(seg => getTTSAudio(seg.text, seg.lang));
      const audioObjects = await Promise.all(audioPromises);

      // 过滤掉失败的 null
      const validAudios = audioObjects.filter(a => a !== null);
      queueRef.current = validAudios;

      if (validAudios.length === 0) {
        setPlayerState(prev => ({ ...prev, loadingId: null }));
        return;
      }

      // 3. 递归播放队列
      const playQueue = (index) => {
        if (!mountedRef.current) return;
        if (index >= validAudios.length) {
          stop(); // 全部播放完毕
          return;
        }

        const audio = validAudios[index];
        audioObjRef.current = audio;
        
        // 应用设置
        audio.playbackRate = playerState.playbackRate;
        
        // 事件绑定
        const onLoadedMeta = () => {
           if(index === 0) { // 仅设置第一段的 duration 作为初始显示，或逻辑更复杂时累加
             setPlayerState(prev => ({ ...prev, duration: audio.duration, currentTime: 0 }));
           }
        };
        const onEnded = () => {
           playQueue(index + 1);
        };
        const onError = () => {
           playQueue(index + 1);
        };

        audio.addEventListener('loadedmetadata', onLoadedMeta);
        audio.addEventListener('ended', onEnded, { once: true });
        audio.addEventListener('error', onError, { once: true });

        audio.play()
          .then(() => {
            setPlayerState(prev => ({ 
              ...prev, 
              isPlaying: true, 
              isPaused: false, 
              playingId: uniqueId, 
              loadingId: null 
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
// ===== 3. 辅助组件：拼音渲染与 Markdown =====
// =================================================================================

const renderTextWithPinyin = (text, isRed = false) => {
  if (!text) return null;
  const clean = text.replace(/\{\{|\}\}/g, '');
  const parts = clean.match(/([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g) || [];

  return (
    <span style={{ lineHeight: '2.2', wordBreak: 'break-word', color: isRed ? '#ef4444' : 'inherit' }}>
      {parts.map((part, idx) => {
        if (/[\u4e00-\u9fff]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          const charArray = part.split('');
          return charArray.map((char, cIdx) => (
            <ruby key={`${idx}-${cIdx}`} style={styles.ruby}>
              {char}
              <rt style={{...styles.rt, color: isRed ? '#fca5a5' : '#64748b'}}>{pyArray[cIdx] || ''}</rt>
            </ruby>
          ));
        } else {
          return <span key={idx}>{part}</span>;
        }
      })}
    </span>
  );
};

const simpleMarkdownToHtml = (md) => {
  if (!md) return '';
  let html = md;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/\n/g, '<br/>');
  return html;
};

// =================================================================================
// ===== 4. 悬浮播放器组件 =====
// =================================================================================
const FloatingPlayer = ({ 
  isPlaying, isPaused, duration, currentTime, 
  onToggle, onSeek, onRateChange, playbackRate, label 
}) => {
  const constraintsRef = useRef(null);

  if (!isPlaying && !isPaused) return null;

  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <>
      <div ref={constraintsRef} style={styles.dragConstraints} />
      <motion.div 
        drag 
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        style={styles.floatPlayerContainer}
      >
        <div className="drag-handle" style={styles.floatAvatar}>
          <FaUserCircle size={32} color="white" />
        </div>
        <div style={styles.floatContent}>
          <div style={styles.floatHeader}>
            <span style={styles.floatLabel}>{label || '播放中...'}</span>
            <span style={styles.floatTime}>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            value={currentTime} 
            onChange={(e) => onSeek(Number(e.target.value))}
            style={styles.floatSlider}
          />
          <div style={styles.floatControls}>
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} style={styles.floatPlayBtn}>
              {isPaused ? <FaPlay size={12} /> : <FaPause size={12} />}
            </button>
            <div style={styles.rateControl}>
               {[0.6, 0.8, 1.0].map(r => (
                 <button
                   key={r}
                   onClick={() => onRateChange(r)}
                   style={{
                     ...styles.rateBtn,
                     background: Math.abs(playbackRate - r) < 0.05 ? '#3b82f6' : 'rgba(255,255,255,0.1)'
                   }}
                 >
                   {r === 0.6 ? '慢' : r === 0.8 ? '中' : '快'}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// =================================================================================
// ===== 5. 完成页面组件 =====
// =================================================================================
const CompletionScreen = ({ onRestart }) => (
  <div style={styles.completionContainer}>
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={styles.completionCard}
    >
      <FaCheckCircle size={64} color="#10b981" style={{ marginBottom: 20 }} />
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#064e3b', marginBottom: 10 }}>恭喜完成学习！</h2>
      <p style={{ color: '#64748b', marginBottom: 30 }}>你已经掌握了本节课的所有语法点。</p>
      
      <button onClick={onRestart} style={styles.restartBtn}>
        <FaRedo style={{ marginRight: 8 }} /> 重新开始
      </button>
    </motion.div>
  </div>
);

// =================================================================================
// ===== 6. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints }) => {
  
  // 数据处理
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      explanation: item['语法详解'] || item.visibleExplanation || '',
      attention: item['注意事项'] || item['易错点'] || item.attention || '', // 这里的字段会被标红
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
  const [direction, setDirection] = useState(0); 
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
      setDirection(1);
      setCurrentIndex(p => p + 1);
    } else {
      setIsCompleted(true); // 显示完成页
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(p => p - 1);
    }
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setCurrentIndex(0);
    setDirection(0);
  };

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `translate3d(${direction > 0 ? '100%' : '-100%'},0,0)` },
    enter: { opacity: 1, transform: 'translate3d(0%,0,0)' },
    leave: { opacity: 0, transform: `translate3d(${direction > 0 ? '-100%' : '100%'},0,0)`, position: 'absolute' },
  });

  if (!normalizedPoints.length) return <div style={styles.center}>暂无数据</div>;

  // 如果完成了，显示完成页
  if (isCompleted) {
    return <CompletionScreen onRestart={handleRestart} />;
  }

  return (
    <div style={styles.container}>
      <AnimatePresence>
        {(isPlaying || isPaused) && (
           <FloatingPlayer 
             isPlaying={isPlaying}
             isPaused={isPaused}
             currentTime={currentTime}
             duration={duration}
             playbackRate={playbackRate}
             onToggle={toggle}
             onSeek={seek}
             onRateChange={setRate}
             label={playingId && playingId.startsWith('narration') ? '语法讲解' : '例句朗读'}
           />
        )}
      </AnimatePresence>

      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        if (!gp) return null;
        
        const narrationId = `narration_${gp.id}`;

        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 句型卡片 */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>核心句型</div>
                    <div style={styles.patternText}>
                      {renderTextWithPinyin(gp.pattern)}
                    </div>
                    <button 
                      style={styles.textPlayBtn}
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                    >
                      {loadingId === `pattern_${gp.id}` ? <FaSpinner className="spin" /> : <FaVolumeUp />} 朗读句型
                    </button>
                  </div>
                )}

                {/* 详解 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>📝 语法详解</span>
                    <button 
                       onClick={() => play(gp.explanationScript, narrationId)}
                       style={styles.playBtnCircle}
                       disabled={loadingId === narrationId}
                    >
                      {loadingId === narrationId ? <FaSpinner className="spin"/> : (playingId === narrationId && !isPaused ? <FaPause/> : <FaPlay/>)}
                    </button>
                  </div>
                  <div style={styles.richText} dangerouslySetInnerHTML={{__html: simpleMarkdownToHtml(gp.explanation)}} />
                </div>

                {/* 易错点 (红色标记) */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={{...styles.sectionTitle, color: '#ef4444'}}>⚠️ 易错点/注意事项</span>
                    </div>
                    <div style={{...styles.richText, background: '#fef2f2', border: '1px solid #fee2e2'}}>
                      {renderTextWithPinyin(gp.attention, true)}
                    </div>
                  </div>
                )}

                {/* 对话例句 */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>💬 场景对话</span>
                  </div>
                  <div style={styles.dialogueContainer}>
                    {gp.dialogues.map((ex, idx) => {
                      const exId = `ex_${gp.id}_${idx}`;
                      const isLeft = ex.speaker === 'A';
                      return (
                        <div key={idx} style={{ 
                          ...styles.dialogueRow, 
                          flexDirection: isLeft ? 'row' : 'row-reverse' 
                        }}>
                          <div style={{
                            ...styles.avatar,
                            background: isLeft ? '#3b82f6' : '#ec4899'
                          }}>
                            {ex.speaker}
                          </div>
                          
                          <div style={{
                             ...styles.bubble,
                             background: isLeft ? '#eff6ff' : '#fff1f2',
                             border: isLeft ? '1px solid #dbeafe' : '1px solid #fce7f3',
                             borderRadius: isLeft ? '16px 16px 16px 4px' : '16px 16px 4px 16px'
                          }}>
                             <div style={styles.bubbleText}>
                               {renderTextWithPinyin(ex.sentence)}
                             </div>
                             <div style={styles.bubbleTrans}>{ex.translation}</div>
                             <button 
                               style={styles.bubblePlayBtn}
                               onClick={() => play(ex.script, exId)}
                             >
                               {loadingId === exId ? <FaSpinner className="spin" size={12}/> : <FaVolumeUp size={12}/>}
                             </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{height: 100}} />
              </div>
            </div>

            <div style={styles.bottomBar}>
              <button 
                style={{...styles.navBtn, visibility: i === 0 ? 'hidden' : 'visible'}} 
                onClick={handlePrev}
              >
                <FaChevronLeft /> 上一条
              </button>
              <button style={styles.navBtnPrimary} onClick={handleNext}>
                {i === normalizedPoints.length -1 ? '完成学习' : '下一条'} <FaChevronRight />
              </button>
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
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px' },
  contentWrapper: { maxWidth: '800px', margin: '0 auto', paddingTop: '20px' },
  
  title: { fontSize: '1.6rem', fontWeight: '800', textAlign: 'center', color: '#1e293b', marginBottom: '20px' },
  
  card: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' },
  cardLabel: { fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' },
  patternText: { fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', lineHeight: 1.6 },
  textPlayBtn: { marginTop: '10px', fontSize: '0.9rem', color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },

  section: { marginBottom: '30px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#334155' },
  playBtnCircle: { width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  
  richText: { fontSize: '1rem', lineHeight: 1.8, color: '#475569', background: '#f8fafc', padding: '16px', borderRadius: '12px' },

  ruby: { rubyPosition: 'over', margin: '0 2px' },
  rt: { fontSize: '0.6em', color: '#64748b' },

  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  avatar: { width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 },
  bubble: { padding: '12px 16px', maxWidth: '80%', position: 'relative' },
  bubbleText: { fontSize: '1rem', color: '#1e293b', marginBottom: '4px' },
  bubbleTrans: { fontSize: '0.85rem', color: '#64748b' },
  bubblePlayBtn: { position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' },

  bottomBar: { height: '80px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(5px)', zIndex: 10 },
  navBtn: { border: 'none', background: 'transparent', color: '#64748b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  navBtnPrimary: { border: 'none', background: '#2563eb', color: 'white', padding: '10px 24px', borderRadius: '30px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' },

  dragConstraints: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 90 },
  floatPlayerContainer: {
    position: 'absolute', bottom: '100px', right: '20px', width: '280px',
    background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)',
    borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', zIndex: 100, color: 'white'
  },
  floatAvatar: { width: 40, height: 40, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  floatContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  floatHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' },
  floatLabel: { fontWeight: 'bold', color: 'white' },
  floatSlider: { width: '100%', height: '4px', borderRadius: '2px', accentColor: '#3b82f6', cursor: 'pointer' },
  floatControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  floatPlayBtn: { width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  rateControl: { display: 'flex', gap: '4px', alignItems: 'center' },
  rateBtn: { padding: '2px 6px', borderRadius: '4px', border: 'none', color: 'white', fontSize: '9px', cursor: 'pointer' },

  // 完成页面样式
  completionContainer: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5' },
  completionCard: { background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '90%' },
  restartBtn: { marginTop: '20px', padding: '12px 30px', background: '#10b981', color: 'white', border: 'none', borderRadius: '30px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }
};

if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    ruby { ruby-align: center; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
