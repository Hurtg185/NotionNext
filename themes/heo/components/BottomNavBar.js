// themes/heo/components/BottomNavBar.js (修改后，添加了唯一的 class)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer';
import ShortVideoModal from './ShortVideoModal';
import { useDrawer } from '@/lib/DrawerContext';

const BottomNavBar = () => {
  const router = useRouter();
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();
  const [showVideoModal, setShowVideoModal] = useState(false);

  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot', action: () => openDrawer('ai') },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '小姐姐', icon: 'fas fa-video', type: 'modal', action: () => setShowVideoModal(true) },
    { name: '消息', path: '/forum/messages', icon: 'fas fa-paper-plane', type: 'link' }
  ];

  return (
    <>
      <style jsx global>{`
        @media (max-width: 767px) {
          body {
            padding-bottom: 4rem;
          }
        }
      `}</style>

      {/* 【核心修改】在 className 的最前面加上了 'bottom-nav' */}
      <div 
        id='bottom-nav' 
        className='bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden'
      >
        {navItems.map(item => {
          if (item.type === 'link') {
            const isActive = router.pathname === item.path;
            return (
              <Link key={item.name} href={item.path} passHref>
                <a className={`flex flex-col items-center justify-center h-full px-2 py-1 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                  <i className={`${item.icon} text-xl mb-1`}></i>
                  <span className='text-xs'>{item.name}</span>
                </a>
              </Link>
            );
          }
          return (
            <button key={item.name} onClick={item.action} className='flex flex-col items-center justify-center h-full px-2 py-1 text-gray-600 dark:text-gray-300'>
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span className='text-xs'>{item.name}</span>
            </button>
          );
        })}
      </div>

      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData.conversation} />
      
      {showVideoModal && <ShortVideoModal onClose={() => setShowVideoModal(false)} />}
    </>
  );
};

export default BottomNavBar;
