import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from 'react';
import Script from 'next/script';

const CONFIG_KEY = 'ai_global_config_v19';
const SESSIONS_KEY = 'ai_global_sessions_v19';
const USER_KEY = 'hsk_user';
const isBrowser = typeof window !== 'undefined';

const DEFAULT_CONFIG = {
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

const createNewSession = () => ({
  id: Date.now(),
  title: '新对话',
  messages: [],
  date: new Date().toISOString()
});

const NOOP_ASYNC = async () => ({ success: false, error: 'AI not ready' });
const NOOP = () => {};

const DEFAULT_AI_CONTEXT = {
  user: null,
  login: NOOP,
  logout: NOOP,
  isActivated: false,
  isGoogleLoaded: false,
  config: DEFAULT_CONFIG,
  setConfig: NOOP,
  sessions: [],
  setSessions: NOOP,
  currentSessionId: null,
  setCurrentSessionId: NOOP,
  isAiOpen: false,
  setIsAiOpen: NOOP,
  canUseAI: NOOP_ASYNC,
  remainingQuota: 0,
  TOTAL_FREE_QUOTA: 60,
  handleActivate: NOOP_ASYNC,
  handleGoogleCallback: NOOP_ASYNC,
  activeTask: null,
  aiMode: 'CHAT',
  systemPrompt: '',
  simpleSystemPrompt: '',
  SYSTEM_PROMPTS: {},
  getSystemPrompt: () => '',
  shouldUseBurmese: () => false,
  getBurmeseOverride: () => '',
  triggerInteractiveAI: NOOP,
  updatePageContext: NOOP,
  resetToChatMode: NOOP,
  triggerAI: NOOP
};

const AIContext = createContext(DEFAULT_AI_CONTEXT);

const readJson = (key, fallback) => {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
};

const writeJson = (key, value) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
};

const validateActivationCode = (code) => {
  if (!code) return { isValid: false, error: '请输入激活码' };

  const c = code.trim().toUpperCase();

  // 支持 H1-JHM-XXXX / HSK1-JHM-XXXX / SP-JHM-XXXX / H7-9-JHM-XXXX
  const match = c.match(/^([A-Z0-9-]+)-JHM-([A-Z0-9]+)$/);
  if (!match) return { isValid: false, error: '格式错误' };

  let levelRaw = match[1];
  if (levelRaw.startsWith('HSK')) {
    levelRaw = levelRaw.replace('HSK', 'H');
  }

  const VALID = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7-9', 'SP'];
  if (!VALID.includes(levelRaw)) {
    return { isValid: false, error: '等级不支持' };
  }

  return { isValid: true, level: levelRaw };
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

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [sessions, setSessions] = useState([createNewSession()]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const [remainingQuota, setRemainingQuota] = useState(0);
  const TOTAL_FREE_QUOTA = 60;

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null);
  const [pageContext, setPageContext] = useState(null);

  const SYSTEM_PROMPTS = {
    SIMPLE: `你是一名专业的汉语教师，面对的是母语为缅甸语的学生。
当前学生等级：{{LEVEL}}。
请用详细的地道口语风格、直接的方式回答学生的问题。`,

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
- 明确指出：缅甸学生最容易“照母语直译”的位置

3️⃣ 🧱句型公式（核心用法）
- 给 1-5个 个核心公式，每个句型给1-3个中文例句+地道的缅文翻译，用法说明用缅文。

4️⃣ ⚠️ 必踩的坑（错误对比）
【核心环节】列出 1-5个学生最容易犯的错误。
- ❌ 错误句子（标注：မြန်မာလို တိုက်ရိုက်ပြန်ထားတဲ့အမှား）
- ✅ 正确句子
- 💡 解释：为什么缅甸学生会这样错？
- 包含：区别说明 + 错误示范 + 正确示范
📌 如有易混淆词，必须加对比表：
| 词 | 用途 | 例句 |
|----|------|------|
-🔒 本节结尾用一句话总结最关键的避坑点

5️⃣ 🎯 高频搭配 & 万能句
- 提供 3 句最高频、不用动脑子就能背下来的例句。（表格形式）

6️⃣ 🗣️ 放心大胆说（缅文）
- 明确告诉学生：
  - 这样说 ✔️ 对
  - 不用担心语法
  - 中国人一定听得懂

7️⃣ 🔄（可选）拓展一点点
8️⃣ 追问（Q&A）（用缅文回答）

生成规则：
<<<SUGGESTIONS:问题1|问题2|问题3>>>
━━━━━━━━━━━━━━━━
【当前参考内容】：
{{CONTEXT}}`,

    INTERACTIVE: `你是一名汉语语法私教。当前处于【错题专项深度解析】模式。
【当前等级】：{{LEVEL}}
【题目 ID】：{{TASK_ID}}

语法点：{{GRAMMAR}}
题目：{{QUESTION}}
正确答案：{{CORRECT_ANSWER}}
学生误选：{{USER_CHOICE}}

请深度拆解学生思维漏洞，最后输出：
<<<SUGGESTIONS:Q1|||Q2|||Q3>>>`
  };

  useEffect(() => {
    if (!isBrowser) return;

    const savedConfig = readJson(CONFIG_KEY, DEFAULT_CONFIG);
    setConfig({ ...DEFAULT_CONFIG, ...savedConfig });

    const savedSessions = readJson(SESSIONS_KEY, []);
    const normalizedSessions = Array.isArray(savedSessions) && savedSessions.length
      ? savedSessions
      : [createNewSession()];
    setSessions(normalizedSessions);
    setCurrentSessionId(normalizedSessions[0]?.id || null);

    const cachedUser = readJson(USER_KEY, null);
    if (cachedUser) {
      setUser(cachedUser);
      setIsActivated(Boolean(cachedUser.unlocked_levels));
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(CONFIG_KEY, config);
  }, [config, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (sessions.length > 0) {
      writeJson(SESSIONS_KEY, sessions);
    }
  }, [sessions, hydrated]);

  const syncQuota = useCallback(async (email) => {
    try {
      const res = await fetch('/api/can-use-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setRemainingQuota(Number(data?.remaining || 0));
    } catch (_) {}
  }, []);

  const handleGoogleCallback = useCallback(async (response) => {
    try {
      const res = await fetch('/api/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response?.credential })
      });
      const data = await res.json();
      setUser(data || null);
      writeJson(USER_KEY, data || null);
      if (data?.unlocked_levels) setIsActivated(true);
      if (data?.email) syncQuota(data.email);
      return { success: true };
    } catch (e) {
      console.error('Login failed', e);
      return { success: false, error: '登录失败，请重试' };
    }
  }, [syncQuota]);

  useEffect(() => {
    if (!isBrowser) return;
    if (!isGoogleLoaded || !window.google) return;
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false
    });
  }, [isGoogleLoaded, handleGoogleCallback]);

  const login = useCallback(() => {
    if (!isBrowser) return;
    window.google?.accounts?.id?.prompt?.();
  }, []);

  const logout = useCallback(() => {
    if (isBrowser) {
      try {
        localStorage.removeItem(USER_KEY);
      } catch (_) {}
    }
    setUser(null);
    setIsActivated(false);
  }, []);

  const canUseAI = useCallback(async () => {
    if (isActivated) return true;
    if (!user) return false;
    return true;
  }, [isActivated, user]);

  const handleActivate = useCallback(async (code) => {
    if (!user) return { success: false, error: '请先登录' };

    const check = validateActivationCode(code);
    if (!check.isValid) return check;

    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: code.trim().toUpperCase() })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data?.error || '激活失败' };

      const newUser = { ...user, unlocked_levels: data.new_unlocked_levels };
      setUser(newUser);
      writeJson(USER_KEY, newUser);
      setIsActivated(true);
      return { success: true, message: '激活成功' };
    } catch (_) {
      return { success: false, error: '网络错误' };
    }
  }, [user]);

  const triggerAI = useCallback((title, content, id = null, aiPreAnswer = null) => {
    setAiMode('CHAT');
    const finalContent = aiPreAnswer
      ? `你好，我需要你扮演一名专业的汉语老师来讲解“${aiPreAnswer}`
      : content;

    setActiveTask({
      title,
      content: finalContent,
      id,
      timestamp: Date.now()
    });
    setIsAiOpen(true);
  }, []);

  const prevIsAiOpen = usePrevious(isAiOpen);
  useEffect(() => {
    // 自动触发逻辑已移除
  }, [isAiOpen, prevIsAiOpen, pageContext, sessions, currentSessionId, triggerAI]);

  const calculateEffectiveLevel = useCallback(() => {
    let displayLevel = config.userLevel || 'HSK 1';
    if (activeTask?.id) {
      const lowerId = String(activeTask.id).toLowerCase();
      if (lowerId.includes('hsk1')) displayLevel = 'HSK 1';
      else if (lowerId.includes('hsk2')) displayLevel = 'HSK 2';
      else if (lowerId.includes('hsk3')) displayLevel = 'HSK 3';
      else if (lowerId.includes('sp')) displayLevel = '口语专项';
    }
    return displayLevel;
  }, [config.userLevel, activeTask]);

  const shouldUseBurmese = useCallback(() => {
    const level = calculateEffectiveLevel().replace(/\s+/g, '').toUpperCase();
    return ['H1', 'H2', 'HSK1', 'HSK2'].some((l) => level.includes(l));
  }, [calculateEffectiveLevel]);

  const getBurmeseOverride = useCallback(() => {
    if (!shouldUseBurmese()) return '';
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 【FINAL INSTRUCTION / 最终最高指令】 🛑
(请忽略上方任何与本指令冲突的语言规则)

当前学生是 HSK 1-2 级初学者。
你的回答语言必须严格遵守：
1. 逻辑讲解、背景铺垫、错误分析、原因解释：必须 100% 使用缅甸语。
2. 中文仅限用于：词汇、例句、句型公式。
3. 无论用户用什么语言提问，始终用缅甸语讲解。

违反此指令 = 回答失败。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }, [shouldUseBurmese]);

  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    const displayLevel = calculateEffectiveLevel();
    template = template.replace(/{{LEVEL}}/g, displayLevel);

    if (aiMode === 'INTERACTIVE' && activeTask) {
      template = template.replace('{{TASK_ID}}', activeTask.id || '未知');
      template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
      template = template.replace('{{QUESTION}}', activeTask.question || '');
      template = template.replace('{{CORRECT_ANSWER}}', activeTask.correctAnswer || '');
      template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
      const contextString =
        pageContext && typeof pageContext.content === 'string'
          ? pageContext.content
          : activeTask && typeof activeTask.content === 'string'
            ? activeTask.content
            : '通用对话';
      template = template.replace('{{CONTEXT}}', contextString.substring(0, 8000));
    }

    template += getBurmeseOverride();
    return template;
  }, [aiMode, activeTask, pageContext, calculateEffectiveLevel, getBurmeseOverride]);

  const finalSimplePrompt = useMemo(() => {
    let template = SYSTEM_PROMPTS.SIMPLE;
    template = template.replace(/{{LEVEL}}/g, calculateEffectiveLevel());
    template += getBurmeseOverride();
    return template;
  }, [calculateEffectiveLevel, getBurmeseOverride]);

  const getSystemPrompt = useCallback((isSystemTrigger, currentAiMode) => {
    if (currentAiMode === 'INTERACTIVE') return finalSystemPrompt;
    if (isSystemTrigger && currentAiMode === 'CHAT') return finalSystemPrompt;
    return finalSimplePrompt;
  }, [finalSystemPrompt, finalSimplePrompt]);

  const selectSession = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return;

    if (!session.title.includes('解析')) {
      setAiMode('CHAT');
      setActiveTask(null);
      setPageContext(null);
    } else {
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

  const value = useMemo(() => ({
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
    setCurrentSessionId: selectSession,
    isAiOpen,
    setIsAiOpen,
    canUseAI,
    remainingQuota,
    TOTAL_FREE_QUOTA,
    handleActivate,
    handleGoogleCallback,
    activeTask,
    aiMode,
    systemPrompt: finalSystemPrompt,
    simpleSystemPrompt: finalSimplePrompt,
    SYSTEM_PROMPTS,
    getSystemPrompt,
    shouldUseBurmese,
    getBurmeseOverride,
    triggerInteractiveAI,
    updatePageContext,
    resetToChatMode,
    triggerAI
  }), [
    user,
    login,
    logout,
    isActivated,
    isGoogleLoaded,
    config,
    sessions,
    currentSessionId,
    selectSession,
    isAiOpen,
    canUseAI,
    remainingQuota,
    handleActivate,
    handleGoogleCallback,
    activeTask,
    aiMode,
    finalSystemPrompt,
    finalSimplePrompt,
    getSystemPrompt,
    shouldUseBurmese,
    getBurmeseOverride,
    triggerInteractiveAI,
    updatePageContext,
    resetToChatMode,
    triggerAI
  ]);

  return (
    <AIContext.Provider value={value}>
      <Script
        src='https://accounts.google.com/gsi/client'
        strategy='lazyOnload'
        onLoad={() => setIsGoogleLoaded(true)}
      />
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => useContext(AIContext) || DEFAULT_AI_CONTEXT;
