// lib/DrawerContext.js (useEffect 导入修复版)

// 核心修改: 在这里从 'react' 中导入 useEffect
import React, { createContext, useContext, useState, useEffect } from 'react';

const DrawerContext = createContext(null);

export const useDrawer = () => useContext(DrawerContext);

export const DrawerProvider = ({ children }) => {
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [drawerData, setDrawerData] = useState({});

  const openDrawer = (type, data = {}) => {
    setDrawerData(data);
    setActiveDrawer(type);
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location);
      currentUrl.hash = `${type}-drawer`;
      // 使用 pushState 来避免页面重新加载
      window.history.pushState({}, '', currentUrl);
    }
  };

  const closeDrawer = () => {
    if (typeof window !== 'undefined' && window.location.hash.includes('-drawer')) {
      window.history.back();
    } else {
      setActiveDrawer(null);
    }
  };
  
  // 这个 useEffect 正是导致错误的原因，因为它没有被导入
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && !window.location.hash.includes('-drawer')) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 空依赖数组表示这个 effect 只在组件挂载和卸载时运行


  const value = {
    activeDrawer,
    drawerData,
    openDrawer,
    closeDrawer,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
