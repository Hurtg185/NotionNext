import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v15'; // 升级版本号以重置配置
const SESSIONS_KEY = 'ai_global_sessions_v15';
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
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  /* ======================
     2. AI 配置
  ====================== */
  const [config, setConfig] = useState({
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1', 
    modelId: 'deepseek-ai/deepseek-v3.2',
    userLevel: 'H1',
    showPinyin: true, 
    autoSendStt: false, 
    ttsSpeed: 1,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    soundEnabled: true,
    sttLang: 'zh-CN'
  });

  /* ======================
     3. AI UI / 会话 / 历史记录
  ====================== */
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ======================
     4. 配额管理
  ====================== */
  const TOTAL_FREE_QUOTA = 60; 
  const [remainingQuota, setRemainingQuota] = useState(0);

  /* ======================
     5. 模式与上下文管理
  ====================== */
  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null); 
  const [pageContext, setPageContext] = useState('');

  /* ======================
     6. 提示词模板 (✅ 核心修改部分)
  ====================== */
  const SYSTEM_PROMPTS = {
    // 普通对话模式：增加了“智能判断”逻辑，防止 AI 句句不离语法
    CHAT: `你是一位专门教【缅甸学生】学习汉语的老师。
【当前学生等级】{{LEVEL}}
【屏幕上下文】{{CONTEXT}} (这是学生当前正在看的学习内容，仅作为背景参考)

【你的行为准则 - 非常重要】
1. **智能判断意图**：
   - 如果学生问“你好”、“聊聊别的”或与学习无关的话题，请**完全忽略**屏幕上下文，像朋友一样自然闲聊。
   - 如果学生问“这是什么意思”、“请解释一下”或针对屏幕内容提问，请结合【屏幕上下文】进行专业讲解。

2. **讲解时的语言规则（严格遵守）**
   - H1 / H2 (初学者)：解释必须以【缅文为主】，中文仅作为关键词或例句。绝对不允许连续两句只有中文。
   - H3 / H4 (进阶)：采取“中文+缅文”对照讲解。
   - H5 及以上 (高级)：以中文讲解为主，难点辅以缅文。

3. **回答结构（仅在讲解知识点时使用）**
   - 解释含义 -> 举例说明 -> 互动提问。`,

    // 互动错题模式：保持原有逻辑
    INTERACTIVE: `你是一名缅甸学生的汉语语法与互动私教老师。你的任务不是直接讲语法，是让学生下次不再这样选。
【当前任务】学生做错题了，需要补课。你要通过“复原错因 + 场景尴尬感 + 小窍门”引导学生自己悟出来。
【学生等级】{{LEVEL}}

【语言强制执行规则（优先级最高）】
- 如果{{GRAMMAR}}是 H1 或 H2：你必须【全程使用缅甸语】解释逻辑。严禁发送大段中文。
- 如果{{GRAMMAR}}是 H3 或 H4：每一句中文解释后必须紧跟缅文翻译。

【错题信息】
- 语法点：{{GRAMMAR}}
- 题目：{{QUESTION}}
- 学生误选：{{USER_CHOICE}}

【总规则】
1.不说“你错了 / 不对”  
2.不超过 5个语法术语  
3. 用自然流畅的地道口语，避免 AI 痕迹。
4. 重点分析：为什么会选 {{USER_CHOICE}}

【补课流程】
① 还原学生当时的想法：用缅甸学生的思维想一下他为什么选这个？
② 尴尬现场（最关键）：把误选放进真实场景，展示尴尬或误会。用缅语对比解释为什么中文不能这样硬套。
③ 关键线索提醒：引导学生注意题目中的关键字，详细解释为什么不能这样选。
④ 一句话收尾点出核心。

【追问生成】
基于本题错误点生成 3 个追问，使用格式：SUGGESTIONS: Q1|||Q2|||Q3`
  };

  /* ======================
     7. 初始化与本地存储
  ====================== */
  useEffect(() => {
    const cachedUser = localStorage.getItem(USER_KEY);
    if (cachedUser) {
      try {
        const u = JSON.parse(cachedUser);
        setUser(u);
        if (u.unlocked_levels) setIsActivated(true);
      } catch (e) {}
    }

    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try { setConfig((c) => ({ ...c, ...JSON.parse(savedConfig) })); } catch (e) {}
    }

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
    
    // 初始化标签页
    try {
        const savedBookmarks = localStorage.getItem('ai_global_bookmarks_v15');
        if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    } catch(e) {}

  }, []);

  useEffect(() => { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }, [config]);
  useEffect(() => { if(sessions.length > 0) localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem('ai_global_bookmarks_v15', JSON.stringify(bookmarks)); }, [bookmarks]);

  useEffect(() => {
    if (user?.unlocked_levels) {
      const levels = user.unlocked_levels.split(',');
      const highest = levels[levels.length - 1];
      setConfig((c) => ({ ...c, userLevel: highest }));
    }
  }, [user]);

  /* ======================
     8. Google 登录逻辑
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
    }
  };

  const login = () => {
      if (window.google) {
          window.google.accounts.id.prompt();
      } else {
          alert("Google 服务加载中...");
      }
  };

  const logout = () => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setIsActivated(false);
  };

  /* ======================
     9. 权限与 API 交互
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
     10. Prompt 动态生成逻辑
  ====================== */
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    template = template.replace(/{{LEVEL}}/g, config.userLevel || 'H1');
    
    if (aiMode === 'INTERACTIVE' && activeTask) {
        template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '通用语法');
        template = template.replace('{{QUESTION}}', activeTask.question || '');
        template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
        // 在普通模式下，传入当前页面内容，但提示词中已经说明了“仅供参考”
        template = template.replace('{{CONTEXT}}', pageContext || '（无特定屏幕内容，请自由交流）');
    }
    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

  /* ======================
     11. 触发器函数
  ====================== */
  
  // 1. 触发互动题解析
  const triggerInteractiveAI = (payload) => {
    setAiMode('INTERACTIVE');
    
    // 创建专用错题 Session
    const newSessionId = Date.now();
    const newSession = { 
        id: newSessionId, 
        title: `解析: ${payload.grammarPoint || '错题分析'}`, 
        messages: [], 
        date: new Date().toISOString() 
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);

    setActiveTask({
      ...payload,
      timestamp: Date.now() 
    });
    setIsAiOpen(true);
  };

  // 2. 静默更新 PPT 上下文 (在翻页时调用)
  const updatePageContext = (content) => {
    // 只有在非互动模式下才更新背景 Context，避免覆盖错题信息
    if (aiMode !== 'INTERACTIVE') {
        setPageContext(content);
    }
  };

  // 3. 重置为普通聊天模式
  const resetToChatMode = () => {
      setAiMode('CHAT');
      setActiveTask(null);
      // 如果当前是错题 Session，建议新建一个“新对话”以免逻辑混乱
      const newSession = { id: Date.now(), title: '新对话', messages: [], date: new Date().toISOString() };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
  };
  
  // 4. 兼容旧版触发器
  const triggerAI = (title, content) => {
      setAiMode('CHAT');
      setActiveTask(null); // 清除特定任务
      setPageContext(content);
      setIsAiOpen(true);
  };

  /* ======================
     12. Provider 导出
  ====================== */
  return (
    <AIContext.Provider value={{
        user, login, logout, isActivated, isGoogleLoaded, config, setConfig,
        sessions, setSessions, currentSessionId, setCurrentSessionId,
        bookmarks, setBookmarks, isAiOpen, setIsAiOpen,
        canUseAI, recordUsage, remainingQuota, TOTAL_FREE_QUOTA,
        handleActivate, handleGoogleCallback,
        activeTask, aiMode, systemPrompt: finalSystemPrompt,
        triggerInteractiveAI, updatePageContext, resetToChatMode, triggerAI
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

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
};
