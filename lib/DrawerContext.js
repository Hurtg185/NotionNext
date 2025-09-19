// lib/DrawerContext.js (最终修复版)

import React, { createContext, useContext, useState, useEffect } from 'react';

const DrawerContext = createContext(null);

export const useDrawer = () => useContext(DrawerContext);

export const DrawerProvider = ({ children }) => {
  // 【核心修改】: activeDrawer 类型可以包含 'messages_list'
  const [activeDrawer, setActiveDrawer] = useState(null); // 'ai', 'chat', 'messages_list' or null
  const [drawerData, setDrawerData] = useState({}); 

  const openDrawer = (type, data = {}) => {
    setDrawerData(data);
    setActiveDrawer(type);
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location);
      currentUrl.hash = `${type}-drawer`;
      window.history.pushState({}, '', currentUrl);
    }
  };

  const closeDrawer = () => {
    if (typeof window !== 'undefined' && window.location.hash.includes('-drawer')) {
      window.history.back(); // 使用 history.back() 来移除 hash
    } else {
      setActiveDrawer(null); // 如果没有 hash，直接关闭
    }
  };
  
  // 这个 useEffect 监听 popstate 事件，处理浏览器前进/后退手势关闭抽屉
  useEffect(() => {
    const handlePopState = () => {
      // 如果当前 URL 的 hash 不再包含 '-drawer'，并且有抽屉是打开的，就关闭它
      if (typeof window !== 'undefined' && !window.location.hash.includes('-drawer') && activeDrawer) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeDrawer]); // 依赖 activeDrawer，确保监听器能感知到抽屉的打开状态


  const value = {
    activeDrawer,
    drawerData,
    openDrawer,
    closeDrawer,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
