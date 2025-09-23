// themes/heo/components/PostItem.js (完整且已修复)

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { handleVote } from '@/lib/postInteractions'; // 【核心】引入新的交互函数
import StartChatButton from './StartChatButton';

const getYouTubeId = (url) => { /* ... (保持不变) ... */ };

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const hasLiked = user && post.likers?.includes(user.uid);

  const videoId = useMemo(() => { /* ... (保持不变) ... */ }, [post.content]);

  // 【核心】实现点赞逻辑
  const onLikeClick = (e) => {
    e.preventDefault(); // 阻止事件冒泡和链接跳转
    e.stopPropagation();
    handleVote(`posts/${post.id}`, user?.uid, post.likers, post.dislikers, 'like');
  };

  // 【核心】实现点踩逻辑 (示例)
  const onDislikeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleVote(`posts/${post.id}`, user?.uid, post.likers, post.dislikers, 'dislike');
  };

  return (
    <div className="p-4">
      <div className="flex items-center mb-3">
        {/* ... (作者信息部分保持不变) ... */}
      </div>

      <Link href={`/forum/post/${post.id}`}>
        <a className="space-y-2 block my-3">
          <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          {!videoId && (<p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>)}
        </a>
      </Link>

      {videoId && (
        <Link href={`/forum/post/${post.id}`} passHref>
          {/* ... (YouTube 封面部分保持不变) ... */}
        </Link>
      )}

      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button
          onClick={onLikeClick}
          className={`flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}
        >
          {hasLiked ? <i className="fas fa-heart text-lg"></i> : <i className="far fa-heart text-lg"></i>}
          <span className="text-sm font-semibold">{post.likesCount || 0}</span>
        </button>
        <button
          onClick={onDislikeClick}
          className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
        >
          <i className="far fa-thumbs-down text-lg"></i>
          {/* 这里可以显示点踩数，如果需要的话 */}
        </button>
        <Link href={`/forum/post/${post.id}#comments`}>
          <a className="flex items-center space-x-2 hover:text-green-500 transition-colors">
            <i className="far fa-comment-dots text-lg"></i>
            <span className="text-sm font-semibold">{post.commentsCount || 0}</span>
          </a>
        </Link>
      </div>
    </div>
  );
};

export default PostItem;
