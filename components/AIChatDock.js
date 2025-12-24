import React, { useState, useEffect, useRef } from 'react';
import {
  FaPaperPlane, FaChevronUp, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaMicrophone, FaEraser,
  FaList, FaEdit, FaTrashAlt, FaPlus, FaLightbulb, FaFeatherAlt,
  FaLanguage, FaCheck
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm'; // 建议安装: npm install remark-gfm 以支持表格
import { pinyin } from 'pinyin-pro'; 

// --- 配置与常量 ---
const CONFIG_KEY = 'ai_dock_config_v11';
const HISTORY_KEY = 'ai_dock_sessions_v11';

const DEFAULT_CONFIG = {
  apiKey: '',
  modelId: 'deepseek-ai/deepseek-v3.2',
  systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。排版要求：\n1. 使用 Notion 风格排版，重点清晰。\n2. 列表请使用多级结构，逻辑分明。\n3. 重点词汇请加粗(**)。\n4. 涉及表格时请使用 Markdown 表格。\n5. 在回答最后，请严格按照格式给出3个建议追问：\n[建议]: 问题1 | 问题2 | 问题3',
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
  showPinyin: true,
  autoTTS: false,
  soundEnabled: true,
  sttLang: 'zh-CN', 
  autoSendStt: false 
};

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
  const regex = /([\u4e00-\u9fa5]+)/g; 
  const parts = text.split(regex);
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

export default function AIChatDock({ contextData }) {
  // 状态管理
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]); 
  
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false); 
  
  // 选文菜单
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false); // 复制反馈

  // 悬浮按钮位置
  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- 初始化 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem(CONFIG_KEY);
      if (savedConfig) {
        try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }); }
        catch (e) {}
      }
      
      const savedSessions = localStorage.getItem(HISTORY_KEY);
      let parsedSessions = [];
      if (savedSessions) {
        try { parsedSessions = JSON.parse(savedSessions); } catch(e){}
      }
      
      if (parsedSessions.length === 0) {
        const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() };
        parsedSessions = [newSession];
      }
      
      setSessions(parsedSessions);
      setCurrentSessionId(parsedSessions[0].id);
      setMessages(parsedSessions[0].messages);

      // 监听选文
      document.addEventListener('selectionchange', handleSelectionChange);
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // 自动保存
  useEffect(() => {
    if (!currentSessionId || sessions.length === 0) return;
    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        let newTitle = s.title;
        // 如果是新对话且有消息，自动更新标题
        if (s.title === '新对话' && messages.length > 0) {
            newTitle = messages[0].content.substring(0, 15);
        }
        return { ...s, messages: messages, title: newTitle, date: new Date().toISOString() };
      }
      return s;
    });

    const currentSession = sessions.find(s => s.id === currentSessionId);
    if(currentSession && JSON.stringify(currentSession.messages) !== JSON.stringify(messages)) {
         setSessions(updatedSessions);
         localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedSessions));
    }
  }, [messages, currentSessionId]); 

  // 自动滚动
  useEffect(() => {
    if (historyRef.current && expanded) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, expanded, loading]);

  // --- 选文菜单逻辑 (优化版) ---
  const handleSelectionChange = () => {
     // 使用 debounce 防止移动端选区变化过快闪烁
     if (window.selectionTimeout) clearTimeout(window.selectionTimeout);
     window.selectionTimeout = setTimeout(() => {
         const selection = window.getSelection();
         if (!selection || selection.rangeCount === 0) return;

         const text = selection.toString().trim();
         
         if (text.length > 0 && expanded) { 
             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             
             // 计算位置，防止超出屏幕
             let top = rect.top - 50;
             let left = rect.left + rect.width / 2;
             
             if (top < 10) top = rect.bottom + 10; // 如果上方没空间，显示在下方
             
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
      // 如果点击的不是菜单且不是选区本身
      if (menu && !menu.contains(e.target)) {
          // 在触摸屏上，如果不点击菜单，通常希望清除菜单
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
        setExpanded(true);
    }
    draggingRef.current = false;
  };

  // --- 会话管理 ---
  const createNewSession = () => {
      const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() };
      const newSessions = [newSession, ...sessions];
      setSessions(newSessions);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      setShowSidebar(false);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newSessions));
  };

  const switchSession = (id) => {
      const session = sessions.find(s => s.id === id);
      if (session) {
          setCurrentSessionId(id);
          setMessages(session.messages || []);
          setShowSidebar(false);
      }
  };

  const deleteSession = (e, id) => {
      e.stopPropagation();
      if(sessions.length <= 1) return; 
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newSessions));
      if (id === currentSessionId) {
          setCurrentSessionId(newSessions[0].id);
          setMessages(newSessions[0].messages);
      }
  };
  
  const renameSession = (e, id) => {
      e.stopPropagation();
      const newTitle = prompt("请输入新标题");
      if(newTitle) {
          const newSessions = sessions.map(s => s.id === id ? {...s, title: newTitle} : s);
          setSessions(newSessions);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(newSessions));
      }
  };

  const deleteMessage = (index) => {
      if (confirm('确定删除这条消息吗？')) {
          setMessages(prev => prev.filter((_, i) => i !== index));
      }
  };

  // --- 语音识别 ---
  const toggleListening = () => {
    if (isListening) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        return;
    }

    // 兼容不同浏览器前缀
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("抱歉，您的浏览器不支持语音识别功能，请尝试 Chrome 或 Safari。");
        return;
    }

    try {
        const recognition = new SpeechRecognition();
        recognition.lang = config.sttLang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (config.autoSendStt) {
                handleSend(transcript);
            } else {
                setInput(prev => prev + transcript);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) {
        alert('无法启动语音识别: ' + e.message);
    }
  };

  // --- 发送逻辑 (增强防卡顿) ---
  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先在设置中配置 API Key');
      setShowSettings(true);
      return;
    }

    const userText = textToSend;  
    setInput('');  
    setSuggestions([]); 
    setLoading(true);  
    
    if (abortControllerRef.current) abortControllerRef.current.abort();  
    abortControllerRef.current = new AbortController();  

    const newMessages = [...messages, { role: 'user', content: userText }];  
    setMessages([...newMessages, { role: 'assistant', content: '' }]);  

    const apiMessages = [  
        { role: 'system', content: config.systemPrompt },  
        ...newMessages.slice(-6), 
        { role: 'user', content: contextData ? `[教材: ${contextData.title}]\n${userText}` : userText }   
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
        buffer = lines.pop(); // 保留最后一个可能不完整的片段

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
                        setMessages(prev => {  
                            const last = prev[prev.length - 1];  
                            return [...prev.slice(0, -1), { ...last, content: fullContent }];  
                        });  
                    }  
                } catch (e) { }  
            }  
        }  
      } 
      
      // 处理建议和自动朗读
      let cleanContent = fullContent;
      if (fullContent.includes('[建议]:')) {
          const parts = fullContent.split('[建议]:');
          cleanContent = parts[0].trim();
          const suggestionText = parts[1];
          // 移除建议部分的文本
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: cleanContent }]);
          
          if(suggestionText) {
              const sugs = suggestionText.split('|').map(s => s.trim()).filter(s => s);
              setSuggestions(sugs);
          }
      }

      if (config.autoTTS) playInternalTTS(cleanContent);

    } catch (err) {  
      if (err.name !== 'AbortError') {  
          console.error(err);
          setMessages(prev => [...prev.slice(0,-1), { role: 'assistant', content: prev[prev.length-1].content + `\n\n[系统]: 生成中断 (${err.message})` }]);  
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
    // 去除 markdown 符号以免 TTS 读出来
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
      {/* 划词菜单 (黑色悬浮) */}
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
      {!expanded && (
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
      {expanded && (
        <>
            {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
            
            {/* 侧边栏 (历史记录) */}
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
                {/* 顶部 (变窄，极简) */}
                <div style={styles.header}>
                    <button onClick={() => setShowSidebar(true)} style={styles.headerIconBtn}><FaList size={16}/></button>
                    <div style={{flex:1, textAlign:'center', fontWeight:'bold', color:'#334155', fontSize:'0.9rem'}}>
                        AI 助教
                    </div>
                    <button onClick={() => setShowSettings(true)} style={styles.headerIconBtn}><FaCog size={16}/></button>
                </div>

                {/* 消息流区域 */}
                <div ref={historyRef} style={styles.messageArea}>
                    {messages.length === 0 && (
                        <div style={styles.emptyState}>
                            <FaRobot size={40} color="#cbd5e1"/>
                            <p style={{color:'#94a3b8', marginTop:10, fontSize:'0.9rem'}}>有什么问题都可以问我哦</p>
                        </div>
                    )}
                    
                    {messages.map((m, i) => (
                        <div key={i} style={{...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                            <div style={{
                                ...styles.bubbleWrapper,
                                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                            }}>
                                {/* 消息内容 - 无气泡，纯文本风格 */}
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
                                                remarkPlugins={[remarkGfm]} // 支持表格
                                                components={{
                                                    h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
                                                    h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
                                                    h3: ({children}) => <h3 style={styles.h3}>{children}</h3>,
                                                    p: ({children}) => <p style={styles.p}>{React.Children.map(children, c => typeof c==='string'?<PinyinRenderer text={c} show={config.showPinyin}/>:c)}</p>,
                                                    strong: ({children}) => <strong style={styles.strong}>{children}</strong>,
                                                    ul: ({children}) => <ul style={styles.ul}>{children}</ul>,
                                                    li: ({children, ...props}) => {
                                                        // 自定义列表符号：一级实心方，二级空心圆
                                                        return <li style={styles.li}>{children}</li>
                                                    },
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

                                {/* 底部操作栏 */}
                                <div style={styles.msgActionBar}>
                                    {m.role === 'assistant' && !loading && (
                                        <>
                                            <button onClick={() => playInternalTTS(m.content)} style={styles.msgActionBtn} title="朗读"><FaVolumeUp/></button>
                                            <button onClick={() => copyText(m.content)} style={styles.msgActionBtn} title="复制"><FaCopy/></button>
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
                    {/* 横向滚动建议 */}
                    {!loading && suggestions.length > 0 && (
                        <div style={styles.scrollSuggestionContainer}>
                            {suggestions.map((s, idx) => (
                                <button key={idx} onClick={() => handleSend(s)} style={styles.scrollSuggestionBtn}>
                                    <FaLightbulb color="#eab308" size={10} style={{marginRight:4}}/>
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
                            
                            {/* 动态按钮：有文字显示发送，无文字显示话筒 */}
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
            <div style={styles.closeArea} onClick={() => setExpanded(false)}>
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
                    <button onClick={()=>{
                        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
                        setShowSettings(false);
                    }} style={styles.saveBtn}>保存设置</button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0% {transform:scale(1);} 50% {transform:scale(1.2);} 100% {transform:scale(1);} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, system-ui, sans-serif; color: #333; line-height: 1.9; }
        /* 列表样式增强 */
        .notion-md ul { padding-left: 1.2em; list-style: none; margin: 0.5em 0; }
        .notion-md li { position: relative; padding-left: 0.2em; margin-bottom: 4px; }
        /* 一级列表实心方块 */
        .notion-md > ul > li::before {
            content: "▪️"; font-size: 0.7em; position: absolute; left: -1.2em; top: 0.4em; color: #333;
        }
        /* 二级列表空心圆 */
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
  msgActionBtn: { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'2px 4px', fontSize:'0.85rem' },

  // Markdown 样式细化 (Notion 风格)
  h1: { fontSize: '1.4em', fontWeight: 700, margin: '1em 0 0.5em 0', color:'#111', lineHeight:1.3 },
  h2: { fontSize: '1.2em', fontWeight: 600, margin: '0.8em 0 0.4em 0', borderBottom:'1px solid #f1f5f9', paddingBottom:4, color:'#333' },
  h3: { fontSize: '1.05em', fontWeight: 600, margin: '0.6em 0 0.3em 0', color:'#444' },
  p: { margin: '0 0 8px 0', color: '#333' },
  strong: { fontWeight: 700, color: '#000' },
  ul: { paddingLeft: '1.2em' }, 
  li: { marginBottom: '4px' },
  del: { textDecoration: 'line-through', color: '#ef4444', opacity: 0.7 },
  // 表格样式
  table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: '0.9em' },
  th: { border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f8fafc', fontWeight: '600', textAlign: 'left' },
  td: { border: '1px solid #e2e8f0', padding: '6px 10px', verticalAlign: 'top' },

  // 底部区域
  footer: { background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' },

  // 横向建议滚动
  scrollSuggestionContainer: { 
      display: 'flex', gap: 8, padding: '10px 16px 0 16px', overflowX: 'auto', 
      whiteSpace: 'nowrap', scrollbarWidth: 'none' 
  },
  scrollSuggestionBtn: { 
      flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, 
      padding: '6px 12px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer',
      display:'flex', alignItems:'center', boxShadow:'0 1px 2px rgba(0,0,0,0.05)'
  },

  // 底部输入区
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

  // Popover 菜单 (黑色)
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
