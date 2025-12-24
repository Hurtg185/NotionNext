import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPaperPlane, FaChevronDown, FaRobot, FaCog, FaTimes, 
  FaVolumeUp, FaStop 
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

// 默认配置
const DEFAULT_CONFIG = {
  apiKey: '', 
  // 建议默认用 Llama 3.1 70B，DeepSeek 在 Nvidia 上有时候极慢
  modelId: 'meta/llama-3.1-70b-instruct', 
  systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。',
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoyouNeural'
};

const VOICES = [
  { label: '女声 - 晓晓', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '女声 - 晓攸', value: 'zh-CN-XiaoyouNeural' },
  { label: '男声 - 云希', value: 'zh-CN-YunxiNeural' },
  { label: '男声 - 云野', value: 'zh-CN-YunyeNeural' }
];

export default function AIChatDock({ contextData, ttsPlay }) {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null); // 用于中断请求

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedConfig = localStorage.getItem('ai_dock_config_v3');
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
    localStorage.setItem('ai_dock_config_v3', JSON.stringify(newConfig));
  };

  // 内部 TTS 播放
  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    
    const cleanText = text.replace(/\*\*|###|```/g, '');
    let ratePercent = Math.round((config.ttsSpeed - 1) * 100);
    const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${config.ttsVoice}&r=${ratePercent}%`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    } catch (e) { 
      console.error('TTS Error', e); 
      setIsPlaying(false);
    }
  };

  const stopTTS = () => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
  };

  // 🔴 核心修改：流式发送与接收
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先在设置中填入您的 API Key');
      setShowSettings(true);
      return;
    }

    const userText = input;
    setInput('');
    setLoading(true);
    if (!expanded) setExpanded(true);

    // 1. 立即在 UI 上显示用户消息
    const newMessages = [...messages, { role: 'user', content: userText }];
    // 2. 预先添加一个空的 AI 消息占位
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    const apiMessages = [
        { role: 'system', content: config.systemPrompt },
        ...newMessages.slice(-6), // 带上下文
        { role: 'user', content: contextData ? `[背景知识: ${contextData.title} ${contextData.pattern}]\n${userText}` : userText } 
    ];

    abortControllerRef.current = new AbortController();

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

      if (!response.body) throw new Error("无响应内容");

      // 🔴 关键：使用 Reader 读取流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullReply = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });
        
        // 解析 SSE 数据 (data: {...})
        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.replace('data: ', '').trim();
                if (jsonStr === '[DONE]') break;
                
                try {
                    const data = JSON.parse(jsonStr);
                    // NVIDIA 格式: choices[0].delta.content
                    const content = data.choices?.[0]?.delta?.content || '';
                    if (content) {
                        fullReply += content;
                        // 实时更新 UI：修改最后一条 AI 消息的内容
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            // 确保是在更新最后一条 assistant 消息
                            if (last.role === 'assistant') {
                                return [...prev.slice(0, -1), { ...last, content: fullReply }];
                            }
                            return prev;
                        });
                    }
                } catch (e) {
                    // 忽略解析错误的片段
                }
            }
        }
      }

      // 播放语音
      if (ttsPlay) ttsPlay(fullReply);
      else playInternalTTS(fullReply);

    } catch (err) {
      if (err.name !== 'AbortError') {
          console.error("Chat Error:", err);
          setMessages(prev => {
              // 将最后一条（原本是空的占位符）改成错误提示
              const msgs = [...prev];
              msgs[msgs.length - 1] = { role: 'assistant', content: `❌ 发送失败: ${err.message}` };
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
      <div style={{...styles.chatBox, height: expanded ? '75vh' : '60px'}}>
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
        
        {/* 聊天记录区域 */}
        {expanded && (
          <div ref={historyRef} style={styles.chatHistory}>
             {messages.length === 0 && (
                <div style={{textAlign:'center', marginTop: 40, color:'#cbd5e1'}}>
                 <FaRobot size={40} style={{marginBottom:10, opacity:0.2}} />
                 <p>你好！我是你的专属 AI 老师。</p>
                 <p style={{fontSize:'0.85rem', marginTop:4}}>请先设置 API Key。</p>
               </div>
             )}
             {messages.map((m, i) => (
               <div key={i} style={{...styles.chatMsg, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#3b82f6' : '#fff', color: m.role === 'user' ? '#fff' : '#334155'}}>
                 {m.role === 'assistant' ? <ReactMarkdown className="markdown-body">{m.content}</ReactMarkdown> : m.content}
               </div>
             ))}
             {loading && messages[messages.length-1]?.content === '' && (
                 <div style={{alignSelf:'flex-start', background:'#fff', padding:'10px', borderRadius:'12px', color:'#94a3b8', fontSize:'0.85rem'}}>
                    正在思考...
                 </div>
             )}
          </div>
        )}

        <div style={styles.chatInputArea}>
           {expanded && isPlaying && (
             <button onClick={stopTTS} style={styles.stopBtn}>
               <FaStop size={12} />
             </button>
           )}
           <input value={input} onChange={e => setInput(e.target.value)} onFocus={() => setExpanded(true)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="输入问题..." style={styles.chatInput}/>
           <button onClick={handleSend} disabled={loading || !input.trim()} style={{...styles.sendBtn, opacity: (loading || !input.trim()) ? 0.5 : 1}}>
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
              <label>
                <div style={styles.label}>模型 ID</div>
                <input value={config.modelId} onChange={e => saveConfig({...config, modelId: e.target.value})} style={styles.input}/>
                <div style={{fontSize:'0.75rem', color:'#64748b', marginTop:4}}>推荐: meta/llama-3.1-70b-instruct (速度快)</div>
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
            </div>
            <button onClick={() => setShowSettings(false)} style={styles.saveBtn}>保存设置</button>
          </div>
        </div>
      )}
      <style jsx global>{`
        .markdown-body { line-height: 1.6; font-size: 0.95rem; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { font-weight: bold; margin: 0.8em 0 0.4em; }
        .markdown-body p { margin-bottom: 0.6em; }
        .markdown-body strong { color: #1d4ed8; } 
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin-bottom: 0.6em; }
        .markdown-body code { background: #f1f5f9; color: #ef4444; padding: 2px 4px; borderRadius: 4px; font-size: 0.9em; }
      `}</style>
    </>
  );
}

const styles = {
  overlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1999 },
  chatBox: { position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#fff', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', transition: 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', zIndex: 2000, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  chatHeader: { height: '50px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', background: '#fff', flexShrink: 0 },
  headerBtn: { color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none' },
  modelTag: { fontSize: '0.7rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' },
  chatHistory: { flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' },
  chatMsg: { maxWidth: '85%', padding: '10px 14px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', lineHeight: 1.6, fontSize: '0.95rem', wordBreak: 'break-word' },
  chatInputArea: { height: '60px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderTop: '1px solid #f1f5f9', flexShrink: 0 },
  stopBtn: { width:36, height:36, borderRadius:'50%', background:'#fee2e2', color:'#ef4444', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  chatInput: { flex: 1, height: '40px', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '0 16px', fontSize: '0.95rem', background: '#f8fafc', outline: 'none' },
  sendBtn: { width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity 0.2s' },
  settingsOverlay: { position: 'absolute', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  settingsModal: { width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '16px', padding: '20px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  label: { fontSize: '0.85rem', color: '#64748b', marginBottom: '6px', fontWeight: '600' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', fontFamily:'inherit' },
  saveBtn: { width:'100%', marginTop:'24px', padding:'12px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold', fontSize:'1rem', cursor:'pointer' }
};
