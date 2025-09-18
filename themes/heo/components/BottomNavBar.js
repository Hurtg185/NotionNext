// themes/heo/components/BottomNavBar.js (最终版，CSS修复 + 连接全局Context)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer';
import { useDrawer } from '@/lib/DrawerContext'; // 1. 从全局导入 useDrawer

const BottomNavBar = () => {
  const router = useRouter();
  // 2. 从全局Context获取状态和方法
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();

  // 恢复您原始的、正确的导航项定义
  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot' },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '找工作', path: '/jobs', icon: 'fas fa-briefcase', type: 'link' },
    { name: '消息', path: '/forum/messages', icon: 'fas fa-paper-plane', type: 'link' }
  ];

  return (
    <>
      <style jsx global>{`
        @media (max-width: 767px) {
          body {
            padding-bottom: 4rem; /* h-16 */
          }
        }
      `}</style>

      <div id='bottom-nav' className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden'>
        {navItems.map(item => {
          if (item.type === 'link') {
            const isActive = router.pathname === item.path;
            return (
              <Link key={item.name} href={item.path}>
                {/* 【核心CSS修复】: 将 flex-1 加到 <a> 标签上，让其撑开空间 */}
                <a className={`flex flex-col items-center justify-center flex-1 h-full px-2 py-1 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                  <i className={`${item.icon} text-xl mb-1`}></i>
                  <span className='text-xs'>{item.name}</span>
                </a>
              </Link>
            );
          }
          // 渲染触发器按钮
          return (
            <button key={item.name} onClick={() => openDrawer(item.type)} className='flex flex-col items-center justify-center flex-1 h-full px-2 py-1 text-gray-600 dark:text-gray-300'>
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span className='text-xs'>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* 抽屉组件现在由全局状态控制 */}
      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData.conversation} />
    </>
  );
};

export default BottomNavBar;
