// themes/heo/components/PostItem.js (已修复 useAuth 错误)

import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext'; // 【核心修复】：添加了这一行
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostItem = ({ post }) => {
  const { user } = useAuth(); // 现在这一行可以正常工作了
  const hasLiked = user && post.likers?.includes(user.uid);

  const firstUrl = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    const url = lines.find(line => line.trim().startsWith('http'));
    return url ? url.trim() : null;
  }, [post.content]);

  const handleLike = async () => { /* ... (保持不变) ... */ };
  const handleBookmark = () => { /* ... (保持不变) ... */ };

  return (
    <>
      <div className="p-4">
        <div className="flex items-center mb-3">
            {/* 作者信息... */}
        </div>
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          </a>
        </Link>
        
        {firstUrl ? (
          <div 
             className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2"
             onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            <ReactPlayer
              url={firstUrl}
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
        
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
             {/* 底部操作栏... */}
        </div>
      </div>
    </>
  );
};

export default PostItem;
