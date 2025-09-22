// themes/heo/components/PostContent.js (最终正确版 - 详情页支持 YT+TK 播放)

import React, { useEffect } from 'react';

// === 辅助函数区域 START ===
const getVideoInfo = (url) => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return { type: 'youtube', id: ytMatch[1] };
  }
  const tkMatch = url.match(/(?:tiktok\.com\/.*\/video\/(\d+))|(?:vm\.tiktok\.com\/([\w\d]+))/);
  if (tkMatch) {
    return { type: 'tiktok', id: tkMatch[1] || tkMatch[2], originalUrl: url };
  }
  return null;
};
// === 辅助函数区域 END ===

const PostContent = ({ content }) => {
  useEffect(() => {
    // 动态加载 TikTok 官方脚本，用于渲染播放器
    const tkScript = document.getElementById('tiktok-embed-script');
    if (content && content.includes('tiktok.com') && !tkScript) {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      script.id = 'tiktok-embed-script';
      document.head.appendChild(script);
    }
  }, [content]);

  if (!content) {
    return null;
  }

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        const videoInfo = getVideoInfo(trimmedLine);

        if (videoInfo) {
          if (videoInfo.type === 'youtube') {
            return (
              <div key={index} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${videoInfo.id}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            );
          }
          if (videoInfo.type === 'tiktok') {
            return (
              <blockquote
                key={index}
                className="tiktok-embed"
                cite={videoInfo.originalUrl}
                data-video-id={videoInfo.id}
                style={{
                  maxWidth: '325px',
                  minWidth: '32-5px',
                  minHeight: '750px',
                  margin: '2rem auto',
                }}
              >
                <section>
                  <a href={videoInfo.originalUrl} target="_blank" rel="noopener noreferrer"> </a>
                </section>
              </blockquote>
            );
          }
        }
        else if (trimmedLine === '') {
          return <br key={index} />;
        }
        else {
          return (
            <p key={index} className="my-2 break-all">
              {line}
            </p>
          );
        }
      })}
    </div>
  );
};

export default PostContent;
