import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数：激活码校验 (完整保留) ---
const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };
  const c = code.trim().toUpperCase();
  if (!c.includes('-JHM-')) return { isValid: false, error: '格式错误' };
  const parts = c.split('-');
  const VALID = ['Hsk1', 'Hsk2', 'Hsk3', 'Hsk4', 'Hsk5', 'Hsk6', 'H7-9'];
  if (!VALID.includes(parts[0])) return { isValid: false, error: '等级不支持' };
  return { isValid: true, level: parts[0] };
};

export const AIProvider = ({ children }) => {
  /* ======================
     1. 用户 / 激活 / 谷歌状态
  ====================== */
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  /* ======================
     2. AI 配置
  ====================== */
  const [config, setConfig] = useState({
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1', 
    modelId: 'deepseek-ai/deepseek-v3.2',
    userLevel: 'H1',
    showPinyin: true, 
    autoSendStt: false, 
    ttsSpeed: 1,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    soundEnabled: true,
    systemPrompt: '' 
  });

  /* ======================
     3. AI UI / 会话 / 历史记录
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ======================
     4. 配额管理
  ====================== */
  const TOTAL_FREE_QUOTA = 60; 
  const [remainingQuota, setRemainingQuota] = useState(0);

  /* ======================
     5. 模式与上下文管理
  ====================== */
  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null); 
  const [pageContext, setPageContext] = useState('');

  /* ======================
     6. 提示词模板 (核心修复：增加灵活性防止死循环)
  ====================== */
  const SYSTEM_PROMPTS = {
    CHAT: `你是一位专门教【缅甸学生】学习汉语的老师。
【当前学生等级】{{LEVEL}}
【当前页面内容】{{CONTEXT}}

【语言强制执行规则】
- 如果学生用中文提问，你用中文回答并辅以关键词的缅文解释。
- 如果学生用缅文提问，你用缅文回答。
- Hsk1 / Hsk2：必须【缅文为主】，中文仅作为关键词或例句。
- Hsk3 / Hsk4：采取“中文+缅文”对照讲解。
- Hsk5 及以上：以中文讲解为主，难点辅以缅文。

【回答结构】
1. 用符合等级的语言解释。
2. 结合【当前页面内容】举例。
3. 结尾给出 3-5 个追问建议。
追问格式：SUGGESTIONS: 建议1|||建议2|||建议3`,

    INTERACTIVE: `你是一名缅甸学生的汉语语法私教。当前处于【错题专项解析】模式。

【错题背景】
- 语法点：{{GRAMMAR}}
- 题目：{{QUESTION}}
- 学生误选：{{USER_CHOICE}}
【学生等级】{{LEVEL}}

【核心逻辑】
1. **针对性**：首先根据上述错题信息，按照“还原错因->场景尴尬感->窍门引导”进行补课。
2. **灵活性（重要）**：如果学生在后续对话中提出了与当前语法或本错题无关的其他问题，请立即切换为普通老师身份回答，不要强行套用语法和错题背景。

【语言规则】
- Hsk1/Hsk2：全缅文解释逻辑。
- Hsk3/Hsk4：中文解释后紧跟缅文翻译。

【追问生成】
基于当前对话生成 3 个追问，使用格式：SUGGESTIONS: Q1|||Q2|||Q3`
  };

  /* ======================
     7. 初始化与本地存储
  ====================== */
  useEffect(() => {
    const cachedUser = localStorage.getItem(USER_KEY);
    if (cachedUser) {
      try {
        const u = JSON.parse(cachedUser);
        setUser(u);
        if (u.unlocked_levels) setIsActivated(true);
      } catch (e) {}
    }

    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try { setConfig((c) => ({ ...c, ...JSON.parse(savedConfig) })); } catch (e) {}
    }

    const savedSessions = localStorage.getItem(SESSIONS_KEY);
    let initialSessions = [];
    if (savedSessions) {
        try { initialSessions = JSON.parse(savedSessions); } catch(e) {}
    }
    if (initialSessions.length === 0) {
        const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() };
        initialSessions = [newSession];
    }
    setSessions(initialSessions);
    if (!currentSessionId && initialSessions.length > 0) {
        setCurrentSessionId(initialSessions[0].id);
    }
  }, []);

  useEffect(() => { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }, [config]);
  useEffect(() => { if(sessions.length > 0) localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); }, [sessions]);

  useEffect(() => {
    if (user?.unlocked_levels) {
      const levels = user.unlocked_levels.split(',');
      const highest = levels[levels.length - 1];
      setConfig((c) => ({ ...c, userLevel: highest }));
    }
  }, [user]);

  /* ======================
     8. Google 登录逻辑
  ====================== */
  useEffect(() => {
    if (isGoogleLoaded && window.google) {
        window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, 
            callback: handleGoogleCallback,
            auto_select: false
        });
    }
  }, [isGoogleLoaded]);

  const handleGoogleCallback = async (response) => {
    try {
        const res = await fetch('/api/verify-google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential }),
        });
        const data = await res.json();
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
        if (data.unlocked_levels) setIsActivated(true);
        syncQuota(data.email);
    } catch (e) {
        console.error("Google login failed", e);
    }
  };

  const login = () => {
      if (window.google) {
          window.google.accounts.id.prompt();
      } else {
          alert("Google 服务加载中...");
      }
  };

  const logout = () => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setIsActivated(false);
  };

  /* ======================
     9. 权限与 API 交互
  ====================== */
  const syncQuota = async (email) => {
    try {
        const res = await fetch('/api/can-use-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setRemainingQuota(data.remaining);
    } catch (e) {}
  };

  const canUseAI = async () => {
      if (isActivated) return true;
      if (!user || !user.email) return false;
      try {
          const res = await fetch('/api/can-use-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email })
          });
          const data = await res.json();
          if (data.remaining !== undefined) setRemainingQuota(data.remaining);
          return data.canUse;
      } catch (e) {
          return remainingQuota > 0;
      }
  };

  const recordUsage = async () => {
      if (isActivated) return;
      if (!user || !user.email) return;
      try {
          await fetch('/api/record-ai-usage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email })
          });
          setRemainingQuota(prev => Math.max(0, prev - 1));
      } catch (e) {}
  };

  const handleActivate = async (code) => {
    if (!user) return { success: false, error: '请先登录' };
    const check = validateActivationCode(code);
    if (!check.isValid) return check;
    try {
        const res = await fetch('/api/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, code }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error };
        const newUser = { ...user, unlocked_levels: data.new_unlocked_levels };
        setUser(newUser);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setIsActivated(true);
        return { success: true };
    } catch(e) {
        return { success: false, error: '网络错误' };
    }
  };

  /* ======================
     10. Prompt 动态生成逻辑 (核心修复)
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    
    // 基础变量替换
    template = template.replace(/{{LEVEL}}/g, config.userLevel || 'H1');
    
    if (aiMode === 'INTERACTIVE' && activeTask) {
        template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
        template = template.replace('{{QUESTION}}', activeTask.question || '');
        template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
        template = template.replace('{{CONTEXT}}', pageContext || '通用汉语语法');
    }
    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

  /* ======================
     11. 会话管理切换 (核心修复：解决重复语法问题)
  ====================== */
  
  // 切换 Session 的包装函数
  const selectSession = (sessionId) => {
      setCurrentSessionId(sessionId);
      const session = sessions.find(s => s.id === sessionId);
      // 如果切换到的会话标题不包含“解析”，或者是一个空对话，自动切回 CHAT 模式并清除任务
      if (session && !session.title.includes('解析')) {
          setAiMode('CHAT');
          setActiveTask(null);
      }
  };

  // 1. 触发互动题解析
  const triggerInteractiveAI = (payload) => {
    setAiMode('INTERACTIVE');
    
    // 创建解析专用 Session
    const newSessionId = Date.now();
    const newSession = { 
        id: newSessionId, 
        title: `解析: ${payload.grammarPoint || '新题目'}`, 
        messages: [], 
        date: new Date().toISOString(),
        isInteractive: true // 标记位
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);

    setActiveTask({
      ...payload,
      timestamp: Date.now() 
    });
    setIsAiOpen(true);
  };

  // 2. 静默更新 PPT 上下文
  const updatePageContext = (content) => {
    if (aiMode !== 'INTERACTIVE') {
        setPageContext(content);
    }
  };

  // 3. 重置模式 (当用户点击“新对话”或手动清空时调用)
  const resetToChatMode = () => {
      setAiMode('CHAT');
      setActiveTask(null);
      setPageContext('');
      const newSessionId = Date.now();
      const newSession = { id: newSessionId, title: '新对话', messages: [], date: new Date().toISOString() };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSessionId);
  };
  
  // 4. 兼容旧版触发器
  const triggerAI = (title, content) => {
      setAiMode('CHAT');
      setActiveTask(null); // 触发普通 AI 时必须清除之前的互动任务
      setPageContext(content);
      setIsAiOpen(true);
  };

  /* ======================
     12. Provider 导出
  ====================== */
  return (
    <AIContext.Provider value={{
        user, login, logout, isActivated, isGoogleLoaded, config, setConfig,
        sessions, setSessions, currentSessionId, setCurrentSessionId: selectSession, // 使用修复后的 selectSession
        bookmarks, setBookmarks, isAiOpen, setIsAiOpen,
        canUseAI, recordUsage, remainingQuota, TOTAL_FREE_QUOTA,
        handleActivate, handleGoogleCallback,
        activeTask, aiMode, systemPrompt: finalSystemPrompt,
        triggerInteractiveAI, updatePageContext, resetToChatMode, triggerAI
    }}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => setIsGoogleLoaded(true)}
      />
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
};
