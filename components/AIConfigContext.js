import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
// 版本号 v18：启用动态语言适配
const CONFIG_KEY = 'ai_global_config_v18';
const SESSIONS_KEY = 'ai_global_sessions_v18';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

// --- 辅助函数 ---
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

  // --- System Prompts 定义 (已修改为动态适配) ---
  const SYSTEM_PROMPTS = {
    // 基础聊天与追问模式
    SIMPLE: `你是一名专业的汉语教师，面对的是母语为缅甸语的学生。
当前学生等级：{{LEVEL}}。

【🔍 动态语言适配策略 (Auto-Detect Language)】
请检测用户的输入语言：
1. **如果用户说缅甸语**：
   - 请 100% 用**缅甸语**回答（最自然、最亲切的口吻）。

2. **如果用户说中文**：
   - 若当前等级为 HSK 1-2：请用“简单中文回答 + 缅语翻译/解释”进行兜底。
   - 若当前等级为 HSK 3+：请用简单、规范的中文回答。

3. **如果用户说英语或其他语言**：
   - 请跟随用户的语言进行回答。

【回答原则】
- 简洁、直接。
- 不要重复之前的长篇大论，只针对问题解惑。`,

    // 2.0 完整教学流程（新课讲解）
    CHAT: `你是一位拥有 10 年以上经验的汉语教师，长期教授母语为缅甸语（SOV 结构）的学生。
在生成内容之前，请根据等级 {{LEVEL}} 设定基准，但必须根据用户的实际反馈灵活调整。

【🔍 动态语言交互规则】
1. **默认教学语言**：
   - HSK 1-2：默认使用【缅甸语】讲解逻辑，【中文】仅用于例句。
   - HSK 3-4：默认使用【中缅对照】。
   - HSK 5+：默认使用【中文】。

2. **用户干预规则**：
   - 如果用户突然用**中文**提问，说明他想尝试练习，请用“简单中文”回应他，必要时加括号注缅文。
   - 如果用户用**缅甸语**提问，说明他没听懂，请立即切换回全缅文解释。

━━━━━━━━━━━━━━━━
【2.0 教学流程（增强版）】
0️⃣ 🌟 情境导入 (场景化)
1️⃣ 💡 一句话记住 (核心痛点)
2️⃣ 📊 语序对照表 (中缅思维差异)
3️⃣ 🧱 最安全句型 (公式 + 中文例句 + 缅文翻译)
4️⃣ ⚠️ 必踩的坑 (典型错误分析)
5️⃣ 🎯 实用例句 (高频口语)
6️⃣ 🗣️ 心理兜底 (鼓励学生)
7️⃣ 追问建议 (Q&A)

⚠️ 特别注意：在讲解 HSK 1-2 内容时，无论如何，**逻辑解释、背景铺垫、错误分析** 必须包含缅甸语，防止学生看不懂。

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
补课模式：针对学生的错选 {{USER_CHOICE}}，用缅甸语深度拆解思维漏洞。
语言策略：
- 解释逻辑：100% 缅甸语
- 例句对比：中文 + 缅文翻译
`
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

  const prevIsAiOpen = usePrevious(isAiOpen);
  useEffect(() => {
     // 自动触发逻辑已移除
  }, [isAiOpen, prevIsAiOpen, pageContext, sessions, currentSessionId, triggerAI]);


  // ================= 核心 Prompt 逻辑 =================

  // 计算有效等级
  const calculateEffectiveLevel = useCallback(() => {
      let displayLevel = config.userLevel || 'HSK 1';
      // 优先使用 Task ID 判定等级
      if (activeTask && activeTask.id) {
          const lowerId = activeTask.id.toLowerCase();
          if (lowerId.includes('hsk1')) displayLevel = 'HSK 1';
          else if (lowerId.includes('hsk2')) displayLevel = 'HSK 2';
          else if (lowerId.includes('hsk3')) displayLevel = 'HSK 3';
          else if (lowerId.includes('sp')) displayLevel = '口语专项';
      }
      return displayLevel;
  }, [config.userLevel, activeTask]);

  // 🔥 语言策略补丁 (Smart Language Strategy)
  // 不再强制 100% 缅语，而是注入“智能跟随”指令，但为初学者保留缅语默认值
  const getLanguageStrategy = useCallback(() => {
    const currentLevel = calculateEffectiveLevel();
    const cleanLevel = currentLevel.replace(/\s+/g, '').toUpperCase();
    const isBeginner = ['H1', 'H2', 'HSK1', 'HSK2'].some(l => cleanLevel.includes(l));

    let strategy = `\n\n【🤖 LANGUAGE STRATEGY / 语言策略】
1. **Detect User Language**: Respond in the SAME language as the user (Burmese -> Burmese, Chinese -> Chinese).
`;

    if (isBeginner) {
        strategy += `2. **For HSK 1-2 Beginners**: 
   - Even if answering in Chinese, providing a **Burmese translation** is HIGHLY RECOMMENDED for complex logic.
   - If unsure, default to **Burmese** for explanations.`;
    } else {
        strategy += `2. **For Intermediate/Advanced**: 
   - Use Chinese primarily. Use Burmese only for difficult concept clarification.`;
    }

    return strategy;
  }, [calculateEffectiveLevel]);

  // 4. 计算：完整版 System Prompt
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    const displayLevel = calculateEffectiveLevel();
    
    template = template.replace(/{{LEVEL}}/g, displayLevel);

    if (aiMode === 'INTERACTIVE' && activeTask) {
      template = template.replace('{{TASK_ID}}', activeTask.id || '未知');
      template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
      template = template.replace('{{QUESTION}}', activeTask.question || '');
      template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
      const contextString = (pageContext && typeof pageContext.content === 'string')
        ? pageContext.content
        : (activeTask && typeof activeTask.content === 'string' ? activeTask.content : '通用对话');
      template = template.replace('{{CONTEXT}}', contextString.substring(0, 8000));
    }

    // 注入动态策略
    template += getLanguageStrategy();

    return template;
  }, [aiMode, activeTask, pageContext, calculateEffectiveLevel, getLanguageStrategy]);

  // 5. 计算：简洁版 System Prompt (追问专用)
  const finalSimplePrompt = useMemo(() => {
      let template = SYSTEM_PROMPTS.SIMPLE;
      const displayLevel = calculateEffectiveLevel();
      template = template.replace(/{{LEVEL}}/g, displayLevel);
      
      // 注入动态策略
      template += getLanguageStrategy();
      
      return template;
  }, [calculateEffectiveLevel, getLanguageStrategy]);

  // 6. 导出
  const getSystemPrompt = useCallback((isSystemTrigger, currentAiMode) => {
      if (currentAiMode === 'INTERACTIVE') return finalSystemPrompt;
      if (isSystemTrigger && currentAiMode === 'CHAT') {
          return finalSystemPrompt;
      } else {
          return finalSimplePrompt;
      }
  }, [finalSystemPrompt, finalSimplePrompt]);

  // ========================================================

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
      activeTask, aiMode, 
      
      systemPrompt: finalSystemPrompt,     
      simpleSystemPrompt: finalSimplePrompt, 
      
      SYSTEM_PROMPTS,
      getSystemPrompt,
      // 这里的辅助函数不需要改名，UI如果有用到可以继续用，或者忽略
      shouldUseBurmese: () => true, 
      getBurmeseOverride: getLanguageStrategy, 
      
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
