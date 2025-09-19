// themes/heo/components/BottomNavBar.js (最终修复版)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer';
import MessagesListDrawer from './MessagesListDrawer'; // 【核心修改】: 导入消息列表抽屉组件
import { useDrawer } from '@/lib/DrawerContext'; // 导入全局抽屉Context


const BottomNavBar = () => {
  const router = useRouter();
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();

  // 导航项定义
  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot' },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '找工作', path: '/jobs', icon: 'fas fa-briefcase', type: 'link' },
    // 【核心修改】: “消息”按钮改为触发 'messages_list' 抽屉
    { name: '消息', type: 'messages_list', icon: 'fas fa-paper-plane', type: 'trigger' } 
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

      {/* 
        【核心CSS修复】:
        - `flex justify-around items-center`: 保持这个父级 Flex 容器。
        - 确保子元素 `<a>` 或 `按钮` 自身能够均分空间。
      */}
      <div id='bottom-nav' className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden'>
        {navItems.map(item => {
          // 根据 item.type 决定是 Link 还是 Button
          if (item.type === 'link') {
            // 匹配路由时，也要考虑 /forum/messages#chat-drawer 这样的情况
            const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path));
            return (
              <Link key={item.name} href={item.path} passHref>
                {/* 【核心CSS修复】: flex-1 和 text-center 确保均分和居中 */}
                <a className={`flex flex-col items-center justify-center flex-1 h-full px-2 py-1 transition-colors duration-200 text-center 
                               ${isActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                  <i className={`${item.icon} text-xl mb-1`}></i>
                  <span className='text-xs'>{item.name}</span>
                </a>
              </Link>
            );
          }
          // 如果是触发器按钮 (AI助手或消息列表)
          return (
            <button key={item.name} onClick={() => openDrawer(item.type)} className='flex flex-col items-center justify-center flex-1 h-full px-2 py-1 text-center 
                                                 text-gray-600 dark:text-gray-300'>
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span className='text-xs'>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* 抽屉组件 */}
      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData.conversation} />
      {/* 【核心修改】: 渲染消息列表抽屉 */}
      <MessagesListDrawer isOpen={activeDrawer === 'messages_list'} onClose={closeDrawer} />
    </>
  );
};

export default BottomNavBar;
