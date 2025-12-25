import React, { createContext, useState, useContext, useEffect } from 'react';

// 定义用于 localStorage 的统一键名，确保数据隔离和版本控制
const CONFIG_KEY = 'ai_global_config_v12';
const SESSIONS_KEY = 'ai_global_sessions_v12';
const BOOKMARKS_KEY = 'ai_global_bookmarks_v12';
const ACTIVATION_KEY = 'course_activation_status'; // 您的激活状态键

// 1. 创建 Context
const AIContext = createContext();

// 2. 创建 Provider 组件，它将包裹您的整个应用
export const AIProvider = ({ children }) => {
  // --- 状态管理 ---
  
  // 用户的激活状态 (应与您的 D1 数据库逻辑对接)
  const [isActivated, setIsActivated] = useState(false);
  
  // 用户的 AI 配置 (API Key, 模型等)
  const [config, setConfig] = useState({
    apiKey: '',
    modelId: 'deepseek-ai/deepseek-v3.2',
    systemPrompt: '你是一位精通汉语和缅甸语的资深翻译老师。请用通俗易懂、口语化的中文为缅甸学生讲解汉语语法。排版要求：\n1. 使用 Notion 风格排版，重点清晰。\n2. 列表请使用多级结构 (▪️/◦)。\n3. 重点词汇请加粗(**)。\n4. 涉及表格时请使用 Markdown 表格。\n5. 在回答最后，请严格按照格式给出5个建议追问，格式为：\n[建议]: 问题1 | 问题2 | 问题3 | 问题4 | 问题5',
    ttsSpeed: 1.0,
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    showPinyin: true,
  });

  // AI 聊天窗口的 UI 状态
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null); // 用于存放从题目组件传来的解析任务

  // 聊天历史、收藏夹和当前会话 ID
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // --- 数据持久化 Effect ---

  // 在应用首次加载时，从 localStorage 读取所有数据
  useEffect(() => {
    // 加载配置
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try { setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) })); } catch (e) {}
    }
    
    // 加载聊天会话
    const savedSessions = localStorage.getItem(SESSIONS_KEY);
    let initialSessions = [];
    if (savedSessions) {
      try { initialSessions = JSON.parse(savedSessions); } catch(e) {}
    }
    if (initialSessions.length === 0) {
      const newSession = { id: Date.now(), title: '新对话', messages: [], pinned: false, date: new Date().toISOString() };
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

    // 加载激活状态 (这里模拟，实际应从您的后端 API 获取)
    const activationStatus = localStorage.getItem(ACTIVATION_KEY) === 'true';
    setIsActivated(activationStatus);

  }, []);

  // 当任何数据状态改变时，自动保存回 localStorage
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

  /**
   * 这是提供给所有外部组件（如语法、选择题）调用的核心函数。
   * 它负责设置 AI 的当前任务并自动打开聊天窗口。
   * @param {string} title - 内容的标题，例如 "语法点解析"。
   * @param {string} content - 题目或语法点的具体文本内容。
   */
  const triggerAI = (title, content) => {
    // 使用时间戳确保每次点击都是一个新的任务，以触发 useEffect
    setActiveTask({ title, content, timestamp: Date.now() }); 
    setIsAiOpen(true);
  };

  // 打包所有需要全局共享的状态和函数
  const value = {
    config,
    setConfig,
    isActivated,
    setIsActivated,
    isAiOpen,
    setIsAiOpen,
    activeTask,
    triggerAI,
    sessions,
    setSessions,
    bookmarks,
    setBookmarks,
    currentSessionId,
    setCurrentSessionId,
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
};

// 3. 创建一个自定义 Hook，方便子组件调用
export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI 必须在 AIProvider 内部使用');
  }
  return context;
};
