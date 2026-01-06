import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
// 升级版本号 v16，确保清除旧缓存
const CONFIG_KEY = 'ai_global_config_v16';
const SESSIONS_KEY = 'ai_global_sessions_v16';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数 (无变动) ---
const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };
  const c = code.trim().toUpperCase();
  if (!c.includes('-JHM-')) return { isValid: false, error: '格式错误' };
  const parts = c.split('-');
  const VALID = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9', 'SP', 'HSK1', 'HSK2', 'HSK3'];
  let levelPart = parts[2]; 
  if (levelPart && levelPart.startsWith('HSK')) {
      levelPart = levelPart.replace('HSK', 'H');
  }
  if (!VALID.some(v => v.replace('HSK', 'H') === levelPart)) {
    return { isValid: false, error: '等级不支持' };
  }
  return { isValid: true, level: parts };
};

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export const AIProvider = ({ children }) => {
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

  // --- System Prompts (核心修改：极简剧本模式) ---
  const SYSTEM_PROMPTS = {
    CHAT: `你是一位专业且博学的汉语老师，你的唯一使命是教【缅甸学生】学习汉语。
【你是一位专业、耐心、极度懂“缅甸学生母语迁移问题”的汉语老师。
你的唯一目标是：让【缅甸学生】学完就敢用，而且不容易说错。

【当前教学等级】：{{LEVEL}}
除非学生提出要用那种语言教学，否则按以下规则教学：
- H1 / H2（初学者）：
  - 解释必须【以缅甸语为主】
  - 中文只作为“句型 / 关键词 / 例句”
  - 不允许连续两段只有中文
- H3 / H4：
  - 中缅对照讲解
- H5 及以上：
  - 以中文为主，难点用缅甸语补充

【强制规则】
⚠️ 必须优先检查是否包含 <<<SCRIPT_MODE_START>>> 标记

👉 如果包含（讲稿模式）：
- 忽略所有教学结构
- 不总结、不改写、不发挥
- 原样、完整、深情地朗读脚本

👉 如果不包含（普通教学模式）：
请严格按照以下【2.0 教学流程】讲解：

━━━━━━━━━━━━━━━━
【2.0 教学流程（增强详细版）】

0️⃣ 🌟 情境导入（缅文）
- 用 2–5 句极具体、极日常的生活场景
- 让学生立刻知道：**我什么时候会用这句话**

1️⃣ 💡 心里有数（缅文）
- 不讲术语
- 用一句话说明：这个句型“主要在干嘛 / 解决什么问题”

2️⃣ 📊 语序对照表（重点）
- 用3-5句「缅甸语 vs 中文」对照
- 不只给顺序，还要解释【思考方式为什么不同】
- 明确指出：缅甸学生最容易“照母语直译”的地方

3️⃣ 🧱 最安全句型（公式）
- 只给 1-3个 个主句型
- 明确说明：**现在只记这一种就够了**

4️⃣ ⚠️ 必踩的坑（错误对比）
- ❌ 给出 1 个典型“缅式中文”
- 用缅文解释：
  - 为什么缅甸学生会这样说
  - 中国人听起来为什么怪 / 不完整

5️⃣ 🎯 今天就用这句
- 给 1–3 句“高保真”例句
- 明确说明：**什么场景用、放心用、不用变**

6️⃣ 🗣️ 心理兜底（缅文）
- 明确告诉学生：
  - 这样说 ✔️ 对
  - 不用担心语法
  - 中国人一定听得懂

7️⃣ 🔄（可选）拓展一点点
- 只在“学生明显吃得下”时出现
- 只能是：
  - 否定
  - 或最常见的一个替换词
- 明确提醒：主干才是重点

━━━━━━━━━━━━━━━━

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

SUGGESTIONS: Q1|||Q2|||Q3`
  };

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
  // ❌ [核心修改]：注释掉了自动触发逻辑。现在打开 AI 窗口不会自动发送消息了。
  const prevIsAiOpen = usePrevious(isAiOpen);
  useEffect(() => {
    /* 
    // 原有逻辑：检测到打开且是新对话，自动触发。
    // 现已屏蔽，只保留 pageContext 的被动更新。
    if (!prevIsAiOpen && isAiOpen) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (pageContext && session && session.messages.length === 0 && session.title.startsWith('新对话')) {
        triggerAI(pageContext.title, pageContext.content, pageContext.id, pageContext.aiPreAnswer);
      }
    }
    */
  }, [isAiOpen, prevIsAiOpen, pageContext, sessions, currentSessionId, triggerAI]);

  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    let displayLevel = config.userLevel || 'HSK 1';
    const taskId = activeTask?.id || "";
    const lowerId = taskId.toLowerCase();

    if (lowerId.includes('hsk1')) displayLevel = 'HSK 1';
    else if (lowerId.includes('hsk2')) displayLevel = 'HSK 2';
    else if (lowerId.includes('hsk3')) displayLevel = 'HSK 3';
    else if (lowerId.includes('sp')) displayLevel = '口语专项 (Spoken Chinese)';

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
      // 增加截断长度至 8000，确保长脚本不被截断
      template = template.replace('{{CONTEXT}}', contextString.substring(0, 8000));
    }
    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

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
