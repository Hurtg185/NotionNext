import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import Script from 'next/script';

// --- 常量定义 ---
const CONFIG_KEY = 'ai_global_config_v14';
const SESSIONS_KEY = 'ai_global_sessions_v14';
const USER_KEY = 'hsk_user';

const AIContext = createContext();

/**
 * 核心逻辑改进说明：
 * 1. 等级判定：优先从课件 ID (如 hsk1_01) 判定，其次才是用户激活等级。
 * 2. SP 修正：死锁 SP 为“口语专项”，严禁 AI 胡说八道。
 * 3. 讲解质量：强制要求逻辑解析 + 缅甸语母语思维 + 3个例句。
 * 4. 即时性：Prompt 头部置入最高指令，要求 AI 必须先处理用户最新提问。
 */

export const AIProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  const [config, setConfig] = useState({
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
  });

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [remainingQuota, setRemainingQuota] = useState(0);

  const [aiMode, setAiMode] = useState('CHAT');
  const [activeTask, setActiveTask] = useState(null); 
  const [pageContext, setPageContext] = useState('');

  /* ========================================================
     核心修复：终极版 Prompt (解决详尽度、SP误解、追问灵活性)
  ======================================================== */
  const SYSTEM_PROMPTS = {
    CHAT: `你是一位顶级汉语教育专家，专门为【缅甸学生】提供一对一深度辅导。
【当前教学等级】：{{LEVEL}}
【核心戒律】：如果等级标签含有 SP，它代表“专业口语 (Speaking Practice)”，绝对禁止解释为 "Sponsored Program" 或任何商业项目。

【你的最高工作准则】：
1. **深度讲解义务**：当学生进入语法页或询问知识点时，你必须提供详尽的讲解。禁止敷衍，禁止只给出一两句话。你的回复必须包含：
   - 语法底层逻辑的深度剖析。
   - 缅甸语与汉语的思维差异对比。
   - 至少 3 个地道、实用的双语对比例句。
2. **问答灵活性**：虽然有课件内容参考，但你必须【优先回答学生最后提出的问题】。如果学生问课外内容（如苹果、钱、日常聊天），请立即切换为全能老师身份，给予最专业的回答。
3. **语言执行规则**：
   - HSK 1 / HSK 2：必须以【缅甸语为主】进行讲解，中文仅作为例句和关键词。
   - HSK 3 / HSK 4：采取“中文解释 + 缅文翻译”的一对一深度对照。
   - HSK 5 以上 / SP：以中文讲解为主，对抽象概念进行缅文辅助说明。

【当前页面参考内容】：{{CONTEXT}}

请根据以上准则，以最亲切、最详细的方式开始你的教学或回答。
追问格式：SUGGESTIONS: 建议1|||建议2|||建议3`,

    INTERACTIVE: `你是一名汉语语法私教，正在进行【错题专项深度解析】。
【语法背景】：{{GRAMMAR}} | 【原题】：{{QUESTION}} | 【学生错选】：{{USER_CHOICE}}
【等级】：{{LEVEL}}

【补课逻辑】：
- 严禁直接给出正确答案。
- 第一步：用缅甸语深度拆解为什么学生会误选 {{USER_CHOICE}}，找出思维漏洞。
- 第二步：提供一个生活化的尴尬场景，让学生明白选错后的实际误会。
- 第三步：给出一个能让人过目不忘的“记忆小窍门”。
- 第四步：引导学生进行追问。
SUGGESTIONS: Q1|||Q2|||Q3`
  };

  // --- 初始化与本地同步 ---
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
    if (savedSessions) {
      try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
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

  // --- 动态计算 System Prompt (等级识别核心) ---
  const finalSystemPrompt = useMemo(() => {
    let template = aiMode === 'INTERACTIVE' ? SYSTEM_PROMPTS.INTERACTIVE : SYSTEM_PROMPTS.CHAT;
    
    // 自动判定当前教学等级：教材数据 ID 优先级最高
    let detectedLevel = config.userLevel || 'HSK 1';
    const sourceString = String(activeTask?.id || pageContext || '').toLowerCase();
    
    if (sourceString.includes('hsk1')) detectedLevel = 'HSK 1';
    else if (sourceString.includes('hsk2')) detectedLevel = 'HSK 2';
    else if (sourceString.includes('hsk3')) detectedLevel = 'HSK 3';
    else if (sourceString.includes('sp')) detectedLevel = '口语专项 (Speaking Practice)';
    else if (detectedLevel.includes('SP')) detectedLevel = '口语专项 (Speaking Practice)';

    template = template.replace(/{{LEVEL}}/g, detectedLevel);
    
    if (aiMode === 'INTERACTIVE' && activeTask) {
        template = template.replace('{{GRAMMAR}}', activeTask.grammarPoint || '当前语法');
        template = template.replace('{{QUESTION}}', activeTask.question || '');
        template = template.replace('{{USER_CHOICE}}', activeTask.userChoice || '');
    } else {
        template = template.replace('{{CONTEXT}}', pageContext || '通用学习场景');
    }
    return template;
  }, [config.userLevel, aiMode, activeTask, pageContext]);

  // --- 外部触发函数 (语法页调用) ---
  
  /**
   * triggerAI: 点击语法标题或内容时调用
   * @param {string} title - 语法标题
   * @param {string} content - 语法详细详解内容
   * @param {string} id - 课件 ID (如 hsk1_01) 用于判定等级
   */
  const triggerAI = (title, content, id = null) => {
      setAiMode('CHAT');
      // 创建一个带时间戳的任务，让 AIChatDock 的 useEffect 能捕捉到变化并自动开讲
      const newTask = { 
          title, 
          content, 
          id, 
          timestamp: Date.now() 
      };
      setActiveTask(newTask); 
      setPageContext(`【当前讲解主题】：${title}。 【详细语法点描述】：${content}`);
      
      // 自动开启 AI 抽屉
      setIsAiOpen(true);

      // 如果当前没有活跃会话，或者需要为新话题开新会话，可在此处理
      if (!currentSessionId || sessions.length === 0) {
          const newId = Date.now();
          setSessions(prev => [{ id: newId, title: title || '新对话', messages: [], date: new Date().toISOString() }, ...prev]);
          setCurrentSessionId(newId);
      }
  };

  /**
   * triggerInteractiveAI: 做错题点击解析时调用
   */
  const triggerInteractiveAI = (payload) => {
    setAiMode('INTERACTIVE');
    const newSessionId = Date.now();
    setSessions(prev => [{ 
        id: newSessionId, 
        title: `错题解析: ${payload.grammarPoint || '语法'}`, 
        messages: [], 
        date: new Date().toISOString() 
    }, ...prev]);
    setCurrentSessionId(newSessionId);
    setActiveTask({ ...payload, timestamp: Date.now() });
    setIsAiOpen(true);
  };

  const resetToChatMode = () => {
      setAiMode('CHAT');
      setActiveTask(null);
      setPageContext('');
  };

  return (
    <AIContext.Provider value={{
        user, isActivated, config, setConfig, 
        sessions, setSessions,
        currentSessionId, setCurrentSessionId, 
        isAiOpen, setIsAiOpen,
        activeTask, aiMode, systemPrompt: finalSystemPrompt,
        triggerInteractiveAI, triggerAI, resetToChatMode
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
  const context = useContext(AIContext);
  if (!context) throw new Error("useAI must be used within AIProvider");
  return context;
};
