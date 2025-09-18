// lib/DrawerContext.js (全局管理器最终版)

import React, { createContext, useContext, useState } from 'react';

const DrawerContext = createContext(null);

export const useDrawer = () => useContext(DrawerContext);

export const DrawerProvider = ({ children }) => {
  const [activeDrawer, setActiveDrawer] = useState(null); // 'ai', 'chat', or null
  const [drawerData, setDrawerData] = useState({}); // 存放抽屉需要的数据

  const openDrawer = (type, data = {}) => {
    setDrawerData(data);
    setActiveDrawer(type);
    // 使用 hash 来支持手势返回，这是一个很好的实践
    // 注意：这里的 window 对象检查是安全的
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location);
      currentUrl.hash = `${type}-drawer`;
      window.history.pushState({}, '', currentUrl);
    }
  };

  const closeDrawer = () => {
    if (typeof window !== 'undefined' && window.location.hash.includes('-drawer')) {
      // router.back() 是更好的选择，但这里为了解耦，直接操作 history
      window.history.back();
    } else {
      setActiveDrawer(null);
    }
  };
  
  // 监听 popstate 事件 (浏览器前进/后退)
  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.hash.includes('-drawer')) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  const value = {
    activeDrawer,
    drawerData,
    openDrawer,
    closeDrawer,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
