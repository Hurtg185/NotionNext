// themes/heo/components/BottomNavBar.js (完整且已修改)

import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react'; // 【新增】引入 useState
import AIChatDrawer from './AIChatDrawer'; 
import ChatDrawer from './ChatDrawer';
import ShortVideoModal from './ShortVideoModal'; // 【新增】引入短视频模态框
import { useDrawer } from '@/lib/DrawerContext';

const BottomNavBar = () => {
  const router = useRouter();
  const { activeDrawer, drawerData, openDrawer, closeDrawer } = useDrawer();
  const [showVideoModal, setShowVideoModal] = useState(false); // 【新增】控制视频模态框的状态

  // 【修改】调整 navItems 结构，为“找工作”添加新的 type 和 action
  const navItems = [
    { name: '主页', path: '/', icon: 'fas fa-home', type: 'link' },
    { name: 'AI助手', type: 'ai', icon: 'fas fa-robot', action: () => openDrawer('ai') },
    { name: '社区', path: '/forum', icon: 'fas fa-comments', type: 'link' },
    { name: '小姐姐', icon: 'fas fa-video', type: 'modal', action: () => setShowVideoModal(true) }, // 【核心修改】
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

      <div id='bottom-nav' className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden'>
        {navItems.map(item => {
          // 如果是链接类型
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
          // 如果是其他类型（抽屉或模态框），统一使用 button
          return (
            <button key={item.name} onClick={item.action} className='flex flex-col items-center justify-center h-full px-2 py-1 text-gray-600 dark:text-gray-300'>
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span className='text-xs'>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* 渲染抽屉 */}
      <AIChatDrawer isOpen={activeDrawer === 'ai'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} conversation={drawerData.conversation} />
      
      {/* 【新增】根据状态渲染短视频模态框 */}
      {showVideoModal && <ShortVideoModal onClose={() => setShowVideoModal(false)} />}
    </>
  );
};

export default BottomNavBar;
