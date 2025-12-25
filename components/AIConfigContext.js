import React, { createContext, useState, useContext, useEffect } from 'react';
import Script from 'next/script';

// 定义用于 localStorage 的统一键名
const CONFIG_KEY = 'ai_global_config_v13';
const SESSIONS_KEY = 'ai_global_sessions_v13';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v13';
const USER_KEY = 'hsk_user'; 
const FREE_QUOTA_KEY = 'ai_free_quota_total_v13';

// 1. 创建 Context
const AIContext = createContext();

// 辅助函数：激活码格式验证
const validateActivationCode = (code) => {
    if (!code) return { isValid: false, error: "请输入激活码" };
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode.includes('-JHM-')) return { isValid: false, error: "格式错误 (缺少标识)" };
    const parts = trimmedCode.split('-');
    if (parts.length < 3) return { isValid: false, error: "激活码不完整" };
    const VALID_LEVELS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9', 'SP'];
    if (!VALID_LEVELS.includes(parts[0])) return { isValid: false, error: `不支持的等级: ${parts[0]}` };
    return { isValid: true, level: parts[0] };
};

// 2. 创建 Provider 组件
export const AIProvider = ({ children }) => {
  // --- 状态管理 ---
  
  // 用户登录与激活状态
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  
  // AI 相关配置 (包含核心 Prompt 修改)
  const [config, setConfig] = useState({
    apiKey: '',
    modelId: 'deepseek-ai/deepseek-v3.2',
    userLevel: 'H1', // 默认等级
    // 🔥 核心修改：针对气泡优化的 Prompt
    systemPrompt: `你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。

【排版要求】
1. 使用 Notion 风格排版，重点清晰。
2. 列表请使用多级结构 (▪️/◦)。
3. 重点词汇请加粗(**)。
4. 涉及表格时请使用 Markdown 表格。

【交互要求 - 关键】
在回答的最后，请严格按照以下格式给出 10 个建议追问的问题。
不要写“[建议]”字样，直接用 "|||" 分隔每个问题，不要换行，不要带序号。
格式示例：
问题1内容|||问题2内容|||问题3内容...

【内容要求】
根据学生的汉语等级（当前：{{LEVEL}}），调整你的用词难度。`,
    ttsSpeed: 1.0,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    showPinyin: true,
    autoSendStt: false,
    soundEnabled: true
  });

  // AI UI 状态
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  // 聊天历史、收藏夹
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // 免费次数 (UI 显示用)
  const TOTAL_FREE_QUOTA = 100; // 后端设定的总数，这里主要用于前端进度条显示
  const [remainingQuota, setRemainingQuota] = useState(TOTAL_FREE_QUOTA);

  // --- 初始化与数据持久化 ---
  useEffect(() => {
    // 加载用户
    const cachedUser = localStorage.getItem(USER_KEY);
    if (cachedUser) {
        try {
            const parsedUser = JSON.parse(cachedUser);
            setUser(parsedUser);
            if (parsedUser.unlocked_levels && parsedUser.unlocked_levels.length > 0) {
                setIsActivated(true);
            }
        } catch (e) {
            localStorage.removeItem(USER_KEY);
        }
    }
    
    // 加载配置
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try { setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) })); } catch (e) {}
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
    if (!currentSessionId) {
        setCurrentSessionId(initialSessions[0].id);
    }
    
    // 加载收藏夹
    const savedBookmarks = localStorage.getItem(BOOKMARKS_KEY);
    if (savedBookmarks) {
      try { setBookmarks(JSON.parse(savedBookmarks)); } catch(e) {}
    }

  }, []);

  // 当状态改变时，自动保存
  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);
  
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  // --- 核心动作函数 ---

  const handleGoogleCallback = async (response) => {
    try {
      const res = await fetch('/api/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential }),
      });
      if (!res.ok) throw new Error('谷歌登录验证失败');
      
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      // 登录后立刻同步一次后端次数
      if (userData.email) {
          syncQuota(userData.email);
      }

      if (userData.unlocked_levels && userData.unlocked_levels.length > 0) {
        setIsActivated(true);
      }
      return { success: true, user: userData };
    } catch (err) {
      console.error(err);
      return { success: false, error: '登录失败，请刷新重试' };
    }
  };

  // 辅助：从后端同步剩余次数
  const syncQuota = async (email) => {
      try {
          const res = await fetch('/api/can-use-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.remaining !== undefined) {
              setRemainingQuota(data.remaining);
          }
      } catch (e) {
          console.error("Failed to sync quota");
      }
  };

  const handleActivate = async (code) => {
    if (!user) return { success: false, error: '请先登录' };
    
    const validation = validateActivationCode(code);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    if (user.unlocked_levels && user.unlocked_levels.split(',').includes(validation.level)) {
      return { success: false, error: `您已经解锁了 ${validation.level}` };
    }
    
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      } else {
        const updatedUser = { ...user, unlocked_levels: data.new_unlocked_levels };
        setUser(updatedUser);
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        setIsActivated(true);
        return { success: true, message: `成功解锁 ${data.level}！` };
      }
    } catch (e) {
      return { success: false, error: '网络错误，请稍后重试' };
    }
  };

  const logout = () => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setIsActivated(false);
  };
  
  const triggerAI = (title, content) => {
    setActiveTask({ title, content, timestamp: Date.now() }); 
    setIsAiOpen(true);
  };

  // 🔥 核心修改：改为异步 Async，调用后端校验
  const canUseAI = async () => {
    // 1. 如果已激活，直接无限用
    if (isActivated) return true;
    
    // 2. 如果没登录，暂时不允许（或者你可以允许几次本地，看你策略，这里按严格走）
    if (!user || !user.email) return false;

    try {
        const res = await fetch('/api/can-use-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        const data = await res.json();
        
        // 同步 UI
        if (data.remaining !== undefined) {
            setRemainingQuota(data.remaining);
        }
        
        return data.canUse;
    } catch (e) {
        console.error("Check quota failed", e);
        // 网络错误时，如果本地还有次数，可以暂且允许，或者严格禁止
        return remainingQuota > 0;
    }
  };

  // 🔥 核心修改：改为异步 Async，调用后端扣费
  const recordUsage = async () => {
    if (isActivated) return;
    if (!user || !user.email) return;

    try {
        await fetch('/api/record-ai-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        // 扣除本地显示
        setRemainingQuota(prev => Math.max(0, prev - 1));
    } catch (e) {
        console.error("Record usage failed");
    }
  };

  const value = {
    user,
    isActivated,
    isGoogleLoaded,
    handleGoogleCallback,
    handleActivate,
    logout,
    config,
    setConfig,
    isAiOpen,
    setIsAiOpen,
    activeTask,
    triggerAI,
    canUseAI,
    recordUsage,
    remainingQuota,
    TOTAL_FREE_QUOTA,
    sessions,
    setSessions,
    bookmarks,
    setBookmarks,
    currentSessionId,
    setCurrentSessionId,
  };

  return (
    <AIContext.Provider value={value}>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onLoad={() => setIsGoogleLoaded(true)} />
      {children}
    </AIContext.Provider>
  );
};

// 3. 创建一个自定义 Hook
export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI 必须在 AIProvider 内部使用');
  }
  return context;
};
