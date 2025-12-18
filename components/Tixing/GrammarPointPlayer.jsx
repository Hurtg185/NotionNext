import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import { 
  FaVolumeUp, FaSpinner, FaChevronLeft, FaChevronRight, 
  FaPause, FaPlay, FaTimes, FaCog, FaUserCircle
} from 'react-icons/fa';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

// =================================================================================
// ===== 1. IndexedDB 工具函数 (缓存音频) =====
// =================================================================================
const DB_NAME = 'MixedTTSCache_V2';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    try {
      await this.init();
    } catch (e) {
      return null;
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (!blob || blob.size < 100) return;
    try {
      await this.init();
    } catch (e) {
      return;
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }
};

const inFlightRequests = new Map();

// =================================================================================
// ===== 2. 混合 TTS Hook (支持进度、语速) =====
// =================================================================================
function useMixedTTS() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    loadingId: null,
    playingId: null, // 当前播放的任务ID
    duration: 0,
    currentTime: 0,
    playbackRate: 0.6, // 默认慢速 -40%
  });

  const audioObjRef = useRef(null); // 当前正在播放的 Audio 对象
  const requestRef = useRef(null); // 用于 requestAnimationFrame 更新进度
  const audioQueueRef = useRef([]); // 如果有分段，存储队列
  const currentSegmentIndexRef = useRef(0);
  const latestRequestIdRef = useRef(0);

  // 清理函数
  const stop = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      audioObjRef.current.currentTime = 0;
      audioObjRef.current = null;
    }
    
    // 清理队列
    audioQueueRef.current.forEach(a => {
      try { a.pause(); } catch(e){}
    });
    audioQueueRef.current = [];

    if (window.speechSynthesis) window.speechSynthesis.cancel();

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

  // 更新进度循环
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

  // 改变语速
  const setRate = useCallback((rate) => {
    setPlayerState(prev => ({ ...prev, playbackRate: rate }));
    if (audioObjRef.current) {
      audioObjRef.current.playbackRate = rate;
    }
  }, []);

  // 拖动进度条跳转
  const seek = useCallback((time) => {
    if (audioObjRef.current) {
      audioObjRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  // 暂停/继续
  const toggle = useCallback((uniqueId) => {
    if (playerState.playingId !== uniqueId) return;

    if (audioObjRef.current) {
      if (audioObjRef.current.paused) {
        audioObjRef.current.play().catch(console.warn);
        audioObjRef.current.playbackRate = playerState.playbackRate;
        setPlayerState(prev => ({ ...prev, isPaused: false }));
        requestRef.current = requestAnimationFrame(updateProgress);
      } else {
        audioObjRef.current.pause();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setPlayerState(prev => ({ ...prev, isPaused: true }));
      }
    }
  }, [playerState.playingId, playerState.playbackRate, updateProgress]);

  // 获取音频 Blob
  const fetchAudioBlob = async (text, lang) => {
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-v2-${voice}-${text}`;

    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);

    const promise = (async () => {
      // 这里的 API 仅为示例，实际需替换为可用服务
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network err');
      const blob = await res.blob();
      if (blob.size > 100) idb.set(cacheKey, blob);
      return blob;
    })();

    inFlightRequests.set(cacheKey, promise);
    return promise;
  };

  // 播放核心逻辑
  const play = useCallback(async (text, uniqueId) => {
    if (playerState.playingId === uniqueId) {
      toggle(uniqueId);
      return;
    }

    stop();
    setPlayerState(prev => ({ ...prev, loadingId: uniqueId }));
    
    const reqId = ++latestRequestIdRef.current;
    
    // 清理文本
    let cleanText = String(text).replace(/<[^>]+>/g, '').replace(/\{\{|\}\}/g, '').trim();
    if (!cleanText) {
      setPlayerState(prev => ({ ...prev, loadingId: null }));
      return;
    }

    try {
      // 简单切分逻辑：如果有缅甸语，必须拆分，否则视为一段中文/混合
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

      // 获取所有音频
      const blobs = await Promise.all(segments.map(s => fetchAudioBlob(s.text, s.lang)));
      if (reqId !== latestRequestIdRef.current) return;

      const audios = blobs.map(b => new Audio(URL.createObjectURL(b)));
      audioQueueRef.current = audios;

      const playSegment = (index) => {
        if (reqId !== latestRequestIdRef.current) return;
        if (index >= audios.length) {
          stop();
          return;
        }

        const audio = audios[index];
        audioObjRef.current = audio;
        currentSegmentIndexRef.current = index;

        // 设置播放状态
        audio.playbackRate = playerState.playbackRate; // 应用当前语速
        
        audio.onloadedmetadata = () => {
             setPlayerState(prev => ({ 
               ...prev, 
               duration: audio.duration,
               currentTime: 0
             }));
        };

        audio.onended = () => {
          playSegment(index + 1);
        };
        
        audio.onerror = () => playSegment(index + 1);

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
          .catch(e => {
            console.error(e);
            playSegment(index + 1);
          });
      };

      playSegment(0);

    } catch (e) {
      console.error("TTS Error", e);
      setPlayerState(prev => ({ ...prev, loadingId: null }));
    }
  }, [playerState.playingId, playerState.playbackRate, stop, toggle, updateProgress]);

  return { 
    ...playerState, 
    play, 
    stop, 
    toggle, 
    seek, 
    setRate 
  };
}

// =================================================================================
// ===== 3. 辅助组件：拼音与 Markdown =====
// =================================================================================

// 自动生成带拼音的 HTML
const renderTextWithPinyin = (text, isPattern = false) => {
  if (!text) return null;
  
  // 识别 {{...}} 视为中文重点，或者自动检测中文字符
  // 策略：分割非中文和中文。中文部分用 pinyin-pro 处理
  
  // 移除 {{ }} 标记，直接处理内容
  const clean = text.replace(/\{\{|\}\}/g, '');
  
  // 简单分词逻辑：按连续汉字或非汉字分割
  const parts = clean.match(/([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g) || [];

  return (
    <span style={{ lineHeight: '2.2', wordBreak: 'break-word' }}>
      {parts.map((part, idx) => {
        // 如果是中文
        if (/[\u4e00-\u9fff]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          // 将每个字和它的拼音对应起来
          const charArray = part.split('');
          return charArray.map((char, cIdx) => (
            <ruby key={`${idx}-${cIdx}`} style={styles.ruby}>
              {char}
              <rt style={styles.rt}>{pyArray[cIdx] || ''}</rt>
            </ruby>
          ));
        } else {
          // 非中文（缅文或标点）
          const isMy = /[\u1000-\u109F]/.test(part);
          return (
            <span key={idx} style={isMy ? styles.textBurmese : styles.textNeutral}>
              {part}
            </span>
          );
        }
      })}
    </span>
  );
};

// 简单 Markdown 转 HTML
const simpleMarkdownToHtml = (md) => {
  if (!md) return '';
  let html = md;
  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  // 加粗
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  // 列表
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // 换行
  html = html.replace(/\n/g, '<br/>');
  return html;
};

// =================================================================================
// ===== 4. 悬浮播放器组件 (FloatingPlayer) =====
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
        {/* 左侧头像 (可拖动) */}
        <div className="drag-handle" style={styles.floatAvatar}>
          <FaUserCircle size={32} color="white" />
        </div>

        {/* 中间内容 */}
        <div style={styles.floatContent}>
          <div style={styles.floatHeader}>
            <span style={styles.floatLabel}>{label || '正在播放...'}</span>
            <span style={styles.floatTime}>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          
          {/* 进度条 */}
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            value={currentTime} 
            onChange={(e) => onSeek(Number(e.target.value))}
            style={styles.floatSlider}
          />

          {/* 控制区 */}
          <div style={styles.floatControls}>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggle(); }} 
              style={styles.floatPlayBtn}
            >
              {isPaused ? <FaPlay size={12} /> : <FaPause size={12} />}
            </button>
            
            {/* 语速选择 */}
            <div style={styles.rateControl}>
               <span style={{fontSize: '10px', color: '#cbd5e1', marginRight: 4}}>Speed:</span>
               {[0.6, 0.8, 1.0].map(r => (
                 <button
                   key={r}
                   onClick={() => onRateChange(r)}
                   style={{
                     ...styles.rateBtn,
                     background: Math.abs(playbackRate - r) < 0.05 ? '#3b82f6' : 'rgba(255,255,255,0.1)'
                   }}
                 >
                   {r === 0.6 ? '-40%' : r === 0.8 ? '-20%' : '1.0x'}
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
// ===== 5. 主组件 (GrammarPointPlayer) =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete = () => {} }) => {
  
  // 标准化数据
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || item.grammarPoint || '',
      pattern: item['句型结构'] || item.pattern || '',
      explanation: item['语法详解'] || item.visibleExplanation || '',
      explanationScript: item['讲解脚本'] || item.narrationScript || (item['语法详解'] || '').replace(/<[^>]+>/g, ''),
      dialogues: (item['例句列表'] || item.examples || []).map((ex, i) => ({
        id: ex.id || i,
        speaker: i % 2 === 0 ? 'A' : 'B', // 模拟 A/B 对话
        sentence: ex['句子'] || ex.sentence || '',
        translation: ex['翻译'] || ex.translation || '',
        script: ex['例句发音'] || ex.narrationScript || ex['句子'] || ''
      }))
    }));
  }, [grammarPoints]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1: next, -1: prev
  const contentRef = useRef(null);
  
  // TTS Hook
  const { 
    play, stop, toggle, seek, setRate,
    isPlaying, isPaused, loadingId, playingId, currentTime, duration, playbackRate 
  } = useMixedTTS();

  useEffect(() => {
    // 切页停止播放
    stop(); 
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  const handleNext = () => {
    if (currentIndex < normalizedPoints.length - 1) {
      setDirection(1);
      setCurrentIndex(p => p + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(p => p - 1);
    }
  };

  // 动画配置
  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `translate3d(${direction > 0 ? '100%' : '-100%'},0,0)` },
    enter: { opacity: 1, transform: 'translate3d(0%,0,0)' },
    leave: { opacity: 0, transform: `translate3d(${direction > 0 ? '-100%' : '100%'},0,0)`, position: 'absolute' },
    config: { tension: 280, friction: 30 }
  });

  const currentGp = normalizedPoints[currentIndex];

  if (!normalizedPoints.length) return <div style={styles.center}>暂无数据</div>;

  return (
    <div style={styles.container}>
      {/* 悬浮播放器 - 仅当播放“讲解”时显示完整大播放器，或者一直显示当前播放内容 */}
      <AnimatePresence>
        {(isPlaying || isPaused) && (
           <FloatingPlayer 
             isPlaying={isPlaying}
             isPaused={isPaused}
             currentTime={currentTime}
             duration={duration}
             playbackRate={playbackRate}
             onToggle={() => toggle(playingId)}
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
                
                {/* 标题 */}
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 句型卡片 */}
                {gp.pattern && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>核心句型</div>
                    <div style={styles.patternText}>
                      {renderTextWithPinyin(gp.pattern, true)}
                    </div>
                    {/* 句型也支持朗读 */}
                    <button 
                      style={styles.textPlayBtn}
                      onClick={() => play(gp.pattern, `pattern_${gp.id}`)}
                    >
                      {loadingId === `pattern_${gp.id}` ? <FaSpinner className="spin" /> : <FaVolumeUp />} 朗读句型
                    </button>
                  </div>
                )}

                {/* 详解 (支持悬浮播放器) */}
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

                {/* 对话式例句 */}
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

                <div style={{height: 100}} /> {/* 底部垫高 */}
              </div>
            </div>

            {/* 底部导航 */}
            <div style={styles.bottomBar}>
              <button 
                style={{...styles.navBtn, visibility: i === 0 ? 'hidden' : 'visible'}} 
                onClick={handlePrev}
              >
                <FaChevronLeft /> 上一条
              </button>
              <button style={styles.navBtnPrimary} onClick={handleNext}>
                {i === normalizedPoints.length -1 ? '完成' : '下一条'} <FaChevronRight />
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
  onComplete: PropTypes.func
};

// =================================================================================
// ===== 6. 样式定义 =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' },
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

  // Ruby (注音) 样式
  ruby: { rubyPosition: 'over', margin: '0 2px' },
  rt: { fontSize: '0.6em', color: '#64748b' },
  textBurmese: { fontSize: '1.1em', color: '#059669' },
  textNeutral: { color: '#334155' },

  // 对话样式
  dialogueContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  dialogueRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  avatar: { width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 },
  bubble: { padding: '12px 16px', maxWidth: '80%', position: 'relative' },
  bubbleText: { fontSize: '1rem', color: '#1e293b', marginBottom: '4px' },
  bubbleTrans: { fontSize: '0.85rem', color: '#64748b' },
  bubblePlayBtn: { position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' },

  // 底部导航
  bottomBar: { height: '80px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(5px)', zIndex: 10 },
  navBtn: { border: 'none', background: 'transparent', color: '#64748b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  navBtnPrimary: { border: 'none', background: '#2563eb', color: 'white', padding: '10px 24px', borderRadius: '30px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' },

  // 悬浮播放器
  dragConstraints: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 90 },
  floatPlayerContainer: {
    position: 'absolute', bottom: '100px', right: '20px', width: '280px',
    background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)',
    borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', zIndex: 100, color: 'white'
  },
  floatAvatar: {
    width: 40, height: 40, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  floatContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  floatHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' },
  floatLabel: { fontWeight: 'bold', color: 'white' },
  floatSlider: { width: '100%', height: '4px', borderRadius: '2px', accentColor: '#3b82f6', cursor: 'pointer' },
  floatControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  floatPlayBtn: { width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  rateControl: { display: 'flex', gap: '4px', alignItems: 'center' },
  rateBtn: { padding: '2px 6px', borderRadius: '4px', border: 'none', color: 'white', fontSize: '9px', cursor: 'pointer' }
};

// 注入动画与全局样式
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
