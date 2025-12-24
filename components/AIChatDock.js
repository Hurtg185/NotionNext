import React, { useState, useEffect, useRef } from 'react';
import {
  FaPaperPlane, FaChevronDown, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaRedo, FaMicrophone, FaHeadphones
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { pinyin } from 'pinyin-pro'; 

// 默认配置
const DEFAULT_CONFIG = {
  apiKey: '',
  modelId: 'deepseek-ai/deepseek-v3.2',
  systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。排版要求：使用清晰的标题（###）、列表（-）和加粗（**）来组织内容，重点内容请用中文和缅甸语双语对照。',
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', // 默认改为晓晓多语言
  showPinyin: true,
  autoTTS: false // 默认不自动朗读
};

const VOICES = [
  { label: '中文女声 - 晓晓 (多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { label: '中文女声 - 晓晓', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '中文女声 - 晓攸', value: 'zh-CN-XiaoyouNeural' },
  { label: '中文男声 - 云希', value: 'zh-CN-YunxiNeural' },
  { label: '缅甸女声 - Nilar', value: 'my-MM-NilarNeural' },
  { label: '缅甸男声 - Thiha', value: 'my-MM-ThihaNeural' }
];

// --- 拼音渲染组件 (核心) ---
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

export default function AIChatDock({ contextData }) {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('ai_dock_config_v7'); // 升级版本号 v7
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
    localStorage.setItem('ai_dock_config_v7', JSON.stringify(newConfig));
  };

  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(true);

    // 【修改点】移除了自动检测缅甸语并切换 voice 的逻辑
    // 直接使用配置中的 voice (默认晓晓多语言) 处理整个字符串，实现汉缅不分离
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
    if (!expanded) setExpanded(true);  

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

      // 【修改点】只有当配置了 autoTTS 为 true 时才自动朗读
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
      {expanded && <div onClick={() => setExpanded(false)} style={styles.overlay}/>}
      <div style={{...styles.chatBox, height: expanded ? '85vh' : '60px'}}>
        {expanded && (
          <div style={styles.chatHeader}>
            <div style={{display:'flex', alignItems:'center', gap: 8}}>
              <FaRobot className="text-blue-500" />
              <span style={{fontWeight:'bold', color:'#334155'}}>AI 助教</span>
              <span style={styles.modelTag}>{config.modelId.split('/').pop()}</span>
            </div>
            <div style={{display:'flex', gap: 16}}>
              <button onClick={() => setShowSettings(true)} style={styles.headerBtn}><FaCog size={18} /></button>
              <button onClick={() => setExpanded(false)} style={styles.headerBtn}><FaChevronDown size={18} /></button>
            </div>
          </div>
        )}

        <div ref={historyRef} style={styles.chatHistory}>  
             {messages.length === 0 && (  
                <div style={{textAlign:'center', marginTop: 40, color:'#cbd5e1'}}>  
                 <FaRobot size={40} style={{marginBottom:10, opacity:0.2}} />  
                 <p>你好！我是你的专属 AI 老师。</p>  
                 <p style={{fontSize:'0.85rem', marginTop:4}}>请先设置 API Key 开始使用。</p>  
               </div>  
             )}  
             {messages.map((m, i) => (  
               <div key={i} style={{  
                   alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',  
                   maxWidth: '90%', 
                   display: 'flex', flexDirection: 'column',  
                   marginBottom: '16px'  
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
                                p: ({node, children, ...props}) => {  
                                    return <p {...props}>  
                                        {React.Children.map(children, child => {  
                                            if (typeof child === 'string') {  
                                                return <PinyinRenderer text={child} show={config.showPinyin} />;  
                                            }  
                                            return child;  
                                        })}  
                                    </p>  
                                },  
                                li: ({node, children, ...props}) => (  
                                    <li {...props}>  
                                        {React.Children.map(children, child => {  
                                            if (typeof child === 'string') {  
                                                return <PinyinRenderer text={child} show={config.showPinyin} />;  
                                            }  
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
           <input value={input} onChange={e => setInput(e.target.value)} onFocus={() => setExpanded(true)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="输入问题..." style={styles.chatInput}/>  
           <button onClick={() => handleSend()} disabled={loading} style={{...styles.sendBtn, opacity: loading ? 0.5 : 1}}>  
             <FaPaperPlane size={14} />  
           </button>  
        </div>  
      </div>  

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

              {/* 新增：自动朗读开关 */}
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>  
                <div style={styles.label}>自动朗读回复</div>  
                <input   
                    type="checkbox"   
                    checked={config.autoTTS}   
                    onChange={e => saveConfig({...config, autoTTS: e.target.checked})}  
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
  headerBtn: { color: '#64748b', cursor: 'pointer', background: 'none', border: 'none' },
  modelTag: { fontSize: '0.7rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' },
  chatHistory: { flex: 1, overflowY: 'auto', padding: '20px 16px', background: '#f8fafc', display: 'flex', flexDirection: 'column' },
  chatMsg: { maxWidth: '90%', padding: '10px 14px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', lineHeight: 1.6, fontSize: '0.95rem', wordBreak: 'break-word' },
  chatInputArea: { height: '60px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 },
  stopBtn: { width:36, height:36, borderRadius:'50%', background:'#fee2e2', color:'#ef4444', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  chatInput: { flex: 1, height: '40px', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '0 16px', fontSize: '0.95rem', background: '#f8fafc', outline: 'none' },
  sendBtn: { width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity 0.2s' },
  settingsOverlay: { position: 'absolute', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  settingsModal: { width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '16px', padding: '24px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  label: { fontSize: '0.85rem', color: '#64748b', marginBottom: '6px', fontWeight: '600' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', fontFamily:'inherit' },
  saveBtn: { width:'100%', marginTop:'24px', padding:'12px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold', fontSize:'1rem', cursor:'pointer' },
  actionBar: { display: 'flex', gap: '16px', marginTop: '8px', marginLeft: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s', ':hover': {background: '#f1f5f9'} }
};
