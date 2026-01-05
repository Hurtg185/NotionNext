import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数：激活码校验 (统一命名规范) ---
const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };
  const c = code.trim().toUpperCase();
  if (!c.includes('-JHM-')) return { isValid: false, error: '格式错误' };
  const parts = c.split('-');
  const VALID = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSK 7-9', 'SP'];
  if (!VALID.includes(parts[0])) return { isValid: false, error: '等级不支持' };
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
     2. AI 配置 (默认等级设为 HSK 1)
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
    soundEnabled: true,
    systemPrompt: '' 
  });

  /* ======================
     3. AI UI / 会话 / 模式
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [remainingQuota, setRemainingQuota] = useState(0);
  const TOTAL_FREE_QUOTA = 60; 

  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null); 
  const [pageContext, setPageContext] = useState('');

  /* ======================
     4. 提示词模板 (终极进化版)
  ====================== */
  const SYSTEM_PROMPTS = {
    CHAT: `你是一位专业且博学的汉语老师，专门教【缅甸学生】学习汉语。
【当前教学等级】：{{LEVEL}}

【最高指令：优先级与详尽度】
1.用最简单的逻辑解释这个语法点在中文里是干什么的和句型结构。
2.这个语法在【缅甸语】里对应的表达方式是什么？（找出异同，防止硬套）。
3.拆解句子成分并说明固定搭配、常用词和可能的变化
4.例句对比,结合当前等级给出3-5个中缅对照例句。
5.易错点.
6.使用场景.
1. **即时性**：你必须首先、直接、详细地回答用户最后提出的问题。
2. **禁止简洁**：你的回复必须详尽。禁止只给出一两句话的简短回答。每个语法点必须配合缅甸语深度逻辑分析，并提供至少 3 个实用的中缅双语例句。
3. **数据关联**：如果用户的问题与当前课件内容 {{CONTEXT}} 相关，请结合课件讲解；如果是课外问题，请直接发挥你的知识储备。

【语言强制执行规则】
- HSK 1 / HSK 2：必须以【缅甸语为主】讲解逻辑，中文仅作为关键词或例句。
- HSK 3 / HSK 4：采取“中文+缅甸语”对照讲解。
- HSK 5 以上 / SP：中文讲解为主，难点辅以缅甸语。

【回答结构】
1. 详细的缅语解析/回答。
2. 实用例句 (中文+拼音+缅文)。
3. 追问建议 (格式：SUGGESTIONS: 建议1|||建议2|||建议3)`,

    INTERACTIVE: `你是一名汉语语法私教。当前处于【错题专项深度解析】模式。
【当前等级】：{{LEVEL}}
【题目 ID】：{{TASK_ID}}

【背景信息】
- 语法点：{{GRAMMAR}}
- 题目：{{QUESTION}}
- 学生误选：{{USER_CHOICE}}

【核心解析逻辑】
1. **不给答案**：严禁直接说出正确选项。
2. **心理分析**：先用缅甸语分析为什么学生会产生错觉选了 {{USER_CHOICE}}。
3. **生活化对比**：举一个缅甸生活中的尴尬场景，对比正确与错误的逻辑差异。
4. **记忆窍门**：给出一个一句话的缅语记忆口诀。
5. **自由扩展**：如果学生明白后问了其他问题，请立即切换回老师身份自由回答。

SUGGESTIONS: Q1|||Q2|||Q3`
  };

  /* ======================
     5. 初始化与数据加载
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
      // 这里的等级将作为保底等级
      setConfig((c) => ({ ...c, userLevel: highest.replace('Hsk', 'HSK ') }));
    }
  }, [user]);

  /* ======================
     6. 核心逻辑：智能等级判断 (教材 > 激活码)
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    
    // 优先级 1: 如果 activeTask 中带有教材 ID (如 hsk1_01)，提取等级
    let displayLevel = config.userLevel || 'HSK 1';
    const taskId = activeTask?.id || "";
    
    if (taskId.toLowerCase().includes('hsk1')) displayLevel = 'HSK 1';
    else if (taskId.toLowerCase().includes('hsk2')) displayLevel = 'HSK 2';
    else if (taskId.toLowerCase().includes('hsk3')) displayLevel = 'HSK 3';
    else if (taskId.toLowerCase().includes('sp')) displayLevel = '口语专项 (Spoken Chinese)';
    else if (displayLevel.toUpperCase() === 'SP') displayLevel = '口语专项 (Spoken Chinese)';

    template = template.replace(/{{LEVEL}}/g, displayLevel);
    
    if (aiMode === 'INTERACTIVE' && activeTask) {
        template = template.replace('{{TASK_ID}}', activeTask.id || '未知课程');
        template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
        template = template.replace('{{QUESTION}}', activeTask.question || '');
        template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
        template = template.replace('{{CONTEXT}}', pageContext ? pageContext.substring(0, 300) : '通用对话');
    }
    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

  /* ======================
     7. 触发器函数 (增强版)
  ====================== */
  
  // 1. 触发互动题解析 (传入 payload 需包含 id: "hsk1_xx")
  const triggerInteractiveAI = (payload) => {
    setAiMode('INTERACTIVE');
    const newSessionId = Date.now();
    const newSession = { 
        id: newSessionId, 
        title: `解析: ${payload.grammarPoint || '语法点'}`, 
        messages: [], 
        date: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setActiveTask({ ...payload, timestamp: Date.now() });
    setIsAiOpen(true);
  };

  // 2. 触发课件内容讲解 (增加 id 参数：如 "hsk1_01")
  const triggerAI = (title, content, id = null) => {
      setAiMode('CHAT');
      setActiveTask({ title, content, id, timestamp: Date.now() }); 
      setPageContext(`课件标题: ${title}, 详细内容: ${content}`);
      setIsAiOpen(true);
  };

  const selectSession = (sessionId) => {
      setCurrentSessionId(sessionId);
      const session = sessions.find(s => s.id === sessionId);
      if (session && !session.title.includes('解析')) {
          setAiMode('CHAT');
          setActiveTask(null);
      }
  };

  const updatePageContext = (content) => {
    if (aiMode !== 'INTERACTIVE') setPageContext(content);
  };

  const resetToChatMode = () => {
      setAiMode('CHAT');
      setActiveTask(null);
      setPageContext('');
  };

  /* ======================
     8. Google 登录与权限 (保留)
  ====================== */
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
    } catch (e) { console.error("Login failed", e); }
  };

  const canUseAI = async () => {
      if (isActivated) return true;
      if (!user) return false;
      try {
          const res = await fetch('/api/can-use-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email })
          });
          const data = await res.json();
          setRemainingQuota(data.remaining);
          return data.canUse;
      } catch (e) { return remainingQuota > 0; }
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

  return (
    <AIContext.Provider value={{
        user, login: () => window.google?.accounts.id.prompt(), 
        logout: () => { localStorage.removeItem(USER_KEY); setUser(null); setIsActivated(false); },
        isActivated, config, setConfig,
        sessions, setSessions, currentSessionId, setCurrentSessionId: selectSession,
        bookmarks, setBookmarks, isAiOpen, setIsAiOpen,
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
