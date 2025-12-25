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
import { useAI } from './AIConfigContext'; // 步骤 1: 导入 useAI Hook

// --- 简易音效引擎 ---
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
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
};

// --- 拼音组件 (已修复) ---
const PinyinRenderer = ({ text, show }) => {
  const cleanText = typeof text === 'string' ? text.replace(/<[^>]+>/g, '') : text;
  
  if (!show || !cleanText) return cleanText;
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
                  <rt style={{fontSize: '0.6em', color: '#64748b', fontWeight: 'normal', userSelect: 'none', fontFamily:'Arial'}}>
                    {pyArray[i]}
                  </rt>
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

export default function AIChatDock() {
  const {
    config, setConfig,
    isActivated,
    isAiOpen, setIsAiOpen,
    activeTask,
    sessions, setSessions,
    bookmarks, setBookmarks,
    currentSessionId, setCurrentSessionId
  } = useAI();
  
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

  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);

  // **关键修复**：从 sessions 中正确派生消息状态，而不是创建新的 state
  const messages = sessions.find(s => s.id === currentSessionId)?.messages || [];

  // **关键修复**：创建一个稳定的函数来更新全局 sessions 状态
  const updateCurrentSessionMessages = useCallback((newMessages) => {
    if (!currentSessionId) return;
    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === currentSessionId ? { ...s, messages: newMessages } : s
      )
    );
  }, [currentSessionId, setSessions]);
  
  const handleSend = useCallback(async (textToSend = input, isSystemMessage = false) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先在设置中配置 API Key');
      setShowSettings(true);
      return;
    }

    setInput('');
    setSuggestions([]);
    setLoading(true);
    
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const currentUserMessage = { role: 'user', content: textToSend };
    // 立即更新UI，显示用户消息和加载中的AI消息
    const initialMessages = [...messages, currentUserMessage, { role: 'assistant', content: '' }];
    updateCurrentSessionMessages(initialMessages);

    const apiMessages = [
        { role: 'system', content: config.systemPrompt },
        ...initialMessages.slice(-7, -1).map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          config: { apiKey: config.apiKey, modelId: config.modelId }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error("网络连接异常");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let soundThrottler = 0;

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
                        
                        // 在流式传输中，只更新最后一条消息
                        const streamingMessages = [...messages, currentUserMessage, { role: 'assistant', content: fullContent }];
                        updateCurrentSessionMessages(streamingMessages);
                    }
                } catch (e) {}
            }
        }
      }
      
      let finalContent = fullContent;
      if (fullContent.includes('[建议]:')) {
          const parts = fullContent.split('[建议]:');
          finalContent = parts[0].trim();
          if(parts[1]) {
              setSuggestions(parts[1].split('|').map(s => s.trim()).filter(Boolean));
          }
      }

      // 最终确认消息
      const finalMessages = [...messages, currentUserMessage, { role: 'assistant', content: finalContent }];
      updateCurrentSessionMessages(finalMessages);

      if (config.autoTTS) playInternalTTS(finalContent);

    } catch (err) {
      if (err.name !== 'AbortError') {
          const errorMessages = [...messages, currentUserMessage, { role: 'assistant', content: `\n\n[系统]: 生成中断 (${err.message})` }];
          updateCurrentSessionMessages(errorMessages);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, currentSessionId, config, loading, input, updateCurrentSessionMessages]);

  useEffect(() => {
    if (activeTask && activeTask.timestamp) {
        const contextMsg = `[系统注：用户正在学习新内容: ${activeTask.title}]\n请围绕这个主题进行解析。`;
        handleSend(contextMsg, true); 
    }
  }, [activeTask]);


  useEffect(() => {
    if (historyRef.current && isAiOpen) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiOpen, loading]);
  
  useEffect(() => {
    const handleSelectionChange = () => {
     if (window.selectionTimeout) clearTimeout(window.selectionTimeout);
     window.selectionTimeout = setTimeout(() => {
         const selection = window.getSelection();
         if (!selection || selection.rangeCount === 0) return;
         const text = selection.toString().trim();
         if (text.length > 0 && isAiOpen) { 
             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             let top = rect.top - 50;
             let left = rect.left + rect.width / 2;
             if (top < 10) top = rect.bottom + 10;
             setSelectionMenu({ show: true, x: left, y: top, text: text });
             setIsCopied(false);
         } 
     }, 200);
    };

    const handleOutsideClick = (e) => {
      const menu = document.getElementById('selection-popover');
      if (menu && !menu.contains(e.target)) {
          setSelectionMenu(prev => ({ ...prev, show: false }));
      }
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAiOpen]);

  const handleTranslateSelection = () => {
      if (!selectionMenu.text) return;
      handleSend(`请详细解释并翻译这段文字：\n"${selectionMenu.text}"`);
      setSelectionMenu(prev => ({...prev, show: false}));
      window.getSelection().removeAllRanges();
  };

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

  const createNewSession = () => {
      const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString(), pinned: false };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      setShowSidebar(false);
  };

  const switchSession = (id) => {
      setCurrentSessionId(id);
      setShowSidebar(false);
  };

  const deleteSession = (e, id) => {
      e.stopPropagation();
      if(sessions.length <= 1) return;
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      if (id === currentSessionId) {
          setCurrentSessionId(newSessions[0].id);
      }
  };
  
  const renameSession = (e, id) => {
      e.stopPropagation();
      const newTitle = prompt("请输入新标题");
      if(newTitle) {
          setSessions(sessions.map(s => s.id === id ? {...s, title: newTitle} : s));
      }
  };
  
  const togglePinSession = (e, id) => {
      e.stopPropagation();
      setSessions(sessions.map(s => s.id === id ? {...s, pinned: !s.pinned} : s));
  };

  const deleteMessage = (index) => {
      if (confirm('确定删除这条消息吗？')) {
          updateCurrentSessionMessages(messages.filter((_, i) => i !== index));
      }
  };

  const toggleBookmark = (message) => {
    const isBookmarked = bookmarks.some(b => b.content === message.content && b.role === message.role);
    if (isBookmarked) {
        setBookmarks(bookmarks.filter(b => b.content !== message.content));
    } else {
        setBookmarks([...bookmarks, message]);
    }
  };

  const toggleListening = () => {
    if (isListening) {
        if (recognitionRef.current) recognitionRef.current.stop();
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("抱歉，您的浏览器不支持语音识别功能。");
        return;
    }
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = config.sttLang;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => { setIsListening(false); };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (config.autoSendStt) handleSend(transcript);
            else setInput(prev => prev + transcript);
        };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) { alert('无法启动语音识别: ' + e.message); }
  };

  const playInternalTTS = async (text) => {
    if (!text) return;
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

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setSelectionMenu(prev => ({...prev, show: false})), 800);
  };
  
  const pinnedSessions = sessions.filter(s => s.pinned);
  const historySessions = sessions.filter(s => !s.pinned);

  return (
    <>
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

      {!isAiOpen && (
        <div 
            style={{...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom}}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart} onMouseMove={(e) => draggingRef.current && handleTouchMove(e)} onMouseUp={handleTouchEnd}
        >
            <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {isAiOpen && (
        <>
            {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
            
            <div style={{...styles.sidebar, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)'}}>
                <div style={styles.sidebarHeader}>
                    <h3>会话管理</h3>
                    <button onClick={createNewSession} style={styles.newChatBtn}><FaPlus size={12}/> 新对话</button>
                </div>
                <div style={styles.sessionList}>
                    {bookmarks.length > 0 && (
                        <div style={styles.sessionGroup}>
                            <h4 style={styles.groupTitle}>收藏夹</h4>
                            {bookmarks.map((bm, idx) => (
                                <div key={`bm-${idx}`} style={styles.bookmarkItem}>
                                    <p>{bm.content.substring(0, 50)}...</p>
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
                        <h4 style={styles.groupTitle}>历史记录</h4>
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

            <div style={styles.chatWindow}>
                <div style={styles.header}>
                    <button onClick={() => setShowSidebar(true)} style={styles.headerIconBtn}><FaList size={16}/></button>
                    <div style={{fontWeight:'bold', color:'#334155'}}>AI 助教</div>
                    <button onClick={() => setShowSettings(true)} style={styles.headerIconBtn}><FaCog size={16}/></button>
                </div>

                <div ref={historyRef} style={styles.messageArea}>
                    {messages.map((m, i) => {
                        const markdownComponents = {
                            h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
                            h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
                            p: ({children}) => <p style={styles.p}>{React.Children.map(children, c => typeof c==='string' ? <PinyinRenderer text={c} show={pinyinToggles[i] ?? config.showPinyin}/> : c)}</p>,
                            strong: ({children}) => <strong style={styles.strong}>{children}</strong>,
                            ul: ({children}) => <ul style={styles.ul}>{children}</ul>,
                            li: ({children}) => <li style={styles.li}>{React.Children.map(children, c => typeof c === 'string' ? <PinyinRenderer text={c} show={pinyinToggles[i] ?? config.showPinyin}/> : c)}</li>,
                            table: ({children}) => <div style={{overflowX:'auto'}}><table style={styles.table}>{children}</table></div>,
                            th: ({children}) => <th style={styles.th}>{children}</th>,
                            td: ({children}) => <td style={styles.td}>{React.Children.map(children, c => typeof c==='string' ? <PinyinRenderer text={c} show={pinyinToggles[i] ?? config.showPinyin}/> : c)}</td>,
                        };

                        const isBookmarked = m.role === 'assistant' && bookmarks.some(b => b.content === m.content);

                        return (
                            <div key={i} style={{...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                                <div style={{...styles.bubbleWrapper, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                                    <div style={{...styles.bubble, background: m.role === 'user' ? '#f1f5f9' : 'transparent'}}>
                                        {m.role === 'user' ? (
                                            <div style={{color:'#1e293b'}}>{m.content}</div>
                                        ) : (
                                            <div className="notion-md">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <div style={styles.msgActionBar}>
                                        {m.role === 'assistant' && m.content && !loading && (
                                            <>
                                                <button onClick={() => playInternalTTS(m.content)} style={styles.msgActionBtn} title="朗读"><FaVolumeUp/></button>
                                                <button onClick={() => navigator.clipboard.writeText(m.content)} style={styles.msgActionBtn} title="复制"><FaCopy/></button>
                                                <button onClick={() => toggleBookmark(m)} style={{...styles.msgActionBtn, color: isBookmarked ? '#f59e0b' : 'inherit'}} title={isBookmarked ? '取消收藏' : '收藏'}>
                                                    {isBookmarked ? <FaStar/> : <FaRegStar/>}
                                                </button>
                                                <button onClick={() => setPinyinToggles(prev => ({ ...prev, [i]: !(prev[i] ?? config.showPinyin) }))} style={{...styles.msgActionBtn, fontSize: '0.75rem'}}>
                                                    {(pinyinToggles[i] ?? config.showPinyin) ? '隐藏拼音' : '显示拼音'}
                                                </button>
                                            </>
                                        )}
                                        {m.role === 'user' && (
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
                                    <FaLightbulb color="#eab308" size={10}/>{s}
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
            
            <div style={styles.closeArea} onClick={() => setIsAiOpen(false)}>
                <FaChevronUp color="rgba(255,255,255,0.8)" size={14} />
            </div>
        </>
      )}

      {showSettings && (
        <div style={styles.settingsOverlay} onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
            <div style={styles.settingsModal}>
                <div style={styles.modalHeader}><h3>AI 设置</h3><button onClick={()=>setShowSettings(false)} style={styles.closeBtn}><FaTimes/></button></div>
                <div style={styles.modalBody}>
                    <label style={styles.settingRow}><span>API Key</span><input type="password" value={config.apiKey} onChange={e=>setConfig({...config, apiKey:e.target.value})} style={styles.input}/></label>
                    <div style={styles.switchRow}><span>显示拼音 (全局)</span><input type="checkbox" checked={config.showPinyin} onChange={e=>setConfig({...config, showPinyin:e.target.checked})}/></div>
                    <div style={styles.switchRow}><span>打字音效</span><input type="checkbox" checked={config.soundEnabled} onChange={e=>setConfig({...config, soundEnabled:e.target.checked})}/></div>
                    <label style={styles.settingRow}><span>语速 ({config.ttsSpeed}x)</span><input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e=>setConfig({...config, ttsSpeed:parseFloat(e.target.value)})}/></label>
                    <label style={styles.settingRow}><span>发音人</span><select value={config.ttsVoice} onChange={e=>setConfig({...config, ttsVoice:e.target.value})} style={styles.select}>
                        <option value="zh-CN-XiaoxiaoMultilingualNeural">中文女声 - 晓晓</option>
                        <option value="zh-CN-YunxiNeural">中文男声 - 云希</option>
                        <option value="my-MM-NilarNeural">缅甸女声 - Nilar</option>
                        <option value="my-MM-ThihaNeural">缅甸男声 - Thiha</option>
                    </select></label>
                    <hr style={{margin:'10px 0', borderColor:'#f1f5f9'}}/>
                    <label style={styles.settingRow}><span>语音识别语言</span><select value={config.sttLang} onChange={e=>setConfig({...config, sttLang:e.target.value})} style={styles.select}>
                        <option value="zh-CN">中文 (普通话)</option>
                        <option value="my-MM">缅甸语</option>
                        <option value="en-US">英语</option>
                    </select></label>
                    <div style={styles.switchRow}><span>识别后自动发送</span><input type="checkbox" checked={config.autoSendStt} onChange={e=>setConfig({...config, autoSendStt:e.target.checked})}/></div>
                    <button onClick={()=>{ setShowSettings(false); }} style={styles.saveBtn}>关闭</button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0%, 100% {transform:scale(1);} 50% {transform:scale(1.1);} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, system-ui, sans-serif; color: #333; line-height: 1.9; }
        .notion-md ul { padding-left: 1.2em; list-style: none; }
        .notion-md li { position: relative; padding-left: 0.2em; }
        .notion-md > ul > li::before { content: "▪️"; font-size: 0.7em; position: absolute; left: -1.2em; top: 0.4em; }
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
  bubble: { fontSize: '0.95rem', padding: '10px 14px', borderRadius: '12px' },
  msgActionBar: { display: 'flex', gap: 10, marginTop: 6, opacity: 0.7 },
  msgActionBtn: { background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:'2px', fontSize:'0.9rem', display: 'flex', alignItems: 'center' },
  h1: { fontSize: '1.4em', fontWeight: 700, margin: '1em 0 0.5em 0' },
  h2: { fontSize: '1.2em', fontWeight: 600, margin: '0.8em 0 0.4em 0', borderBottom:'1px solid #f1f5f9', paddingBottom:4 },
  p: { margin: '0 0 8px 0' },
  strong: { fontWeight: 700, color: '#000' },
  ul: { paddingLeft: '1.2em' }, 
  li: { marginBottom: '4px' },
  table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: '0.9em' },
  th: { border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f8fafc', fontWeight: '600', textAlign: 'left' },
  td: { border: '1px solid #e2e8f0', padding: '6px 10px', verticalAlign: 'top' },
  footer: { background: '#fff', borderTop: '1px solid #f1f5f9' },
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
  saveBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', marginTop: 10, cursor:'pointer' }
};
