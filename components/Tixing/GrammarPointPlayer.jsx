import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from '@react-spring/web';
import { pinyin } from 'pinyin-pro';
import ReactPlayer from 'react-player';
import {
  FaPause, FaPlay, FaChevronRight, FaVolumeUp, 
  FaExclamationTriangle, FaBookReader, FaCopy, FaLanguage
} from 'react-icons/fa';
import { useAI } from '../AIConfigContext';

// =================================================================================
// ===== 0. 音效工具 (UI 交互反馈) =====
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
// ===== 1. 健壮的 TTS Hook (增强文字清洗：剔除拼音、标点、表情) =====
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

    // ✅ 深度净化文本：彻底去除拼音(字母)、标点符号、表情符号
    const cleanText = String(text)
      // 1. 去除 Markdown 和 HTML 标签
      .replace(/\*\*|~~|\{\{|\}\}|###/g, '')
      .replace(/<[^>]+>/g, '')
      // 2. 去除所有英文字母 (防止抓取到 ruby 里的拼音)
      .replace(/[a-zA-Z]/g, '')
      // 3. 去除拼音专用的声调符号 (āáǎà 等)
      .replace(/[\u0100-\u017F\u0180-\u024F]/g, '')
      // 4. 去除 Emoji 表情
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // 5. 去除中英文标点符号
      .replace(/[.,!?;:，。！？；：、""''（）()[\]{}|_\\/<>@#$%^&*+=\-~`]/g, ' ')
      // 6. 去除多余空格
      .replace(/\s+/g, '')
      .trim();

    if (!cleanText) {
      setPlayerState({ isPlaying: false, activeId: null, loadingId: null });
      return;
    }

    // 缅甸语判定逻辑保持
    const targetVoice = voiceOverride || (/[\u1000-\u109F]/.test(text) ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural');

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
// ===== 2. 文本渲染组件 (拼音 + 排版样式) =====
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
        lineHeight: '2.4', 
        wordBreak: 'break-word', 
        color: color,
        fontWeight: bold ? '700' : '400', 
        fontSize: '1.1rem', 
        cursor: onClick ? 'pointer' : 'default',
        textDecoration: strikethrough ? 'line-through' : 'none',
        textDecorationColor: color === '#ff0000' ? '#ff0000' : '#ef4444', 
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

// 正文渲染：不传递 onClick 回调，禁用正文点击朗读
const RichTextRenderer = ({ content }) => {
  if (!content) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {content.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;

        const isHeader = /三个核心句型|两种其他用法|总结/.test(trimmed);
        const isErrorLine = trimmed.startsWith('错误：');

        if (trimmed.startsWith('###')) {
          return <h3 key={idx} style={styles.h3}>{trimmed.replace(/###\s?/, '')}</h3>;
        }

        return (
          <div key={idx} style={styles.textRow}>
            {trimmed.split(/(\*\*.*?\*\*|~~.*?~~|\{\{.*?\}\})/g).map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#0000ff' }}>▪️</span>
                    {/* onClick 为空 */}
                    <PinyinText text={part.slice(2, -2)} color="#0000ff" bold={true} />
                  </span>
                );
              } 
              if (part.startsWith('~~') && part.endsWith('~~')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} color="#ff0000" strikethrough={true} />;
              }
              if (part.startsWith('{{') && part.endsWith('}}')) {
                return <PinyinText key={pIdx} text={part.slice(2, -2)} color="#eab308" bold={true} />;
              }
              
              let displayColor = "#000000";
              let hasStrikethrough = false;
              let isBoldText = isHeader;
              
              if (isErrorLine) {
                  displayColor = "#ff0000";
                  if (pIdx > 0 || !trimmed.startsWith(part)) {
                      hasStrikethrough = true;
                  } else {
                      isBoldText = true;
                  }
              }

              return (
                <PinyinText 
                  key={pIdx} 
                  text={part} 
                  color={displayColor}
                  bold={isBoldText}
                  strikethrough={hasStrikethrough}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 3. 主组件 GrammarPointPlayer =====
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, level = "HSK 1", onComplete, onAskAI }) => {
  const { updatePageContext } = useAI();
  const playerContainerRef = useRef(null);
  
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef(null);

  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, text: '' });
  const menuRef = useRef(null);

  const { play, stop, activeId } = useRobustTTS();

  const normalizedPoints = useMemo(() => {
    if (!Array.isArray(grammarPoints)) return [];
    return grammarPoints.map((item, idx) => ({
      id: item.id || idx,
      title: item['语法标题'] || '',
      pattern: item['句型结构'] || '',
      videoUrl: item['视频链接'] || '',
      coverUrl: item['视频封面'] || true,
      explanationRaw: item['语法详解'] || '',
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
    if (currentPoint) {
      updatePageContext(`等级:${level} | 标题:${currentPoint.title} | 内容概览:${currentPoint.explanationRaw.slice(0, 100)}`);
    }
  }, [currentPoint, level, updatePageContext]);

  useEffect(() => {
    stop();
    setMenu({ ...menu, visible: false }); 
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentIndex, stop]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menu.visible && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('touchstart', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menu.visible]);

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

  // ----- 菜单核心逻辑 -----
  const handleContextMenu = (e) => {
    e.preventDefault(); 
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      setMenu({ visible: true, x: e.clientX, y: e.clientY, text: text });
    }
  };

  const handleSelectionEnd = (e) => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (!text || (menuRef.current && menuRef.current.contains(e.target))) return;

      if (text.length > 0) {
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          let top = rect.top - 50; 
          let left = rect.left + (rect.width / 2);
          if (left < 50) left = 50;
          if (left > window.innerWidth - 50) left = window.innerWidth - 50;
          if (top < 10) top = rect.bottom + 10;
          setMenu({ visible: true, x: left, y: top, text: text });
        } catch (err) {}
      }
    }, 150);
  };

  const handleMenuAction = (action) => {
    const text = menu.text;
    if (!text) return;
    switch (action) {
      case 'read':
        // ✅ 自由选词朗读：play 函数内部会自动清洗拼音
        play(text, 'selection_read');
        break;
      case 'copy':
        navigator.clipboard.writeText(text);
        break;
      case 'explain':
        updatePageContext(`用户正在查询: "${text}"。请解释这个词/句子的含义、语法点和用法。`);
        if (onAskAI) onAskAI(`解释一下：${text}`);
        break;
      default:
        break;
    }
    setMenu(prev => ({ ...prev, visible: false }));
  };


  if (!currentPoint) return null;

  return (
    <div style={styles.container}>
      {transitions((style, i) => {
        const gp = normalizedPoints[i];
        return (
          <animated.div style={{ ...styles.page, ...style }}>
            <div 
              style={styles.scrollContainer} 
              ref={contentRef}
              onContextMenu={handleContextMenu}
              onMouseUp={handleSelectionEnd}
              onTouchEnd={handleSelectionEnd}
            >
              <div style={styles.contentWrapper}>
                
                <h2 style={styles.title}>{gp.title}</h2>

                {/* 核心句型卡片 (✅ 已去除点击播放) */}
                <div style={styles.headerRow}>
                  <div style={styles.patternCard}>
                    <div style={styles.cardLabel}><FaBookReader /> 核心句型</div>
                    <div style={styles.patternText}>
                      <PinyinText text={gp.pattern} color="#1e40af" bold />
                    </div>
                  </div>

                  {gp.videoUrl && (
                    <div 
                      style={styles.videoBox} 
                      ref={playerContainerRef} 
                      onClick={handleVideoFullScreen}
                    >
                      <ReactPlayer 
                        url={gp.videoUrl} 
                        width="100%" 
                        height="100%" 
                        playing={isVideoPlaying}
                        light={gp.coverUrl} 
                        config={{ file: { attributes: { controlsList: 'nodownload' }}}} 
                      />
                      <div style={styles.videoOverlay}>点击全屏</div>
                    </div>
                  )}
                </div>

                {/* 语法详解 (✅ 已去除点击播放) */}
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>📝 语法详解</div>
                  <div style={styles.textBody}>
                    <RichTextRenderer content={gp.explanationRaw} />
                  </div>
                </div>

                {/* 注意事项模块 (✅ 已去除点击播放) */}
                {gp.attention && (
                  <div style={styles.section}>
                    <div style={{...styles.sectionHeader, color: '#ef4444'}}>
                      <FaExclamationTriangle /> 注意事项
                    </div>
                    <div style={styles.attentionBox}>
                       <RichTextRenderer content={gp.attention} />
                    </div>
                  </div>
                )}

                {/* 对话模块 (✅ 唯一保留的点击播放入口) */}
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

              {/* ----- 自定义选词菜单 ----- */}
              {menu.visible && (
                <div 
                  ref={menuRef}
                  style={{
                    ...styles.customMenu,
                    top: menu.y,
                    left: menu.x,
                    position: 'fixed' 
                  }}
                  onMouseDown={(e) => e.stopPropagation()} 
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <div style={styles.menuItem} onClick={() => handleMenuAction('read')}>
                    <FaVolumeUp size={14} /> 朗读
                  </div>
                  <div style={styles.menuDivider} />
                  <div style={styles.menuItem} onClick={() => handleMenuAction('copy')}>
                    <FaCopy size={14} /> 复制
                  </div>
                  <div style={styles.menuDivider} />
                  <div style={styles.menuItem} onClick={() => handleMenuAction('explain')}>
                    <FaLanguage size={14} /> 解释
                  </div>
                </div>
              )}

            </div>
          </animated.div>
        );
      })}
    </div>
  );
};

// =================================================================================
// ===== 5. 样式定义 (CSS-in-JS) =====
// =================================================================================
const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#fff' },
  page: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'white' },
  scrollContainer: { flex: 1, overflowY: 'auto', padding: '20px 16px 40px', userSelect: 'text', WebkitUserSelect: 'text' },
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
  attentionBox: { border: '1px dashed #ef4444', borderRadius: '12px', padding: '14px' },
  chatList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  chatRow: { display: 'flex', gap: '10px' },
  chatAvatar: { width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee' },
  bubbleWrapper: { maxWidth: '85%', display: 'flex', flexDirection: 'column' },
  chatBubble: { padding: '12px', position: 'relative', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' },
  tailL: { position: 'absolute', top: '12px', left: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #fff1f2' },
  tailR: { position: 'absolute', top: '12px', right: '-5px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #eff6ff' },
  chatTranslation: { fontSize: '0.85rem', color: '#64748b', marginTop: '4px' },
  submitBtn: { width: '100%', background: '#000', color: 'white', border: 'none', padding: '14px 0', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
  customMenu: { background: '#333', color: '#fff', borderRadius: '8px', padding: '4px 0', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999, fontSize: '13px', transform: 'translate(-50%, -120%)', whiteSpace: 'nowrap', pointerEvents: 'auto' },
  menuItem: { padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s', userSelect: 'none' },
  menuDivider: { width: '1px', height: '16px', background: '#555' }
};

if (typeof document !== 'undefined' && !document.getElementById('gp-player-style')) {
  const style = document.createElement('style');
  style.id = 'gp-player-style';
  style.innerHTML = `
    .active-scale:active { transform: scale(0.97); }
    video::-webkit-media-controls-enclosure { display: flex !important; }
    * { -webkit-tap-highlight-color: transparent; }
  `;
  document.head.appendChild(style);
}

export default GrammarPointPlayer;
