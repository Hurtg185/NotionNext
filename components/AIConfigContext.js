import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数：激活码校验 (原样保留) ---
const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };
  const c = code.trim().toUpperCase();
  if (!c.includes('-JHM-')) return { isValid: false, error: '格式错误' };
  const parts = c.split('-');
  const VALID = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9', 'SP'];
  if (!VALID.includes(parts[0])) return { isValid: false, error: '等级不支持' };
  return { isValid: true, level: parts[0] };
};

export const AIProvider = ({ children }) => {
  /* ======================
     1. 用户 / 激活 / 谷歌状态 (原样保留)
  ====================== */
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  /* ======================
     2. AI 配置 (保留基础配置)
  ====================== */
  const [config, setConfig] = useState({
    apiKey: '',
    modelId: 'deepseek-v3.2',
    userLevel: 'H1',
    showPinyin: true, 
    autoSendStt: false, 
    ttsSpeed: 1,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    soundEnabled: true,
    // 注意：原本的 systemPrompt 字段现在由下方的 SYSTEM_PROMPTS 常量替代管理
    // 但为了兼容旧的 UI 设置页读取，这里保留字段，虽然实际生成 Prompt 不再完全依赖它
    systemPrompt: '' 
  });

  /* ======================
     3. AI UI / 会话 / 历史记录 (原样保留)
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ======================
     4. 配额管理 (原样保留)
  ====================== */
  const TOTAL_FREE_QUOTA = 60; 
  const [remainingQuota, setRemainingQuota] = useState(0);

  /* ======================
     5. 新增：模式与上下文管理 (核心修改)
  ====================== */
  // aiMode: 'CHAT' (普通/PPT模式) | 'INTERACTIVE' (互动题模式)
  const [aiMode, setAiMode] = useState('CHAT');
  
  // activeTask: 用于存储互动题的具体信息 { grammarPoint, question, userChoice, ... }
  const [activeTask, setActiveTask] = useState(null); 
  
  // pageContext: 用于存储当前 PPT/页面 的内容文本 (静默更新)
  const [pageContext, setPageContext] = useState('');

  /* ======================
     6. 提示词模板 (新增)
  ====================== */
  const SYSTEM_PROMPTS = {
    // 模式 A: 普通教学/PPT 翻页模式
    CHAT: `你是一位专门教【缅甸学生】学习汉语的老师。
【当前学生等级】{{LEVEL}}
【当前页面内容】{{CONTEXT}}

【语言强制规则】
- H1 / H2 (初学者)：解释必须以【缅文为主】，中文仅作为关键词或例句。不允许连续两句只有中文。
- H3 / H4 (进阶)：中文 + 缅文对照讲解。
- H5 及以上 (高级)：以中文讲解为主，难点辅以缅文。

【回答结构】
1. 用符合等级的语言解释。
2. 结合【当前页面内容】举例。
3. 结尾给出 3-5 个追问建议。

【追问格式（必须遵守）】
请在最后一行，严格以 "SUGGESTIONS: 建议1|||建议2|||..." 的格式输出。`,

    // 模式 B: 互动题错题补课模式
    INTERACTIVE: `你是一名“汉语语法互动助教 AI”。
【当前任务】学生做错题了，需要补课。
【学生等级】{{LEVEL}}

【错题信息】
- 语法点：{{GRAMMAR}}
- 题目：{{QUESTION}}
- 学生误选：{{USER_CHOICE}}

【工作流程（必须遵守）】
1. 先判断：学生为什么会选错？
2. 指出判断依据哪里出了问题。
3. 提醒当前语法点的关键判断线索。

【语言规则】
- 中文是唯一标准答案语言。
- 缅甸语只用于：解释中文为什么这样用、指出缅甸母语常见误区。
- 禁止直接给答案，要引导。

【追问生成】
- 结尾生成 3 个追问：用法确认 / 对比 / 错误预警。
- 使用 "SUGGESTIONS: Q1|||Q2|||Q3" 格式。`
  };

  /* ======================
     7. 初始化与本地存储 (完整代码)
  ====================== */
  useEffect(() => {
    // 加载用户
    const cachedUser = localStorage.getItem(USER_KEY);
    if (cachedUser) {
      try {
        const u = JSON.parse(cachedUser);
        setUser(u);
        if (u.unlocked_levels) setIsActivated(true);
      } catch (e) {}
    }

    // 加载配置
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try { setConfig((c) => ({ ...c, ...JSON.parse(savedConfig) })); } catch (e) {}
    }

    // 加载会话
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

  // 监听持久化
  useEffect(() => { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }, [config]);
  useEffect(() => { if(sessions.length > 0) localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); }, [sessions]);

  // 自动同步等级
  useEffect(() => {
    if (user?.unlocked_levels) {
      const levels = user.unlocked_levels.split(',');
      const highest = levels[levels.length - 1];
      setConfig((c) => ({ ...c, userLevel: highest }));
    }
  }, [user]);

  /* ======================
     8. Google 登录逻辑 (完整代码)
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
        alert("登录失败，请重试");
    }
  };

  const login = () => {
      if (window.google) {
          window.google.accounts.id.prompt();
      } else {
          alert("Google 服务正在加载中，请稍后...");
      }
  };

  const logout = () => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setIsActivated(false);
  };

  /* ======================
     9. 权限与 API 交互 (完整代码)
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
     10. Prompt 动态生成逻辑 (核心修改)
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let template = '';
    
    // 判断当前模式
    if (aiMode === 'INTERACTIVE' && activeTask) {
        // --- 互动题错题模式 ---
        template = SYSTEM_PROMPTS.INTERACTIVE;
        template = template.replace('{{LEVEL}}', config.userLevel || 'H1');
        template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
        template = template.replace('{{QUESTION}}', activeTask.question || '');
        template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
        // --- 默认 CHAT / PPT 模式 ---
        template = SYSTEM_PROMPTS.CHAT;
        template = template.replace('{{LEVEL}}', config.userLevel || 'H1');
        // 如果当前有 PPT 页面内容，就填入，否则填通用提示
        template = template.replace('{{CONTEXT}}', pageContext || '（当前未提供具体语法页面内容，请基于通用汉语语法知识回答）');
    }

    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

  /* ======================
     11. 触发器函数 (核心修改)
  ====================== */
  
  // 1. 触发互动题解析 (外部调用这个)
  const triggerInteractiveAI = (payload) => {
    setAiMode('INTERACTIVE');
    setActiveTask({
      ...payload,
      timestamp: Date.now() // 时间戳用于触发 useEffect
    });
    setIsAiOpen(true);
  };

  // 2. 静默更新 PPT 上下文 (GrammarPointPlayer 调用这个)
  const updatePageContext = (content) => {
    // 只有当不在做互动题时，才允许更新上下文并切回 CHAT 模式
    // 这样可以防止翻页打断了正在进行的互动题辅导
    if (aiMode !== 'INTERACTIVE') {
        setPageContext(content);
    }
  };

  // 3. 退出错题模式，强制回到普通聊天 (Dock 关闭时可调用)
  const resetToChatMode = () => {
      setAiMode('CHAT');
      setActiveTask(null);
  };
  
  // 4. 旧版 triggerAI 兼容 (保留以防其他组件报错)
  const triggerAI = (title, content) => {
      // 这里的行为映射到旧的“主动任务”逻辑，可视作一种特殊的 Chat 模式上下文注入
      setAiMode('CHAT');
      setActiveTask({ title, content, timestamp: Date.now() }); 
      setPageContext(content); // 顺便更新上下文
      setIsAiOpen(true);
  };

  /* ======================
     12. Provider 导出
  ====================== */
  const value = {
    // 基础数据
    user,
    login,
    logout,
    isActivated,
    isGoogleLoaded,
    config,
    setConfig,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    bookmarks,
    setBookmarks,
    isAiOpen,
    setIsAiOpen,
    
    // 权限相关
    canUseAI,
    recordUsage,
    remainingQuota,
    TOTAL_FREE_QUOTA,
    handleActivate,
    handleGoogleCallback,
    
    // 新增的核心 AI 逻辑导出
    activeTask,           // 给 Dock 监听变化
    aiMode,               // 给 UI 判断当前是 PPT 还是 互动题
    systemPrompt: finalSystemPrompt, // 统一计算好的 Prompt
    
    triggerInteractiveAI, // 互动题专用触发器
    updatePageContext,    // PPT 翻页静默更新
    resetToChatMode,      // 重置为普通模式
    triggerAI             // 兼容旧版触发器
  };

  return (
    <AIContext.Provider value={value}>
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
  if (!ctx) throw new Error('useAI 必须在 Provider 内');
  return ctx;
};
