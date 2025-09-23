// themes/heo/components/PostContent.js

import React from 'react';
import ReactPlayer from 'react-player';

/**
 * 将一些 react-player 可能不认识的新版链接转换为标准格式
 * @param {string} url 原始链接
 * @returns {string} 标准化后的链接
 */
const normalizeUrl = (url) => {
  // 转换 Facebook 的 /share/v/ 链接
  if (url.includes('facebook.com/share/v/')) {
    // 将 https://www.facebook.com/share/v/178cPgEtQW/ 转换为 https://www.facebook.com/videos/178cPgEtQW/
    return url.replace('/share/v/', '/videos/');
  }
  // 未来可以增加其他链接的转换规则
  return url;
};

const PostContent = ({ content }) => {
  if (!content) {
    return null;
  }

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {lines.map((line, idx) => {
        // 【核心修改】先将链接标准化
        const playableUrl = normalizeUrl(line);
        
        // 用标准化后的链接去判断和播放
        if (ReactPlayer.canPlay(playableUrl)) {
          return (
            <div key={idx} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <ReactPlayer 
                url={playableUrl}
                width="100%"
                height="100%"
                controls={true}
                className="absolute top-0 left-0"
              />
            </div>
          );
        }
        
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
