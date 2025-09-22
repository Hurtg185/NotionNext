// themes/heo/components/PostItem.js (已修复视频黑屏)

import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// ... 其他 import

// 动态导入 ReactPlayer，只在客户端使用
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostItem = ({ post }) => {
  const { user } = useAuth();
  // ... 其他 state

  // 【修复①】：只找出内容里的第一条链接，不再调用 canPlay
  const firstUrl = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    const url = lines.find(line => line.trim().startsWith('http'));
    return url ? url.trim() : null;
  }, [post.content]);

  // ... handle 函数保持不变

  return (
    <>
      {/* 【美化③】：移除外部的边框和阴影，因为父组件已经提供了 */}
      <div className="p-4">
        {/* ... 作者信息部分 ... */}
        
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          </a>
        </Link>
        
        {/* 【修复②】：把找到的链接交给 ReactPlayer，并使用 light 属性 */}
        {firstUrl ? (
          <div 
             className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2"
             onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            <ReactPlayer
              url={firstUrl}
              light={true} // 自动显示封面，能播放就显示，不能就不显示
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
        
        {/* ... 底部操作栏 ... */}
      </div>
    </>
  );
};

export default PostItem;
