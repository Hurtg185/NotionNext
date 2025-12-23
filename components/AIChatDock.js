import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPaperPlane, FaChevronDown, FaRobot, FaCog, FaTimes, 
  FaVolumeUp, FaStop 
} from 'react-icons/fa';

// 默认配置
const DEFAULT_CONFIG = {
  apiKey: '', // 等待用户输入
  baseUrl: 'https://integrate.api.nvidia.com/v1', // 这里的 baseUrl 实际上只在显示时有用，请求走本地转发
  modelId: 'deepseek-ai/deepseek-r1',
  systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。如果遇到复杂的概念，请对比缅甸语的思维方式进行解释。态度要亲切、耐心。',
  ttsSpeed: 1.0,
  ttsVoice: 'zh-CN-XiaoyouNeural'
};

const VOICES = [
  { label: '女声 - 晓晓 (Xiaoxiao)', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '女声 - 晓攸 (Xiaoyou)', value: 'zh-CN-XiaoyouNeural' },
  { label: '男声 - 云希 (Yunxi)', value: 'zh-CN-YunxiNeural' },
  { label: '男声 - 云野 (Yunye)', value: 'zh-CN-YunyeNeural' }
];

export default function AIChatDock({ contextData, ttsPlay }) {
  // 状态管理
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  // TTS 状态 (如果需要内部播放，备用)
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const historyRef = useRef(null);

  // 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_dock_config');
    if (savedConfig) {
      try {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) });
      } catch (e) {
        console.error('Config load error', e);
      }
    }
  }, []);

  // 自动滚动
  useEffect(() => {
    if (historyRef.current && expanded) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, expanded, loading]);

  // 保存配置
  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('ai_dock_config', JSON.stringify(newConfig));
  };

  // 内部 TTS 播放逻辑 (如果父组件没传 ttsPlay)
  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    const cleanText = text.replace(/\*\*|###|```/g, '');
    // 语速转换：1.0 -> 0%, 1.5 -> +50%, 0.8 -> -20%
    let ratePercent = Math.round((config.ttsSpeed - 1) * 100);
    let rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    
    const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${config.ttsVoice}&r=${rateStr}`;

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error('TTS Error', e);
    }
  };

  const stopTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // 发送消息 (核心修改部分)
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    // 校验用户是否填了 Key
    if (!config.apiKey) {
      alert('请先点击聊天框右上角的齿轮 ⚙️，在设置中填入你的 API Key');
      setShowSettings(true);
      return;
    }

    const userText = input;
    setInput('');
    setLoading(true);
    if (!expanded) setExpanded(true);

    // 1. 构建带有上下文的提示词 (Hidden Context)
    let finalUserMessage = userText;
    if (contextData) {
      // 在这里把上下文悄悄塞给 AI，但用户界面上只显示用户的问题
      // 系统提示词已经设定了身份，这里补充即时资料
      const contextInfo = `
[当前教材内容]
标题：${contextData.title || ''}
句型：${contextData.pattern || ''}
详解：${(contextData.explanationRaw || '').substring(0, 500)}
---
请基于以上内容回答学生的问题：${userText}`;
      
      // 我们只把 contextInfo 发给 AI，但在 UI 上只展示 userText
      // 为了逻辑简单，这里我们还是把 contextInfo 存入 messages 状态用于发送，
      // 但渲染时你可以选择只渲染 userText (如果需要极简)。
      // 本代码暂且将完整 prompt 存入，如果想隐藏上下文，需维护两个 message 列表。
      // 为简单起见，这里直接发，但在 UI 渲染时用户会看到很长的字吗？
      // 不会，因为我们下面 setMessages 用的是 userText，发送时构建临时数组。
    }

    // UI 显示的消息列表 (不含巨大的 Context，保持界面整洁)
    const newUiMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newUiMessages);

    // 构造实际发送给 API 的消息列表 (包含 Context)
    const apiMessages = [
        { role: 'system', content: config.systemPrompt },
        ...messages.slice(-6), // 历史记录
        { role: 'user', content: contextData ? `[背景知识: ${contextData.title} ${contextData.pattern}]\n${userText}` : userText } 
    ];

    try {
      // ==========================================================
      // 关键修改：请求本地 /api/chat，而不是直接请求 nvidia
      // ==========================================================
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // 传给后端：消息历史
          messages: apiMessages,
          // 传给后端：用户的配置 (Key, Model)
          config: {
            apiKey: config.apiKey,
            modelId: config.modelId
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '请求失败');
      }

      const reply = data?.choices?.[0]?.message?.content || 'AI 没有返回内容';
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      
      // 播放语音 (优先用父组件传进来的 ttsPlay，否则用内部的)
      if (ttsPlay) {
         // 使用父组件的播放器时，可能不支持动态切换发音人，
         // 这里简单处理：直接调用朗读。如果需要个性化发音人，
         // 建议使用内部 playInternalTTS。
         // 为了响应设置里的发音人，我们优先尝试内部播放器
         playInternalTTS(reply);
      } else {
         playInternalTTS(reply);
      }

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ 发送失败: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      {expanded && (
        <div 
          onClick={() => setExpanded(false)}
          style={{
            position: 'absolute', inset: 0, 
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
            zIndex: 1999
          }}
        />
      )}

      {/* 主容器 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, width: '100%',
        height: expanded ? '75vh' : '60px',
        background: '#fff',
        borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        transition: 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        zIndex: 2000,
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* 头部 (仅展开显示) */}
        {expanded && (
          <div style={{
            height: '50px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #f1f5f9', background: '#fff'
          }}>
            <div style={{display:'flex', alignItems:'center', gap: 8}}>
              <FaRobot className="text-blue-500" />
              <span style={{fontWeight:'bold', color:'#334155'}}>AI 助教</span>
              <span style={{fontSize:'0.7rem', background:'#eff6ff', color:'#3b82f6', padding:'2px 6px', borderRadius:'4px'}}>
                {config.modelId.split('/').pop()}
              </span>
            </div>
            <div style={{display:'flex', gap: 16}}>
               <button onClick={() => setShowSettings(true)} style={{color:'#94a3b8', cursor:'pointer'}}>
                 <FaCog size={18} />
               </button>
               <button onClick={() => setExpanded(false)} style={{color:'#94a3b8', cursor:'pointer'}}>
                 <FaChevronDown size={18} />
               </button>
            </div>
          </div>
        )}

        {/* 聊天记录 */}
        {expanded && (
          <div ref={historyRef} style={{
            flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
             {messages.length === 0 && (
               <div style={{textAlign:'center', marginTop: 40, color:'#cbd5e1'}}>
                 <FaRobot size={40} style={{marginBottom:10, opacity:0.2}} />
                 <p>你好！我是你的专属 AI 老师。</p>
                 <p style={{fontSize:'0.85rem', marginTop:4}}>请点击右上角设置图标填入 Key 开始使用。</p>
               </div>
             )}
             {messages.map((m, i) => (
               <div key={i} style={{
                 alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                 maxWidth: '85%',
                 padding: '10px 14px',
                 borderRadius: '12px',
                 borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                 borderBottomLeftRadius: m.role === 'user' ? 12 : 2,
                 background: m.role === 'user' ? '#3b82f6' : '#fff',
                 color: m.role === 'user' ? '#fff' : '#334155',
                 boxShadow: m.role === 'user' ? 'none' : '0 2px 5px rgba(0,0,0,0.05)',
                 lineHeight: 1.6,
                 fontSize: '0.95rem'
               }}>
                 {m.content}
               </div>
             ))}
             {loading && (
               <div style={{alignSelf:'flex-start', background:'#fff', padding:'10px', borderRadius:'12px', color:'#94a3b8', fontSize:'0.9rem'}}>
                 AI 正在思考...
               </div>
             )}
          </div>
        )}

        {/* 底部输入区 */}
        <div style={{
          height: '60px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '10px',
          background: '#fff', borderTop: expanded ? '1px solid #f1f5f9' : 'none'
        }}>
           {/* 停止播放按钮 */}
           {expanded && isPlaying && (
             <button onClick={stopTTS} style={{
               width:36, height:36, borderRadius:'50%', background:'#fee2e2', color:'#ef4444',
               border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
             }}>
               <FaStop size={12} />
             </button>
           )}

           <input 
             value={input}
             onChange={e => setInput(e.target.value)}
             onFocus={() => setExpanded(true)}
             onKeyDown={e => e.key === 'Enter' && handleSend()}
             placeholder={config.apiKey ? "输入问题..." : "请先设置 API Key"}
             style={{
               flex: 1, height: '40px', borderRadius: '20px', border: '1px solid #e2e8f0',
               padding: '0 16px', fontSize: '0.95rem', background: '#f8fafc', outline: 'none'
             }}
           />
           <button 
             onClick={handleSend}
             disabled={loading || !input.trim()}
             style={{
               width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: '#fff',
               border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
               opacity: (loading || !input.trim()) ? 0.5 : 1, cursor: 'pointer'
             }}
           >
             <FaPaperPlane size={14} />
           </button>
        </div>
      </div>

      {/* 设置面板 Modal */}
      {showSettings && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
          <div style={{
            width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '16px',
            padding: '20px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
              <h3 style={{fontSize:'1.1rem', fontWeight:'bold', color:'#1e293b'}}>AI 设置</h3>
              <button onClick={() => setShowSettings(false)} style={{color:'#64748b', background:'none', border:'none', cursor:'pointer'}}><FaTimes size={18}/></button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <label>
                <div style={styles.label}>API Key (必填)</div>
                <input 
                  type="password"
                  value={config.apiKey}
                  onChange={e => saveConfig({...config, apiKey: e.target.value})}
                  placeholder="nvapi-..."
                  style={styles.input}
                />
              </label>

              <label>
                <div style={styles.label}>模型 ID</div>
                <input 
                  value={config.modelId}
                  onChange={e => saveConfig({...config, modelId: e.target.value})}
                  placeholder="deepseek-ai/deepseek-r1"
                  style={styles.input}
                />
              </label>

              <label>
                <div style={styles.label}>系统提示词 (Persona)</div>
                <textarea 
                  value={config.systemPrompt}
                  onChange={e => saveConfig({...config, systemPrompt: e.target.value})}
                  rows={4}
                  style={{...styles.input, height:'auto', minHeight:'80px'}}
                />
              </label>

              <label>
                <div style={styles.label}>TTS 发音人</div>
                <select 
                  value={config.ttsVoice}
                  onChange={e => saveConfig({...config, ttsVoice: e.target.value})}
                  style={styles.input}
                >
                  {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </label>

              <label>
                <div style={styles.label}>TTS 语速 ({config.ttsSpeed}x)</div>
                <input 
                  type="range" min="0.5" max="2.0" step="0.1"
                  value={config.ttsSpeed}
                  onChange={e => saveConfig({...config, ttsSpeed: parseFloat(e.target.value)})}
                  style={{width:'100%', accentColor:'#3b82f6'}}
                />
              </label>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              style={{
                width:'100%', marginTop:'24px', padding:'12px', background:'#3b82f6', 
                color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold', fontSize:'1rem', cursor:'pointer'
              }}
            >
              保存并关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  label: { fontSize: '0.85rem', color: '#64748b', marginBottom: '6px', fontWeight: '600' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', fontFamily:'inherit' }
};
