import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaPaperPlane, FaRobot, FaCog, FaTimes,
  FaVolumeUp, FaStop, FaCopy, FaMicrophone,
  FaList, FaEdit, FaTrashAlt, FaPlus, FaLightbulb, FaFeatherAlt,
  FaLanguage, FaCheck, FaFont, FaGoogle,
  FaEye, FaEyeSlash, FaArrowLeft, FaStar, FaRegStar
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

const LONG_PRESS_DURATION = 600;

// --- 简易音效引擎 (修复版) ---
// 使用 Ref 存储 Context 防止重复创建
let audioCtx = null;

const playTickSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    // 初始化或恢复 Context
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    // 稍微提高频率，听起来更像机械键盘
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) { console.error(e); }
};

// --- 拼音组件 ---
const PinyinRenderer = ({ text, show }) => {
  if (!show || !text) return text;
  const cleanText = typeof text === 'string' ? text : String(text);
  const regex = /([\u4e00-\u9fa5]+)/g;
  const parts = cleanText.split(regex);
  return (
    <span style={{ userSelect: 'text' }}>
      {parts.map((part, index) => {
        if (/[\u4e00-\u9fa5]/.test(part)) {
          const pyArray = pinyin(part, { type: 'array', toneType: 'symbol' });
          const charArray = part.split('');
          return (
            <span key={index} style={{ whiteSpace: 'nowrap', marginRight: '2px' }}>
              {charArray.map((char, i) => (
                <ruby key={i} style={{ rubyPosition: 'over', margin: '0 1px' }}>
                  {char}
                  <rt style={{ fontSize: '0.6em', color: '#64748b', fontWeight: 'normal', userSelect: 'none', WebkitUserSelect: 'none', fontFamily: 'Arial' }}>
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

// --- 打字等待动画组件 ---
const TypingIndicator = () => (
  <div style={{ display: 'flex', gap: 4, padding: '12px 8px', alignItems: 'center' }}>
    <span className="dot" style={{ animationDelay: '0s' }}></span>
    <span className="dot" style={{ animationDelay: '0.2s' }}></span>
    <span className="dot" style={{ animationDelay: '0.4s' }}></span>
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
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showLoginTip, setShowLoginTip] = useState(false);
  const [showSttLangMenu, setShowSttLangMenu] = useState(false);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0, text: '' });
  const [isCopied, setIsCopied] = useState(false);
  const [showKeyText, setShowKeyText] = useState(true);

  const [btnPos, setBtnPos] = useState({ right: 20, bottom: 40 });
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ right: 0, bottom: 0 });

  const settingsTouchStart = useRef(0);
  const longPressTimerRef = useRef(null);
  const selectionTimerRef = useRef(null);

  const audioRef = useRef(null);
  const historyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const taskToRun = useRef(null);

  // 处理返回键关闭
  useEffect(() => {
    const handlePopState = (event) => {
      if (isAiOpen) {
        setIsAiOpen(false);
      }
    };
    
    if (isAiOpen) {
      if (!window.history.state?.aiDockOpen) {
        window.history.pushState({ aiDockOpen: true }, '');
      }
      window.addEventListener('popstate', handlePopState);
    } else {
      if (window.history.state?.aiDockOpen) {
        window.history.back();
      }
    }
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAiOpen, setIsAiOpen]);
  
  // 加载收藏
  useEffect(() => {
    try {
      const storedBookmarks = localStorage.getItem('ai_bookmarks');
      if (storedBookmarks) {
        setBookmarks(JSON.parse(storedBookmarks));
      }
    } catch (e) {
      console.error("Failed to load bookmarks from localStorage", e);
    }
  }, []);

  const toggleBookmark = (message) => {
    setBookmarks(prev => {
      const isBookmarked = prev.some(b => b.id === message.id);
      let newBookmarks;
      if (isBookmarked) {
        newBookmarks = prev.filter(b => b.id !== message.id);
      } else {
        newBookmarks = [{...message, bookmarkedAt: new Date().toISOString()}, ...prev];
      }
      try {
        localStorage.setItem('ai_bookmarks', JSON.stringify(newBookmarks));
      } catch (e) {
        console.error("Failed to save bookmarks to localStorage", e);
      }
      return newBookmarks;
    });
  };

  const handleBookmarkClick = (content) => {
    setInput(content);
    setShowSidebar(false);
    textareaRef.current?.focus();
  };

  const messages = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  }, [sessions, currentSessionId]);

  const updateMessages = useCallback((updater) => {
    if (!currentSessionId) return;
    setSessions(prevSessions =>
      prevSessions.map(s => {
        if (s.id === currentSessionId) {
          const newMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
          const msgsWithId = newMsgs.map(m => m.id ? m : { ...m, id: `${Date.now()}-${Math.random()}` });
          let newTitle = s.title;
          if (aiMode === 'CHAT' && s.title.startsWith('新对话') && msgsWithId.length > 1) {
            const firstUserMsg = msgsWithId.find(m => m.role === 'user');
            if (firstUserMsg) newTitle = firstUserMsg.content.substring(0, 15);
          }
          return { ...s, messages: msgsWithId, title: newTitle, date: new Date().toISOString() };
        }
        return s;
      })
    );
  }, [currentSessionId, setSessions, aiMode]);

  // --- 选区监听注册 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('selectionchange', handleSelectionChange);
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isAiOpen]);

  // 滚动到底部
  useEffect(() => {
    if (historyRef.current && isAiOpen) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiOpen, loading]);

  // --- 自动触发逻辑 (Active Task) ---
  useEffect(() => {
    if (activeTask && activeTask.timestamp) {
      const lastProcessed = sessionStorage.getItem('last_ai_task_ts');
      if (lastProcessed === String(activeTask.timestamp)) return;
      sessionStorage.setItem('last_ai_task_ts', String(activeTask.timestamp));

      let hiddenPrompt;
      let newSessionTitle;
      let initialMessages = [];

      if (aiMode === 'INTERACTIVE') {
        newSessionTitle = `${activeTask.grammarPoint} - 错题分析`;
        hiddenPrompt = `我正在做这道题，请帮我分析一下：\n- **题目**: "${activeTask.question}"\n- **我的选择**: "${activeTask.userChoice}"\n- **涉及语法点**: ${activeTask.grammarPoint}`;
        initialMessages.push({ role: 'assistant', content: `好的，我们来分析这道关于 **${activeTask.grammarPoint}** 的题目。`, id: Date.now() });
      } else if (aiMode === 'CHAT' && activeTask.content) {
        newSessionTitle = activeTask.title || '语法讲解';
        hiddenPrompt = `老师，请针对语法点【${activeTask.title}】，严格按照你系统指令中的“2.0 教学流程（增强详细版）”给我一份深度讲解。
要求：
1. 必须包含：情境导入、心里有数、语序对照表、最安全句型、必踩的坑。
2. 重点词汇请务必使用 **加粗**（例如：**把**字句），方便我查看拼音。
3. 请分段清晰，多使用 H3 (###) 标题。`;
      } else {
        return;
      }

      const newSession = {
        id: Date.now(),
        title: newSessionTitle,
        messages: initialMessages,
        date: new Date().toISOString()
      };
      
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      taskToRun.current = { prompt: hiddenPrompt, history: initialMessages };
    }
  }, [activeTask, aiMode, setSessions, setCurrentSessionId]);

  useEffect(() => {
    if (taskToRun.current && currentSessionId) {
      const { prompt, history } = taskToRun.current;
      taskToRun.current = null;
      handleSend(prompt, true, history);
    }
  }, [currentSessionId]);

  // --- 选区处理逻辑 ---
  const handleSelectionChange = () => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);

    selectionTimerRef.current = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        const text = selection.toString().trim();
        if (text.length > 0 && isAiOpen) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          let top = rect.top - 50; 
          let left = rect.left + (rect.width / 2);
          
          if (top < 10) top = rect.bottom + 10;
          
          setSelectionMenu({ show: true, x: left, y: top, text: text });
          setIsCopied(false);
        } else {
           // 只有当没有选区时才关闭，点击菜单操作不应导致关闭
           if (!text && !selectionMenu.show) {
               setSelectionMenu(prev => ({ ...prev, show: false }));
           }
        }
    }, 600); // 稍微缩短反应时间
  };

  const handleOutsideClick = (e) => {
    const menu = document.getElementById('selection-popover');
    if (menu && !menu.contains(e.target)) {
        // 如果点击的不是菜单，且选区为空，才关闭
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
            setSelectionMenu(prev => ({ ...prev, show: false }));
        }
    }
    const sttMenu = document.getElementById('stt-lang-menu');
    if (sttMenu && !sttMenu.contains(e.target)) {
        setShowSttLangMenu(false);
    }
  };

  const handleTranslateSelection = () => {
    if (!selectionMenu.text) return;
    handleSend(`请用缅文详细解释这段文字：\n"${selectionMenu.text}"`);
    setSelectionMenu(prev => ({ ...prev, show: false }));
    // 移除这行，保留选区：window.getSelection().removeAllRanges();
  };

  const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
  };

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
    resetToChatMode();
  };

  const switchSession = (id) => {
    setCurrentSessionId(id);
    setShowSidebar(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== id);
      if (id === currentSessionId) setCurrentSessionId(newSessions[0].id);
      return newSessions;
    });
  };

  const renameSession = (e, id) => {
    e.stopPropagation();
    const newTitle = prompt("请输入新标题");
    if (newTitle) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
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

  const handleMicButtonPress = () => {
    longPressTimerRef.current = setTimeout(() => {
        setShowSttLangMenu(true);
    }, LONG_PRESS_DURATION);
  };

  const handleMicButtonRelease = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        if (!showSttLangMenu) {
            toggleListening();
        }
    }
  };
  
  const handleSttLangSelect = (lang) => {
      setConfig({...config, sttLang: lang});
      setShowSttLangMenu(false);
  }

  const handleConfirmLogin = () => {
    sessionStorage.setItem('need_open_api_guide', 'true');
    setShowLoginTip(false);
    login();
  };

  // --- 停止生成 ---
  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setLoading(false);
      updateMessages(prev => {
          const last = prev[prev.length - 1];
          // 如果最后一条是机器人的空消息或者不完整消息，可以标记一下
          if (last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + ' (已停止)' }];
          }
          return prev;
      });
  };

  // --- 发送逻辑 ---
  const handleSend = async (textToSend = input, isSystemTrigger = false, historyOverride = null) => {
    const contentToSend = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!contentToSend || loading) return;

    if (!isSystemTrigger && !user) { setShowLoginTip(true); return; }
    if (!config.apiKey) { alert('请先在设置中配置 API Key'); setShowSettings(true); return; }
    if (!isSystemTrigger && !isActivated) {
      try {
        const auth = await canUseAI();
        const canUse = (auth && typeof auth === 'object') ? auth.canUse : auth;
        if (!canUse) { setShowPaywall(true); return; }
      } catch (e) { alert("网络校验失败，请检查网络连接"); return; }
    }
    
    if (!isSystemTrigger) setInput('');
    setSuggestions([]);
    setLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const userMessage = { role: 'user', content: contentToSend };
    
    let apiMessages = [];
    const BASIC_PROMPT = `你是一名拥有10年经验的汉语教师，擅长用缅甸语辅助教学。请耐心回答学生的问题。`;
    
    if (isSystemTrigger && aiMode === 'CHAT' && activeTask) {
        apiMessages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentToSend }
        ];
    } else {
        const currentHistory = historyOverride !== null ? historyOverride : messages;
        const historyForApi = [...currentHistory, userMessage];
        const historyMsgs = historyForApi.slice(-10).map(({ role, content }) => ({ role, content }));
        apiMessages = [{ role: 'system', content: BASIC_PROMPT }, ...historyMsgs];
    }

    const level = config.userLevel || 'H1';
    const isLowLevel = ['H1', 'H2', 'HSK1', 'HSK2'].some(l => level.toUpperCase().includes(l));
    if (isLowLevel) {
        if (apiMessages.length > 0 && apiMessages[0].role === 'system') {
            apiMessages[0].content += "\n\n【System Override】: The user is a BEGINNER (HSK 1-2). You MUST use **Burmese (缅甸语)** for all explanations, context, and logic analysis. Only use Chinese for the specific vocabulary/sentences being taught.";
        }
    }

    const assistantPlaceholder = { role: 'assistant', content: '', id: `${Date.now()}-assist` };
    if (isSystemTrigger) {
      updateMessages(prev => [...prev, assistantPlaceholder]);
    } else {
      updateMessages(prev => [...prev, { ...userMessage, id: `${Date.now()}-user` }, assistantPlaceholder]);
    }
    
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          email: user?.email,
          config: { apiKey: config.apiKey?.trim(), baseUrl: config.baseUrl?.trim(), modelId: config.modelId?.trim() }
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
      let buffer = '';
      let fullContent = '';
      let rawFullContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          
          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.substring(5).trim();
              if (jsonStr === '[DONE]') continue;
              const data = JSON.parse(jsonStr);
              const delta = data.choices?.[0]?.delta?.content || '';
              if (delta) {
                rawFullContent += delta;
                
                // --- 修复打字音效调用 ---
                if (config.soundEnabled) playTickSound();

                // --- 气囊解析逻辑 ---
                const suggestionRegex = /<<<SUGGESTIONS:(.*?)>>>/s;
                const match = rawFullContent.match(suggestionRegex);
                let contentToDisplay = rawFullContent;

                if (match) {
                    contentToDisplay = rawFullContent.replace(match[0], '').trim();
                    const suggestionsStr = match[1];
                    if (suggestionsStr) {
                        const newSuggestions = suggestionsStr.split('|').map(s => s.trim()).filter(s => s);
                        setSuggestions(newSuggestions);
                    }
                }

                fullContent = contentToDisplay;
                
                updateMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1].content = fullContent;
                  }
                  return updated;
                });
              }
            } catch (e) {
              console.error("无法解析流:", e);
            }
          }
        }
      }

      updateMessages(prev => {
        const final = [...prev];
        if (final.length > 0) {
          final[final.length - 1].id = Date.now();
        }
        return final;
      });
      
      if (!isSystemTrigger && !isActivated) await recordUsage();
      if (config.autoTTS) playInternalTTS(fullContent);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Chat Error:", err);
        updateMessages(prev => {
          const last = prev[prev.length - 1];
          const newContent = last.content || `[系统]: 生成中断，请检查设置。(${err.message})`;
          return [...prev.slice(0, -1), { ...last, content: newContent }];
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };


  const playInternalTTS = async (text) => {
    if (!text) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(true);
    
    // --- TTS 净化逻辑 ---
    let clean = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    clean = clean.replace(/[*#`>~\-\[\]_]/g, '');
    clean = clean.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\u1000-\u109F]/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
        
    const rate = Math.round((config.ttsSpeed - 1) * 100); // Edge TTS 格式可能不同，这里假设接口兼容
    
    // 🔴 修复：修改为用户提供的接口
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(clean)}&v=${config.ttsVoice}`;
    
    try {
      // 直接使用 Audio 播放远程链接
      const audio = new Audio(url);
      audioRef.current = audio;
      
      // 监听错误，万一接口挂了
      audio.onerror = () => {
          setIsPlaying(false);
          alert("TTS 服务暂时不可用");
      };

      audio.onended = () => setIsPlaying(false);
      await audio.play();
    } catch (e) { 
        console.error(e);
        setIsPlaying(false); 
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    // 稍微延迟关闭菜单，给用户反馈时间
    setTimeout(() => setSelectionMenu(prev => ({ ...prev, show: false })), 800);
  };

  const handleActivate = () => window.location.href = '/pricing';
  const handlePreviewCourse = () => window.location.href = '/course-intro';

  const handleSettingsTouchStart = (e) => {
    settingsTouchStart.current = e.touches[0].clientX;
  };

  const handleSettingsTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0].clientX;
    if (touchEnd - settingsTouchStart.current > 80) {
      setShowSettings(false);
    }
  };

  const handleTextareaChange = (e) => {
      setInput(e.target.value);
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
  };

  const renderWithPinyin = (children) => {
    return React.Children.map(children, c => 
      typeof c === 'string' ? <PinyinRenderer text={c} show={config.showPinyin} /> : c
    );
  };

  return (
    <>
      {/* 选词菜单 */}
      {selectionMenu.show && (
        <div id="selection-popover" style={{ ...styles.popover, left: selectionMenu.x, top: selectionMenu.y }}>
          <button onClick={handleTranslateSelection} style={styles.popBtn} title="解释/翻译"><FaLanguage size={14} /> 解释</button>
          <div style={styles.popDivider}></div>
          <button onClick={() => playInternalTTS(selectionMenu.text)} style={styles.popBtn} title="朗读"><FaVolumeUp size={14} /> 朗读</button>
          <div style={styles.popDivider}></div>
          <button onClick={() => copyText(selectionMenu.text)} style={styles.popBtn} title="复制">
            {isCopied ? <FaCheck size={14} color="#4ade80" /> : <FaCopy size={14} />}
            {isCopied ? '已复制' : '复制'}
          </button>
          <div style={styles.popArrow}></div>
        </div>
      )}

      {!isAiOpen && (
        <div
          style={{ ...styles.floatingBtn, right: btnPos.right, bottom: btnPos.bottom }}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart} onMouseMove={(e) => draggingRef.current && handleTouchMove(e)} onMouseUp={handleTouchEnd}
        >
          <FaFeatherAlt size={24} color="#fff" />
        </div>
      )}

      {isAiOpen && (
        <div style={styles.fullScreenContainer}>
          {showSidebar && <div onClick={() => setShowSidebar(false)} style={styles.sidebarOverlay} />}
          <div style={{ ...styles.sidebar, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)' }}>
            <div style={styles.sidebarHeader}>
              <h3>历史记录</h3>
              <button onClick={createNewSession} style={styles.newChatBtn}><FaPlus size={12} /> 新对话</button>
            </div>
            <div style={styles.sessionList}>
              {sessions.map(s => (
                <div key={s.id} onClick={() => switchSession(s.id)} style={{
                  ...styles.sessionItem,
                  background: currentSessionId === s.id ? '#eff6ff' : 'transparent',
                  color: currentSessionId === s.id ? '#2563eb' : '#334155'
                }}>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  {currentSessionId === s.id && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <FaEdit size={12} onClick={(e) => renameSession(e, s.id)} style={{ cursor: 'pointer' }} />
                      <FaTrashAlt size={12} onClick={(e) => deleteSession(e, s.id)} style={{ cursor: 'pointer', color: '#ef4444' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={styles.bookmarkSection}>
                <h4 style={styles.bookmarkHeader}><FaStar size={14} style={{marginRight: 6}}/>我的收藏</h4>
                <div style={styles.bookmarkList}>
                    {bookmarks.length > 0 ? bookmarks.map(b => (
                        <div key={b.id} style={styles.bookmarkItem} onClick={() => handleBookmarkClick(b.content)}>
                            <p style={styles.bookmarkContent}>{b.content}</p>
                        </div>
                    )) : <p style={styles.noBookmarks}>暂无收藏</p>}
                </div>
            </div>
          </div>

          <div style={styles.navHeader}>
            <button onClick={() => setShowSidebar(true)} style={styles.navIconBtn}><FaList size={20} /></button>
            <div style={styles.navTitle}>
              {aiMode === 'INTERACTIVE' ? 'AI 互动辅导' : `AI 助教 ${isActivated ? '' : `(${remainingQuota})`}`}
            </div>
            <button onClick={() => setShowSettings(true)} style={styles.navIconBtn}><FaCog size={20} /></button>
          </div>

          <div ref={historyRef} style={styles.chatBody} onContextMenu={handleContextMenu}>
            {messages.length === 0 && !loading && (
              <div style={styles.emptyState}>
                <FaRobot size={40} color="#cbd5e1" />
                <p style={{ color: '#94a3b8', marginTop: 10, fontSize: '0.9rem' }}>
                  有什么问题都可以问我哦<br /><span style={{ fontSize: '0.75rem', opacity: 0.8 }}>支持划词翻译、语音提问</span>
                </p>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={m.id || i} style={{ ...styles.messageRow, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.bubbleWrapper, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    ...styles.bubble,
                    background: m.role === 'user' ? '#f1f5f9' : 'transparent',
                    borderRadius: m.role === 'user' ? '12px' : '0',
                    padding: m.role === 'user' ? '10px 14px' : '0',
                    textAlign: m.role === 'user' ? 'right' : 'left'
                  }}>
                    {m.role === 'user' ? (
                      <div style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: 500, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    ) : (
                      <div className="notion-md">
                        {m.content === '' && loading && i === messages.length - 1 ? (
                          <TypingIndicator />
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => <h1 style={styles.h1}>{renderWithPinyin(children)}</h1>,
                              h2: ({ children }) => <h2 style={styles.h2}>{renderWithPinyin(children)}</h2>,
                              h3: ({ children }) => <h3 style={styles.h3}>{renderWithPinyin(children)}</h3>,
                              p: ({ children }) => <p style={styles.p}>{renderWithPinyin(children)}</p>,
                              strong: ({ children }) => <strong style={styles.strong}>{renderWithPinyin(children)}</strong>,
                              ul: ({ children }) => <ul style={styles.ul}>{children}</ul>,
                              li: ({ children }) => <li style={styles.li}>{renderWithPinyin(children)}</li>,
                              del: ({ children }) => <del style={styles.del}>{renderWithPinyin(children)}</del>,
                              // 修复表格溢出问题
                              table: ({ children }) => <div style={styles.tableWrapper}><table style={styles.table}>{children}</table></div>,
                              th: ({ children }) => <th style={styles.th}>{renderWithPinyin(children)}</th>,
                              td: ({ children }) => <td style={styles.td}>{renderWithPinyin(children)}</td>
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
                        <button onClick={() => toggleBookmark(m)} style={styles.msgActionBtn} title="收藏">
                            {bookmarks.some(b => b.id === m.id) ? <FaStar color="#facc15"/> : <FaRegStar/>}
                        </button>
                        <button onClick={() => playInternalTTS(m.content)} style={styles.msgActionBtn} title="朗读"><FaVolumeUp /></button>
                        <button onClick={() => copyText(m.content)} style={styles.msgActionBtn} title="复制"><FaCopy /></button>
                        <button
                          onClick={() => setConfig({ ...config, showPinyin: !config.showPinyin })}
                          style={{ ...styles.msgActionBtn, color: config.showPinyin ? '#4f46e5' : '#94a3b8' }}
                          title="切换拼音"
                        >
                          <FaFont size={12} /> 拼
                        </button>
                      </>
                    )}
                    {m.role === 'user' && <button onClick={() => deleteMessage(i)} style={{ ...styles.msgActionBtn, color: '#ef4444' }} title="删除"><FaTrashAlt /></button>}
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
                    <FaLightbulb color="#4f46e5" size={10} style={{ marginRight: 6 }} />
                    <PinyinRenderer text={s} show={config.showPinyin} />
                  </button>
                ))}
              </div>
            )}
            <div style={styles.inputContainer}>
              {isPlaying && (
                <div style={styles.ttsBar} onClick={() => { audioRef.current?.pause(); setIsPlaying(false); }}>
                  <FaVolumeUp className="animate-pulse" /> 正在朗读... <FaStop />
                </div>
              )}
              <div style={styles.inputBox}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={isListening ? "正在聆听..." : "输入问题..."}
                  style={styles.textarea}
                  rows={1}
                />
                <div style={{position: 'relative'}}>
                    {/* 按钮逻辑：Loading时显示停止，有输入时显示发送，否则显示麦克风 */}
                    {loading ? (
                         <button onClick={handleStop} style={{ ...styles.dynamicInputBtn, background: '#ef4444' }}>
                             <FaStop size={18} color="#fff" />
                         </button>
                    ) : input.trim().length > 0 ? (
                        <button onClick={() => handleSend()} disabled={loading} style={styles.dynamicInputBtn}>
                            <FaPaperPlane size={20} color="#fff" />
                        </button>
                    ) : (
                        <>
                            <button
                                onMouseDown={handleMicButtonPress}
                                onMouseUp={handleMicButtonRelease}
                                onTouchStart={handleMicButtonPress}
                                onTouchEnd={handleMicButtonRelease}
                                style={{ ...styles.dynamicInputBtn, background: isListening ? '#ef4444' : '#6366f1' }}
                            >
                              <FaMicrophone size={22} color="#fff" className={isListening ? 'animate-pulse' : ''} />
                            </button>
                            {showSttLangMenu && (
                                <div id="stt-lang-menu" style={styles.sttLangMenu}>
                                    {STT_LANGS.map(lang => (
                                        <div key={lang.value} onClick={() => handleSttLangSelect(lang.value)} style={styles.sttLangItem}>
                                            {lang.label} {config.sttLang === lang.value && <FaCheck size={12} color="#4f46e5"/>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Login Tip Modal */}
          {showLoginTip && (
            <div style={styles.paywallOverlay}>
              <div style={{ ...styles.paywallModal, maxWidth: 300 }}>
                <div style={{ ...styles.paywallHeader, background: '#4f46e5' }}>👋 温馨提示</div>
                <div style={styles.paywallBody}>
                  <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: '1.6' }}>为了给您提供更准确的 AI 教学服务，并保存您的学习记录，请先登录账号。</p>
                  <button onClick={handleConfirmLogin} style={styles.activateBtn}><FaGoogle style={{ marginRight: 8 }} /> 立即登录</button>
                  <button onClick={() => setShowLoginTip(false)} style={{ ...styles.previewBtn, marginTop: 8 }}>暂不登录</button>
                </div>
              </div>
            </div>
          )}

          {/* Paywall Modal */}
          {showPaywall && (
            <div style={styles.paywallOverlay}>
              <div style={styles.paywallModal}>
                <div style={styles.paywallHeader}>🎉 你已经用 AI 学习了 {TOTAL_FREE_QUOTA} 次</div>
                <div style={styles.paywallBody}>
                  <div style={styles.paywallTitle}>接下来解锁完整课程，你可以：</div>
                  <ul style={styles.featureList}>
                    <li><FaCheck color="#4ade80" style={{ marginRight: 8 }} /> 无限提问</li>
                    <li><FaCheck color="#4ade80" style={{ marginRight: 8 }} /> 所有语法 AI 解析</li>
                    <li><FaCheck color="#4ade80" style={{ marginRight: 8 }} /> 错题专属讲解</li>
                  </ul>
                  <button onClick={handleActivate} style={styles.activateBtn}>【激活课程】</button>
                  <button onClick={handlePreviewCourse} style={styles.previewBtn}>【先看看课程介绍】</button>
                </div>
                <button onClick={() => setShowPaywall(false)} style={styles.closePaywallBtn}><FaTimes /></button>
              </div>
            </div>
          )}

          {/* Settings Modal */}
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
                  <button onClick={() => setShowSettings(false)} style={styles.closeBtn}><FaTimes /></button>
                </div>

                <div style={styles.modalBody}>
                  {!isActivated && (
                    <div style={{ background: '#fff7ed', color: '#c2410c', padding: 8, borderRadius: 6, fontSize: '0.85rem' }}>
                      试用剩余: {remainingQuota} / {TOTAL_FREE_QUOTA} 次
                    </div>
                  )}
                  <div style={styles.inputGroup}>
                    <label style={styles.settingRow}>
                        <span>学生等级</span>
                        <select value={config.userLevel || 'H1'} onChange={e=>setConfig({...config, userLevel:e.target.value})} style={styles.select}>
                            <option value="H1">HSK 1-2 (初学者)</option>
                            <option value="H3">HSK 3 (进阶)</option>
                            <option value="H4">HSK 4+ (高级)</option>
                        </select>
                    </label>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.settingRow}>
                        <span>接口地址 (Base URL)</span>
                        <input type="text" placeholder="例如: https://apis.iflow.cn/v1" value={config.baseUrl || ''} onChange={e=>setConfig({...config, baseUrl:e.target.value})} style={styles.input}/>
                    </label>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.settingRow}>
                        <span>模型名称 (Model ID)</span>
                        <input type="text" placeholder="手动输入或选择..." value={config.modelId || ''} onChange={e=>setConfig({...config, modelId:e.target.value})} style={styles.input}/>
                    </label>
                  </div>
                  <div style={styles.inputGroup}>
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
                  </div>
                  <div style={styles.switchRow}>
                    <span>显示拼音 (默认关)</span>
                    <input type="checkbox" checked={!!config.showPinyin} onChange={e => setConfig({ ...config, showPinyin: e.target.checked })} />
                  </div>
                  <div style={styles.switchRow}>
                    <span>打字音效</span>
                    <input type="checkbox" checked={config.soundEnabled} onChange={e => setConfig({ ...config, soundEnabled: e.target.checked })} />
                  </div>
                  <label style={styles.settingRow}>
                    <span>语速 ({config.ttsSpeed}x)</span>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={config.ttsSpeed} onChange={e => setConfig({ ...config, ttsSpeed: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                  </label>
                  <label style={styles.settingRow}>
                    <span>发音人</span>
                    <select value={config.ttsVoice} onChange={e => setConfig({ ...config, ttsVoice: e.target.value })} style={styles.select}>
                      {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </label>
                  <hr style={{ margin: '10px 0', borderColor: '#f1f5f9' }} />
                  <label style={styles.settingRow}>
                    <span>语音识别语言</span>
                    <select value={config.sttLang} onChange={e => setConfig({ ...config, sttLang: e.target.value })} style={styles.select}>
                      {STT_LANGS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </label>
                  <div style={styles.switchRow}>
                    <span>识别后自动发送</span>
                    <input type="checkbox" checked={config.autoSendStt} onChange={e => setConfig({ ...config, autoSendStt: e.target.checked })} />
                  </div>
                </div>

                <div style={styles.modalFooter}>
                  <button onClick={() => setShowSettings(false)} style={styles.backBtn}>
                    <FaArrowLeft size={12} /> 返回聊天
                  </button>
                  <button onClick={() => setShowSettings(false)} style={styles.saveBtn}>
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
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-pulse { animation: pulse 1.5s infinite; }
        .notion-md { font-family: -apple-system, system-ui, sans-serif; color: #333; line-height: 1.9; }
        .notion-md ul { padding-left: 1.2em; list-style: none; margin: 0.5em 0; }
        .notion-md li { position: relative; padding-left: 0.2em; margin-bottom: 4px; }
        .notion-md > ul > li::before {
            content: "▪️"; font-size: 0.7em; position: absolute; left: -1.2em; top: 0.4em; color: #333;
        }
        .notion-md ul ul > li::before {
            content: "◦"; font-size: 1.2em; position: absolute; left: -1em; top: -0.1em; color: #555;
            font-weight: bold;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}

const styles = {
  fullScreenContainer: { position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 99999, display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease-out' },
  navHeader: { height: 56, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, paddingTop: 'env(safe-area-inset-top)' },
  navTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', textAlign: 'center', flex: 1, marginRight: '-48px' },
  navIconBtn: { background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: '#64748b', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // 修改：userSelect: 'text' 确保所有区域文字可选
  chatBody: { flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc', WebkitOverflowScrolling: 'touch', userSelect: 'text', WebkitUserSelect: 'text' },
  footer: { background: '#fff', borderTop: '1px solid #e2e8f0', paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  floatingBtn: { position: 'fixed', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'grab', touchAction: 'none' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '80%', maxWidth: 300, bottom: 0, background: '#fff', borderRight: '1px solid #e2e8f0', zIndex: 100000, transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' },
  sidebarOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99999 },
  sidebarHeader: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  newChatBtn: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' },
  sessionList: { flex: 1, overflowY: 'auto', padding: 10, borderBottom: '1px solid #e2e8f0' },
  sessionItem: { padding: '12px', borderRadius: 8, marginBottom: 4, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bookmarkSection: { display: 'flex', flexDirection: 'column', height: '40%', flexShrink: 0 },
  bookmarkHeader: { margin: 0, padding: '16px 20px', fontSize: '1rem', borderBottom: '1px solid #e2e8f0', display:'flex', alignItems:'center' },
  bookmarkList: { flex: 1, overflowY: 'auto', padding: '10px 20px' },
  bookmarkItem: { padding: '12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8, cursor: 'pointer' },
  bookmarkContent: { margin: 0, fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' },
  noBookmarks: { fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', marginTop: 20 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' },
  messageRow: { display: 'flex', marginBottom: 24, width: '100%', flexDirection: 'column' },
  bubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '100%' },
  bubble: { fontSize: '0.95rem', width: 'fit-content', maxWidth: '100%' },
  msgActionBar: { display: 'flex', gap: 12, marginTop: 4, padding: '0 4px', opacity: 0.8 },
  msgActionBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 },
  h1: { fontSize: '1.4em', fontWeight: 700, margin: '1em 0 0.5em 0', color: '#111', lineHeight: 1.3 },
  h2: { fontSize: '1.2em', fontWeight: 600, margin: '0.8em 0 0.4em 0', borderBottom: '1px solid #f1f5f9', paddingBottom: 4, color: '#333' },
  h3: { fontSize: '1.05em', fontWeight: 600, margin: '0.6em 0 0.3em 0', color: '#444' },
  p: { margin: '0 0 8px 0', color: '#333' },
  strong: { fontWeight: 700, color: '#000' },
  ul: { paddingLeft: '1.2em' },
  li: { marginBottom: '4px' },
  del: { textDecoration: 'line-through', color: '#ef4444', opacity: 0.7 },
  // 修改：表格容器样式
  tableWrapper: { overflowX: 'auto', width: '100%', margin: '10px 0' },
  // 修改：表格固定布局，防止无限撑开
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', tableLayout: 'fixed', minWidth: '300px' },
  th: { border: '1px solid #e2e8f0', padding: '6px 10px', background: '#f8fafc', fontWeight: '600', textAlign: 'left', wordBreak: 'break-word' },
  // 修改：单元格强制换行
  td: { border: '1px solid #e2e8f0', padding: '6px 10px', verticalAlign: 'top', wordBreak: 'break-word' },
  scrollSuggestionContainer: { display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 16px 8px 16px', overflowY: 'auto', maxHeight: 100 },
  scrollSuggestionBtn: { flexShrink: 0, background: '#ffffff', border: '1px solid #e0e7ff', borderRadius: '20px', padding: '8px 16px', fontSize: '0.88rem', color: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.08)', fontWeight: '500' },
  inputContainer: { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 },
  ttsBar: { background: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', padding: '4px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', alignSelf: 'flex-start' },
  inputBox: { display: 'flex', alignItems: 'flex-end', gap: 10, padding: '4px', background: '#fff' },
  textarea: { flex: 1, border: '1px solid #e2e8f0', borderRadius: 20, background: '#f8fafc', padding: '10px 16px', fontSize: '1rem', outline: 'none', resize: 'none', maxHeight: 120, lineHeight: 1.5 },
  dynamicInputBtn: { width: 44, height: 44, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, background: '#6366f1', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' },
  sttLangMenu: { position: 'absolute', bottom: '120%', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 8, width: 140, zIndex: 20 },
  sttLangItem: { padding: '8px 10px', borderRadius: 6, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  popover: { position: 'fixed', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 999999, color: '#fff', whiteSpace: 'nowrap' },
  popArrow: { position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' },
  popBtn: { background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' },
  popDivider: { width: 1, height: 16, background: 'rgba(255,255,255,0.3)' },
  settingsOverlay: { position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  settingsModal: { width: '90%', maxWidth: 380, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '85vh' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer' },
  modalBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' },
  inputGroup: { minHeight: '80px', marginBottom: '16px' },
  settingRow: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem', fontWeight: 600, color: '#475569' },
  switchRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: '#334155', padding: '12px 0' },
  input: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%' },
  select: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff', width: '100%' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, background: '#fff', flexShrink: 0 },
  saveBtn: { flex: 2, background: '#4f46e5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
  backBtn: { flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: 12, borderRadius: 8, fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  paywallOverlay: { position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  paywallModal: { width: '85%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '0', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  paywallHeader: { background: 'linear-gradient(135deg, #4f46e5, #ec4899)', padding: '24px 20px', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' },
  paywallBody: { padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  paywallTitle: { fontSize: '1rem', fontWeight: 600, color: '#334155', textAlign: 'center', marginBottom: 8 },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 16px 0', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.95rem', color: '#475569' },
  activateBtn: { width: '100%', padding: '14px', borderRadius: 12, background: '#4f46e5', color: '#fff', fontSize: '1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  previewBtn: { width: '100%', padding: '14px', borderRadius: 12, background: '#f1f5f9', color: '#475569', fontSize: '0.95rem', fontWeight: '600', border: 'none', cursor: 'pointer' },
  closePaywallBtn: { position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
};
