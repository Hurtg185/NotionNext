// themes/heo/components/PostContent.js (终视频播放器极健壮版)

import React from 'react';
import dynamic from 'next/dynamic';

// 使用 next/dynamic 动态导入 ReactPlayer，并禁用SSR，这是正确做法
const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

const PostContent = ({ content }) => {
  if (!content) {
    return null;
  }

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        // 使用 ReactPlayer 官方的 canPlay() 方法来检测链接，这是最可靠的方式！
        // 只要是 ReactPlayer 支持的链接（FB, YT, Vimeo...），这里都会返回 true
        if (trimmedLine && ReactPlayer.canPlay(trimmedLine)) {
          return (
            <div key={index} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
              <ReactPlayer
                url={trimmedLine}
                width="100%"
                height="100%"
                controls={true} // 确保显示播放控件
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
