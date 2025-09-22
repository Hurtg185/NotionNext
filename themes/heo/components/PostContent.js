// themes/heo/components/PostContent.js (增 Facebook 视频链接匹配)

import React from 'react';

/**
 * 响应式的视频播放器组件 (内部使用)
 * @param {string} src - 视频的嵌入 URL
 */
const VideoPlayer = ({ src }) => (
  <div className="relative pt-[56.25%] my-4 bg-black rounded-lg overflow-hidden shadow-lg">
    {/* pt-[56.25%] 是实现 16:9 宽高比的 Tailwind CSS 技巧 */}
    <iframe
      className="absolute top-0 left-0 w-full h-full"
      src={src}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" // 推荐的安全策略
    ></iframe>
  </div>
);

/**
 * PostContent 组件
 * 自动将文本中的视频链接 (YouTube, Facebook) 替换为 iframe 播放器
 */
export default function PostContent({ content }) {
  if (typeof content !== 'string' || !content) {
    return null;
  }

  // 将内容按换行符分割成段落
  const paragraphs = content.split('\n');

  // 正则表达式用于匹配并提取视频ID或URL
  const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?$/;
  
  // 【核心修改】增强的 Facebook 正则表达式
  // 匹配 facebook.com/watch/, facebook.com/videos/, facebook.com/reel/, 和 fb.watch/
  // 并捕获完整的、干净的URL
  const facebookRegex = /^(https?:\/\/(?:www\.|m\.)?(?:facebook\.com\/(?:watch\/?\?v=|[^/]+\/videos\/|[^/]+\/reel\/)|fb\.watch\/)[\w.-]+)/;

  return (
    <div className="post-content">
      {paragraphs.map((paragraph, index) => {
        const trimmedParagraph = paragraph.trim();

        // 忽略空行
        if (trimmedParagraph === '') {
          return null;
        }

        const youtubeMatch = trimmedParagraph.match(youtubeRegex);
        const facebookMatch = trimmedParagraph.match(facebookRegex);

        // --- 渲染 YouTube 视频 ---
        if (youtubeMatch && youtubeMatch[1]) {
          const videoId = youtubeMatch[1];
          const embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0&modestbranding=1`;
          return <VideoPlayer key={index} src={embedSrc} />;
        }

        // --- 渲染 Facebook 视频 ---
        if (facebookMatch) {
          // facebookMatch[0] 捕获了完整的 URL，包括可能的跟踪参数
          // facebookMatch[1] 是我们捕获组捕获的更干净的 URL
          const videoUrl = facebookMatch[1] || facebookMatch[0]; // 优先使用捕获组
          const embedSrc = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=560`;
          return <VideoPlayer key={index} src={embedSrc} />;
        }
        
        // --- 渲染普通文本段落，并将文本中的URL转换为可点击链接 ---
        const urlInTextRegex = /(https?:\/\/[^\s]+)/g;
        const parts = paragraph.split(urlInTextRegex);

        return (
          <p key={index} className="text-base leading-relaxed whitespace-pre-wrap my-4">
            {parts.map((part, partIndex) => {
              if (urlInTextRegex.test(part)) {
                return (
                  <a
                    key={partIndex}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline break-all"
                  >
                    {part}
                  </a>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}
