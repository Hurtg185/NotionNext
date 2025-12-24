import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FaPaperPlane, FaChevronDown, FaRobot, FaCog, FaTimes, 
  FaVolumeUp, FaStop, FaCopy, FaRedo, FaHistory, 
  FaBook, FaQuestionCircle, FaCommentDots, FaTrashAlt
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { pinyin } from 'pinyin-pro'; 

// --- 常量与配置 ---

const STORAGE_KEY_HISTORY = 'ai_chat_history_v1';
const STORAGE_KEY_CONFIG = 'ai_dock_config_v6';

const DEFAULT_SYSTEM_PROMPT = `你是一位精通汉语和缅甸语的资深翻译老师。
1. 你的目标是用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。
2. 排版要求：使用清晰的标题（###）、列表（-）和加粗（**）来组织内容。
3. 重点内容（如例句、规则）必须提供【中文】和【缅甸语】双语对照。
4. 如果学生是在做题（Context中有题目信息），且学生选错了，请第一句话明确指出错误原因（例如：“你把'在'当成'到'用了”），然后再解释。
5. 语气亲切，多给予鼓励。`;

const DEFAULT_CONFIG = {
  apiKey: '', 
  modelId: 'meta/llama-3.1-70b-instruct',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoyouNeural',
  showPinyin: true 
};

const VOICES = [
  { label: '中文女声 - 晓晓', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '中文女声 - 晓攸', value: 'zh-CN-XiaoyouNeural' },
  { label: '中文男声 - 云希', value: 'zh-CN-YunxiNeural' },
  { label: '缅甸女声 - Nilar', value: 'my-MM-NilarNeural' },
  { label: '缅甸男声 - Thiha', value: 'my-MM-ThihaNeural' }
];

// --- 拼音渲染组件 ---
const PinyinRenderer = ({ text, show }) => {
  if (!show || !text) return text;
  
  const regex = /([\u4e00-\u9fa5]+)/g; 
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) => {
        if (/[\u4e00-\u9fa5]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          const charArray = part.split('');
          return (
            <span key={index} style={{whiteSpace: 'nowrap', marginRight: '2px'}}>
              {charArray.map((char, i) => (
                <ruby key={i} style={{rubyPosition: 'over', margin: '0 1px'}}>
                  {char}
                  <rt style={{
                      fontSize: '0.6em', 
                      color: '#64748b', 
                      fontWeight: 'normal',
                      userSelect: 'none'
                  }}>
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

export default function AIChatDock({ contextData, ttsPlay }) {
  // --- State 定义 ---
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false); 
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 拖拽相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const [allHistory, setAllHistory] = useState({});

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 初始化悬浮球位置 (右侧居中)
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPosition({ x: w - 70, y: h / 2 - 30 });
  }, []);

  const currentSessionKey = useMemo(() => {
    if (!contextData) return 'free:default';
    if (contextData.type === 'grammar') return `grammar:${contextData.id}`;
    if (contextData.type === 'question') return `question:${contextData.id}`;
    return 'free:default';
  }, [contextData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (savedConfig) {
            try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }); } 
            catch (e) { console.error('Config load error', e); }
        }
        const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (savedHistory) {
            try { setAllHistory(JSON.parse(savedHistory)); }
            catch (e) { console.error('History load error', e); }
        }
    }
  }, []);

  useEffect(() => {
    if (allHistory[currentSessionKey]) {
      setMessages(allHistory[currentSessionKey].messages || []);
    } else {
      setMessages([]); 
    }
  }, [currentSessionKey, allHistory]);

  useEffect(() => {
    if (messages.length > 0) {
      const newHistoryItem = {
        id: currentSessionKey,
        type: contextData?.type || 'free',
        title: contextData?.title || '自由提问', 
        updatedAt: Date.now(),
        messages: messages
      };
      const updatedAllHistory = { ...allHistory, [currentSessionKey]: newHistoryItem };
      if (JSON.stringify(allHistory[currentSessionKey]) !== JSON.stringify(newHistoryItem)) {
         setAllHistory(updatedAllHistory);
         localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedAllHistory));
      }
    }
  }, [messages, currentSessionKey, contextData]);

  // --- 拖拽逻辑 ---
  const onDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
      moved: false
    };
    setIsDragging(true);
    // 防止移动端滚动
    if(e.touches) {
        document.body.style.overflow = 'hidden';
    }
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        dragRef.current.moved = true;
    }

    let newX = dragRef.current.initialX + deltaX;
    let newY = dragRef.current.initialY + deltaY;

    // 边界检测
    newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
    newY = Math.max(0, Math.min(window.innerHeight - 60, newY));

    setPosition({ x: newX, y: newY });
  };

  const onDragEnd = () => {
    setIsDragging(false);
    document.body.style.overflow = 'auto';
  };

  const handleIconClick = () => {
    if (!dragRef.current.moved) {
        setExpanded(true);
    }
  };

  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
  };

  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(true);
    const isBurmese = /[\u1000-\u109F]/.test(text);
    const voice = isBurmese ? 'my-MM-NilarNeural' : config.ttsVoice;
    const cleanText = text.replace(/[*#`>~\-\[\]\(\)]/g, ''); 
    let ratePercent = Math.round((config.ttsSpeed - 1) * 100);
    const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${voice}&r=${ratePercent}%`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (e) { setIsPlaying(false); }
  };

  const stopTTS = () => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先设置 API Key');
      setShowSettings(true);
      return;
    }
    const userText = textToSend;
    setInput('');
    setLoading(true);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    let userPrompt = contextData ? `[当前教材上下文]\n类型：${contextData.type}\n标题：${contextData.title}\n内容：${contextData.pattern || contextData.content || '无'}\n\n学生问题：${userText}` : userText;
    const apiMessages = [{ role: 'system', content: config.systemPrompt }, ...newMessages.slice(-6), { role: 'user', content: userPrompt }];
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, config: { apiKey: config.apiKey, modelId: config.modelId } }),
        signal: abortControllerRef.current.signal
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false; let fullContent = ''; let buffer = '';
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); 
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
                try {
                    const data = JSON.parse(trimmedLine.replace('data: ', ''));
                    const delta = data.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullContent += delta;
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            return [...prev.slice(0, -1), { ...last, content: fullContent }];
                        });
                    }
                } catch (e) { }
            }
        }
      }
      if (fullContent) playInternalTTS(fullContent);
    } catch (err) {
      if (err.name !== 'AbortError') {
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `❌ 出错了: ${err.message}` }]);
      }
    } finally { setLoading(false); }
  };

  const deleteHistory = (key, e) => {
    e.stopPropagation();
    if(confirm('确定删除这条记录吗？')) {
        const newHistory = { ...allHistory };
        delete newHistory[key];
        setAllHistory(newHistory);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
        if (key === currentSessionKey) setMessages([]);
    }
  };

  return (
    <>
      {/* 悬浮球图标 */}
      {!expanded && (
        <div 
          style={{
            ...styles.floatingIcon,
            left: position.x,
            top: position.y,
            cursor: isDragging ? 'grabbing' : 'pointer',
            transition: isDragging ? 'none' : 'all 0.1s ease-out'
          }}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
          onClick={handleIconClick}
        >
          <FaRobot size={30} color="white" />
          {loading && <div style={styles.loadingPulse} />}
        </div>
      )}

      {/* 聊天界面遮罩与容器 */}
      {expanded && (
        <div style={styles.fullOverlay}>
          <div onClick={() => setExpanded(false)} style={styles.clickableArea} />
          
          <div style={styles.chatContainer}>
            <div style={styles.chatHeader}>
              <div style={{display:'flex', alignItems:'center', gap: 12}}>
                <button onClick={() => setShowHistory(true)} style={styles.headerBtn}><FaHistory size={16} /></button>
                <div style={{display:'flex', alignItems:'center', gap: 6}}>
                   <FaRobot className="text-blue-500" />
                   <span style={{fontWeight:'bold', color:'#334155'}}>{contextData?.title || 'AI 助教'}</span>
                </div>
              </div>
              <div style={{display:'flex', gap: 16}}>
                 <button onClick={() => setShowSettings(true)} style={styles.headerBtn}><FaCog size={18} /></button>
                 <button onClick={() => setExpanded(false)} style={styles.headerBtn}><FaTimes size={20} /></button>
              </div>
            </div>

            <div ref={historyRef} style={styles.chatHistory}>
              {messages.length === 0 && (
                <div style={{textAlign:'center', marginTop: 100, color:'#cbd5e1'}}>
                  <FaRobot size={50} style={{marginBottom:15, opacity:0.1}} />
                  <p>有什么学习问题可以随时问我哦！</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%', marginBottom: '24px', display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{
                      padding: '12px 16px', borderRadius: '18px',
                      background: m.role === 'user' ? '#3b82f6' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#1e293b', 
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', lineHeight: 1.8
                  }}>
                    {m.role === 'assistant' ? (
                      <div className="markdown-body">
                        <ReactMarkdown components={{
                          p: ({children}) => <p>{React.Children.map(children, child => typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child)}</p>,
                          li: ({children}) => <li>{React.Children.map(children, child => typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child)}</li>,
                          h3: ({children}) => <h3 style={{color: '#d946ef'}}>{React.Children.map(children, child => typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child)}</h3>,
                          strong: ({children}) => <strong style={{color: '#2563eb', background: '#eff6ff', padding: '0 4px', borderRadius: '4px'}}>{React.Children.map(children, child => typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child)}</strong>
                        }}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                  {m.role === 'assistant' && m.content && (
                    <div style={styles.actionBar}>
                       <button onClick={() => playInternalTTS(m.content)} style={styles.actionBtn}><FaVolumeUp size={12}/> 朗读</button>
                       <button onClick={() => navigator.clipboard.writeText(m.content)} style={styles.actionBtn}><FaCopy size={12}/> 复制</button>
                    </div>
                  )}
                </div>
              ))}
              {loading && <div style={styles.thinkingMsg}>思考中...</div>}
              {/* 底部强制留白 */}
              <div style={{ height: '20px', flexShrink: 0 }} />
            </div>

            <div style={styles.chatInputArea}>
               {isPlaying && <button onClick={stopTTS} style={styles.stopBtn}><FaStop size={12} /></button>}
               <input 
                 value={input} 
                 onChange={e => setInput(e.target.value)} 
                 onKeyDown={e => e.key === 'Enter' && handleSend()} 
                 placeholder="输入你的汉语疑问..." 
                 style={styles.chatInput}
               />
               <button onClick={() => handleSend()} disabled={loading} style={{...styles.sendBtn, opacity: loading ? 0.5 : 1}}>
                 <FaPaperPlane size={16} />
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录抽屉 */}
      {showHistory && (
          <div style={styles.drawerOverlay}>
            <div style={styles.drawer}>
                <div style={styles.drawerHeader}>
                    <h3 style={{margin:0}}>学习记录</h3>
                    <button onClick={() => setShowHistory(false)} style={styles.headerBtn}><FaTimes/></button>
                </div>
                <div style={styles.drawerList}>
                    {Object.values(allHistory).length === 0 && <div style={{padding:40, color:'#94a3b8', textAlign:'center'}}>暂无记录</div>}
                    {Object.values(allHistory).sort((a,b)=>b.updatedAt-a.updatedAt).map(item => (
                        <div key={item.id} onClick={() => { setMessages(item.messages); setShowHistory(false); }} style={{
                            ...styles.historyItem,
                            borderLeft: item.id === currentSessionKey ? '4px solid #3b82f6' : '4px solid transparent'
                        }}>
                            <div style={{flex:1, overflow:'hidden'}}>
                                <div style={styles.historyTitle}>{item.title}</div>
                                <div style={styles.historyDate}>{new Date(item.updatedAt).toLocaleString()}</div>
                            </div>
                            <button onClick={(e) => deleteHistory(item.id, e)} style={styles.deleteBtn}><FaTrashAlt size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>
          </div>
      )}

      {/* 设置 */}
      {showSettings && (
        <div style={styles.settingsOverlay}>
          <div style={styles.settingsModal}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
              <h3 style={{margin:0}}>AI 老师配置</h3>
              <button onClick={() => setShowSettings(false)} style={styles.headerBtn}><FaTimes size={18}/></button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <label><div style={styles.label}>NVIDIA API Key</div><input type="password" value={config.apiKey} onChange={e => saveConfig({...config, apiKey: e.target.value})} style={styles.inputField}/></label>
              <label style={{display:'flex', justifyContent:'space-between'}}><div style={styles.label}>显示拼音</div><input type="checkbox" checked={config.showPinyin} onChange={e => saveConfig({...config, showPinyin: e.target.checked})}/></label>
              <label><div style={styles.label}>模型 ID</div><input value={config.modelId} onChange={e => saveConfig({...config, modelId: e.target.value})} style={styles.inputField}/></label>
              <label><div style={styles.label}>TTS 发音人</div><select value={config.ttsVoice} onChange={e => saveConfig({...config, ttsVoice: e.target.value})} style={styles.inputField}>{VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
              <label><div style={styles.label}>TTS 语速 ({config.ttsSpeed}x)</div><input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e => saveConfig({...config, ttsSpeed: parseFloat(e.target.value)})} style={{width:'100%'}}/></label>
            </div>
            <button onClick={() => setShowSettings(false)} style={styles.saveBtn}>保存并返回</button>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .markdown-body { font-size: 0.95rem; color: #334155; font-family: 'Padauk', sans-serif; }
        .markdown-body h3 { font-size: 1.1em; border-left: 4px solid #d946ef; padding-left: 8px; margin: 1em 0 0.5em; }
        .markdown-body p { margin-bottom: 0.8em; line-height: 2.2; }
        .markdown-body li { margin-bottom: 0.4em; }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.3); opacity: 0; } }
      `}</style>
    </>
  );
}

const styles = {
  floatingIcon: {
    position: 'fixed', width: '60px', height: '60px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)', zIndex: 9999, touchAction: 'none'
  },
  loadingPulse: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    border: '4px solid #3b82f6', animation: 'pulse-ring 1.5s infinite'
  },
  fullOverlay: {
    position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column',
    justifyContent: 'flex-end', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)'
  },
  clickableArea: { position: 'absolute', inset: 0, zIndex: -1 },
  chatContainer: {
    width: '100%', height: '85vh', background: '#f8fafc',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
  },
  chatHeader: {
    height: '60px', padding: '0 16px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0
  },
  chatHistory: {
    flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex',
    flexDirection: 'column', justifyContent: 'flex-start'
  },
  thinkingMsg: { alignSelf:'flex-start', background:'#fff', padding:'8px 14px', borderRadius:'12px', color:'#94a3b8', fontSize:'0.85rem' },
  chatInputArea: {
    height: '80px', padding: '0 16px 20px 16px', display: 'flex', alignItems: 'center',
    gap: '10px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0
  },
  chatInput: { flex: 1, height: '45px', borderRadius: '22px', border: '1px solid #e2e8f0', padding: '0 16px', fontSize: '1rem', outline: 'none', background: '#f8fafc' },
  sendBtn: { width: '45px', height: '45px', borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stopBtn: { width:34, height:34, borderRadius:'50%', background:'#fee2e2', color:'#ef4444', border:'none', display:'flex', alignItems:'center', justifyContent:'center' },
  actionBar: { display: 'flex', gap: '16px', marginTop: '6px' },
  actionBtn: { background:'none', border:'none', color:'#94a3b8', fontSize:'0.75rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' },
  headerBtn: { background:'none', border:'none', color:'#64748b', cursor:'pointer' },
  
  // 历史抽屉
  drawerOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:11000 },
  drawer: { position:'absolute', top:0, left:0, bottom:0, width:'80%', maxWidth:'300px', background:'#fff', display:'flex', flexDirection:'column' },
  drawerHeader: { padding:'16px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center' },
  drawerList: { flex:1, overflowY:'auto' },
  historyItem: { padding:'12px 16px', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center' },
  historyTitle: { fontSize:'0.9rem', fontWeight:'600', color:'#334155', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  historyDate: { fontSize:'0.7rem', color:'#94a3b8' },
  deleteBtn: { background:'none', border:'none', color:'#cbd5e1', padding:'8px' },

  // 设置弹窗
  settingsOverlay: { position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  settingsModal: { width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '20px', padding: '24px' },
  label: { fontSize: '0.8rem', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' },
  inputField: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' },
  saveBtn: { width:'100%', marginTop:'20px', padding:'12px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold' }
};
