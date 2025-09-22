// pages/forum/index.js (已美化并调整间距)

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import Link from 'next/link';
import ForumCategoryTabs from '../../themes/heo/components/ForumCategoryTabs';
import PostItem from '../../themes/heo/components/PostItem';
import LoginModal from '@/components/LoginModal';
import { LayoutBase } from '@/themes/heo';

const ForumHomePage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  useEffect(() => {
    // ... useEffect 内部逻辑保持不变
  }, [currentCategory, currentSort]);

  // ... handle 函数保持不变

  return (
    <LayoutBase> 
      {/* 【美化①】：将背景色改为更柔和的渐变色 */}
      <div className="bg-gradient-to-b from-gray-50 to-stone-100 dark:from-gray-900 dark:to-black min-h-screen">
        <div 
          className="relative h-56 bg-cover bg-center" // 稍微增加头部高度
          style={{ backgroundImage: "url('/images/forum-header-bg.jpg')" }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center">
            <h1 className="text-5xl font-extrabold text-white forum-header-shadow">中文社区</h1>
            {/* 【修改①】：更换名言 */}
            <p className="mt-3 text-lg text-gray-200 forum-header-shadow">— 温故而知新，可以为师矣 —</p>
          </div>
        </div>

        {/* 【修改②】：将 -mt-20 改回，但在下方添加一个容器来创造间距 */}
        <div className="container mx-auto px-2 md:px-4 -mt-20 relative z-10">
          <ForumCategoryTabs onCategoryChange={handleCategoryChange} onSortChange={handleSortChange} />
          
          {/* 【修改③】：添加 pb-16 和 space-y-4 来控制间距和美化 */}
          <div className="mt-4 space-y-4 pb-16">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-lg">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                正在加载帖子...
              </div>
            ) : posts.length > 0 ? (
                // 【美化②】：给 PostItem 包裹一个带样式的 div
                posts.map(post => (
                  <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden post-card-hover">
                    <PostItem post={post} />
                  </div>
                ))
            ) : (
              <div className="p-8 text-center text-gray-500 text-lg">
                <p>该分类下还没有帖子哦，快来发布第一篇吧！</p>
              </div>
            )}
          </div>
        </div>

        {/* ... 发帖按钮保持不变 ... */}
        
      </div>
      
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </LayoutBase>
  );
};

export default ForumHomePage;
