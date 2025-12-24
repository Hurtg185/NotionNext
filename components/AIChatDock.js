import React, { useState, useEffect, useRef } from 'react';
import {
  FaPaperPlane, FaChevronUp, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaRedo, FaCommentDots, FaEraser
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { pinyin } from 'pinyin-pro'; 

// 默认配置
const DEFAULT_CONFIG = {
  apiKey: '',
  modelId: 'deepseek-ai/deepseek-v3.2',
  systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。排版要求：使用清晰的标题（###）、列表（-）和加粗（**）来组织内容，重点内容请用中文和缅甸语双语对照。',
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
  showPinyin: true,
  autoTTS: false,
  soundEnabled: true // 新增：是否开启打字音效
};

const VOICES = [
  { label: '中文女声 - 晓晓 (多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { label: '中文女声 - 晓晓', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '中文女声 - 晓攸', value: 'zh-CN-XiaoyouNeural' },
  { label: '中文男声 - 云希', value: 'zh-CN-YunxiNeural' },
  { label: '缅甸女声 - Nilar', value: 'my-MM-NilarNeural' },
  { label: '缅甸男声 - Thiha', value: 'my-MM-ThihaNeural' }
];

// --- 简易音效引擎 (无需外部文件) ---
const playTickSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine'; // 正弦波
    osc.frequency.setValueAtTime(800, ctx.currentTime); // 频率
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime); // 音量很小
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // 忽略音频错误
  }
};

// --- 拼音渲染组件 ---
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

export default function AIChatDock({ contextData }) {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 拖动按钮状态
  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('ai_dock_config_v8');
      if (savedConfig) {
        try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }); }
        catch (e) { console.error('Config load error', e); }
      }
    }
  }, []);

  useEffect(() => {
    if (historyRef.current && expanded) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, expanded, loading]);

  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('ai_dock_config_v8', JSON.stringify(newConfig));
  };

  // --- 拖动逻辑 ---
  const handleDragStart = (e) => {
    setIsDragging(false);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleDragEnd = (e) => {
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    
    // 如果移动距离很小，视为点击
    if (Math.abs(clientX - dragStartRef.current.x) < 5 && Math.abs(clientY - dragStartRef.current.y) < 5) {
      if (!isDragging) {
        setExpanded(true);
      }
    }
    setIsDragging(false);
  };

  const handleDragMove = (e) => {
    // 简单实现：这里为了代码简洁，实际只在 End 时判断点击。
    // 如果需要实时拖动效果，需要绑定 window 事件更新 btnPos。
    // 这里为了保持代码在 React 组件内的完整性，采用简化版：固定位置，仅作点击触发。
    // 如果必须拖动，建议使用 transform。此处保留点击功能优先。
    setIsDragging(true); 
  };
  
  // 简单的实时拖动实现 (覆盖上面的逻辑)
  const [dragOffset, setDragOffset] = useState({x:0, y:0});
  const handleTouchMove = (e) => {
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const deltaX = dragStartRef.current.x - clientX;
    const deltaY = dragStartRef.current.y - clientY;
    // 简单的视觉跟随
    e.target.style.transform = `translate(${-deltaX}px, ${-deltaY}px)`;
  };

  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(true);

    const voice = config.ttsVoice;  
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
    } catch (e) {   
      console.error('TTS Error', e);   
      setIsPlaying(false);  
    }
  };

  const stopTTS = () => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先在设置中填入您的 API Key');
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

    const apiMessages = [  
        { role: 'system', content: config.systemPrompt },  
        ...newMessages.slice(-6),   
        { role: 'user', content: contextData ? `[当前教材内容]\n标题：${contextData.title}\n句型：${contextData.pattern}\n\n学生问题：${userText}` : userText }   
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

      if (!response.ok) {  
         const errText = await response.text();  
         throw new Error(`服务错误 (${response.status}): ${errText.substring(0, 100)}`);  
      }  

      const reader = response.body.getReader();  
      const decoder = new TextDecoder();  
      let done = false;  
      let fullContent = '';  
      let buffer = '';  
      let soundThrottler = 0; // 节流音效

      while (!done) {  
        const { value, done: readerDone } = await reader.read();  
        done = readerDone;  
        const chunk = decoder.decode(value, { stream: true });  
        buffer += chunk;  
          
        const lines = buffer.split('\n');  
        buffer = lines.pop(); 

        for (const line of lines) {  
            const trimmedLine = line.trim();  
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;  
              
            if (trimmedLine.startsWith('data: ')) {  
                try {  
                    const jsonStr = trimmedLine.replace('data: ', '');  
                    const data = JSON.parse(jsonStr);  
                    const delta = data.choices?.[0]?.delta?.content || '';  
                    if (delta) {  
                        fullContent += delta;  
                        
                        // 播放打字音效
                        if (config.soundEnabled) {
                            soundThrottler++;
                            if (soundThrottler % 2 === 0) playTickSound(); 
                        }

                        setMessages(prev => {  
                            const last = prev[prev.length - 1];  
                            if (last.role === 'assistant') {  
                                return [...prev.slice(0, -1), { ...last, content: fullContent }];  
                            }  
                            return prev;  
                        });  
                    }  
                } catch (e) { }  
            }  
        }  
      }  

      if (config.autoTTS && fullContent && !abortControllerRef.current.signal.aborted) {  
          playInternalTTS(fullContent);  
      }  

    } catch (err) {  
      if (err.name !== 'AbortError') {  
          console.error("Chat Error:", err);  
          setMessages(prev => {  
              const msgs = [...prev];  
              msgs[msgs.length - 1] = { role: 'assistant', content: `❌ 出错了: ${err.message}` };  
              return msgs;  
          });  
      }  
    } finally {  
      setLoading(false);  
      abortControllerRef.current = null;  
    }
  };

  return (
    <>
      {/* 悬浮按钮 (仅当未展开时显示) */}
      {!expanded && (
        <div 
            style={styles.floatingBtn}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
            onClick={() => setExpanded(true)}
        >
            <FaCommentDots size={24} color="#fff" />
        </div>
      )}

      {/* 展开后的主窗口 */}
      {expanded && (
        <>
            {/* 顶部主窗口区域 85% */}
            <div style={styles.chatWindow}>
                <div style={styles.chatHeader}>
                    <div style={{display:'flex', alignItems:'center', gap: 10}}>
                        <div style={{
                            ...styles.avatar, 
                            ...(loading ? styles.avatarPulse : {}) // 动态动画
                        }}>
                            <FaRobot size={18} color="#fff" />
                        </div>
                        <div>
                            <span style={{fontWeight:'bold', color:'#334155', display:'block', fontSize:'0.95rem'}}>AI 助教</span>
                            {loading && <span style={styles.typingStatus}>正在输入...</span>}
                        </div>
                    </div>
                    <div style={{display:'flex', gap: 12}}>
                        <button onClick={() => setMessages([])} style={styles.headerBtn} title="清空对话"><FaEraser size={16} /></button>
                        <button onClick={() => setShowSettings(true)} style={styles.headerBtn}><FaCog size={18} /></button>
                    </div>
                </div>

                <div ref={historyRef} style={styles.chatHistory}>
                    {messages.length === 0 && (
                        <div style={styles.emptyState}>
                            <FaRobot size={48} style={{color:'#e2e8f0', marginBottom:16}} />
                            <p style={{color:'#94a3b8'}}>点击下方输入框开始提问</p>
                        </div>
                    )}
                    
                    {messages.map((m, i) => (
                        <div key={i} style={styles.messageRow}>
                            {/* 角色标识 */}
                            <div style={styles.roleLabel}>
                                {m.role === 'user' ? '🙋‍♂️ 我' : '🤖 AI'}
                            </div>
                            
                            {/* 内容区域 (无气泡，全宽) */}
                            <div style={styles.messageContent}>
                                {m.role === 'assistant' ? (
                                    <div className="markdown-body">
                                        <ReactMarkdown
                                            components={{
                                                p: ({children}) => <p>{React.Children.map(children, c => typeof c === 'string' ? <PinyinRenderer text={c} show={config.showPinyin}/> : c)}</p>,
                                                li: ({children}) => <li>{React.Children.map(children, c => typeof c === 'string' ? <PinyinRenderer text={c} show={config.showPinyin}/> : c)}</li>,
                                                h3: ({children}) => <h3>{React.Children.map(children, c => typeof c === 'string' ? <PinyinRenderer text={c} show={config.showPinyin}/> : c)}</h3>,
                                                strong: ({children}) => <strong>{React.Children.map(children, c => typeof c === 'string' ? <PinyinRenderer text={c} show={config.showPinyin}/> : c)}</strong>
                                            }}
                                        >
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div style={{fontSize:'1rem', color:'#0f172a', lineHeight:1.6}}>
                                        {m.content}
                                    </div>
                                )}
                            </div>

                            {/* 操作栏 */}
                            {m.role === 'assistant' && !loading && (
                                <div style={styles.msgActions}>
                                    <button onClick={() => playInternalTTS(m.content)} style={styles.actionIconBtn} title="朗读"><FaVolumeUp/></button>
                                    <button onClick={() => copyText(m.content)} style={styles.actionIconBtn} title="复制"><FaCopy/></button>
                                </div>
                            )}
                            <div style={styles.divider} />
                        </div>
                    ))}
                </div>

                <div style={styles.inputArea}>
                    {isPlaying && (
                        <button onClick={stopTTS} style={styles.stopBtn}>
                            <FaStop size={12} /> 停止朗读
                        </button>
                    )}
                    <div style={styles.inputWrapper}>
                        <input 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleSend()} 
                            placeholder="输入问题..." 
                            style={styles.chatInput}
                        />
                        <button onClick={() => handleSend()} disabled={loading} style={styles.sendBtn}>
                            <FaPaperPlane size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 底部 15% 阴影区，点击关闭 */}
            <div 
                style={styles.bottomShadowCloseArea} 
                onClick={() => setExpanded(false)}
            >
                <div style={styles.closeHint}>
                    <FaChevronUp size={12}/> 点击此处收起
                </div>
            </div>
        </>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div style={styles.settingsOverlay}>
          <div style={styles.settingsModal}>
            <div style={styles.settingsHeader}>
              <h3 style={{margin:0}}>设置</h3>
              <button onClick={() => setShowSettings(false)} style={styles.headerBtn}><FaTimes size={18}/></button>
            </div>
            <div style={styles.settingsBody}>
              <label>
                <div style={styles.label}>API Key</div>
                <input type="password" value={config.apiKey} onChange={e => saveConfig({...config, apiKey: e.target.value})} style={styles.input}/>
              </label>
              
              <div style={styles.switchRow}>
                <span>显示拼音</span>
                <input type="checkbox" checked={config.showPinyin} onChange={e => saveConfig({...config, showPinyin: e.target.checked})}/>
              </div>

              <div style={styles.switchRow}>
                <span>生成时音效</span>
                <input type="checkbox" checked={config.soundEnabled} onChange={e => saveConfig({...config, soundEnabled: e.target.checked})}/>
              </div>
              
              <div style={styles.switchRow}>
                <span>自动朗读</span>
                <input type="checkbox" checked={config.autoTTS} onChange={e => saveConfig({...config, autoTTS: e.target.checked})}/>
              </div>

              <label>
                <div style={styles.label}>发音人</div>
                <select value={config.ttsVoice} onChange={e => saveConfig({...config, ttsVoice: e.target.value})} style={styles.input}>
                  {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </label>
              
              <label>
                <div style={styles.label}>系统 Prompt</div>
                <textarea value={config.systemPrompt} onChange={e => saveConfig({...config, systemPrompt: e.target.value})} rows={3} style={styles.textarea}/>
              </label>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* 全局动画定义 */
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); transform: scale(1); }
            70% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); transform: scale(1.05); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); transform: scale(1); }
        }
        
        .markdown-body { 
            font-size: 1rem; 
            color: #334155; 
            line-height: 1.8;
            user-select: text; /* 允许选择 */
        }
        .markdown-body p { margin-bottom: 12px; }
        .markdown-body strong { color: #2563eb; background: #eff6ff; padding: 0 4px; border-radius: 4px; }
        .markdown-body ul { padding-left: 20px; }
        .markdown-body h3 { 
            font-size: 1.1em; 
            margin-top: 16px; 
            margin-bottom: 8px; 
            color: #1e293b; 
            font-weight: 700;
        }
      `}</style>
    </>
  );
}

const styles = {
  // 悬浮按钮
  floatingBtn: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    cursor: 'pointer',
    transition: 'transform 0.1s'
  },
  
  // 聊天主窗口 - 固定在顶部，高 85%
  chatWindow: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '85%',
    background: '#fff',
    borderBottomLeftRadius: '24px',
    borderBottomRightRadius: '24px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  
  // 顶部空隙与Header
  chatHeader: {
    height: '60px',
    padding: '10px 20px 0 20px', // 顶部留一点空隙
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    flexShrink: 0
  },
  
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: '#3b82f6',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  avatarPulse: {
    animation: 'pulse 1.5s infinite' // 动态动画
  },
  typingStatus: { fontSize: '0.7rem', color: '#64748b' },
  headerBtn: { background:'none', border:'none', color:'#94a3b8', padding:8, cursor:'pointer' },
  
  // 消息区域
  chatHistory: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    background: '#fff'
  },
  emptyState: { textAlign:'center', marginTop:'30%' },
  
  // 消息行 - 无气泡风格
  messageRow: {
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%'
  },
  roleLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginBottom: '4px',
    fontWeight: '600'
  },
  messageContent: {
    width: '100%', // 全宽
    padding: '0',  // 无内边距
    color: '#334155',
    userSelect: 'text' // 允许选择
  },
  
  divider: {
    height: '1px',
    background: '#f1f5f9',
    width: '100%',
    marginTop: '16px'
  },
  
  msgActions: { display: 'flex', gap: 10, marginTop: 8 },
  actionIconBtn: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '4px 8px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center'
  },
  
  // 底部输入区
  inputArea: {
    padding: '12px 16px',
    background: '#fff',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  inputWrapper: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#f8fafc', padding: '4px 8px', borderRadius: '24px', border: '1px solid #e2e8f0'
  },
  chatInput: {
    flex: 1, height: '40px', border: 'none', background: 'transparent',
    outline: 'none', fontSize: '1rem', paddingLeft: '8px'
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: '50%', background: '#3b82f6', color: '#fff',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  stopBtn: {
    alignSelf: 'center', fontSize: '0.75rem', padding: '4px 12px', borderRadius: '12px',
    background: '#fee2e2', color: '#ef4444', border: 'none', display: 'flex', gap: 4, alignItems: 'center'
  },
  
  // 底部阴影关闭区 (剩余的15%)
  bottomShadowCloseArea: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '15%', // 剩余空间
    background: 'rgba(0,0,0,0.3)',
    backdropFilter: 'blur(2px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  closeHint: { color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 },
  
  // 设置弹窗
  settingsOverlay: { position:'fixed', inset:0, zIndex:11000, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' },
  settingsModal: { width:'85%', maxWidth:'320px', background:'#fff', borderRadius:'16px', padding:'20px', boxShadow:'0 20px 50px rgba(0,0,0,0.2)' },
  settingsHeader: { display:'flex', justifyContent:'space-between', marginBottom:20 },
  settingsBody: { display:'flex', flexDirection:'column', gap:16 },
  label: { fontSize:'0.85rem', color:'#64748b', marginBottom:4, fontWeight:600 },
  input: { width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1' },
  textarea: { width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1', resize:'none' },
  switchRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.9rem', color:'#334155' }
};
