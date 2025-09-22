// themes/heo/components/PostContent.js (已修复视频黑屏)

import React from 'react';
import dynamic from 'next/dynamic';

const ReactPlayer = dynamic(() => import('react-player'), { 
  ssr: false,
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
        
        // 【修复③】：不再调用 canPlay，只判断是否是链接
        if (trimmedLine.startsWith('http')) {
          return (
            <div key={index} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
              {/* 直接把链接交给 ReactPlayer，让它自己判断和渲染 */}
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
