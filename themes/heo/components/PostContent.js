// themes/heo/components/PostContent.js
// (ReactPlayer 增强版 - 支持视频播放 + 普通网址自动转链接)

import React from 'react';
import ReactPlayer from 'react-player';

// === 判断是否为视频链接 ===
const isVideoUrl = (url) => {
  if (!url) return false;
  return ReactPlayer.canPlay(url); // react-player 内置判断
};

// === 判断是否为普通网址 ===
const isUrl = (text) => {
  if (!text) return false;
  return /^https?:\/\/[^\s]+$/.test(text); // 简单 URL 检测
};

const PostContent = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        // 视频链接
        if (isVideoUrl(trimmedLine)) {
          return (
            <div
              key={index}
              className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black"
            >
              <ReactPlayer
                url={trimmedLine}
                width="100%"
                height="100%"
                controls
                playsinline
              />
            </div>
          );
        }

        // 普通网址（非视频） -> 转成链接
        if (isUrl(trimmedLine)) {
          return (
            <p key={index} className="my-2 break-all text-blue-600 underline">
              <a href={trimmedLine} target="_blank" rel="noopener noreferrer">
                {trimmedLine}
              </a>
            </p>
          );
        }

        // 空行 -> 换行
        if (trimmedLine === '') {
          return <br key={index} />;
        }

        // 普通文字
        return (
          <p key={index} className="my-2 break-all">
            {line}
          </p>
        );
      })}
    </div>
  );
};

export default PostContent;
