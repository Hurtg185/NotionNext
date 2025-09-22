// pages/forum/new-post.js (修复字段命名并增强UI)

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/router';
import { LayoutBase } from '@/themes/heo'; // 导入基础布局
import Link from 'next/link';

// 定义分类和城市，方便管理
const categories = ['发现', '讨论', '日常生活', '问答', '资源共享'];
const cities = ['仰光', '曼德勒', '曼谷', '新加坡', '瑞丽', '其他'];

const NewPostPage = () => {
  const { user, loading: authLoading } = useAuth(); // 获取认证加载状态
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [city, setCity] = useState(cities[0]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setError('请先登录才能发帖。');
      return;
    }
    if (title.trim().length < 5 || title.trim().length > 30) {
      setError('标题长度必须在 5 到 30 个字之间。');
      return;
    }
    if (content.trim().length === 0) {
      setError('正文内容不能为空。');
      return;
    }
    if (content.length > 2000) {
      setError('正文内容不能超过 2000 字。');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'posts'), {
        title: title.trim(),
        content: content.trim(),
        category,
        city,
        authorId: user.uid,
        authorName: user.displayName || '匿名用户',
        authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp',
        createdAt: serverTimestamp(),
        
        // 【核心修复】使用与帖子详情页一致的字段名
        likes: [],          // 正确字段名
        dislikes: [],       // 新增字段
        likesCount: 0,      // 正确字段名
        commentsCount: 0,
      });

      alert('帖子发布成功！');
      router.push('/forum'); // 发布成功后跳转到论坛主页
    } catch (error) {
      console.error("创建帖子失败: ", error);
      setError('发布失败，请检查网络或稍后再试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
      return (
          <LayoutBase>
              <div className="text-center p-8">
                  <p>加载中...</p>
              </div>
          </LayoutBase>
      );
  }

  if (!user) {
    return (
        <LayoutBase>
            <div className="container mx-auto p-8 max-w-xl text-center">
                <h1 className="text-3xl font-bold mb-4">发布新帖</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">请登录后才能发布新帖。</p>
                <Link href="/signin" passHref>
                    <a className="mt-6 inline-block bg-blue-500 text-white px-6 py-3 rounded-md text-lg hover:bg-blue-600 transition-colors">
                        去登录
                    </a>
                </Link>
            </div>
        </LayoutBase>
    );
  }

  return (
    <LayoutBase>
        <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">创建新帖子</h1>
        <form onSubmit={handleCreatePost} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div>
            <label htmlFor="title" className="block text-lg font-medium text-gray-800 dark:text-gray-200">
                标题 <span className="text-gray-500 text-sm">({title.length}/30)</span>
            </label>
            <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 p-3 border rounded-md dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="一个吸引人的标题 (5-30字)"
            />
            </div>
            <div>
            <label htmlFor="content" className="block text-lg font-medium text-gray-800 dark:text-gray-200">
                正文 <span className="text-gray-500 text-sm">({content.length}/2000)</span>
            </label>
            <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows="12"
                className="w-full mt-1 p-3 border rounded-md dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="分享你的故事、问题，或者粘贴 YouTube/Facebook 视频链接..."
            />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="category" className="block text-lg font-medium text-gray-800 dark:text-gray-200">分类</label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 p-3 border rounded-md dark:bg-gray-700">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="city" className="block text-lg font-medium text-gray-800 dark:text-gray-200">城市</label>
                <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className="w-full mt-1 p-3 border rounded-md dark:bg-gray-700">
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            </div>
            
            <p className="text-xs text-center text-gray-500">提示：禁止发布任何违反当地法律法规的内容。</p>

            {error && <p className="text-red-500 text-center font-semibold">{error}</p>}
            
            <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-500 text-white px-6 py-3 rounded-md hover:bg-blue-600 font-bold text-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
            {isSubmitting ? '发布中...' : '发布帖子'}
            </button>
        </form>
        </div>
    </LayoutBase>
  );
};

export default NewPostPage;
