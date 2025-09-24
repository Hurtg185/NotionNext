// themes/heo/components/BottomNavBar.js (完整且已修改)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer';
import { useDrawer } from '@/lib/DrawerContext';
import { useAuth } from '@/lib/AuthContext'; // 引入 useAuth

const BottomNavBar = () => {
  const router = useRouter();
  const { user } = useAuth(); // 获取当前登录的用户信息
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();

  // 【新增】处理“我的”按钮点击事件的函数
  const handleMyClick = () => {
    if (user) {
      // 如果用户已登录，跳转到个人主页
      router.push(`/profile/${user.uid}`);
    } else {
      // 如果用户未登录，提示并跳转到登录页面
      // 您可以自定义提示方式，例如使用弹窗组件
      alert('请先登录后再访问'); 
      // 请将 '/login' 替换为您的实际登录页面路径
      router.push('/login'); 
    }
  };

  // 【核心修改】navItems 数组现在是静态的，“我的”按钮永久存在
  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'button', icon: 'fas fa-robot', action: () => openDrawer('ai') },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '消息', path: '/forum/messages', icon: 'fas fa-paper-plane', type: 'link' },
    // 【修改】将“我的”按钮改为 'button' 类型，并绑定新的点击处理函数
    { 
      name: '我的', 
      icon: 'fas fa-user-circle', 
      type: 'button', // 改为 button 类型以绑定自定义 action
      action: handleMyClick // 点击时执行 handleMyClick 函数
    }
  ];

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
          // 渲染 Link 类型的项
          if (item.type === 'link') {
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
          // 渲染 Button 类型的项 (AI助手, 我的)
          if (item.type === 'button') {
             // 【优化】当用户在个人主页时，也高亮“我的”图标
            const isMyPageActive = item.name === '我的' && user && router.pathname.startsWith(`/profile/${user.uid}`);
            return (
              <button key={item.name} onClick={item.action} className={`flex flex-col items-center justify-center h-full px-2 py-1 transition-colors duration-200 ${isMyPageActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                <i className={`${item.icon} text-xl mb-1`}></i>
                <span className='text-xs'>{item.name}</span>
              </button>
            );
          }
          return null;
        })}
      </div>

      {/* 抽屉和模态框组件保持不变 */}
      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData?.conversation} />
    </>
  );
};

export default BottomNavBar;
