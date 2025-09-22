// themes/heo/components/PostItem.js (已支持 YouTube + TikTok)

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
// ... 其他 import 保持不变 ...

// === 辅助函数区域 START ===
const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// 【核心①】：同样在这里添加 TikTok 的检测函数
const isTikTokUrl = (url) => {
  if (!url) return false;
  return url.includes('tiktok.com');
};
// === 辅助函数区域 END ===


const PostItem = ({ post }) => {
  const { user } = useAuth();
  const hasLiked = user && post.likers?.includes(user.uid);

  // 【核心②】：修改 useMemo，让它能同时检测两种视频
  const videoInfo = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      const ytId = getYouTubeId(trimmedLine);
      if (ytId) {
        return { type: 'youtube', id: ytId }; // 如果是油管，返回类型和ID
      }
      if (isTikTokUrl(trimmedLine)) {
        return { type: 'tiktok', id: null }; // 如果是TikTok，返回类型，ID为null
      }
    }
    return null;
  }, [post.content]);

  // handleLike 和 handleBookmark 函数保持不变
  // ...

  return (
    <>
      <div className="p-4">
        {/* 作者信息和帖子标题部分保持不变 */}
        {/* ... */}
        
        {/* 【核心③】：根据 videoInfo 的类型来渲染不同的预览 */}
        {videoInfo ? (
          <Link href={`/forum/post/${post.id}`} passHref>
            <a className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2 block">
              {/* --- 如果是 YouTube --- */}
              {videoInfo.type === 'youtube' && (
                <>
                  <img 
                    src={`https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`} 
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <i className="fab fa-youtube text-white text-5xl"></i>
                  </div>
                </>
              )}
              {/* --- 如果是 TikTok --- */}
              {videoInfo.type === 'tiktok' && (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4 text-center">
                    <i className="fab fa-tiktok text-5xl mb-3"></i>
                    <p className='font-semibold'>包含 TikTok 视频</p>
                    <p className="text-sm text-gray-400">点击查看详情</p>
                </div>
              )}
            </a>
          </Link>
        ) : (
          // 如果没有视频，显示文字摘要
          post.content && <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
        )}
        
        {/* 底部操作栏和分享模态框保持不变 */}
        {/* ... */}
      </div>
    </>
  );
};

export default PostItem;
