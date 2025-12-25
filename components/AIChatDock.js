import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaPaperPlane, FaChevronUp, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaMicrophone, FaEraser,
  FaList, FaEdit, FaTrashAlt, FaPlus, FaLightbulb, FaFeatherAlt,
  FaLanguage, FaCheck, FaFont
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import { pinyin } from 'pinyin-pro'; 
import { useAI } from './AIConfigContext'; // 引入拆分后的 Context

// --- 常量定义 ---
const VOICES = [
  { label: '中文女声 - 晓晓 (多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { label: '中文男声 - 云希', value: 'zh-CN-YunxiNeural' },
  { label: '缅甸女声 - Nilar', value: 'my-MM-NilarNeural' },
  { label: '缅甸男声 - Thiha', value: 'my-MM-ThihaNeural' }
];

const STT_LANGS = [
  { label: '中文 (普通话)', value: 'zh-CN' },
  { label: '缅甸语', value: 'my-MM' },
  { label: '英语', value: 'en-US' }
];

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

// --- 拼音组件 ---
const PinyinRenderer = ({ text, show }) => {
  if (!show || !text) return text; 
  const cleanText = typeof text === 'string' ? text : String(text);
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
  // --- 接入 Context ---
  const {
    user, // 必须获取 user，用于传 email 和判断登录状态
    config, setConfig,
    sessions, setSessions,
    currentSessionId, setCurrentSessionId,
    isAiOpen, setIsAiOpen,
    activeTask, 
    isActivated, 
    canUseAI,     // 必须是 async 函数
    recordUsage,  // 必须是 async 函数
    remainingQuota, 
    TOTAL_FREE_QUOTA
  } = useAI();

  // --- 本地 UI 状态 ---
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]); 
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false); 
  
  // 选文菜单
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false); 

  // 悬浮按钮位置
  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const prevTaskRef = useRef(null);

  // --- 核心：从 Sessions 中派生当前 Messages ---
  const messages = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  }, [sessions, currentSessionId]);

  // 辅助函数：更新当前会话的消息
  const updateMessages = (updater) => {
    if (!currentSessionId) return;
    setSessions(prevSessions => 
      prevSessions.map(s => {
        if (s.id === currentSessionId) {
            const newMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
            let newTitle = s.title;
            if (s.title === '新对话' && newMsgs.length > 0) {
                const firstUserMsg = newMsgs.find(m => m.role === 'user');
                if(firstUserMsg) newTitle = firstUserMsg.content.substring(0, 15);
            }
            return { ...s, messages: newMsgs, title: newTitle, date: new Date().toISOString() };
        }
        return s;
      })
    );
  };

  // --- 初始化与监听 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isAiOpen]);

  // 自动滚动
  useEffect(() => {
    if (historyRef.current && isAiOpen) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiOpen, loading]);

  // --- 监听外部触发 (ActiveTask) ---
  useEffect(() => {
      if (activeTask && (!prevTaskRef.current || prevTaskRef.current.timestamp !== activeTask.timestamp)) {
          prevTaskRef.current = activeTask;
          
          setIsAiOpen(true);
          
          const newSessionId = Date.now();
          const newSession = { 
              id: newSessionId, 
              title: `解析: ${activeTask.title.substring(0,10)}`, 
              messages: [], 
              date: new Date().toISOString() 
          };
          setSessions(prev => [newSession, ...prev]);
          setCurrentSessionId(newSessionId);

          const prompt = `请作为老师，详细解析这道题目：\n\n# 题目: ${activeTask.title}\n\n${activeTask.content}\n\n请结合语法点进行分析。`;
          
          setTimeout(() => {
              handleSend(prompt, true); // true = 系统触发
          }, 200);
      }
  }, [activeTask, setIsAiOpen, setSessions, setCurrentSessionId]);

  // --- 选文菜单逻辑 ---
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
             
             setSelectionMenu({
                 show: true,
                 x: left, 
                 y: top,
                 text: text
             });
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

  const handleTranslateSelection = () => {
      if (!selectionMenu.text) return;
      handleSend(`请详细解释并翻译这段文字：\n"${selectionMenu.text}"`);
      setSelectionMenu(prev => ({...prev, show: false}));
      window.getSelection().removeAllRanges();
  };

  // --- 拖动逻辑 ---
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
        setBtnPos({
            right: btnStartPos.current.right + dx,
            bottom: btnStartPos.current.bottom + dy
        });
    }
  };

  const handleTouchEnd = () => {
    if (!draggingRef.current) {
        setIsAiOpen(true);
    }
    draggingRef.current = false;
  };

  // --- 会话管理 ---
  const createNewSession = () => {
      const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() };
      setSessions(prev => [newSession, ...prev]);
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
      setSessions(prev => {
          const newSessions = prev.filter(s => s.id !== id);
          if (id === currentSessionId) setCurrentSessionId(newSessions[0].id);
          return newSessions;
      });
  };
  
  const renameSession = (e, id) => {
      e.stopPropagation();
      const newTitle = prompt("请输入新标题");
      if(newTitle) {
          setSessions(prev => prev.map(s => s.id === id ? {...s, title: newTitle} : s));
      }
  };

  const deleteMessage = (index) => {
      if (confirm('确定删除这条消息吗？')) {
          updateMessages(prev => prev.filter((_, i) => i !== index));
      }
  };

  // --- 语音识别 ---
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

  // --- 发送逻辑 (修复与增强版) ---
  const handleSend = async (textToSend = input, isSystemTrigger = false) => {
    if (!textToSend.trim() || loading) return;

    // --- 1. 新增：未登录拦截 ---
    // 如果不是系统自动触发（如解析题目），且用户对象为空（未登录）
    if (!isSystemTrigger && !user) {
        alert("请先登录 Google 账号，即可使用 AI 助教。");
        return;
    }

    if (!config.apiKey) {
      alert('请先在设置中配置 API Key');
      setShowSettings(true);
      return;
    }

    // 2. 权限校验 (后端 API)
    if (!isSystemTrigger && !isActivated) {
        try {
            const auth = await canUseAI(); 
            // 兼容不同的返回值结构
            const canUse = (auth && typeof auth === 'object') ? auth.canUse : auth;
            
            if (!canUse) {
                alert(`免费提问次数已用完 (${remainingQuota}/${TOTAL_FREE_QUOTA})，请激活课程以获得无限次 AI 解析。`);
                return;
            }
        } catch (e) {
            console.error("Quota check failed", e);
            alert("网络校验失败，请检查网络连接");
            return;
        }
    }

    const userText = textToSend;  
    if (!isSystemTrigger) setInput('');  
    setSuggestions([]); 
    setLoading(true);  
    
    if (abortControllerRef.current) abortControllerRef.current.abort();  
    abortControllerRef.current = new AbortController();  

    // 3. 动态 Prompt (H1/H2 vs H3+)
    const currentLevel = config.userLevel || 'H1';
    let dynamicSystemPrompt = config.systemPrompt || '你是一位专业的缅甸汉语助教。';
    
    if (['H1', 'H2'].includes(currentLevel)) {
        dynamicSystemPrompt += `\n【当前等级】：${currentLevel} (初学者)\n【要求】：请使用【缅甸语】解释，中文仅用于例句。`;
    } else {
        dynamicSystemPrompt += `\n【当前等级】：${currentLevel} (进阶)\n【要求】：以中文讲解为主，难点辅以缅甸语。`;
    }
    // 强制 AI 使用特定格式方便解析
    dynamicSystemPrompt += `\n【追问建议】：请在最后一行，严格以 "SUGGESTIONS: 建议1|||建议2|||..." 的格式给出 3-5 个追问建议。`;

    const userMsg = { role: 'user', content: userText };
    updateMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);

    const historyMsgs = messages.slice(-6).map(m => ({role: m.role, content: m.content}));
    const apiMessages = [  
        { role: 'system', content: dynamicSystemPrompt },  
        ...historyMsgs, 
        userMsg
    ];  

    try {  
      const response = await fetch('/api/chat', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({  
          messages: apiMessages,
          // --- 关键修复：必须带上 email，否则后端报错 401 ---
          email: user?.email, 
          config: { apiKey: config.apiKey, modelId: config.modelId }  
        }),  
        signal: abortControllerRef.current.signal  
      });  

      if (!response.ok) throw new Error("API 请求失败");
      if (!response.body) throw new Error("无响应内容");

      const reader = response.body.getReader();  
      const decoder = new TextDecoder();  
      let done = false;  
      let fullContent = '';  
      let buffer = '';
      let soundThrottler = 0;

      while (!done) {  
        const { value, done: readerDone } = await reader.read();  
        done = readerDone;  
        const chunk = decoder.decode(value, { stream: true });  
        buffer += chunk;  
        const lines = buffer.split('\n');  
        buffer = lines.pop(); 

        for (const line of lines) {  
            const trimmed = line.trim();  
            if (!trimmed || trimmed === 'data: [DONE]') continue;  
            if (trimmed.startsWith('data: ')) {  
                try {  
                    const data = JSON.parse(trimmed.replace('data: ', ''));  
                    const delta = data.choices?.[0]?.delta?.content || '';  
                    if (delta) {  
                        fullContent += delta;  
                        if (config.soundEnabled) {
                            soundThrottler++;
                            if (soundThrottler % 3 === 0) playTickSound(); 
                        }
                        updateMessages(prev => {  
                            const last = prev[prev.length - 1];  
                            const list = prev.slice(0, -1);
                            return [...list, { ...last, content: fullContent }];  
                        });  
                    }  
                } catch (e) { }  
            }  
        }  
      } 
      
      // 4. 解析建议 (强化正则逻辑)
      let cleanContent = fullContent;
      let rawSuggestionsStr = '';

      if (fullContent.includes('SUGGESTIONS:')) {
          const parts = fullContent.split('SUGGESTIONS:');
          cleanContent = parts[0].trim();
          rawSuggestionsStr = parts[1];
      } else if (fullContent.includes('[建议]:')) {
          const parts = fullContent.split('[建议]:');
          cleanContent = parts[0].trim();
          rawSuggestionsStr = parts[1];
      }

      // 更新消息去除标记
      updateMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: cleanContent }]);

      // 提取气泡，兼容 ||| 和 | 以及换行
      if (rawSuggestionsStr) {
          const splitRegex = /\|\|\||\||\n/; // 兼容多种分隔符
          const finalSuggestions = rawSuggestionsStr
              .split(splitRegex)
              .map(s => s.trim().replace(/^(\d+[\.、\s]+)/, '')) // 关键：正则去序号
              .filter(s => s && s.length > 1)
              .slice(0, 10);
          setSuggestions(finalSuggestions);
      }

      // 5. 记录扣费
      if (!isSystemTrigger && !isActivated) {
          await recordUsage(); 
      }

      if (config.autoTTS) playInternalTTS(cleanContent);

    } catch (err) {  
      if (err.name !== 'AbortError') {  
          console.error("Chat Error:", err);
          updateMessages(prev => {
              const last = prev[prev.length - 1];
              // 避免重复追加错误信息
              if (!last.content.includes('[系统]:')) {
                  return [...prev.slice(0, -1), { ...last, content: last.content + `\n\n[系统]: 生成中断，请重试。(${err.message})` }];
              }
              return prev;
          });
      }  
    } finally {  
      setLoading(false);  
      abortControllerRef.current = null;  
    }
  };

  // --- TTS ---
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

  return (
    <>
      {/* 划词菜单 */}
      {selectionMenu.show && (
          <div id="selection-popover" style={{...styles.popover, left: selectionMenu.x, top: selectionMenu.y}}>
              <button onClick={handleTranslateSelection} style={styles.popBtn} title="解释/翻译">
                  <FaLanguage size={14}/> 解释
              </button>
              <div style={styles.popDivider}></div>
              <button onClick={() => playInternalTTS(selectionMenu.text)} style={styles.popBtn} title="朗读">
                  <FaVolumeUp size={14}/> 朗读
              </button>
              <div style={styles.popDivider}></div>
              <button onClick={() => copyText(selectionMenu.text)} style={styles.popBtn} title="复制">
                  {isCopied ? <FaCheck size={14} color="#4ade80"/> : <FaCopy size={14}/>} 
                  {isCopied ? '已复制' : '复制'}
              </button>
              <div style={styles.popArrow}></div>
          </div>
      )}

      {/* 悬浮球 */}
      {!isAiOpen && (
        <div 
            style={{...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom}}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart} 
            onMouseMove={(e) => draggingRef.current && handleTouchMove(e)}
            onMouseUp={handleTouchEnd}
        >
            <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {/* 展开窗口 */}
      {isAiOpen && (
        <>
            {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
            
            {/* 侧边栏 */}
            <div style={{...styles.sidebar, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)'}}>
                <div style={styles.sidebarHeader}>
                    <h3>历史记录</h3>
                    <button onClick={createNewSession} style={styles.newChatBtn}><FaPlus size={12}/> 新对话</button>
                </div>
                <div style={styles.sessionList}>
                    {sessions.map(s => (
                        <div key={s.id} onClick={() => switchSession(s.id)} style={{
                            ...styles.sessionItem,
                            background: currentSessionId === s.id ? '#eff6ff' : 'transparent',
                            color: currentSessionId === s.id ? '#2563eb' : '#334155'
                        }}>
                            <div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                {s.title}
                            </div>
                            {currentSessionId === s.id && (
                                <div style={{display:'flex', gap:8}}>
                                    <FaEdit size={12} onClick={(e)=>renameSession(e, s.id)} style={{cursor:'pointer'}}/>
                                    <FaTrashAlt size={12} onClick={(e)=>deleteSession(e, s.id)} style={{cursor:'pointer', color:'#ef4444'}}/>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 主聊天界面 */}
            <div style={styles.chatWindow}>
                {/* 顶部 */}
                <div style={styles.header}>
                    <button onClick={() => setShowSidebar(true)} style={styles.headerIconBtn}><FaList size={16}/></button>
                    <div style={{flex:1, textAlign:'center', fontWeight:'bold', color:'#334155', fontSize:'0.9rem'}}>
                        AI 助教 {isActivated ? '(已激活)' : `(免费: ${remainingQuota})`}
                    </div>
                    <button onClick={() => setShowSettings(true)} style={styles.headerIconBtn}><FaCog size={16}/></button>
                </div>

                {/* 消息流区域 */}
                <div ref={historyRef} style={styles.messageArea}>
                    {messages.length === 0 && (
                        <div style={styles.emptyState}>
                            <FaRobot size={40} color="#cbd5e1"/>
                            <p style={{color:'#94a3b8', marginTop:10, fontSize:'0.9rem'}}>
                                有什么问题都可以问我哦<br/>
                                <span style={{fontSize:'0.75rem', opacity:0.8}}>支持划词翻译、语音提问</span>
                            </p>
                        </div>
                    )}
                    
                    {messages.map((m, i) => (
                        <div key={i} style={{...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                            <div style={{
                                ...styles.bubbleWrapper,
                                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                            }}>
                                {/* 消息内容 */}
                                <div style={{
                                    ...styles.bubble,
                                    background: m.role === 'user' ? '#f1f5f9' : 'transparent',
                                    borderRadius: m.role === 'user' ? '12px' : '0',
                                    padding: m.role === 'user' ? '10px 14px' : '0',
                                    textAlign: m.role === 'user' ? 'right' : 'left'
                                }}>
                                    {m.role === 'user' ? (
                                        <div style={{fontSize:'0.95rem', color:'#1e293b', fontWeight:500}}>{m.content}</div>
                                    ) : (
                                        <div className="notion-md">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]} 
                                                components={{
                                                    h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
                                                    h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
                                                    h3: ({children}) => <h3 style={styles.h3}>{children}</h3>,
                                                    p: ({children}) => <p style={styles.p}>{React.Children.map(children, c => typeof c==='string'?<PinyinRenderer text={c} show={config.showPinyin}/>:c)}</p>,
                                                    strong: ({children}) => <strong style={styles.strong}>{children}</strong>,
                                                    ul: ({children}) => <ul style={styles.ul}>{children}</ul>,
                                                    li: ({children}) => <li style={styles.li}>{children}</li>,
                                                    del: ({children}) => <del style={styles.del}>{children}</del>,
                                                    table: ({children}) => <div style={{overflowX:'auto'}}><table style={styles.table}>{children}</table></div>,
                                                    th: ({children}) => <th style={styles.th}>{children}</th>,
                                                    td: ({children}) => <td style={styles.td}>{React.Children.map(children, c => typeof c==='string'?<PinyinRenderer text={c} show={config.showPinyin}/>:c)}</td>
                                                }}
                                            >
                                                {m.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>

                                {/* 底部操作栏 - 修复：添加拼音开关 */}
                                <div style={styles.msgActionBar}>
                                    {m.role === 'assistant' && !loading && (
                                        <>
                                            <button onClick={() => playInternalTTS(m.content)} style={styles.msgActionBtn} title="朗读">
                                                <FaVolumeUp/>
                                            </button>
                                            <button onClick={() => copyText(m.content)} style={styles.msgActionBtn} title="复制">
                                                <FaCopy/>
                                            </button>
                                            {/* 修复：这里加回了快捷拼音开关 */}
                                            <button 
                                                onClick={() => setConfig({...config, showPinyin: !config.showPinyin})} 
                                                style={{...styles.msgActionBtn, color: config.showPinyin ? '#4f46e5' : '#94a3b8'}} 
                                                title="切换拼音"
                                            >
                                                <FaFont size={12} /> 拼
                                            </button>
                                        </>
                                    )}
                                    {m.role === 'user' && (
                                        <button onClick={() => deleteMessage(i)} style={{...styles.msgActionBtn, color:'#ef4444'}} title="删除"><FaTrashAlt/></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 底部功能区 */}
                <div style={styles.footer}>
                    {/* 横向滚动建议 (修复：滑动与样式) */}
                    {!loading && suggestions.length > 0 && (
                        <div style={styles.scrollSuggestionContainer}>
                            {suggestions.map((s, idx) => (
                                <button key={idx} onClick={() => handleSend(s)} style={styles.scrollSuggestionBtn}>
                                    <FaLightbulb color="#4f46e5" size={10} style={{marginRight:6}}/>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {/* 输入框与 TTS 状态 */}
                    <div style={styles.inputContainer}>
                        {isPlaying && (
                            <div style={styles.ttsBar} onClick={() => setIsPlaying(false)}>
                                <FaVolumeUp className="animate-pulse"/> 正在朗读... <FaStop/>
                            </div>
                        )}
                        
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
                                <button onClick={() => handleSend()} disabled={loading} style={styles.sendBtn}>
                                    <FaPaperPlane size={15}/>
                                </button>
                            ) : (
                                <button 
                                    onClick={toggleListening} 
                                    style={{...styles.micBtn, background: isListening ? '#ef4444' : 'transparent'}}
                                >
                                    <FaMicrophone size={18} color={isListening ? '#fff' : '#94a3b8'} className={isListening ? 'animate-pulse' : ''}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 底部阴影关闭区 */}
            <div style={styles.closeArea} onClick={() => setIsAiOpen(false)}>
                <FaChevronUp color="rgba(255,255,255,0.8)" size={14} />
            </div>
        </>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div style={styles.settingsOverlay} onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
            <div style={styles.settingsModal}>
                <div style={styles.modalHeader}>
                    <h3>AI 设置</h3>
                    <button onClick={()=>setShowSettings(false)} style={styles.closeBtn}><FaTimes/></button>
                </div>
                <div style={styles.modalBody}>
                    {!isActivated && (
                        <div style={{background:'#fff7ed', color:'#c2410c', padding:8, borderRadius:6, fontSize:'0.85rem'}}>
                            试用剩余: {remainingQuota} / {TOTAL_FREE_QUOTA} 次
                        </div>
                    )}
                    <label style={styles.settingRow}>
                        <span>学生等级</span>
                        <select value={config.userLevel || 'H1'} onChange={e=>setConfig({...config, userLevel:e.target.value})} style={styles.select}>
                            <option value="H1">HSK 1-2 (初学者)</option>
                            <option value="H3">HSK 3 (进阶)</option>
                            <option value="H4">HSK 4+ (高级)</option>
                        </select>
                    </label>
                    <label style={styles.settingRow}>
                        <span>API Key</span>
                        <input type="password" value={config.apiKey} onChange={e=>setConfig({...config, apiKey:e.target.value})} style={styles.input}/>
                    </label>
                    <div style={styles.switchRow}>
                        <span>显示拼音</span>
                        <input type="checkbox" checked={config.showPinyin} onChange={e=>setConfig({...config, showPinyin:e.target.checked})}/>
                    </div>
                    <div style={styles.switchRow}>
                        <span>打字音效</span>
                        <input type="checkbox" checked={config.soundEnabled} onChange={e=>setConfig({...config, soundEnabled:e.target.checked})}/>
                    </div>
                    <label style={styles.settingRow}>
                        <span>语速 ({config.ttsSpeed}x)</span>
                        <input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e=>setConfig({...config, ttsSpeed:parseFloat(e.target.value)})} style={{width:'100%'}}/>
                    </label>
                    <label style={styles.settingRow}>
                        <span>发音人</span>
                        <select value={config.ttsVoice} onChange={e=>setConfig({...config, ttsVoice:e.target.value})} style={styles.select}>
                            {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                        </select>
                    </label>
                    <hr style={{margin:'10px 0', borderColor:'#f1f5f9'}}/>
                    <label style={styles.settingRow}>
                        <span>语音识别语言</span>
                        <select value={config.sttLang} onChange={e=>setConfig({...config, sttLang:e.target.value})} style={styles.select}>
                            {STT_LANGS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                        </select>
                    </label>
                    <div style={styles.switchRow}>
                        <span>识别后自动发送</span>
                        <input type="checkbox" checked={config.autoSendStt} onChange={e=>setConfig({...config, autoSendStt:e.target.checked})}/>
                    </div>
                    <button onClick={()=>setShowSettings(false)} style={styles.saveBtn}>保存设置</button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0% {transform:scale(1);} 50% {transform:scale(1.2);} 100% {transform:scale(1);} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, system-ui, sans-serif; color: #333; line-height: 1.9; }
        .notion-md ul { padding-left: 1.2em; list-style: none; margin: 0.5em 0; }
        .notion-md li { position: relative; padding-left: 0.2em; margin-bottom: 4px; }
        .notion-md > ul > li::before {
            content: "▪️"; font-size: 0.7em; position: absolute; left: -1.2em; top: 0.4em; color: #333;
        }
        .notion-md ul ul > li::before {
            content: "◦"; font-size: 1.2em; position: absolute; left: -1em; top: -0.1em; color: #555;
            font-weight: bold;
        }
      `}</style>
    </>
  );
}

// --- 样式定义 ---
const styles = {
  floatingBtn: {
    position: 'fixed', width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, cursor: 'grab', touchAction: 'none' 
  },
  chatWindow: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '85%',
    background: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    display: 'flex', flexDirection: 'column', zIndex: 10000, overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
  },
  header: {
    height: 44, borderBottom: '1px solid #f1f5f9', display: 'flex', 
    alignItems: 'center', padding: '0 12px', background: '#fff', flexShrink: 0
  },
  headerIconBtn: { background:'none', border:'none', color:'#64748b', padding:8, cursor:'pointer' },
  
  messageArea: { flex: 1, overflowY: 'auto', padding: '16px 20px', display:'flex', flexDirection:'column' },
  emptyState: { marginTop:'40%', textAlign:'center' },
  messageRow: { display: 'flex', marginBottom: 24, width: '100%', flexDirection: 'column' },
  bubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '100%' },
  bubble: { fontSize: '0.95rem', width: 'fit-content', maxWidth: '100%' },
  
  msgActionBar: { display: 'flex', gap: 12, marginTop: 4, paddingLeft: 2, opacity: 0.6 },
  msgActionBtn: { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'2px 4px', fontSize:'0.85rem', display: 'flex', alignItems: 'center', gap: 4 },

  // Markdown 样式
  h1: { fontSize: '1.4em', fontWeight: 700, margin: '1em 0 0.5em 0', color:'#111', lineHeight:1.3 },
  h2: { fontSize: '1.2em', fontWeight: 600, margin: '0.8em 0 0.4em 0', borderBottom:'1px solid #f1f5f9', paddingBottom:4, color:'#333' },
  h3: { fontSize: '1.05em', fontWeight: 600, margin: '0.6em 0 0.3em 0', color:'#444' },
  p: { margin: '0 0 8px 0', color: '#333' },
  strong: { fontWeight: 700, color: '#000' },
  ul: { paddingLeft: '1.2em' }, 
  li: { marginBottom: '4px' },
  del: { textDecoration: 'line-through', color: '#ef4444', opacity: 0.7 },
  table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: '0.9em' },
  th: { border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f8fafc', fontWeight: '600', textAlign: 'left' },
  td: { border: '1px solid #e2e8f0', padding: '6px 10px', verticalAlign: 'top' },

  // 底部区域
  footer: { background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' },

  // 修复：滑动手感优化
  scrollSuggestionContainer: { 
      display: 'flex', gap: 10, padding: '12px 16px 4px 16px', overflowX: 'auto', 
      whiteSpace: 'nowrap', scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch', // iOS 关键优化
      msOverflowStyle: 'none'
  },
  scrollSuggestionBtn: { 
      flexShrink: 0, 
      background: '#ffffff', 
      border: '1px solid #e0e7ff', // 浅紫边框
      borderRadius: '20px', 
      padding: '8px 16px', 
      fontSize: '0.88rem', 
      color: '#4f46e5', // 品牌色
      cursor: 'pointer',
      display: 'flex', 
      alignItems: 'center', 
      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.08)', // 柔和阴影
      transition: 'transform 0.1s',
      fontWeight: '500'
  },

  inputContainer: { 
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 
  },
  ttsBar: { 
      background:'#eff6ff', color:'#2563eb', fontSize:'0.75rem', padding:'4px 10px', 
      borderRadius:4, display:'flex', alignItems:'center', gap:8, cursor:'pointer', alignSelf:'flex-start'
  },
  inputBox: {
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 24, padding: '4px 6px 4px 16px'
  },
  textarea: {
      flex: 1, border: 'none', background: 'transparent', resize: 'none',
      fontSize: '1rem', outline: 'none', fontFamily: 'inherit', height: '36px', lineHeight: '36px'
  },
  sendBtn: {
      width: 32, height: 32, borderRadius: '50%', background: '#4f46e5', color: '#fff',
      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink:0
  },
  micBtn: {
      width: 32, height: 32, borderRadius: '50%', border: 'none', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink:0, transition: 'background 0.2s'
  },

  // 侧边栏
  sidebar: {
      position: 'fixed', top: 0, left: 0, width: '75%', maxWidth: 280, height: '85%',
      background: '#f8fafc', borderRight: '1px solid #e2e8f0', zIndex: 10002,
      transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column'
  },
  sidebarOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:10001 },
  sidebarHeader: { padding: 20, borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' },
  newChatBtn: { background:'#fff', border:'1px solid #cbd5e1', borderRadius:6, padding:'4px 8px', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:4, cursor:'pointer' },
  sessionList: { flex: 1, overflowY: 'auto', padding: 10 },
  sessionItem: { padding: '12px', borderRadius: 8, marginBottom: 4, fontSize: '0.9rem', cursor: 'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' },

  closeArea: {
      position: 'fixed', bottom: 0, left: 0, width: '100%', height: '15%',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))',
      backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer'
  },

  // Popover 菜单
  popover: {
      position: 'fixed', transform: 'translateX(-50%)', background: '#1e293b', 
      borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 11000, color: '#fff'
  },
  popArrow: {
      position: 'absolute', bottom: -6, left: '50%', marginLeft: -6,
      borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b'
  },
  popBtn: { background:'transparent', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.85rem' },
  popDivider: { width: 1, height: 16, background: 'rgba(255,255,255,0.3)' },

  // 设置
  settingsOverlay: { position:'fixed', inset:0, zIndex:12000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' },
  settingsModal: { width: '85%', maxWidth: 340, background: '#fff', borderRadius: 16, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc' },
  closeBtn: { background:'none', border:'none', fontSize:'1.2rem', color:'#64748b', cursor:'pointer' },
  modalBody: { padding: 20, display:'flex', flexDirection:'column', gap: 16 },
  settingRow: { display:'flex', flexDirection:'column', gap:6, fontSize:'0.9rem', fontWeight:600, color:'#475569' },
  switchRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.9rem', color:'#334155' },
  input: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' },
  select: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', background:'#fff' },
  saveBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', marginTop: 10, cursor:'pointer' }
};
