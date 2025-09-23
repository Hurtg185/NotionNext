// themes/heo/components/PostContent.js

import React from 'react';
import ReactPlayer from 'react-player';

const PostContent = ({ content }) => {
  // 如果没有任何内容，直接返回 null
  if (!content) {
    return null;
  }

  // 将帖子内容按行分割，并清除首尾空格
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {lines.map((line, idx) => {
        // 【核心逻辑】
        // 使用 ReactPlayer.canPlay() 判断这一行文本是不是一个它能播放的视频链接
        if (ReactPlayer.canPlay(line)) {
          return (
            // 如果是视频链接，就渲染一个播放器
            <div key={idx} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <ReactPlayer 
                url={line}          // 视频链接
                width="100%"        // 宽度占满容器
                height="100%"       // 高度占满容器
                controls={true}     // 显示播放控件
                className="absolute top-0 left-0"
              />
            </div>
          );
        }
        
        // 如果不是视频链接，就当做普通段落文本显示
        return (
          <p key={idx} className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
  );
};

export default PostContent;
