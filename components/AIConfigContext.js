import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

/* ======================
   激活码校验（不动）
====================== */
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
     用户 / 激活
  ====================== */
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  /* ======================
     AI 配置
  ====================== */
  const [config, setConfig] = useState({
    apiKey: '',
    modelId: 'deepseek-ai/deepseek-v3.2',
    userLevel: 'H1',
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
     AI UI / 上下文
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  /* ======================
     聊天 / 收藏
  ====================== */
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ======================
     免费次数（仅展示）
  ====================== */
  const [remainingQuota, setRemainingQuota] = useState(0);
  const [totalQuota, setTotalQuota] = useState(0);

  /* ======================
     初始化
  ====================== */
  useEffect(() => {
    const cachedUser = localStorage.getItem(USER_KEY);
    if (cachedUser) {
      const u = JSON.parse(cachedUser);
      setUser(u);
      if (u.unlocked_levels) setIsActivated(true);
    }

    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      setConfig((c) => ({ ...c, ...JSON.parse(savedConfig) }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  /* ======================
     等级自动同步（修复点）
  ====================== */
  useEffect(() => {
    if (user?.unlocked_levels) {
      const levels = user.unlocked_levels.split(',');
      const highest = levels[levels.length - 1];
      setConfig((c) => ({ ...c, userLevel: highest }));
    }
  }, [user]);

  /* ======================
     Prompt 注入（核心修复）
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let p = config.systemPrompt;
    p = p.replace('{{LEVEL}}', config.userLevel || 'H1');
    p = p.replace(
      '{{CONTEXT}}',
      activeTask?.content
        ? activeTask.content
        : '（当前未提供具体语法页面内容）'
    );
    return p;
  }, [config.systemPrompt, config.userLevel, activeTask]);

  /* ======================
     Google 登录
  ====================== */
  const handleGoogleCallback = async (response) => {
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
  };

  const syncQuota = async (email) => {
    const res = await fetch('/api/can-use-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setRemainingQuota(data.remaining);
    setTotalQuota(data.total);
  };

  /* ======================
     激活
  ====================== */
  const handleActivate = async (code) => {
    const check = validateActivationCode(code);
    if (!check.isValid) return check;
    const res = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, code }),
    });
    const data = await res.json();
    const newUser = { ...user, unlocked_levels: data.new_unlocked_levels };
    setUser(newUser);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setIsActivated(true);
    return { success: true };
  };

  /* ======================
     AI 入口（修复点）
  ====================== */
  const triggerAI = (title, content) => {
    setActiveTask({
      title,
      content,
      at: Date.now(),
    });
    setIsAiOpen(true);
  };

  const value = {
    user,
    isActivated,
    config,
    setConfig,
    isAiOpen,
    setIsAiOpen,
    triggerAI,
    activeTask,
    systemPrompt: finalSystemPrompt, // 🔥 AI 真正用的 Prompt
    remainingQuota,
    totalQuota,
    handleGoogleCallback,
    handleActivate,
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
