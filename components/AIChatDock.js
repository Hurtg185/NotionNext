import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaPaperPlane, FaChevronUp, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaMicrophone, FaEraser,
  FaList, FaEdit, FaTrashAlt, FaPlus, FaLightbulb, FaFeatherAlt,
  FaLanguage, FaCheck, FaStar, FaRegStar, FaThumbtack
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { pinyin } from 'pinyin-pro';
import { useAI } from './AIConfigContext';

// --- 1. 辅助组件与函数 ---

// 音效播放
const playTickSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
};

// 拼音渲染组件 (修复了正则错误)
const PinyinRenderer = ({ text, show }) => {
  const cleanText = typeof text === 'string' ? text.replace(/<[^>]+>/g, '') : text;
  if (!show || !cleanText) return <span style={{userSelect: 'text'}}>{cleanText}</span>;
  
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = cleanText.split(regex);
  return (
    <span style={{userSelect: 'text'}}>
      {parts.map((part, index) => {
        if (/[\u4e00-\u9fa5]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          const charArray = part.split('');
          return (
            <span key={index} style={{whiteSpace: 'nowrap', marginRight: '2px'}}>
              {charArray.map((char, i) => (
                <ruby key={i} style={{rubyPosition: 'over', margin: '0 1px'}}>
                  {char}
                  <rt style={{fontSize: '0.6em', color: '#64748b', fontWeight: 'normal', userSelect: 'none', fontFamily:'Arial'}}>{pyArray[i]}</rt>
                </ruby>
              ))}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

// 思考中动态效果组件
const ThinkingIndicator = () => (
  <div style={styles.thinkingIndicator}>
    <span style={{...styles.thinkingDot, animationDelay: '0s'}}></span>
    <span style={{...styles.thinkingDot, animationDelay: '0.2s'}}></span>
    <span style={{...styles.thinkingDot, animationDelay: '0.4s'}}></span>
  </div>
);

// --- 2. 外部触发解析按钮 (导出给题目组件使用) ---
export const AIExplainButton = ({ title, content }) => {
  const { isActivated, canUseAI, remainingQuota, triggerAI } = useAI();

  const handleClick = (e) => {
    e.stopPropagation();
    // 如果未激活且次数用完，进行拦截
    if (!isActivated && !canUseAI()) {
      alert(`今日免费提问次数已用完，请激活课程以获得无限次 AI 解析。`);
      return;
    }
    // 触发全局 AI 状态
    triggerAI(title, content);
  };

  return (
    <button onClick={handleClick} style={styles.explainButton}>
      <FaLightbulb /> AI 解析题目
    </button>
  );
};

// --- 3. 主组件 AIChatDock ---

export default function AIChatDock() {
  const {
    config, setConfig,
    isActivated,
    isAiOpen, setIsAiOpen,
    activeTask,
    sessions, setSessions,
    bookmarks, setBookmarks,
    currentSessionId, setCurrentSessionId,
    recordUsage, canUseAI, remainingQuota, TOTAL_FREE_QUOTA
  } = useAI();
  
  // 本地 UI 状态
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false);
  const [pinyinToggles, setPinyinToggles] = useState({});

  // 悬浮按钮位置状态
  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  
  // Refs
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });
  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const selectionTimeoutRef = useRef(null);
  const prevTaskRef = useRef(null); // 用于记录上一次的任务，避免重复触发

  // 获取当前会话的消息
  const messages = sessions.find(s => s.id === currentSessionId)?.messages || [];

  // 更新当前会话消息的帮助函数
  const updateCurrentSessionMessages = useCallback((updater) => {
    if (!currentSessionId) return;
    setSessions(prevSessions =>
      prevSessions.map(s => {
        if (s.id === currentSessionId) {
          const newMessages = typeof updater === 'function' ? updater(s.messages || []) : updater;
          // 自动更新会话标题 (如果是新对话且有用户消息)
          let newTitle = s.title;
          if (s.title === '新对话' && newMessages.length > 0) {
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if(firstUserMsg) newTitle = firstUserMsg.content.substring(0, 15).replace(/\[.*?\]/g, '');
          }
          return { ...s, messages: newMessages, title: newTitle, date: new Date().toISOString() };
        }
        return s;
      })
    );
  }, [currentSessionId, setSessions]);

  // 发送消息核心逻辑
  const handleSend = useCallback(async (textToSend = input, isSystemMessage = false) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先在设置中配置 API Key');
      setShowSettings(true);
      return;
    }
    
    // 次数限制检查
    if (!isSystemMessage && !isActivated) {
        if (!canUseAI()) {
            alert(`免费试用次数已用完 (${remainingQuota}/${TOTAL_FREE_QUOTA})，请激活课程以无限使用。`);
            return;
        }
    }

    if (!isSystemMessage) setInput('');
    setSuggestions([]);
    setLoading(true);
    
    // 中止上一次请求
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const currentUserMessage = { role: 'user', content: textToSend };
    
    // 立即在UI上显示用户消息和空的AI消息
    updateCurrentSessionMessages(prev => [...prev, currentUserMessage, { role: 'assistant', content: '' }]);

    // 构建发送给API的消息历史 (最近6条 + 当前)
    const apiMessages = [
        { role: 'system', content: config.systemPrompt },
        ...messages.slice(-6),
        currentUserMessage
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, config }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error("网络连接异常");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let soundThrottler = 0;
      
      // 流式读取回复
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.replace('data: ', ''));
                    const delta = data.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullContent += delta;
                        if (config.soundEnabled && ++soundThrottler % 3 === 0) playTickSound();
                        
                        // 更新最后一条AI消息的内容 (流式更新)
                        updateCurrentSessionMessages(prev => {
                            const newMsgs = [...prev];
                            if (newMsgs.length > 0) {
                                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: fullContent };
                            }
                            return newMsgs;
                        });
                    }
                } catch (e) {}
            }
        }
      }
      
      // 提取建议内容 (格式: [建议]: A | B)
      let finalContent = fullContent;
      if (fullContent.includes('[建议]:')) {
          const parts = fullContent.split('[建议]:');
          finalContent = parts[0].trim();
          if(parts[1]) {
              setSuggestions(parts[1].split('|').map(s => s.trim()).filter(Boolean));
          }
      }

      // 更新最终消息内容（去除建议部分）
      updateCurrentSessionMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0) {
              newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: finalContent };
          }
          return newMsgs;
      });

      // 扣除次数并自动朗读
      if (!isSystemMessage) recordUsage();
      if (config.autoTTS) playInternalTTS(finalContent);

    } catch (err) {
      if (err.name !== 'AbortError') {
          updateCurrentSessionMessages(prev => {
              const newMsgs = [...prev];
              if (newMsgs.length > 0) {
                  newMsgs[newMsgs.length - 1] = { role: 'assistant', content: `[系统]: 生成中断 (${err.message})` };
              }
              return newMsgs;
          });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, config, loading, input, updateCurrentSessionMessages, isActivated, canUseAI, remainingQuota, TOTAL_FREE_QUOTA, recordUsage]);

  // 监听任务变化，自动触发解析
  useEffect(() => {
    if (activeTask && activeTask.timestamp && activeTask.timestamp !== prevTaskRef.current) {
        prevTaskRef.current = activeTask.timestamp;
        const contextMsg = `[系统注：用户正在学习新内容: ${activeTask.title}]\n请围绕这个主题进行解析。`;
        handleSend(contextMsg, true); 
    }
  }, [activeTask, handleSend]);

  // 自动滚动到底部
  useEffect(() => {
    if (historyRef.current && isAiOpen) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiOpen, loading]);

  // TTS 朗读函数
  const playInternalTTS = async (text) => {
    if (typeof window === 'undefined') return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(true);
    const clean = text.replace(/[*#`>~\-\[\]]/g, '');
    const rate = Math.round((config.ttsSpeed - 1) * 100);
    const url = `/api/tts?t=${encodeURIComponent(clean)}&v=${config.ttsVoice}&r=${rate}%`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (e) { setIsPlaying(false); }
  };

  // 语音识别函数
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("当前浏览器不支持语音识别"); return; }
    
    const rec = new SpeechRecognition();
    rec.lang = config.sttLang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      if (config.autoSendStt) handleSend(transcript);
    };
    recognitionRef.current = rec;
    rec.start();
  };

  // 划词菜单逻辑
  useEffect(() => {
    const handleMouseUp = (e) => {
        if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
            const text = selection.toString().trim();
            
            // 排除输入框内的选词
            if (text.length > 0 && isAiOpen && !e.target.matches('textarea, input')) {
                e.preventDefault(); // 阻止浏览器默认菜单
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSelectionMenu({ show: true, x: rect.left + rect.width / 2, y: rect.top - 60, text: text });
                setIsCopied(false);
            }
        }, 100);
    };
    const handleOutsideClick = (e) => {
      const menu = document.getElementById('selection-popover');
      if (menu && !menu.contains(e.target)) setSelectionMenu(prev => ({ ...prev, show: false }));
    };
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchend', handleMouseUp);
        document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAiOpen]);

  const handleTranslateSelection = () => {
      if (!selectionMenu.text) return;
      handleSend(`请详细解释并翻译这段文字：\n"${selectionMenu.text}"`);
      setSelectionMenu(prev => ({...prev, show: false}));
      window.getSelection().removeAllRanges();
  };

  // 拖动逻辑
  const handleTouchStart = (e) => {
    draggingRef.current = false;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartPos.current = { x: clientX, y: clientY };
    btnStartPos.current = { ...btnPos };
  };

  const handleTouchMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = dragStartPos.current.x - clientX;
    const dy = dragStartPos.current.y - clientY;
    // 反向移动逻辑
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        draggingRef.current = true;
        setBtnPos({ right: btnStartPos.current.right + dx, bottom: btnStartPos.current.bottom + dy });
    }
  };

  const handleTouchEnd = () => {
    if (!draggingRef.current) {
        setIsAiOpen(true);
    }
    draggingRef.current = false;
  };

  // 会话管理
  const createNewSession = () => {
      const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString(), pinned: false };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setShowSidebar(false);
  };
  const switchSession = (id) => { setCurrentSessionId(id); setShowSidebar(false); };
  const deleteSession = (e, id) => {
      e.stopPropagation();
      if(sessions.length <= 1) return;
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === currentSessionId) setCurrentSessionId(sessions.filter(s => s.id !== id)[0].id);
  };
  const renameSession = (e, id) => {
      e.stopPropagation();
      const newTitle = prompt("请输入新标题");
      if(newTitle) setSessions(prev => prev.map(s => s.id === id ? {...s, title: newTitle} : s));
  };
  const togglePinSession = (e, id) => {
      e.stopPropagation();
      setSessions(prev => prev.map(s => s.id === id ? {...s, pinned: !s.pinned} : s));
  };
  const deleteMessage = (index) => {
      if (confirm('确定删除这条消息吗？')) {
          updateCurrentSessionMessages(messages.filter((_, i) => i !== index));
      }
  };
  const toggleBookmark = (message) => {
    const isBookmarked = bookmarks.some(b => b.content === message.content);
    if (isBookmarked) setBookmarks(prev => prev.filter(b => b.content !== message.content));
    else setBookmarks(prev => [...prev, {id: Date.now(), ...message}]);
  };
  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => { setSelectionMenu(prev => ({...prev, show: false})); setIsCopied(false); }, 800);
  };

  const pinnedSessions = sessions.filter(s => s.pinned);
  const historySessions = sessions.filter(s => !s.pinned);

  // --- 界面渲染 ---

  return (
    <>
      {/* 划词菜单 */}
      {selectionMenu.show && (
          <div id="selection-popover" style={{...styles.popover, left: selectionMenu.x, top: selectionMenu.y}}>
              <button onClick={handleTranslateSelection} style={styles.popBtn}><FaLanguage size={14}/> 解释</button>
              <div style={styles.popDivider}></div>
              <button onClick={() => playInternalTTS(selectionMenu.text)} style={styles.popBtn}><FaVolumeUp size={14}/> 朗读</button>
              <div style={styles.popDivider}></div>
              <button onClick={() => copyText(selectionMenu.text)} style={styles.popBtn}>
                  {isCopied ? <><FaCheck size={14} color="#4ade80"/> 已复制</> : <><FaCopy size={14}/> 复制</>}
              </button>
              <div style={styles.popArrow}></div>
          </div>
      )}

      {/* 悬浮球 */}
      {!isAiOpen && (
        <div 
            style={{...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom}}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart} onMouseMove={(e) => draggingRef.current && handleTouchMove(e)} onMouseUp={handleTouchEnd}
        >
            <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {/* 主界面 */}
      {isAiOpen && (
        <>
            {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
            
            {/* 侧边栏 */}
            <div style={{...styles.sidebar, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)'}}>
                <div style={styles.sidebarHeader}>
                    <h3 style={{fontSize:'1.1rem', margin:0, fontWeight:'bold', color:'#334155'}}>会话管理</h3>
                    <button onClick={createNewSession} style={styles.newChatBtn}><FaPlus size={12}/> 新对话</button>
                </div>
                <div style={styles.sessionList}>
                    {bookmarks.length > 0 && (
                        <div style={styles.sessionGroup}>
                            <h4 style={styles.groupTitle}>收藏夹</h4>
                            {bookmarks.map((bm, idx) => (
                                <div key={`bm-${idx}`} style={styles.bookmarkItem}>
                                    <p style={{margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{bm.content.substring(0, 50)}</p>
                                    <button onClick={() => toggleBookmark(bm)} style={styles.bookmarkActionBtn}><FaTrashAlt/></button>
                                </div>
                            ))}
                        </div>
                    )}
                    {pinnedSessions.length > 0 && (
                        <div style={styles.sessionGroup}>
                            <h4 style={styles.groupTitle}>置顶</h4>
                            {pinnedSessions.map(s => (
                                <div key={s.id} onClick={() => switchSession(s.id)} style={{...styles.sessionItem, background: currentSessionId === s.id ? '#eff6ff' : 'transparent'}}>
                                    <div style={styles.sessionTitle}>{s.title}</div>
                                    <div style={styles.sessionActions}>
                                        <button onClick={(e) => togglePinSession(e, s.id)} style={styles.sessionActionBtn}><FaThumbtack color="#4f46e5"/></button>
                                        <button onClick={(e)=>renameSession(e, s.id)} style={styles.sessionActionBtn}><FaEdit/></button>
                                        <button onClick={(e)=>deleteSession(e, s.id)} style={{...styles.sessionActionBtn, color:'#ef4444'}}><FaTrashAlt/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={styles.sessionGroup}>
                        <h4 style={styles.groupTitle}>历史会话</h4>
                        {historySessions.map(s => (
                            <div key={s.id} onClick={() => switchSession(s.id)} style={{...styles.sessionItem, background: currentSessionId === s.id ? '#eff6ff' : 'transparent'}}>
                                <div style={styles.sessionTitle}>{s.title}</div>
                                <div style={styles.sessionActions}>
                                    <button onClick={(e) => togglePinSession(e, s.id)} style={styles.sessionActionBtn}><FaThumbtack/></button>
                                    <button onClick={(e)=>renameSession(e, s.id)} style={styles.sessionActionBtn}><FaEdit/></button>
                                    <button onClick={(e)=>deleteSession(e, s.id)} style={{...styles.sessionActionBtn, color:'#ef4444'}}><FaTrashAlt/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 聊天窗口 */}
            <div style={styles.chatWindow}>
                <div style={styles.header}>
                    <button onClick={() => setShowSidebar(true)} style={styles.headerIconBtn}><FaList size={16}/></button>
                    <div style={{fontWeight:'bold', color:'#334155'}}>AI 助教</div>
                    <div style={{display:'flex', gap:8}}>
                        <button onClick={() => setShowSettings(true)} style={styles.headerIconBtn}><FaCog size={16}/></button>
                        <button onClick={() => setIsAiOpen(false)} style={styles.headerIconBtn}><FaChevronUp size={16}/></button>
                    </div>
                </div>

                <div ref={historyRef} style={styles.messageArea}>
                    {messages.map((m, i) => {
                        // **卡顿优化**：如果是正在生成的最后一条消息(loading态)，强制关闭拼音，只显示纯文本
                        const isStreaming = loading && i === messages.length - 1;
                        const showPinyinForThisMessage = !isStreaming && (pinyinToggles[i] ?? config.showPinyin);
                        
                        const markdownComponents = {
                            strong: ({children}) => <strong style={styles.strong}><PinyinRenderer text={Array.isArray(children) ? children.join('') : children} show={showPinyinForThisMessage}/></strong>,
                            p: ({children}) => <p style={styles.p}>{React.Children.map(children, c => <PinyinRenderer text={c ? c.toString() : ''} show={showPinyinForThisMessage}/>)}</p>,
                            li: ({children}) => <li style={styles.li}>{React.Children.map(children, c => <PinyinRenderer text={c ? c.toString() : ''} show={showPinyinForThisMessage}/>)}</li>,
                            td: ({children}) => <td style={styles.td}>{React.Children.map(children, c => <PinyinRenderer text={c ? c.toString() : ''} show={showPinyinForThisMessage}/>)}</td>,
                            h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
                            h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
                            table: ({children}) => <div style={{overflowX:'auto'}}><table style={styles.table}>{children}</table></div>,
                            th: ({children}) => <th style={styles.th}>{children}</th>,
                        };

                        const isBookmarked = m.role === 'assistant' && bookmarks.some(b => b.content === m.content);

                        return (
                            <div key={i} style={{...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                                <div style={{...styles.bubbleWrapper, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                                    <div style={{...styles.bubble, background: m.role === 'user' ? '#f1f5f9' : 'transparent', border: m.role === 'assistant' ? 'none' : '1px solid #f1f5f9'}}>
                                        {m.role === 'user' ? (
                                            <div style={{color:'#1e293b'}}>{m.content}</div>
                                        ) : (
                                            (m.content === '' && loading) 
                                            ? <ThinkingIndicator/>
                                            : <div className="notion-md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{m.content}</ReactMarkdown></div>
                                        )}
                                    </div>
                                    <div style={styles.msgActionBar}>
                                        {m.role === 'assistant' && m.content && !loading && (
                                            <>
                                                <button onClick={() => playInternalTTS(m.content)} style={styles.msgActionBtn} title="朗读"><FaVolumeUp/></button>
                                                <button onClick={() => copyText(m.content)} style={styles.msgActionBtn} title="复制"><FaCopy/></button>
                                                <button onClick={() => toggleBookmark(m)} style={{...styles.msgActionBtn, color: isBookmarked ? '#f59e0b' : 'inherit'}} title="收藏">
                                                    {isBookmarked ? <FaStar/> : <FaRegStar/>}
                                                </button>
                                                <button onClick={() => setPinyinToggles(prev => ({ ...prev, [i]: !(prev[i] ?? config.showPinyin) }))} style={{...styles.msgActionBtn, fontSize: '0.75rem', border:'1px solid #e2e8f0', borderRadius:'4px', padding:'0 4px'}}>
                                                    {(pinyinToggles[i] ?? config.showPinyin) ? '文' : '拼'}
                                                </button>
                                            </>
                                        )}
                                        {m.role === 'user' && !m.content.startsWith('[系统注') && (
                                            <button onClick={() => deleteMessage(i)} style={{...styles.msgActionBtn, color:'#ef4444'}} title="删除"><FaTrashAlt/></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div style={styles.footer}>
                    {!loading && suggestions.length > 0 && (
                        <div style={styles.scrollSuggestionContainer}>
                            {suggestions.map((s, idx) => (
                                <button key={idx} onClick={() => handleSend(s)} style={styles.scrollSuggestionBtn}>
                                    <FaLightbulb color="#eab308" size={10} style={{marginRight:4}}/>{s}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <div style={styles.inputContainer}>
                        {isPlaying && <div style={styles.ttsBar} onClick={() => audioRef.current?.pause()}><FaVolumeUp/> 正在朗读... <FaStop/></div>}
                        <div style={styles.inputBox}>
                            <textarea 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                                placeholder={isListening ? "正在聆听..." : "输入问题..."}
                                style={styles.textarea}
                                rows={1}
                            />
                            {input.trim().length > 0 ? (
                                <button onClick={() => handleSend()} disabled={loading} style={styles.sendBtn}><FaPaperPlane/></button>
                            ) : (
                                <button onClick={toggleListening} style={{...styles.micBtn, background: isListening ? '#ef4444' : 'transparent'}}>
                                    <FaMicrophone color={isListening ? '#fff' : '#94a3b8'} className={isListening ? 'animate-pulse' : ''}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 关闭区域 */}
            <div style={styles.closeArea} onClick={() => setIsAiOpen(false)}>
                <FaChevronUp color="rgba(255,255,255,0.8)" size={14} />
            </div>
        </>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div style={styles.settingsOverlay} onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
            <div style={styles.settingsModal} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}><h3>AI 设置</h3><button onClick={()=>setShowSettings(false)} style={styles.closeBtn}><FaTimes/></button></div>
                <div style={styles.modalBody}>
                    {!isActivated && <div style={{...styles.settingRow, background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', color: '#d97706', fontSize: '0.8rem', marginBottom: '12px'}}>
                        <span>免费额度剩余: {remainingQuota} / {TOTAL_FREE_QUOTA} 次</span>
                    </div>}
                    <label style={styles.settingRow}><span>API Key</span><input type="password" value={config.apiKey} onChange={e=>setConfig({...config, apiKey:e.target.value})} style={styles.input}/></label>
                    <div style={styles.switchRow}><span>全局显示拼音</span><input type="checkbox" checked={config.showPinyin} onChange={e=>setConfig({...config, showPinyin:e.target.checked})}/></div>
                    <div style={styles.switchRow}><span>打字音效</span><input type="checkbox" checked={config.soundEnabled} onChange={e=>setConfig({...config, soundEnabled:e.target.checked})}/></div>
                    <label style={styles.settingRow}><span>语音朗读语速 ({config.ttsSpeed}x)</span><input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e=>setConfig({...config, ttsSpeed:parseFloat(e.target.value)})}/></label>
                    <button onClick={()=>setShowSettings(false)} style={styles.saveBtn}>保存并关闭</button>
                </div>
            </div>
        </div>
      )}

      {/* 动画与Markdown样式 */}
      <style jsx global>{`
        @keyframes pulse { 0%, 100% {transform:scale(1);} 50% {transform:scale(1.1);} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, sans-serif; color: #333; line-height: 1.8; }
        .notion-md table { border-collapse: collapse; margin: 10px 0; width: 100%; font-size: 0.9em; }
        .notion-md th, .notion-md td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        .notion-md li { margin-bottom: 4px; }
        @keyframes thinking-dot { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1.0); opacity: 1; } }
      `}</style>
    </>
  );
}

const styles = {
  floatingBtn: { position: 'fixed', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'grab', touchAction: 'none' },
  chatWindow: { position: 'fixed', top: 0, left: 0, width: '100%', height: '85%', background: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, display: 'flex', flexDirection: 'column', zIndex: 10000, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' },
  header: { height: 44, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between', flexShrink: 0 },
  headerIconBtn: { background:'none', border:'none', color:'#64748b', padding:8, cursor:'pointer' },
  messageArea: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  messageRow: { display: 'flex', marginBottom: 24, flexDirection: 'column' },
  bubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '100%' },
  bubble: { fontSize: '0.96rem', padding: '10px 14px', borderRadius: '12px' },
  msgActionBar: { display: 'flex', gap: 12, marginTop: 8, opacity: 0.8, alignItems: 'center', flexWrap: 'wrap' },
  msgActionBtn: { background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:'2px', fontSize:'0.9rem', display: 'flex', alignItems: 'center' },
  thinkingIndicator: { background: '#f1f5f9', borderRadius: '12px', padding: '12px 16px', display: 'inline-flex', gap: '5px', alignItems:'center' },
  thinkingDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8', animation: 'thinking-dot 1.4s infinite ease-in-out both' },
  h1: { fontSize: '1.4em', fontWeight: 700, margin: '1em 0 0.5em 0' },
  h2: { fontSize: '1.2em', fontWeight: 600, margin: '0.8em 0 0.4em 0', borderBottom:'1px solid #f1f5f9', paddingBottom:4 },
  p: { margin: '0 0 8px 0' },
  strong: { fontWeight: 700, color: '#000' },
  ul: { paddingLeft: '1.2em' }, 
  li: { marginBottom: '4px' },
  table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: '0.9em' },
  th: { border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f8fafc', fontWeight: '600', textAlign: 'left' },
  td: { border: '1px solid #e2e8f0', padding: '6px 10px', verticalAlign: 'top' },
  footer: { background: '#fff', borderTop: '1px solid #f1f5f9', paddingBottom: 10 },
  scrollSuggestionContainer: { display: 'flex', gap: 8, padding: '10px 16px 0 16px', overflowX: 'auto', scrollbarWidth: 'none' },
  scrollSuggestionBtn: { flexShrink: 0, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '6px 12px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', display:'flex', alignItems:'center', gap: 4 },
  inputContainer: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  ttsBar: { background:'#eff6ff', color:'#2563eb', fontSize:'0.75rem', padding:'4px 10px', borderRadius:4, display:'flex', alignItems:'center', gap:8, cursor:'pointer', alignSelf:'flex-start' },
  inputBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 24, padding: '4px 6px 4px 16px' },
  textarea: { flex: 1, border: 'none', background: 'transparent', resize: 'none', fontSize: '1rem', outline: 'none', height: '24px', lineHeight: '24px', paddingTop: 6, paddingBottom: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: '50%', background: '#4f46e5', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  micBtn: { width: 32, height: 32, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '75%', maxWidth: 280, height: '85%', background: '#fff', borderRight: '1px solid #e2e8f0', zIndex: 10002, transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column' },
  sidebarOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:10001 },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' },
  newChatBtn: { background:'#fff', border:'1px solid #cbd5e1', borderRadius:6, padding:'4px 8px', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:4, cursor:'pointer' },
  sessionList: { flex: 1, overflowY: 'auto', padding: '8px' },
  sessionGroup: { marginBottom: '16px' },
  groupTitle: { fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', padding: '0 8px 4px 8px', margin: 0 },
  sessionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderRadius: 6, cursor: 'pointer', '&:hover': { background: '#f1f5f9' } },
  sessionTitle: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' },
  sessionActions: { display: 'flex', gap: 4 },
  sessionActionBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' },
  bookmarkItem: { background: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: '0.85rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bookmarkActionBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' },
  closeArea: { position: 'fixed', bottom: 0, left: 0, width: '100%', height: '15%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  popover: { position: 'fixed', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 11000, color: '#fff' },
  popArrow: { position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' },
  popBtn: { background:'transparent', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.85rem' },
  popDivider: { width: 1, height: 16, background: 'rgba(255,255,255,0.3)' },
  settingsOverlay: { position:'fixed', inset:0, zIndex:12000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' },
  settingsModal: { width: '85%', maxWidth: 340, background: '#fff', borderRadius: 16, overflow:'hidden' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' },
  closeBtn: { background:'none', border:'none', fontSize:'1.2rem', color:'#64748b', cursor:'pointer' },
  modalBody: { padding: 20, display:'flex', flexDirection:'column', gap: 16 },
  settingRow: { display:'flex', flexDirection:'column', gap:6, fontSize:'0.9rem', color:'#475569' },
  switchRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.9rem' },
  input: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' },
  select: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', background:'#fff' },
  saveBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', marginTop: 10, cursor:'pointer' },
  explainButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '22px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px', fontSize:'0.9rem' }
};
