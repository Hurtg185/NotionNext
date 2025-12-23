import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPaperPlane, FaChevronDown, FaRobot, FaCog, FaTimes, 
  FaVolumeUp, FaStop 
} from 'react-icons/fa';

// 默认配置
const DEFAULT_CONFIG = {
  apiKey: '', // 用户需填入
  baseUrl: 'https://integrate.api.nvidia.com/v1',
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

export default function AIChatDock({ contextData }) {
  // 状态管理
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  // TTS 状态
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

  // 播放 TTS (使用组件内部配置)
  const playTTS = async (text) => {
    if (!text) return;
    
    // 停止旧的
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // 清理 Markdown
    const cleanText = text.replace(/\*\*|###|```/g, '');
    const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${config.ttsVoice}&r=${config.ttsSpeed === 1.0 ? 0 : (config.ttsSpeed - 1) * 100}%`; // 简单的语速转换逻辑，根据具体API调整

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(blobUrl);
      // 也可以直接设置 audio.playbackRate = config.ttsSpeed 如果API不支持参数
      audio.playbackRate = config.ttsSpeed;
      
      audioRef.current = audio;
      setAudioUrl(blobUrl);
      
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

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!config.apiKey) {
      alert('请先点击右上角齿轮设置 API Key');
      setShowSettings(true);
      return;
    }

    const userText = input;
    setInput('');
    setLoading(true);
    if (!expanded) setExpanded(true);

    // 构建上下文提示词
    let contextPrompt = "";
    if (contextData) {
      contextPrompt = `
【当前学习内容】
标题：${contextData.title || '未知'}
核心句型：${contextData.pattern || '无'}
语法详解：${(contextData.explanation || '').substring(0, 300)}...
---
学生的问题是：${userText}
`;
    } else {
      contextPrompt = userText;
    }

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: [
            { role: 'system', content: config.systemPrompt },
            ...newMessages.slice(-6), // 只带最近几条历史，节省 token
            { role: 'user', content: contextPrompt } // 替换最后一条为带上下文的内容
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content || '抱歉，我好像断线了。';
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      playTTS(reply);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${err.message}` }]);
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
        
        {/* 头部 */}
        {expanded && (
          <div style={{
            height: '50px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #f1f5f9', background: '#fff'
          }}>
            <div style={{display:'flex', alignItems:'center', gap: 8}}>
              <FaRobot className="text-blue-500" />
              <span style={{fontWeight:'bold', color:'#334155'}}>AI 助教</span>
              <span style={{fontSize:'0.7rem', background:'#eff6ff', color:'#3b82f6', padding:'2px 6px', borderRadius:'4px'}}>
                {config.modelId}
              </span>
            </div>
            <div style={{display:'flex', gap: 16}}>
               <button onClick={() => setShowSettings(true)} style={{color:'#94a3b8'}}>
                 <FaCog />
               </button>
               <button onClick={() => setExpanded(false)} style={{color:'#94a3b8'}}>
                 <FaChevronDown />
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
                 <p>你好！我是你的专属 AI 老师。</p>
                 <p style={{fontSize:'0.85rem', marginTop:4}}>我可以为你解答关于“{contextData?.title}”的问题。</p>
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
               <div style={{alignSelf:'flex-start', background:'#fff', padding:'10px', borderRadius:'12px', color:'#94a3b8'}}>
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
           {/* 播放控制按钮 (仅当有音频时显示) */}
           {expanded && isPlaying && (
             <button onClick={stopTTS} style={{
               width:36, height:36, borderRadius:'50%', background:'#fee2e2', color:'#ef4444',
               border:'none', display:'flex', alignItems:'center', justifyContent:'center'
             }}>
               <FaStop size={12} />
             </button>
           )}

           <input 
             value={input}
             onChange={e => setInput(e.target.value)}
             onFocus={() => setExpanded(true)}
             onKeyDown={e => e.key === 'Enter' && handleSend()}
             placeholder="有什么不懂的？问问 AI 老师..."
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
               opacity: (loading || !input.trim()) ? 0.5 : 1
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
            width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '16px',
            padding: '20px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
              <h3 style={{fontSize:'1.1rem', fontWeight:'bold', color:'#1e293b'}}>AI 设置</h3>
              <button onClick={() => setShowSettings(false)}><FaTimes /></button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <label>
                <div style={styles.label}>API Key</div>
                <input 
                  type="password"
                  value={config.apiKey}
                  onChange={e => saveConfig({...config, apiKey: e.target.value})}
                  placeholder="sk-..."
                  style={styles.input}
                />
              </label>

              <label>
                <div style={styles.label}>Base URL</div>
                <input 
                  value={config.baseUrl}
                  onChange={e => saveConfig({...config, baseUrl: e.target.value})}
                  style={styles.input}
                />
              </label>

              <label>
                <div style={styles.label}>模型 ID</div>
                <input 
                  value={config.modelId}
                  onChange={e => saveConfig({...config, modelId: e.target.value})}
                  style={styles.input}
                />
              </label>

              <label>
                <div style={styles.label}>系统提示词 (Persona)</div>
                <textarea 
                  value={config.systemPrompt}
                  onChange={e => saveConfig({...config, systemPrompt: e.target.value})}
                  rows={4}
                  style={{...styles.input, height:'auto'}}
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
                  style={{width:'100%'}}
                />
              </label>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              style={{
                width:'100%', marginTop:'20px', padding:'12px', background:'#3b82f6', 
                color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'
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
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }
};
