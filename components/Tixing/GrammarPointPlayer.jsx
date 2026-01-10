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
    // 如果是表格内容或其他不需要朗读的，直接返回
    if (!text || typeof text !== 'string') return;

    playSFX('click');
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

    const targetVoice = voiceOverride || (/[\u1000-\u109F]/.test(text) ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoMultilingualNeural');

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
// ===== 2. 文本与表格渲染组件 =====
// =================================================================================

// 简单的 Markdown 表格渲染器
const MarkdownTable = ({ lines }) => {
  if (!lines || lines.length === 0) return null;

  // 过滤掉分隔行 (例如 |---|---| )
  const dataRows = lines.filter(line => !line.match(/^\|\s*-+\s*\|/));

  return (
    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
      <table style={styles.table}>
        <tbody>
          {dataRows.map((row, rIdx) => {
            const cells = row.split('|').filter(c => c.trim() !== ''); // 简单的分割
            return (
              <tr key={rIdx} style={rIdx === 0 ? styles.tableHeaderRow : styles.tableRow}>
                {cells.map((cell, cIdx) => (
                  <td key={cIdx} style={styles.tableCell}>
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

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
        textDecorationColor: color, 
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

// 增强版渲染器：支持 Markdown 表格和富文本
const RichTextRenderer = ({ content, onPlayText, activeTtsId }) => {
  if (!content) return null;

  // 将内容按行拆分，处理表格逻辑
  const lines = content.split('\n');
  const nodes = [];
  let tableBuffer = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      nodes.push(<MarkdownTable key={`tbl-${nodes.length}`} lines={[...tableBuffer]} />);
      tableBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // 简单的表格检测：如果行以 | 开头并以 | 结尾（可选），则视为表格行
    if (trimmed.startsWith('|')) {
      tableBuffer.push(trimmed);
      return; // 继续收集表格行
    } else {
      flushTable(); // 遇到非表格行，先把之前的表格渲染出来
    }

    if (!trimmed) {
      nodes.push(<div key={idx} style={{ height: '8px' }} />);
      return;
    }

    if (trimmed.startsWith('###')) {
      nodes.push(<h3 key={idx} style={styles.h3}>{trimmed.replace(/###\s?/, '')}</h3>);
      return;
    }

    const segmentId = `seg_${idx}`;

    nodes.push(
      <div key={idx} style={styles.textRow}>
        {trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g).map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                <PinyinText text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#0000ff" bold={true} />
              </span>
            );
          } 
          if (part.startsWith('~~') && part.endsWith('~~')) {
            return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#ef4444" strikethrough={true} />;
          }
          if (part.startsWith('{{') && part.endsWith('}}')) {
            return <PinyinText key={pIdx} text={part.slice(2, -2)} onClick={() => onPlayText(trimmed, segmentId)} color="#eab308" bold={true} />;
          }
          
          return <PinyinText key={pIdx} text={part} onClick={() => onPlayText(trimmed, segmentId)} />;
        })}
      </div>
    );
  });

  flushTable(); // 处理结尾如果是表格的情况

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {nodes}
    </div>
  );
};

// =================================================================================
// ===== 3. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, level = "HSK 1", onComplete }) => {
  const { triggerAI, updatePageContext, isAiOpen } = useAI();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const playerContainerRef = useRef(null);
  const contentRef = useRef(null);

  const { play, stop, activeId } = useRobustTTS();

  // 数据标准化
  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || '',
      pattern: item['句型结构'] || '', // 这里可能包含表格字符串
      videoUrl: item['视频链接'] || item.videoUrl || '',
      videoPoster: item['视频封面'] || item.poster || '', 
      explanationRaw: item['语法详解'] || '',
      script: item['讲解脚本'] || item['script'] || item['Teaching Script'] || '', 
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

  // 核心逻辑：构造 AI 上下文
  const constructFullAIContent = useCallback((point) => {
    if (!point) return '';
    
    let content = '';

    if (point.script && point.script.length > 5) {
        content += `<<<SCRIPT_MODE_START>>>\n`;
        content += `${point.script}\n`;
        content += `<<<SCRIPT_MODE_END>>>\n\n`;
        content += `(系统指令：检测到上方有脚本。请忽略所有通用模板，直接扮演老师，用生动的语气讲出上面的脚本内容！)\n\n`;
        content += `=========================\n\n`;
    }

    content += `【语法标题】：${point.title}\n`;
    content += `【核心句型】：${point.pattern}\n\n`;
    content += `【详解内容】：\n${point.explanationRaw}\n\n`;
    
    if (point.attention) {
      content += `【注意事项/易错点】：\n${point.attention}\n\n`;
    }
    
    if (point.dialogues && point.dialogues.length > 0) {
      content += `【参考例句】：\n`;
      point.dialogues.forEach((d, i) => {
        content += `${i+1}. ${d.sentence} (${d.translation})\n`;
      });
    }
    return content;
  }, []);

  // 自动同步与触发逻辑
  useEffect(() => {
    if (currentPoint) {
      const fullContent = constructFullAIContent(currentPoint);
      updatePageContext(fullContent);

      if (isAiOpen) {
        const levelId = `${level.replace(/\s+/g, '').toLowerCase()}_grammar_${currentPoint.id}`;
        triggerAI(currentPoint.title, fullContent, levelId);
      }
    }
  }, [currentIndex, currentPoint, isAiOpen, level, updatePageContext, triggerAI, constructFullAIContent]);

  // UI 交互
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

  useEffect(() => {
    stop();
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

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
      {/* AI 悬浮按钮已移除 */}

      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div style={styles.scrollContainer} ref={contentRef}>
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                <div style={styles.headerRow}>
                  {/* 核心句型卡片：支持简单的 Markdown 表格检测 */}
                  <div style={styles.patternCard}>
                    <div style={styles.cardLabel}><FaBookReader /> 核心句型</div>
                    
                    {gp.pattern && gp.pattern.includes('|') ? (
                       // 如果包含表格符号，使用 MarkdownTable 渲染
                       <div style={{ marginTop: '8px' }}>
                         <MarkdownTable lines={gp.pattern.split('\n')} />
                       </div>
                    ) : (
                       // 否则按普通文本/拼音渲染
                       <div onClick={() => play(gp.pattern, `pat_${gp.id}`)} style={styles.patternText}>
                         <PinyinText text={gp.pattern} color="#1e40af" bold />
                       </div>
                    )}
                  </div>

                  {gp.videoUrl ? (
                    <div 
                      style={styles.videoBox} 
                      ref={playerContainerRef} 
                      onClick={handleVideoFullScreen}
                      onContextMenu={(e) => e.preventDefault()} // 禁止右键
                    >
                      <ReactPlayer 
                        url={gp.videoUrl} 
                        width="100%" 
                        height="100%" 
                        playing={isVideoPlaying}
                        light={gp.videoPoster || true} 
                        // 禁用下载和画中画
                        config={{ 
                          file: { 
                            attributes: { 
                              controlsList: 'nodownload noplaybackrate', 
                              disablePictureInPicture: true 
                            } 
                          }
                        }} 
                      />
                      <div style={styles.videoOverlay}>点击全屏</div>
                    </div>
                  ) : (
                    <div style={{...styles.videoBox, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <span style={{fontSize: '2rem'}}>📖</span>
                    </div>
                  )}
                </div>

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
// ===== 样式定义 =====
// =================================================================================

// 生成水印SVG Data URI
const watermarkSvg = `
<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
  <text x='50%' y='50%' font-size='16' fill='rgba(0,0,0,0.04)' 
    transform='rotate(-30 100 100)' text-anchor='middle' font-family='Arial'>
    更多资源尽在 886.best
  </text>
</svg>
`.trim().replace(/\n/g, '');

const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#fff' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  
  // 修改：添加水印背景
  scrollContainer: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '20px 16px 40px',
    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(watermarkSvg)}")`,
    backgroundRepeat: 'repeat'
  },
  
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
  attentionBox: { border: '1px dashed #ef4444', borderRadius: '12px', padding: '14px', backgroundColor: 'rgba(255,255,255,0.6)' },
  chatList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  chatRow: { display: 'flex', gap: '10px' },
  chatAvatar: { width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee' },
  bubbleWrapper: { maxWidth: '85%', display: 'flex', flexDirection: 'column' },
  chatBubble: { padding: '12px', position: 'relative', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' },
  tailL: { position: 'absolute', top: '12px', left: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailR: { position: 'absolute', top: '12px', right: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  chatTranslation: { fontSize: '0.85rem', color: '#64748b', marginTop: '4px' },
  submitBtn: { width: '100%', background: '#000', color: 'white', border: 'none', padding: '14px 0', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
  
  // 表格样式
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '1px solid #e2e8f0' },
  tableRow: { borderBottom: '1px solid #e2e8f0', background: '#fff' },
  tableHeaderRow: { background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold' },
  tableCell: { padding: '8px 12px', borderRight: '1px solid #e2e8f0', textAlign: 'left' },
};

if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .active-scale:active { transform: scale(0.97); }
    video::-webkit-media-controls-enclosure { display: flex !important; }
    video::-webkit-media-controls-download-button { display: none !important; } 
    video::-internal-media-controls-download-button { display: none !important; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
