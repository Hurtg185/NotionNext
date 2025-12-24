import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FaPaperPlane, FaRobot, FaCog, FaTimes, 
  FaVolumeUp, FaStop, FaCopy, FaHistory, 
  FaTrashAlt, FaHeadphones, FaHeadphonesAlt
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { pinyin } from 'pinyin-pro'; 

// --- 常量与配置 ---

const STORAGE_KEY_HISTORY = 'ai_chat_history_v1';
const STORAGE_KEY_CONFIG = 'ai_dock_config_v7'; // 更新版本号以应用新配置

const DEFAULT_SYSTEM_PROMPT = `你是一位精通汉语和缅甸语的资深翻译老师。
1. 你的目标是用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。
2. 排版要求：使用清晰的标题（###）、列表（-）和加粗（**）来组织内容。
3. 重点内容（如例句、规则）必须提供【中文】和【缅甸语】双语对照。
4. 如果学生是在做题（Context中有题目信息），且学生选错了，请第一句话明确指出错误原因（例如：“你把'在'当成'到'用了”），然后再解释。
5. 语气亲切，多给予鼓励。`;

const DEFAULT_CONFIG = {
  apiKey: '', 
  modelId: 'deepseek-ai/deepseek-v3.2',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoyouNeural',
  showPinyin: true,
  autoTTS: true // 【新增】默认开启自动朗读
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
                  <rt style={{fontSize: '0.6em', color: '#64748b', fontWeight: 'normal', userSelect: 'none'}}>{pyArray[i]}</rt>
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
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const [allHistory, setAllHistory] = useState({});

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false });

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 组件卸载时停止播放，防止内存泄漏
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 初始化悬浮球位置
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPosition({ x: w - 75, y: h / 2 });
  }, []);

  const currentSessionKey = useMemo(() => {
    if (!contextData) return 'free:default';
    const type = contextData.type || 'free';
    const id = contextData.id || 'default';
    return `${type}:${id}`;
  }, [contextData]);
  
  // 加载配置和历史记录
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (savedConfig) {
      try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }); } catch(e) {}
    }
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
      try { setAllHistory(JSON.parse(savedHistory)); } catch(e) {}
    }
  }, []);
  
  // 切换 session 时加载对应消息
  useEffect(() => {
    setMessages(allHistory[currentSessionKey]?.messages || []);
  }, [currentSessionKey, allHistory]);

  // 【关键修复】只在 AI 响应结束时保存历史记录，防止保存不完整内容
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      const lastMessage = messages[messages.length - 1];
      // 确保最后一条消息是完整的AI消息或用户消息
      if (lastMessage.role === 'user' || (lastMessage.role === 'assistant' && lastMessage.content)) {
        const newHistoryItem = {
          id: currentSessionKey,
          type: contextData?.type || 'free',
          title: contextData?.title || '自由提问',
          updatedAt: Date.now(),
          messages: messages
        };
        const updated = { ...allHistory, [currentSessionKey]: newHistoryItem };
        if (JSON.stringify(allHistory[currentSessionKey]) !== JSON.stringify(newHistoryItem)) {
           setAllHistory(updated);
           localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
        }
      }
    }
  }, [messages, loading, currentSessionKey, contextData]);
  
  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
  };
  
  // --- 拖拽逻辑 ---
  const onDragStart = (e) => {
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, initialX: position.x, initialY: position.y, moved: false };
    setIsDragging(true);
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;
    
    let newX = dragRef.current.initialX + dx;
    let newY = dragRef.current.initialY + dy;
    newX = Math.max(10, Math.min(window.innerWidth - 70, newX));
    newY = Math.max(10, Math.min(window.innerHeight - 70, newY));
    
    setPosition({ x: newX, y: newY });
  };

  const onDragEnd = () => setIsDragging(false);
  const toggleExpanded = () => { if (!dragRef.current.moved) setExpanded(!expanded); };

  // --- 核心交互 ---
  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) { alert('请先在设置中填入您的 API Key'); setShowSettings(true); return; }

    const userText = textToSend;
    setInput('');
    setLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const currentMessages = [...messages, { role: 'user', content: userText }];
    setMessages([...currentMessages, { role: 'assistant', content: '' }]);

    const apiMessages = [
        { role: 'system', content: config.systemPrompt },
        ...currentMessages.slice(-6),
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, config: { apiKey: config.apiKey, modelId: config.modelId } }),
        signal: abortControllerRef.current.signal
      });
      if (!response.ok) throw new Error('网络请求失败');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.replace('data: ', ''));
              const delta = json.choices[0]?.delta?.content || '';
              if(delta) {
                fullContent += delta;
                setMessages(prev => {
                  const list = [...prev];
                  list[list.length - 1] = { ...list[list.length - 1], content: fullContent };
                  return list;
                });
              }
            } catch(e){}
          }
        }
      }
      if (config.autoTTS && fullContent) playInternalTTS(fullContent);
    } catch (err) {
      if (err.name !== 'AbortError') {
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `❌ 出错了: ${err.message}` }]);
      }
    } finally { setLoading(false); }
  };
  
  const playInternalTTS = async (text) => {
    if (!text) return;
    stopTTS();
    setIsPlaying(true);
    const isBurmese = /[\u1000-\u109F]/.test(text);
    const voice = isBurmese ? 'my-MM-NilarNeural' : config.ttsVoice;
    const url = `/api/tts?t=${encodeURIComponent(text.replace(/[*#`>~-]/g,''))}&v=${voice}&r=${Math.round((config.ttsSpeed - 1) * 100)}%`;
    try {
      const res = await fetch(url);
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (e) { setIsPlaying(false); }
  };
  
  const stopTTS = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
    }
    setIsPlaying(false);
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
      {!expanded && (
        <div 
          style={{ ...styles.floatingIcon, left: position.x, top: position.y }}
          onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd}
          onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
          onClick={toggleExpanded}
        >
          <FaRobot size={30} />
          {loading && <div style={styles.loader} />}
        </div>
      )}

      {expanded && (
        <div style={styles.fullOverlay}>
          <div style={styles.backdrop} onClick={() => setExpanded(false)} />
          
          <div style={styles.chatContainer}>
            <div style={styles.chatHeader}>
              <div style={{display:'flex', alignItems:'center', gap: 12}}>
                <button onClick={() => setShowHistory(true)} style={styles.iconBtn}><FaHistory /></button>
                <div style={styles.headerTitle}>
                   <FaRobot color="#3b82f6" /> <span>AI 老师</span>
                </div>
              </div>
              <div style={{display:'flex', gap: 14, alignItems:'center'}}>
                <button onClick={() => saveConfig({...config, autoTTS: !config.autoTTS})} style={{...styles.iconBtn, color: config.autoTTS ? '#3b82f6' : '#94a3b8'}} title={config.autoTTS ? "关闭自动朗读" : "开启自动朗读"}>
                    {config.autoTTS ? <FaHeadphonesAlt size={18}/> : <FaHeadphones size={18}/>}
                </button>
                <button onClick={() => setShowSettings(true)} style={styles.iconBtn}><FaCog /></button>
                <button onClick={() => setExpanded(false)} style={styles.iconBtn}><FaTimes size={20}/></button>
              </div>
            </div>

            <div ref={historyRef} style={styles.historyList}>
              {messages.length === 0 && (
                <div style={styles.emptyState}>
                   <FaRobot size={50} style={{opacity:0.1, marginBottom:16}} />
                   <p>你好！我是你的 AI 助教。有问题尽管问我！</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ 
                    // 【修改】如果是AI（assistant），alignSelf为 stretch（拉伸），宽度100%
                    // 如果是用户，保持 flex-end（右对齐），宽度限制 85%
                    alignSelf: m.role === 'user' ? 'flex-end' : 'stretch', 
                    maxWidth: m.role === 'user' ? '85%' : '100%', 
                    marginBottom: 20 
                }}>
                  <div style={{ 
                      padding: '12px 16px', 
                      borderRadius: 16, 
                      // 【修改】明确指定背景颜色，防止透视背景
                      background: m.role === 'user' ? '#3b82f6' : '#ffffff', 
                      color: m.role === 'user' ? '#fff' : '#1e293b', 
                      boxShadow: '0 2px 10px rgba(0,0,0,0.08)', 
                      lineHeight: 1.8 
                  }}>
                    {m.role === 'assistant' ? (
                       <div className="markdown-body"><ReactMarkdown components={{ p: ({children}) => <p><PinyinRenderer text={children[0]} show={config.showPinyin}/></p> }}>{m.content}</ReactMarkdown></div>
                    ) : m.content}
                  </div>
                  {m.role === 'assistant' && m.content && !loading && (
                    <div style={styles.msgBar}><button onClick={() => playInternalTTS(m.content)} style={styles.msgAction}><FaVolumeUp/> 朗读</button><button onClick={() => navigator.clipboard.writeText(m.content)} style={styles.msgAction}><FaCopy/> 复制</button></div>
                  )}
                </div>
              ))}
              {loading && messages[messages.length - 1]?.content === '' && <div style={{fontSize:'0.8rem', color:'#94a3b8', alignSelf:'flex-start'}}>正在思考中...</div>}
            </div>

            <div style={styles.inputBar}>
               {isPlaying && <button onClick={stopTTS} style={styles.stopBtn}><FaStop/></button>}
               <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="输入汉语疑问..." style={styles.input} />
               <button onClick={() => handleSend()} disabled={loading} style={{...styles.sendBtn, opacity: loading ? 0.5: 1}}><FaPaperPlane/></button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={styles.popOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.popCard} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}><h3>设置</h3><button onClick={() => setShowSettings(false)} style={styles.iconBtn}><FaTimes/></button></div>
            <label><div style={styles.label}>NVIDIA API Key</div><input type="password" value={config.apiKey} onChange={e => saveConfig({...config, apiKey:e.target.value})} style={styles.popInput} /></label>
            <button onClick={() => setShowSettings(false)} style={styles.popBtn}>保存并关闭</button>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .markdown-body p { margin-bottom: 0.5em !important; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

const styles = {
  floatingIcon: { position: 'fixed', width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', touchAction: 'none', cursor: 'pointer' },
  loader: { position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#fff', animation: 'rotate 1s linear infinite' },
  fullOverlay: { position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }, 
  backdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: -1, backdropFilter: 'blur(2px)' },
  chatContainer: { width: '100%', height: '75%', background: '#f8fafc', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }, 
  chatHeader: { height: 60, padding: '0 16px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  headerTitle: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', color: '#334155' },
  historyList: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' },
  inputBar: { height: 80, padding: '0 16px 20px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  input: { flex: 1, height: 45, borderRadius: 22, border: '1px solid #e2e8f0', padding: '0 20px', outline: 'none', background: '#f8fafc', fontSize: '1rem' },
  sendBtn: { width: 45, height: 45, borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stopBtn: { width: 34, height: 34, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', border: 'none', display:'flex', alignItems:'center', justifyContent:'center' },
  iconBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 },
  msgBar: { display: 'flex', gap: 15, marginTop: 4 },
  msgAction: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', display:'flex', gap:4, alignItems:'center' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', textAlign: 'center' },
  popOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  popCard: { width: '100%', maxWidth: 350, background: '#fff', borderRadius: 20, padding: 24 },
  label: { fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', marginBottom: 4, display: 'block' },
  popInput: { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 },
  popBtn: { width: '100%', padding: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 'bold' }
};
