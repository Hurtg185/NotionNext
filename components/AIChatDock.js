import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaPaperPlane, FaChevronLeft, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaMicrophone, FaEraser,
  FaList, FaEdit, FaTrashAlt, FaPlus, FaLightbulb, FaFeatherAlt,
  FaLanguage, FaCheck, FaFont, FaLock, FaRocket, FaGoogle,
  FaEye, FaEyeSlash, FaArrowLeft
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import { pinyin } from 'pinyin-pro'; 
import { useAI } from './AIConfigContext'; 

// --- 常量定义 ---
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

const API_ENDPOINTS = [
  { name: 'NVIDIA (默认)', value: 'https://integrate.api.nvidia.com/v1' },
  { name: '阿里心流 (Iflow)', value: 'https://apis.iflow.cn/v1' },
  { name: 'DeepSeek 官方', value: 'https://api.deepseek.com' }
];

const MODEL_OPTIONS = [
  { name: 'DeepSeek V3 (推荐)', value: 'deepseek-ai/deepseek-v3.2' },
  { name: 'Qwen 2.5 (阿里)', value: 'qwen-turbo' }, 
  { name: 'Gemini 2.5 Flash', value: 'Gemini-2.5-Flash-Lite' },
  { name: 'Llama 3.1 405B', value: 'meta/llama-3.1-405b-instruct' }
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
  const cleanText = typeof text === 'string' ? text : String(text);
  // 正则拆分：中文 vs 非中文
  const regex = /([\u4e00-\u9fa5]+)/g; 
  const parts = cleanText.split(regex);
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
                    userSelect: 'none', 
                    fontFamily:'Arial',
                    opacity: 0.9
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

// --- 辅助：递归遍历 Children 并应用 Pinyin ---
// 解决 ReactMarkdown 中 strong/em/li 内部无法显示拼音的问题
const renderWithPinyin = (children, showPinyin) => {
    return React.Children.map(children, child => {
        if (typeof child === 'string') {
            return <PinyinRenderer text={child} show={showPinyin} />;
        }
        if (React.isValidElement(child) && child.props.children) {
            return React.cloneElement(child, {
                children: renderWithPinyin(child.props.children, showPinyin)
            });
        }
        return child;
    });
};

// --- 打字等待动画组件 ---
const TypingIndicator = () => (
  <div style={{ display: 'flex', gap: 4, padding: '12px 8px', alignItems: 'center' }}>
    <span className="dot" style={{animationDelay: '0s'}}></span>
    <span className="dot" style={{animationDelay: '0.2s'}}></span>
    <span className="dot" style={{animationDelay: '0.4s'}}></span>
    <style jsx>{`
      .dot {
        width: 6px; height: 6px; background: #94a3b8; border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both;
      }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }
    `}</style>
  </div>
);

export default function AIChatDock() {
  const {
    user, login, config, setConfig, sessions, setSessions,
    currentSessionId, setCurrentSessionId, isAiOpen, setIsAiOpen,
    activeTask, aiMode, resetToChatMode, systemPrompt,
    isActivated, canUseAI, recordUsage, remainingQuota, TOTAL_FREE_QUOTA
  } = useAI();

  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // 全屏模式下，侧边栏作为历史记录抽屉
  const [showPaywall, setShowPaywall] = useState(false); 
  const [showLoginTip, setShowLoginTip] = useState(false);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]); 
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false); 
  
  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false); 

  // API Key 显示状态，默认显示
  const [showKeyText, setShowKeyText] = useState(true);

  // 悬浮按钮位置 (仅当关闭时使用)
  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });

  // 设置页手势相关
  const settingsTouchStart = useRef(0);

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);

  // =======================================================
  // 核心逻辑：拦截手机物理返回键 / 侧滑手势
  // =======================================================
  useEffect(() => {
    if (isAiOpen) {
      window.history.pushState({ aiDockOpen: true }, '');
      const handlePopState = (event) => {
        setIsAiOpen(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isAiOpen, setIsAiOpen]);

  const messages = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  }, [sessions, currentSessionId]);

  // 更新消息状态的辅助函数
  const updateMessages = (updater) => {
    if (!currentSessionId) return;
    setSessions(prevSessions => 
      prevSessions.map(s => {
        if (s.id === currentSessionId) {
            const newMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
            let newTitle = s.title;
            // 自动更新标题
            if (aiMode === 'CHAT' && s.title === '新对话' && newMsgs.length > 0) {
                const firstUserMsg = newMsgs.find(m => m.role === 'user');
                if(firstUserMsg) newTitle = firstUserMsg.content.substring(0, 15);
            }
            return { ...s, messages: newMsgs, title: newTitle, date: new Date().toISOString() };
        }
        return s;
      })
    );
  };

  // 内部 TTS 播放
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

  // =======================================================
  // ✅ 核心修复：handleSend 定义在 useEffect 之前
  // =======================================================
  const handleSend = async (textToSend = input, isSystemTrigger = false) => {
    if (!textToSend.trim() || loading) return;
    if (!isSystemTrigger && !user) { setShowLoginTip(true); return; }
    if (!config.apiKey) { alert('请先在设置中配置 API Key'); setShowSettings(true); return; }
    
    // 权限检查
    if (!isSystemTrigger && !isActivated) {
        try {
            const auth = await canUseAI(); 
            const canUse = (auth && typeof auth === 'object') ? auth.canUse : auth;
            if (!canUse) { setShowPaywall(true); return; }
        } catch (e) { alert("网络校验失败，请检查网络连接"); return; }
    }

    const userText = textToSend;  
    if (!isSystemTrigger) setInput('');  
    setSuggestions([]); 
    setLoading(true);  
    
    if (abortControllerRef.current) abortControllerRef.current.abort();  
    abortControllerRef.current = new AbortController();  

    const userMsg = { role: 'user', content: userText };
    updateMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);

    // 构建消息列表：Interactive 模式下使用特定的 payload
    let apiMessages = [];
    if (aiMode === 'INTERACTIVE' && activeTask) {
        // AIConfigContext 已经帮我们生成了 systemPrompt，
        // 这里我们需要构建一个符合 interactive 上下文的 user message
        const interactivePayload = `
【学生等级】${config.userLevel || 'H1'}
【语法点】${activeTask.grammarPoint}
【题目】${activeTask.question}
【学生选择】${activeTask.userChoice}
请严格按照System Prompt的规则进行教学。
        `;
        apiMessages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: interactivePayload }];
    } else {
        const historyMsgs = messages.slice(-6).map(m => ({role: m.role, content: m.content}));
        apiMessages = [{ role: 'system', content: systemPrompt }, ...historyMsgs, userMsg];  
    }

    try {  
      const response = await fetch('/api/chat', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({  
          messages: apiMessages,
          email: user?.email, 
          config: { 
              apiKey: config.apiKey?.trim(), 
              baseUrl: config.baseUrl?.trim(), 
              modelId: config.modelId?.trim() 
          }  
        }),  
        signal: abortControllerRef.current.signal  
      });  

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API 请求失败: ${response.status} - ${errText}`);
      }
      if (!response.body) throw new Error("无响应内容");

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
            if (trimmed.startsWith('data:')) {  
                try {  
                    const jsonStr = trimmed.replace(/^data:\s?/, ''); 
                    if (jsonStr === '[DONE]') continue;
                    
                    const data = JSON.parse(jsonStr);  
                    const delta = data.choices?.[0]?.delta?.content || '';  
                    if (delta) {  
                        fullContent += delta;  
                        if (config.soundEnabled) {
                            soundThrottler++;
                            if (soundThrottler % 3 === 0) playTickSound(); 
                        }
                        updateMessages(prev => {  
                            const last = prev[prev.length - 1];  
                            const list = prev.slice(0, -1);
                            return [...list, { ...last, content: fullContent }];  
                        });  
                    }  
                } catch (e) { }  
            }  
        }  
      } 
      
      // --- 增强的追问解析逻辑 ---
      // 使用正则查找建议部分，支持 SUGGESTIONS:, [建议]: 等多种格式，忽略大小写
      const suggestionRegex = /(?:SUGGESTIONS:|\[建议\]:|【建议】:|Follow-up:)\s*([\s\S]*)$/i;
      let cleanContent = fullContent;
      let rawSuggestionsStr = '';

      const match = fullContent.match(suggestionRegex);
      if (match) {
          // 找到建议部分，从主内容中移除
          cleanContent = fullContent.replace(suggestionRegex, '').trim();
          rawSuggestionsStr = match[1];
      }

      updateMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: cleanContent }]);

      if (rawSuggestionsStr) {
          // 支持 ||| 或 换行符 分割
          const splitRegex = /\|\|\||\||\n/; 
          const finalSuggestions = rawSuggestionsStr
              .split(splitRegex)
              .map(s => s.trim().replace(/^(\d+[\.、\s]+|Q\d+[:：]\s?)/, '')) // 去掉 "1.", "Q1:" 等前缀
              .filter(s => s && s.length > 2) // 过滤掉太短的杂质
              .slice(0, 10);
          setSuggestions(finalSuggestions);
      }
      // 自动触发不扣费
      if (!isSystemTrigger && !isActivated) await recordUsage(); 
      if (config.autoTTS) playInternalTTS(cleanContent);
    } catch (err) {  
      if (err.name !== 'AbortError') {  
          console.error("Chat Error:", err);
          updateMessages(prev => {
              const last = prev[prev.length - 1];
              return [...prev.slice(0, -1), { ...last, content: last.content || `[系统]: 生成中断，请检查设置。(${err.message})` }];
          });
      }  
    } finally {  
      setLoading(false);  
      abortControllerRef.current = null;  
    }
  };

  // =======================================================
  // ✅ 核心修复：useEffect 现在可以正确调用 handleSend 了
  // =======================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isAiOpen]);

  useEffect(() => {
    if (historyRef.current && isAiOpen) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiOpen, loading]);

  // 自动发送任务 (错题自动提交)
  useEffect(() => {
      if (aiMode === 'INTERACTIVE' && activeTask && activeTask.timestamp) {
          const lastProcessed = sessionStorage.getItem('last_ai_task_ts');
          if (lastProcessed !== String(activeTask.timestamp)) {
              // 这里的文字仅用于界面显示，实际 Prompt 由 handleSend 内部逻辑决定
              const displayMsg = `(自动提交) 我做错了这道题，请帮我分析：\n"${activeTask.question}"\n我选择了：${activeTask.userChoice}`;
              handleSend(displayMsg, true); 
              sessionStorage.setItem('last_ai_task_ts', String(activeTask.timestamp));
          }
      }
  }, [activeTask, aiMode]);

  const handleSelectionChange = () => {
     if (window.selectionTimeout) clearTimeout(window.selectionTimeout);
     window.selectionTimeout = setTimeout(() => {
         const selection = window.getSelection();
         if (!selection || selection.rangeCount === 0) return;
         const text = selection.toString().trim();
         if (text.length > 0 && isAiOpen) { 
             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             let top = rect.top - 50;
             let left = rect.left + rect.width / 2;
             if (top < 10) top = rect.bottom + 10; 
             setSelectionMenu({ show: true, x: left, y: top, text: text });
             setIsCopied(false);
         } 
     }, 200);
  };

  const handleOutsideClick = (e) => {
      const menu = document.getElementById('selection-popover');
      if (menu && !menu.contains(e.target)) {
          setSelectionMenu(prev => ({ ...prev, show: false }));
      }
  };

  const handleTranslateSelection = () => {
      if (!selectionMenu.text) return;
      handleSend(`请详细解释并翻译这段文字：\n"${selectionMenu.text}"`);
      setSelectionMenu(prev => ({...prev, show: false}));
      window.getSelection().removeAllRanges();
  };

  // 悬浮球拖拽逻辑
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
        setBtnPos({ right: btnStartPos.current.right + dx, bottom: btnStartPos.current.bottom + dy });
    }
  };

  const handleTouchEnd = () => {
    if (!draggingRef.current) setIsAiOpen(true);
    draggingRef.current = false;
  };

  const createNewSession = () => {
      const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setShowSidebar(false);
      resetToChatMode();
  };

  const switchSession = (id) => {
      setCurrentSessionId(id);
      setShowSidebar(false);
  };

  const deleteSession = (e, id) => {
      e.stopPropagation();
      if(sessions.length <= 1) return; 
      setSessions(prev => {
          const newSessions = prev.filter(s => s.id !== id);
          if (id === currentSessionId) setCurrentSessionId(newSessions[0].id);
          return newSessions;
      });
  };
  
  const renameSession = (e, id) => {
      e.stopPropagation();
      const newTitle = prompt("请输入新标题");
      if(newTitle) {
          setSessions(prev => prev.map(s => s.id === id ? {...s, title: newTitle} : s));
      }
  };

  const deleteMessage = (index) => {
      if (confirm('确定删除这条消息吗？')) {
          updateMessages(prev => prev.filter((_, i) => i !== index));
      }
  };

  const toggleListening = () => {
    if (isListening) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("您的浏览器不支持语音识别。"); return; }
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = config.sttLang;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (config.autoSendStt) handleSend(transcript);
            else setInput(prev => prev + transcript);
        };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) { alert('无法启动语音识别: ' + e.message); }
  };

  const handleConfirmLogin = () => {
      sessionStorage.setItem('need_open_api_guide', 'true');
      setShowLoginTip(false);
      login();
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setSelectionMenu(prev => ({...prev, show: false})), 800);
  };

  const handleActivate = () => window.location.href = '/pricing'; 
  const handlePreviewCourse = () => window.location.href = '/course-intro';

  const handleSettingsTouchStart = (e) => {
      settingsTouchStart.current = e.touches[0].clientX;
  };
  const handleSettingsTouchEnd = (e) => {
      const touchEnd = e.changedTouches[0].clientX;
      if (touchEnd - settingsTouchStart.current > 80) { // 右滑阈值
          setShowSettings(false);
      }
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <>
      {selectionMenu.show && (
          <div id="selection-popover" style={{...styles.popover, left: selectionMenu.x, top: selectionMenu.y}}>
              <button onClick={handleTranslateSelection} style={styles.popBtn} title="解释/翻译"><FaLanguage size={14}/> 解释</button>
              <div style={styles.popDivider}></div>
              <button onClick={() => playInternalTTS(selectionMenu.text)} style={styles.popBtn} title="朗读"><FaVolumeUp size={14}/> 朗读</button>
              <div style={styles.popDivider}></div>
              <button onClick={() => copyText(selectionMenu.text)} style={styles.popBtn} title="复制">
                  {isCopied ? <FaCheck size={14} color="#4ade80"/> : <FaCopy size={14}/>} 
                  {isCopied ? '已复制' : '复制'}
              </button>
              <div style={styles.popArrow}></div>
          </div>
      )}

      {!isAiOpen && (
        <div 
            style={{...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom}}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart} onMouseMove={(e) => draggingRef.current && handleTouchMove(e)} onMouseUp={handleTouchEnd}
        >
            <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {isAiOpen && (
        <div style={styles.fullScreenContainer}>
            
            {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
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
                            <div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</div>
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

            <div style={styles.navHeader}>
                <button onClick={handleBack} style={styles.navBackBtn}>
                    <FaChevronLeft size={20} />
                </button>
                <div style={styles.navTitle}>
                    {aiMode === 'INTERACTIVE' ? 'AI 互动辅导' : `AI 助教 ${isActivated ? '' : `(${remainingQuota})`}`}
                </div>
                <div style={{display:'flex', gap:12}}>
                    {aiMode === 'INTERACTIVE' && (
                        <button onClick={resetToChatMode} style={styles.navTextBtn}>退出互动</button>
                    )}
                    <button onClick={() => setShowSidebar(true)} style={styles.navIconBtn}><FaList size={18}/></button>
                    <button onClick={() => setShowSettings(true)} style={styles.navIconBtn}><FaCog size={18}/></button>
                </div>
            </div>

            <div ref={historyRef} style={styles.chatBody}>
                {messages.length === 0 && (
                    <div style={styles.emptyState}>
                        <FaRobot size={40} color="#cbd5e1"/>
                        <p style={{color:'#94a3b8', marginTop:10, fontSize:'0.9rem'}}>
                            有什么问题都可以问我哦<br/><span style={{fontSize:'0.75rem', opacity:0.8}}>支持划词翻译、语音提问</span>
                        </p>
                    </div>
                )}
                
                {messages.map((m, i) => (
                    <div key={i} style={{...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                        <div style={{...styles.bubbleWrapper, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                            <div style={{
                                ...styles.bubble,
                                background: m.role === 'user' ? '#f1f5f9' : 'transparent',
                                borderRadius: m.role === 'user' ? '12px' : '0',
                                padding: m.role === 'user' ? '10px 14px' : '0',
                                textAlign: m.role === 'user' ? 'right' : 'left'
                            }}>
                                {m.role === 'user' ? (
                                    <div style={{fontSize:'0.95rem', color:'#1e293b', fontWeight:500, whiteSpace: 'pre-wrap'}}>{m.content}</div>
                                ) : (
                                    <div className="notion-md">
                                        {m.content === '' && loading ? (
                                            <TypingIndicator />
                                        ) : (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]} 
                                                components={{
                                                    // H1: 大标题，深蓝色，底部横线
                                                    h1: ({children}) => <h1 style={styles.h1}>{renderWithPinyin(children, config.showPinyin)}</h1>,
                                                    // H2: 二级标题，左侧紫色竖条，字体稍小
                                                    h2: ({children}) => <h2 style={styles.h2}>{renderWithPinyin(children, config.showPinyin)}</h2>,
                                                    // H3: 小标题，深灰色
                                                    h3: ({children}) => <h3 style={styles.h3}>{renderWithPinyin(children, config.showPinyin)}</h3>,
                                                    // P: 正文，递归处理 Pinyin
                                                    p: ({children}) => <p style={styles.p}>{renderWithPinyin(children, config.showPinyin)}</p>,
                                                    // Strong: 重点词，洋红色 + 加粗，且必须显示拼音
                                                    strong: ({children}) => (
                                                      <strong style={styles.strong}>
                                                        {renderWithPinyin(children, config.showPinyin)}
                                                      </strong>
                                                    ),
                                                    // List: 列表，递归处理
                                                    ul: ({children}) => <ul style={styles.ul}>{children}</ul>,
                                                    li: ({children}) => <li style={styles.li}>{renderWithPinyin(children, config.showPinyin)}</li>,
                                                    // Blockquote: 引用块，用于解释或例句背景
                                                    blockquote: ({children}) => <blockquote style={styles.blockquote}>{children}</blockquote>,
                                                    del: ({children}) => <del style={styles.del}>{children}</del>,
                                                    table: ({children}) => <div style={{overflowX:'auto'}}><table style={styles.table}>{children}</table></div>,
                                                    th: ({children}) => <th style={styles.th}>{children}</th>,
                                                    td: ({children}) => <td style={styles.td}>{renderWithPinyin(children, config.showPinyin)}</td>
                                                }}
                                            >
                                                {m.content}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={styles.msgActionBar}>
                                {m.role === 'assistant' && m.content !== '' && (
                                    <>
                                        <button onClick={() => playInternalTTS(m.content)} style={styles.msgActionBtn} title="朗读"><FaVolumeUp/></button>
                                        <button onClick={() => copyText(m.content)} style={styles.msgActionBtn} title="复制"><FaCopy/></button>
                                        <button 
                                            onClick={() => setConfig({...config, showPinyin: !config.showPinyin})} 
                                            style={{...styles.msgActionBtn, color: config.showPinyin ? '#4f46e5' : '#94a3b8'}} 
                                            title="切换拼音"
                                        >
                                            <FaFont size={12} /> 拼
                                        </button>
                                    </>
                                )}
                                {m.role === 'user' && <button onClick={() => deleteMessage(i)} style={{...styles.msgActionBtn, color:'#ef4444'}} title="删除"><FaTrashAlt/></button>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={styles.footer}>
                {!loading && suggestions.length > 0 && (
                    <div style={styles.scrollSuggestionContainer}>
                        {suggestions.map((s, idx) => (
                            <button key={idx} onClick={() => handleSend(s)} style={styles.scrollSuggestionBtn}>
                                <FaLightbulb color="#fff" size={12} style={{marginRight:6}}/>
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                <div style={styles.inputContainer}>
                    {isPlaying && (
                        <div style={styles.ttsBar} onClick={() => setIsPlaying(false)}>
                            <FaVolumeUp className="animate-pulse"/> 正在朗读... <FaStop/>
                        </div>
                    )}
                    <div style={styles.inputBox}>
                        <textarea 
                            value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                            placeholder={isListening ? "正在聆听..." : "输入问题..."}
                            style={styles.textarea} rows={1}
                        />
                        {input.trim().length > 0 ? (
                            <button onClick={() => handleSend()} disabled={loading} style={styles.sendBtn}><FaPaperPlane size={15}/></button>
                        ) : (
                            <button onClick={toggleListening} style={{...styles.micBtn, background: isListening ? '#ef4444' : 'transparent'}}>
                                <FaMicrophone size={18} color={isListening ? '#fff' : '#94a3b8'} className={isListening ? 'animate-pulse' : ''}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showLoginTip && (
                <div style={styles.paywallOverlay}>
                    <div style={{...styles.paywallModal, maxWidth: 300}}>
                        <div style={{...styles.paywallHeader, background: '#4f46e5'}}>👋 温馨提示</div>
                        <div style={styles.paywallBody}>
                            <p style={{color: '#334155', fontSize: '0.95rem', lineHeight: '1.6'}}>为了给您提供更准确的 AI 教学服务，并保存您的学习记录，请先登录账号。</p>
                            <button onClick={handleConfirmLogin} style={styles.activateBtn}><FaGoogle style={{marginRight:8}}/> 立即登录</button>
                            <button onClick={() => setShowLoginTip(false)} style={{...styles.previewBtn, marginTop: 8}}>暂不登录</button>
                        </div>
                    </div>
                </div>
            )}

            {showPaywall && (
                <div style={styles.paywallOverlay}>
                    <div style={styles.paywallModal}>
                        <div style={styles.paywallHeader}>🎉 你已经用 AI 学习了 {TOTAL_FREE_QUOTA} 次</div>
                        <div style={styles.paywallBody}>
                            <div style={styles.paywallTitle}>接下来解锁完整课程，你可以：</div>
                            <ul style={styles.featureList}>
                                <li><FaCheck color="#4ade80" style={{marginRight:8}}/> 无限提问</li>
                                <li><FaCheck color="#4ade80" style={{marginRight:8}}/> 所有语法 AI 解析</li>
                                <li><FaCheck color="#4ade80" style={{marginRight:8}}/> 错题专属讲解</li>
                            </ul>
                            <button onClick={handleActivate} style={styles.activateBtn}>【激活课程】</button>
                            <button onClick={handlePreviewCourse} style={styles.previewBtn}>【先看看课程介绍】</button>
                        </div>
                        <button onClick={() => setShowPaywall(false)} style={styles.closePaywallBtn}><FaTimes/></button>
                    </div>
                </div>
            )}

            {showSettings && (
                <div 
                    style={styles.settingsOverlay} 
                    onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
                >
                    <div 
                        style={styles.settingsModal} 
                        onTouchStart={handleSettingsTouchStart} 
                        onTouchEnd={handleSettingsTouchEnd}
                    >
                        <div style={styles.modalHeader}>
                            <h3>AI 设置</h3>
                            <button onClick={()=>setShowSettings(false)} style={styles.closeBtn}><FaTimes/></button>
                        </div>
                        
                        <div style={styles.modalBody}>
                            {!isActivated && (
                                <div style={{background:'#fff7ed', color:'#c2410c', padding:8, borderRadius:6, fontSize:'0.85rem'}}>
                                    试用剩余: {remainingQuota} / {TOTAL_FREE_QUOTA} 次
                                </div>
                            )}
                            <label style={styles.settingRow}>
                                <span>学生等级</span>
                                <select value={config.userLevel || 'H1'} onChange={e=>setConfig({...config, userLevel:e.target.value})} style={styles.select}>
                                    <option value="H1">HSK 1-2 (初学者)</option>
                                    <option value="H3">HSK 3 (进阶)</option>
                                    <option value="H4">HSK 4+ (高级)</option>
                                </select>
                            </label>

                            <label style={styles.settingRow}>
                                <span>接口地址 (Base URL)</span>
                                <input type="text" list="api-url-list" placeholder="例如: https://apis.iflow.cn/v1" value={config.baseUrl || ''} onChange={e=>setConfig({...config, baseUrl:e.target.value})} style={styles.input}/>
                                <datalist id="api-url-list">
                                    {API_ENDPOINTS.map((endpoint, idx) => <option key={idx} value={endpoint.value}>{endpoint.name}</option>)}
                                </datalist>
                            </label>

                            <label style={styles.settingRow}>
                                <span>模型名称 (Model ID)</span>
                                <input type="text" list="model-list" placeholder="手动输入或选择..." value={config.modelId || ''} onChange={e=>setConfig({...config, modelId:e.target.value})} style={styles.input}/>
                                <datalist id="model-list">
                                    {MODEL_OPTIONS.map((model, idx) => <option key={idx} value={model.value}>{model.name}</option>)}
                                </datalist>
                            </label>

                            <label style={styles.settingRow}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <span>API Key (自动隐藏)</span>
                                    <div style={{cursor:'pointer', color:'#6366f1', display:'flex', alignItems:'center', gap:4}} onClick={() => setShowKeyText(!showKeyText)}>
                                        {showKeyText ? <><FaEye size={14} /> 显示</> : <><FaEyeSlash size={14} /> 隐藏</>}
                                    </div>
                                </div>
                                <input 
                                    type={showKeyText ? "text" : "password"} 
                                    value={config.apiKey} 
                                    onChange={e=>setConfig({...config, apiKey:e.target.value})} 
                                    style={{...styles.input, fontFamily: 'monospace'}}
                                    placeholder="sk-..."
                                />
                            </label>

                            <div style={styles.switchRow}>
                                <span>显示拼音 (默认关)</span>
                                <input type="checkbox" checked={!!config.showPinyin} onChange={e=>setConfig({...config, showPinyin:e.target.checked})}/>
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
                        </div>

                        <div style={styles.modalFooter}>
                            <button onClick={()=>setShowSettings(false)} style={styles.backBtn}>
                                <FaArrowLeft size={12}/> 返回聊天
                            </button>
                            <button onClick={()=>setShowSettings(false)} style={styles.saveBtn}>
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0% {transform:scale(1);} 50% {transform:scale(1.2);} 100% {transform:scale(1);} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, system-ui, sans-serif; color: #333; line-height: 1.8; }
        
        /* 列表缩进增强 - 3级层次清晰 */
        .notion-md ul { padding-left: 1.2em; list-style: none; margin: 0.5em 0; }
        .notion-md ul ul { padding-left: 1.5em; margin: 0.3em 0; border-left: 2px solid #e2e8f0; }
        .notion-md ul ul ul { padding-left: 1.5em; border-left: 2px solid #cbd5e1; margin: 0.2em 0; }
        
        .notion-md li { position: relative; padding-left: 0.4em; margin-bottom: 6px; }
        
        /* 1级列表点 */
        .notion-md > ul > li::before {
            content: "•"; font-size: 1.2em; position: absolute; left: -0.8em; top: -0.1em; color: #4f46e5;
        }
        /* 2级列表点 */
        .notion-md ul ul > li::before {
            content: "◦"; font-size: 1.2em; position: absolute; left: -0.8em; top: -0.1em; color: #64748b; font-weight: bold;
        }
        /* 3级列表点 */
        .notion-md ul ul ul > li::before {
            content: "-"; font-size: 1.2em; position: absolute; left: -0.8em; top: -0.1em; color: #94a3b8;
        }
      `}</style>
    </>
  );
}

const styles = {
  fullScreenContainer: {
    position: 'fixed', inset: 0, 
    background: '#f8fafc', 
    zIndex: 99999, 
    display: 'flex', flexDirection: 'column',
    animation: 'slideUp 0.3s ease-out'
  },
  navHeader: {
    height: 56, background: '#fff', 
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px', borderBottom: '1px solid #e2e8f0',
    flexShrink: 0
  },
  navTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' },
  navBackBtn: { background:'none', border:'none', padding:8, cursor:'pointer', color:'#334155', marginLeft:-8 },
  navIconBtn: { background:'none', border:'none', padding:8, cursor:'pointer', color:'#64748b' },
  navTextBtn: { background:'none', border:'1px solid #e0e7ff', borderRadius: 4, padding: '4px 8px', color:'#4f46e5', fontSize:'0.8rem', cursor:'pointer' },
  chatBody: {
    flex: 1, overflowY: 'auto', padding: '16px', 
    background: '#f8fafc',
    WebkitOverflowScrolling: 'touch' 
  },
  footer: { 
    background: '#fff', borderTop: '1px solid #e2e8f0', 
    paddingBottom: 'env(safe-area-inset-bottom)', 
    display: 'flex', flexDirection: 'column'
  },
  floatingBtn: {
    position: 'fixed', width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, cursor: 'grab', touchAction: 'none' 
  },
  sidebar: {
      position: 'fixed', top: 56, left: 0, width: '75%', maxWidth: 280, bottom: 0,
      background: '#fff', borderRight: '1px solid #e2e8f0', zIndex: 100000,
      transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column'
  },
  sidebarOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:99999 },
  sidebarHeader: { padding: 20, borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' },
  newChatBtn: { background:'#fff', border:'1px solid #cbd5e1', borderRadius:6, padding:'4px 8px', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:4, cursor:'pointer' },
  sessionList: { flex: 1, overflowY: 'auto', padding: 10 },
  sessionItem: { padding: '12px', borderRadius: 8, marginBottom: 4, fontSize: '0.9rem', cursor: 'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' },
  emptyState: { marginTop:'40%', textAlign:'center' },
  messageRow: { display: 'flex', marginBottom: 24, width: '100%', flexDirection: 'column' },
  bubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '100%' },
  bubble: { fontSize: '0.95rem', width: 'fit-content', maxWidth: '100%' },
  msgActionBar: { display: 'flex', gap: 12, marginTop: 4, paddingLeft: 2, opacity: 0.6 },
  msgActionBtn: { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'2px 4px', fontSize:'0.85rem', display: 'flex', alignItems: 'center', gap: 4 },
  
  // --- 富文本排版样式 ---
  h1: { fontSize: '1.3em', fontWeight: 800, margin: '1em 0 0.6em 0', color:'#1e3a8a', borderBottom: '2px solid #e0e7ff', paddingBottom: 6 },
  h2: { fontSize: '1.15em', fontWeight: 700, margin: '0.8em 0 0.4em 0', color:'#4f46e5', paddingLeft: 8, borderLeft: '4px solid #4f46e5' },
  h3: { fontSize: '1.05em', fontWeight: 600, margin: '0.6em 0 0.3em 0', color:'#334155' },
  p: { margin: '0 0 10px 0', color: '#334155', lineHeight: 1.8 },
  strong: { fontWeight: 700, color: '#d946ef', background: 'rgba(217, 70, 239, 0.05)', padding: '0 2px', borderRadius: 2 }, // 洋红色重点词
  ul: { paddingLeft: '1em' }, 
  li: { marginBottom: '6px', color: '#334155' },
  blockquote: { borderLeft: '3px solid #cbd5e1', paddingLeft: '12px', marginLeft: 0, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '8px 12px', borderRadius: 4 },
  del: { textDecoration: 'line-through', color: '#ef4444', opacity: 0.7 },
  table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: '0.9em' },
  th: { border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f1f5f9', fontWeight: '600', textAlign: 'left', color:'#475569' },
  td: { border: '1px solid #e2e8f0', padding: '6px 10px', verticalAlign: 'top', color:'#334155' },
  
  // --- 追问气囊样式 ---
  scrollSuggestionContainer: { 
      display: 'flex', gap: 8, padding: '12px 16px 8px 16px', overflowX: 'auto', 
      whiteSpace: 'nowrap', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none'
  },
  scrollSuggestionBtn: { 
      flexShrink: 0, 
      background: 'linear-gradient(to right, #4f46e5, #6366f1)', // 渐变色气囊
      border: 'none', 
      borderRadius: '20px', 
      padding: '8px 16px', 
      fontSize: '0.85rem', 
      color: '#fff', 
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', 
      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)', 
      fontWeight: '500'
  },
  
  inputContainer: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
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
  settingsOverlay: { position:'fixed', inset:0, zIndex:12000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' },
  settingsModal: { width: '85%', maxWidth: 340, background: '#fff', borderRadius: 16, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', flexShrink: 0 },
  closeBtn: { background:'none', border:'none', fontSize:'1.2rem', color:'#64748b', cursor:'pointer' },
  modalBody: { 
      padding: 20, display:'flex', flexDirection:'column', gap: 16, overflowY: 'auto', flex: 1,
      scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' 
  },
  settingRow: { display:'flex', flexDirection:'column', gap:6, fontSize:'0.9rem', fontWeight:600, color:'#475569' },
  switchRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.9rem', color:'#334155' },
  input: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' },
  select: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', background:'#fff' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, background: '#fff', flexShrink: 0 },
  saveBtn: { flex: 2, background: '#4f46e5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', cursor:'pointer' },
  backBtn: { flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: 12, borderRadius: 8, fontSize: '0.9rem', fontWeight: 'bold', cursor:'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  paywallOverlay: {
    position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  paywallModal: {
    width: '85%', maxWidth: 360, background: '#fff', borderRadius: 24,
    padding: '0', position: 'relative', overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  },
  paywallHeader: {
    background: 'linear-gradient(135deg, #4f46e5, #ec4899)',
    padding: '24px 20px', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold',
    textAlign: 'center'
  },
  paywallBody: {
    padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16
  },
  paywallTitle: {
    fontSize: '1rem', fontWeight: 600, color: '#334155', textAlign: 'center', marginBottom: 8
  },
  featureList: {
    listStyle: 'none', padding: 0, margin: '0 0 16px 0',
    display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.95rem', color: '#475569'
  },
  activateBtn: {
    width: '100%', padding: '14px', borderRadius: 12, background: '#4f46e5',
    color: '#fff', fontSize: '1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  previewBtn: {
    width: '100%', padding: '14px', borderRadius: 12, background: '#f1f5f9',
    color: '#475569', fontSize: '0.95rem', fontWeight: '600', border: 'none', cursor: 'pointer'
  },
  closePaywallBtn: {
    position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.2)',
    border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
  }
};
