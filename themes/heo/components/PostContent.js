// themes/heo/components/PostContent.js (已支持 YouTube + TikTok)

import React, { useEffect } from 'react';

// === 辅助函数区域 START ===
const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// 【核心①】：新增一个专门用来从 TikTok 链接中提取信息的函数
const getTikTokVideoId = (url) => {
  if (!url) return null;
  // 正则表达式匹配 TikTok 的两种主要链接格式
  // 1. https://www.tiktok.com/@username/video/1234567890
  // 2. https://vm.tiktok.com/shortcode/
  const match = url.match(/(?:tiktok\.com\/)(?:@[\w.-]+\/video\/|v\/)(\d+)|(?:vm\.tiktok\.com\/)([\w\d]+)/);
  
  if (match) {
    // 如果是第一种格式，视频ID在 match[1]
    // 如果是第二种格式 (短链接), 我们需要完整的链接去做嵌入
    return match[1] || url; 
  }
  return null;
};
// === 辅助函数区域 END ===


const PostContent = ({ content }) => {
  // 【核心②】：为 TikTok 嵌入脚本添加的 useEffect
  // TikTok 的嵌入需要一个额外的JS脚本来渲染播放器
  useEffect(() => {
    // 检查页面上是否已经加载了 TikTok 的脚本
    if (!window.tiktok) {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      script.id = 'tiktok-embed-script'; // 给脚本一个ID，避免重复加载
      document.head.appendChild(script);

      // 组件卸载时清理脚本，虽然非必须，但是个好习惯
      return () => {
        const existingScript = document.getElementById('tiktok-embed-script');
        if (existingScript) {
          document.head.removeChild(existingScript);
        }
      };
    }
  }, []); // 这个 effect 只在组件首次加载时运行一次

  if (!content) {
    return null;
  }

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        const youTubeId = getYouTubeId(trimmedLine);
        const tikTokIdOrUrl = getTikTokVideoId(trimmedLine); // 【核心③】：检测 TikTok 链接

        if (youTubeId) {
          // --- YouTube 渲染逻辑 (保持不变) ---
          return (
            <div key={index} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube.com/embed/${youTubeId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          );
        } 
        else if (tikTokIdOrUrl) {
          // --- 【核心④】：新增的 TikTok 渲染逻辑 ---
          return (
            <blockquote
              key={index}
              className="tiktok-embed"
              cite={trimmedLine}
              data-video-id={tikTokIdOrUrl.includes('tiktok.com') ? null : tikTokIdOrUrl} // 如果是完整链接则ID为null
              style={{
                maxWidth: '325px', // TikTok 官方推荐的移动端宽度
                minWidth: '325px',
                minHeight: '750px', // 官方推荐高度
                margin: '2rem auto', // 居中显示
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                borderRadius: '8px'
              }}
            >
              <section></section>
            </blockquote>
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
