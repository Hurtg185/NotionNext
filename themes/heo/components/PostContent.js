// themes/heo/components/PostContent.js (最终稳定版 - 无依赖库视频嵌入)

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
  // 确保正则表达式末尾有 $，表示匹配整行
  const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?$/;
  const facebookRegex = /^(https?:\/\/(?:www\.)?facebook\.com\/(?:watch\/\?v=|video\.php\?v=|[^/]+\/videos\/)(?:\d+)(?:\S+)?)$/;

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
          const videoUrl = facebookMatch[0];
          const embedSrc = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=false&width=560`;
          return <VideoPlayer key={index} src={embedSrc} />;
        }
        
        // --- 渲染普通文本段落 ---
        return (
          <p key={index} className="text-base leading-relaxed whitespace-pre-wrap my-4">
            {paragraph}
          </p>
        );
      })}
    </div>
  );
            }
