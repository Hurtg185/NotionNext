import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
// 版本号 v19：强制指令置底优化版
const CONFIG_KEY = 'ai_global_config_v19';
const SESSIONS_KEY = 'ai_global_sessions_v19';
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

  // --- System Prompts 定义 ---
  // 注意：这里的 {{LEVEL}} 只是占位符，真正的强制逻辑在下方的 getBurmeseOverride 中置底添加
  const SYSTEM_PROMPTS = {
    SIMPLE: `你是一名专业的汉语教师，面对的是母语为缅甸语的学生。
当前学生等级：{{LEVEL}}。
请用最简洁、直接的方式回答学生的问题。`,

    CHAT: `你是一位拥有 10 年以上经验的汉语教师，长期教授母语为缅甸语（SOV 结构）的学生。
在生成内容之前，请根据等级 {{LEVEL}} 设定基准。

【2.0 教学流程（增强详细版）】
0️⃣ 🌟 情境导入
- 用 2–5 句极具体、极日常的生活场景（例句用中文+缅文翻译）
目的：让学生产生“对！我现在就想说这句话”的冲动。

1️⃣ 💡 一句话记住
用最直白的缅文说明：这个语法点本质上是在解决什么沟通问题。
- 严禁使用“代词、介词、谓语”等专业术语。

2️⃣ 📊 语序对照表（重点）
- 用3-5句「缅甸语 vs 中文」对照
- 不只给顺序，还要解释【思考方式为什么不同】
- 明确指出：缅甸学生最容易“照母语直译”的地方

3️⃣ 🧱句型结构
- 给 1-3个 个核心公式，每个句型给1-3个中文例句+地道的缅文翻译

4️⃣ ⚠️ 必踩的坑（错误对比）
【核心环节】列出 1-5个学生最容易犯的错误。
- ❌ 错误句子（标注：မြန်မာလို တိုက်ရိုက်ပြန်ထားတဲ့အမှား）
- ✅ 正确句子
- 💡 解释：为什么缅甸学生会这样错？（比如：因为缅甸语里有“တာ”，所以总想加“是”）。

5️⃣ 🎯 实用例句
- 提供 3 句最高频、不用动脑子就能背下来的例句。
- 告诉学生：遇到[XX场景]，直接扔出这一句，中国人绝对听得懂。例句用中文，其他用缅文

6️⃣ 🗣️ 心理兜底（缅文）
- 明确告诉学生：
  - 这样说 ✔️ 对
  - 不用担心语法
  - 中国人一定听得懂

7️⃣ 🔄（可选）拓展一点点
只给一个最常见的替换词或否定式。
- 再次强调：先把前面的公式用熟，这个只是点缀。
8️⃣ 追问（Q&A）（用缅文回答）

设计目的： 预判并准备回答学生基于当前“语法内容” 可能产生的困惑，用安抚性语言打消其顾虑，并始终将其思维引导回核心句型。

生成规则： 请基于本课所教的语法，生成3-5个学生最可能产生的疑问。

追问格式（必须遵守）：
    1. 讲解结束后，必须在最后一行单独输出追问建议。
    2. 格式必须严格如下（不要包含任何其他文字）：
    <<<SUGGESTIONS:问题1|问题2|问题3>>>
    3. 这里的“问题”必须是站在“学生”的角度想问的问题。
    4. 语言要求：HSK1-2 用缅甸语，HSK3+ 用中文。
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

  const shouldUseBurmese = useCallback(() => {
    const level = calculateEffectiveLevel().replace(/\s+/g, '').toUpperCase();
    // 强制检查：H1, H2, HSK1, HSK2
    return ['H1', 'H2', 'HSK1', 'HSK2'].some(l => level.includes(l));
  }, [calculateEffectiveLevel]);

  // 🔥 强制缅语指令 (置底专用) 🔥
  const getBurmeseOverride = useCallback(() => {
    // 只有初学者才触发
    if (!shouldUseBurmese()) return '';
    
    // 使用极强的 Prompt Injection 技术，大写 + 符号强调
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 【FINAL INSTRUCTION / 最终最高指令】 🛑
(请忽略上方任何与本指令冲突的语言规则)

当前学生是 HSK 1-2 级初学者。
你的回答语言必须严格遵守：

1. **逻辑讲解、背景铺垫、错误分析、原因解释**：
   👉 必须 100% 使用【缅甸语】。
   ❌ 严禁使用中文解释逻辑（学生看不懂）。
   
2. **中文仅限用于**：
   👉 词汇 (Vocabulary)
   👉 例句 (Example Sentences)
   👉 固定句型/公式 (Grammar Formulas)

3. **无论用户用什么语言提问**：
   👉 你必须始终坚持用【缅甸语】进行教学讲解。
   
违反此指令 = 回答失败。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }, [shouldUseBurmese]);

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

    // 🔴 关键修改：将强制指令追加到字符串的最末尾！
    template += getBurmeseOverride();

    return template;
  }, [aiMode, activeTask, pageContext, calculateEffectiveLevel, getBurmeseOverride]);

  // 5. 计算：简洁版 System Prompt (追问专用)
  const finalSimplePrompt = useMemo(() => {
      let template = SYSTEM_PROMPTS.SIMPLE;
      const displayLevel = calculateEffectiveLevel();
      template = template.replace(/{{LEVEL}}/g, displayLevel);
      
      // 🔴 关键修改：同样追加到最末尾！
      template += getBurmeseOverride();
      
      return template;
  }, [calculateEffectiveLevel, getBurmeseOverride]);

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
      shouldUseBurmese,
      getBurmeseOverride,
      
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
