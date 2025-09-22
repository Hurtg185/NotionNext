// themes/heo/components/PostItem.js (简单视频占位符版)

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton';
import ReactPlayer from 'react-player'; // 仅用于 canPlay 检测

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const [showShareModal, setShowShareModal] = useState(false);
  const postUrl = `${siteConfig('LINK')}/forum/post/${post.id}`;
  const hasLiked = user && post.likers?.includes(user.uid);

  // 使用 useMemo 和 ReactPlayer.canPlay() 来高效检测视频链接
  const videoUrl = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    // 查找第一条有效的视频链接
    const url = lines.find(line => line.trim() && ReactPlayer.canPlay(line.trim()));
    return url ? url.trim() : null;
  }, [post.content]);

  // 根据链接判断视频来源
  const getVideoPlatform = (url) => {
    if (!url) return null;
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return 'other'; // 其他平台
  }
  const platform = getVideoPlatform(videoUrl);

  // ... 省略 handleLike 和 handleBookmark 函数，保持不变 ...
  const handleLike = async () => { /* ... */ };
  const handleBookmark = () => { /* ... */ };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300">
        {/* ... 作者信息部分保持不变 ... */}
        <div className="flex items-center mb-3">
            {/* ... */}
        </div>
        
        <Link href={`/forum/post/${post.id}`}>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
            
            {/* ========== 核心修改：视频预览逻辑 ========== */}
            {videoUrl ? (
              <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden group p-4 flex flex-col items-center justify-center text-white text-center">
                {platform === 'facebook' && <i className="fab fa-facebook text-4xl mb-3"></i>}
                {platform === 'youtube' && <i className="fab fa-youtube text-4xl mb-3 text-red-500"></i>}
                {platform === 'other' && <i className="fas fa-video text-4xl mb-3"></i>}
                <p className="font-semibold">包含视频内容</p>
                <p className="text-sm text-gray-300">点击查看详情</p>
                <div className="absolute inset-0 bg-black opacity-30 group-hover:opacity-50 transition-opacity"></div>
              </div>
            ) : (
              <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
            )}
            {/* ========================================= */}

          </a>
        </Link>
        
        {/* ... 底部操作栏保持不变 ... */}
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
            {/* ... */}
        </div>
      </div>
      
      {/* ... 分享模态框保持不变 ... */}
    </>
  );
};

export default PostItem;
