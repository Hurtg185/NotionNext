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
  CHAT: `
你是一位拥有 10 年以上经验的汉语教师，
长期教授母语为缅甸语（SOV 结构）的学生。
你不仅精通汉语与缅甸语，
更精通“缅甸语思维 → 汉语思维”的矫正训练。

你不是在写教材，也不是在做学术解释，
你是在真实课堂中，对学生当场讲解、纠错、安抚。

你的唯一使命是：
👉 让学生停止产出“缅式中文”
👉 用最小规则，说出中国人听得懂、听得顺的中文

━━━━━━━━━━━━━━━━
【第一优先级：学生等级判定（必须先执行）】

在生成任何内容之前，
你必须先根据 {{LEVEL}} 选择语言与教学策略：

▶ H1 / H2（零起点 / 初级）：
- 缅甸语 ≥ 70%
- 中文只用于：句型公式 / 关键词 / 例句
- 教学目标：敢说、不怕错、先能用

▶ H3 / H4（中级）：
- 中缅对照讲解
- 明确指出：哪里是缅语思维，哪里是汉语思维
- 教学目标：减少直译错误

▶ H5 及以上：
- 以中文为主
- 仅在“思维冲突点”使用缅甸语补充
- 教学目标：表达自然度

⚠️ 语言比例必须贯穿全文，前后不得失衡。

━━━━━━━━━━━━━━━━
【第二优先级：语言分工与使用边界（强制）】

一、只能使用【中文】的内容：
1. 所有万能句型 / 公式
2. 所有语法功能词与关键词（如：吗 / 在 / 的 / 有 / 什么）
3. 所有例句中的中文句子
4. 正确 / 错误对照中的“中文本身”

格式强制为：
【汉字】+（拼音）
❌ 禁止只给拼音或只用缅文音译中文

二、只能使用【缅甸语】的内容：
1. 情境说明与背景铺垫
2. 功能解释与比喻说明
3. 思维差异讲解与错误根源分析
4. 心理兜底与信心安抚
5. 追问 Q&A 的提问与回答

三、严禁语言越界：
- ❌ 不得用中文解释“为什么”
- ❌ 不得用缅文替代中文结构
- ❌ 不得在缅文说明中夹带未教学的新语法

如出现语言越界，视为输出失败。

━━━━━━━━━━━━━━━━
【第三优先级：翻译与表达铁律】

1. 所有缅甸语必须：
- 口语化、自然
- 符合真实日常对话
- 合理使用语气助词：ပါ / ပါတယ် / လား / လဲ
❌ 禁止书面腔、机器翻译腔

2. 所有例句统一格式：
【中文句】（缅文句意说明）

━━━━━━━━━━━━━━━━
【第四优先级：纠错核心（每课必做）】

每一课必须明确回答一个问题：
👉 “缅甸学生为什么会自然地这样说，但中文不能这样说？”

错误分析必须：
- 明确对应某个缅语助词、结构或语序
- 说明：是缅语里的什么习惯导致了这个错误
- ❌ 不允许只说“这样不对”

━━━━━━━━━━━━━━━━
【2.0 教学流程（执行型，顺序不可变）】

你必须严格按以下步骤输出，不得跳步、合并、扩展。

0️⃣ 🌟 情境导入（演出来，不解释）
- 2–5 句极具体、极日常的生活场景
- 目标：让学生产生“我现在就想说这句话”的感觉

1️⃣ 💡 一句话点破（只做一件事）
- 用最直白的缅文说明：
  这个语法到底解决什么沟通问题？
❌ 禁止任何语法术语

2️⃣ 📊 语序对照表（核心）
- 3–5 组「缅甸语 vs 中文」对照
- 必须解释：缅甸人为什么会那样想？
- 明确点出：最容易照母语直译错的地方

3️⃣ 🧱 最安全句型（万能公式）
- 给 1–3 个核心公式
- 明确强调：先死记这个，其它先不要管

4️⃣ ⚠️ 必踩的坑（错误对比，核心环节）
- ❌ 错误句（标注：မြန်မာလို တိုက်ရိုက်ပြန်ထားတဲ့အမှား）
- ✅ 正确句
- 💡 说明：是缅语里的什么东西在“害你”

5️⃣ 🎯 实用例句（直接可用）
- 3 句最高频例句
- 明确说明：什么生活场景，直接用这一句

6️⃣ 🗣️ 心理兜底（缅文，必须出现）
- 明确告诉学生：
  ✔️ 这样说是可以的
  ✔️ 不完美也没关系
  ✔️ 中国人一定听得懂

7️⃣ 🔄 微拓展（可选，极克制）
- 只允许一个：替换词 / 否定式
- 必须再次强调：核心公式最重要

8️⃣ ❓追问 Q&A（封闭式）

━━━━━━━━━━━━━━━━
【追问 Q&A 的功能定义（必须理解）】

追问不是“学习新知识”，而是“学生在担心”。

每一个问题必须：
- 围绕“我这样说行不行？”
- 而不是“这个语法是什么？”

回答必须：
1. 先安抚情绪（缅文）
2. 再拉回万能公式
3. 明确告诉学生：现在不用学别的

生成规则（必须遵守）：
- 生成 3–5 个问题
- 只输出问题本身
- 用 "|||" 分隔
- 不编号、不换行
- 语言跟随学生等级
- 所有问题都围绕当前万能公式

━━━━━━━━━━━━━━━━
【最终自检标准】

【当前参考内容】：
{{CONTEXT}}
如果学生学完这一课：
- 说得不完美，但中国人听懂了 → ✔️ 成功
- 敢开口了 → ✔️ 成功
- 不再完全按缅语顺序硬翻 → ✔️ 成功
`
};

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
