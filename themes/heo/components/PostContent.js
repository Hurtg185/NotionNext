// themes/heo/components/PostContent.js (最终安全版)

import React from 'react';
import dynamic from 'next/dynamic';

// 只进行一次动态导入，这是最安全的方式
const ReactPlayer = dynamic(() => import('react-player'), { 
  ssr: false,
  // 添加一个加载占位符，提升体验
  loading: () => (
    <div className="aspect-video w-full bg-gray-900 flex items-center justify-center text-gray-400 rounded-lg">
      <i className="fas fa-spinner fa-spin mr-2"></i>
      正在加载播放器...
    </div>
  )
});

const PostContent = ({ content }) => {
  if (!content) {
    return null;
  }

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        
        // 【核心修改】：不再自己调用 canPlay 判断！
        // 我们只判断它是不是一个看起来像链接的字符串。
        if (trimmedLine.startsWith('http')) {
          return (
            <div key={index} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
              {/* 直接把链接交给 ReactPlayer，让它自己处理 */}
              <ReactPlayer
                url={trimmedLine}
                width="100%"
                height="100%"
                controls={true}
                className="absolute top-0 left-0"
              />
            </div>
          );
        }
        else if (trimmedLine === '') {
          return <br key={index} />;
        }
        else {
          return (
            <p key={index} className="my-2">
              {line}
            </p>
          );
        }
      })}
    </div>
  );
};

export default PostContent;
