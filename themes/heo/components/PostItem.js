// themes/heo/components/PostItem.js (回归简模式 - 修复YouTube封面)

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton';

// 【核心①】：添加一个专门用来从YouTube链接中提取ID的辅助函数
const getYouTubeId = (url) => {
  if (!url) return null;
  // 这个正则表达式可以匹配多种YouTube链接格式 (如 /watch?v=, youtu.be/, /embed/)
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  // 如果匹配成功，返回11位的视频ID
  return (match && match[2].length === 11) ? match[2] : null;
};


const PostItem = ({ post }) => {
  const { user } = useAuth();
  const hasLiked = user && post.likers?.includes(user.uid);

  // 【核心②】：使用 useMemo 来高效地从帖子内容中提取出视频ID
  const videoId = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    for (const line of lines) {
      const id = getYouTubeId(line.trim());
      if (id) {
        return id; // 找到第一个有效的YouTube视频ID就返回
      }
    }
    return null; // 如果没找到，返回null
  }, [post.content]);

  // handleLike 和 handleBookmark 函数保持不变
  const handleLike = async () => { /* ... */ };
  const handleBookmark = () => { /* ... */ };

  return (
    <>
      <div className="p-4">
        {/* 作者信息和帖子标题部分保持不变 */}
        <div className="flex items-center mb-3">
            {/* ... */}
        </div>
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          </a>
        </Link>
        
        {/* 【核心③】：这是最重要的修改 - 根据 videoId 显示真实封面或文字 */}
        {videoId ? (
          // 如果我们成功提取到了视频ID
          <Link href={`/forum/post/${post.id}`} passHref>
            <a className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2 block">
              {/* 直接使用官方封面图链接 */}
              <img 
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} 
                alt={post.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105" 
              />
              {/* 添加一个播放按钮的覆盖层，使其看起来更像视频 */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <i className="fas fa-play text-white text-4xl bg-black/50 p-4 rounded-full"></i>
              </div>
            </a>
          </Link>
        ) : (
          // 如果没有视频，像以前一样显示文字摘要
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
