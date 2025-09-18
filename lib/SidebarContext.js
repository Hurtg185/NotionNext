// lib/SidebarContext.js

import React, { createContext, useContext, useState, useEffect } from 'react'; // 确保导入 useEffect

const SidebarContext = createContext(null);

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openSidebar = () => setIsOpen(true);
  const closeSidebar = () => setIsOpen(false);

  // 确保手势返回也能关闭侧边栏
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && !window.location.hash.includes('-drawer') && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);


  const value = {
    isOpen,
    openSidebar,
    closeSidebar,
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};
