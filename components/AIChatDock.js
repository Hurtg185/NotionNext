import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaPaperPlane, FaChevronDown, FaRobot, FaCog, FaTimes, 
  FaHistory, FaFeatherAlt, FaMicrophone, FaStop, FaLightbulb, 
  FaLanguage, FaCheck, FaVolumeUp, FaCopy, FaTrashAlt, FaStar, FaRegStar,
  FaGoogle, FaLock, FaRocket, FaEye, FaEyeSlash
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { pinyin } from 'pinyin-pro';
import { useAI } from './AIConfigContext';

// =================================================================================
// ===== 1. 常量与辅助配置 =====
// =================================================================================

const STT_LANGS = [
  { label: '中文 (普通话)', value: 'zh-CN' },
  { label: '缅甸语', value: 'my-MM' },
  { label: '英语', value: 'en-US' }
];

const VOICES = [
  { label: '中文女声 - 晓晓 (多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { label: '中文男声 - 云希', value: 'zh-CN-YunxiNeural' },
  { label: '缅甸女声 - Nilar', value: 'my-MM-NilarNeural' },
  { label: '缅甸男声 - Thiha', value: 'my-MM-ThihaNeural' }
];

const LONG_PRESS_DURATION = 600; // 长按触发语言菜单的时间 (ms)

// 简易音效引擎
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

// =================================================================================
// ===== 2. 子组件定义 =====
// =================================================================================

// 拼音渲染组件
const PinyinRenderer = ({ text, show }) => {
  if (!show || !text) return text;
  const cleanText = String(text);
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = cleanText.split(regex);
  return (
    <span style={{ userSelect: 'text' }}>
      {parts.map((part, index) => {
        if (/[\u4e00-\u9fa5]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          return (
            <span key={index} style={{ whiteSpace: 'nowrap', marginRight: '2px' }}>
              {part.split('').map((char, i) => (
                <ruby key={i} style={{ rubyPosition: 'over', margin: '0 1px' }}>
                  {char}
                  <rt style={{ fontSize: '0.6em', color: '#64748b', fontWeight: 'normal', userSelect: 'none', fontFamily: 'Arial' }}>
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

// 打字等待动画
const TypingIndicator = () => (
  <div style={{ display: 'flex', gap: 4, padding: '8px 4px', alignItems: 'center' }}>
    <span className="dot" style={{ animationDelay: '0s' }}></span>
    <span className="dot" style={{ animationDelay: '0.2s' }}></span>
    <span className="dot" style={{ animationDelay: '0.4s' }}></span>
    <style jsx>{`
      .dot { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
      @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    `}</style>
  </div>
);

// =================================================================================
// ===== 3. 主组件 AIChatDock =====
// =================================================================================

export default function AIChatDock() {
  const {
    user, login, config, setConfig, sessions, setSessions,
    currentSessionId, setCurrentSessionId, isAiOpen, setIsAiOpen,
    activeTask, aiMode, resetToChatMode, systemPrompt,
    isActivated, canUseAI, recordUsage, remainingQuota, TOTAL_FREE_QUOTA
  } = useAI();

  // --- UI 状态管理 ---
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showLoginTip, setShowLoginTip] = useState(false);
  const [showSttLangMenu, setShowSttLangMenu] = useState(false); // 语音语言菜单

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]); // 收藏列表

  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // 选中文本菜单状态
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false); // API Key 显示/隐藏

  // 悬浮按钮拖拽状态
  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });

  // 引用与定时器
  const settingsTouchStart = useRef(0);
  const longPressTimerRef = useRef(null);
  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const autoTriggerRef = useRef(null); // 防止自动讲解重复触发

  // =================================================================================
  // ===== 4. 副作用处理 (Effects) =====
  // =================================================================================

  // 拦截返回键
  useEffect(() => {
    const handlePopState = () => { if (isAiOpen) setIsAiOpen(false); };
    if (isAiOpen) {
      window.history.pushState({ aiDockOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    } else if (window.history.state?.aiDockOpen) {
      window.history.back();
    }
  }, [isAiOpen, setIsAiOpen]);

  // 加载本地收藏
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ai_bookmarks');
      if (stored) setBookmarks(JSON.parse(stored));
    } catch (e) {}
  }, []);

  // 自动滚动到底部
  const messages = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  }, [sessions, currentSessionId]);

  useEffect(() => {
    if (historyRef.current && isAiOpen) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiOpen, loading]);

  // 文本选中监听
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSelectionChange = () => {
        if (window.selectionTimeout) clearTimeout(window.selectionTimeout);
        window.selectionTimeout = setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const text = selection.toString().trim();
            if (text.length > 0 && isAiOpen && !draggingRef.current) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                let top = rect.top - 60;
                let left = rect.left + rect.width / 2;
                if (top < 10) top = rect.bottom + 10;
                setSelectionMenu({ show: true, x: left, y: top, text });
                setIsCopied(false);
            }
        }, 200);
    };
    const handleOutsideClick = (e) => {
        if (document.getElementById('selection-popover') && !document.getElementById('selection-popover').contains(e.target)) {
            setSelectionMenu(prev => ({ ...prev, show: false }));
        }
        if (document.getElementById('stt-lang-menu') && !document.getElementById('stt-lang-menu').contains(e.target)) {
            setShowSttLangMenu(false);
        }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isAiOpen]);

  // =================================================================================
  // ===== 5. 自动讲解逻辑 (核心) =====
  // =================================================================================
  useEffect(() => {
    // 只有在窗口打开、有新任务、且该任务时间戳未被处理过时触发
    if (isAiOpen && activeTask && activeTask.timestamp !== autoTriggerRef.current) {
        autoTriggerRef.current = activeTask.timestamp;
        
        // 如果当前是新会话（空消息），或者虽然不是新会话但想强制插入讲解
        if (messages.length === 0) {
            let autoMsg = '';
            if (aiMode === 'INTERACTIVE') {
                autoMsg = `老师，我做错了这道题，请帮我深度解析原因：\n题目：${activeTask.question}\n我的选择：${activeTask.userChoice}`;
            } else {
                // 普通语法模式
                autoMsg = `老师，请详细讲解一下当前内容：${activeTask.title}`;
            }
            handleSend(autoMsg);
        }
    }
  }, [isAiOpen, activeTask, aiMode]); // 依赖项

  // =================================================================================
  // ===== 6. 交互处理函数 =====
  // =================================================================================

  const updateMessages = (updater) => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const newMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
        const msgsWithId = newMsgs.map(m => m.id ? m : { ...m, id: `${Date.now()}-${Math.random()}` });
        let newTitle = s.title;
        // 自动更新标题（仅限Chat模式且是新对话）
        if (aiMode === 'CHAT' && s.title === '新对话' && msgsWithId.length > 0) {
           const firstUser = msgsWithId.find(m => m.role === 'user');
           if (firstUser) newTitle = firstUser.content.substring(0, 15);
        }
        return { ...s, messages: msgsWithId, title: newTitle, date: new Date().toISOString() };
      }
      return s;
    }));
  };

  const handleSend = async (textToSend = input, isSystemTrigger = false) => {
    const contentToSend = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!contentToSend || loading) return;

    if (!isSystemTrigger && !user) { setShowLoginTip(true); return; }
    if (!config.apiKey) { alert('请先在设置中配置 API Key'); setShowSettings(true); return; }
    if (!isSystemTrigger && !isActivated) {
        try {
            const auth = await canUseAI();
            const canUse = (auth && typeof auth === 'object') ? auth.canUse : auth;
            if (!canUse) { setShowPaywall(true); return; }
        } catch(e) { return; }
    }

    if (!isSystemTrigger) setInput('');
    setSuggestions([]);
    setLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (!currentSession) return;

    // 构造 UI 消息 (用户 + AI空占位)
    const newUserMsg = { role: 'user', content: contentToSend, id: Date.now() };
    const uiMessages = [...currentSession.messages, newUserMsg];

    // 立即更新 UI
    setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
        ? { ...s, messages: [...uiMessages, { role: 'assistant', content: '', id: Date.now() + 1 }] } 
        : s
    ));

    // 构造 API 请求 (只含系统提示 + 当前问题，无历史干扰)
    const apiMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentToSend }
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          email: user?.email,
          config: { apiKey: config.apiKey, baseUrl: config.baseUrl, modelId: config.modelId }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let soundThrottler = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            try {
              const json = JSON.parse(dataStr);
              const delta = json.choices?.[0]?.delta?.content || '';
              fullContent += delta;
              
              if (config.soundEnabled) {
                  soundThrottler++;
                  if (soundThrottler % 3 === 0) playTickSound();
              }

              setSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) {
                  const msgs = [...s.messages];
                  msgs[msgs.length - 1].content = fullContent;
                  return { ...s, messages: msgs };
                }
                return s;
              }));
            } catch (e) {}
          }
        }
      }

      if (fullContent.includes('SUGGESTIONS:')) {
        const parts = fullContent.split('SUGGESTIONS:');
        setSuggestions(parts[1].split('|||').map(s => s.trim()).filter(s => s));
      }

      if (!isSystemTrigger && !isActivated) await recordUsage();
      if (config.autoTTS) playInternalTTS(fullContent);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Chat Error", err);
        setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
                const msgs = [...s.messages];
                msgs[msgs.length - 1].content = "⚠️ 网络请求失败，请检查配置。";
                return { ...s, messages: msgs };
            }
            return s;
        }));
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 语音识别控制
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("您的浏览器不支持语音识别。"); return; }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = config.sttLang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (config.autoSendStt) handleSend(transcript);
        else setInput(prev => prev + transcript);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) { alert('无法启动语音识别: ' + e.message); }
  };

  // TTS 播放
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

  // 按钮交互逻辑（合并按钮）
  const handleMainBtnPress = () => {
    if (!input.trim() && !isListening) {
        longPressTimerRef.current = setTimeout(() => {
            setShowSttLangMenu(true);
        }, LONG_PRESS_DURATION);
    }
  };
  const handleMainBtnRelease = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        if (!showSttLangMenu) handleMainBtnClick();
    }
  };
  const handleMainBtnClick = () => {
      if (isListening) toggleListening();
      else if (input.trim()) handleSend();
      else toggleListening();
  };

  // 辅助功能
  const copyText = (text) => { navigator.clipboard.writeText(text); setIsCopied(true); setTimeout(() => setSelectionMenu(prev=>({...prev,show:false})), 800); };
  const handleTranslateSelection = () => {
    if (!selectionMenu.text) return;
    handleSend(`请用缅文详细解释这段文字：\n"${selectionMenu.text}"`);
    setSelectionMenu(prev => ({ ...prev, show: false }));
    window.getSelection().removeAllRanges();
  };
  const toggleBookmark = (message) => {
    setBookmarks(prev => {
      const exists = prev.some(b => b.id === message.id);
      const next = exists ? prev.filter(b => b.id !== message.id) : [{...message, bookmarkedAt: new Date().toISOString()}, ...prev];
      localStorage.setItem('ai_bookmarks', JSON.stringify(next));
      return next;
    });
  };
  const handleConfirmLogin = () => {
    sessionStorage.setItem('need_open_api_guide', 'true');
    setShowLoginTip(false);
    login();
  };

  // 拖拽逻辑
  const handleTouchStart = (e) => { draggingRef.current = false; dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; btnStartPos.current = { ...btnPos }; };
  const handleTouchMove = (e) => {
    const dx = dragStartPos.current.x - e.touches[0].clientX;
    const dy = dragStartPos.current.y - e.touches[0].clientY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { draggingRef.current = true; setBtnPos({ right: btnStartPos.current.right + dx, bottom: btnStartPos.current.bottom + dy }); }
  };
  const handleTouchEnd = () => { if (!draggingRef.current) setIsAiOpen(true); draggingRef.current = false; };
  const handleSettingsTouchStart = (e) => { settingsTouchStart.current = e.touches[0].clientX; };
  const handleSettingsTouchEnd = (e) => { if (e.changedTouches[0].clientX - settingsTouchStart.current > 80) setShowSettings(false); };

  // 会话管理
  const createNewSession = () => {
      const newId = Date.now();
      setSessions(prev => [{ id: newId, title: '新对话', messages: [], date: new Date().toISOString() }, ...prev]);
      setCurrentSessionId(newId);
      setShowSidebar(false);
      resetToChatMode();
  };
  const switchSession = (id) => { setCurrentSessionId(id); setShowSidebar(false); };
  const deleteSession = (e, id) => { e.stopPropagation(); setSessions(prev => prev.filter(s => s.id !== id)); };
  const renameSession = (e, id) => { e.stopPropagation(); const t = prompt("新标题"); if(t) setSessions(prev => prev.map(s => s.id===id?{...s, title:t}:s)); };
  const handleBookmarkClick = (content) => { setInput(content); setShowSidebar(false); textareaRef.current?.focus(); };

  // 动态标题逻辑
  const getNavTitle = () => {
      if (aiMode === 'INTERACTIVE') return '错题深度解析';
      return activeTask?.title || 'AI 助教';
  };

  return (
    <>
      {/* 悬浮球 */}
      {!isAiOpen && (
        <div style={{ ...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom }}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart} onMouseMove={(e)=>draggingRef.current && handleTouchMove(e)} onMouseUp={handleTouchEnd}
        >
          <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {isAiOpen && (
        <div style={styles.fullScreenContainer}>
          {/* 侧边栏 */}
          {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
          <div style={{ ...styles.sidebar, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)' }}>
            <div style={styles.sidebarHeader}>
              <h3>历史记录</h3>
              <button onClick={createNewSession} style={styles.newChatBtn}><FaPlus size={12} /> 新对话</button>
            </div>
            <div style={styles.sessionList}>
              {sessions.map(s => (
                <div key={s.id} onClick={() => switchSession(s.id)} style={{
                  ...styles.sessionItem,
                  background: currentSessionId === s.id ? '#eff6ff' : 'transparent',
                  color: currentSessionId === s.id ? '#2563eb' : '#334155'
                }}>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  {currentSessionId === s.id && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <FaEdit size={12} onClick={(e) => renameSession(e, s.id)} />
                      <FaTrashAlt size={12} onClick={(e) => deleteSession(e, s.id)} style={{ color: '#ef4444' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* 收藏 */}
            <div style={styles.bookmarkSection}>
                <h4 style={styles.bookmarkHeader}><FaStar size={14} style={{marginRight: 6}}/>我的收藏</h4>
                <div style={styles.bookmarkList}>
                    {bookmarks.length > 0 ? bookmarks.map(b => (
                        <div key={b.id} style={styles.bookmarkItem} onClick={() => handleBookmarkClick(b.content)}>
                            <p style={styles.bookmarkContent}>{b.content}</p>
                        </div>
                    )) : <p style={styles.noBookmarks}>暂无收藏</p>}
                </div>
            </div>
          </div>

          {/* 顶部导航 */}
          <div style={styles.navHeader}>
            <button onClick={() => setShowSidebar(true)} style={styles.navIconBtn}>
              <FaHistory size={18} />
            </button>
            <div style={styles.navTitle}>{getNavTitle()}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowSettings(true)} style={styles.navIconBtn}><FaCog size={18} /></button>
              <button onClick={() => setIsAiOpen(false)} style={styles.navIconBtn}><FaChevronDown size={18} /></button>
            </div>
          </div>

          {/* 聊天内容 */}
          <div ref={historyRef} style={styles.chatBody}>
            {messages.length === 0 && (
                <div style={styles.emptyState}>
                    <FaRobot size={48} color="#cbd5e1" />
                    <p style={{marginTop:16, color:'#94a3b8'}}>我是你的 AI 助教，正在准备...</p>
                </div>
            )}
            
            {messages.map((m, i) => (
              <div key={m.id || i} style={{ ...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.bubbleWrapper, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    ...styles.bubble,
                    background: m.role === 'user' ? '#4f46e5' : '#fff',
                    color: m.role === 'user' ? '#fff' : '#1e293b',
                    borderRadius: 16,
                    borderTopRightRadius: m.role === 'user' ? 2 : 16,
                    borderTopLeftRadius: m.role === 'assistant' ? 2 : 16
                  }}>
                    {m.role === 'user' ? (
                      <div style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    ) : (
                      <div className="notion-md">
                        {m.content === '' && loading && i === messages.length - 1 ? <TypingIndicator /> : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p style={{margin:'0 0 8px 0', lineHeight: 1.6}}><PinyinRenderer text={children} show={config.showPinyin} /></p>,
                              strong: ({ children }) => <strong style={{color: '#d97706', fontWeight: 600}}>{children}</strong>,
                              li: ({ children }) => <li style={{marginBottom: 4}}>{children}</li>
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    )}
                  </div>
                  {m.role === 'assistant' && m.content && (
                      <div style={styles.msgActionBar}>
                          <button onClick={()=>toggleBookmark(m)} style={styles.msgActionBtn}>
                              {bookmarks.some(b=>b.id===m.id)?<FaStar color="#facc15"/>:<FaRegStar/>}
                          </button>
                          <button onClick={()=>playInternalTTS(m.content)} style={styles.msgActionBtn}><FaVolumeUp/></button>
                          <button onClick={()=>copyText(m.content)} style={styles.msgActionBtn}><FaCopy/></button>
                      </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 底部输入 */}
          <div style={styles.footer}>
            {!loading && suggestions.length > 0 && (
              <div style={styles.scrollSuggestionContainer}>
                {suggestions.map((s, idx) => (
                  <button key={idx} onClick={() => handleSend(s)} style={styles.scrollSuggestionBtn}>
                    <FaLightbulb color="#4f46e5" size={10} style={{ marginRight: 6 }} />{s}
                  </button>
                ))}
              </div>
            )}
            
            <div style={styles.inputBox}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend(); }}}
                placeholder={isListening ? "正在聆听..." : "输入问题..."}
                style={styles.textarea}
                rows={1}
              />
              
              <div style={{position:'relative'}}>
                  {showSttLangMenu && (
                      <div id="stt-lang-menu" style={styles.sttLangMenu}>
                          {STT_LANGS.map(lang => (
                              <div key={lang.value} onClick={()=>{setConfig({...config, sttLang:lang.value}); setShowSttLangMenu(false);}} style={styles.sttLangItem}>
                                  {lang.label} {config.sttLang===lang.value && <FaCheck size={10}/>}
                              </div>
                          ))}
                      </div>
                  )}
                  <button 
                    onMouseDown={handleMainBtnPress} onMouseUp={handleMainBtnRelease}
                    onTouchStart={handleMainBtnPress} onTouchEnd={handleMainBtnRelease}
                    disabled={loading && !isListening}
                    style={{
                        ...styles.mainBtn,
                        background: isListening ? '#ef4444' : (input.trim() ? '#4f46e5' : '#e2e8f0'),
                        color: (isListening || input.trim()) ? '#fff' : '#64748b'
                    }}
                  >
                    {isListening ? <FaStop className="animate-pulse" /> : (input.trim() ? <FaPaperPlane /> : <FaMicrophone />)}
                  </button>
              </div>
            </div>
          </div>

          {/* 弹窗层 */}
          {selectionMenu.show && (
            <div id="selection-popover" style={{ ...styles.popover, left: selectionMenu.x, top: selectionMenu.y }}>
                <button onClick={handleTranslateSelection} style={styles.popBtn}><FaLanguage /> 解释</button>
                <div style={styles.popDivider}></div>
                <button onClick={()=>playInternalTTS(selectionMenu.text)} style={styles.popBtn}><FaVolumeUp /> 朗读</button>
                <div style={styles.popDivider}></div>
                <button onClick={()=>copyText(selectionMenu.text)} style={styles.popBtn}><FaCopy /> 复制</button>
                <div style={styles.popArrow}></div>
            </div>
          )}

          {showLoginTip && (
            <div style={styles.paywallOverlay}>
              <div style={{ ...styles.paywallModal, maxWidth: 300 }}>
                <div style={{ ...styles.paywallHeader, background: '#4f46e5' }}>👋 温馨提示</div>
                <div style={styles.paywallBody}>
                  <p style={{ color: '#334155', fontSize: '0.95rem' }}>请先登录账号以保存学习记录。</p>
                  <button onClick={handleConfirmLogin} style={styles.activateBtn}><FaGoogle style={{ marginRight: 8 }} /> 立即登录</button>
                  <button onClick={() => setShowLoginTip(false)} style={styles.previewBtn}>暂不登录</button>
                </div>
              </div>
            </div>
          )}

          {showPaywall && (
            <div style={styles.paywallOverlay}>
              <div style={styles.paywallModal}>
                <div style={styles.paywallHeader}>试用结束</div>
                <div style={styles.paywallBody}>
                  <p>您已用完免费 AI 额度，请激活课程继续使用。</p>
                  <button onClick={()=>{window.location.href='/pricing'}} style={styles.activateBtn}>立即激活</button>
                  <button onClick={() => setShowPaywall(false)} style={styles.closePaywallBtn}><FaTimes /></button>
                </div>
              </div>
            </div>
          )}

          {showSettings && (
            <div style={styles.settingsOverlay} onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
              <div style={styles.settingsModal} onTouchStart={handleSettingsTouchStart} onTouchEnd={handleSettingsTouchEnd}>
                <div style={styles.modalHeader}>
                  <h3>设置</h3>
                  <button onClick={() => setShowSettings(false)} style={styles.closeBtn}><FaTimes /></button>
                </div>
                <div style={styles.modalBody}>
                  <label style={styles.settingRow}>
                      <span>API Key (点击隐藏)</span>
                      <div style={{display:'flex', alignItems:'center'}}>
                          <input type={showKeyText?"text":"password"} value={config.apiKey} onChange={e=>setConfig({...config, apiKey:e.target.value})} style={styles.input} placeholder="sk-..." />
                          <button onClick={()=>setShowKeyText(!showKeyText)} style={{marginLeft:8, border:'none', background:'none'}}>{showKeyText?<FaEyeSlash/>:<FaEye/>}</button>
                      </div>
                  </label>
                  <label style={styles.settingRow}>
                      <span>接口地址</span>
                      <input type="text" value={config.baseUrl} onChange={e=>setConfig({...config, baseUrl:e.target.value})} style={styles.input} placeholder="Base URL" />
                  </label>
                  <label style={styles.settingRow}>
                      <span>模型名称</span>
                      <input type="text" value={config.modelId} onChange={e=>setConfig({...config, modelId:e.target.value})} style={styles.input} placeholder="Model ID" />
                  </label>
                  <div style={styles.switchRow}>
                    <span>显示拼音</span>
                    <input type="checkbox" checked={config.showPinyin} onChange={e=>setConfig({...config, showPinyin:e.target.checked})} />
                  </div>
                  <div style={styles.switchRow}>
                    <span>语音朗读</span>
                    <input type="checkbox" checked={config.soundEnabled} onChange={e=>setConfig({...config, soundEnabled:e.target.checked})} />
                  </div>
                  <label style={styles.settingRow}>
                    <span>语速 ({config.ttsSpeed}x)</span>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e => setConfig({ ...config, ttsSpeed: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                  </label>
                  <label style={styles.settingRow}>
                    <span>发音人</span>
                    <select value={config.ttsVoice} onChange={e => setConfig({ ...config, ttsVoice: e.target.value })} style={styles.select}>
                      {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 动画样式 */}
      <style jsx global>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% {transform:scale(1);} 50% {transform:scale(1.1);} 100% {transform:scale(1);} }
        .notion-md { font-family: sans-serif; line-height: 1.7; }
        .notion-md ul { padding-left: 1.2em; margin: 0.5em 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}

// =================================================================================
// ===== 7. 样式定义 =====
// =================================================================================
const styles = {
  fullScreenContainer: { position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 99999, display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease-out' },
  navHeader: { height: 56, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  navTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' },
  navIconBtn: { background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' },
  
  sidebar: { position: 'fixed', top: 0, left: 0, width: '80%', maxWidth: 300, bottom: 0, background: '#fff', borderRight: '1px solid #e2e8f0', zIndex: 100000, transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' },
  sidebarOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99999 },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  newChatBtn: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 },
  sessionList: { flex: 1, overflowY: 'auto', padding: 10 },
  sessionItem: { padding: '12px', borderRadius: 8, marginBottom: 4, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' },
  bookmarkSection: { display: 'flex', flexDirection: 'column', height: '40%', flexShrink: 0, borderTop: '1px solid #e2e8f0' },
  bookmarkHeader: { margin: 0, padding: '12px 16px', fontSize: '0.95rem', background: '#f8fafc', fontWeight: 'bold' },
  bookmarkList: { flex: 1, overflowY: 'auto', padding: '10px' },
  bookmarkItem: { padding: '10px', background: '#fff', borderRadius: 6, marginBottom: 6, border: '1px solid #f1f5f9', fontSize: '0.85rem' },
  bookmarkContent: { margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  noBookmarks: { textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: 20 },

  chatBody: { flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
  messageRow: { display: 'flex', marginBottom: 20, width: '100%', flexDirection: 'column' },
  bubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '100%' },
  bubble: { fontSize: '0.95rem', width: 'fit-content', maxWidth: '100%', padding: '12px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  msgActionBar: { display: 'flex', justifyContent: 'flex-end', marginTop: 4, paddingRight: 4, gap: 8 },
  msgActionBtn: { background: 'none', border: 'none', fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },

  footer: { background: '#fff', borderTop: '1px solid #e2e8f0', paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', flexDirection: 'column' },
  inputBox: { display: 'flex', alignItems: 'flex-end', gap: 10, padding: '12px 16px', background: '#fff' },
  textarea: { flex: 1, border: '1px solid #e2e8f0', borderRadius: 20, background: '#f8fafc', padding: '10px 14px', fontSize: '1rem', outline: 'none', resize: 'none', maxHeight: 120, lineHeight: 1.5 },
  mainBtn: { width: 44, height: 44, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s', flexShrink: 0 },
  
  sttLangMenu: { position: 'absolute', bottom: '110%', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 8, width: 140, zIndex: 20 },
  sttLangItem: { padding: '8px', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' },
  
  scrollSuggestionContainer: { display: 'flex', gap: 10, padding: '8px 16px', overflowX: 'auto' },
  scrollSuggestionBtn: { flexShrink: 0, background: '#fff', border: '1px solid #e0e7ff', borderRadius: 20, padding: '6px 12px', fontSize: '0.85rem', color: '#4f46e5' },

  floatingBtn: { position: 'fixed', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer' },
  
  settingsOverlay: { position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  settingsModal: { width: '85%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
  modalBody: { display: 'flex', flexDirection: 'column', gap: 12 },
  settingRow: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem', color: '#475569', fontWeight: 600 },
  input: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem', width: '100%' },
  select: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#fff', width: '100%' },
  switchRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: '#334155' },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.1rem', color: '#64748b' },
  
  paywallOverlay: { position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  paywallModal: { width: '85%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '0', position: 'relative', overflow: 'hidden' },
  paywallHeader: { background: 'linear-gradient(135deg, #4f46e5, #ec4899)', padding: '24px 20px', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' },
  paywallBody: { padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  activateBtn: { width: '100%', padding: '14px', borderRadius: 12, background: '#4f46e5', color: '#fff', fontSize: '1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' },
  previewBtn: { width: '100%', padding: '14px', borderRadius: 12, background: '#f1f5f9', color: '#475569', fontSize: '0.95rem', fontWeight: '600', border: 'none', cursor: 'pointer' },
  closePaywallBtn: { position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  
  popover: { position: 'fixed', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 11000, color: '#fff' },
  popBtn: { background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' },
  popDivider: { width: 1, height: 16, background: 'rgba(255,255,255,0.3)' },
  popArrow: { position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' }
};
