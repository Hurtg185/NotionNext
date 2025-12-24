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

// 更新后的教学专用 Prompt
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
  
  // 简单的正则拆分，避免破坏已有 HTML/React 结构
  // 仅对连续的中文字符串进行处理
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
  const [showHistory, setShowHistory] = useState(false); // 控制历史记录抽屉
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 所有的历史记录数据缓存
  const [allHistory, setAllHistory] = useState({});

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);

  // --- 核心逻辑 1: 计算当前的 Session Key ---
  // 根据传入的 contextData 决定当前的存储 key
  const currentSessionKey = useMemo(() => {
    if (!contextData) return 'free:default';
    if (contextData.type === 'grammar') return `grammar:${contextData.id}`;
    if (contextData.type === 'question') return `question:${contextData.id}`;
    return 'free:default';
  }, [contextData]);

  // --- 初始化与配置加载 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
        // 1. 加载配置
        const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (savedConfig) {
            try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }); } 
            catch (e) { console.error('Config load error', e); }
        }

        // 2. 加载所有历史记录
        const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (savedHistory) {
            try { setAllHistory(JSON.parse(savedHistory)); }
            catch (e) { console.error('History load error', e); }
        }
    }
  }, []);

  // --- 核心逻辑 2: 切换 Session 时恢复消息 ---
  useEffect(() => {
    if (allHistory[currentSessionKey]) {
      setMessages(allHistory[currentSessionKey].messages || []);
    } else {
      setMessages([]); // 新的 Session，清空当前显示
    }
  }, [currentSessionKey, allHistory]); // 依赖 allHistory 确保初次加载也能同步

  // --- 核心逻辑 3: 自动保存历史记录 ---
  useEffect(() => {
    if (messages.length > 0) {
      const newHistoryItem = {
        id: currentSessionKey,
        type: contextData?.type || 'free',
        title: contextData?.title || '自由提问', // 保存标题用于列表显示
        updatedAt: Date.now(),
        messages: messages
      };

      // 更新 state 中的 allHistory
      const updatedAllHistory = {
        ...allHistory,
        [currentSessionKey]: newHistoryItem
      };

      // 这里不直接 setAllHistory 以避免循环渲染，而是只在写入 localStorage 时用
      // 但为了让 UI (历史列表) 即时更新，我们需要 update state
      // 使用 JSON stringify 比较避免不必要的重渲染
      if (JSON.stringify(allHistory[currentSessionKey]) !== JSON.stringify(newHistoryItem)) {
         setAllHistory(updatedAllHistory);
         localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedAllHistory));
      }
    }
  }, [messages, currentSessionKey, contextData]);

  // --- 滚动到底部 ---
  useEffect(() => {
    if (historyRef.current && expanded) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, expanded, loading]);


  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
  };

  // --- TTS 逻辑 ---
  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(true);
    
    // 自动检测语言：如果有缅文，强制用缅甸语发音人，否则用配置的中文发音人
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

  // --- 聊天发送逻辑 ---
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
    if (!expanded) setExpanded(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    // 构建 System Context Prompt
    let finalSystemPrompt = config.systemPrompt;
    
    // 如果有教材上下文，增强 Prompt
    let userPrompt = userText;
    if (contextData) {
        userPrompt = `[当前教材上下文]\n类型：${contextData.type === 'grammar' ? '语法学习' : '题目练习'}\n标题：${contextData.title}\n内容/句型：${contextData.pattern || contextData.content || '无'}\n\n学生问题：${userText}`;
    }

    const apiMessages = [
        { role: 'system', content: finalSystemPrompt },
        ...newMessages.slice(-6), // 只带最近 6 条历史
        { role: 'user', content: userPrompt } 
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

      if (fullContent && !abortControllerRef.current.signal.aborted) {
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

  // --- 切换历史记录 (只用于浏览，点击可以"恢复"上下文显示，但不改变外部路由) ---
  // 注意：真实场景下，点击历史通常需要跳转路由。这里为了演示，只做预览。
  // 如果你想实现点击跳转，需要父组件传入 onContextChange 回调。
  const handleHistorySelect = (key) => {
     // 简单处理：如果选中的是当前 session，什么都不做
     if (key === currentSessionKey) {
        setShowHistory(false);
        return;
     }
     // 如果选中的是其他 session，在这个 Demo 中我们暂时无法"跳转页面"，
     // 但我们可以查看那个 session 的消息。
     // 实际项目中，建议这里调用 router.push('/grammar/id')
     alert("在实际项目中，这里应该跳转到对应的课程/题目页面。\n当前仅演示数据存储结构。");
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

  // 整理历史记录列表（排序）
  const sortedHistoryList = useMemo(() => {
    return Object.values(allHistory).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allHistory]);

  return (
    <>
      {expanded && <div onClick={() => setExpanded(false)} style={styles.overlay}/>}
      
      {/* 主聊天框 */}
      <div style={{...styles.chatBox, height: expanded ? '85vh' : '60px'}}>
        {expanded && (
          <div style={styles.chatHeader}>
            <div style={{display:'flex', alignItems:'center', gap: 12}}>
              {/* 历史记录按钮 */}
              <button onClick={() => setShowHistory(true)} style={styles.headerBtn} title="历史记录">
                <FaHistory size={16} />
              </button>
              <div style={{display:'flex', alignItems:'center', gap: 6}}>
                 <FaRobot className="text-blue-500" />
                 <span style={{fontWeight:'bold', color:'#334155', fontSize:'0.95rem'}}>
                    {contextData?.title || 'AI 助教'}
                 </span>
                 <span style={styles.modelTag}>{config.modelId.split('/').pop()}</span>
              </div>
            </div>
            <div style={{display:'flex', gap: 16}}>
               <button onClick={() => setShowSettings(true)} style={styles.headerBtn}><FaCog size={18} /></button>
               <button onClick={() => setExpanded(false)} style={styles.headerBtn}><FaChevronDown size={18} /></button>
            </div>
          </div>
        )}
        
        <div ref={historyRef} style={styles.chatHistory}>
             {messages.length === 0 && (
                <div style={{textAlign:'center', marginTop: 60, color:'#cbd5e1'}}>
                 <FaRobot size={40} style={{marginBottom:10, opacity:0.2}} />
                 <p>你好！我是你的专属 AI 老师。</p>
                 <p style={{fontSize:'0.85rem', marginTop:4}}>
                    {contextData ? `正在学习：${contextData.title}` : '请先设置 API Key 开始使用。'}
                 </p>
               </div>
             )}
             {messages.map((m, i) => (
               <div key={i} style={{
                   alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                   maxWidth: '92%', 
                   display: 'flex', flexDirection: 'column',
                   marginBottom: '20px'
               }}>
                 <div style={{
                     padding: '12px 16px',
                     borderRadius: '16px',
                     borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                     borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                     background: m.role === 'user' ? '#3b82f6' : '#fff',
                     color: m.role === 'user' ? '#fff' : '#1e293b', 
                     boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                     lineHeight: 1.8
                 }}>
                   {m.role === 'assistant' ? (
                      <div className="markdown-body">
                        <ReactMarkdown
                            components={{
                                p: ({node, children, ...props}) => (
                                    <p {...props}>
                                        {React.Children.map(children, child => 
                                            typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child
                                        )}
                                    </p>
                                ),
                                li: ({node, children, ...props}) => (
                                    <li {...props}>
                                        {React.Children.map(children, child => {
                                            if (typeof child === 'string') return <PinyinRenderer text={child} show={config.showPinyin} />;
                                            if (React.isValidElement(child) && child.type === 'p') {
                                                return React.cloneElement(child, {
                                                    children: React.Children.map(child.props.children, subChild => 
                                                        typeof subChild === 'string' ? <PinyinRenderer text={subChild} show={config.showPinyin} /> : subChild
                                                    )
                                                });
                                            }
                                            return child;
                                        })}
                                    </li>
                                ),
                                h3: ({node, children, ...props}) => (
                                    <h3 {...props} style={{color: '#d946ef'}}>
                                        {React.Children.map(children, child => typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child)}
                                    </h3>
                                ),
                                strong: ({node, children, ...props}) => (
                                    <strong {...props} style={{color: '#2563eb', background: '#eff6ff', padding: '0 4px', borderRadius: '4px'}}>
                                        {React.Children.map(children, child => typeof child === 'string' ? <PinyinRenderer text={child} show={config.showPinyin} /> : child)}
                                    </strong>
                                )
                            }}
                        >
                            {m.content}
                        </ReactMarkdown>
                      </div>
                   ) : m.content}
                 </div>
                 
                 {m.role === 'assistant' && !loading && (
                     <div style={styles.actionBar}>
                         <button onClick={() => playInternalTTS(m.content)} style={styles.actionBtn}>
                             <FaVolumeUp size={12}/> 朗读
                         </button>
                         <button onClick={() => copyText(m.content)} style={styles.actionBtn}>
                             <FaCopy size={12}/> 复制
                         </button>
                         {i === messages.length - 1 && (
                             <button onClick={() => handleSend(messages[i-1].content)} style={styles.actionBtn}>
                                 <FaRedo size={12}/> 重试
                             </button>
                         )}
                     </div>
                 )}
               </div>
             ))}
             {loading && messages[messages.length-1]?.role === 'assistant' && messages[messages.length-1]?.content === '' && (
                 <div style={{alignSelf:'flex-start', background:'#fff', padding:'10px 14px', borderRadius:'12px', color:'#94a3b8', fontSize:'0.85rem'}}>
                    正在思考...
                 </div>
             )}
        </div>

        <div style={styles.chatInputArea}>
           {expanded && isPlaying && (
             <button onClick={stopTTS} style={styles.stopBtn} title="停止朗读">
               <FaStop size={12} />
             </button>
           )}
           <input value={input} onChange={e => setInput(e.target.value)} onFocus={() => setExpanded(true)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="有问题尽管问..." style={styles.chatInput}/>
           <button onClick={() => handleSend()} disabled={loading} style={{...styles.sendBtn, opacity: loading ? 0.5 : 1}}>
             <FaPaperPlane size={14} />
           </button>
        </div>
      </div>

      {/* 历史记录左侧抽屉 */}
      {showHistory && (
          <>
            <div onClick={() => setShowHistory(false)} style={{...styles.overlay, zIndex: 2900}} />
            <div style={styles.drawer}>
                <div style={styles.drawerHeader}>
                    <h3>学习记录</h3>
                    <button onClick={() => setShowHistory(false)} style={styles.headerBtn}><FaTimes/></button>
                </div>
                <div style={styles.drawerList}>
                    {sortedHistoryList.length === 0 && <div style={{padding:20, color:'#94a3b8', textAlign:'center'}}>暂无记录</div>}
                    {sortedHistoryList.map(item => (
                        <div key={item.id} onClick={() => handleHistorySelect(item.id)} style={{
                            ...styles.historyItem,
                            background: item.id === currentSessionKey ? '#eff6ff' : 'transparent',
                            borderLeft: item.id === currentSessionKey ? '3px solid #3b82f6' : '3px solid transparent'
                        }}>
                            <div style={styles.historyIcon}>
                                {item.type === 'grammar' && <FaBook color="#8b5cf6" />}
                                {item.type === 'question' && <FaQuestionCircle color="#f59e0b" />}
                                {item.type === 'free' && <FaCommentDots color="#10b981" />}
                            </div>
                            <div style={{flex:1, overflow:'hidden'}}>
                                <div style={styles.historyTitle}>{item.title}</div>
                                <div style={styles.historyDate}>{new Date(item.updatedAt).toLocaleString()}</div>
                            </div>
                            <button onClick={(e) => deleteHistory(item.id, e)} style={styles.deleteBtn}>
                                <FaTrashAlt size={12}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
          </>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div style={styles.settingsOverlay}>
          <div style={styles.settingsModal}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
              <h3 style={{fontSize:'1.1rem', fontWeight:'bold', color:'#1e293b'}}>AI 设置</h3>
              <button onClick={() => setShowSettings(false)} style={styles.headerBtn}><FaTimes size={18}/></button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <label>
                <div style={styles.label}>NVIDIA API Key</div>
                <input type="password" value={config.apiKey} onChange={e => saveConfig({...config, apiKey: e.target.value})} placeholder="nvapi-..." style={styles.input}/>
              </label>
              
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={styles.label}>显示拼音</div>
                <input 
                    type="checkbox" 
                    checked={config.showPinyin} 
                    onChange={e => saveConfig({...config, showPinyin: e.target.checked})}
                    style={{width: '20px', height: '20px'}}
                />
              </label>

              <label>
                <div style={styles.label}>模型 ID</div>
                <input value={config.modelId} onChange={e => saveConfig({...config, modelId: e.target.value})} style={styles.input}/>
              </label>
              <label>
                <div style={styles.label}>系统提示词</div>
                <textarea value={config.systemPrompt} onChange={e => saveConfig({...config, systemPrompt: e.target.value})} rows={4} style={{...styles.input, height:'auto', minHeight:'80px'}}/>
              </label>
              <label>
                <div style={styles.label}>TTS 发音人</div>
                <select value={config.ttsVoice} onChange={e => saveConfig({...config, ttsVoice: e.target.value})} style={styles.input}>
                  {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </label>
              <label>
                <div style={styles.label}>TTS 语速 ({config.ttsSpeed}x)</div>
                <input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e => saveConfig({...config, ttsSpeed: parseFloat(e.target.value)})} style={{width:'100%', accentColor:'#3b82f6'}}/>
              </label>
            </div>
            <button onClick={() => setShowSettings(false)} style={styles.saveBtn}>保存设置</button>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .markdown-body { font-size: 0.95rem; color: #334155; font-family: 'Padauk', sans-serif; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { font-weight: 700; color: #1e293b; margin-top: 1em; margin-bottom: 0.5em; }
        .markdown-body h3 { font-size: 1.1em; border-left: 4px solid #d946ef; padding-left: 8px; }
        .markdown-body p { margin-bottom: 0.8em; line-height: 2.2; }
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin-bottom: 0.8em; }
        .markdown-body li { margin-bottom: 0.4em; }
        .markdown-body blockquote { border-left: 4px solid #cbd5e1; padding-left: 12px; color: #64748b; margin: 0 0 1em 0; font-style: italic; }
      `}</style>
    </>
  );
}

const styles = {
  overlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1999 },
  chatBox: { position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#f8fafc', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', boxShadow: '0 -4px 30px rgba(0,0,0,0.12)', transition: 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', zIndex: 2000, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  chatHeader: { height: '50px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 },
  headerBtn: { color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: '4px' },
  modelTag: { fontSize: '0.7rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' },
  chatHistory: { flex: 1, overflowY: 'auto', padding: '20px 16px', background: '#f8fafc', display: 'flex', flexDirection: 'column' },
  chatMsg: { maxWidth: '90%', padding: '10px 14px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', lineHeight: 1.6, fontSize: '0.95rem', wordBreak: 'break-word' },
  chatInputArea: { height: '60px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 },
  stopBtn: { width:36, height:36, borderRadius:'50%', background:'#fee2e2', color:'#ef4444', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  chatInput: { flex: 1, height: '40px', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '0 16px', fontSize: '0.95rem', background: '#f8fafc', outline: 'none' },
  sendBtn: { width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity 0.2s' },
  
  // Settings & Modal
  settingsOverlay: { position: 'absolute', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  settingsModal: { width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '16px', padding: '24px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  label: { fontSize: '0.85rem', color: '#64748b', marginBottom: '6px', fontWeight: '600' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', fontFamily:'inherit' },
  saveBtn: { width:'100%', marginTop:'24px', padding:'12px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold', fontSize:'1rem', cursor:'pointer' },
  actionBar: { display: 'flex', gap: '16px', marginTop: '8px', marginLeft: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s' },
  
  // Drawer Styles
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '280px', background: '#fff', zIndex: 2901, boxShadow: '4px 0 20px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', transition: 'transform 0.3s ease' },
  drawerHeader: { height: '50px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', fontWeight: 'bold' },
  drawerList: { flex: 1, overflowY: 'auto', padding: '10px 0' },
  historyItem: { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' },
  historyIcon: { width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' },
  historyTitle: { fontSize: '0.9rem', color: '#334155', fontWeight: '600', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  historyDate: { fontSize: '0.75rem', color: '#94a3b8' },
  deleteBtn: { background:'none', border:'none', color:'#cbd5e1', cursor:'pointer', padding:4, ':hover':{color:'#ef4444'} }
};
