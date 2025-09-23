// themes/heo/components/BottomNavBar.js (完整且已修改)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer';
import { useDrawer } from '@/lib/DrawerContext';
import { useAuth } from '@/lib/AuthContext'; // 【新增】引入 useAuth

const BottomNavBar = () => {
  const router = useRouter();
  const { user } = useAuth(); // 【新增】获取当前登录的用户信息
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();

  // 【核心修改】动态生成 navItems 数组
  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot', action: () => openDrawer('ai') },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '消息', path: '/forum/messages', icon: 'fas fa-paper-plane', type: 'link' },
    // 【新增】个人主页按钮，只有在用户登录后才显示
    // 如果用户未登录，user 为 null，这个按钮就不会被渲染
    user && { 
      name: '我的', 
      path: `/profile/${user.uid}`, // 动态生成个人主页链接
      icon: 'fas fa-user-circle', 
      type: 'link' 
    }
  ].filter(Boolean); // 使用 .filter(Boolean) 过滤掉未登录时的 null 值，确保数组干净

  return (
    <>
      <style jsx global>{`
        @media (max-width: 767px) {
          body {
            padding-bottom: 4rem; /* 4rem 等于 h-16 */
          }
        }
      `}</style>

      <div 
        id='bottom-nav' 
        className='bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden'
      >
        {navItems.map(item => {
          if (item.type === 'link') {
            // 【优化】更精确的 active 状态判断，避免'/'匹配所有路径
            const isActive = item.path === '/' ? router.pathname === '/' : router.pathname.startsWith(item.path);
            return (
              <Link key={item.name} href={item.path} passHref>
                <a className={`flex flex-col items-center justify-center h-full px-2 py-1 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                  <i className={`${item.icon} text-xl mb-1`}></i>
                  <span className='text-xs'>{item.name}</span>
                </a>
              </Link>
            );
          }
          // Button 类型的项保持不变
          return (
            <button key={item.name} onClick={item.action} className='flex flex-col items-center justify-center h-full px-2 py-1 text-gray-600 dark:text-gray-300'>
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span className='text-xs'>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* 你的抽屉和模态框组件保持不变 */}
      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      {/* 确保 drawerData 存在再访问其属性，避免报错 */}
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData?.conversation} />
    </>
  );
};

export default BottomNavBar;
