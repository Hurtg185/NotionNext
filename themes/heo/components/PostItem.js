// themes/heo/components/PostItem.js (最终安全版)

import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton';

// 只进行一次安全的动态导入
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const hasLiked = user && post.likers?.includes(user.uid);

  // 【核心修改】：不再调用 canPlay，只找出内容里的第一条链接
  const firstUrl = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    // 简单地找到第一行看起来像链接的文本
    const url = lines.find(line => line.trim().startsWith('http'));
    return url ? url.trim() : null;
  }, [post.content]);

  const handleLike = async () => { /* ... (保持不变) ... */ };
  const handleBookmark = () => { /* ... (保持不变) ... */ };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300">
        {/* 作者信息和帖子标题部分保持不变 */}
        <div className="flex items-center mb-3">
            {/* ... */}
        </div>
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          </a>
        </Link>
        
        {/* 【核心修改】：把找到的链接交给 ReactPlayer，并使用 light 属性 */}
        {firstUrl ? (
          <div 
             className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2"
             onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            <ReactPlayer
              url={firstUrl}
              light={true} // light 模式会自动处理：能播放就显示封面，不能播放就不显示任何东西
              playing={true}
              controls={true}
              width="100%"
              height="100%"
              className="absolute top-0 left-0"
            />
          </div>
        ) : (
          // 如果内容里连一条链接都没有，就显示文字摘要
          post.content && <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
        )}
        
        {/* 底部操作栏和分享模态框保持不变 */}
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
             {/* ... */}
        </div>
      </div>
    </>
  );
};

export default PostItem;
