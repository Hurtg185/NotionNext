// pages/forum/index.js (已修复 is not defined 错误)

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
    setLoading(true);

    let q;
    const postsRef = collection(db, 'posts');

    const orderClause = currentSort === '最热'
      ? orderBy('likesCount', 'desc')
      : orderBy('createdAt', 'desc');

    if (currentCategory === '推荐' || !currentCategory) {
      q = query(postsRef, orderClause);
    } else {
      q = query(postsRef, where('category', '==', currentCategory), orderClause);
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        title: doc.data().title || '无标题',
        authorName: doc.data().authorName || '匿名用户',
        commentsCount: doc.data().commentsCount || 0,
        likesCount: doc.data().likesCount || 0,
      }));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("获取帖子列表失败:", error);
      setPosts([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentCategory, currentSort]);

  // 【核心修复】：将缺失的 handle 函数定义添加回来
  const handleCategoryChange = (category) => {
    setCurrentCategory(category);
  };

  const handleSortChange = (sort) => {
    setCurrentSort(sort);
  };
  
  const handlePostButtonClick = (e) => {
    if (!user) {
      e.preventDefault();
      setIsLoginModalOpen(true);
    }
  };


  return (
    <LayoutBase> 
      <div className="bg-gradient-to-b from-gray-50 to-stone-100 dark:from-gray-900 dark:to-black min-h-screen">
        <div 
          className="relative h-56 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/forum-header-bg.jpg')" }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center">
            <h1 className="text-5xl font-extrabold text-white forum-header-shadow">中文社区</h1>
            <p className="mt-3 text-lg text-gray-200 forum-header-shadow">— 温故而知新，可以为师矣 —</p>
          </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 -mt-20 relative z-10">
          {/* 现在这里的 handleCategoryChange 和 handleSortChange 都能正确找到它们的定义了 */}
          <ForumCategoryTabs onCategoryChange={handleCategoryChange} onSortChange={handleSortChange} />
          
          <div className="mt-4 space-y-4 pb-16">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-lg">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                正在加载帖子...
              </div>
            ) : posts.length > 0 ? (
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

        {/* 发帖按钮保持不变 */}
        <Link href="/forum/new-post" passHref>
            <a
                onClick={handlePostButtonClick}
                className="fixed bottom-20 right-5 z-40 h-14 w-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110 active:scale-100"
                aria-label="发布新帖"
            >
                <i className="fas fa-pen text-xl"></i>
            </a>
        </Link>
        
      </div>
      
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </LayoutBase>
  );
};

export default ForumHomePage;
