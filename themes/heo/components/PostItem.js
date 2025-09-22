// themes/heo/components/PostItem.js (最终修正版 - 逻辑与渲染分离)

import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton';

// 【核心修改 ①】：进行一次“静态导入”，专门用于逻辑判断
// 我们从这个导入中获取 canPlay 方法
import ReactPlayer from 'react-player';

// 【核心修改 ②】：进行一次“动态导入”，专门用于组件渲染
// 我们给它换个名字，避免冲突，比如 DynamicReactPlayer
const DynamicReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const hasLiked = user && post.likers?.includes(user.uid);
  
  const videoUrl = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    // 【核心修改 ③】：在这里使用静态导入的 ReactPlayer 进行 canPlay 判断，现在它一定存在！
    const url = lines.find(line => line.trim() && ReactPlayer.canPlay(line.trim()));
    return url ? url.trim() : null;
  }, [post.content]);

  // handleLike 和 handleBookmark 函数保持不变
  const handleLike = async () => { /* ... */ };
  const handleBookmark = () => { /* ... */ };

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
        
        {videoUrl ? (
          <div 
             className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2"
             onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            {/* 【核心修改 ④】：在这里使用动态导入的 DynamicReactPlayer 进行渲染 */}
            <DynamicReactPlayer
              url={videoUrl}
              light={true}
              playing={true}
              controls={true}
              width="100%"
              height="100%"
              className="absolute top-0 left-0"
            />
          </div>
        ) : (
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
