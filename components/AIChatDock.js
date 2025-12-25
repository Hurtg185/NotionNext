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

// 拼音渲染组件
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

// --- 2. 外部触发解析按钮 (已升级支持 grammarContext) ---
/**
 * grammarContext 结构示例:
 * {
 *   grammarName: "把字句",
 *   level: "HSK2",
 *   explanation: "主语 + 把 + 宾语 + 动词..."
 * }
 */
export const AIExplainButton = ({ title, content, grammarContext }) => {
  const { isActivated, canUseAI, triggerAI } = useAI();
  const [showExplanation, setShowExplanation] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isActivated && !canUseAI()) {
      alert(`今日免费提问次数已用完，请激活课程以获得无限次 AI 解析。`);
      return;
    }
    // 这里触发只是为了可能的全局状态同步，实际上主要靠渲染 AIChatDock
    triggerAI(title, content); 
    setShowExplanation(true);
  };

  return (
    <>
        <button onClick={handleClick} style={styles.explainButton}>
        <FaLightbulb /> AI 解析题目
        </button>
        {/* 将 grammarContext 传递给 AI 窗口 */}
        {showExplanation && (
            <AIChatDock 
            initialTask={{ title, content }} 
            grammarContext={grammarContext}
            onClose={() => setShowExplanation(false)} 
            />
        )}
    </>
  );
};

// --- 3. 主组件 AIChatDock ---

export default function AIChatDock({ initialTask, grammarContext, onClose }) {
  const {
    config, setConfig,
    isActivated,
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
  
  // 划词菜单状态
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false);
  const [pinyinToggles, setPinyinToggles] = useState({});

  // Refs
  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const prevTaskRef = useRef(null);
  const selectionTimeoutRef = useRef(null);

  // 获取当前会话的消息
  const messages = sessions.find(s => s.id === currentSessionId)?.messages || [];

  // 更新当前会话消息
  const updateCurrentSessionMessages = useCallback((updater) => {
    if (!currentSessionId) return;
    setSessions(prevSessions =>
      prevSessions.map(s => {
        if (s.id === currentSessionId) {
          const newMessages = typeof updater === 'function' ? updater(s.messages || []) : updater;
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
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const currentUserMessage = { role: 'user', content: textToSend };
    
    updateCurrentSessionMessages(prev => [...prev, currentUserMessage, { role: 'assistant', content: '' }]);

    const historyMessages = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
    }));

    const apiMessages = [
        { role: 'system', content: config.systemPrompt },
        ...historyMessages,
        { role: 'user', content: textToSend }
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
      
      let finalContent = fullContent;
      if (fullContent.includes('[建议]:')) {
          const parts = fullContent.split('[建议]:');
          finalContent = parts[0].trim();
          if(parts[1]) {
              setSuggestions(parts[1].split('|').map(s => s.trim()).filter(Boolean));
          }
      }

      updateCurrentSessionMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0) {
              newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: finalContent };
          }
          return newMsgs;
      });

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

  // --- 关键逻辑：监听任务变化，自动触发解析（注入 grammarContext） ---
  useEffect(() => {
    if (initialTask && (!prevTaskRef.current || prevTaskRef.current.title !== initialTask.title)) {
        prevTaskRef.current = initialTask;
        
        const newId = Date.now();
        const newSession = { 
            id: newId, 
            title: `解析: ${initialTask.title}`, 
            messages: [], 
            date: new Date().toISOString(), 
            pinned: false 
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);

        // 核心改造：构建“助教级”上下文
        let contextMsg = '';
        
        if (grammarContext) {
            contextMsg = `
你是一位【汉语-缅语】助教老师，学生是【${grammarContext.level || '初学者'}】。

【当前学习语法】
语法点：${grammarContext.grammarName}
${grammarContext.explanation ? `【教材解释】：\n${grammarContext.explanation}` : ''}

⚠️ 你的教学原则：
1. 不要重复教材已经讲过的内容，重点解释学生为什么会做错。
2. 用【缅文为主 + 简单中文】回答。
3. 必须结合下面的具体题目进行拆解。

【学生遇到的题目】
# 题目: ${initialTask.title}
${initialTask.content}
`;
        } else {
            // 回退到普通解析模式
            contextMsg = `
请作为老师，详细解析这道题目：
# 题目: ${initialTask.title}
${initialTask.content}

请分析考点、解题思路和正确答案（使用缅语辅助解释）。
`;
        }

        setTimeout(() => {
            handleSend(contextMsg, true);
        }, 100);
    }
  }, [initialTask, grammarContext, setSessions, setCurrentSessionId, handleSend]);

  // 自动滚动
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // TTS
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

  // STT
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

  // --- 关键逻辑：划词菜单修复 (selectionchange + pointerdown) ---
  useEffect(() => {
    const onSelectionChange = () => {
        // 使用 debounce 避免拖拽时频繁闪烁
        if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current);
        
        selectionTimeoutRef.current = setTimeout(() => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) {
                // 如果没有选区，且菜单当前是显示的，才关闭（防止点击菜单本身时误关）
                // 但为了严谨，点击外部的关闭由 handleOutsideClick 处理
                return;
            }

            const text = sel.toString().trim();
            if (!text) return;

            // 限制：只在 Markdown 内容区域生效，避免选输入框文字跳出菜单
            if (sel.anchorNode && sel.anchorNode.parentElement) {
                const wrapper = sel.anchorNode.parentElement.closest('.notion-md');
                if (!wrapper) return; 
            }

            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // 确保菜单位置正确（居中显示在选区上方）
            setSelectionMenu({
                show: true,
                x: rect.left + rect.width / 2,
                y: rect.top - 60, 
                text
            });
            setIsCopied(false);
        }, 300); // 300ms 延迟，等待用户选完
    };

    const handleOutsideClick = (e) => {
        // 使用 pointerdown 兼容移动端和 PC
        const menu = document.getElementById('selection-popover');
        // 如果点击的是菜单内部，不关闭
        if (menu && menu.contains(e.target)) return;
        
        // 否则关闭菜单
        setSelectionMenu(prev => {
            if (prev.show) {
                window.getSelection().removeAllRanges(); // 同时清除选区
                return { ...prev, show: false };
            }
            return prev;
        });
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', handleOutsideClick, true); // 使用 pointerdown 且捕获阶段

    return () => {
        document.removeEventListener('selectionchange', onSelectionChange);
        document.removeEventListener('pointerdown', handleOutsideClick, true);
        if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current);
    };
  }, []);

  const handleTranslateSelection = () => {
      if (!selectionMenu.text) return;
      handleSend(`请详细解释并翻译这段文字：\n"${selectionMenu.text}"`);
      setSelectionMenu(prev => ({...prev, show: false}));
      window.getSelection().removeAllRanges();
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
    <div style={styles.modalOverlay}>
      
      {/* 划词菜单 (修复了点击穿透和消失问题) */}
      {selectionMenu.show && (
          <div id="selection-popover" style={{...styles.popover, left: selectionMenu.x, top: selectionMenu.y}}>
              <button onPointerDown={handleTranslateSelection} style={styles.popBtn}><FaLanguage size={14}/> 解释</button>
              <div style={styles.popDivider}></div>
              <button onPointerDown={() => playInternalTTS(selectionMenu.text)} style={styles.popBtn}><FaVolumeUp size={14}/> 朗读</button>
              <div style={styles.popDivider}></div>
              <button onPointerDown={() => copyText(selectionMenu.text)} style={styles.popBtn}>
                  {isCopied ? <><FaCheck size={14} color="#4ade80"/> 已复制</> : <><FaCopy size={14}/> 复制</>}
              </button>
              <div style={styles.popArrow}></div>
          </div>
      )}

      {/* 侧边栏 */}
      {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
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
                              <button onClick={(e)=>deleteSession(e, s.id)} style={{...styles.sessionActionBtn, color:'#ef4444'}}><FaTrashAlt/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* 主聊天窗口 */}
      <div style={styles.chatWindow}>
          <div style={styles.header}>
              <button onClick={() => setShowSidebar(true)} style={styles.headerIconBtn}><FaList size={16}/></button>
              <div style={{fontWeight:'bold', color:'#334155'}}>AI 解析助教</div>
              <div style={{display:'flex', gap:8}}>
                  <button onClick={() => setShowSettings(true)} style={styles.headerIconBtn}><FaCog size={16}/></button>
                  <button onClick={onClose} style={styles.headerIconBtn}><FaTimes size={16}/></button>
              </div>
          </div>

          <div ref={historyRef} style={styles.messageArea}>
              {messages.map((m, i) => {
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
                    <label style={styles.settingRow}><span>语音朗读语速 ({config.ttsSpeed}x)</span><input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e=>setConfig({...config, ttsSpeed:parseFloat(e.target.value)})}/></label>
                    <button onClick={()=>setShowSettings(false)} style={styles.saveBtn}>保存并关闭</button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0%, 100% {transform:scale(1);} 50% {transform:scale(1.1);} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, sans-serif; color: #333; line-height: 1.8; }
        .notion-md table { border-collapse: collapse; margin: 10px 0; width: 100%; font-size: 0.9em; }
        .notion-md th, .notion-md td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        .notion-md li { margin-bottom: 4px; }
        @keyframes thinking-dot { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1.0); opacity: 1; } }
      `}</style>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatWindow: {
    width: '92%',
    maxWidth: '460px',
    height: '82vh',
    maxHeight: '750px',
    background: '#fff',
    borderRadius: '28px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    position: 'relative',
  },
  header: { height: 52, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between', flexShrink: 0 },
  headerIconBtn: { background:'none', border:'none', color:'#64748b', cursor:'pointer', padding: 8 },
  messageArea: { flex: 1, overflowY: 'auto', padding: '20px' },
  messageRow: { display: 'flex', marginBottom: 24, flexDirection: 'column' },
  bubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '100%' },
  bubble: { fontSize: '0.96rem', padding: '12px 16px', borderRadius: '18px' },
  msgActionBar: { display: 'flex', gap: 12, marginTop: 8, opacity: 0.6, alignItems: 'center', flexWrap: 'wrap' },
  msgActionBtn: { background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'0.9rem' },
  thinkingIndicator: { background: '#f1f5f9', borderRadius: '12px', padding: '12px 16px', display: 'inline-flex', gap: '5px', alignItems:'center' },
  thinkingDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8', animation: 'thinking-dot 1.4s infinite ease-in-out both' },
  footer: { background: '#fff', borderTop: '1px solid #f1f5f9', paddingBottom: 10 },
  scrollSuggestionContainer: { display: 'flex', gap: 8, padding: '12px 16px 0 16px', overflowX: 'auto', scrollbarWidth: 'none' },
  scrollSuggestionBtn: { flexShrink: 0, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '6px 14px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', display:'flex', alignItems:'center', gap: 6 },
  inputContainer: { padding: '12px 16px' },
  inputBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 24, padding: '4px 6px 4px 16px' },
  textarea: { flex: 1, border: 'none', background: 'transparent', resize: 'none', fontSize: '1rem', outline: 'none', height: '24px', lineHeight: '24px', paddingTop: 6 },
  sendBtn: { width: 34, height: 34, borderRadius: '50%', background: '#4f46e5', color: '#fff', border: 'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  micBtn: { width: 34, height: 34, borderRadius: '50%', border: 'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition: 'background 0.2s' },
  sidebar: { position: 'absolute', top: 0, left: 0, width: '280px', height: '100%', background: '#fff', borderRight: '1px solid #e2e8f0', zIndex: 10002, transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column' },
  sidebarOverlay: { position:'absolute', inset:0, background:'rgba(0,0,0,0.4)', zIndex:10001 },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' },
  newChatBtn: { background:'#fff', border:'1px solid #cbd5e1', borderRadius:6, padding:'4px 10px', fontSize:'0.8rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4 },
  sessionList: { flex: 1, overflowY: 'auto', padding: '10px' },
  sessionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: 10, cursor: 'pointer', marginBottom: 4 },
  sessionTitle: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' },
  sessionActions: { display: 'flex', gap: 4 },
  sessionActionBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' },
  bookmarkItem: { background: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: '0.85rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bookmarkActionBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' },
  popover: { position: 'fixed', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 10, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 10px 25px rgba(0,0,0,0.4)', zIndex: 11000, color: '#fff' },
  popBtn: { background:'transparent', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:'0.85rem' },
  popDivider: { width: 1, height: 18, background: 'rgba(255,255,255,0.2)' },
  popArrow: { position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' },
  settingsOverlay: { position:'fixed', inset:0, zIndex:12000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' },
  settingsModal: { width: '85%', maxWidth: '360px', background: '#fff', borderRadius: 20, padding: 20 },
  explainButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '22px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px', fontSize:'0.9rem' },
  h1: { fontSize: '1.4rem', margin: '15px 0' },
  h2: { fontSize: '1.2rem', margin: '12px 0', borderBottom: '1px solid #eee' },
  strong: { color: '#000', fontWeight: 'bold' },
  td: { verticalAlign: 'top' },
  th: { background: '#f8fafc' },
  modalBody: { padding: '10px 0' },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' },
  settingRow: { display: 'flex', flexDirection: 'column', marginBottom: 12 },
  switchRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  input: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: 4 },
  saveBtn: { width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: 10 },
  ttsBar: { position: 'absolute', top: -30, left: 16, background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', animation: 'fadeIn 0.3s' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }
};
