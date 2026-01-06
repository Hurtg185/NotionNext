import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
// 升级版本号 v15，确保浏览器清除旧的 Prompt 缓存
const CONFIG_KEY = 'ai_global_config_v15';
const SESSIONS_KEY = 'ai_global_sessions_v15';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数 (无变动) ---
const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };
  const c = code.trim().toUpperCase();
  if (!c.includes('-JHM-')) return { isValid: false, error: '格式错误' };

  const parts = c.split('-');
  const VALID = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9', 'SP', 'HSK1', 'HSK2', 'HSK3'];

  // 兼容逻辑：通常 parts[2] 是等级，处理 HSK 前缀
  let levelPart = parts[2];
  if (levelPart && levelPart.startsWith('HSK')) {
      levelPart = levelPart.replace('HSK', 'H');
  }

  if (!VALID.some(v => v.replace('HSK', 'H') === levelPart)) {
    return { isValid: false, error: '等级不支持' };
  }

  return { isValid: true, level: parts };
};

// 新增一个辅助 Hook，用于追踪上一次的状态
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export const AIProvider = ({ children }) => {
  // --- State 定义 ---
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  const [config, setConfig] = useState(() => {
    try {
      const savedConfig = localStorage.getItem(CONFIG_KEY);
      const initialConfig = {
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
      };
      return savedConfig ? { ...initialConfig, ...JSON.parse(savedConfig) } : initialConfig;
    } catch (e) {
      return {};
    }
  });

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState(() => {
    try {
      const savedSessions = localStorage.getItem(SESSIONS_KEY);
      const initialSessions = savedSessions ? JSON.parse(savedSessions) : [];
      if (initialSessions.length === 0) {
        return [{ id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() }];
      }
      return initialSessions;
    } catch (e) {
      return [{ id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() }];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [remainingQuota, setRemainingQuota] = useState(0);
  const TOTAL_FREE_QUOTA = 60;

  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null);
  const [pageContext, setPageContext] = useState(null);

  // --- System Prompts (核心修改：引入严格的分支逻辑) ---
  const SYSTEM_PROMPTS = {
    CHAT: `你是一位专业且博学的汉语老师，你的唯一使命是教【缅甸学生】学习汉语。记住，你的学生是缅甸人，语言习惯和思维方式都与中文不同。

【当前教学等级】：{{LEVEL}}

【最高指令：逻辑分支判断】
请先检查用户提供的【当前参考内容】中是否包含标签：【参考讲解脚本】。

👉 分支 A：如果包含【参考讲解脚本】（Script Mode）
1. **绝对执行权**：脚本的内容是最高真理。请立刻放弃所有通用的教学模板（如三步拆解、一秒直达等）。
2. **复述与演绎**：请直接化身为脚本中的老师，用生动的语气，**完整地**讲出脚本中的内容。
   - 严禁对脚本进行“总结”或“缩写”。
   - 必须保留脚本中所有的缅甸语解释（这是最重要的）。
   - 必须保留脚本中的例句和场景描述。
3. **格式优化**：你可以增加 emoji (💡, ✅, ❌) 或分段让阅读更舒服，但**不要改变脚本的文字逻辑**。
4. **禁止事项**：不要自己发明新的例句，除非脚本里没有。不要在脚本讲完之前插入无关的总结。

👉 分支 B：如果不包含脚本（General Mode）
(只有在没有脚本时，才执行以下规则)

1. **回答结构**：
   - 一秒直达：用缅甸语类比 (这个语法点就像缅甸语里的...)
   - 核心法则：给出公式或口诀。
   - 三步拆解：
     ① 基础句型
     ② 常用变式
     ③ 缅语者易错点 (❌ -> ✅)
   - 生活实战：给出3个中缅对照例句。

2. **语言规则**：
   - HSK 1-2：缅甸语讲解为主，中文为辅。
   - HSK 3-4：中缅对照。
   - HSK 5+：中文为主。

【当前参考内容】：
{{CONTEXT}}`,

    INTERACTIVE: `你是一名汉语语法私教。当前处于【错题专项深度解析】模式。
【当前等级】：{{LEVEL}}
【题目 ID】：{{TASK_ID}}

【背景信息】
语法点：{{GRAMMAR}}
题目：{{QUESTION}}
学生误选：{{USER_CHOICE}}

【核心工作逻辑】
补课模式：针对学生的错选 {{USER_CHOICE}}，用缅甸语深度拆解思维漏洞，并举出生活中的尴尬场景来对比正确用法。严禁直接给答案。
智能切换（重要）：如果学生在对话中问了与本题无关的内容（例如：“那个词是什么意思？”、“你好”），请立即停止错题解析模式，切换回普通老师身份回答学生的问题。不要强行把新问题和错题扯上关系。

SUGGESTIONS: Q1|||Q2|||Q3`
  };

  // --- 初始化与本地存储 (无变动) ---
  useEffect(() => {
    try {
      const cachedUser = localStorage.getItem(USER_KEY);
      if (cachedUser) {
        const u = JSON.parse(cachedUser);
        setUser(u);
        if (u.unlocked_levels) {
          setIsActivated(true);
          const levels = u.unlocked_levels.split(',');
          let highest = levels[levels.length - 1];
          if (highest.startsWith('H') && !highest.startsWith('HSK')) {
            highest = highest.replace('H', 'HSK ');
          }
          setConfig(c => ({ ...c, userLevel: highest }));
        }
      }
    } catch (e) { console.error("Failed to parse user from localStorage", e); }

    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  // --- Google 登录及其他 API 交互 ---
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
    } catch (e) { console.error("Login failed", e); }
  };

  const login = () => window.google?.accounts.id.prompt();
  const logout = () => { localStorage.removeItem(USER_KEY); setUser(null); setIsActivated(false); };

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
    return true;
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
    } catch (e) { return { success: false, error: '网络错误' }; }
  };

  // 触发器函数需要先定义，才能在 useEffect 中使用
  const triggerAI = useCallback((title, content, id = null, aiPreAnswer = null) => {
    setAiMode('CHAT');
    let finalContent;
    if (aiPreAnswer) {
      finalContent = `你好，我需要你扮演一名专业的汉语老师来讲解“${aiPreAnswer}`;
    } else {
      finalContent = content;
    }
    setActiveTask({
      title: title,
      content: finalContent,
      id: id,
      timestamp: Date.now()
    });
    setIsAiOpen(true);
  }, []);

  // 监听 AI 助手的打开事件
  const prevIsAiOpen = usePrevious(isAiOpen);
  useEffect(() => {
    if (!prevIsAiOpen && isAiOpen) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (pageContext && session && session.messages.length === 0 && session.title.startsWith('新对话')) {
        triggerAI(pageContext.title, pageContext.content, pageContext.id, pageContext.aiPreAnswer);
      }
    }
  }, [isAiOpen, prevIsAiOpen, pageContext, sessions, currentSessionId, triggerAI]);

  // --- Prompt 生成逻辑 ---
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    let displayLevel = config.userLevel || 'HSK 1';
    const taskId = activeTask?.id || "";
    const lowerId = taskId.toLowerCase();

    if (lowerId.includes('hsk1')) displayLevel = 'HSK 1';
    else if (lowerId.includes('hsk2')) displayLevel = 'HSK 2';
    else if (lowerId.includes('hsk3')) displayLevel = 'HSK 3';
    else if (lowerId.includes('sp')) displayLevel = '口语专项 (Spoken Chinese)';

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
      const contextString = (pageContext && typeof pageContext.content === 'string')
        ? pageContext.content
        : (activeTask && typeof activeTask.content === 'string' ? activeTask.content : '通用对话');
      // 增加截断长度至 6000，容纳长脚本
      template = template.replace('{{CONTEXT}}', contextString.substring(0, 6000));
    }
    return template;

  }, [config.userLevel, aiMode, activeTask, pageContext]);

  // --- 会话切换逻辑 ---
  const selectSession = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);

    if (session && !session.title.includes('解析')) {
      setAiMode('CHAT');
      setActiveTask(null);
      setPageContext(null);
    } else if (session && session.title.includes('解析')) {
      setAiMode('INTERACTIVE');
    }

  }, [sessions]);

  // --- 其他触发器函数 ---

  const triggerInteractiveAI = useCallback((payload) => {
    setAiMode('INTERACTIVE');
    setActiveTask({ ...payload, timestamp: Date.now() });
    setIsAiOpen(true);
  }, []);

  const updatePageContext = useCallback((contextObject) => {
    if (aiMode !== 'INTERACTIVE') {
      setPageContext(contextObject);
    }
  }, [aiMode]);

  const resetToChatMode = useCallback(() => {
    setAiMode('CHAT');
    setActiveTask(null);
    setPageContext(null);
  }, []);

  return (
    <AIContext.Provider value={{
      user, login, logout, isActivated, isGoogleLoaded, config, setConfig,
      sessions, setSessions, currentSessionId, setCurrentSessionId: selectSession,
      isAiOpen, setIsAiOpen,
      canUseAI, remainingQuota, TOTAL_FREE_QUOTA,
      handleActivate, handleGoogleCallback,
      activeTask, aiMode, systemPrompt: finalSystemPrompt,
      triggerInteractiveAI, updatePageContext, resetToChatMode, triggerAI,
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
