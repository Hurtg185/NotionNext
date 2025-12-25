import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数：激活码校验 ---
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
     1. 用户 / 激活 / 谷歌状态
  ====================== */
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false); // 状态已定义

  /* ======================
     2. AI 配置 (核心 Prompt 修正版)
  ====================== */
  const [config, setConfig] = useState({
    apiKey: '',
    modelId: 'deepseek-ai/deepseek-v3.2',
    userLevel: 'H1',
    showPinyin: true, // UI组件需要此字段
    autoSendStt: false, // UI组件需要此字段
    systemPrompt: `
你是一位专门教【缅甸学生】学习汉语的老师。

【当前学生等级】
{{LEVEL}}

【当前语法内容】
{{CONTEXT}}

【语言强制规则】
- H1 / H2：
  - 解释必须以【缅文为主】
  - 中文只能作为关键词或例句
  - 不允许连续两句只有中文

- H3 / H4：
  - 中文 + 缅文对照

- H5 及以上：
  - 中文为主，必要时补缅文

【回答结构】
1. 用符合等级的语言解释语法
2. 结合【当前语法内容】举例
3. 结尾给出 5–7 个【只能基于当前语法内容】的追问

【追问格式（必须遵守）】
- 只输出问题
- 用 "|||" 分隔
- 不要编号、不换行
`,
    ttsSpeed: 1,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    soundEnabled: true,
  });

  /* ======================
     3. AI UI / 上下文 / 历史记录
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ======================
     4. 配额管理
  ====================== */
  const TOTAL_FREE_QUOTA = 60; // 与 UI 文案保持一致
  const [remainingQuota, setRemainingQuota] = useState(0);

  /* ======================
     5. 初始化与本地存储
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
     6. Prompt 动态注入 (核心逻辑)
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let p = config.systemPrompt;
    p = p.replace('{{LEVEL}}', config.userLevel || 'H1');
    p = p.replace(
      '{{CONTEXT}}',
      activeTask?.content
        ? activeTask.content
        : '（当前未提供具体语法页面内容，请基于通用语法知识回答）'
    );
    return p;
  }, [config.systemPrompt, config.userLevel, activeTask]);

  /* ======================
     7. Google 登录逻辑 (修复版)
  ====================== */
  
  // 初始化 Google SDK
  useEffect(() => {
    if (isGoogleLoaded && window.google) {
        window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, // 确保环境变量存在
            callback: handleGoogleCallback,
            auto_select: false
        });
        // 这里不自动 render Button，由 UI 组件（侧边栏）自己渲染
    }
  }, [isGoogleLoaded]);

  // 回调处理
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

  // 手动触发登录 (弹窗模式)
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

  // 检查是否可用 (UI 组件调用)
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

  // 记录使用 (UI 组件调用)
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

  // 激活课程
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
     9. AI 入口
  ====================== */
  const triggerAI = (title, content) => {
    setActiveTask({
      title,
      content,
      timestamp: Date.now(), // 时间戳用于触发 useEffect
    });
    setIsAiOpen(true);
  };

  /* ======================
     10. Provider 值 (这里加回了 isGoogleLoaded)
  ====================== */
  const value = {
    user,
    login,
    logout,
    isActivated,
    isGoogleLoaded, // 🔥 修复关键：加回这个，侧边栏按钮就会出来了！
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
    activeTask,
    triggerAI,
    systemPrompt: finalSystemPrompt,
    canUseAI,
    recordUsage,
    remainingQuota,
    TOTAL_FREE_QUOTA,
    handleActivate,
    handleGoogleCallback
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
