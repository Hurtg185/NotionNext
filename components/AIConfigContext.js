import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数：激活码校验 (修复：统一匹配逻辑) ---
const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };
  const c = code.trim().toUpperCase();
  if (!c.includes('-JHM-')) return { isValid: false, error: '格式错误' };
  
  const parts = c.split('-');
  // 支持旧版 H1 和新版 HSK1 写法，统一映射逻辑后续处理
  const VALID = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9', 'SP', 'HSK1', 'HSK2', 'HSK3'];
  
  // 简单归一化检查
  const levelPart = parts[0].replace('HSK', 'H'); // 统一暂存为 H1, H2 格式方便校验
  if (!VALID.some(v => v.replace('HSK', 'H') === levelPart)) {
      return { isValid: false, error: '等级不支持' };
  }
  
  return { isValid: true, level: parts[0] };
};

export const AIProvider = ({ children }) => {
  /* ======================
     1. 用户 / 激活 / 状态
  ====================== */
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  /* ======================
     2. AI 配置 (默认等级统一为 "HSK 1")
  ====================== */
  const [config, setConfig] = useState({
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1', 
    modelId: 'deepseek-ai/deepseek-v3.2',
    userLevel: 'HSK 1', 
    showPinyin: true, 
    autoSendStt: false, 
    ttsSpeed: 1,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    sttLang: 'zh-CN',
    soundEnabled: true
  });

  /* ======================
     3. 会话与 UI 状态
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [remainingQuota, setRemainingQuota] = useState(0);
  const TOTAL_FREE_QUOTA = 60; 

  /* ======================
     4. 核心模式与任务上下文
  ====================== */
  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null); 
  const [pageContext, setPageContext] = useState('');

  /* ======================
     5. System Prompt (核心修复：SP修正 + 灵活性指令)
  ====================== */
  const SYSTEM_PROMPTS = {
    CHAT: `你是一位专业且博学的汉语老师，专门教【缅甸学生】学习汉语。
【当前教学等级】：{{LEVEL}}
【注意】：如果等级显示 SP，表示“口语专项/专业口语 (Speaking Practice)”，绝对禁止将其解释为 "Sponsored Program" 或其他商业含义。

【最高指令：优先级与详尽度】
1.【当前教学等级】：{{LEVEL}}
2.【当前参考内容】：{{CONTEXT}}
【语言强制执行规则】
- HSK 1 / HSK 2：必须以【缅甸语为主】讲解逻辑，中文仅作为关键词或例句。
- HSK 3 / HSK 4：采取“中文+缅甸语”对照讲解。
- HSK 5 以上 / SP：中文讲解为主，难点辅以缅甸语。

【回答结构】
1. 一秒直达 ：用一个缅甸语中最接近的词或语法结构来类比。
- 格式：这个语法点就像缅甸语里的 [XXX]。
 2. 功能对比 ：一句话说明该语法在中文里的作用，并点出它与缅语（SOV语序）最大的不同（例如：缅语靠助词，中文靠语序）。
 3. 核心法则 ：**公式**：[使用简单符号表示，如：主语 + 把 + 宾语 + 动词 + 结果]
**口诀**：[一句简单、押韵或好记的中文顺口溜]
**绝对禁忌**：[列出一个缅甸学习者绝对不能犯的原则性错误]
 4. 三步拆解 (Step-by-Step)
- ① **基础句型**：最简单的标准例句。
- ② **常用变式**：对应的否定句或疑问句。
- ③ **缅语者易错点**：由于缅语思维导致的错句 (❌) -> 正确句子 (✅) -> 简述原因。

 5. 生活实战 (Scenarios)
围绕一个生活场景（如：职场、购物、仰光生活），给出三个中缅对照句。
- 要求：中文句子必须包含拼音，并用 "-> <-" 标出语法核心。
6. 追问建议 (格式：SUGGESTIONS: 建议1|||建议2|||建议3)`,

    INTERACTIVE: `你是一名汉语语法私教。当前处于【错题专项深度解析】模式。
【当前等级】：{{LEVEL}}
【题目 ID】：{{TASK_ID}}

【背景信息】
- 语法点：{{GRAMMAR}}
- 题目：{{QUESTION}}
- 学生误选：{{USER_CHOICE}}

【核心工作逻辑】
1. **补课模式**：针对学生的错选 {{USER_CHOICE}}，用缅甸语深度拆解思维漏洞，并举出生活中的尴尬场景来对比正确用法。严禁直接给答案。
2. **智能切换（重要）**：如果学生在对话中问了**与本题无关**的内容（例如：“那个词是什么意思？”、“你好”），请**立即停止**错题解析模式，切换回普通老师身份回答学生的问题。不要强行把新问题和错题扯上关系。

SUGGESTIONS: Q1|||Q2|||Q3`
  };

  /* ======================
     6. 初始化与本地存储
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
      let highest = levels[levels.length - 1];
      // 简单标准化：确保 config 里存的是 "HSK 1" 这种格式
      if (highest.startsWith('H') && !highest.startsWith('HSK')) {
          highest = highest.replace('H', 'HSK ');
      }
      setConfig((c) => ({ ...c, userLevel: highest }));
    }
  }, [user]);

  /* ======================
     7. Google 登录 (保留)
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
        console.error("Login failed", e);
    }
  };

  const login = () => window.google?.accounts.id.prompt();
  const logout = () => { localStorage.removeItem(USER_KEY); setUser(null); setIsActivated(false); };

  /* ======================
     8. 权限与 API 交互
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
      if (!user) return false;
      return true; // 简化前端判断，主要由后端控制
  };

  const recordUsage = async () => {
      if (isActivated) return;
      if (!user) return;
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
    } catch(e) { return { success: false, error: '网络错误' }; }
  };

  /* ======================
     9. Prompt 动态生成逻辑 (核心修复：等级判定优先级)
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    
    // 优先级逻辑：
    // 1. 如果 activeTask ID 包含 "hsk1" -> HSK 1
    // 2. 如果 activeTask ID 包含 "sp" -> 口语专项
    // 3. 否则使用用户配置的 userLevel
    
    let displayLevel = config.userLevel || 'HSK 1';
    const taskId = activeTask?.id || "";
    const lowerId = taskId.toLowerCase();
    
    if (lowerId.includes('hsk1')) displayLevel = 'HSK 1';
    else if (lowerId.includes('hsk2')) displayLevel = 'HSK 2';
    else if (lowerId.includes('hsk3')) displayLevel = 'HSK 3';
    else if (lowerId.includes('sp')) displayLevel = '口语专项 (Spoken Chinese)';
    
    // 二次保险：防止 userLevel 本身是 "SP" 时被误读
    if (displayLevel === 'SP' || displayLevel === 'sp') {
        displayLevel = '口语专项 (Spoken Chinese)';
    }

    template = template.replace(/{{LEVEL}}/g, displayLevel);
    
    if (aiMode === 'INTERACTIVE' && activeTask) {
        template = template.replace('{{TASK_ID}}', taskId || '未知');
        template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
        template = template.replace('{{QUESTION}}', activeTask.question || '');
        template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
        template = template.replace('{{CONTEXT}}', pageContext ? pageContext.substring(0, 500) : '通用对话');
    }
    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

  /* ======================
     10. 会话切换逻辑 (核心修复：切换会话时清除旧任务)
  ====================== */
  const selectSession = (sessionId) => {
      setCurrentSessionId(sessionId);
      const session = sessions.find(s => s.id === sessionId);
      
      // 如果切换到的会话不是“解析”类会话，或者是空对话，
      // 必须立刻清除 activeTask，否则 AI 还会以为你在做上一道题。
      if (session && !session.title.includes('解析')) {
          setAiMode('CHAT');
          setActiveTask(null);
      } else if (session && session.title.includes('解析')) {
          // 如果切回解析会话，恢复模式（可选，保持逻辑闭环）
          setAiMode('INTERACTIVE');
      }
  };

  /* ======================
     11. 触发器函数
  ====================== */
  
  // 1. 触发互动题解析
  const triggerInteractiveAI = (payload) => {
    setAiMode('INTERACTIVE');
    const newSessionId = Date.now();
    const newSession = { 
        id: newSessionId, 
        title: `解析: ${payload.grammarPoint || '错题'}`, 
        messages: [], 
        date: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    
    // 增加 timestamp 确保 useEffect 能监听到变化
    setActiveTask({ ...payload, timestamp: Date.now() });
    setIsAiOpen(true);
  };

  // 2. 触发课件内容讲解 (支持传入 id 进行等级锁定)
  const triggerAI = (title, content, id = null) => {
      setAiMode('CHAT');
      // 即使是普通讲解，也设置 activeTask，以便 Prompt 能获取 ID 判断等级
      // 同时这会触发 AIChatDock 的自动讲解 useEffect
      setActiveTask({ title, content, id, timestamp: Date.now() }); 
      setPageContext(`课件标题: ${title}\n内容: ${content}`);
      setIsAiOpen(true);
      
      // 如果当前是新会话列表，或者想每次都新开一个
      if (!currentSessionId) {
          const newId = Date.now();
          setSessions(prev => [{ id: newId, title: title || '新对话', messages: [], date: new Date().toISOString() }, ...prev]);
          setCurrentSessionId(newId);
      }
  };

  const updatePageContext = (content) => {
    if (aiMode !== 'INTERACTIVE') setPageContext(content);
  };

  const resetToChatMode = () => {
      setAiMode('CHAT');
      setActiveTask(null);
      setPageContext('');
      // 可选：是否要新建一个空白会话？
      const newId = Date.now();
      setSessions(prev => [{ id: newId, title: '新对话', messages: [], date: new Date().toISOString() }, ...prev]);
      setCurrentSessionId(newId);
  };

  return (
    <AIContext.Provider value={{
        user, login, logout, isActivated, isGoogleLoaded, config, setConfig,
        sessions, setSessions, currentSessionId, setCurrentSessionId: selectSession,
        isAiOpen, setIsAiOpen,
        canUseAI, remainingQuota, TOTAL_FREE_QUOTA,
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

export const useAI = () => useContext(AIContext);
