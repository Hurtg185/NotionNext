// themes/heo/components/PostContent.js (回归简单模式)

import React from 'react';

// 【核心①】：同样在这里添加YouTube ID提取函数，保持逻辑一致
const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const PostContent = ({ content }) => {
  if (!content) {
    return null;
  }

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        const videoId = getYouTubeId(trimmedLine);

        // 【核心②】：如果这一行是YouTube链接，就渲染一个可播放的iframe
        if (videoId) {
          return (
            <div key={index} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          );
        }
        // 如果是空行，渲染一个换行
        else if (trimmedLine === '') {
          return <br key={index} />;
        }
        // 否则，作为普通段落文本渲染
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
