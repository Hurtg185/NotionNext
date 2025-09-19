// components/SocialLogins.js 【功能增强与体验优化版】

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import Link from 'next/link'; // 1. 【新增】导入 Link 组件用于导航
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

// 动态导入 LoginModal 的逻辑保持不变，这很棒
const LoginModal = dynamic(
  () => import('./LoginModal'),
  { 
    loading: () => <p>加载中...</p>,
    ssr: false 
  }
);

const SocialLogins = () => {
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // 2. 【新增】控制下拉菜单的状态
  const dropdownRef = useRef(null); // 用于检测点击区域

  useEffect(() => {
    setIsMounted(true);

    // 3. 【新增】处理点击菜单外部区域关闭菜单的逻辑
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 封装登出操作，以便在点击后关闭下拉菜单
  const handleLogout = useCallback(() => {
    logout();
    setIsDropdownOpen(false);
  }, [logout]);

  if (!isMounted) {
    return <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>;
  }

  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <div className="flex items-center">
        {user ? (
          // 4. 【核心修改】将原有的 div 改造为带下拉菜单的交互组件
          <div className="relative" ref={dropdownRef}>
            {/* 这个按钮现在只负责打开/关闭下拉菜单 */}
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Image
                src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
                alt={user.displayName || 'User Avatar'}
                width={28}
                height={28}
                className="rounded-full border-2 border-gray-300 dark:border-gray-600 group-hover:border-blue-500 transition-colors"
              />
              <span className="hidden sm:block text-sm font-medium text-gray-800 dark:text-gray-200">{user.displayName}</span>
            </button>

            {/* 下拉菜单本身 */}
            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-gray-800 shadow-lg rounded-md border dark:border-gray-700 z-50 overflow-hidden">
                <ul>
                  {/* 菜单项1: 个人主页链接 */}
                  <li>
                    <Link href={`/profile/${user.uid}`} passHref>
                      <a 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full"
                      >
                        <i className="fas fa-user-circle w-4 text-center"></i>
                        <span>个人主页</span>
                      </a>
                    </Link>
                  </li>
                  {/* 菜单项2: 登出按钮 */}
                  <li>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full"
                    >
                      <i className="fas fa-sign-out-alt w-4 text-center"></i>
                      <span>登出</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          // 未登录状态的逻辑保持不变
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            登录
          </button>
        )}
      </div>

      {isModalOpen && <LoginModal isOpen={isModalOpen} onClose={closeModal} />}
    </>
  );
};

export default SocialLogins;
