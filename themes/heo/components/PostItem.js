// themes/heo/components/PostItem.js (贴着列表最终优化版 - 使用 light 属性)

import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton';

// 动态导入 ReactPlayer，只在客户端使用
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostItem = ({ post }) => {
  const { user } = useAuth();
  // ... 其他 state (如 showShareModal) 保持不变
  const hasLiked = user && post.likers?.includes(user.uid);
  
  // 【第1步：简化视频检测逻辑】
  // 我们仍然使用 useMemo 和 canPlay 来检测内容中是否存在视频链接。
  const videoUrl = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    // .find 会返回第一个满足条件的行（即第一个可播放的视频链接）
    const url = lines.find(line => line.trim() && ReactPlayer.canPlay(line.trim()));
    return url ? url.trim() : null;
  }, [post.content]);

  // 【第2步：删除所有不再需要的代码】
  // 我们不再需要 isPlaying 状态
  // 我们不再需要 handlePlayClick 函数
  // 我们不再需要 getYouTubeThumbnail 函数和 thumbnail 变量

  const handleLike = async () => { /* ... (此函数保持不变) ... */ };
  const handleBookmark = () => { /* ... (此函数保持不变) ... */ };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300">
        {/* ... 作者信息和帖子标题部分保持不变 ... */}
        <div className="flex items-center mb-3">
            {/* ... */}
        </div>
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          </a>
        </Link>
        
        {/* 【第3步：核心修改 - 使用 ReactPlayer 的 light 属性】 */}
        {videoUrl ? (
          // 如果检测到视频链接
          <div 
             className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2"
             // 阻止点击视频时触发父级 Link 的跳转行为
             onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            <ReactPlayer
              url={videoUrl}
              light={true} // <-- 魔法就在这里！自动显示封面并启用懒加载
              playing={true} // <-- 点击封面后立即播放
              controls={true} // <-- 播放时显示控制条
              width="100%"
              height="100%"
              className="absolute top-0 left-0"
            />
          </div>
        ) : (
          // 如果没有视频，像以前一样显示文字摘要
          post.content && <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
        )}
        
        {/* ... 底部操作栏（点赞、评论等）保持不变 ... */}
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
             {/* ... */}
        </div>
      </div>
      
      {/* ... 分享模态框保持不变 ... */}
    </>
  );
};

export default PostItem;
