import React, { useState, useEffect, useRef } from 'react';
import {
  FaPaperPlane, FaChevronUp, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaMicrophone, FaEraser,
  FaList, FaEdit, FaTrash, FaPlus, FaLightbulb, FaFeatherAlt
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { pinyin } from 'pinyin-pro'; 

// --- 配置与常量 ---
const CONFIG_KEY = 'ai_dock_config_v9';
const HISTORY_KEY = 'ai_dock_sessions_v9';

const DEFAULT_CONFIG = {
  apiKey: '',
  modelId: 'deepseek-ai/deepseek-v3.2',
  systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。排版要求：\n1. 使用 Notion 风格的标题（# 大标题, ## 中标题, ### 小标题）组织内容。\n2. 重点词汇加粗（**）。\n3. 错误用法请使用删除线（~~错误~~）。\n4. 列表使用层级结构。\n5. 在回答的最后，请给出3个学生可能会继续问的问题，格式为：\n[建议]: 问题1 | 问题2 | 问题3',
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
  showPinyin: true,
  autoTTS: false,
  soundEnabled: true,
  sttLang: 'zh-CN', // 语音识别语言
  autoSendStt: false // 语音识别后自动发送
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
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
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
                  <rt style={{fontSize: '0.6em', color: '#64748b', fontWeight: 'normal', userSelect: 'none'}}>
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
  const [suggestions, setSuggestions] = useState([]); // 智能建议
  
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false); // 语音识别状态
  
  // 选文菜单状态
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });

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
      // 加载配置
      const savedConfig = localStorage.getItem(CONFIG_KEY);
      if (savedConfig) {
        try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }); }
        catch (e) {}
      }
      
      // 加载历史会话
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

      // 全局选文监听
      document.addEventListener('selectionchange', handleSelectionChange);
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // 自动保存会话
  useEffect(() => {
    if (!currentSessionId || sessions.length === 0) return;
    
    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        // 自动提取标题：如果标题是默认的，且有内容，取第一句
        let newTitle = s.title;
        if (s.title === '新对话' && messages.length > 0) {
            newTitle = messages[0].content.substring(0, 15);
        }
        return { ...s, messages: messages, title: newTitle, date: new Date().toISOString() };
      }
      return s;
    });

    // 只有当内容真正变化时才写入 storage，避免死循环 (简单比较长度)
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if(currentSession && JSON.stringify(currentSession.messages) !== JSON.stringify(messages)) {
         setSessions(updatedSessions);
         localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedSessions));
    }
  }, [messages, currentSessionId]); // 依赖 messages 变化

  // 滚动到底部
  useEffect(() => {
    if (historyRef.current && expanded) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, expanded, loading]);

  // --- 选文菜单逻辑 ---
  const handleSelectionChange = () => {
     // 延迟一下，等待用户松开鼠标
     setTimeout(() => {
         const selection = window.getSelection();
         const text = selection.toString().trim();
         
         if (text.length > 0 && expanded) { // 只有在展开时才显示
             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             
             // 简单的防抖或逻辑：如果已经在显示且文字一样，不更新
             setSelectionMenu({
                 show: true,
                 x: rect.left + rect.width / 2, // 居中
                 y: rect.top - 50, // 显示在上方
                 text: text
             });
         } else {
             // 这里不立即隐藏，由点击外部逻辑隐藏，或者是为了防止闪烁
             // 简单处理：如果选区没了，就隐藏
             if (!text) setSelectionMenu(prev => ({ ...prev, show: false }));
         }
     }, 100);
  };

  const handleOutsideClick = (e) => {
      // 如果点击的不是菜单本身，隐藏菜单
      const menu = document.getElementById('selection-popover');
      if (menu && !menu.contains(e.target)) {
          setSelectionMenu(prev => ({ ...prev, show: false }));
      }
  };

  // --- 悬浮按钮拖动逻辑 ---
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
        // 更新位置 (反向，因为 right/bottom)
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
      if(sessions.length <= 1) return; // 至少保留一个
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

  // --- 语音识别 ---
  const toggleListening = () => {
    if (isListening) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("您的浏览器不支持语音识别");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = config.sttLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
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
  };

  // --- 发送消息 ---
  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先在设置中配置 API Key');
      setShowSettings(true);
      return;
    }

    const userText = textToSend;  
    setInput('');  
    setSuggestions([]); // 清空旧建议
    setLoading(true);  
    
    if (abortControllerRef.current) abortControllerRef.current.abort();  
    abortControllerRef.current = new AbortController();  

    const newMessages = [...messages, { role: 'user', content: userText }];  
    setMessages([...newMessages, { role: 'assistant', content: '' }]);  

    const apiMessages = [  
        { role: 'system', content: config.systemPrompt },  
        ...newMessages.slice(-6), // 上下文限制
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

      if (!response.ok) throw new Error("网络请求失败");

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
                        setMessages(prev => {  
                            const last = prev[prev.length - 1];  
                            return [...prev.slice(0, -1), { ...last, content: fullContent }];  
                        });  
                    }  
                } catch (e) { }  
            }  
        }  
      } 
      
      // 解析建议问题 (根据 Prompt 约定)
      if (fullContent.includes('[建议]:')) {
          const parts = fullContent.split('[建议]:');
          const cleanContent = parts[0].trim();
          const suggestionText = parts[1];
          // 更新最后一条消息，去掉建议部分的文本显示
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: cleanContent }]);
          
          if(suggestionText) {
              const sugs = suggestionText.split('|').map(s => s.trim()).filter(s => s);
              setSuggestions(sugs);
          }
          
          if (config.autoTTS) playInternalTTS(cleanContent);
      } else {
          if (config.autoTTS) playInternalTTS(fullContent);
      }

    } catch (err) {  
      if (err.name !== 'AbortError') {  
          setMessages(prev => [...prev.slice(0,-1), { role: 'assistant', content: `❌ 错误: ${err.message}` }]);  
      }  
    } finally {  
      setLoading(false);  
      abortControllerRef.current = null;  
    }
  };

  // --- TTS & 工具 ---
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
    setSelectionMenu(prev => ({...prev, show: false})); // 复制后隐藏菜单
  };

  return (
    <>
      {/* 选文弹出菜单 */}
      {selectionMenu.show && (
          <div id="selection-popover" style={{...styles.popover, left: selectionMenu.x, top: selectionMenu.y}}>
              <div style={styles.popoverArrow}></div>
              <button onClick={() => playInternalTTS(selectionMenu.text)} style={styles.popBtn} title="朗读">
                  <FaVolumeUp size={14}/>
              </button>
              <div style={styles.popDivider}></div>
              <button onClick={() => copyText(selectionMenu.text)} style={styles.popBtn} title="复制">
                  <FaCopy size={14}/>
              </button>
              <div style={styles.popDivider}></div>
              <div style={{padding: '0 8px', fontSize: '0.8rem', color: '#fff', fontWeight:'bold'}}>
                   <PinyinRenderer text={selectionMenu.text} show={true} />
              </div>
          </div>
      )}

      {/* 悬浮按钮 */}
      {!expanded && (
        <div 
            style={{...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom}}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart} // 兼容PC鼠标
            onMouseMove={(e) => draggingRef.current && handleTouchMove(e)}
            onMouseUp={handleTouchEnd}
        >
            <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {/* 主界面 */}
      {expanded && (
        <>
            {/* 侧边栏遮罩 */}
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
                                <div style={{display:'flex', gap:6}}>
                                    <FaEdit size={12} onClick={(e)=>renameSession(e, s.id)} style={{cursor:'pointer'}}/>
                                    <FaTrash size={12} onClick={(e)=>deleteSession(e, s.id)} style={{cursor:'pointer', color:'#ef4444'}}/>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 聊天窗口 */}
            <div style={styles.chatWindow}>
                {/* 顶部栏 */}
                <div style={styles.header}>
                    <button onClick={() => setShowSidebar(true)} style={styles.headerIconBtn}><FaList size={18}/></button>
                    <div style={{flex:1, textAlign:'center', fontWeight:'bold', color:'#0f172a'}}>
                        AI 助教
                    </div>
                    <button onClick={() => setShowSettings(true)} style={styles.headerIconBtn}><FaCog size={18}/></button>
                </div>

                {/* 消息流 */}
                <div ref={historyRef} style={styles.messageArea}>
                    {messages.length === 0 && (
                        <div style={styles.emptyState}>
                            <FaRobot size={50} color="#cbd5e1"/>
                            <p style={{color:'#94a3b8', marginTop:10}}>你好！我是你的中文私教。</p>
                        </div>
                    )}
                    
                    {messages.map((m, i) => (
                        <div key={i} style={{
                            ...styles.messageRow,
                            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
                            {/* 头像 - 仅 AI 显示 */}
                            {m.role === 'assistant' && (
                                <div style={{...styles.avatar, ...(loading && i === messages.length-1 ? styles.pulse : {})}}>
                                    <FaRobot size={16} color="#fff"/>
                                </div>
                            )}
                            
                            {/* 消息体 */}
                            <div style={{
                                ...styles.bubble,
                                background: 'transparent', // 要求无背景
                                padding: m.role === 'user' ? '10px 14px' : '0 10px',
                                maxWidth: '90%',
                                textAlign: m.role === 'user' ? 'right' : 'left'
                            }}>
                                {m.role === 'user' ? (
                                    <div style={{fontSize:'1.1rem', fontWeight:'600', color:'#0f172a', background:'#eff6ff', padding:'8px 12px', borderRadius:'12px', display:'inline-block'}}>
                                        {m.content}
                                    </div>
                                ) : (
                                    <div className="notion-md">
                                        <ReactMarkdown
                                            components={{
                                                h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
                                                h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
                                                h3: ({children}) => <h3 style={styles.h3}>{children}</h3>,
                                                p: ({children}) => <p style={styles.p}>{React.Children.map(children, c => typeof c==='string'?<PinyinRenderer text={c} show={config.showPinyin}/>:c)}</p>,
                                                strong: ({children}) => <strong style={styles.strong}>{children}</strong>,
                                                li: ({children}) => <li style={styles.li}><span>▪️</span> <span style={{flex:1}}>{React.Children.map(children, c => typeof c==='string'?<PinyinRenderer text={c} show={config.showPinyin}/>:c)}</span></li>,
                                                del: ({children}) => <del style={styles.del}>{children}</del>
                                            }}
                                        >
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* 智能建议 */}
                    {!loading && suggestions.length > 0 && (
                        <div style={styles.suggestionsContainer}>
                            {suggestions.map((s, idx) => (
                                <button key={idx} onClick={() => handleSend(s)} style={styles.suggestionPill}>
                                    <FaLightbulb color="#eab308" size={10}/> {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 底部输入栏 */}
                <div style={styles.inputContainer}>
                    {isPlaying && (
                        <div style={styles.ttsBar} onClick={stopTTS}>
                            <FaVolumeUp className="animate-pulse"/> 正在朗读... <FaStop/>
                        </div>
                    )}
                    <div style={styles.inputBox}>
                        <textarea 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="输入问题..."
                            style={styles.textarea}
                            rows={1}
                        />
                        <button 
                            onClick={toggleListening} 
                            style={{...styles.iconBtn, color: isListening ? '#ef4444' : '#94a3b8'}}
                        >
                            <FaMicrophone size={18} className={isListening ? 'animate-pulse' : ''}/>
                        </button>
                        <button 
                            onClick={() => handleSend()} 
                            disabled={loading}
                            style={{...styles.sendBtn, opacity: loading ? 0.5 : 1}}
                        >
                            <FaPaperPlane size={16}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* 底部关闭区 */}
            <div style={styles.closeArea} onClick={() => setExpanded(false)}>
                <FaChevronUp color="rgba(255,255,255,0.8)" />
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
                        <span>语音语速 ({config.ttsSpeed}x)</span>
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
                    }} style={styles.saveBtn}>保存</button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0% {transform:scale(1);opacity:1;} 50% {transform:scale(1.1);opacity:0.8;} 100% {transform:scale(1);opacity:1;} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        
        /* Notion 风格样式重置 */
        .notion-md { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif; color: #37352f; line-height: 1.8; }
        .notion-md ul { padding-left: 0; list-style: none; margin: 0; }
        .notion-md li { margin-bottom: 4px; display: flex; align-items: flex-start; gap: 8px; }
      `}</style>
    </>
  );
}

// --- 样式表 ---
const styles = {
  // 悬浮按钮
  floatingBtn: {
    position: 'fixed', width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)', // 蓝紫色
    boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, cursor: 'grab', touchAction: 'none' 
  },
  
  // 聊天窗
  chatWindow: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '85%',
    background: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    display: 'flex', flexDirection: 'column', zIndex: 10000, overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
  },
  header: {
    height: 56, borderBottom: '1px solid #e5e7eb', display: 'flex',
    alignItems: 'center', padding: '0 16px', background: '#fff'
  },
  headerIconBtn: { background:'none', border:'none', color:'#64748b', padding:8, cursor:'pointer' },
  
  // 消息区
  messageArea: { flex: 1, overflowY: 'auto', padding: '20px 16px', display:'flex', flexDirection:'column' },
  emptyState: { marginTop:'30%', textAlign:'center' },
  messageRow: { display: 'flex', marginBottom: 24, width: '100%', gap: 10 },
  avatar: {
      width: 32, height: 32, borderRadius: 6, background: '#4f46e5',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4
  },
  pulse: { animation: 'pulse 1.5s infinite' },
  
  // Markdown 样式 (Notion 风格)
  bubble: { fontSize: '1rem' },
  h1: { fontSize: '1.7em', fontWeight: 800, margin: '1em 0 0.5em 0', letterSpacing: '-0.02em', color:'#111' },
  h2: { fontSize: '1.4em', fontWeight: 700, margin: '0.8em 0 0.4em 0', borderBottom:'1px solid #e5e7eb', paddingBottom:4, color:'#333' },
  h3: { fontSize: '1.2em', fontWeight: 600, margin: '0.6em 0 0.3em 0', color:'#444' },
  p: { margin: '0 0 10px 0', color: '#37352f' },
  strong: { fontWeight: 700, color: '#111' },
  li: { color: '#37352f' },
  del: { textDecoration: 'line-through', color: '#ef4444', opacity: 0.8 },

  // 建议
  suggestionsContainer: { display:'flex', gap:8, flexWrap:'wrap', marginTop:-10, marginLeft: 42, marginBottom: 20 },
  suggestionPill: { 
      background: '#fefce8', border: '1px solid #fde047', borderRadius: 20, 
      padding: '6px 12px', fontSize: '0.85rem', color: '#854d0e', cursor: 'pointer',
      display:'flex', alignItems:'center', gap:6
  },

  // 底部输入
  inputContainer: { 
      padding: '16px', borderTop: '1px solid #f1f5f9', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 8 
  },
  ttsBar: { 
      background:'#eff6ff', color:'#2563eb', fontSize:'0.8rem', padding:'4px 10px', 
      borderRadius:4, display:'flex', alignItems:'center', gap:8, cursor:'pointer', alignSelf:'flex-start'
  },
  inputBox: {
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '6px 12px'
  },
  textarea: {
      flex: 1, border: 'none', background: 'transparent', resize: 'none',
      fontSize: '1rem', outline: 'none', fontFamily: 'inherit', height: '44px', lineHeight: '44px'
  },
  iconBtn: { background:'none', border:'none', cursor:'pointer', padding:8, display:'flex', alignItems:'center' },
  sendBtn: {
      width: 36, height: 36, borderRadius: '50%', background: '#4f46e5', color: '#fff',
      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink:0
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

  // 底部关闭区
  closeArea: {
      position: 'fixed', bottom: 0, left: 0, width: '100%', height: '15%',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))',
      backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer'
  },

  // 选文菜单 Popover
  popover: {
      position: 'fixed', transform: 'translateX(-50%)', background: '#1e293b', 
      borderRadius: 8, padding: '6px', display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 11000, color: '#fff'
  },
  popoverArrow: {
      position: 'absolute', bottom: -6, left: '50%', marginLeft: -6,
      borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b'
  },
  popBtn: { background:'transparent', border:'none', color:'#fff', padding:'6px', cursor:'pointer', display:'flex', borderRadius:4 },
  popDivider: { width: 1, height: 16, background: 'rgba(255,255,255,0.2)' },

  // 设置弹窗
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
